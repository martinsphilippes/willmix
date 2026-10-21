import "server-only";

import type { Translate } from "@/i18n";
import { getStore, type Product, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { boxCbm } from "@/lib/logistics/cbm";
import { fxKey, resolveMargin } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { quoteSlaDeadline } from "@/lib/sla";
import {
  estimateCatalogPrice,
  referenceQuantity,
  tierEstimates,
  type CatalogEstimate,
  type CatalogPriceContext,
  type CatalogPriceInput,
} from "./catalog-price-calc";
import { availableStockByProduct } from "./containers";
import { catalogShowcasePhotos } from "./documents";
import { lookupNcm } from "./fiscal";
import { getFxRates } from "./fx";

/*
 * Vitrine do cliente (Explorar): produtos ativos do catálogo, com foto, preço
 * estimado em R$ (conta da proposta com a margem do cliente), pedido mínimo,
 * "em estoque" e "você já comprou". Nunca leva ao cliente o fornecedor, o
 * preço de compra (FOB), o código da fábrica nem as faixas de compra: só o
 * preço ao cliente já calculado. A Wellmix vê a mesma vitrine (margem padrão)
 * e, nos produtos sem preço, o que falta para ele aparecer.
 */

export const EXPLORE_SORTS = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

export interface ExploreProduct {
  id: string;
  name: string;
  category: string | null;
  lineId: string;
  lineName: string | null;
  /** Fotos de vitrine (servidas por /api/files com checagem de acesso). */
  photos: { documentId: string; caption: string }[];
  /** Preço estimado; sem preço, o que falta só aparece para a Wellmix. */
  estimate: CatalogEstimate;
  moq: number | null;
  /** Estoque já no Brasil (container chegado), sem pedido: pronta entrega. */
  inStock: boolean;
  /** Estoque ainda em trânsito (planejado, carregando ou no mar). */
  onTheWay: boolean;
  boughtBefore: boolean;
  createdAt: string;
}

type StockMap = Awaited<ReturnType<typeof availableStockByProduct>>;

/** Pronta entrega só com o que já chegou; o resto está a caminho. */
function stockBadges(stock: StockMap, productId: string) {
  const st = stock.get(productId);
  const arrived = st ? st.quantity - st.inTransit : 0;
  return {
    inStock: arrived > 0,
    onTheWay: !!st && st.inTransit > 0 && arrived <= 0,
  };
}

export interface ExploreLine {
  id: string;
  name: string;
  count: number;
}

/** Busca sem acento e sem maiúscula ("cerâmica" acha "Ceramica"). */
export function normalizeSearch(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

interface PricingData {
  inputs: Map<string, CatalogPriceInput>;
  base: Omit<CatalogPriceContext, "marginPercent">;
  margin: (product: Product) => number;
}

/** Dados da conta de preço para vários produtos de uma vez (sem consulta por produto). */
async function pricingData(
  products: Product[],
  customerId: string | null,
): Promise<PricingData> {
  const store = getStore();
  const ids = products.map((p) => p.id);
  const [settings, fx, sheets, classifications] = await Promise.all([
    getSettings(),
    getFxRates(),
    ids.length
      ? store.list("purchase_sheets", { filter: { orderId: ids } })
      : Promise.resolve([]),
    ids.length
      ? store.list("tax_classifications", {
          filter: { productId: ids, status: "validated" },
        })
      : Promise.resolve([]),
  ]);
  // Alíquotas da tabela TEC/TIPI: uma consulta por NCM distinto.
  const ncms = [...new Set(products.map((p) => p.ncm).filter(Boolean))];
  const rates = new Map(
    await Promise.all(ncms.map(async (n) => [n!, await lookupNcm(n)] as const)),
  );
  const taxOf = (productId: string, key: "II" | "IPI") => {
    const taxes = classifications.find((c) => c.productId === productId)?.taxes;
    const v = taxes?.[key];
    return typeof v === "number" ? v : null;
  };
  const inputs = new Map<string, CatalogPriceInput>();
  for (const p of products) {
    const sheet = sheets.find((s) => s.orderId === p.id) ?? null;
    const table = p.ncm ? (rates.get(p.ncm) ?? null) : null;
    // II e IPI: o que a Wellmix digitou na ficha mestre > tabela pelo NCM >
    // classificação validada do produto (a mesma ordem da proposta).
    const ii =
      sheet?.importTaxPercent ?? table?.ii ?? taxOf(p.id, "II") ?? null;
    const ipi =
      sheet?.ipiPercent ??
      table?.ipi ??
      (table?.ipiNt ? 0 : null) ??
      taxOf(p.id, "IPI") ??
      null;
    const currency = sheet?.currency ?? p.currency;
    // Faixas do cadastro só valem na moeda delas (outra moeda = outra negociação).
    const sameCurrency =
      !!fxKey(currency) && fxKey(currency) === fxKey(p.currency);
    inputs.set(p.id, {
      unitPrice: sheet?.price ?? p.price,
      currency,
      tiers: sameCurrency ? p.priceTiers : null,
      moq: sheet?.moq ?? p.moq,
      masterCartonQty: sheet?.masterCartonQty ?? p.masterBoxQty,
      // CBM da caixa master: da ficha; senão o do cadastro ou das medidas da caixa.
      cbmPerCarton: sheet?.cbmPerCarton ?? boxCbm(p),
      importTaxPercent: ii,
      ipiPercent: ipi,
    });
  }
  return {
    inputs,
    base: {
      fx: fx.rates,
      insurancePercent: settings.insurancePercent,
      pisPercent: settings.pisImportPercent,
      cofinsPercent: settings.cofinsImportPercent,
      icmsPercent: settings.icmsPercent,
      freightPerCbm: settings.freightPerCbm,
      freightCurrency: settings.freightCurrency,
    },
    margin: (p) => resolveMargin(settings, customerId, p.lineId).percent,
  };
}

/** Cliente vê só "sem preço"; o motivo (o que falta no cadastro) é da Wellmix. */
function forViewer(user: User, estimate: CatalogEstimate): CatalogEstimate {
  if (estimate.ok || isWellmix(user)) return estimate;
  return { ok: false, missing: [] };
}

/** Quem pode abrir a vitrine: o cliente (com empresa) e a Wellmix (visão do cliente). */
export function canExplore(user: User): boolean {
  return isWellmix(user) || (user.role === "customer" && !!user.partyId);
}

/** Produtos que este login já comprou (pedidos dele, não cancelados). */
async function boughtProductIds(user: User): Promise<Set<string>> {
  if (user.role !== "customer" || !user.partyId) return new Set();
  const store = getStore();
  const orders = (
    await store.list("orders", { filter: { customerId: user.partyId } })
  ).filter((o) => o.requestedByUserId === user.id && o.status !== "CANCELLED");
  if (!orders.length) return new Set();
  const requests = await store.list("requests", {
    filter: { id: [...new Set(orders.map((o) => o.requestId))] },
  });
  return new Set(
    requests.map((r) => r.productId).filter((id): id is string => !!id),
  );
}

export interface ExploreFilters {
  q?: string | null;
  lineId?: string | null;
  sort?: ExploreSort | null;
}

export async function exploreCatalog(
  user: User,
  filters: ExploreFilters = {},
): Promise<{ items: ExploreProduct[]; lines: ExploreLine[]; total: number }> {
  if (!canExplore(user)) return { items: [], lines: [], total: 0 };
  const store = getStore();
  const [products, lines] = await Promise.all([
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
  ]);
  const customerId = user.role === "customer" ? user.partyId : null;
  const [pricing, showcase, stock, bought] = await Promise.all([
    pricingData(products, customerId),
    catalogShowcasePhotos(products.map((p) => p.id)),
    availableStockByProduct(),
    boughtProductIds(user),
  ]);
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const all: ExploreProduct[] = products.map((p) => {
    const input = pricing.inputs.get(p.id)!;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      lineId: p.lineId,
      lineName: lineName.get(p.lineId) ?? null,
      photos: (showcase.get(p.id) ?? []).map((ph) => ({
        documentId: ph.documentId,
        caption: ph.caption?.trim() || p.name,
      })),
      estimate: forViewer(
        user,
        estimateCatalogPrice(input, {
          ...pricing.base,
          marginPercent: pricing.margin(p),
        }),
      ),
      moq: input.moq,
      ...stockBadges(stock, p.id),
      boughtBefore: bought.has(p.id),
      createdAt: p.createdAt,
    };
  });
  // Categorias (linhas) com quantos produtos cada uma tem, antes do filtro de linha.
  const q = normalizeSearch(filters.q);
  const matches = (p: ExploreProduct) => {
    if (!q) return true;
    const product = products.find((x) => x.id === p.id)!;
    const hay = normalizeSearch(
      [p.name, p.category, p.lineName, product.sku, product.material]
        .filter(Boolean)
        .join(" "),
    );
    return q.split(/\s+/).every((word) => hay.includes(word));
  };
  const searched = all.filter(matches);
  const counts = new Map<string, number>();
  for (const p of searched)
    counts.set(p.lineId, (counts.get(p.lineId) ?? 0) + 1);
  const lineList: ExploreLine[] = lines
    .filter((l) => counts.has(l.id))
    .map((l) => ({ id: l.id, name: l.name, count: counts.get(l.id)! }));
  const filtered = filters.lineId
    ? searched.filter((p) => p.lineId === filters.lineId)
    : searched;
  const price = (p: ExploreProduct) =>
    p.estimate.ok ? p.estimate.unitBrl : null;
  const sort = filters.sort ?? "relevance";
  const items = [...filtered].sort((a, b) => {
    if (sort === "price_asc" || sort === "price_desc") {
      // Sem preço sempre no fim, nas duas ordens.
      const pa = price(a);
      const pb = price(b);
      if (pa === null || pb === null)
        return pa === null && pb === null ? 0 : pa === null ? 1 : -1;
      return sort === "price_asc" ? pa - pb : pb - pa;
    }
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    // Relevância: já comprados, com foto e com preço primeiro; depois o nome.
    const rank = (p: ExploreProduct) =>
      (p.boughtBefore ? 4 : 0) +
      (p.photos.length ? 2 : 0) +
      (p.estimate.ok ? 1 : 0);
    return rank(b) - rank(a) || a.name.localeCompare(b.name);
  });
  return { items, lines: lineList, total: all.length };
}

export interface ExploreProductDetail extends ExploreProduct {
  /** Preço por faixa de quantidade (vazio quando não muda). */
  tiers: { minQty: number; unitBrl: number }[];
  /** Linhas da especificação ("Material: vidro"). */
  specification: string[];
  /** Data limite da proposta da Wellmix (prazo de cotação). */
  proposalBy: string;
}

/** Especificação do cadastro, ou montada das colunas (como na solicitação). */
export function specificationLines(product: Product, t: Translate): string[] {
  if (product.specification?.trim())
    return product.specification
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  const dims =
    product.lengthCm !== null &&
    product.widthCm !== null &&
    product.heightCm !== null
      ? `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} cm`
      : null;
  return [
    product.material ? `${t("catalog.material")}: ${product.material}` : null,
    product.color ? `${t("catalog.color")}: ${product.color}` : null,
    product.pantone ? `${t("catalog.pantone")}: ${product.pantone}` : null,
    dims ? `${t("catalog.dimensions")}: ${dims}` : null,
    product.netWeightKg !== null
      ? `${t("catalog.netWeight")}: ${product.netWeightKg}`
      : null,
    product.masterBoxQty !== null
      ? `${t("catalog.masterBoxQty")}: ${product.masterBoxQty}`
      : null,
  ].filter((l): l is string => !!l);
}

export async function exploreProduct(
  user: User,
  productId: string,
  t: Translate,
): Promise<ExploreProductDetail | null> {
  if (!canExplore(user)) return null;
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product?.active) return null;
  const customerId = user.role === "customer" ? user.partyId : null;
  const [pricing, showcase, stock, bought, line, settings] = await Promise.all([
    pricingData([product], customerId),
    catalogShowcasePhotos([product.id]),
    availableStockByProduct(),
    boughtProductIds(user),
    store.get("product_lines", product.lineId),
    getSettings(),
  ]);
  const input = pricing.inputs.get(product.id)!;
  const ctx = { ...pricing.base, marginPercent: pricing.margin(product) };
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    lineId: product.lineId,
    lineName: line?.name ?? null,
    photos: (showcase.get(product.id) ?? []).map((ph) => ({
      documentId: ph.documentId,
      caption: ph.caption?.trim() || product.name,
    })),
    estimate: forViewer(user, estimateCatalogPrice(input, ctx)),
    moq: input.moq,
    ...stockBadges(stock, product.id),
    boughtBefore: bought.has(product.id),
    createdAt: product.createdAt,
    tiers: tierEstimates(input, ctx),
    specification: specificationLines(product, t),
    proposalBy: quoteSlaDeadline(settings.quoteSlaBusinessDays),
  };
}

