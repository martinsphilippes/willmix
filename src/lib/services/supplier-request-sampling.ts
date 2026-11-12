import "server-only";

import { assertCan } from "@/lib/auth/function-access";
import { isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type SamplingEvent,
  type SamplingFile,
  type SupplierRequest,
  type SupplierRequestSampling,
  type User,
} from "@/lib/db";
import {
  SAMPLING_MAX_FILES,
  samplingCanReview,
  samplingCanSubmit,
  samplingCanUpload,
  samplingKind,
  samplingOf,
  samplingRoundFiles,
} from "@/lib/supplier-request-sampling";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { audit } from "./audit";
import { SupplierRequestError } from "./supplier-requests";

/*
 * Amostragem da solicitação ao fornecedor (docs/SUPPLIER_SAMPLING.md).
 * Depois da aprovação, o responsável pelo booking (o fornecedor da
 * solicitação) sobe fotos e vídeos de uma amostra do item e envia para a
 * validação; a Wellmix aprova ou reprova com o motivo. Reprovada, ele manda
 * outra rodada. Os arquivos são documentos com `supplierRequestId`: só a
 * Wellmix e o fornecedor da solicitação abrem.
 */

const TEXT_MAX = 2000;
const clip = (s: string | null | undefined) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, TEXT_MAX) : null;
};

async function load(user: User, id: string) {
  assertScreen(user, "quotes");
  const { isSchemaMissing } = await import("@/lib/db/errors");
  let request: SupplierRequest | null;
  try {
    request = await getStore().get("supplier_requests", id);
  } catch (error) {
    if (isSchemaMissing(error))
      throw new SupplierRequestError("schema_outdated");
    throw error;
  }
  if (!request) throw new SupplierRequestError("not_found");
  const wellmix = isWellmix(user);
  const own =
    user.role === "supplier" &&
    !!user.partyId &&
    request.supplierId === user.partyId;
  if (!wellmix && !own) throw new SupplierRequestError("not_found");
  const sampling = samplingOf(request);
  if (!sampling) throw new SupplierRequestError("sampling_not_open");
  return { request, sampling, wellmix };
}

/** Só o responsável pelo booking (fornecedor da solicitação) envia a amostra. */
function assertSupplier(wellmix: boolean) {
  if (wellmix) throw new SupplierRequestError("sampling_supplier_only");
}

function step(
  user: User,
  sampling: SupplierRequestSampling,
  fields: Pick<SamplingEvent, "kind" | "side"> &
    Partial<Pick<SamplingEvent, "text" | "files">>,
): SamplingEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    byUserId: user.id,
    round: sampling.round,
    ...fields,
  };
}

async function save(
  request: SupplierRequest,
  sampling: SupplierRequestSampling,
) {
  return getStore().update("supplier_requests", request.id, { sampling });
}

async function notifyTo(
  request: SupplierRequest,
  to: "wellmix" | "supplier",
  key: "opened" | "submitted" | "approved" | "rejected",
  vars: Record<string, string | number> = {},
) {
  const { notify } = await import("./notifications");
  const product =
    request.item.description ??
    request.item.productName ??
    request.item.factoryItemCode ??
    "—";
  await notify(
    to === "wellmix"
      ? { userIds: [request.createdByUserId] }
      : { role: "supplier", partyId: request.supplierId },
    {
      link: `/app/supplier-requests/${request.id}?view=item#amostragem`,
      kind: key === "approved" ? "done" : "action",
      ...(to === "wellmix" ? { actor: "wellmix" as const } : {}),
      text: (t) => ({
        subject: t(`sampling.notify.${key}.subject` as DictionaryKey, {
          n: request.number,
          product,
          ...vars,
        }),
        body: t(`sampling.notify.${key}.body` as DictionaryKey, {
          n: request.number,
          product,
          ...vars,
        }),
      }),
    },
  ).catch((error) => console.error(`notify(sampling.${key})`, error));
}

/** Aviso ao responsável quando a solicitação é aprovada: envie a amostra. */
export async function notifySamplingOpened(request: SupplierRequest) {
  await notifyTo(request, "supplier", "opened");
}

/**
 * Foto ou vídeo da amostra: arquivo no formulário (até ~4 MB) ou já subido
 * direto ao armazenamento (`uploadedFileId`, vídeos grandes).
 */
