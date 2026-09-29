"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  OPERATION_MODES,
  RADAR_STATUSES,
  type LinePrompts,
} from "@/lib/db";
import { parseList } from "@/lib/ai/prompts";
import { audit } from "@/lib/services/audit";
import {
  applyProductSuggestion,
  discardSuggestion,
  markMarketingSuggestionApplied,
  requestMarketingSuggestion,
  requestProductSuggestion,
} from "@/lib/services/ai-suggestions";
import {
  addKitFile,
  cancelKit,
  confirmKitPayment,
  createKit,
  offerKit,
  purchaseKit,
  releaseKit,
  updateKit,
} from "@/lib/services/marketing";
import { setCustomerOperation } from "@/lib/services/operations";
import { files, num, requireUser, run, str } from "./helpers";

/*
 * Visão de Produto: IA de cadastro por foto (humano confirma), prompts por
 * linha, marketing studio / kit, modalidade de operação do cliente (RADAR).
 * Toda escrita com zod e checagem de papel; os serviços auditam. Erros voltam
 * por ?error=<código> (traduzidos em vision.error.*).
 */

/** O campo "back" só aceita caminhos internos do app. */
function safeBack(value: string, fallback: string) {
  return value.startsWith("/app") && !value.startsWith("//") ? value : fallback;
}

/* ------------------------------------------------------------------------ */
/* Prompts por linha                                                         */
/* ------------------------------------------------------------------------ */

const promptsSchema = z.object({
  descriptionPrompt: z.string().max(4000).nullable(),
  marketingPrompt: z.string().max(4000).nullable(),
  imagePrompt: z.string().max(4000).nullable(),
  requiredAttributes: z.array(z.string().max(60)).max(30),
  validationRules: z.array(z.string().max(300)).max(30),
});

/** Configuração de IA e regras da linha (nulo quando tudo vazio). */
export async function saveLinePromptsAction(form: FormData) {
  const user = await requireUser();
  const lineId = str(form, "lineId");
  await run("/app/lines", async () => {
    assertWellmix(user);
    const store = getStore();
    const line = await store.get("product_lines", lineId);
    if (!line) throw new Error("line_not_found");
    const parsed: LinePrompts = promptsSchema.parse({
      descriptionPrompt: str(form, "descriptionPrompt") || null,
      marketingPrompt: str(form, "marketingPrompt") || null,
      imagePrompt: str(form, "imagePrompt") || null,
      requiredAttributes: parseList(str(form, "requiredAttributes")),
      validationRules: parseList(str(form, "validationRules")),
    });
    const empty =
      !parsed.descriptionPrompt &&
      !parsed.marketingPrompt &&
      !parsed.imagePrompt &&
      parsed.requiredAttributes.length === 0 &&
      parsed.validationRules.length === 0;
    await store.update("product_lines", lineId, {
      prompts: empty ? null : parsed,
    });
    await audit(
      user,
      "line.prompts",
      "product_line",
      lineId,
      `${line.name}: ${empty ? "sem configuração" : `atributos ${parsed.requiredAttributes.join(", ") || "—"}`}`,
      { prompts: line.prompts },
      { prompts: empty ? null : parsed },
    );
    return `/app/lines?saved=${lineId}`;
  });
}

/* ------------------------------------------------------------------------ */
/* IA de cadastro por foto                                                   */
/* ------------------------------------------------------------------------ */

function entityBack(entity: "product" | "sourcing_item", entityId: string) {
  return entity === "product"
    ? `/app/products/${entityId}`
    : `/app/sourcing/items/${entityId}`;
}

/** Pede a sugestão de campos pela foto (principal ou a escolhida). Nada é aplicado. */
export async function requestProductSuggestionAction(form: FormData) {
  const user = await requireUser();
  const entity =
    str(form, "entity") === "sourcing_item" ? "sourcing_item" : "product";
  const entityId = str(form, "entityId");
  const back = entityBack(entity, entityId);
  await run(back, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        photoDocumentId: z.string().max(64).nullable(),
        context: z.string().max(2000).nullable(),
      })
      .parse({
        photoDocumentId: str(form, "photoDocumentId") || null,
        context: str(form, "context") || null,
      });
    await requestProductSuggestion(user, entity, entityId, parsed);
    return `${back}#ai`;
  });
}

/** Aplica só os campos marcados, com os valores editados no formulário. */
export async function applyProductSuggestionAction(form: FormData) {
  const user = await requireUser();
  const entity =
    str(form, "entity") === "sourcing_item" ? "sourcing_item" : "product";
  const entityId = str(form, "entityId");
  const back = entityBack(entity, entityId);
  await run(back, async () => {
    assertWellmix(user);
    const id = z.string().min(1).parse(str(form, "id"));
    const apply = new Set(form.getAll("apply").map(String));
    const field = (key: string) =>
      apply.has(key) ? str(form, key) || null : null;
    const parsed = z
      .object({
        category: z.string().max(120).nullable(),
        description: z.string().max(2000).nullable(),
        material: z.string().max(120).nullable(),
        color: z.string().max(60).nullable(),
        attributes: z.boolean(),
      })
      .parse({
        category: field("category"),
        description: field("description"),
        material: field("material"),
        color: field("color"),
        attributes: apply.has("attributes"),
      });
    const suggestion = await getStore().get("ai_suggestions", id);
    if (
      !suggestion ||
      suggestion.entity !== entity ||
      suggestion.entityId !== entityId
    )
      throw new Error("not_found");
    await applyProductSuggestion(user, id, parsed);
    return `${back}#ai`;
  });
}