/**
 * Preço estimado de vários produtos para quantidades específicas (carrinho):
 * a faixa de preço vale pela quantidade de cada linha. Junto, o pedido mínimo
 * da mesma fonte da vitrine (ficha mestre ou cadastro).
 */
export async function estimateForQuantities(
  user: User,
  lines: { productId: string; quantity: number }[],
): Promise<Map<string, { estimate: CatalogEstimate; moq: number | null }>> {
  const store = getStore();
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = ids.length
    ? await store.list("products", { filter: { id: ids } })
    : [];
  const customerId = user.role === "customer" ? user.partyId : null;
  const pricing = await pricingData(products, customerId);
  const out = new Map<
    string,
    { estimate: CatalogEstimate; moq: number | null }
  >();
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    const input = product ? pricing.inputs.get(product.id) : undefined;
    if (!product || !input) {
      out.set(line.productId, {
        estimate: { ok: false, missing: [] },
        moq: null,
      });
      continue;
    }
    out.set(line.productId, {
      estimate: forViewer(
        user,
        estimateCatalogPrice(
          input,
          { ...pricing.base, marginPercent: pricing.margin(product) },
          line.quantity,
        ),
      ),
      moq: input.moq,
    });
  }
  return out;
}

/**
 * Quem compra na vitrine: o cliente com empresa, com "Cliente pode criar
 * solicitação" ligado nas Configurações (desligado, ele só vê o catálogo).
 */
export async function canBuyOnStorefront(user: User): Promise<boolean> {
  if (user.role !== "customer" || !user.partyId) return false;
  return (await getSettings()).customerCanCreateRequest;
}

export { referenceQuantity };
