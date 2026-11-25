import "server-only";
import {
  getStore,
  type Order,
  type OrderItem,
  type Party,
  type Product,
  type Request,
  type User,
} from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { can, canSeeMoney } from "@/lib/auth/function-access";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import {
  getPriceForecastAdapter,
  type PriceForecastAdapter,
  type PriceForecastAnswer,
} from "@/lib/integrations/price-forecast";
import {
  isQuoteFresh,
  piecesOf,
  quotePrice,
  saleQuoteKey,
  unitSalePrice,
  type ItemSalePrices,
  type OrderItemSaleQuote,
} from "@/lib/order-sale-quote";
import type { OrderTerms, SaleFormat, WellmixTier } from "@/lib/order-terms";
import { getSettings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { OrderSaleError, recordOrderSale } from "./order-sale";
import { forecastQuery, forecastUnitPrice } from "./request-price-forecast";

/*
 * Preços WD e Wellmix do card "Venda ao cliente" pela cotação V2 do Sankhya
 * (dono, 24/11/2026; docs/ORDER_SALE.md, "Preços pela API"). Para cada
 * produto do pedido, duas cotações (as mesmas da Nova solicitação):
 *
 * - WD: VIP 5, PRECO_WD_COM_FRETE_REFERENCIA;
 * - Wellmix: o VIP do nível do pedido (o da Nova solicitação); sem nível, o
 *   padrão do Sankhya (decisão do dono); PRECO_COM_FRETE_REFERENCIA.
 *
 * Por peça, em R$, com frete. A cotação do dia fica no item
 * (`order_items.saleQuote`) para a próxima visita e a gravação não chamarem o
 * Sankhya de novo; vale no dia (Brasília) e com as mesmas entradas
 * (quantidade, cliente, vendedor, nível, rota e frete). A venda gravada é a
 * do formato escolhido (WD ou Wellmix), recalculada aqui: o número que o
 * navegador mostrou não é aceito.
 */

export type SaleQuoteMode = "api" | "manual";

/** O Sankhya está ligado? Sem ele, o card continua com o preço digitado. */
export async function saleQuoteMode(): Promise<SaleQuoteMode> {
  try {
    const { getSankhyaConfigStatus } =
      await import("@/lib/integrations/sankhya-settings");
    return (await getSankhyaConfigStatus()).config ? "api" : "manual";
  } catch {
    return "manual";
  }
}

/** Quem vê os preços da cotação: a Wellmix que vê valores ou grava a venda. */
export function canSeeSaleQuotes(user: User): boolean {
  return isWellmix(user) && (canSeeMoney(user) || can(user, "sale.record"));
}

/**
 * De onde vêm as condições da cotação de um produto: a solicitação do
 * cliente com as condições escolhidas na Nova solicitação (formato, nível,
 * quem chama o transportador e o frete) e o cliente dela (o RCA vai como
 * vendedor).
 */
export interface SaleQuoteSource {
  terms: OrderTerms | null;
  customer: Party | null;
  requestId: string | null;
}

/** O que as cotações dos itens de um pedido têm em comum. */
export interface SaleQuoteContext {
  order: Order;
  /** As condições do pedido (a 1ª solicitação do cliente com condições). */
  terms: OrderTerms | null;
  customer: Party | null;
  /** A fonte de cada produto: a solicitação do cliente daquele produto. */
  sourceFor: (item: Pick<OrderItem, "productId">) => SaleQuoteSource;
  products: Map<string, Product>;
  defaultFreight: number | null;
  day: string;
  now: Date;
}

const unique = (ids: ReadonlyArray<string | null | undefined>) => [
  ...new Set(ids.filter((v): v is string => !!v)),
];

/**
 * As solicitações do pedido, na ordem: as do cliente que viraram o pedido
 * de compra (`orders.demandIds`: a encomenda ou a reposição, com as
 * condições da Nova solicitação) e, por último, a do próprio pedido
 * (`orders.requestId`; no pedido de compra é a solicitação técnica do
 * fornecedor, sem condições). Correção de 25/11/2026: antes só a do pedido
 * era lida, e a rota (quem chama o transportador) não ia para a cotação.
 */
export async function saleQuoteContext(
  order: Order,
  items: readonly Pick<OrderItem, "productId">[],
  now = new Date(),
): Promise<SaleQuoteContext> {
  const store = getStore();
  const requestIds = unique([...(order.demandIds ?? []), order.requestId]);
  const [requests, products, settings] = await Promise.all([
    listByIds(store, "requests", requestIds),
    listByIds(
      store,
      "products",
      items.map((i) => i.productId),
    ),
    getSettings(),
  ]);
  const byId = new Map(requests.map((r) => [r.id, r]));
  const withTerms = requestIds
    .map((id) => byId.get(id))
    .filter((r): r is Request => !!r?.orderTerms);
  const customers = await listByIds(
    store,
    "parties",
    unique([order.customerId, ...withTerms.map((r) => r.customerId)]),
  );
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const sourceOf = (request: Request | null): SaleQuoteSource => ({
    terms: request?.orderTerms ?? null,
    // O cliente da solicitação (quem compra); sem ela, o do pedido.
    customer:
      (request ? customerById.get(request.customerId) : undefined) ??
      customerById.get(order.customerId) ??
      null,
    requestId: request?.id ?? null,
  });
  const main = sourceOf(withTerms[0] ?? null);
  // Com várias solicitações do cliente no mesmo pedido de compra, cada
  // produto usa a do produto dele (a primeira, na ordem do pedido).
  const byProduct = new Map<string, SaleQuoteSource>();
  for (const r of withTerms)
    if (r.productId && !byProduct.has(r.productId))
      byProduct.set(r.productId, sourceOf(r));
  return {
    order,
    // Os pedidos que vieram do Sankhya não têm condições.
    terms: main.terms,
    customer: main.customer,
    sourceFor: (item) =>
      (item.productId ? byProduct.get(item.productId) : undefined) ?? main,
    products: new Map(products.map((p) => [p.id, p])),
    defaultFreight: settings.deliveryFreightDefaultBrl ?? null,
    day: brazilDay(now) ?? now.toISOString().slice(0, 10),
    now,
  };
}

/** As duas consultas (WD e Wellmix) de um item e a chave das entradas. */
function itemQueries(ctx: SaleQuoteContext, item: OrderItem) {
  const product = item.productId ? ctx.products.get(item.productId) : null;
  if (!product) return null;
  const perBox = item.variant?.masterBoxQty ?? product.masterBoxQty ?? null;
  const qty = piecesOf(item, perBox);
  // As condições da solicitação do cliente deste produto.
  const source = ctx.sourceFor(item);
  // Nível do Wellmix: o da Nova solicitação; sem ele, o padrão do Sankhya.
  const tier: WellmixTier | null = source.terms?.wellmixTier ?? null;
  const query = (format: SaleFormat, t: WellmixTier | null) =>
    forecastQuery({
      product,
      customer: source.customer,
      quantity: qty?.pieces ?? null,
      saleFormat: format,
      tier: t,
      caller: source.terms?.carrierCaller ?? null,
      freight: source.terms?.deliveryFreightBrl ?? null,
      defaultFreight: ctx.defaultFreight,
      now: ctx.now,
    });
  const wd = query("wd", null);
  const wellmix = query("wellmix", tier);
  const key = saleQuoteKey({
    pieces: qty?.pieces ?? null,
    productCode: product.sankhyaCode ?? product.id,
    customerId: wd.customerId,
    sellerCode: wd.sellerCode ?? null,
    tier,
    route: wd.route ?? null,
    freight: wd.deliveryFreightBrl ?? null,
  });
  return { wd, wellmix, key, tier, qty };
}

const pricesOf = (
  item: OrderItem,
  quote: OrderItemSaleQuote,
  qty: { pieces: number; perUnit: number } | null,
): ItemSalePrices => ({
  itemId: item.id,
  wd: quote.wd,
  wellmix: quote.wellmix,
  wdError: null,
  wellmixError: null,
  wellmixTier: quote.wellmixTier,
  pieces: qty?.pieces ?? null,
  perUnit: qty?.perUnit ?? null,
});

/** Os preços guardados hoje, sem chamar o Sankhya (nulo = falta cotar). */
export function cachedItemPrices(
  ctx: SaleQuoteContext,
  item: OrderItem,
): ItemSalePrices | null {
  const q = itemQueries(ctx, item);
  if (!q || !isQuoteFresh(item.saleQuote, ctx.day, q.key)) return null;
  return pricesOf(item, item.saleQuote, q.qty);
}

/** O motivo de um preço não ter vindo (a mensagem do Sankhya ou a situação da cotação). */
function problemOf(answer: PriceForecastAnswer): string {
  if (answer.mode !== "api") return "manual";
  if (answer.kind === "error") return answer.message;
  if (answer.kind === "forecast" && answer.status) return answer.status;
  return "no_price";
}

const statusOf = (answer: PriceForecastAnswer) =>
  answer.mode === "api" && answer.kind === "forecast"
    ? (answer.status ?? null)
    : null;

/**
 * Os preços de um item: a cotação guardada hoje ou, sem ela, as duas
 * cotações no Sankhya (guardadas quando ao menos um preço vem). "manual" =
 * o Sankhya não está ligado.
 */
export async function quoteOrderItem(
  ctx: SaleQuoteContext,
  item: OrderItem,
  adapter: PriceForecastAdapter,
): Promise<ItemSalePrices | "manual"> {
  const q = itemQueries(ctx, item);
  if (!q)
    return {
      itemId: item.id,
      wd: null,
      wellmix: null,
      wdError: "no_product",
      wellmixError: "no_product",
      wellmixTier: null,
      pieces: null,
      perUnit: null,
    };
  if (isQuoteFresh(item.saleQuote, ctx.day, q.key))
    return pricesOf(item, item.saleQuote, q.qty);
  const [wdAnswer, wellmixAnswer] = await Promise.all([
    adapter.forecast(q.wd),
    adapter.forecast(q.wellmix),
  ]);
  if (wdAnswer.mode === "manual" || wellmixAnswer.mode === "manual")
    return "manual";
  const wd = forecastUnitPrice(wdAnswer, "wd")?.price ?? null;
  const wellmix = forecastUnitPrice(wellmixAnswer, "wellmix")?.price ?? null;
  if (wd !== null || wellmix !== null) {
    const quote: OrderItemSaleQuote = {
      day: ctx.day,
      at: ctx.now.toISOString(),
      key: q.key,
      wd,
      wellmix,
      wellmixTier: q.tier,
      wdStatus: statusOf(wdAnswer),
      wellmixStatus: statusOf(wellmixAnswer),
    };
    try {
      await getStore().update("order_items", item.id, { saleQuote: quote });
    } catch (error) {
      // Sem a coluna publicada (ou o banco ocupado): mostra, só não guarda.
      console.warn(
        "[order-sale-quote] cotação não guardada",
        item.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return {
    itemId: item.id,
    wd,
    wellmix,
    wdError: wd === null ? problemOf(wdAnswer) : null,
    wellmixError: wellmix === null ? problemOf(wellmixAnswer) : null,
    wellmixTier: q.tier,
    pieces: q.qty?.pieces ?? null,
    perUnit: q.qty?.perUnit ?? null,
  };
}

/** Roda `task` em cada item, `limit` por vez, na ordem. */
async function inPool<T, R>(
  list: readonly T[],
  limit: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const index = next++;
      results[index] = await task(list[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, worker),
  );
  return results;
}

async function saleOrder(orderId: string) {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderSaleError("not_found");
  if (order.parentOrderId) throw new OrderSaleError("sale_on_parent");
  const items = await store.list("order_items", { filter: { orderId } });
  return { order, items };
}

/**
 * Os preços de alguns itens do pedido (a tela pede aos poucos, sem esperar
 * o Sankhya para abrir o pedido). Só a Wellmix que vê valores ou grava.
 */
export async function orderItemSalePrices(
  user: User,
  orderId: string,
  itemIds: readonly string[],
  options: { adapter?: PriceForecastAdapter; now?: Date } = {},
): Promise<{ mode: SaleQuoteMode; prices: ItemSalePrices[] }> {
  if (!canSeeSaleQuotes(user)) throw new ForbiddenError("sale_forbidden");
  const { order, items } = await saleOrder(orderId);
  const wanted = new Set(itemIds);
  const chosen = items.filter((i) => wanted.has(i.id));
  if (chosen.length !== wanted.size)
    throw new OrderSaleError("sale_unknown_item");
  const ctx = await saleQuoteContext(order, chosen, options.now);
  const adapter = options.adapter ?? getPriceForecastAdapter(false);
  const answers = await inPool(chosen, 2, (item) =>
    quoteOrderItem(ctx, item, adapter),
  );
  if (answers.some((a) => a === "manual"))
    return { mode: "manual", prices: [] };
  return { mode: "api", prices: answers as ItemSalePrices[] };
}

/**
 * Grava a venda pelo formato escolhido (WD ou Wellmix): o preço da cotação
 * do dia de cada produto, em R$ (as que faltam são cotadas aqui). Produto
 * sem preço fica sem venda (a soma fica parcial, como antes).
 */
export async function recordOrderSaleByFormat(
  user: User,
  orderId: string,
  format: SaleFormat,
  options: { adapter?: PriceForecastAdapter; now?: Date } = {},
): Promise<{
  total: number | null;
  complete: boolean;
  changed: boolean;
  missing: number;
}> {
  if (!can(user, "sale.record")) throw new ForbiddenError("sale_forbidden");
  const { order, items } = await saleOrder(orderId);
  if (order.status === "CANCELLED") throw new OrderSaleError("sale_cancelled");
  if (!items.length) throw new OrderSaleError("sale_no_items");
  const ctx = await saleQuoteContext(order, items, options.now);
  const adapter = options.adapter ?? getPriceForecastAdapter(false);
  const answers = await inPool(items, 4, (item) =>
    quoteOrderItem(ctx, item, adapter),
  );
  if (answers.some((a) => a === "manual"))
    throw new OrderSaleError("sale_api_unavailable");
  const prices: Record<string, number | null> = {};
  let missing = 0;
  for (const p of answers as ItemSalePrices[]) {
    const unit = unitSalePrice(quotePrice(p, format), p.perUnit);
    if (unit === null) missing++;
    prices[p.itemId] = unit;
  }
  // Nenhum produto com o preço do formato (o Sankhya fora, por exemplo): não
  // grava, para não apagar a venda que já estava gravada.
  if (missing === items.length) throw new OrderSaleError("sale_no_prices");
  const result = await recordOrderSale(user, orderId, {
    currency: "BRL",
    prices,
    saleFormat: format,
  });
  return { ...result, missing };
}
