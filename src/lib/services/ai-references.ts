import "server-only";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type AiReferenceAsset,
  type AiReferenceKind,
  type SelectionGroup,
  type User,
} from "@/lib/db";
import {
  AI_REFERENCE_KINDS,
  AI_REFERENCE_OUTPUT,
  buildReferencePrompt,
  defaultPrompts,
  effectivePrompts,
  referenceFileName,
} from "@/lib/ai-references";
import {
  MediaError,
  getMediaAdapter,
  type MediaImage,
} from "@/lib/integrations/openai-media";
import { audit } from "./audit";
import { SupplierRequestError } from "./supplier-requests";

/*
 * Referências por IA (docs/SUPPLIER_REQUESTS.md, "Referências por IA"): com
 * os três prompts da escolha do grupo, a OpenAI gera duas imagens
 * aproximadas do produto ao final da produção (partindo da foto do booking,
 * quando há) e a ficha em texto. Os arquivos ficam com a escolha (só a
 * Wellmix vê) e passam à solicitação quando ela abre (o fornecedor vê).
 */

export interface GenerateReferencesResult {
  mode: "api" | "mock" | "manual";
  generated: number;
  /** O primeiro motivo de falha (código), se alguma falhou. */
  error: string | null;
}

/** Foto do booking reduzida em PNG (a OpenAI aceita PNG/JPG/WEBP até 50 MB). */
async function referencePhoto(
  documentId: string | null,
): Promise<MediaImage | null> {
  if (!documentId) return null;
  const store = getStore();
  const doc = await store.get("documents", documentId).catch(() => null);
  if (!doc || !doc.mime.startsWith("image/")) return null;
  const file = await store.getFile(doc.storageKey).catch(() => null);
  if (!file) return null;
  try {
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(file.bytes))
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { bytes: new Uint8Array(png), mime: "image/png" };
  } catch {
    return null;
  }
}

/** Gera os arquivos da escolha gravada (os de antes são trocados pelos novos). */
export async function generateGroupReferences(
  user: User,
  groupId: string,
): Promise<GenerateReferencesResult> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const store = getStore();
  const group = await store.get("selection_groups", groupId);
  if (!group || group.status !== "saved")
    throw new SupplierRequestError("not_found");
  const item = await store.get("booking_items", group.chosenItemId);
  if (!item) throw new SupplierRequestError("not_found");
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const adapter = getMediaAdapter(settings);
  if (adapter.mode === "manual")
    return { mode: "manual", generated: 0, error: "openai_off" };
  const prompts = effectivePrompts(group.aiPrompts, defaultPrompts(settings));
  const photo = AI_REFERENCE_KINDS.some(
    (k) => AI_REFERENCE_OUTPUT[k] === "image",
  )
    ? await referencePhoto(item.photoDocumentId)
    : null;

  const runs = await Promise.allSettled(
    AI_REFERENCE_KINDS.map(async (kind): Promise<AiReferenceAsset> => {
      const prompt = buildReferencePrompt(
        kind,
        prompts[kind],
        item,
        group.needs,
      );
      const out =
        AI_REFERENCE_OUTPUT[kind] === "image"
          ? await adapter.image(prompt, photo)
          : {
              bytes: new TextEncoder().encode(await adapter.text(prompt)),
              mime: "text/plain",
            };
      const name = referenceFileName(
        kind,
        item.factoryItemCode ?? item.itemNumber,
        out.mime,
      );
      const stored = await store.putFile(out.bytes, name, out.mime);
      const doc = await store.create("documents", {
        orderId: null,
        requestId: null,
        requirementId: null,
        type: AI_REFERENCE_OUTPUT[kind] === "image" ? "photo" : "attachment",
        name,
        mime: out.mime,
        size: stored.size,
        storageKey: stored.key,
        version: 1,
        previousDocumentId: null,
        uploadedByUserId: user.id,
        // Até a solicitação abrir, só a Wellmix (sem pedido nem solicitação).
        visibility: "supplier",
        productId: null,
        sourcingItemId: null,
        kitId: null,
        imageHash: null,
      });
      return {
        kind,
        documentId: doc.id,
        mode: adapter.mode === "api" ? "api" : "mock",
        model:
          AI_REFERENCE_OUTPUT[kind] === "image"
            ? adapter.imageModel
            : adapter.textModel,
        at: new Date().toISOString(),
      };
    }),
  );
  const fresh = runs
    .filter(
      (r): r is PromiseFulfilledResult<AiReferenceAsset> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
  const failedRun = runs.find((r) => r.status === "rejected");
  const error = failedRun
    ? failedRun.reason instanceof MediaError
      ? failedRun.reason.message
      : (console.error("ai_reference_failed", failedRun.reason),
        "openai_failed")
    : null;
  if (fresh.length) {
    // O que não gerou desta vez fica como estava.
    const kinds = new Set<AiReferenceKind>(fresh.map((a) => a.kind));
    const kept = (group.aiAssets ?? []).filter((a) => !kinds.has(a.kind));
    await store.update("selection_groups", group.id, {
      aiAssets: [...kept, ...fresh],
      updatedByUserId: user.id,
    });
    await audit(
      user,
      "selection_group.ai_references",
      "selection_group",
      group.id,
      `Referências por IA (${adapter.mode}${adapter.imageModel ? `, ${adapter.imageModel}/${adapter.textModel}` : ""}): ${fresh.map((a) => a.kind).join(", ")}${error ? ` · falhou: ${error}` : ""}`,
    );
  }
  return { mode: adapter.mode, generated: fresh.length, error };
}

/**
 * A solicitação aberta de uma escolha recebe as referências dela: o
 * fornecedor passa a abrir os arquivos (`supplierRequestId`). Esquema sem a
 * coluna: a solicitação abre do mesmo jeito, sem as referências.
 */
export async function attachReferencesToRequest(
  group: SelectionGroup,
  supplierRequestId: string,
): Promise<void> {
  const assets = group.aiAssets ?? [];
  if (!assets.length) return;
  const store = getStore();
  try {
    await store.update("supplier_requests", supplierRequestId, {
      aiAssets: assets,
    });
    for (const a of assets)
      await store
        .update("documents", a.documentId, { supplierRequestId })
        .catch((error: unknown) =>
          console.error("attachReferencesToRequest: documento", error),
        );
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (!isSchemaMissing(error)) throw error;
  }
}
