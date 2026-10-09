"use server";

import { z } from "zod";
import { pantoneLabel, parsePantoneRefs } from "@/lib/pantone";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  SHEET_POWER_SOURCES,
} from "@/lib/db/schema";
import {
  addSheetPhotos,
  removeSheetPhoto,
  saveSheet,
  SHEET_PHOTO_KINDS,
  type SheetInput,
} from "@/lib/services/purchase-sheet";
import { MAX_LOTS } from "@/lib/services/purchase-sheet-calc";
import { files, requireUser, run, runInPlace, str } from "./helpers";

/** Opção do seletor para o nome antigo digitado à mão (fornecedor não cadastrado). */
const LEGACY_SUPPLIER = "__legacy__";

/*
 * Ficha de compra (planilha COMPRAS) da Preparação. Só os campos presentes no
 * formulário mudam; o serviço ainda descarta o que o papel não pode editar.
 */

const ORDER_ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Campo ausente = não mexe; vazio = limpa; número aceita vírgula decimal. */
function num(form: FormData, key: string, opts: { int?: boolean } = {}) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return null;
  const schema = opts.int
    ? z.coerce.number().int().min(0).max(100_000_000)
    : z.coerce.number().min(0).max(100_000_000);
  return schema.parse(raw);
}
function text(form: FormData, key: string, max: number) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  return raw ? z.string().max(max).parse(raw) : null;
}
function choice<T extends readonly string[]>(
  form: FormData,
  key: string,
  values: T,
): T[number] | null | undefined {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  return raw
    ? z.enum(values as unknown as [string, ...string[]]).parse(raw)
    : null;
}
function date(form: FormData, key: string) {
  if (!form.has(key)) return undefined;
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  return (
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(raw) + "T00:00:00.000Z"
  );
}

function parseSheet(form: FormData): SheetInput {
  const input: SheetInput = {
    sheetDate: date(form, "sheetDate"),
    location: text(form, "location", 80),
    supplierName: text(form, "supplierName", 160),
    supplierStore: text(form, "supplierStore", 60),
    supplierPhone: text(form, "supplierPhone", 40),
    factoryItemCode: text(form, "factoryItemCode", 60),
    incoterm: choice(form, "incoterm", SHEET_INCOTERMS),
    currency: choice(form, "currency", SHEET_CURRENCIES),
    price: num(form, "price"),
    moq: num(form, "moq", { int: true }),
    masterCartonQty: num(form, "masterCartonQty", { int: true }),
    innerQty: num(form, "innerQty", { int: true }),
    netWeightPcKg: num(form, "netWeightPcKg"),
    grossWeightPcKg: num(form, "grossWeightPcKg"),
    cbmPerCarton: num(form, "cbmPerCarton"),
    heightCm: num(form, "heightCm"),
    widthCm: num(form, "widthCm"),
    lengthCm: num(form, "lengthCm"),
    capacityMl: num(form, "capacityMl"),
    packageType: text(form, "packageType", 120),
    colorAssortment: text(form, "colorAssortment", 200),
    // Só vai ao banco quando o formulário traz o campo (coluna nova; antes
    // da publicação do esquema, fichas sem cor Pantone seguem salvando).
    ...(form.has("colorPantones")
      ? { colorPantones: parsePantoneRefs(str(form, "colorPantones")) }
      : {}),
    material: text(form, "material", 200),
    powerSource: choice(form, "powerSource", SHEET_POWER_SOURCES),
    powerDetail: text(form, "powerDetail", 60),
    productionStartAt: date(form, "productionStartAt"),
    containerType: text(form, "containerType", 20),
    ecommerceDescription: text(form, "ecommerceDescription", 4000),
    notes: text(form, "notes", 2000),
    ncm: (() => {
      const v = text(form, "ncm", 12);
      return v
        ? z
            .string()
            .regex(/^[\d.]{4,12}$/)
            .parse(v)
        : v;
    })(),
    importTaxPercent: num(form, "importTaxPercent"),
    ipiPercent: num(form, "ipiPercent"),
  };
  // Sem texto de cor mas com Pantone escolhidas: o texto vira a lista de códigos
  // (o campo "Cor / sortimento" continua obrigatório e legível fora do portal).
  if (!input.colorAssortment && input.colorPantones?.length)
    input.colorAssortment = input.colorPantones
      .map((c) => pantoneLabel(c))
      .join(" / ")
      .slice(0, 200);
  if (form.has("lot1Cartons")) {
    input.lots = Array.from({ length: MAX_LOTS }, (_, i) => ({
      departureIntervalDays:
        num(form, `lot${i + 1}Interval`, { int: true }) ?? null,
      masterCartons: num(form, `lot${i + 1}Cartons`, { int: true }) ?? null,
    }));
  }
  for (const key of Object.keys(input) as (keyof SheetInput)[])
    if (input[key] === undefined) delete input[key];
  return input;
}

