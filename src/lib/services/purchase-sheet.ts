import "server-only";

import {
  getStore,
  type Order,
  type PhotoKind,
  type ProductPhoto,
  type PurchaseSheet,
  type User,
} from "@/lib/db";
import { canViewOrder, isWellmix } from "@/lib/auth/permissions";
import { canSubmitRequirement, submitRequirement } from "@/lib/workflow/engine";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import {
  missingForCompletion,
  REQUIRED_SHEET_PHOTOS,
  normalizeLots,
  planSheet,
  type SheetMissing,
  type SheetPlan,
} from "./purchase-sheet-calc";

export class PurchaseSheetError extends Error {}

/** Fotos da ficha (planilha COMPRAS + mais ângulos). A da balança é obrigatória. */
export const SHEET_PHOTO_KINDS = [
  "weight_scale",
  "dimension_scale",
  "dimension_side",
  "angle",
  "original",
  "prompt",
  "business_card",
] as const satisfies readonly PhotoKind[];
export type SheetPhotoKind = (typeof SHEET_PHOTO_KINDS)[number];

/** Campos que o fornecedor (e a Wellmix) preenchem. */
export const SUPPLIER_FIELDS = [
  "sheetDate",
  "location",
  "supplierName",
  "supplierStore",
  "supplierPhone",
  "factoryItemCode",
  "incoterm",
  "currency",
  "price",
  "moq",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "heightCm",
  "widthCm",
  "lengthCm",
  "capacityMl",
  "packageType",
  "colorAssortment",
  "material",
  "powerSource",
  "powerDetail",
  "productionStartAt",
  "lots",
  "containerType",
  "ecommerceDescription",
  "notes",
] as const;
/** Campos do despachante (e da Wellmix). */
export const CUSTOMS_FIELDS = [
  "ncm",
  "importTaxPercent",
  "ipiPercent",
] as const;

export type SheetField =
  (typeof SUPPLIER_FIELDS)[number] | (typeof CUSTOMS_FIELDS)[number];
export type SheetInput = Partial<Pick<PurchaseSheet, SheetField>>;

export interface SheetAccess {
  view: boolean;
  editSupplier: boolean;
  editCustoms: boolean;
  /** Fotos: quem edita a parte do fornecedor. */
  addPhotos: boolean;
}

/**
 * Quem vê: Wellmix, o fornecedor do pedido e o despachante do pedido. Cliente
 * nunca (fornecedor, contato e preço). Pedido encerrado: só a Wellmix edita.
 */
export function sheetAccess(user: User, order: Order): SheetAccess {
  const none = {
    view: false,
    editSupplier: false,
    editCustoms: false,
    addPhotos: false,
  };
  if (!canViewOrder(user, order)) return none;
  const closed = order.status === "CLOSED";
  if (isWellmix(user))
    return {
      view: true,
      editSupplier: true,
      editCustoms: true,
      addPhotos: true,
    };
  if (user.role === "supplier" && order.supplierId === user.partyId)
    return {
      view: true,
      editSupplier: !closed,
      editCustoms: false,
      addPhotos: !closed,
    };
  if (user.role === "broker" && order.brokerId === user.partyId)
    return {
      view: true,
      editSupplier: false,
      editCustoms: !closed,
      addPhotos: false,
    };
  return none;
}

export async function containerCapacity(type: string | null): Promise<{
  type: string | null;
  capacity: number | null;
  types: Array<{ code: string; capacityCbm: number }>;
}> {
  const { containerTypes } = await getSettings();
  const pick =
    containerTypes.find((c) => c.code === type) ??
    containerTypes.find((c) => c.code === "40HC") ??
    [...containerTypes].sort((a, b) => b.capacityCbm - a.capacityCbm)[0];
  return {
    type: pick?.code ?? null,
    capacity: pick?.capacityCbm ?? null,
    types: containerTypes,
  };
}

