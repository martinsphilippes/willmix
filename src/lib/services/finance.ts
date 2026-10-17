import "server-only";

import { getStore, type Order, type Payment } from "@/lib/db";
import { fxKey, rateFor, type FxRates } from "@/lib/pricing";
import type { FxStatus } from "./fx";
import type { PricingRecord } from "./quote-pricing";

/**
 * Visão financeira por pedido, derivada dos lançamentos já existentes:
 * - venda ao cliente (sellPrice/sellCurrency) e recebimentos (payments customer_in);
 * - custo FOB (fobTotal/fobCurrency) e pagamentos ao fornecedor (payments supplier_out).
 * Custo na moeda da venda: o que já foi pago vale o câmbio real informado em
 * cada pagamento; o que falta pagar (ou tudo, antes do primeiro pagamento) é
 * estimado pelo câmbio do dia e sinalizado (`estimated`, "~"). Sem câmbio do
 * dia, o saldo usa a média do que já foi pago; sem nada disso, "câmbio pendente".
 * Com o câmbio da venda (gravado na proposta), mostra o efeito do câmbio na
 * margem desde a venda.
 */
/** Arredonda para centavos (resto de conta em ponto flutuante não conta). */
const cents = (n: number) => Math.round(n * 100) / 100;

export interface OrderFinance {
  order: Order;
  customerName: string;
  supplierName: string;
  productName: string;
  sellCurrency: string;
  sell: number;
  received: number;
  receivable: number;
  fobCurrency: string;
  fob: number;
  paid: number;
  payable: number;
  /** Custo do fornecedor convertido para a moeda de venda (normalmente BRL). */
  cost: number | null;
  /** Câmbio médio real dos pagamentos que informaram câmbio. */
  avgFx: number | null;
  estimated: boolean;
  /**
   * Como o custo foi convertido: mesma moeda; câmbio real dos pagamentos;
   * real no que foi pago e estimado no saldo; só estimado (nada pago).
   */
  fxBasis: "same" | "paid" | "partial" | "estimate" | null;
  /** Câmbio usado na parte estimada e de onde veio (dia do câmbio ou média paga). */
  estimateRate: number | null;
  estimateFrom: "today" | "stale" | "manual" | "paid" | null;
  estimateDay: string | null;
  /** Câmbio da venda (moeda do FOB → moeda da venda), gravado na proposta. */
  saleFx: number | null;
  /** Margem se o custo fosse todo ao câmbio da venda. */
  marginAtSale: number | null;
  /** Ganho (+) ou perda (−) de margem por causa do câmbio desde a venda. */
  fxEffect: number | null;
  margin: number | null;
  marginPct: number | null;
}

/** Câmbio do dia (R$ por unidade de cada moeda), para estimar o que falta pagar. */
export interface FxToday {
  rates: FxRates;
  status: FxStatus;
  day: string | null;
}

/** Câmbio entre duas moedas pelas cotações em reais (nulo se faltar alguma). */
export function crossRate(
  rates: FxRates,
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const a = rateFor(rates, from);
  const b = rateFor(rates, to);
  return a !== null && b !== null && b > 0 ? a / b : null;
}

const sameCurrency = (a: string, b: string) =>
  a === b || (fxKey(a) !== null && fxKey(a) === fxKey(b));

/**
 * Câmbio da venda (moeda do FOB → moeda da venda) gravado na proposta: o da
 * ficha usado no preço (R$ por unidade) e, venda fora de reais, o usado para
 * levar o valor à moeda da proposta. Nulo se a proposta não bate com o pedido.
 */
export function saleFxFromRecord(
  record: PricingRecord | null | undefined,
  fobCurrency: string,
  sellCurrency: string,
): number | null {
  if (!record) return null;
  const fobRate = record.result?.fxRate;
  if (!fobRate || !(fobRate > 0)) return null;
  if (fxKey(record.input?.currency) !== fxKey(fobCurrency)) return null;
  if (record.sellCurrency && !sameCurrency(record.sellCurrency, sellCurrency))
    return null;
  const sellRate =
    fxKey(sellCurrency) === "BRL"
      ? 1
      : record.sellFxRate && record.sellFxRate > 0
        ? record.sellFxRate
        : null;
  return sellRate ? fobRate / sellRate : null;
}

export interface FinanceSummary {
  currency: string;
  /** Vendido, sem os pedidos cancelados (recebido e pago contam todos). */
  sell: number;
  received: number;
  receivable: number;
  /** Custo, margem e percentual só sobre os pedidos com câmbio conhecido (e não cancelados). */
  cost: number;
  margin: number;
  marginPct: number | null;
  /** Pedidos (não cancelados) sem câmbio nenhum (nem do dia), fora da margem consolidada. */
  missingFx: number;
  /** Pedidos (não cancelados) com custo estimado pelo câmbio ("~" na margem). */
  estimated: number;
  /** Efeito do câmbio na margem desde a venda (pedidos com o câmbio da venda). */
  fxEffect: number | null;
  payableByCurrency: Record<string, number>;
  paidByCurrency: Record<string, number>;
}

