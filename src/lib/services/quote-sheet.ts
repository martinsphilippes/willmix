import "server-only";

import {
  getStore,
  type PurchaseSheet,
  type Quote,
  type Request,
  type User,
} from "@/lib/db";
import { canViewQuote, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import {
  containerCapacity,
  CUSTOMS_FIELDS,
  SUPPLIER_FIELDS,
  type SheetAccess,
  type SheetInput,
} from "./purchase-sheet";
import {
  normalizeLots,
  planSheet,
  SHEET_REQUIRED_FIELDS,
  type SheetPlan,
  type SheetRequiredField,
} from "./purchase-sheet-calc";

/*
 * Ficha de compra na cotação (RFQ): o fornecedor responde preenchendo a ficha
 * completa (fotos opcionais; ficam para a Preparação). Fica na mesma tabela das
 * fichas do pedido, com `orderId` = id da cotação (ids são únicos entre
 * tabelas). Ao confirmar o sinal, a ficha da cotação escolhida é copiada para o
 * pedido e a Preparação já nasce preenchida.
 */

export class QuoteSheetError extends Error {}

/** Quem vê e edita a ficha da cotação. Cliente nunca (fornecedor e preço). */
export function quoteSheetAccess(user: User, quote: Quote): SheetAccess {
  const open = quote.status === "invited" || quote.status === "answered";
  if (isWellmix(user))
    return {
      view: true,
      editSupplier: open,
      editCustoms: open,
      addPhotos: false,
    };
  if (user.role === "supplier" && canViewQuote(user, quote))
    return {
      view: true,
      editSupplier: open,
      editCustoms: false,
      addPhotos: false,
    };
  return {
    view: false,
    editSupplier: false,
    editCustoms: false,
    addPhotos: false,
  };
}

export async function getQuoteSheet(
  quoteId: string,
): Promise<PurchaseSheet | null> {
  const [sheet] = await getStore().list("purchase_sheets", {
    filter: { orderId: quoteId },
    limit: 1,
  });
  return sheet ?? null;
}

const sheetCurrency = (c: string | null | undefined) => {
  const v = (c ?? "").toUpperCase();
  if (v === "CNY" || v === "RMB") return "RMB" as const;
  return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
};

/** Rascunho a partir do produto, do fornecedor e do que a cotação já tem. */
async function prefillQuote(
  quote: Quote,
  request: Request,
): Promise<SheetInput & { productId: string | null }> {
  const store = getStore();
  const [product, supplier] = await Promise.all([
    request.productId ? store.get("products", request.productId) : null,
    store.get("parties", quote.supplierId),
  ]);
  return {
    productId: product?.id ?? null,
    supplierName: supplier?.name ?? null,
    supplierPhone: supplier?.phone ?? null,
    factoryItemCode: product?.supplierSku ?? null,
    currency: sheetCurrency(quote.currency ?? product?.currency),
    price: quote.price ?? product?.price ?? null,
    moq: product?.moq ?? null,
    masterCartonQty: product?.masterBoxQty ?? null,
    innerQty: product?.innerBoxQty ?? null,
    netWeightPcKg: product?.netWeightKg ?? null,
    grossWeightPcKg: product?.grossWeightKg ?? null,
    cbmPerCarton: product?.cbm ?? null,
    heightCm: product?.boxHeightCm ?? null,
    widthCm: product?.boxWidthCm ?? null,
    lengthCm: product?.boxLengthCm ?? null,
    colorAssortment: product?.color ?? null,
    material: product?.material ?? null,
    ncm: product?.ncm ?? null,
    lots: normalizeLots(null),
  };
}

/** Campos obrigatórios da ficha que faltam para responder a RFQ (sem fotos nem lotes). */
export function missingForQuote(
  sheet: Partial<PurchaseSheet> | null,
): SheetRequiredField[] {
  return SHEET_REQUIRED_FIELDS.filter((key) => {
    const value = sheet?.[key];
    return value === null || value === undefined || value === "";
  });
}

export interface QuoteSheetView {
  quote: Quote;
  request: Request;
  access: SheetAccess;
  sheet: SheetInput & { id?: string };
  saved: boolean;
  plan: SheetPlan;
  missing: SheetRequiredField[];
  containerType: string | null;
  containerTypes: Array<{ code: string; capacityCbm: number }>;
}

export async function getQuoteSheetForUser(
  user: User,
  quoteId: string,
): Promise<QuoteSheetView | null> {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) return null;
  const access = quoteSheetAccess(user, quote);
  if (!access.view) return null;
  const request = await store.get("requests", quote.requestId);
  if (!request) return null;
  const existing = await getQuoteSheet(quoteId);
  const sheet = existing ?? (await prefillQuote(quote, request));
  const container = await containerCapacity(sheet.containerType ?? null);
  return {
    quote,
    request,
    access,
    sheet,
    saved: !!existing,
    plan: planSheet(
      {
        lots: sheet.lots ?? null,
        masterCartonQty: sheet.masterCartonQty ?? null,
        cbmPerCarton: sheet.cbmPerCarton ?? null,
        productionStartAt: sheet.productionStartAt ?? null,
        heightCm: sheet.heightCm ?? null,
        widthCm: sheet.widthCm ?? null,
        lengthCm: sheet.lengthCm ?? null,
      },
      container.capacity,
    ),
    missing: missingForQuote(sheet),
    containerType: container.type,
    containerTypes: container.types,
  };
}

