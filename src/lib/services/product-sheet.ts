import "server-only";

import {
  PRODUCT_EXTRA_DEFAULTS,
  getStore,
  type Product,
  type PurchaseSheet,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { cutAtSeparator } from "@/lib/pantone/color-text";
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

/**
 * Campos do PRODUTO (valem para qualquer fornecedor): vão para a cotação de
 * qualquer fornecedor convidado e para a ficha do pedido.
 */
export const MASTER_PRODUCT_FIELDS = [
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
  "ncm",
  "importTaxPercent",
  "ipiPercent",
] as const satisfies readonly (keyof PurchaseSheet)[];
/**
 * Campos COMERCIAIS do fornecedor de referência (loja, telefone, preço, MOQ,
 * incoterm, observações): ficam só na ficha mestre; nunca vão para a cotação
 * de outro fornecedor (isolamento entre fornecedores).
 */
export const MASTER_COMMERCIAL_FIELDS = [
  "location",
  "supplierName",
  "supplierStore",
  "supplierPhone",
  "factoryItemCode",
  "incoterm",
  "currency",
  "price",
  "moq",
  "notes",
] as const satisfies readonly (keyof PurchaseSheet)[];
export const MASTER_SHEET_FIELDS = [
  ...MASTER_PRODUCT_FIELDS,
  ...MASTER_COMMERCIAL_FIELDS,
] as const;

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
  supplier: {
    name: string;
    phone?: string | null;
    city?: string | null;
    storeNumber?: string | null;
  } | null,
): SheetInput {
  return {
    supplierName: supplier?.name ?? null,
    location: supplier?.city ?? null,
    supplierStore: supplier?.storeNumber ?? null,
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
    colorPantones: product.colorPantones ?? null,
    material: product.material ?? null,
    ncm: product.ncm ?? null,
    lots: normalizeLots(null),
  };
}

/**
 * O que a ficha mestre dá a um pedido/cotação novo: só os campos do produto
 * (caixa, medidas, pesos, embalagem, cor, material, NCM…). Dados comerciais
 * do fornecedor de referência não saem da ficha mestre; datas, lotes e quem
 * preencheu são de cada compra. Nulo sem ficha mestre.
 */
export async function masterSheetInput(
  productId: string | null | undefined,
): Promise<SheetInput | null> {
  if (!productId) return null;
  const master = await getProductSheet(productId);
  if (!master) return null;
  const out: Record<string, unknown> = {};
  for (const k of MASTER_PRODUCT_FIELDS)
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
  // Colunas de texto do produto têm tamanho fixo no Appwrite: corta no limite.
  const cut = (v: string | null | undefined, max: number) =>
    v ? v.slice(0, max) : null;
  // Cor da ficha (até 200) no produto (até 60): corta entre trechos, sem partir
  // um "PANTONE <código>" ao meio (o seletor não o acharia para tirar depois).
  if (has("colorAssortment"))
    patch.color = sheet.colorAssortment
      ? cutAtSeparator(sheet.colorAssortment, 60)
      : null;
  // Texto livre "pantone" só é trocado quando há cores escolhidas (nunca apagado por falta delas);
  // as cores escolhidas vão para o produto (coluna nova: só quando há alguma).
  if (has("colorPantones") && sheet.colorPantones?.length) {
    patch.pantone = cutAtSeparator(
      sheet.colorPantones.map((c) => c.code).join(" / "),
      40,
    );
    patch.colorPantones = sheet.colorPantones;
  }
  if (has("material")) patch.material = cut(sheet.material, 120);
  if (has("factoryItemCode"))
    patch.supplierSku = cut(sheet.factoryItemCode, 60);
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
    // Produto antigo sem a coluna não apaga as cores da ficha mestre.
    ...(product.colorPantones !== undefined
      ? { colorPantones: product.colorPantones }
      : {}),
  };
}