const settled = (p: Payment) =>
  p.status === "confirmed" || p.status === "received";

export function computeOrderFinance(
  order: Order,
  payments: Payment[],
  names: { customer: string; supplier: string; product: string },
  fx: { today?: FxToday | null; saleFx?: number | null } = {},
): OrderFinance {
  const sellCurrency = order.sellCurrency ?? "BRL";
  const fobCurrency = order.fobCurrency ?? "USD";
  const sell = order.sellPrice ?? 0;
  const cancelled = order.status === "CANCELLED";
  const fob = order.fobTotal ?? 0;
  const inbound = payments.filter(
    (p) => p.direction === "customer_in" && settled(p),
  );
  const outbound = payments.filter(
    (p) => p.direction === "supplier_out" && settled(p),
  );
  const received = inbound.reduce((s, p) => s + p.amount, 0);
  const paid = outbound.reduce((s, p) => s + p.amount, 0);

  const withFx = outbound.filter((p) => p.fxRate && p.fxRate > 0);
  const knownCost = withFx.reduce(
    (s, p) => s + p.amount * (p.fxRate as number),
    0,
  );
  const knownAmount = withFx.reduce((s, p) => s + p.amount, 0);
  const avgFx = knownAmount > 0 ? knownCost / knownAmount : null;
  const remaining = Math.max(0, fob - knownAmount); // pago sem câmbio + saldo a pagar
  const todayRate = fx.today
    ? crossRate(fx.today.rates, fobCurrency, sellCurrency)
    : null;
  const todayFrom =
    fx.today && todayRate !== null
      ? fx.today.status === "stale" || fx.today.status === "manual"
        ? fx.today.status
        : "today"
      : null;
  let cost: number | null = null;
  let estimated = false;
  let fxBasis: OrderFinance["fxBasis"] = null;
  let estimateRate: number | null = null;
  let estimateFrom: OrderFinance["estimateFrom"] = null;
  if (sameCurrency(fobCurrency, sellCurrency)) {
    cost = fob;
    fxBasis = "same";
  } else if (remaining <= 0.005 && avgFx !== null) {
    // Tudo pago com câmbio informado: custo real.
    cost = knownCost;
    fxBasis = "paid";
  } else if (fob > 0) {
    // Saldo (ou tudo) pelo câmbio do dia; sem ele, pela média já paga.
    // (FOB zerado: preço ainda não informado, sem margem estimada.)
    const rate = todayRate ?? avgFx;
    if (rate !== null) {
      cost = knownCost + remaining * rate;
      estimated = true;
      fxBasis = knownAmount > 0 ? "partial" : "estimate";
      estimateRate = rate;
      estimateFrom = todayRate !== null ? todayFrom : "paid";
    }
  }
  const margin = cost !== null ? sell - cost : null;
  const marginPct = margin !== null && sell > 0 ? (margin / sell) * 100 : null;
  // Efeito do câmbio desde a venda: custo ao câmbio da venda × custo de agora.
  const saleFx =
    fxBasis !== "same" && fx.saleFx && fx.saleFx > 0 ? fx.saleFx : null;
  const saleCost = saleFx !== null ? fob * saleFx : null;
  const marginAtSale = saleCost !== null ? sell - saleCost : null;
  const fxEffect =
    saleCost !== null && cost !== null && !cancelled
      ? cents(saleCost - cost)
      : null;

  return {
    order,
    customerName: names.customer,
    supplierName: names.supplier,
    productName: names.product,
    sellCurrency,
    sell,
    received,
    // Cancelado: nada mais a receber nem a pagar pelo sistema; o acerto é livre.
    // Em centavos: duas parcelas (30% + saldo) deixavam 0,00000000000005 a
    // receber, com o formulário de recebimento aberto e um valor ilegível.
    receivable: cancelled ? 0 : Math.max(0, cents(sell - received)),
    fobCurrency,
    fob,
    paid,
    payable: cancelled ? 0 : Math.max(0, cents(fob - paid)),
    cost,
    avgFx,
    estimated,
    fxBasis,
    estimateRate,
    estimateFrom,
    estimateDay:
      estimateFrom && estimateFrom !== "paid" ? (fx.today?.day ?? null) : null,
    saleFx,
    marginAtSale,
    fxEffect,
    margin,
    marginPct,
  };
}

/** Câmbio do dia para estimar o saldo; nunca derruba a tela (sem câmbio: nulo). */
async function todayFx(): Promise<FxToday | null> {
  try {
    const { getFxRates } = await import("./fx");
    const view = await getFxRates();
    return Object.values(view.rates).some((v) => typeof v === "number" && v > 0)
      ? { rates: view.rates, status: view.status, day: view.day }
      : null;
  } catch (error) {
    console.error("[finance] câmbio do dia indisponível", error);
    return null;
  }
}