export async function savePurchaseSheetAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  await run(back, async () => {
    ORDER_ID.parse(orderId);
    const { missing } = await saveSheet(user, orderId, parseSheet(form));
    return `${back}?saved=${missing.length ? "partial" : "complete"}`;
  });
}

export async function addPurchaseSheetPhotosAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(orderId);
    const kind = z.enum(SHEET_PHOTO_KINDS).parse(str(form, "kind"));
    const photos = files(form, "photos");
    if (!photos.length) throw new Error("photo_required");
    await addSheetPhotos(user, orderId, kind, photos);
  });
}

export async function removePurchaseSheetPhotoAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId").slice(0, 64);
  const back = `/app/orders/${encodeURIComponent(orderId)}/purchase-sheet`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(orderId);
    const photoId = ORDER_ID.parse(str(form, "photoId"));
    await removeSheetPhoto(user, orderId, photoId);
  });
}

/**
 * Resposta da RFQ pela ficha de compra. "Salvar" guarda o rascunho; "Enviar"
 * guarda e, com a ficha completa (fotos opcionais), responde a cotação com o
 * preço e a moeda da própria ficha.
 */
export async function answerQuoteWithSheetAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = `/app/quotes/${encodeURIComponent(quoteId)}`;
  await run(back, async () => {
    ORDER_ID.parse(quoteId);
    const { saveQuoteSheet } = await import("@/lib/services/quote-sheet");
    const { sheet, missing } = await saveQuoteSheet(
      user,
      quoteId,
      parseSheet(form),
    );
    if (str(form, "intent") !== "send")
      return `${back}?saved=${missing.length ? "partial" : "complete"}`;
    if (missing.length) throw new Error("sheet_incomplete");
    const leadTimeDays = z.coerce
      .number()
      .int()
      .positive()
      .max(3650)
      .parse(str(form, "leadTimeDays"));
    const conditions = z.string().max(2000).parse(str(form, "conditions"));
    const { answerQuote } = await import("@/lib/services/requests");
    await answerQuote(user, quoteId, {
      price: sheet.price!,
      currency: sheet.currency === "RMB" ? "CNY" : sheet.currency!,
      leadTimeDays,
      conditions: conditions || null,
    });
    // Companhia marítima recebe o pedido de frete com a carga desta ficha.
    const { inviteFreightForQuote } = await import("@/lib/services/freight");
    await inviteFreightForQuote(user, quoteId);
    return `${back}?saved=sent`;
  });
}

/*
 * Os botões da resposta ficam fora do <form> (depois do card de fotos) e apontam
 * para ele pelo atributo `form`. O React só leva nome/valor de botão que está
 * dentro do formulário, por isso cada botão tem a própria ação (formAction).
 */
export async function sendQuoteWithSheetAction(form: FormData) {
  form.set("intent", "send");
  return answerQuoteWithSheetAction(form);
}

export async function saveQuoteSheetDraftAction(form: FormData) {
  form.set("intent", "draft");
  return answerQuoteWithSheetAction(form);
}

/** Fotos da ficha na resposta da RFQ (as 5 fotos do produto, obrigatórias para enviar). */
export async function addQuoteSheetPhotosAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = `/app/quotes/${encodeURIComponent(quoteId)}`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(quoteId);
    const kind = z.enum(SHEET_PHOTO_KINDS).parse(str(form, "kind"));
    const photos = files(form, "photos");
    if (!photos.length) throw new Error("photo_required");
    const { addQuoteSheetPhotos } = await import("@/lib/services/quote-sheet");
    await addQuoteSheetPhotos(user, quoteId, kind, photos);
  });
}

export async function removeQuoteSheetPhotoAction(form: FormData) {
  const user = await requireUser();
  const quoteId = str(form, "quoteId").slice(0, 64);
  const back = `/app/quotes/${encodeURIComponent(quoteId)}`;
  // Fica na tela (sem navegar): a linha da foto muda na hora e os campos digitados não se perdem.
  await runInPlace(back, async () => {
    ORDER_ID.parse(quoteId);
    const photoId = ORDER_ID.parse(str(form, "photoId"));
    const { removeQuoteSheetPhoto } =
      await import("@/lib/services/quote-sheet");
    await removeQuoteSheetPhoto(user, quoteId, photoId);
  });
}

