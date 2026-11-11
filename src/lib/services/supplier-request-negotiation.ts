import "server-only";

import { isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type SheetCurrency,
  type SupplierRequest,
  type SupplierRequestEvent,
  type User,
} from "@/lib/db";
import {
  canPostMessage,
  canPropose,
  pendingProposal,
  supplierRequestActive,
  supplierRequestLate,
  supplierRequestSlaDue,
} from "@/lib/supplier-requests";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { audit } from "./audit";
import { SupplierRequestError } from "./supplier-requests";

/*
 * Negociação da solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md,
 * "Negociação"). Na resposta "faz", a Wellmix devolve com contraproposta
 * (preço, MOQ, prazo e comentário); o fornecedor aceita (vira a resposta),
 * responde com outra proposta ou recusa (fica a resposta anterior). Rodadas
 * sem limite, guardadas em `negotiation`. Mensagens livres e arquivos (foto,
 * PDF ou Excel) dos dois lados. O SLA conta da abertura até a decisão.
 */

/** Arquivos da conversa: foto, PDF ou Excel. */
export const NEGOTIATION_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
];
/** Passos guardados por solicitação (as rodadas mais antigas saem do histórico). */
const MAX_EVENTS = 500;
const TEXT_MAX = 4000;

const clip = (s: string | null | undefined, max = TEXT_MAX) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : null;
};

/** Quem vê: a Wellmix todas; o fornecedor só as do próprio cadastro. */
function sideOf(user: User, request: SupplierRequest) {
  if (isWellmix(user)) return "wellmix" as const;
  if (
    user.role === "supplier" &&
    !!user.partyId &&
    request.supplierId === user.partyId
  )
    return "supplier" as const;
  return null;
}

async function load(user: User, id: string) {
  assertScreen(user, "quotes");
  const { isSchemaMissing } = await import("./packaging-brief");
  let request: SupplierRequest | null;
  try {
    request = await getStore().get("supplier_requests", id);
  } catch (error) {
    if (isSchemaMissing(error))
      throw new SupplierRequestError("schema_outdated");
    throw error;
  }
  const side = request ? sideOf(user, request) : null;
  if (!request || !side) throw new SupplierRequestError("not_found");
  return { request, side };
}

function event(
  user: User,
  side: "wellmix" | "supplier",
  fields: Omit<SupplierRequestEvent, "id" | "at" | "side" | "byUserId">,
): SupplierRequestEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    side,
    byUserId: user.id,
    ...fields,
  };
}

const append = (request: SupplierRequest, e: SupplierRequestEvent) =>
  [...(request.negotiation ?? []), e].slice(-MAX_EVENTS);

/** Avisa o outro lado: a Wellmix (quem abriu) ou os logins do fornecedor. */
async function notifyOther(
  request: SupplierRequest,
  to: "wellmix" | "supplier",
  subject: DictionaryKey,
  body: DictionaryKey,
  vars: Record<string, string | number> = {},
) {
  const { notify } = await import("./notifications");
  await notify(
    to === "wellmix"
      ? { userIds: [request.createdByUserId] }
      : { role: "supplier", partyId: request.supplierId },
    {
      link: `/app/supplier-requests/${request.id}`,
      kind: "action",
      ...(to === "wellmix" ? { actor: "wellmix" as const } : {}),
      text: (t) => ({
        subject: t(subject, { n: request.number, ...vars }),
        body: t(body, { n: request.number, ...vars }),
      }),
    },
  ).catch((error) =>
    console.error("notify(supplier_request.negotiation)", error),
  );
}

export interface OfferInput {
  price: number | null;
  currency: SheetCurrency | null;
  moq: number | null;
  leadTimeDays: number | null;
  text: string | null;
}

/**
 * A Wellmix devolve com contraproposta: comentário obrigatório e ao menos um
 * valor (preço, MOQ ou prazo). Até o fornecedor responder, não aprova.
 */