export async function addSamplingFile(
  user: User,
  id: string,
  input: { file: File | null; uploadedFileId: string | null },
): Promise<SupplierRequest> {
  const { request, sampling, wellmix } = await load(user, id);
  assertSupplier(wellmix);
  if (!samplingCanUpload(sampling))
    throw new SupplierRequestError("sampling_closed");
  if (samplingRoundFiles(sampling).length >= SAMPLING_MAX_FILES)
    throw new SupplierRequestError("sampling_too_many");
  const docs = await import("./documents");
  const target = {
    type: "photo" as const,
    visibility: "internal" as const,
    supplierRequestId: request.id,
    video: true,
  };
  let doc;
  if (input.file && input.file.size > 0) {
    if (!samplingKind(input.file.type))
      throw new SupplierRequestError("sampling_file_type");
    doc = await docs.uploadDocument(user, input.file, target);
  } else if (input.uploadedFileId) {
    doc = await docs.registerUploadedDocument(
      user,
      input.uploadedFileId,
      target,
    );
  } else throw new SupplierRequestError("sampling_file_missing");
  const kind = samplingKind(doc.mime);
  if (!kind) throw new SupplierRequestError("sampling_file_type");
  const file: SamplingFile = {
    documentId: doc.id,
    fileName: doc.name,
    mime: doc.mime,
    kind,
    round: sampling.round,
    at: new Date().toISOString(),
    byUserId: user.id,
  };
  const updated = await save(request, {
    ...sampling,
    files: [...sampling.files, file],
  });
  await audit(
    user,
    "sampling.file",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: amostragem, ${kind === "video" ? "vídeo" : "foto"} ${doc.name}`,
  );
  return updated;
}

/** Tira da rodada um arquivo que ainda não foi enviado (o documento fica guardado). */
export async function removeSamplingFile(
  user: User,
  id: string,
  documentId: string,
): Promise<SupplierRequest> {
  const { request, sampling, wellmix } = await load(user, id);
  assertSupplier(wellmix);
  if (!samplingCanUpload(sampling))
    throw new SupplierRequestError("sampling_closed");
  const file = sampling.files.find(
    (f) => f.documentId === documentId && f.round === sampling.round,
  );
  if (!file) throw new SupplierRequestError("not_found");
  const updated = await save(request, {
    ...sampling,
    files: sampling.files.filter((f) => f !== file),
  });
  await audit(
    user,
    "sampling.file_remove",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: amostragem, retirado ${file.fileName}`,
  );
  return updated;
}

/** O responsável envia a rodada para a Wellmix validar. */
export async function submitSampling(
  user: User,
  id: string,
  note: string | null,
): Promise<SupplierRequest> {
  const { request, sampling, wellmix } = await load(user, id);
  assertSupplier(wellmix);
  if (!samplingCanUpload(sampling))
    throw new SupplierRequestError("sampling_closed");
  if (!samplingCanSubmit(sampling))
    throw new SupplierRequestError("sampling_file_missing");
  const files = samplingRoundFiles(sampling).length;
  const now = new Date().toISOString();
  const updated = await save(request, {
    ...sampling,
    status: "submitted",
    submittedAt: now,
    history: [
      ...sampling.history,
      step(user, sampling, {
        kind: "submit",
        side: "supplier",
        text: clip(note),
        files,
      }),
    ],
  });
  await audit(
    user,
    "sampling.submit",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: amostragem enviada (rodada ${sampling.round}, ${files} arquivos)`,
  );
  await notifyTo(request, "wellmix", "submitted", { files });
  return updated;
}

/**
 * A Wellmix valida a amostra enviada: aprova ou reprova (motivo
 * obrigatório). Reprovada, abre outra rodada para o responsável.
 */
export async function reviewSampling(
  user: User,
  id: string,
  decision: "approve" | "reject",
  note: string | null,
): Promise<SupplierRequest> {
  const { request, sampling, wellmix } = await load(user, id);
  if (!wellmix) throw new SupplierRequestError("not_found");
  assertCan(user, "sampling.validate");
  if (!samplingCanReview(sampling))
    throw new SupplierRequestError("sampling_not_submitted");
  const text = clip(note);
  if (decision === "reject" && !text)
    throw new SupplierRequestError("sampling_reason_required");
  const now = new Date().toISOString();
  const event = step(user, sampling, {
    kind: decision,
    side: "wellmix",
    text,
  });
  const updated = await save(request, {
    ...sampling,
    status: decision === "approve" ? "approved" : "rejected",
    round: decision === "approve" ? sampling.round : sampling.round + 1,
    reviewedAt: now,
    reviewedByUserId: user.id,
    history: [...sampling.history, event],
  });
  await audit(
    user,
    `sampling.${decision}`,
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: amostragem ${decision === "approve" ? "aprovada" : "reprovada"} (rodada ${sampling.round})`,
    { status: sampling.status },
    { status: decision === "approve" ? "approved" : "rejected" },
  );
  await notifyTo(
    request,
    "supplier",
    decision === "approve" ? "approved" : "rejected",
    { reason: text ?? "" },
  );
  return updated;
}
