import "server-only";

import { z } from "zod";
import {
  getStore,
  type AiSuggestion,
  type MarketingKit,
  type Product,
  type ProductLine,
  type SourcingItem,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { getAiAdapter, type AiImage } from "@/lib/integrations/ai";
import { buildPrompt } from "@/lib/ai/prompts";
import { audit } from "./audit";

/**
 * FOTO → ANÁLISE → SUGESTÃO DE CAMPOS → HUMANO CONFIRMA → CADASTRO.
 * A sugestão fica registrada (prompt, origem, modelo) e só vira cadastro pelo
 * applyProductSuggestion, com os valores que o operador confirmou. Material e
 * dados comerciais nunca são aplicados sozinhos: o formulário exige escolha.
 */
const productFieldsSchema = z.object({
  category: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  materials: z.array(z.string().max(120)).max(10).optional(),
  colors: z.array(z.string().max(60)).max(10).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type ProductFieldSuggestion = z.infer<typeof productFieldsSchema>;

const marketingFieldsSchema = z.object({
  concept: z.string().max(2000).nullable().optional(),
  slogan: z.string().max(255).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  campaign: z.string().max(4000).nullable().optional(),
  colors: z.array(z.string().max(60)).max(10).optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
});
export type MarketingFieldSuggestion = z.infer<typeof marketingFieldsSchema>;

export type SuggestionEntity = "product" | "sourcing_item";

export async function listSuggestions(
  entity: AiSuggestion["entity"],
  entityId: string,
) {
  return getStore().list("ai_suggestions", {
    filter: { entity, entityId },
    orderBy: "createdAt",
    direction: "desc",
  });
}

/** Imagem do documento (bytes + mime) para enviar ao adaptador; null quando não é imagem. */
async function loadImage(documentId: string | null): Promise<AiImage | null> {
  if (!documentId) return null;
  const store = getStore();
  const doc = await store.get("documents", documentId);
  if (!doc || !doc.mime.startsWith("image/")) return null;
  const file = await store.getFile(doc.storageKey);
  if (!file) return null;
  return { bytes: file.bytes, mime: doc.mime };
}

/** Foto principal ou a primeira foto registrada do produto/item. */
async function defaultPhotoId(
  entity: SuggestionEntity,
  row: Product | SourcingItem,
) {
  if (row.primaryPhotoDocumentId) return row.primaryPhotoDocumentId;
  const [photo] = await getStore().list("product_photos", {
    filter:
      entity === "product" ? { productId: row.id } : { sourcingItemId: row.id },
    orderBy: "createdAt",
    limit: 1,
  });
  return photo?.documentId ?? null;
}

/**
 * Pede à IA a sugestão de campos pela foto. Erros: ai_unavailable (modo manual),
 * ai_no_photo (sem imagem), ai_request_failed, ai_invalid_response.
 */
export async function requestProductSuggestion(
  user: User,
  entity: SuggestionEntity,
  entityId: string,
  input: { photoDocumentId?: string | null; context?: string | null } = {},
): Promise<AiSuggestion> {
  assertWellmix(user);
  const store = getStore();
  const row =
    entity === "product"
      ? await store.get("products", entityId)
      : await store.get("sourcing_items", entityId);
  if (!row) throw new Error("not_found");
  const settings = await getSettings();
  const adapter = getAiAdapter(settings);
  if (adapter.mode === "manual") throw new Error("ai_unavailable");
  const line: ProductLine | null = row.lineId
    ? await store.get("product_lines", row.lineId)
    : null;
  const photoId = input.photoDocumentId ?? (await defaultPhotoId(entity, row));
  const image = await loadImage(photoId);
  if (!image && adapter.mode === "api") throw new Error("ai_no_photo");
  const prompt = buildPrompt("registration", {
    line,
    product: row,
    context: input.context,
  });
  const result = await adapter.complete(prompt, image);
  if (!result) throw new Error("ai_unavailable");
  const parsed = productFieldsSchema.safeParse(result.json ?? {});
  if (!parsed.success || !result.json) throw new Error("ai_invalid_response");
  const suggestion = await store.create("ai_suggestions", {
    entity,
    entityId,
    kind: "product_fields",
    source: adapter.mode,
    model: adapter.model,
    prompt,
    imageDocumentId: image ? photoId : null,
    fields: parsed.data,
    rawText: result.text.slice(0, 20_000),
    status: "suggested",
    requestedByUserId: user.id,
    decidedByUserId: null,
    decidedAt: null,
    note: null,
  });
  await audit(
    user,
    "ai.suggest",
    entity,
    entityId,
    `Sugestão de campos (${adapter.mode}${adapter.model ? ` · ${adapter.model}` : ""})`,
  );
  return suggestion;
}

export interface ApplyProductInput {
  category?: string | null;
  description?: string | null;
  material?: string | null;
  color?: string | null;
  /** Anexa os atributos sugeridos ("chave: valor") à especificação/descrição. */
  attributes?: boolean;
}

/**
 * Aplica só o que o operador confirmou (valores editados no formulário).
 * Campos ausentes ou vazios não tocam o cadastro; o registro guarda o que entrou.
 */
export async function applyProductSuggestion(
  user: User,
  suggestionId: string,
  input: ApplyProductInput,
) {
  assertWellmix(user);
  const store = getStore();
  const suggestion = await store.get("ai_suggestions", suggestionId);
  if (!suggestion || suggestion.kind !== "product_fields")
    throw new Error("not_found");
  if (suggestion.status !== "suggested") throw new Error("already_decided");
  const fields = suggestion.fields as ProductFieldSuggestion;
  const applied: string[] = [];
  const clean = (v: string | null | undefined) =>
    v && v.trim() ? v.trim() : null;
  const attrText = Object.entries(fields.attributes ?? {})
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");

  const confirmed = {
    category: clean(input.category),
    description: clean(input.description),
    material: clean(input.material),
    color: clean(input.color),
  };
  if (suggestion.entity === "product") {
    const product = await store.get("products", suggestion.entityId);
    if (!product) throw new Error("not_found");
    const patch: Partial<Product> = {};
    if (confirmed.category) patch.category = confirmed.category;
    if (confirmed.description) patch.specification = confirmed.description;
    if (confirmed.material) patch.material = confirmed.material;
    if (confirmed.color) patch.color = confirmed.color;
    if (input.attributes && attrText) {
      const base = patch.specification ?? product.specification ?? "";
      patch.specification = `${base}${base ? "\n" : ""}${attrText}`.slice(
        0,
        5000,
      );
    }
    applied.push(...appliedKeys(confirmed, input.attributes && !!attrText));
    if (applied.length) {
      await store.update("products", product.id, patch);
      await audit(
        user,
        "ai.apply",
        "product",
        product.id,
        applied.join(", "),
        pick(product, patch),
        patch,
      );
    }
  } else if (suggestion.entity === "sourcing_item") {
    const item = await store.get("sourcing_items", suggestion.entityId);
    if (!item) throw new Error("not_found");
    const patch: Partial<SourcingItem> = {};
    if (confirmed.category) patch.category = confirmed.category;
    if (confirmed.description) patch.description = confirmed.description;
    if (confirmed.material) patch.material = confirmed.material;
    if (confirmed.color) patch.color = confirmed.color;
    if (input.attributes && attrText) {
      const base = patch.description ?? item.description ?? "";
      patch.description = `${base}${base ? "\n" : ""}${attrText}`.slice(
        0,
        5000,
      );
    }
    applied.push(...appliedKeys(confirmed, input.attributes && !!attrText));
    if (applied.length) {
      await store.update("sourcing_items", item.id, patch);
      await audit(
        user,
        "ai.apply",
        "sourcing_item",
        item.id,
        applied.join(", "),
        pick(item, patch),
        patch,
      );
    }
  } else {
    throw new Error("not_found");
  }
  if (applied.length === 0) throw new Error("nothing_to_apply");
  return store.update("ai_suggestions", suggestionId, {
    status: "applied",
    decidedByUserId: user.id,
    decidedAt: new Date().toISOString(),
    note: applied.join(", "),
  });
}

export async function discardSuggestion(
  user: User,
  suggestionId: string,
  note?: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  const suggestion = await store.get("ai_suggestions", suggestionId);
  if (!suggestion) throw new Error("not_found");
  if (suggestion.status !== "suggested") throw new Error("already_decided");
  const updated = await store.update("ai_suggestions", suggestionId, {
    status: "discarded",
    decidedByUserId: user.id,
    decidedAt: new Date().toISOString(),
    note: note ?? null,
  });
  await audit(
    user,
    "ai.discard",
    suggestion.entity,
    suggestion.entityId,
    note ?? "Sugestão descartada",
  );
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Marketing: textos sugeridos para o kit                                    */
/* ------------------------------------------------------------------------ */

/** Sugere conceito, slogan, descrição, campanha e cores para um kit (humano confirma). */
export async function requestMarketingSuggestion(
  user: User,
  kit: MarketingKit,
  context?: string | null,
): Promise<AiSuggestion> {
  assertWellmix(user);
  const store = getStore();
  const settings = await getSettings();
  const adapter = getAiAdapter(settings);
  if (adapter.mode === "manual") throw new Error("ai_unavailable");
  const product = await store.get("products", kit.productId);
  if (!product) throw new Error("not_found");
  const line = await store.get("product_lines", product.lineId);
  const customer = kit.customerId
    ? await store.get("parties", kit.customerId)
    : null;
  const prompt = buildPrompt("marketing", {
    line,
    product,
    context: [customer ? `Cliente: ${customer.name}` : null, context]
      .filter(Boolean)
      .join(". "),
  });
  const result = await adapter.complete(
    prompt,
    await loadImage(product.primaryPhotoDocumentId),
  );
  if (!result) throw new Error("ai_unavailable");
  const parsed = marketingFieldsSchema.safeParse(result.json ?? {});
  if (!parsed.success || !result.json) throw new Error("ai_invalid_response");
  const suggestion = await store.create("ai_suggestions", {
    entity: "marketing_kit",
    entityId: kit.id,
    kind: "marketing_text",
    source: adapter.mode,
    model: adapter.model,
    prompt,
    imageDocumentId: product.primaryPhotoDocumentId,
    fields: parsed.data,
    rawText: result.text.slice(0, 20_000),
    status: "suggested",
    requestedByUserId: user.id,
    decidedByUserId: null,
    decidedAt: null,
    note: null,
  });
  await audit(
    user,
    "ai.suggest",
    "marketing_kit",
    kit.id,
    `Textos de marketing (${adapter.mode})`,
  );
  return suggestion;
}

/** Marca a sugestão de marketing como aplicada (o kit em si é atualizado por updateKit com os valores confirmados). */
export async function markMarketingSuggestionApplied(
  user: User,
  suggestionId: string,
  applied: string[],
) {
  assertWellmix(user);
  const store = getStore();
  const suggestion = await store.get("ai_suggestions", suggestionId);
  if (!suggestion || suggestion.kind !== "marketing_text")
    throw new Error("not_found");
  if (suggestion.status !== "suggested") throw new Error("already_decided");
  return store.update("ai_suggestions", suggestionId, {
    status: "applied",
    decidedByUserId: user.id,
    decidedAt: new Date().toISOString(),
    note: applied.join(", "),
  });
}

/** Nomes dos campos confirmados, na ordem do formulário. */
function appliedKeys(
  confirmed: Record<string, string | null>,
  attributes: boolean | undefined,
) {
  const keys = Object.entries(confirmed)
    .filter(([, v]) => !!v)
    .map(([k]) => k);
  if (attributes) keys.push("attributes");
  return keys;
}

function pick<T extends object>(row: T, patch: Partial<T>) {
  const out: Partial<T> = {};
  for (const key of Object.keys(patch) as Array<keyof T>) out[key] = row[key];
  return out;
}