export async function proposeCounter(
  user: User,
  id: string,
  input: OfferInput,
): Promise<SupplierRequest> {
  const { request, side } = await load(user, id);
  if (side !== "wellmix") throw new SupplierRequestError("not_found");
  if (pendingProposal(request.negotiation))
    throw new SupplierRequestError("supplier_request_proposal_pending");
  if (!canPropose(request))
    throw new SupplierRequestError("supplier_request_propose_invalid");
  const text = clip(input.text);
  if (!text)
    throw new SupplierRequestError("supplier_request_comment_required");
  if (input.price === null && input.moq === null && input.leadTimeDays === null)
    throw new SupplierRequestError("supplier_request_offer_empty");
  const e = event(user, side, {
    kind: "proposal",
    price: input.price,
    currency:
      input.price === null
        ? null
        : (input.currency ?? request.supplierCurrency ?? "USD"),
    moq: input.moq,
    leadTimeDays: input.leadTimeDays,
    text,
  });
  const updated = await getStore().update("supplier_requests", request.id, {
    negotiation: append(request, e),
  });
  await audit(
    user,
    "supplier_request.propose",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: contraproposta`,
  );
  await notifyOther(
    request,
    "supplier",
    "supplierRequests.notify.proposal.subject",
    "supplierRequests.notify.proposal.body",
  );
  return updated;
}

/**
 * Resposta do fornecedor à contraproposta (ou registrada pela Wellmix em
 * nome dele): aceitar (os valores propostos viram a resposta), outra
 * proposta (novos valores; preço obrigatório) ou recusar (fica a anterior).
 */
export async function respondToProposal(
  user: User,
  id: string,
  action: "accept" | "counter" | "reject",
  input: OfferInput,
): Promise<SupplierRequest> {
  const { request } = await load(user, id);
  const proposal = pendingProposal(request.negotiation);
  if (request.status !== "answered" || !proposal)
    throw new SupplierRequestError("supplier_request_no_proposal");
  const text = clip(input.text);
  const now = new Date().toISOString();
  let patch: Partial<SupplierRequest> = {};
  let e: SupplierRequestEvent;
  if (action === "accept") {
    e = event(user, "supplier", { kind: "accept", text });
    patch = {
      ...(proposal.price != null
        ? {
            supplierPrice: proposal.price,
            supplierCurrency: proposal.currency ?? request.supplierCurrency,
          }
        : {}),
      ...(proposal.moq != null ? { supplierMoq: proposal.moq } : {}),
      ...(proposal.leadTimeDays != null
        ? { supplierLeadTimeDays: proposal.leadTimeDays }
        : {}),
    };
  } else if (action === "counter") {
    if (input.price === null)
      throw new SupplierRequestError("supplier_request_price_required");
    e = event(user, "supplier", {
      kind: "counter",
      price: input.price,
      currency: input.currency ?? proposal.currency ?? "USD",
      moq: input.moq,
      leadTimeDays: input.leadTimeDays,
      text,
    });
    patch = {
      supplierPrice: input.price,
      supplierCurrency: e.currency ?? "USD",
      supplierMoq: input.moq ?? request.supplierMoq,
      supplierLeadTimeDays: input.leadTimeDays ?? request.supplierLeadTimeDays,
    };
  } else {
    e = event(user, "supplier", { kind: "reject", text });
  }
  // Registrada pela Wellmix: o passo é do fornecedor; quem gravou fica em byUserId.
  const updated = await getStore().update("supplier_requests", request.id, {
    ...patch,
    negotiation: append(request, e),
    respondedAt: now,
    respondedByUserId: user.id,
  });
  await audit(
    user,
    `supplier_request.proposal_${action}`,
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: contraproposta ${action}`,
  );
  if (!isWellmix(user))
    await notifyOther(
      request,
      "wellmix",
      `supplierRequests.notify.${action}.subject` as DictionaryKey,
      `supplierRequests.notify.${action}.body` as DictionaryKey,
    );
  return updated;
}

/**
 * Mensagem livre da conversa, com ou sem arquivo (foto, PDF ou Excel). O
 * arquivo só abre para a Wellmix e o fornecedor da solicitação.
 */
