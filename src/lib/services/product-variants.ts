import "server-only";

import {
  getStore,
  type Product,
  type ProductVariant,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  referenceVariant,
  sortVariants,
  variantKey,
  variantSnapshot,
} from "@/lib/variants";
import { audit } from "./audit";
import { isSchemaMissing } from "./packaging-brief";
import { mirrorMasterSheetFromVariant, sheetCurrency } from "./product-sheet";
import type { SheetInput } from "./purchase-sheet";

/*
 * Variações de produto (modelo, tamanho, acabamento): cada uma com preço,
 * MOQ, caixa, pesos, medidas, CBM, cores, material, embalagem, código de
 * fábrica e foto próprios (docs/PRODUCT_VARIANTS.md). Só a Wellmix cria e
 * edita; cliente e fornecedor escolhem/veem nas próximas fases (solicitação,
 * cotação, pedido, vitrine).
 *
 * As colunas do produto e a ficha mestre espelham a variação de referência
 * (menor preço): `syncProductFromVariants` roda depois de criar, editar ou
 * desativar uma variação (e, mais à frente, quando um pedido adota a ficha).
 *
 * Antes de o esquema ser publicado no Appwrite a tabela não existe: as
 * leituras devolvem "sem variações" e nada quebra; criar variação exige a
 * tabela (a importação no modo "um produto com variações" avisa).
 */

export { referenceVariant, variantKey, variantSnapshot };

export class ProductVariantError extends Error {}

/** Campos editáveis de uma variação (todos opcionais, menos o nome). */
export interface VariantInput {
  name: string;
  factoryItemCode?: string | null;
  sizeText?: string | null;
  price?: number | null;
  /** USD/CNY/BRL/EUR (RMB vira CNY). */
  currency?: string | null;
  moq?: number | null;
  masterBoxQty?: number | null;
  innerBoxQty?: number | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  cbm?: number | null;
  colorAssortment?: string | null;
  material?: string | null;
  packageType?: string | null;
  capacityMl?: number | null;
  notes?: string | null;
  sortOrder?: number | null;
}

type VariantValues = Omit<
  ProductVariant,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "productId"
  | "key"
  | "active"
  | "photoDocumentId"
  | "importBatchId"
>;

/** Tamanho das colunas de texto (Appwrite recusa o que passa). */
const TEXT_MAX: Record<
  | "name"
  | "factoryItemCode"
  | "sizeText"
  | "colorAssortment"
  | "material"
  | "packageType"
  | "notes",
  number
> = {
  name: 160,
  factoryItemCode: 60,
  sizeText: 60,
  colorAssortment: 200,
  material: 200,
  packageType: 120,
  notes: 4000,
};
const INT_FIELDS = ["moq", "masterBoxQty", "innerBoxQty", "sortOrder"] as const;
const FLOAT_FIELDS = [
  "price",
  "netWeightKg",
  "grossWeightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "cbm",
  "capacityMl",
] as const;