/** Rascunho a partir do cadastro (produto, cotação escolhida, fornecedor): menos digitação. */
async function prefill(
  order: Order,
): Promise<SheetInput & { productId: string | null }> {
  const store = getStore();
  const request = await store.get("requests", order.requestId);
  const [product, supplier, quote] = await Promise.all([
    request?.productId ? store.get("products", request.productId) : null,
    store.get("parties", order.supplierId),
    request?.selectedQuoteId
      ? store.get("quotes", request.selectedQuoteId)
      : null,
  ]);
  const currencyOf = (c: string | null | undefined) => {
    const v = (c ?? "").toUpperCase();
    if (v === "CNY" || v === "RMB") return "RMB" as const;
    return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
  };
  return {
    productId: product?.id ?? null,
    supplierName: supplier?.name ?? null,
    supplierPhone: supplier?.phone ?? null,
    factoryItemCode: product?.supplierSku ?? null,
    currency: currencyOf(quote?.currency ?? product?.currency),
    price: quote?.price ?? product?.price ?? null,
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

export async function getSheetPhotos(orderId: string): Promise<ProductPhoto[]> {
  const photos = await getStore().list("product_photos", {
    filter: { orderId },
    orderBy: "createdAt",
  });
  return photos.filter((p) =>
    (SHEET_PHOTO_KINDS as readonly string[]).includes(p.kind),
  );
}

/** Tipos de foto já enviados; o item antigo "Foto na balança" concluído conta como balança. */
async function photoKindsDone(orderId: string, photos: ProductPhoto[]) {
  const kinds = new Set(photos.map((p) => p.kind as string));
  if (!kinds.has("weight_scale")) {
    const store = getStore();
    const [stage] = await store.list("stages", {
      filter: { orderId, key: "PREPARATION" },
      limit: 1,
    });
    if (stage) {
      const [req] = await store.list("requirements", {
        filter: { stageId: stage.id, key: "photo_scale", status: "done" },
        limit: 1,
      });
      if (req) kinds.add("weight_scale");
    }
  }
  return [...kinds];
}

export interface SheetView {
  order: Order;
  access: SheetAccess;
  /** Ficha gravada, ou o rascunho pré-preenchido quando ainda não existe. */
  sheet: SheetInput & {
    id?: string;
    completedAt?: string | null;
    updatedAt?: string;
  };
  saved: boolean;
  photos: ProductPhoto[];
  plan: SheetPlan;
  missing: SheetMissing[];
  containerType: string | null;
  containerTypes: Array<{ code: string; capacityCbm: number }>;
}

export async function getSheetForUser(
  user: User,
  orderId: string,
): Promise<SheetView | null> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) return null;
  const access = sheetAccess(user, order);
  if (!access.view) return null;
  const [existing] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  const sheet = existing ?? (await prefill(order));
  const photos = await getSheetPhotos(orderId);
  const container = await containerCapacity(sheet.containerType ?? null);
  return {
    order,
    access,
    sheet,
    saved: !!existing,
    photos,
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
    missing: missingForCompletion(sheet, await photoKindsDone(orderId, photos)),
    containerType: container.type,
    containerTypes: container.types,
  };
}

/** Grava só os campos que o papel pode editar; o resto fica como está. */
export async function saveSheet(
  user: User,
  orderId: string,
  input: SheetInput,
): Promise<{ sheet: PurchaseSheet; missing: SheetMissing[] }> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new PurchaseSheetError("not_found");
  const access = sheetAccess(user, order);
  if (!access.editSupplier && !access.editCustoms)
    throw new PurchaseSheetError("forbidden");
  const allowed = new Set<string>([
    ...(access.editSupplier ? SUPPLIER_FIELDS : []),
    ...(access.editCustoms ? CUSTOMS_FIELDS : []),
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key) && value !== undefined) patch[key] = value;
  }
  if ("lots" in patch) patch.lots = normalizeLots(patch.lots as never);
  const [existing] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  let sheet: PurchaseSheet;
  if (existing) {
    sheet = await store.update("purchase_sheets", existing.id, {
      ...patch,
      updatedByUserId: user.id,
    });
  } else {
    const base = await prefill(order);
    const blank = Object.fromEntries(
      [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS].map((k) => [k, null]),
    );
    sheet = await store.create("purchase_sheets", {
      ...blank,
      ...base,
      ...patch,
      lots: normalizeLots((patch.lots ?? base.lots) as never),
      orderId,
      updatedByUserId: user.id,
      completedAt: null,
    } as Omit<PurchaseSheet, "id" | "createdAt" | "updatedAt">);
  }
  await audit(
    user,
    existing ? "purchase_sheet.update" : "purchase_sheet.create",
    "order",
    orderId,
    `Ficha de compra: ${Object.keys(patch).length} campo(s)`,
  );
  const missing = await syncRequirements(user, order, sheet);
  return { sheet, missing };
}