/** Salva a ficha mestre (só Wellmix) e espelha no produto. */
export async function saveProductSheet(
  user: User,
  productId: string,
  input: SheetInput,
): Promise<{ sheet: PurchaseSheet; missing: SheetMissing[] }> {
  assertWellmix(user);
  return writeProductSheet(user, productId, input);
}

/** Grava a ficha mestre (sem checar papel: quem chama já decidiu o que pode). */
async function writeProductSheet(
  user: User,
  productId: string,
  input: SheetInput,
  action?: string,
): Promise<{ sheet: PurchaseSheet; missing: SheetMissing[] }> {
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
    action ?? (existing ? "product.sheet_update" : "product.sheet_create"),
    "product",
    productId,
    `Ficha mestre: ${Object.keys(patch).length} campo(s)`,
  );
  return { sheet, missing: await productSheetMissing(productId, sheet) };
}

const filled = (v: unknown) =>
  v !== undefined &&
  v !== null &&
  v !== "" &&
  !(Array.isArray(v) && v.length === 0);

/**
 * O cadastro do produto acompanha a ficha (para a próxima venda já vir
 * preenchida), sem que um fornecedor estrague o que é de outro:
 * - "fill" (cotação salva, ficha do pedido salva pelo fornecedor): só completa
 *   o que a ficha mestre/produto ainda não tem; nunca troca valor.
 * - "adopt" (pedido criado, ficha do pedido salva pela Wellmix): a compra de
 *   verdade. Do fornecedor principal (ou de produto sem principal) atualiza os
 *   dados do produto; de outro fornecedor, só completa o que falta.
 * Dados comerciais (preço, MOQ, código, loja…) só vêm do fornecedor principal.
 * Nunca derruba quem chamou: falha fica no log.
 */
export async function completeMasterFromSheet(
  user: User,
  productId: string | null | undefined,
  sheet: Partial<PurchaseSheet>,
  supplierId: string | null | undefined,
  mode: "fill" | "adopt",
): Promise<string[]> {
  if (!productId) return [];
  try {
    const store = getStore();
    const product = await store.get("products", productId);
    if (!product) return [];
    const main = !!product.supplierId && product.supplierId === supplierId;
    const fields: readonly string[] = main
      ? MASTER_SHEET_FIELDS
      : MASTER_PRODUCT_FIELDS;
    const overwrite = mode === "adopt" && (main || !product.supplierId);
    const existing = await getProductSheet(productId);
    const current: Record<string, unknown> = existing
      ? { ...existing }
      : { ...productSheetDraft(product, null) };
    const input: Record<string, unknown> = {};
    for (const k of fields) {
      const v = (sheet as Record<string, unknown>)[k];
      if (!filled(v)) continue;
      if (!overwrite && filled(current[k])) continue;
      if (JSON.stringify(current[k]) === JSON.stringify(v)) continue;
      input[k] = v;
    }
    if (!Object.keys(input).length) return [];
    await writeProductSheet(
      user,
      productId,
      input as SheetInput,
      mode === "adopt" ? "product.sheet_from_order" : "product.sheet_fill",
    );
    return Object.keys(input);
  } catch (error) {
    console.warn(
      "[product-sheet] completar o cadastro pela ficha falhou",
      error,
    );
    return [];
  }
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
  // Lotes e início da produção são de cada compra. As 5 fotos da ficha
  // contam: vêm do card Fotos do produto (lista do que falta lá).
  return missingForCompletion(
    sheet,
    await productSheetPhotoKinds(productId),
  ).filter((m) => m !== "lot1" && m !== "productionStartAt");
}

/**
 * Tipos de foto da ficha que o cadastro do produto já cobre. Pedido e cotação
 * de produto do catálogo não precisam dessas fotos de novo: contam como
 * enviadas (a Wellmix as vê no produto); o arquivo continua só no catálogo,
 * sem copiar nem reapontar documentos.
 */