const cleanText = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const cleanNumber = (v: number | null | undefined, integer: boolean) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return integer ? Math.round(v) : v;
};
/** Moeda na convenção do produto (CNY, não RMB), 3 letras. */
export function variantCurrency(v: string | null | undefined): string | null {
  const c = (v ?? "").trim().toUpperCase();
  if (!c) return null;
  if (c === "RMB") return "CNY";
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/**
 * Só o que veio no input (campo ausente = não mexe), já cortado e
 * normalizado. `name` nunca fica vazio.
 */
function normalizeInput(input: Partial<VariantInput>): Partial<VariantValues> {
  const out: Partial<VariantValues> = {};
  const has = (k: keyof VariantInput) => input[k] !== undefined;
  if (has("name")) {
    const name = cleanText(input.name, TEXT_MAX.name);
    if (!name) throw new ProductVariantError("variant_name_required");
    out.name = name;
  }
  for (const k of [
    "factoryItemCode",
    "sizeText",
    "colorAssortment",
    "material",
    "packageType",
    "notes",
  ] as const)
    if (has(k)) out[k] = cleanText(input[k], TEXT_MAX[k]);
  if (has("currency")) out.currency = variantCurrency(input.currency);
  for (const k of INT_FIELDS) if (has(k)) out[k] = cleanNumber(input[k], true);
  for (const k of FLOAT_FIELDS)
    if (has(k)) out[k] = cleanNumber(input[k], false);
  return out;
}

const BLANK: Omit<VariantValues, "name"> = {
  sortOrder: null,
  factoryItemCode: null,
  sizeText: null,
  price: null,
  currency: null,
  moq: null,
  masterBoxQty: null,
  innerBoxQty: null,
  netWeightKg: null,
  grossWeightKg: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  cbm: null,
  colorAssortment: null,
  material: null,
  packageType: null,
  capacityMl: null,
  notes: null,
};

/* ------------------------------------------------------------------------ */
/* Leitura                                                                   */
/* ------------------------------------------------------------------------ */

/** Variações do produto (ativas; `includeInactive` traz todas), na ordem da planilha. */
export async function listProductVariants(
  productId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<ProductVariant[]> {
  try {
    const rows = await getStore().list("product_variants", {
      filter: opts.includeInactive
        ? { productId }
        : { productId, active: true },
    });
    return sortVariants(rows);
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Variações ativas de vários produtos de uma vez (listas, catálogo, vitrine). */
export async function variantsByProduct(
  productIds: string[],
): Promise<Map<string, ProductVariant[]>> {
  const map = new Map<string, ProductVariant[]>();
  if (!productIds.length) return map;
  try {
    const rows = await getStore().list("product_variants", {
      filter: { productId: productIds, active: true },
    });
    for (const row of rows) {
      const list = map.get(row.productId) ?? [];
      list.push(row);
      map.set(row.productId, list);
    }
    for (const [id, list] of map) map.set(id, sortVariants(list));
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
  }
  return map;
}

export async function getProductVariant(
  id: string,
): Promise<ProductVariant | null> {
  try {
    return await getStore().get("product_variants", id);
  } catch (error) {
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

/** Variações por id (ex.: tela de resultado da importação), ativas ou não. */
export async function getProductVariants(
  ids: string[],
): Promise<ProductVariant[]> {
  if (!ids.length) return [];
  try {
    return await getStore().list("product_variants", { filter: { id: ids } });
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

async function findByKey(
  productId: string,
  key: string,
): Promise<ProductVariant | null> {
  const [row] = await getStore().list("product_variants", {
    filter: { productId, key },
    limit: 1,
  });
  return row ?? null;
}

/* ------------------------------------------------------------------------ */
/* Escrita (só Wellmix)                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Cria ou atualiza a variação pela chave (código de fábrica + nome) dentro
 * do produto: é o que a importação usa para reimportar a mesma planilha sem
 * duplicar. Campo ausente no input não mexe no que já está gravado.
 */
export async function upsertProductVariant(
  user: User,
  productId: string,
  input: VariantInput,
  opts: { importBatchId?: string | null } = {},
): Promise<{ variant: ProductVariant; created: boolean }> {
  assertWellmix(user);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new ProductVariantError("product_not_found");
  const values = normalizeInput(input);
  const name = values.name as string;
  const key = variantKey({
    factoryItemCode: values.factoryItemCode ?? input.factoryItemCode ?? null,
    name,
  });
  const batch = opts.importBatchId ? { importBatchId: opts.importBatchId } : {};
  const apply = async (row: ProductVariant) => {
    const variant = await store.update("product_variants", row.id, {
      ...values,
      ...batch,
    });
    await audit(
      user,
      "product.variant_update",
      "product",
      productId,
      `Variação ${variant.name}`,
    );
    return { variant, created: false };
  };
  const existing = await findByKey(productId, key);
  if (existing) return apply(existing);
  try {
    const variant = await store.create("product_variants", {
      ...BLANK,
      productId,
      key,
      active: true,
      photoDocumentId: null,
      importBatchId: opts.importBatchId ?? null,
      // Sem ordem informada: entra no fim.
      sortOrder:
        values.sortOrder ??
        (await listProductVariants(productId, { includeInactive: true }))
          .length,
      ...values,
      name,
    });
    await audit(
      user,
      "product.variant_create",
      "product",
      productId,
      `Variação ${variant.name}`,
    );
    return { variant, created: true };
  } catch (error) {
    // Duas gravações ao mesmo tempo: o índice único barra a segunda.
    const again = await findByKey(productId, key);
    if (!again) throw error;
    return apply(again);
  }
}

/**
 * Edita uma variação existente (formulário do cadastro). Nome ou código
 * novos mudam a chave; chave já usada por outra variação do produto é recusada.
 */
export async function updateProductVariant(
  user: User,
  variantId: string,
  input: Partial<VariantInput>,
): Promise<ProductVariant> {
  assertWellmix(user);
  const store = getStore();
  const current = await store.get("product_variants", variantId);
  if (!current) throw new ProductVariantError("variant_not_found");
  const values = normalizeInput(input);
  const name = values.name ?? current.name;
  const code =
    values.factoryItemCode !== undefined
      ? values.factoryItemCode
      : current.factoryItemCode;
  const key = variantKey({ factoryItemCode: code, name });
  if (key !== current.key) {
    const clash = await findByKey(current.productId, key);
    if (clash && clash.id !== current.id)
      throw new ProductVariantError("variant_duplicate");
  }
  const variant = await store.update("product_variants", variantId, {
    ...values,
    key,
  });
  await audit(
    user,
    "product.variant_update",
    "product",
    current.productId,
    `Variação ${variant.name}`,
    current,
    variant,
  );
  return variant;
}

/** Desativar em vez de apagar (solicitações e pedidos antigos continuam apontando). */
export async function setProductVariantActive(
  user: User,
  variantId: string,
  active: boolean,
): Promise<ProductVariant> {
  assertWellmix(user);
  const store = getStore();
  const current = await store.get("product_variants", variantId);
  if (!current) throw new ProductVariantError("variant_not_found");
  if (current.active === active) return current;
  const variant = await store.update("product_variants", variantId, { active });
  await audit(
    user,
    active ? "product.variant_activate" : "product.variant_deactivate",
    "product",
    current.productId,
    `Variação ${variant.name} ${active ? "reativada" : "desativada"}`,
  );
  return variant;
}

/** Foto da variação (documento de uma foto do produto); nulo tira. */
export async function setProductVariantPhoto(
  user: User,
  variantId: string,
  documentId: string | null,
): Promise<ProductVariant> {
  assertWellmix(user);
  const store = getStore();
  const current = await store.get("product_variants", variantId);
  if (!current) throw new ProductVariantError("variant_not_found");
  if (current.photoDocumentId === documentId) return current;
  return store.update("product_variants", variantId, {
    photoDocumentId: documentId,
  });
}

/* ------------------------------------------------------------------------ */
/* Espelho no produto                                                        */
/* ------------------------------------------------------------------------ */

/**
 * Produto com variações ativas: as colunas comerciais/físicas do produto e a
 * ficha mestre passam a ser as da variação de referência (menor preço). As
 * medidas da peça vão direto às colunas do produto (como a importação faz);
 * o resto entra pela ficha mestre, que já espelha no produto (preço, moeda,
 * MOQ, caixa, pesos, CBM, cores, material, embalagem, código, capacidade).
 * Só grava o que a variação tem: campo vazio na variação não apaga o que a
 * ficha mestre já tinha. Sem variação ativa, não faz nada. Seguro para ser
 * chamado pela importação, pelas ações e pela adoção da ficha do pedido.
 */
export async function syncProductFromVariants(
  productId: string,
  user: User | null = null,
): Promise<void> {
  const ref = referenceVariant(await listProductVariants(productId));
  if (!ref) return;
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return;
  const dims: Partial<Product> = {};
  for (const k of ["lengthCm", "widthCm", "heightCm"] as const)
    if (ref[k] !== null && product[k] !== ref[k]) dims[k] = ref[k];
  if (Object.keys(dims).length) await store.update("products", productId, dims);
  const input: SheetInput = {};
  const put = <K extends keyof SheetInput>(k: K, v: SheetInput[K]) => {
    if (v !== undefined && v !== null && v !== "") input[k] = v;
  };
  put("price", ref.price);
  put("currency", sheetCurrency(ref.currency));
  put("moq", ref.moq);
  put("masterCartonQty", ref.masterBoxQty);
  put("innerQty", ref.innerBoxQty);
  put("netWeightPcKg", ref.netWeightKg);
  put("grossWeightPcKg", ref.grossWeightKg);
  put("cbmPerCarton", ref.cbm);
  put("colorAssortment", ref.colorAssortment);
  put("material", ref.material);
  put("packageType", ref.packageType);
  put("factoryItemCode", ref.factoryItemCode);
  put("capacityMl", ref.capacityMl);
  if (!Object.keys(input).length) return;
  await mirrorMasterSheetFromVariant(user, productId, input);
}
