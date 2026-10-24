import "server-only";

import type {
  ProductVariant,
  PurchaseSheet,
  Request,
  User,
  VariantSnapshot,
} from "@/lib/db";
import { translator } from "@/i18n";
import {
  buildProductSpec,
  productSpecLabels,
  type ProductSpecData,
} from "@/lib/product-spec";
import type { SheetInput } from "./purchase-sheet";
import type { VariantInput } from "./product-variants";

/*
 * Variação de produto na venda (docs/PRODUCT_VARIANTS.md, regras 1 a 5):
 * nome da solicitação, especificação, ficha de cotação/pedido nascendo com
 * os valores da variação e a adoção da ficha do pedido de volta na variação.
 * O modelo e o serviço das variações ficam em product-variants.ts; aqui só
 * o que a solicitação, a cotação e o pedido precisam.
 *
 * Não importa product-sheet nem product-variants no topo: eles importam este
 * arquivo (ficha mestre com a variação; adoção), e o ciclo fica fora.
 */

/** Tamanho da coluna `requests.productName`. */
const PRODUCT_NAME_MAX = 160;

/**
 * Nome da solicitação com a variação: "Produto · Variação" (cortado em 160).
 * Nome digitado pelo cliente diferente do nome do produto fica, com a
 * variação acrescentada quando ainda não está nele.
 */
export function requestProductName(
  given: string | null | undefined,
  productName: string,
  variantName: string,
): string {
  const typed = (given ?? "").trim();
  const base =
    typed && typed.toLowerCase() !== productName.trim().toLowerCase()
      ? typed
      : productName.trim();
  if (base.toLowerCase().includes(variantName.trim().toLowerCase()))
    return base.slice(0, PRODUCT_NAME_MAX);
  return `${base} · ${variantName.trim()}`.slice(0, PRODUCT_NAME_MAX);
}

/** Nome da variação de uma solicitação (nulo sem variação). */
export function requestVariantLabel(
  request: Pick<Request, "variant"> | null | undefined,
): string | null {
  const name = request?.variant?.name?.trim();
  return name ? name : null;
}

type SpecSource = Pick<
  ProductVariant,
  | "material"
  | "colorAssortment"
  | "lengthCm"
  | "widthCm"
  | "heightCm"
  | "netWeightKg"
  | "grossWeightKg"
  | "packageType"
  | "masterBoxQty"
  | "innerBoxQty"
  | "cbm"
> & { capacityMl?: number | null };

/** Dados da especificação de uma variação (os mesmos campos do produto). */
export function variantSpecData(v: SpecSource): ProductSpecData {
  return {
    material: v.material,
    color: v.colorAssortment,
    capacityMl: v.capacityMl ?? null,
    lengthCm: v.lengthCm,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    netWeightKg: v.netWeightKg,
    grossWeightKg: v.grossWeightKg,
    packageType: v.packageType,
    masterBoxQty: v.masterBoxQty,
    innerBoxQty: v.innerBoxQty,
    cbm: v.cbm,
  };
}

/**
 * Especificação da solicitação montada com a variação (em português, como
 * a do catálogo): tamanho, cores, caixa, pesos, CBM. Vazia sem dados.
 */
export function variantSpecification(v: SpecSource): string {
  return buildProductSpec(variantSpecData(v), productSpecLabels(translator("pt")));
}

/** Moeda da variação (CNY) na convenção da ficha (RMB); fora da lista, nula. */
const toSheetCurrency = (c: string | null | undefined) => {
  const v = (c ?? "").toUpperCase();
  if (v === "CNY" || v === "RMB") return "RMB" as const;
  return v === "USD" || v === "BRL" || v === "EUR" ? v : null;
};

type VariantValues = VariantSnapshot & { capacityMl?: number | null };

const has = (v: unknown) => v !== undefined && v !== null && v !== "";

/**
 * Dados FÍSICOS da variação na ficha de cotação/pedido: caixa master e
 * inner, pesos por peça, CBM por caixa, cores, material, embalagem e
 * capacidade. Valem para qualquer fornecedor convidado (são do produto).
 * As medidas da variação são da peça; a ficha mede a caixa master, por isso
 * não entram aqui (e o CBM da ficha não seria recalculado com elas).
 */