/** Fotos da ficha (várias por tipo). Ficam no pedido, nunca no catálogo do cliente. */
export async function addSheetPhotos(
  user: User,
  orderId: string,
  kind: SheetPhotoKind,
  files: File[],
): Promise<number> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new PurchaseSheetError("not_found");
  if (!sheetAccess(user, order).addPhotos)
    throw new PurchaseSheetError("forbidden");
  if (!(SHEET_PHOTO_KINDS as readonly string[]).includes(kind))
    throw new PurchaseSheetError("invalid_kind");
  if (!files.length) throw new PurchaseSheetError("photo_required");
  const now = new Date().toISOString();
  // Várias fotos sobem em paralelo (antes, uma depois da outra).
  await Promise.all(
    files.slice(0, 12).map(async (file) => {
      const doc = await uploadDocument(user, file, {
        orderId,
        type: "photo",
        // Fornecedor e Wellmix (e parceiros do pedido); cliente não (cartão, origem).
        visibility: "supplier",
      });
      await store.create("product_photos", {
        productId: null,
        sourcingItemId: null,
        orderId,
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
  // A foto na balança também cumpre o requisito "Foto na balança" da Preparação.
  if (kind === "weight_scale") {
    const prep = await activePreparation(orderId);
    const req = prep?.requirements.find(
      (r) => r.key === "photo_scale" && r.status !== "done",
    );
    const [photo] = (await getSheetPhotos(orderId)).filter(
      (p) => p.kind === "weight_scale",
    );
    if (req && photo && canSubmitRequirement(user, order, req))
      await submitRequirement(user, req.id, { documentId: photo.documentId });
  }
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  // Só fotos obrigatórias podem concluir a ficha; as outras não precisam recalcular.
  if (sheet && kind in REQUIRED_SHEET_PHOTOS)
    await syncRequirements(user, order, sheet);
  return Math.min(files.length, 12);
}

/**
 * Exclui uma foto da ficha: quem pode enviar fotos pode excluir. Some da ficha e
 * da lista de documentos do pedido; o arquivo é apagado. A exclusão fica na
 * auditoria (quem, quando, tipo e nome do arquivo).
 */
export async function removeSheetPhoto(
  user: User,
  orderId: string,
  photoId: string,
): Promise<void> {
  const store = getStore();
  const [order, photo] = await Promise.all([
    store.get("orders", orderId),
    store.get("product_photos", photoId),
  ]);
  if (!order || !photo || photo.orderId !== orderId)
    throw new PurchaseSheetError("not_found");
  if (!sheetAccess(user, order).addPhotos)
    throw new PurchaseSheetError("forbidden");
  if (!(SHEET_PHOTO_KINDS as readonly string[]).includes(photo.kind))
    throw new PurchaseSheetError("not_found");
  const doc = await store.get("documents", photo.documentId);
  await store.remove("product_photos", photo.id);
  if (doc && doc.orderId === orderId) {
    await store.remove("documents", doc.id);
    await store.removeFile(doc.storageKey).catch((error) => {
      console.error("removeSheetPhoto: arquivo não apagado", error);
    });
  }
  await audit(
    user,
    "purchase_sheet.photo_remove",
    "order",
    orderId,
    `Foto excluída da ficha: ${photo.kind}${doc ? ` (${doc.name})` : ""}`,
  );
}

async function activePreparation(orderId: string) {
  const store = getStore();
  const [stage] = await store.list("stages", {
    filter: { orderId, key: "PREPARATION" },
    limit: 1,
  });
  if (!stage || (stage.status !== "active" && stage.status !== "blocked"))
    return null;
  const requirements = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  return { stage, requirements };
}

/**
 * Liga a ficha ao checklist da Preparação: ficha completa conclui "Ficha de
 * compra"; o peso líquido por peça preenche "Peso (kg)" (comparado na inspeção).
 */
async function syncRequirements(
  user: User,
  order: Order,
  sheet: PurchaseSheet,
): Promise<SheetMissing[]> {
  const store = getStore();
  const photos = await getSheetPhotos(order.id);
  const missing = missingForCompletion(
    sheet,
    await photoKindsDone(order.id, photos),
  );
  if (!missing.length && !sheet.completedAt) {
    await store.update("purchase_sheets", sheet.id, {
      completedAt: new Date().toISOString(),
    });
  }
  const prep = await activePreparation(order.id);
  if (!prep) return missing;
  const weight = prep.requirements.find(
    (r) => r.key === "weight" && r.status !== "done",
  );
  if (
    weight &&
    sheet.netWeightPcKg &&
    sheet.netWeightPcKg > 0 &&
    canSubmitRequirement(user, order, weight)
  ) {
    await submitRequirement(user, weight.id, {
      value: String(sheet.netWeightPcKg),
      note: "Peso líquido por peça (ficha de compra)",
    });
  }
  const sheetReq = prep.requirements.find(
    (r) => r.key === "purchase_sheet" && r.status !== "done",
  );
  if (
    sheetReq &&
    !missing.length &&
    canSubmitRequirement(user, order, sheetReq)
  ) {
    const container = await containerCapacity(sheet.containerType);
    const plan = planSheet(sheet, container.capacity);
    const summary = [
      `${sheet.incoterm ?? ""} ${sheet.currency ?? ""} ${sheet.price ?? ""}`.trim(),
      plan.totalPieces !== null ? `${plan.totalPieces} pcs` : null,
      plan.totalCbm !== null ? `${plan.totalCbm} m³` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    await submitRequirement(user, sheetReq.id, {
      value: summary || "Ficha completa",
    });
  }
  return missing;
}