export async function postRequestMessage(
  user: User,
  id: string,
  input: { text: string | null; file: File | null },
): Promise<SupplierRequest> {
  const { request, side } = await load(user, id);
  if (!canPostMessage(request.status))
    throw new SupplierRequestError("supplier_request_closed");
  const text = clip(input.text);
  const file = input.file && input.file.size > 0 ? input.file : null;
  if (!text && !file)
    throw new SupplierRequestError("supplier_request_message_empty");
  let documentId: string | null = null;
  let fileName: string | null = null;
  if (file) {
    const mime = (file.type || "").toLowerCase();
    if (!NEGOTIATION_MIME.includes(mime))
      throw new SupplierRequestError("supplier_request_file_type");
    const { uploadDocument } = await import("./documents");
    const doc = await uploadDocument(user, file, {
      type: "attachment",
      visibility: "internal",
      supplierRequestId: request.id,
    });
    documentId = doc.id;
    fileName = doc.name;
  }
  const e = event(user, side, {
    kind: "message",
    text,
    documentId,
    fileName,
  });
  const updated = await getStore().update("supplier_requests", request.id, {
    negotiation: append(request, e),
  });
  await audit(
    user,
    "supplier_request.message",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: ${file ? `arquivo ${fileName}` : "mensagem"}`,
  );
  await notifyOther(
    request,
    side === "wellmix" ? "supplier" : "wellmix",
    file
      ? "supplierRequests.notify.file.subject"
      : "supplierRequests.notify.message.subject",
    "supplierRequests.notify.message.body",
    { text: (text ?? fileName ?? "").slice(0, 200) },
  );
  return updated;
}

/** O arquivo da conversa abre para a Wellmix e o fornecedor da solicitação. */
export async function canOpenRequestFile(
  user: User,
  supplierRequestId: string,
): Promise<boolean> {
  if (isWellmix(user)) return true;
  if (user.role !== "supplier" || !user.partyId) return false;
  const request = await getStore()
    .get("supplier_requests", supplierRequestId)
    .catch(() => null);
  return !!request && request.supplierId === user.partyId;
}

/* ------------------------------------------------------------------------ */
/* SLA                                                                       */
/* ------------------------------------------------------------------------ */

export async function supplierRequestSlaMinutes(): Promise<number> {
  const { getSettings } = await import("@/lib/settings");
  return (await getSettings()).supplierRequestSlaMinutes;
}

/**
 * Avisa uma vez a Wellmix (quem abriu) e o fornecedor de cada solicitação
 * que passou do SLA sem decisão. Roda ao abrir as telas e no job diário.
 * Devolve quantas avisou.
 */
export async function notifyLateSupplierRequests(
  now: Date = new Date(),
): Promise<number> {
  const store = getStore();
  let rows: SupplierRequest[];
  try {
    rows = await store.list("supplier_requests", {
      filter: { status: ["open", "answered"] },
    });
  } catch {
    return 0;
  }
  const minutes = await supplierRequestSlaMinutes();
  const late = rows.filter(
    (r) => !r.slaNotifiedAt && supplierRequestLate(r, minutes, now),
  );
  for (const request of late) {
    await store.update("supplier_requests", request.id, {
      slaNotifiedAt: now.toISOString(),
    });
    for (const to of ["wellmix", "supplier"] as const)
      await notifyOther(
        request,
        to,
        "supplierRequests.notify.late.subject",
        "supplierRequests.notify.late.body",
        { minutes },
      );
  }
  return late.length;
}

export interface SupplierRequestSla {
  minutes: number;
  dueAt: string;
  late: boolean;
}

export function slaOf(
  request: SupplierRequest,
  minutes: number,
  now: Date = new Date(),
): SupplierRequestSla | null {
  if (!supplierRequestActive(request.status)) return null;
  return {
    minutes,
    dueAt: supplierRequestSlaDue(request, minutes),
    late: supplierRequestLate(request, minutes, now),
  };
}
