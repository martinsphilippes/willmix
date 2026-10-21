import "server-only";

import { z } from "zod";
import {
  getStore,
  type PurchaseSheet,
  type SheetReading,
  type SheetReadingScope,
  type User,
} from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { getAiAdapter } from "@/lib/integrations/ai";
import { buildPrompt } from "@/lib/ai/prompts";
import { audit } from "./audit";
import { storePhotoDocument, type PhotoSource } from "./documents";
import {
  READING_FIELDS,
  fillFromReading,
  normalizeReading,
  readingDivergences,
  type ReadingField,
  type ReadingValues,
} from "./sheet-reading-calc";

/*
 * FOTO DO QUADRO → IA TRANSCREVE → FICHA.
 * O fornecedor (na cotação) ou a Wellmix (cotação, pedido ou ficha mestre do
 * produto) sobe a foto do quadro preenchido à mão. O que a IA leu preenche só
 * os campos vazios da ficha; onde a ficha já tem outro valor (ex.: MOQ 2400 na
 * ficha e 12000 no quadro), fica a divergência, à vista, até a Wellmix dizer
 * qual vale. A foto fica guardada como prova do que o fornecedor escreveu.
 */

export class SheetReadingError extends Error {}

const answerSchema = z.object({
  boardFields: z.record(z.string(), z.unknown()),
  unreadable: z.array(z.string().max(80)).max(40).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

interface Target {
  scope: SheetReadingScope;
  key: string;
  /** Ficha como está agora (gravada ou o rascunho pré-preenchido). */
  sheet: Partial<PurchaseSheet> | null;
  /** Grava campos na ficha pelo caminho normal (que confere o papel). */
  save: (patch: ReadingValues) => Promise<void>;
  /** Liga o documento da foto (cotação: sem ligação, como as fotos da ficha). */
  link: { orderId?: string; productId?: string };
}

/** Ficha alvo e quem pode mexer nela (o mesmo de quem edita a ficha). */
async function target(
  user: User,
  scope: SheetReadingScope,
  key: string,
): Promise<Target> {
  const store = getStore();
  if (scope === "quote") {
    const qs = await import("./quote-sheet");
    const quote = await store.get("quotes", key);
    if (!quote) throw new SheetReadingError("not_found");
    if (!qs.quoteSheetAccess(user, quote).editSupplier)
      throw new SheetReadingError("forbidden");
    const view = await qs.getQuoteSheetForUser(user, key);
    return {
      scope,
      key,
      sheet: view?.sheet ?? null,
      save: async (patch) => {
        await qs.saveQuoteSheet(user, key, patch as never);
      },
      link: {},
    };
  }
  if (scope === "order") {
    const ps = await import("./purchase-sheet");
    const order = await store.get("orders", key);
    if (!order) throw new SheetReadingError("not_found");
    if (!ps.sheetAccess(user, order).editSupplier)
      throw new SheetReadingError("forbidden");
    const view = await ps.getSheetForUser(user, key);
    return {
      scope,
      key,
      sheet: view?.sheet ?? null,
      save: async (patch) => {
        await ps.saveSheet(user, key, patch as never);
      },
      link: { orderId: key },
    };
  }
  // Ficha mestre do produto: só a Wellmix (como a própria ficha mestre).
  if (!isWellmix(user)) throw new SheetReadingError("forbidden");
  const product = await store.get("products", key);
  if (!product) throw new SheetReadingError("not_found");
  const prs = await import("./product-sheet");
  const sheet =
    (await prs.getProductSheet(key)) ??
    ((await prs.masterSheetInput(key)) as Partial<PurchaseSheet> | null);
  return {
    scope,
    key,
    sheet,
    save: async (patch) => {
      await prs.saveProductSheet(user, key, patch as never);
    },
    link: { productId: key },
  };
}

/** Leituras da ficha, a mais nova primeiro. */
export async function listSheetReadings(sheetKey: string) {
  return getStore().list("sheet_readings", {
    filter: { sheetKey },
    orderBy: "createdAt",
    direction: "desc",
  });
}

export interface SheetReadingView {
  reading: SheetReading;
  divergences: ReturnType<typeof readingDivergences>;
  /** Campos lidos (para a lista "lido da foto"). */
  readFields: ReadingField[];
}

/** A leitura que vale (a mais nova) e o que diverge da ficha agora. */
export async function sheetReadingView(
  sheetKey: string,
  sheet: Partial<PurchaseSheet> | null | undefined,
): Promise<SheetReadingView | null> {
  const [reading] = await listSheetReadings(sheetKey);
  if (!reading) return null;
  return {
    reading,
    divergences: readingDivergences(sheet, reading),
    readFields: READING_FIELDS.filter(
      (f) => reading.fields?.[f] !== null && reading.fields?.[f] !== undefined,
    ),
  };
}

/**
 * Lê a foto do quadro e preenche a ficha onde ela está vazia. Devolve o que
 * foi preenchido e o que ficou divergente. Erros: forbidden, not_found,
 * ai_unavailable (IA desligada), ai_no_photo, ai_invalid_response.
 */
export async function readSheetBoard(
  user: User,
  scope: SheetReadingScope,
  key: string,
  photo: PhotoSource,
): Promise<{
  reading: SheetReading;
  filled: ReadingField[];
  divergent: ReadingField[];
}> {
  const t = await target(user, scope, key);
  const adapter = getAiAdapter(await getSettings());
  if (adapter.mode === "manual") throw new SheetReadingError("ai_unavailable");
  const store = getStore();
  // A foto fica guardada mesmo se a leitura falhar (prova do que foi escrito).
  const doc = await storePhotoDocument(user, photo, {
    type: "photo",
    visibility: "internal",
    ...t.link,
  } as never);
  if (!doc.mime.startsWith("image/"))
    throw new SheetReadingError("ai_no_photo");
  const file = await store.getFile(doc.storageKey);
  if (!file) throw new SheetReadingError("ai_no_photo");
  const prompt = buildPrompt("board");
  const result = await adapter.complete(prompt, {
    bytes: file.bytes,
    mime: doc.mime,
  });
  if (!result) throw new SheetReadingError("ai_unavailable");
  const parsed = answerSchema.safeParse(result.json ?? {});
  if (!parsed.success) throw new SheetReadingError("ai_invalid_response");
  const values = normalizeReading(parsed.data.boardFields);
  const patch = fillFromReading(t.sheet, values);
  if (Object.keys(patch).length) await t.save(patch);
  const notes =
    [
      parsed.data.unreadable?.length
        ? `Ilegível: ${parsed.data.unreadable.join(", ")}`
        : null,
      parsed.data.notes ?? null,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 2000) || null;
  const reading = await store.create("sheet_readings", {
    scope,
    sheetKey: key,
    documentId: doc.id,
    source: adapter.mode,
    model: adapter.model,
    fields: values,
    notes,
    rawText: result.text.slice(0, 20_000),
    resolutions: null,
    createdByUserId: user.id,
  });
  const after = (await target(user, scope, key)).sheet;
  const divergent = readingDivergences(after, reading).map((d) => d.field);
  const filled = Object.keys(patch) as ReadingField[];
  await audit(
    user,
    "sheet.read_board",
    scope,
    key,
    `Ficha pela foto do quadro: ${filled.length} campo(s) preenchido(s), ${divergent.length} divergente(s)${divergent.length ? ` (${divergent.join(", ")})` : ""}`,
    null,
    { readingId: reading.id, filled, divergent },
  );
  return { reading, filled, divergent };
}

/**
 * A Wellmix diz qual valor vale numa divergência: "photo" grava na ficha o
 * que o fornecedor escreveu no quadro; "sheet" mantém o da ficha. A decisão
 * fica registrada na leitura e no histórico.
 */
export async function resolveReadingDivergence(
  user: User,
  readingId: string,
  field: ReadingField,
  choice: "photo" | "sheet",
): Promise<void> {
  if (!isWellmix(user)) throw new SheetReadingError("forbidden");
  if (!READING_FIELDS.includes(field))
    throw new SheetReadingError("invalid_input");
  const store = getStore();
  const reading = await store.get("sheet_readings", readingId);
  if (!reading) throw new SheetReadingError("not_found");
  const t = await target(user, reading.scope, reading.sheetKey);
  const photo = reading.fields?.[field] as string | number | undefined;
  const current = t.sheet?.[field] as string | number | null | undefined;
  if (photo === undefined || photo === null)
    throw new SheetReadingError("invalid_input");
  if (choice === "photo") await t.save({ [field]: photo } as ReadingValues);
  const value = choice === "photo" ? photo : (current ?? null);
  await store.update("sheet_readings", reading.id, {
    resolutions: {
      ...(reading.resolutions ?? {}),
      [field]: {
        choice,
        value,
        byUserId: user.id,
        at: new Date().toISOString(),
      },
    },
  });
  await audit(
    user,
    "sheet.resolve_divergence",
    reading.scope,
    reading.sheetKey,
    `Divergência ${field}: vale ${choice === "photo" ? "o do quadro" : "o da ficha"} (${String(value)}; quadro ${String(photo)}, ficha ${String(current ?? "—")})`,
    { field, sheet: current ?? null, photo },
    { field, choice, value },
  );
}