/** Ficha de compra mestre do produto (cadastro): só Wellmix. */
export async function saveProductSheetAction(form: FormData) {
  const user = await requireUser();
  const productId = z.string().min(1).max(64).parse(str(form, "productId"));
  await run(`/app/products/${productId}`, async () => {
    const { saveProductSheet, getProductSheet, productSheetDraft } =
      await import("@/lib/services/product-sheet");
    const input = parseSheet(form);
    // Fornecedor escolhido entre os cadastrados: vira o principal do produto
    // e o nome vem do cadastro (o texto digitado não vale).
    const supplierId = z.string().max(64).parse(str(form, "supplierId"));
    const chosen =
      supplierId && supplierId !== LEGACY_SUPPLIER ? supplierId : null;
    // O bloco Fornecedor salvo é do escolhido? (decide a escrita de volta no cadastro)
    let blockIsChosen = false;
    if (chosen) {
      const { getStore } = await import("@/lib/db");
      const { setMainSupplier } =
        await import("@/lib/services/product-suppliers");
      const store = getStore();
      const product = await store.get("products", productId);
      const [previousParty, previousMaster] = await Promise.all([
        product?.supplierId ? store.get("parties", product.supplierId) : null,
        getProductSheet(productId),
      ]);
      // O que a tela mostrava antes de salvar (ficha mestre ou rascunho do produto).
      const shown =
        previousMaster ??
        (product ? productSheetDraft(product, previousParty) : null);
      const { party, changed, link } = await setMainSupplier(
        user,
        productId,
        chosen,
      );
      input.supplierName = party.name.slice(0, 160);
      if (changed) {
        // Trocou o principal: campo que veio igual ao que a tela mostrava é
        // do fornecedor anterior e passa a ser o do escolhido (cadastro e
        // vínculo dele); o que o usuário digitou fica.
        const own: Record<string, string | number | null> = {
          location: party.city?.slice(0, 80) ?? null,
          supplierStore: party.storeNumber?.slice(0, 60) ?? null,
          supplierPhone: party.phone?.slice(0, 40) ?? null,
          factoryItemCode: link?.supplierSku?.slice(0, 60) ?? null,
          price: link?.price ?? null,
          currency: sheetCurrencyOf(link?.currency),
          moq: link?.moq ?? null,
        };
        const bag = input as Record<string, unknown>;
        for (const [key, value] of Object.entries(own)) {
          const before = (shown as Record<string, unknown> | null)?.[key];
          if (sameValue(bag[key], before) || bag[key] === undefined)
            bag[key] = value;
        }
        blockIsChosen = true;
      } else {
        blockIsChosen =
          !previousMaster || previousMaster.supplierName === party.name;
      }
    }
    const { sheet, missing } = await saveProductSheet(user, productId, input);
    if (chosen && blockIsChosen) {
      const { syncMainSupplierLink } =
        await import("@/lib/services/product-suppliers");
      const { fillRecordsFromSheet } =
        await import("@/lib/services/sheet-records");
      // Código do principal no vínculo dele; o que faltar no cadastro do
      // fornecedor (cidade, loja, telefone) é gravado nele.
      await syncMainSupplierLink(
        user,
        { supplierId: chosen, supplierSku: null },
        { supplierId: chosen, supplierSku: sheet.factoryItemCode },
        productId,
      );
      await fillRecordsFromSheet(user, chosen, productId, sheet);
    }
    return `/app/products/${productId}?sheet=${missing.length ? "partial" : "complete"}#product-sheet`;
  });
}

/** Mesmo valor do formulário e do banco (texto vazio = nulo; "CNY" = "RMB"). */
function sameValue(a: unknown, b: unknown) {
  const norm = (v: unknown) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string") {
      const s = v.trim();
      return s === "" ? null : s.toUpperCase() === "CNY" ? "RMB" : s;
    }
    return v;
  };
  return norm(a) === norm(b);
}

function sheetCurrencyOf(c: string | null | undefined) {
  const v = (c ?? "").toUpperCase();
  if (v === "CNY" || v === "RMB") return "RMB";
  return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
}

/** "Atualizar cadastro do produto com esta ficha" (pedido ou cotação): só Wellmix. */
export async function adoptSheetIntoProductAction(form: FormData) {
  const user = await requireUser();
  const ownerId = z.string().min(1).max(64).parse(str(form, "ownerId"));
  // Só volta para telas do portal (nada de redirecionar para fora).
  const rawBack = str(form, "back");
  const back = /^\/app\/[A-Za-z0-9\-_/]*$/.test(rawBack) ? rawBack : "/app";
  await run(back, async () => {
    const { adoptSheetIntoProduct } =
      await import("@/lib/services/product-sheet");
    const { productId } = await adoptSheetIntoProduct(user, ownerId);
    return `${back}${back.includes("?") ? "&" : "?"}adopted=${encodeURIComponent(productId)}`;
  });
}