/** Última proposta (seleção ou atualização) de cada solicitação: o câmbio da venda. */
async function saleRecords(
  requestIds: Array<string | null | undefined>,
): Promise<Map<string, PricingRecord>> {
  const ids = [...new Set(requestIds.filter((id): id is string => !!id))];
  const out = new Map<string, PricingRecord>();
  if (!ids.length) return out;
  try {
    const rows = await getStore().list("audit_log", {
      filter: {
        entity: "request",
        entityId: ids,
        action: ["quote.select", "proposal.refresh"],
      },
      orderBy: "createdAt",
      direction: "desc",
    });
    for (const row of rows) {
      if (out.has(row.entityId)) continue;
      const pricing = (row.after as { pricing?: PricingRecord } | null)
        ?.pricing;
      if (pricing) out.set(row.entityId, pricing);
    }
  } catch (error) {
    console.error("[finance] câmbio da venda indisponível", error);
  }
  return out;
}

export async function loadFinance(
  options: {
    /** Câmbio do dia e da venda (estimativa da margem). A Control Tower não usa. */
    estimate?: boolean;
  } = {},
): Promise<{
  rows: OrderFinance[];
  summary: FinanceSummary;
}> {
  const store = getStore();
  const [orders, payments, parties, items] = await Promise.all([
    store.list("orders", { orderBy: "number", direction: "desc" }),
    store.list("payments"),
    store.list("parties"),
    store.list("order_items"),
  ]);
  const estimate = options.estimate !== false;
  const [today, sales] = estimate
    ? await Promise.all([
        todayFx(),
        saleRecords(orders.map((o) => o.requestId)),
      ])
    : [null, new Map<string, PricingRecord>()];
  const name = (id: string | null) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const rows = orders.map((o) =>
    computeOrderFinance(
      o,
      payments.filter((p) => p.orderId === o.id),
      {
        customer: name(o.customerId),
        supplier: name(o.supplierId),
        product: items.find((i) => i.orderId === o.id)?.name ?? "—",
      },
      {
        today,
        saleFx: saleFxFromRecord(
          o.requestId ? sales.get(o.requestId) : null,
          o.fobCurrency ?? "USD",
          o.sellCurrency ?? "BRL",
        ),
      },
    ),
  );
  const currency = rows[0]?.sellCurrency ?? "BRL";
  const same = rows.filter((r) => r.sellCurrency === currency);
  // Pedido cancelado não é venda nem custo: fica fora de vendido, custo, margem
  // e "sem câmbio". Recebido, a receber e pago continuam sobre todos (o
  // dinheiro que entrou ou saiu mexeu de verdade).
  const live = same.filter((r) => r.order.status !== "CANCELLED");
  const sell = live.reduce((s, r) => s + r.sell, 0);
  const received = same.reduce((s, r) => s + r.received, 0);
  const known = live.filter((r) => r.cost !== null);
  const cost = known.reduce((s, r) => s + (r.cost as number), 0);
  const knownSell = known.reduce((s, r) => s + r.sell, 0);
  const payableByCurrency: Record<string, number> = {};
  const paidByCurrency: Record<string, number> = {};
  for (const r of rows) {
    payableByCurrency[r.fobCurrency] =
      (payableByCurrency[r.fobCurrency] ?? 0) + r.payable;
    paidByCurrency[r.fobCurrency] =
      (paidByCurrency[r.fobCurrency] ?? 0) + r.paid;
  }
  const margin = knownSell - cost;
  const effects = live.filter((r) => r.fxEffect !== null);
  return {
    rows,
    summary: {
      currency,
      sell,
      received,
      receivable: same.reduce((s, r) => s + r.receivable, 0),
      cost,
      margin,
      marginPct: knownSell > 0 ? (margin / knownSell) * 100 : null,
      missingFx: live.length - known.length,
      estimated: known.filter((r) => r.estimated).length,
      fxEffect: effects.length
        ? cents(effects.reduce((s, r) => s + (r.fxEffect as number), 0))
        : null,
      payableByCurrency,
      paidByCurrency,
    },
  };
}

export async function loadOrderFinance(order: Order): Promise<OrderFinance> {
  const store = getStore();
  const [payments, customer, supplier, items, today, sales] = await Promise.all(
    [
      store.list("payments", { filter: { orderId: order.id } }),
      store.get("parties", order.customerId),
      store.get("parties", order.supplierId),
      store.list("order_items", { filter: { orderId: order.id } }),
      todayFx(),
      saleRecords([order.requestId]),
    ] as const,
  );
  return computeOrderFinance(
    order,
    payments,
    {
      customer: customer?.name ?? "—",
      supplier: supplier?.name ?? "—",
      product: items[0]?.name ?? "—",
    },
    {
      today,
      saleFx: saleFxFromRecord(
        order.requestId ? sales.get(order.requestId) : null,
        order.fobCurrency ?? "USD",
        order.sellCurrency ?? "BRL",
      ),
    },
  );
}
