import "server-only";

import {
  getStore,
  type ProductPhoto,
  type PurchaseSheet,
  type Quote,
  type Request,
  type User,
} from "@/lib/db";
import { canViewQuote, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { catalogPhotoKinds, masterSheetInput } from "./product-sheet";
import {
  fillRecordsFromSheet,
  productForSupplier,
  productOfSupplier,
  recordFields,
  sheetRecords,
  withRecordDefaults,
  type SheetRecords,
} from "./sheet-records";
import { productSupplierLink } from "./product-suppliers";
import { scheduleToLots } from "@/lib/workflow/request-schedule";
import {
  containerCapacity,
  CUSTOMS_FIELDS,
  getSheetPhotos,
  SHEET_PHOTO_KINDS,
  SUPPLIER_FIELDS,
  type SheetAccess,
  type SheetInput,
  type SheetPhotoKind,
} from "./purchase-sheet";
import { uploadDocument } from "./documents";
import {
  missingForCompletion,
  normalizeLots,
  planSheet,
  type SheetMissing,
  type SheetPlan,
} from "./purchase-sheet-calc";

/*
 * Ficha de compra na cotação (RFQ): o fornecedor responde preenchendo a ficha
 * completa, com a programação dos lotes e as fotos obrigatórias (balança e
 * régua). Fica na mesma tabela das fichas do pedido, com `orderId` = id da
 * cotação (ids são únicos entre tabelas); as fotos também. Ao confirmar o sinal,
 * ficha e fotos da cotação escolhida vão para o pedido e a Preparação se
 * conclui sozinha.
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
      addPhotos: open,
    };
  if (user.role === "supplier" && canViewQuote(user, quote))
    return {
      view: true,
      editSupplier: open,
      editCustoms: false,
      addPhotos: open,
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
  const [product, supplier, master, link] = await Promise.all([
    request.productId ? store.get("products", request.productId) : null,
    store.get("parties", quote.supplierId),
    masterSheetInput(request.productId),
    productSupplierLink(request.productId, quote.supplierId),
  ]);
  // Dados comerciais só do próprio fornecedor: o vínculo dele (última
  // cotação) ou, se ele é o principal, o preço e o MOQ do produto. Nunca os
  // de outro fornecedor (isolamento entre fornecedores).
  const own = productOfSupplier(supplier, product);
  const ownPrice = link?.price ?? (own ? (product?.price ?? null) : null);
  const ownCurrency =
    link?.currency ?? (own ? (product?.currency ?? null) : null);
  const ownMoq = link?.moq ?? (own ? (product?.moq ?? null) : null);
  // Programação de entregas pedida pelo cliente vira as programações da ficha.
  const requestLots =
    scheduleToLots(
      request.schedule,
      master?.masterCartonQty ?? product?.masterBoxQty ?? null,
    ) ?? normalizeLots(null);
  // Ficha mestre do produto (cadastro) preenche tudo; o fornecedor e o preço
  // desta cotação prevalecem.
  // Bloco Fornecedor vem dos cadastros (fornecedor e produto) e prevalece.
  const records = recordFields(
    supplier,
    productForSupplier(product, quote.supplierId, link),
  );
  if (master)
    return {
      ...master,
      productId: product?.id ?? null,
      supplierName: supplier?.name ?? master.supplierName ?? null,
      supplierPhone: supplier?.phone ?? master.supplierPhone ?? null,
      currency:
        sheetCurrency(quote.currency ?? ownCurrency) ?? master.currency ?? null,
      price: quote.price ?? ownPrice ?? master.price ?? null,
      moq: ownMoq ?? master.moq ?? null,
      lots: requestLots,
      ...records,
    };
  return {
    productId: product?.id ?? null,
    ...records,
    currency: sheetCurrency(quote.currency ?? ownCurrency),
    price: quote.price ?? ownPrice,
    moq: ownMoq,
    masterCartonQty: product?.masterBoxQty ?? null,
    innerQty: product?.innerBoxQty ?? null,
    netWeightPcKg: product?.netWeightKg ?? null,
    grossWeightPcKg: product?.grossWeightKg ?? null,
    cbmPerCarton: product?.cbm ?? null,
    heightCm: product?.boxHeightCm ?? null,
    widthCm: product?.boxWidthCm ?? null,
    lengthCm: product?.boxLengthCm ?? null,
    colorAssortment: product?.color ?? null,
    colorPantones: product?.colorPantones ?? null,
    material: product?.material ?? null,
    ncm: product?.ncm ?? null,
    lots: requestLots,
  };
}

/** Campos obrigatórios da ficha que faltam para responder a RFQ (sem fotos nem lotes). */
/** O que falta para enviar a cotação: a ficha completa, como a Preparação exige. */
export function missingForQuote(
  sheet: Partial<PurchaseSheet> | null,
  photoKinds: readonly string[],
): SheetMissing[] {
  return missingForCompletion(sheet, photoKinds);
}

const photoKindsOf = (photos: Array<{ kind: string }>) => [
  ...new Set(photos.map((p) => p.kind)),
];

export interface QuoteSheetView {
  quote: Quote;
  request: Request;
  access: SheetAccess;
  sheet: SheetInput & { id?: string; productId?: string | null };
  saved: boolean;
  plan: SheetPlan;
  /** Fotos da ficha da cotação (balança e régua obrigatórias). */
  photos: ProductPhoto[];
  /** Tipos de foto cobertos pelo cadastro do produto (não precisam ser reenviadas). */
  catalogPhotoKinds: string[];
  /** Bloco Fornecedor: o que falta nos cadastros do fornecedor e do produto. */
  records: SheetRecords;
  missing: SheetMissing[];
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
  const stored = existing ?? (await prefillQuote(quote, request));
  const records = await sheetRecords(
    user,
    quote.supplierId,
    stored.productId ?? request.productId ?? null,
  );
  // Ficha gravada com campo do cadastro em branco: mostra o valor do cadastro.
  const sheet = existing ? withRecordDefaults(existing, records) : stored;
  const photos = await getSheetPhotos(quoteId);
  // Fotos do cadastro do produto contam como enviadas (ficam no catálogo).
  const catalogKinds = await catalogPhotoKinds(request.productId);
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
    photos,
    missing: missingForQuote(sheet, [...photoKindsOf(photos), ...catalogKinds]),
    catalogPhotoKinds: catalogKinds,
    records,
    containerType: container.type,
    containerTypes: container.types,
  };
}