export function masterInputFromVariant(v: VariantValues): SheetInput {
  const out: SheetInput = {};
  if (has(v.masterBoxQty)) out.masterCartonQty = v.masterBoxQty;
  if (has(v.innerBoxQty)) out.innerQty = v.innerBoxQty;
  if (has(v.netWeightKg)) out.netWeightPcKg = v.netWeightKg;
  if (has(v.grossWeightKg)) out.grossWeightPcKg = v.grossWeightKg;
  if (has(v.cbm)) out.cbmPerCarton = v.cbm;
  if (has(v.colorAssortment)) out.colorAssortment = v.colorAssortment;
  if (has(v.material)) out.material = v.material;
  if (has(v.packageType)) out.packageType = v.packageType;
  if (has(v.capacityMl)) out.capacityMl = v.capacityMl as number;
  return out;
}

/**
 * Dados COMERCIAIS da variação (preço, moeda, MOQ, código de fábrica): só
 * para a ficha do fornecedor de referência do produto (isolamento entre
 * fornecedores, como a ficha mestre).
 */
export function commercialInputFromVariant(v: VariantValues): SheetInput {
  const out: SheetInput = {};
  if (has(v.price)) out.price = v.price;
  const currency = toSheetCurrency(v.currency);
  if (currency) out.currency = currency;
  if (has(v.moq)) out.moq = v.moq;
  if (has(v.factoryItemCode)) out.factoryItemCode = v.factoryItemCode;
  return out;
}

/**
 * Linha compacta dos valores do snapshot (só Wellmix): "Preço: US$ 3,15 ·
 * MOQ: 2.400 · Caixa master / inner: 24 / 12 · CBM: 0,0267". Nula sem valores.
 */
