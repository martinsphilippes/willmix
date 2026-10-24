import "server-only";

import type { Translate } from "@/i18n";
import {
  getStore,
  type Product,
  type ProductVariant,
  type User,
} from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { boxCbm } from "@/lib/logistics/cbm";
import { effectiveMoq } from "@/lib/moq";
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
import { variantsByProduct } from "./product-variants";

/*
 * Vitrine do cliente (Explorar): produtos ativos do catálogo, com foto, preço
 * estimado em R$ (conta da proposta com a margem do cliente), pedido mínimo,
 * "em estoque" e "você já comprou". Nunca leva ao cliente o fornecedor, o
 * preço de compra (FOB), o código da fábrica nem as faixas de compra: só o
 * preço ao cliente já calculado. A Wellmix vê a mesma vitrine (margem padrão)
 * e, nos produtos sem preço, o que falta para ele aparecer.
 *
 * Produto com variações (docs/PRODUCT_VARIANTS.md): cada variação ativa tem a
 * própria conta (preço, moeda, MOQ, caixa e CBM dela; II/IPI e faixas são do
 * produto), o cartão mostra "a partir de" (a menor) e a página lista as
 * variações para o cliente escolher. O preço do produto em si continua o da
 * variação de referência (a fase 1 espelha nas colunas e na ficha mestre).
 */

export const EXPLORE_SORTS = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

/** Variação de um produto como o cliente a vê (sem fornecedor, FOB, moeda nem código). */
export interface ExploreVariant {
  id: string;
  name: string;
  /** Pedido mínimo que vale para ela (variação > ficha mestre > cadastro). */
  moq: number | null;
  /** Preço estimado da variação (mesma conta e mesmo filtro do produto). */
  estimate: CatalogEstimate;
  /** Foto da variação (servida por /api/files com checagem de acesso). */
  photoDocumentId: string | null;
}

/** Na página do produto: também as linhas da especificação da variação. */
export interface ExploreVariantDetail extends ExploreVariant {
  /** "Tamanho: 8X10", "Cores: White / Gray", "Unidades por caixa master: 24". */
  specification: string[];
}

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
  /** Variações ativas (vazio no produto sem variações): o cliente escolhe uma. */
  variants: ExploreVariant[];
  /** Menor preço estimado entre as variações ("a partir de"); nulo sem variação com preço. */
  priceFrom: number | null;
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

/**
 * Chave de uma linha do carrinho: produto + variação. Duas variações do mesmo
 * produto são linhas distintas, cada uma com o próprio preço e mínimo.
 */
export function lineKey(productId: string, variantId?: string | null): string {
  return `${productId}:${variantId ?? ""}`;
}

type VariantMap = Map<string, ProductVariant[]>;

interface PricingData {
  inputs: Map<string, CatalogPriceInput>;
  /** Conta por variação (pelo id dela), nas bases do produto dono. */
  variantInputs: Map<string, CatalogPriceInput>;
  base: Omit<CatalogPriceContext, "marginPercent">;
  margin: (product: Product) => number;
}

