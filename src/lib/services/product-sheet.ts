import "server-only";

import {
  getStore,
  type PhotoKind,
  type Product,
  type ProductPhoto,
  type PurchaseSheet,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import {
  CUSTOMS_FIELDS,
  SHEET_PHOTO_KINDS,
  SUPPLIER_FIELDS,
  type SheetInput,
} from "./purchase-sheet";
import {
  missingForCompletion,
  normalizeLots,
  type SheetMissing,
} from "./purchase-sheet-calc";
import { pantoneLabel } from "@/lib/pantone";

/*
 * Ficha de compra MESTRE do produto (cadastro): a mesma ficha do pedido e da
 * cotação, guardada em `purchase_sheets` com `orderId = id do produto` (um
 * registro por produto). Pedidos e cotações de produtos do catálogo nascem
 * preenchidos com ela (campos e fotos); só produto desconhecido pela Wellmix,
 * ou sem ficha, exige preenchimento do zero.
 *
 * Preço, moeda, MOQ, caixa, medidas, pesos, cor e material também existem
 * nas colunas do produto (listas, precificação): ao salvar a ficha mestre
 * eles são espelhados no produto, e ao salvar o produto, na ficha mestre.
 */

export class ProductSheetError extends Error {}

/** Campos da ficha que valem para qualquer pedido (o resto é de cada compra). */
export const MASTER_SHEET_FIELDS = [
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
  "colorPantones",
  "material",
  "powerSource",
  "powerDetail",
  "containerType",
  "ecommerceDescription",
  "notes",
  "ncm",
  "importTaxPercent",
  "ipiPercent",
] as const satisfies readonly (keyof PurchaseSheet)[];

export async function getProductSheet(
  productId: string,
): Promise<PurchaseSheet | null> {
  const [row] = await getStore().list("purchase_sheets", {
    filter: { orderId: productId },
    limit: 1,
  });
  return row ?? null;
}

const sheetCurrency = (c: string | null | undefined) => {
  const v = (c ?? "").toUpperCase();
  if (v === "CNY" || v === "RMB") return "RMB" as const;
  return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
};

/** Rascunho da ficha mestre a partir das colunas do produto (quando ainda não há ficha). */
export function productSheetDraft(
  product: Product,
  supplier: { name: string; phone?: string | null } | null,
): SheetInput {
  return {
    supplierName: supplier?.name ?? null,
    supplierPhone: supplier?.phone ?? null,
    factoryItemCode: product.supplierSku ?? null,
    currency: sheetCurrency(product.currency),
    price: product.price ?? null,
    moq: product.moq ?? null,
    masterCartonQty: product.masterBoxQty ?? null,
    innerQty: product.innerBoxQty ?? null,
    netWeightPcKg: product.netWeightKg ?? null,
    grossWeightPcKg: product.grossWeightKg ?? null,
    cbmPerCarton: product.cbm ?? null,
    heightCm: product.boxHeightCm ?? null,
    widthCm: product.boxWidthCm ?? null,
    lengthCm: product.boxLengthCm ?? null,
    colorAssortment: product.color ?? null,
    material: product.material ?? null,
    ncm: product.ncm ?? null,
    lots: normalizeLots(null),
  };
}

/**
 * O que a ficha mestre dá a um pedido/cotação novo: só os campos gerais
 * (nada de datas, lotes ou quem preencheu). Nulo sem ficha mestre.
 */
export async function masterSheetInput(
  productId: string | null | undefined,
): Promise<SheetInput | null> {
  if (!productId) return null;
  const master = await getProductSheet(productId);
  if (!master) return null;
  const out: Record<string, unknown> = {};
  for (const k of MASTER_SHEET_FIELDS)
    if (master[k] !== undefined && master[k] !== null) out[k] = master[k];
  return out as SheetInput;
}

/** Colunas do produto espelhadas da ficha (mesmo dado, dois lugares). */
function productPatchFromSheet(
  sheet: Partial<PurchaseSheet>,
): Partial<Product> {
  const patch: Partial<Product> = {};
  const has = (k: keyof PurchaseSheet) => sheet[k] !== undefined;
  if (has("price")) patch.price = sheet.price ?? null;
  if (has("currency"))
    patch.currency =
      sheet.currency === "RMB" ? "CNY" : (sheet.currency ?? null);
  if (has("moq")) patch.moq = sheet.moq ?? null;
  if (has("masterCartonQty"))
    patch.masterBoxQty = sheet.masterCartonQty ?? null;
  if (has("innerQty")) patch.innerBoxQty = sheet.innerQty ?? null;
  if (has("netWeightPcKg")) patch.netWeightKg = sheet.netWeightPcKg ?? null;
  if (has("grossWeightPcKg"))
    patch.grossWeightKg = sheet.grossWeightPcKg ?? null;
  if (has("cbmPerCarton")) patch.cbm = sheet.cbmPerCarton ?? null;
  if (has("heightCm")) patch.boxHeightCm = sheet.heightCm ?? null;
  if (has("widthCm")) patch.boxWidthCm = sheet.widthCm ?? null;
  if (has("lengthCm")) patch.boxLengthCm = sheet.lengthCm ?? null;
  if (has("colorAssortment")) patch.color = sheet.colorAssortment ?? null;
  if (has("colorPantones"))
    patch.pantone = sheet.colorPantones?.length
      ? sheet.colorPantones.map((c) => pantoneLabel(c)).join(" / ")
      : null;
  if (has("material")) patch.material = sheet.material ?? null;
  if (has("factoryItemCode")) patch.supplierSku = sheet.factoryItemCode ?? null;
  // NCM validado só entra no produto quando a ficha traz um.
  if (sheet.ncm) patch.ncm = sheet.ncm;
  return patch;
}

/** Ficha mestre espelhada das colunas do produto (quando o produto é salvo pelo formulário). */
function sheetPatchFromProduct(product: Product): Partial<PurchaseSheet> {
  return {
    price: product.price ?? null,
    currency: sheetCurrency(product.currency),
    moq: product.moq ?? null,
    masterCartonQty: product.masterBoxQty ?? null,
    innerQty: product.innerBoxQty ?? null,
    netWeightPcKg: product.netWeightKg ?? null,
    grossWeightPcKg: product.grossWeightKg ?? null,
    cbmPerCarton: product.cbm ?? null,
    heightCm: product.boxHeightCm ?? null,
    widthCm: product.boxWidthCm ?? null,
    lengthCm: product.boxLengthCm ?? null,
    colorAssortment: product.color ?? null,
    material: product.material ?? null,
    factoryItemCode: product.supplierSku ?? null,
    ...(product.ncm ? { ncm: product.ncm } : {}),
  };
}

/** Salva a ficha mestre (só Wellmix) e espelha no produto. */
export async function saveProductSheet(
  user: User,
  productId: string,
  input: SheetInput,
): Promise<{ sheet: PurchaseSheet; missing: SheetMissing[] }> {
  assertWellmix(user);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new ProductSheetError("not_found");
  const allowed = new Set<string>([...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input))
    if (allowed.has(key) && value !== undefined) patch[key] = value;
  if ("lots" in patch) patch.lots = normalizeLots(patch.lots as never);
  const existing = await getProductSheet(productId);
  let sheet: PurchaseSheet;
  if (existing) {
    sheet = await store.update("purchase_sheets", existing.id, {
      ...patch,
      updatedByUserId: user.id,
    });
  } else {
    const blank = Object.fromEntries(
      [...SUPPLIER_FIELDS, ...CUSTOMS_FIELDS].map((k) => [k, null]),
    );
    sheet = await store.create("purchase_sheets", {
      ...blank,
      ...patch,
      lots: normalizeLots(patch.lots as never),
      orderId: productId,
      productId,
      updatedByUserId: user.id,
      completedAt: null,
    } as Omit<PurchaseSheet, "id" | "createdAt" | "updatedAt">);
  }
  const mirror = productPatchFromSheet(patch as Partial<PurchaseSheet>);
  if (Object.keys(mirror).length)
    await store.update("products", productId, mirror);
  await audit(
    user,
    existing ? "product.sheet_update" : "product.sheet_create",
    "product",
    productId,
    `Ficha mestre: ${Object.keys(patch).length} campo(s)`,
  );
  return { sheet, missing: await productSheetMissing(productId, sheet) };
}

/** Produto salvo pelo formulário: a ficha mestre (se existir) acompanha. */
export async function syncMasterFromProduct(productId: string): Promise<void> {
  const store = getStore();
  const existing = await getProductSheet(productId);
  if (!existing) return;
  const product = await store.get("products", productId);
  if (!product) return;
  await store.update(
    "purchase_sheets",
    existing.id,
    sheetPatchFromProduct(product),
  );
}

/** Fotos do produto por tipo da ficha. */
export async function productSheetPhotoKinds(
  productId: string,
): Promise<string[]> {
  const photos = await getStore().list("product_photos", {
    filter: { productId },
  });
  return [...new Set(photos.map((p) => p.kind as string))];
}

/** O que falta na ficha mestre (sem lote: lotes são de cada compra). */
export async function productSheetMissing(
  productId: string,
  sheet: Partial<PurchaseSheet> | null,
): Promise<SheetMissing[]> {
  const kinds = await productSheetPhotoKinds(productId);
  // Lotes e início da produção são de cada compra, não da ficha mestre.
  return missingForCompletion(sheet, kinds).filter(
    (m) => m !== "lot1" && m !== "productionStartAt",
  );
}

/**
 * Fotos da ficha mestre viram fotos da ficha do pedido/cotação (mesmo arquivo,
 * sem reenviar), só para os tipos que a ficha de destino ainda não tem.
 */
export async function copyProductPhotosToSheet(
  productId: string | null | undefined,
  ownerId: string,
): Promise<number> {
  if (!productId) return 0;
  const store = getStore();
  const [source, target] = await Promise.all([
    store.list("product_photos", { filter: { productId } }),
    store.list("product_photos", { filter: { orderId: ownerId } }),
  ]);
  const have = new Set(target.map((p) => p.kind as string));
  let copied = 0;
  for (const kind of SHEET_PHOTO_KINDS) {
    if (have.has(kind)) continue;
    for (const p of source.filter((x) => x.kind === kind)) {
      await store.create("product_photos", {
        productId: null,
        sourcingItemId: null,
        orderId: ownerId,
        documentId: p.documentId,
        kind: p.kind,
        caption: p.caption,
        takenAt: p.takenAt,
        takenByUserId: p.takenByUserId,
        derivedFromPhotoId: p.id,
        isPrimary: false,
      });
      copied++;
    }
  }
  return copied;
}

/**
 * "Atualizar o cadastro com esta ficha": a ficha de um pedido ou cotação vira
 * a ficha mestre do produto (campos gerais e fotos que o produto ainda não tem).
 */
export async function adoptSheetIntoProduct(
  user: User,
  ownerId: string,
): Promise<{ productId: string; copiedPhotos: number }> {
  assertWellmix(user);
  const store = getStore();
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId: ownerId },
    limit: 1,
  });
  if (!sheet) throw new ProductSheetError("not_found");
  const productId = sheet.productId;
  if (!productId) throw new ProductSheetError("no_product");
  if (!(await store.get("products", productId)))
    throw new ProductSheetError("not_found");
  const input: Record<string, unknown> = {};
  for (const k of MASTER_SHEET_FIELDS)
    if (sheet[k] !== undefined) input[k] = sheet[k];
  await saveProductSheet(user, productId, input as SheetInput);
  // Fotos: do pedido/cotação para o produto, só os tipos que faltam.
  const [source, target] = await Promise.all([
    store.list("product_photos", { filter: { orderId: ownerId } }),
    store.list("product_photos", { filter: { productId } }),
  ]);
  const have = new Set(target.map((p) => p.kind as string));
  let copiedPhotos = 0;
  for (const kind of SHEET_PHOTO_KINDS as readonly PhotoKind[]) {
    if (have.has(kind)) continue;
    for (const p of source.filter((x: ProductPhoto) => x.kind === kind)) {
      await store.create("product_photos", {
        productId,
        sourcingItemId: null,
        orderId: null,
        documentId: p.documentId,
        kind: p.kind,
        caption: p.caption,
        takenAt: p.takenAt,
        takenByUserId: p.takenByUserId,
        derivedFromPhotoId: p.id,
        isPrimary: false,
      });
      copiedPhotos++;
    }
  }
  await audit(
    user,
    "product.sheet_adopt",
    "product",
    productId,
    `Ficha mestre atualizada a partir da ficha ${ownerId}${copiedPhotos ? ` (+${copiedPhotos} fotos)` : ""}`,
  );
  return { productId, copiedPhotos };
}
