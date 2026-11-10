import "server-only";

import {
  getStore,
  type BookingItem,
  type Product,
  type PurchaseSheet,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { computeSuperplan, superplanParams } from "@/lib/superplan";
import {
  defaultSuperplanInput,
  snapshotOf,
  type SuperplanContext,
  type SuperplanPrefill,
  type SuperplanSnapshot,
} from "@/lib/superplan-defaults";
import { lookupNcm, type NcmRates } from "./fiscal";
import { getFxRates } from "./fx";
import { productPurchaseView } from "./product-sheet";

/*
 * Superplan no servidor (docs/SUPERPLAN.md): o que a tela recebe do sistema
 * (parâmetros, containers, câmbio do dia e tributos da importação), os dados
 * de cada produto para a simulação e a análise de vários produtos de uma vez
 * com os valores padrão (a mesma conta que a tela mostra ao abrir o produto,
 * sem edição). A tela do Superplan e o Booking passam por aqui: um caminho só.
 *
 * Só leitura: nada aqui grava. Quem chama confere a permissão (a tela, com
 * `requireScreen("superplan")`; o Booking, com a tela Superplan de quem
 * analisa).
 */

/**
 * O que a simulação recebe do sistema. `formatDay` troca o dia da cotação
 * (AAAA-MM-DD) pelo texto que a tela mostra; sem ele, o dia fica como veio.
 */
export async function loadSuperplanContext(
  options: { formatDay?: (isoDay: string) => string } = {},
): Promise<SuperplanContext> {
  const [settings, fx] = await Promise.all([getSettings(), getFxRates()]);
  const usd = fx.rates.USD ?? null;
  const rmb = fx.rates.RMB ?? null;
  const containers = settings.containerTypes
    .filter((c) => c.capacityCbm > 0 && c.code)
    .map((c) => ({
      code: c.code,
      capacityCbm: c.capacityCbm,
      maxWeightKg: c.maxWeightKg,
    }));
  // Dia da cotação do dólar (AAAA-MM-DD no começo), sem depender do fuso.
  const fxDay =
    /^\d{4}-\d{2}-\d{2}/.exec(fx.quotedAt.USD ?? fx.day ?? "")?.[0] ?? null;
  return {
    params: superplanParams(settings.superplan),
    containers,
    // Padrão: 40HC; sem ele, o maior container cadastrado.
    defaultContainer: containers.some((c) => c.code === "40HC")
      ? "40HC"
      : ([...containers].sort((a, b) => b.capacityCbm - a.capacityCbm)[0]
          ?.code ?? null),
    official: usd,
    rmbPerUsd: usd && rmb ? usd / rmb : null,
    fxDate: fxDay ? (options.formatDay?.(fxDay) ?? fxDay) : null,
    fxStatus: usd ? fx.status : "none",
    insurancePct: settings.insurancePercent ?? 0,
    pisImportPct: settings.pisImportPercent ?? 0,
    cofinsImportPct: settings.cofinsImportPercent ?? 0,
    icmsImportPct: settings.icmsPercent ?? null,
  };
}

/**
 * Dados de um produto para a simulação, mais o que a tela só mostra:
 * `ncmFound` (II e IPI conhecidos; sem eles a conta usa 0) e `averageUsd` (a
 * média do despachante, da ficha mestre: só informação, não entra na conta).
 */
export type SuperplanProductPrefill = SuperplanPrefill & {
  ncmFound: boolean;
  averageUsd: number | null;
  /** Peso médio por peça (kg), da ficha mestre: mostrado, fora da conta. */
  averageWeightKg: number | null;
};

const positive = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
const text = (s: string | null | undefined): string | null =>
  typeof s === "string" && s.trim() ? s.trim() : null;

/** NCM do produto: o do cadastro; sem ele, o da ficha mestre. */
const ncmOf = (product: Product, sheet: PurchaseSheet | null) =>
  text(product.ncm) ?? text(sheet?.ncm);

function prefillOf(
  product: Product,
  sheet: PurchaseSheet | null,
  rates: NcmRates | null,
): SuperplanProductPrefill {
  // O que se compra, lido do mesmo jeito que a linha do Booking mostra
  // (`productPurchaseView`): preço e moeda da mesma fonte (cadastro; sem
  // preço nele, ficha mestre), peças por caixa, volume e os pesos (o líquido
  // nunca vira bruto).
  const view = productPurchaseView(product, sheet);
  const price = view.price;
  const currency = (view.currency ?? "").toUpperCase();
  const known = currency === "USD" || currency === "CNY" || currency === "RMB";
  // II e IPI: o que a Wellmix digitou na ficha mestre; senão a tabela fiscal
  // pelo NCM (IPI "NT" = 0%), como no preço da vitrine e da proposta.
  const iiPct = sheet?.importTaxPercent ?? rates?.ii ?? null;
  const ipiPct =
    sheet?.ipiPercent ??
    (rates ? (rates.ipiNt ? 0 : (rates.ipi ?? null)) : null);
  return {
    productId: product.id,
    productName: [product.sku, product.name].filter(Boolean).join(" · "),
    unitPrice: known ? price : null,
    currency: currency === "USD" ? "USD" : "RMB",
    otherCurrency: price !== null && currency && !known ? currency : null,
    pcsPerCarton: view.pcsPerCarton,
    netWeightPcKg: view.netWeightPcKg,
    grossWeightPcKg: view.grossWeightPcKg,
    cbmPerCarton: view.cbmPerCarton,
    ncm: ncmOf(product, sheet),
    iiPct,
    ipiPct,
    ncmFound: iiPct !== null && ipiPct !== null,
    averageUsd: positive(sheet?.averagePrice),
    averageWeightKg: positive(sheet?.averageWeightPcKg),
  };
}

/**
 * Dados dos produtos para a simulação, em lote: uma consulta de produtos, uma
 * de fichas mestre (`purchase_sheets` com `orderId` = id do produto) e uma
 * busca na tabela fiscal por NCM distinto. Produto que não existe fica fora
 * do mapa; o desativado também, a não ser com `includeInactive` (a tela do
 * Superplan abre um produto desativado pelo endereço, como sempre abriu).
 */
export async function superplanPrefillsFor(
  productIds: string[],
  options: { includeInactive?: boolean } = {},
): Promise<Map<string, SuperplanProductPrefill>> {
  const ids = [
    ...new Set(productIds.filter((id) => typeof id === "string" && id)),
  ];
  const out = new Map<string, SuperplanProductPrefill>();
  if (!ids.length) return out;
  const store = getStore();
  const [rows, sheets] = await Promise.all([
    store.list("products", { filter: { id: ids } }),
    store.list("purchase_sheets", { filter: { orderId: ids } }),
  ]);
  const products = rows.filter((p) => options.includeInactive || p.active);
  const sheetOf = new Map<string, PurchaseSheet>();
  for (const sheet of sheets)
    if (!sheetOf.has(sheet.orderId)) sheetOf.set(sheet.orderId, sheet);
  const ncms = [
    ...new Set(
      products
        .map((p) => ncmOf(p, sheetOf.get(p.id) ?? null))
        .filter((n): n is string => !!n),
    ),
  ];
  const rates = new Map(
    await Promise.all(ncms.map(async (n) => [n, await lookupNcm(n)] as const)),
  );
  for (const product of products) {
    const sheet = sheetOf.get(product.id) ?? null;
    const ncm = ncmOf(product, sheet);
    out.set(
      product.id,
      prefillOf(product, sheet, ncm ? (rates.get(ncm) ?? null) : null),
    );
  }
  return out;
}

/**
 * Análise de vários produtos com os valores padrão: para cada um, a conta que
 * a tela do Superplan mostra ao abrir o produto sem editar nada (tipo de
 * negócio, container e frete padrão, câmbio do dia, preço de venda = o preço
 * mínimo), como retrato. Produto desativado ou que não existe fica fora.
 */
export async function analyzeProductsWithDefaults(
  productIds: string[],
): Promise<Map<string, SuperplanSnapshot>> {
  const [ctx, prefills] = await Promise.all([
    loadSuperplanContext(),
    superplanPrefillsFor(productIds),
  ]);
  const out = new Map<string, SuperplanSnapshot>();
  for (const [id, prefill] of prefills) {
    const { input, businessType, container } = defaultSuperplanInput(
      prefill,
      ctx,
    );
    const snapshot = snapshotOf(input, computeSuperplan(input), {
      businessType,
      container,
      ncmFound: prefill.ncmFound,
    });
    // Preço do cadastro em outra moeda (EUR, BRL): o que falta não é o
    // preço, é informá-lo em RMB ou US$; a tela diz isso.
    if (prefill.otherCurrency)
      snapshot.missing = snapshot.missing.map((m) =>
        m === "price" ? "currency" : m,
      );
    out.set(id, snapshot);
  }
  return out;
}

/**
 * Dados de um item de booking (docs/BOOKING.md, "Booking por planilha") para
 * a simulação. O item não é produto e não tem NCM: II e IPI ficam fora
 * (`ncmFound` falso, a conta usa 0, como num produto sem NCM).
 */
export function bookingItemPrefill(item: BookingItem): SuperplanProductPrefill {
  const currency = (item.currency ?? "").toUpperCase();
  const known = currency === "USD" || currency === "RMB";
  const price = positive(item.price);
  return {
    productId: null,
    productName:
      [item.factoryItemCode, item.description ?? item.productName]
        .filter(Boolean)
        .join(" · ") || null,
    unitPrice: known ? price : null,
    currency: currency === "USD" ? "USD" : "RMB",
    otherCurrency: price !== null && currency && !known ? currency : null,
    pcsPerCarton: positive(item.masterCartonQty),
    netWeightPcKg: positive(item.netWeightPcKg),
    grossWeightPcKg: positive(item.grossWeightPcKg),
    cbmPerCarton: positive(item.cbmPerCarton),
    ncm: null,
    iiPct: null,
    ipiPct: null,
    ncmFound: false,
    averageUsd: null,
    averageWeightKg: null,
  };
}

/**
 * Análise dos itens de um booking com os valores padrão do Superplan (a
 * mesma conta de `analyzeProductsWithDefaults`); `businessType` vazio ou
 * desconhecido = o padrão dos parâmetros.
 */
export async function analyzeBookingItems(
  items: BookingItem[],
  options: { businessType?: string | null } = {},
): Promise<Map<string, SuperplanSnapshot>> {
  const ctx = await loadSuperplanContext();
  const out = new Map<string, SuperplanSnapshot>();
  for (const item of items) {
    const prefill = bookingItemPrefill(item);
    const { input, businessType, container } = defaultSuperplanInput(
      prefill,
      ctx,
      { businessType: options.businessType ?? undefined },
    );
    const snapshot = snapshotOf(input, computeSuperplan(input), {
      businessType,
      container,
      ncmFound: false,
    });
    if (prefill.otherCurrency)
      snapshot.missing = snapshot.missing.map((m) =>
        m === "price" ? "currency" : m,
      );
    out.set(item.id, snapshot);
  }
  return out;
}

/** Nomes dos tipos de negócio do Superplan e o padrão (seletor ao fechar o booking). */
export async function superplanBusinessTypes(): Promise<{
  names: string[];
  defaultName: string;
}> {
  const params = superplanParams((await getSettings()).superplan);
  return {
    names: params.businessTypes.map((t) => t.name),
    defaultName: params.defaultBusinessType,
  };
}