/** Dados da conta de preço para vários produtos de uma vez (sem consulta por produto). */
async function pricingData(
  products: Product[],
  customerId: string | null,
  variants: VariantMap = new Map(),
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
  const variantInputs = new Map<string, CatalogPriceInput>();
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
    const sameCurrency = (c: string | null) =>
      !!fxKey(c) && fxKey(c) === fxKey(p.currency);
    const input: CatalogPriceInput = {
      unitPrice: sheet?.price ?? p.price,
      currency,
      tiers: sameCurrency(currency) ? p.priceTiers : null,
      moq: sheet?.moq ?? p.moq,
      masterCartonQty: sheet?.masterCartonQty ?? p.masterBoxQty,
      // CBM da caixa master: da ficha; senão o do cadastro ou das medidas da caixa.
      cbmPerCarton: sheet?.cbmPerCarton ?? boxCbm(p),
      importTaxPercent: ii,
      ipiPercent: ipi,
    };
    inputs.set(p.id, input);
    // Variações: preço, moeda, MOQ, caixa e CBM da variação; II, IPI e faixas
    // do produto (as faixas só valem se batem com o preço dela, como sempre).
    // Caixa e CBM que a variação não tem caem no que o produto usa (ficha
    // mestre/cadastro); as medidas da peça nunca viram CBM da caixa (a conta
    // sairia menor que a real).
    for (const v of variants.get(p.id) ?? []) {
      const vCurrency = v.currency ?? currency;
      variantInputs.set(v.id, {
        unitPrice: v.price,
        currency: vCurrency,
        tiers: sameCurrency(vCurrency) ? p.priceTiers : null,
        moq: effectiveMoq(v.moq, sheet?.moq, p.moq),
        masterCartonQty: v.masterBoxQty ?? input.masterCartonQty,
        cbmPerCarton: v.cbm ?? input.cbmPerCarton,
        importTaxPercent: ii,
        ipiPercent: ipi,
      });
    }
  }
  return {
    inputs,
    variantInputs,
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

/**
 * Variações do produto como o cliente as vê: só id, nome, mínimo, preço
 * estimado (já filtrado) e foto. Fornecedor, FOB, moeda e código de fábrica
 * ficam de fora por construção.
 */
function exploreVariants(
  user: User,
  product: Product,
  list: ProductVariant[],
  pricing: PricingData,
): ExploreVariant[] {
  const ctx = { ...pricing.base, marginPercent: pricing.margin(product) };
  return list.flatMap((v) => {
    const input = pricing.variantInputs.get(v.id);
    if (!input) return [];
    return [
      {
        id: v.id,
        name: v.name,
        moq: input.moq,
        estimate: forViewer(user, estimateCatalogPrice(input, ctx)),
        photoDocumentId: v.photoDocumentId ?? null,
      },
    ];
  });
}

/** "A partir de": o menor preço estimado entre as variações; nulo sem nenhum. */
function priceFrom(variants: ExploreVariant[]): number | null {
  const prices = variants.flatMap((v) =>
    v.estimate.ok ? [v.estimate.unitBrl] : [],
  );
  return prices.length ? Math.min(...prices) : null;
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
  const ids = products.map((p) => p.id);
  // Variações ativas de todos os produtos numa consulta só (nunca por produto).
  const [variants, showcase, stock, bought] = await Promise.all([
    variantsByProduct(ids),
    catalogShowcasePhotos(ids),
    availableStockByProduct(),
    boughtProductIds(user),
  ]);
  const pricing = await pricingData(products, customerId, variants);
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const all: ExploreProduct[] = products.map((p) => {
    const input = pricing.inputs.get(p.id)!;
    const list = exploreVariants(user, p, variants.get(p.id) ?? [], pricing);
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
      variants: list,
      priceFrom: priceFrom(list),
    };
  });
  // Categorias (linhas) com quantos produtos cada uma tem, antes do filtro de linha.
  const q = normalizeSearch(filters.q);
  const matches = (p: ExploreProduct) => {
    if (!q) return true;
    const product = products.find((x) => x.id === p.id)!;
    // O nome das variações também conta ("A4" acha o porta-retrato).
    const hay = normalizeSearch(
      [
        p.name,
        p.category,
        p.lineName,
        product.sku,
        product.material,
        ...p.variants.map((v) => v.name),
      ]
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
  // Com variações, o preço do cartão é o "a partir de".
  const price = (p: ExploreProduct) =>
    p.priceFrom ?? (p.estimate.ok ? p.estimate.unitBrl : null);
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
      (price(p) !== null ? 1 : 0);
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
  variants: ExploreVariantDetail[];
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

/**
 * Especificação de uma variação (página do produto e solicitação): tamanho,
 * cores, material, medidas, peso, caixa e embalagem. Sem preço, moeda nem
 * código de fábrica (o cliente não os vê).
 */
export function variantSpecificationLines(
  v: Pick<
    ProductVariant,
    | "sizeText"
    | "colorAssortment"
    | "material"
    | "lengthCm"
    | "widthCm"
    | "heightCm"
    | "netWeightKg"
    | "masterBoxQty"
    | "packageType"
  >,
  t: Translate,
): string[] {
  const dims =
    v.lengthCm !== null && v.widthCm !== null && v.heightCm !== null
      ? `${v.lengthCm} × ${v.widthCm} × ${v.heightCm} cm`
      : null;
  return [
    v.sizeText ? `${t("productVariants.col.size")}: ${v.sizeText}` : null,
    v.colorAssortment
      ? `${t("productVariants.col.colors")}: ${v.colorAssortment}`
      : null,
    v.material ? `${t("catalog.material")}: ${v.material}` : null,
    dims ? `${t("catalog.dimensions")}: ${dims}` : null,
    v.netWeightKg !== null
      ? `${t("catalog.netWeight")}: ${v.netWeightKg}`
      : null,
    v.masterBoxQty !== null
      ? `${t("catalog.masterBoxQty")}: ${v.masterBoxQty}`
      : null,
    v.packageType
      ? `${t("productVariants.field.packageType")}: ${v.packageType}`
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
  const [variants, showcase, stock, bought, line, settings] = await Promise.all(
    [
      variantsByProduct([product.id]),
      catalogShowcasePhotos([product.id]),
      availableStockByProduct(),
      boughtProductIds(user),
      store.get("product_lines", product.lineId),
      getSettings(),
    ],
  );
  const pricing = await pricingData([product], customerId, variants);
  const input = pricing.inputs.get(product.id)!;
  const ctx = { ...pricing.base, marginPercent: pricing.margin(product) };
  const rows = variants.get(product.id) ?? [];
  const list = exploreVariants(user, product, rows, pricing).map((v) => ({
    ...v,
    specification: variantSpecificationLines(
      rows.find((r) => r.id === v.id)!,
      t,
    ),
  }));
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
    variants: list,
    priceFrom: priceFrom(list),
    tiers: tierEstimates(input, ctx),
    specification: specificationLines(product, t),
    proposalBy: quoteSlaDeadline(settings.quoteSlaBusinessDays),
  };
}

/**
 * Preço estimado de várias linhas (produto + variação) para quantidades
 * específicas (carrinho): a faixa de preço vale pela quantidade de cada
 * linha. Junto, o pedido mínimo da mesma fonte da vitrine (variação, ficha
 * mestre ou cadastro). O resultado é por `lineKey(productId, variantId)`;
 * linha cuja variação sumiu ou foi desativada fica sem preço.
 */
export async function estimateForQuantities(
  user: User,
  lines: { productId: string; variantId?: string | null; quantity: number }[],
): Promise<Map<string, { estimate: CatalogEstimate; moq: number | null }>> {
  const store = getStore();
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = ids.length
    ? await store.list("products", { filter: { id: ids } })
    : [];
  const customerId = user.role === "customer" ? user.partyId : null;
  const variants = await variantsByProduct(products.map((p) => p.id));
  const pricing = await pricingData(products, customerId, variants);
  const out = new Map<
    string,
    { estimate: CatalogEstimate; moq: number | null }
  >();
  for (const line of lines) {
    const key = lineKey(line.productId, line.variantId);
    const product = products.find((p) => p.id === line.productId);
    const input = !product
      ? undefined
      : line.variantId
        ? pricing.variantInputs.get(line.variantId)
        : pricing.inputs.get(product.id);
    if (!product || !input) {
      out.set(key, { estimate: { ok: false, missing: [] }, moq: null });
      continue;
    }
    out.set(key, {
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