export function variantSnapshotSummary(
  v: VariantSnapshot,
  labels: { price: string; moq: string; box: string; cbm: string },
  intl: string,
): string | null {
  const n = (value: number, digits: number) =>
    new Intl.NumberFormat(intl, { maximumFractionDigits: digits }).format(value);
  const money = (amount: number, currency: string | null) => {
    try {
      return new Intl.NumberFormat(intl, {
        style: "currency",
        currency: currency ?? "USD",
      }).format(amount);
    } catch {
      return `${currency ?? ""} ${amount.toFixed(2)}`.trim();
    }
  };
  const parts = [
    typeof v.price === "number"
      ? `${labels.price}: ${money(v.price, v.currency)}`
      : null,
    typeof v.moq === "number" ? `${labels.moq}: ${n(v.moq, 0)}` : null,
    typeof v.masterBoxQty === "number" || typeof v.innerBoxQty === "number"
      ? `${labels.box}: ${[v.masterBoxQty, v.innerBoxQty]
          .map((q) => (typeof q === "number" ? n(q, 0) : "—"))
          .join(" / ")}`
      : null,
    typeof v.cbm === "number" ? `${labels.cbm}: ${n(v.cbm, 4)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/* ------------------------------------------------------------------------ */
/* Adoção da ficha do pedido na variação                                     */
/* ------------------------------------------------------------------------ */

/** Campos da ficha que, num item com variação, são da VARIAÇÃO (não do produto). */
export const VARIANT_SHEET_FIELDS = [
  "price",
  "currency",
  "moq",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "colorAssortment",
  "material",
  "packageType",
  "factoryItemCode",
  "capacityMl",
] as const satisfies readonly (keyof PurchaseSheet)[];
/** Os comerciais entre eles: só do fornecedor de referência do produto. */
const VARIANT_COMMERCIAL_FIELDS: readonly (keyof PurchaseSheet)[] = [
  "price",
  "currency",
  "moq",
  "factoryItemCode",
];

/** A ficha sem os campos da variação (o que ainda vai para o produto: NCM, energia, container…). */
export function sheetWithoutVariantFields<T extends Partial<PurchaseSheet>>(
  sheet: T,
): Partial<PurchaseSheet> {
  const out: Record<string, unknown> = { ...sheet };
  for (const k of VARIANT_SHEET_FIELDS) delete out[k];
  return out as Partial<PurchaseSheet>;
}

/** Campos da ficha → campos da variação (só os preenchidos). */
export function variantInputFromSheet(
  sheet: Partial<PurchaseSheet>,
  options: { commercial: boolean },
): Partial<VariantInput> {
  const out: Partial<VariantInput> = {};
  const take = (k: keyof PurchaseSheet) =>
    has(sheet[k]) &&
    (options.commercial || !VARIANT_COMMERCIAL_FIELDS.includes(k));
  if (take("price")) out.price = sheet.price;
  if (take("currency"))
    out.currency = sheet.currency === "RMB" ? "CNY" : sheet.currency;
  if (take("moq")) out.moq = sheet.moq;
  if (take("factoryItemCode")) out.factoryItemCode = sheet.factoryItemCode;
  if (take("masterCartonQty")) out.masterBoxQty = sheet.masterCartonQty;
  if (take("innerQty")) out.innerBoxQty = sheet.innerQty;
  if (take("netWeightPcKg")) out.netWeightKg = sheet.netWeightPcKg;
  if (take("grossWeightPcKg")) out.grossWeightKg = sheet.grossWeightPcKg;
  if (take("cbmPerCarton")) out.cbm = sheet.cbmPerCarton;
  if (take("colorAssortment")) out.colorAssortment = sheet.colorAssortment;
  if (take("material")) out.material = sheet.material;
  if (take("packageType")) out.packageType = sheet.packageType;
  if (take("capacityMl")) out.capacityMl = sheet.capacityMl;
  return out;
}

/**
 * Ficha de um pedido (ou cotação) adotada na variação: grava na variação o
 * que a ficha traz (preço, moeda, MOQ, caixa, pesos, CBM, cores, material,
 * embalagem, código, capacidade) e depois o produto espelha a variação de
 * referência (`syncProductFromVariants`). Nunca mexe nas colunas do produto
 * diretamente.
 * - `commercial`: preço, moeda, MOQ e código só do fornecedor de referência.
 * - `overwrite: false`: só completa o que a variação ainda não tem.
 * Devolve os campos gravados (vazio quando nada mudou).
 */
export async function adoptSheetIntoVariant(
  user: User,
  variantId: string,
  sheet: Partial<PurchaseSheet>,
  options: { commercial: boolean; overwrite: boolean },
): Promise<string[]> {
  const { getProductVariant, syncProductFromVariants, updateProductVariant } =
    await import("./product-variants");
  const current = await getProductVariant(variantId);
  if (!current) return [];
  const wanted = variantInputFromSheet(sheet, {
    commercial: options.commercial,
  });
  const input: Partial<VariantInput> = {};
  for (const [k, v] of Object.entries(wanted) as Array<
    [keyof VariantInput, VariantInput[keyof VariantInput]]
  >) {
    const before = current[k as keyof ProductVariant];
    if (!options.overwrite && has(before)) continue;
    if (JSON.stringify(before ?? null) === JSON.stringify(v ?? null)) continue;
    (input as Record<string, unknown>)[k] = v;
  }
  if (!Object.keys(input).length) return [];
  await updateProductVariant(user, variantId, input);
  await syncProductFromVariants(current.productId, user);
  return Object.keys(input);
}

/**
 * Cadastro acompanha a ficha do pedido, versão com variação: no modo
 * "adopt" (pedido criado, ficha salva pela Wellmix) de um item com variação,
 * os campos da variação vão para ela (do fornecedor de referência ou de
 * produto sem principal, atualizando; de outro fornecedor, só completando o
 * que falta, sem dados comerciais) e o resto da ficha (NCM, tributos,
 * energia, container…) segue para o produto como hoje. Sem variação, ou no
 * modo "fill" (fornecedor só completa), é exatamente `completeMasterFromSheet`.
 * Nunca derruba quem chamou: falha fica no log.
 */
export async function completeFromOrderSheet(
  user: User,
  productId: string | null | undefined,
  sheet: Partial<PurchaseSheet>,
  supplierId: string | null | undefined,
  mode: "fill" | "adopt",
  variantId: string | null | undefined,
): Promise<string[]> {
  const { completeMasterFromSheet } = await import("./product-sheet");
  if (!productId) return [];
  if (!variantId || mode !== "adopt")
    return completeMasterFromSheet(user, productId, sheet, supplierId, mode);
  const { getStore } = await import("@/lib/db");
  const product = await getStore().get("products", productId);
  if (!product) return [];
  let changed: string[] = [];
  try {
    const main = !!product.supplierId && product.supplierId === supplierId;
    changed = await adoptSheetIntoVariant(user, variantId, sheet, {
      commercial: main,
      overwrite: main || !product.supplierId,
    });
  } catch (error) {
    console.warn("[variant-sales] adotar a ficha na variação falhou", error);
  }
  const rest = await completeMasterFromSheet(
    user,
    productId,
    sheetWithoutVariantFields(sheet),
    supplierId,
    mode,
  );
  return [...changed, ...rest];
}