/** Grava só os campos que o papel pode editar na ficha da cotação. */
export async function saveQuoteSheet(
  user: User,
  quoteId: string,
  input: SheetInput,
): Promise<{ sheet: PurchaseSheet; missing: SheetMissing[] }> {
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
  // Completa o cadastro do fornecedor/produto com o que ele não tinha.
  if (access.editSupplier)
    await fillRecordsFromSheet(
      user,
      quote.supplierId,
      sheet.productId ?? request.productId ?? null,
      sheet,
    );
  const photos = await getSheetPhotos(quoteId);
  return {
    sheet,
    missing: missingForQuote(sheet, [
      ...photoKindsOf(photos),
      ...(await catalogPhotoKinds(request.productId)),
    ]),
  };
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
  // Fotos da cotação passam a ser do pedido (parceiros do pedido veem, como as da Preparação).
  const [quotePhotos, orderPhotos] = await Promise.all([
    getSheetPhotos(quoteId),
    getSheetPhotos(orderId),
  ]);
  for (const photo of quotePhotos) {
    if (orderPhotos.some((p) => p.documentId === photo.documentId)) continue;
    const { id: _pid, createdAt: _pc, updatedAt: _pu, ...rest } = photo;
    void _pid;
    void _pc;
    void _pu;
    await store.create("product_photos", { ...rest, orderId });
    await store.update("documents", photo.documentId, {
      orderId,
      visibility: "supplier",
    });
  }
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

/** Fotos da ficha da cotação (o mesmo jeito das do pedido; o arquivo fica só para Wellmix e quem enviou). */
export async function addQuoteSheetPhotos(
  user: User,
  quoteId: string,
  kind: SheetPhotoKind,
  files: File[],
): Promise<number> {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) throw new QuoteSheetError("not_found");
  if (!quoteSheetAccess(user, quote).addPhotos)
    throw new QuoteSheetError("forbidden");
  if (!(SHEET_PHOTO_KINDS as readonly string[]).includes(kind))
    throw new QuoteSheetError("invalid_kind");
  if (!files.length) throw new QuoteSheetError("photo_required");
  const now = new Date().toISOString();
  await Promise.all(
    files.slice(0, 12).map(async (file) => {
      // Sem pedido nem solicitação: outros fornecedores da RFQ não abrem.
      const doc = await uploadDocument(user, file, {
        type: "photo",
        visibility: "internal",
      });
      await store.create("product_photos", {
        productId: null,
        sourcingItemId: null,
        orderId: quoteId,
        documentId: doc.id,
        kind,
        caption: null,
        takenAt: now,
        takenByUserId: user.id,
        derivedFromPhotoId: null,
        isPrimary: false,
      });
    }),
  );
  await audit(
    user,
    "quote_sheet.photo_add",
    "quote",
    quoteId,
    `Foto da ficha da cotação: ${kind} (${Math.min(files.length, 12)})`,
  );
  return Math.min(files.length, 12);
}

export async function removeQuoteSheetPhoto(
  user: User,
  quoteId: string,
  photoId: string,
): Promise<void> {
  const store = getStore();
  const [quote, photo] = await Promise.all([
    store.get("quotes", quoteId),
    store.get("product_photos", photoId),
  ]);
  if (!quote || !photo || photo.orderId !== quoteId)
    throw new QuoteSheetError("not_found");
  if (!quoteSheetAccess(user, quote).addPhotos)
    throw new QuoteSheetError("forbidden");
  const doc = await store.get("documents", photo.documentId);
  await store.remove("product_photos", photo.id);
  if (doc && !doc.orderId) {
    await store.remove("documents", doc.id);
    await store.removeFile(doc.storageKey).catch((error) => {
      console.error("removeQuoteSheetPhoto: arquivo não apagado", error);
    });
  }
  await audit(
    user,
    "quote_sheet.photo_remove",
    "quote",
    quoteId,
    `Foto excluída da ficha da cotação: ${photo.kind}`,
  );
}