export async function discardSuggestionAction(form: FormData) {
  const user = await requireUser();
  const back = safeBack(str(form, "back"), "/app/products");
  await run(back, async () => {
    assertWellmix(user);
    const parsed = z
      .object({ id: z.string().min(1), note: z.string().max(2000).nullable() })
      .parse({ id: str(form, "id"), note: str(form, "note") || null });
    await discardSuggestion(user, parsed.id, parsed.note);
    return `${back}#ai`;
  });
}

/* ------------------------------------------------------------------------ */
/* Marketing studio / kit                                                    */
/* ------------------------------------------------------------------------ */

const kitBack = (id: string) => `/app/marketing/${id}`;
const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/)
  .transform((s) => s.toUpperCase());

export async function createKitAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId");
  const back = safeBack(str(form, "back"), `/app/products/${productId}`);
  await run(back, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        customerId: z.string().max(64).nullable(),
        name: z.string().max(160).nullable(),
        price: z.number().finite().nonnegative().nullable(),
        currency: currencySchema.nullable(),
      })
      .parse({
        customerId: str(form, "customerId") || null,
        name: str(form, "name") || null,
        price: num(form, "price"),
        currency: str(form, "currency") || null,
      });
    const kit = await createKit(user, productId, parsed);
    return kitBack(kit.id);
  });
}

export async function updateKitAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        name: z.string().min(1).max(160),
        customerId: z.string().max(64).nullable(),
        price: z.number().finite().nonnegative(),
        currency: currencySchema,
        concept: z.string().max(2000).nullable(),
        slogan: z.string().max(255).nullable(),
        description: z.string().max(4000).nullable(),
        campaign: z.string().max(4000).nullable(),
        colors: z.array(z.string().max(60)).max(20).nullable(),
        pantone: z.string().max(120).nullable(),
        notes: z.string().max(4000).nullable(),
      })
      .parse({
        name: str(form, "name"),
        customerId: str(form, "customerId") || null,
        price: num(form, "price") ?? 0,
        currency: str(form, "currency") || "BRL",
        concept: str(form, "concept") || null,
        slogan: str(form, "slogan") || null,
        description: str(form, "description") || null,
        campaign: str(form, "campaign") || null,
        colors: str(form, "colors") ? parseList(str(form, "colors")) : null,
        pantone: str(form, "pantone") || null,
        notes: str(form, "notes") || null,
      });
    await updateKit(user, id, parsed);
    // Sugestão de IA confirmada junto com o texto (opcional).
    const suggestionId = str(form, "suggestionId");
    if (suggestionId)
      await markMarketingSuggestionApplied(
        user,
        suggestionId,
        ["concept", "slogan", "description", "campaign"].filter((k) =>
          str(form, k),
        ),
      );
    return `${kitBack(id)}?ok=saved`;
  });
}

export async function addKitFileAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    const stage = str(form, "stage") === "final" ? "final" : "preview";
    const list = files(form, "files");
    if (list.length === 0) throw new Error("file_required");
    for (const file of list) await addKitFile(user, id, file, stage);
    return `${kitBack(id)}?ok=file`;
  });
}

export async function requestMarketingSuggestionAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    const kit = await getStore().get("marketing_kits", id);
    if (!kit) throw new Error("not_found");
    const context = z
      .string()
      .max(2000)
      .nullable()
      .parse(str(form, "context") || null);
    await requestMarketingSuggestion(user, kit, context);
    return `${kitBack(id)}#ai`;
  });
}

export async function offerKitAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    await offerKit(user, id);
    return `${kitBack(id)}?ok=offered`;
  });
}

/** Cliente aceita a oferta (ou a Wellmix registra a compra por ele). */
export async function purchaseKitAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    await purchaseKit(user, id);
    return `${kitBack(id)}?ok=purchased`;
  });
}

export async function confirmKitPaymentAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    const [proof] = files(form, "proof");
    await confirmKitPayment(user, id, proof ?? null);
    return `${kitBack(id)}?ok=paid`;
  });
}

export async function releaseKitAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    await releaseKit(user, id);
    return `${kitBack(id)}?ok=released`;
  });
}

export async function cancelKitAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(kitBack(id), async () => {
    assertWellmix(user);
    await cancelKit(user, id, str(form, "note") || null);
    return `${kitBack(id)}?ok=cancelled`;
  });
}

/* ------------------------------------------------------------------------ */
/* Cliente: modalidade de operação (RADAR)                                   */
/* ------------------------------------------------------------------------ */

export async function saveCustomerOperationAction(form: FormData) {
  const user = await requireUser();
  const partyId = str(form, "partyId");
  await run(`/app/parties/${partyId}`, async () => {
    assertWellmix(user);
    const parsed = z
      .object({
        operationMode: z.enum(OPERATION_MODES).nullable(),
        radar: z.enum(RADAR_STATUSES).nullable(),
        radarNotes: z.string().max(2000).nullable(),
      })
      .parse({
        operationMode: str(form, "operationMode") || null,
        radar: str(form, "radar") || null,
        radarNotes: str(form, "radarNotes") || null,
      });
    await setCustomerOperation(user, partyId, parsed);
    return `/app/parties/${partyId}?saved=operation`;
  });
}