export async function catalogPhotoKinds(
  productId: string | null | undefined,
): Promise<string[]> {
  if (!productId) return [];
  const kinds = await productSheetPhotoKinds(productId);
  return kinds.filter((k) =>
    (SHEET_PHOTO_KINDS as readonly string[]).includes(k),
  );
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
  const product = await store.get("products", productId);
  if (!product) throw new ProductSheetError("not_found");
  // De quem é a ficha (cotação ou pedido): só a do fornecedor principal leva
  // os dados comerciais (código, preço, MOQ, loja, telefone…) para a mestre e
  // o produto; a de outro fornecedor leva só os dados do produto, e o código,
  // preço e MOQ dele ficam no vínculo dele (nenhum fornecedor herda de outro).
  const owner =
    (await store.get("quotes", ownerId)) ??
    (await store.get("orders", ownerId));
  const ownSupplier =
    !!owner && !!product.supplierId && owner.supplierId === product.supplierId;
  const fields: readonly string[] = ownSupplier
    ? MASTER_SHEET_FIELDS
    : MASTER_PRODUCT_FIELDS;
  if (!ownSupplier && owner?.supplierId) {
    const { rememberSupplierTerms } = await import("./product-suppliers");
    await rememberSupplierTerms(user, productId, owner.supplierId, {
      supplierSku: sheet.factoryItemCode ?? null,
      price: sheet.price ?? null,
      currency: sheet.currency === "RMB" ? "CNY" : (sheet.currency ?? null),
      moq: sheet.moq ?? null,
    });
  }
  const input: Record<string, unknown> = {};
  for (const k of fields as readonly (keyof PurchaseSheet)[]) {
    const v = sheet[k];
    // Só o que está preenchido: campo em branco não apaga o que a mestre já tem.
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    input[k] = v;
  }
  await saveProductSheet(user, productId, input as SheetInput);
  // Fotos ficam onde foram enviadas (as do cadastro sobem na tela do produto):
  // documentos de pedido/cotação têm acesso próprio e não viram catálogo.
  const copiedPhotos = 0;
  await audit(
    user,
    "product.sheet_adopt",
    "product",
    productId,
    `Ficha mestre atualizada a partir da ficha ${ownerId}`,
  );
  return { productId, copiedPhotos };
}

/**
 * Produto fora do catálogo (pedido de um item digitado pelo nome): a Wellmix
 * cadastra com um clique na ficha do pedido, na linha escolhida. O produto
 * nasce com o fornecedor do pedido como principal e a ficha do pedido como
 * ficha mestre; solicitação, item e ficha passam a apontar para ele (a
 * próxima venda já vem preenchida). Já cadastrado: devolve o mesmo.
 */
export async function registerProductFromOrderSheet(
  user: User,
  orderId: string,
  lineId: string,
): Promise<string> {
  assertWellmix(user);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new ProductSheetError("not_found");
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId },
    limit: 1,
  });
  if (!sheet) throw new ProductSheetError("not_found");
  if (sheet.productId) return sheet.productId;
  const line = await store.get("product_lines", lineId);
  if (!line) throw new ProductSheetError("invalid_line");
  const [item] = await store.list("order_items", {
    filter: { orderId },
    limit: 1,
  });
  const request = await store.get("requests", order.requestId);
  const product = await store.create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: line.id,
    name: (item?.name ?? request?.productName ?? "Produto").slice(0, 160),
    sku: null,
    specification: request?.specification ?? request?.description ?? null,
    active: true,
    source: "manual",
    supplierId: order.supplierId,
  });
  await store.update("purchase_sheets", sheet.id, { productId: product.id });
  if (item && !item.productId)
    await store.update("order_items", item.id, { productId: product.id });
  if (request && !request.productId)
    await store.update("requests", request.id, { productId: product.id });
  await audit(
    user,
    "product.create_from_order",
    "product",
    product.id,
    `Cadastrado a partir do pedido #${order.number}`,
  );
  await completeMasterFromSheet(
    user,
    product.id,
    { ...sheet, productId: product.id },
    order.supplierId,
    "adopt",
  );
  return product.id;
}