/** Grava só os campos que o papel pode editar na ficha da cotação. */
export async function saveQuoteSheet(
  user: User,
  quoteId: string,
  input: SheetInput,
): Promise<{ sheet: PurchaseSheet; missing: SheetRequiredField[] }> {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) throw new QuoteSheetError("not_found");
  const access = quoteSheetAccess(user, quote);
  if (!access.editSupplier && !access.editCustoms)
    throw new QuoteSheetError("forbidden");
  const request = await store.get("requests", quote.requestId);
  if (!request) throw new QuoteSheetError("not_found");
  const allowed = new Set<string>([
    ...(access.editSupplier ? SUPPLIER_FIELDS : []),
    ...(access.editCustoms ? CUSTOMS_FIELDS : []),
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input))
    if (allowed.has(key) && value !== undefined) patch[key] = value;
  if ("lots" in patch) patch.lots = normalizeLots(patch.lots as never);
  const existing = await getQuoteSheet(quoteId);
  let sheet: PurchaseSheet;
  if (existing) {
    sheet = await store.update("purchase_sheets", existing.id, {
      ...patch,
      updatedByUserId: user.id,
    });
  } else {
    const base = await prefillQuote(quote, request);
    const blank = Object.fromEntries(
      [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS].map((k) => [k, null]),
    );
    sheet = await store.create("purchase_sheets", {
      ...blank,
      ...base,
      ...patch,
      lots: normalizeLots((patch.lots ?? base.lots) as never),
      orderId: quoteId,
      updatedByUserId: user.id,
      completedAt: null,
    } as Omit<PurchaseSheet, "id" | "createdAt" | "updatedAt">);
  }
  await audit(
    user,
    existing ? "quote_sheet.update" : "quote_sheet.create",
    "quote",
    quoteId,
    `Ficha da cotação: ${Object.keys(patch).length} campo(s)`,
  );
  return { sheet, missing: missingForQuote(sheet) };
}

/**
 * Pedido criado a partir da cotação escolhida: a ficha da cotação vira a ficha
 * do pedido (Preparação já preenchida; fotos seguem na Preparação). Não
 * sobrescreve uma ficha do pedido que já exista.
 */
export async function copyQuoteSheetToOrder(quoteId: string, orderId: string) {
  const store = getStore();
  const source = await getQuoteSheet(quoteId);
  if (!source) return null;
  const [already] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  if (already) return already;
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = source;
  void _id;
  void _c;
  void _u;
  return store.create("purchase_sheets", {
    ...fields,
    orderId,
    completedAt: null,
  });
}
