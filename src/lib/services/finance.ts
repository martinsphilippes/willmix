import "server-only";

import { getStore, type Order, type Payment } from "@/lib/db";
import { fxKey, rateFor, type FxRates } from "@/lib/pricing";
import type { FxStatus } from "./fx";
import type { PricingRecord } from "./quote-pricing";

/**
 * Visão financeira por pedido, derivada dos lançamentos já existentes:
 * - venda ao cliente (sellPrice/sellCurrency) e recebimentos (payments customer_in);
 * - custo FOB (fobTotal/fobCurrency) e pagamentos ao fornecedor (payments supplier_out).
 *
 * Custo: conta feita em reais e levada à moeda da venda no fim. O câmbio de um
 * pagamento ao fornecedor é R$ por 1 unidade da moeda do pagamento (como a
 * PTAX). O que já foi pago com câmbio informado (ou pago em reais) é real; o
 * que foi pago sem câmbio e o que falta pagar são estimados pelo câmbio do dia
 * (sem ele, pela média do que já foi pago) e sinalizados (`estimated`, "~").
 * Pagamento em outra moeda que não a do FOB abate o FOB pelo câmbio do dia
 * (estimado). Pedido cancelado só conta o que de fato foi pago. Sem câmbio
 * nenhum: "câmbio pendente". Com o câmbio da venda (gravado na proposta),
 * mostra o efeito do câmbio na margem desde a venda.
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
  /**
   * Pago em outras moedas que não a do FOB (fora de "pago" e "a pagar", como
   * na conta corrente do fornecedor), por moeda.
   */
  paidOther: Record<string, number>;
  /** Custo do fornecedor convertido para a moeda de venda (normalmente BRL). */
  cost: number | null;
  /** Câmbio médio real (moeda da venda por unidade do FOB) do que foi pago com câmbio. */
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
  /** Unidades do FOB pagas sem câmbio informado (estimadas pelo câmbio do dia). */
  paidNoFx: number;
  /** Unidades do FOB ainda não pagas (estimadas pelo câmbio do dia). */
  unpaid: number;
  /** Pagamento em outra moeda convertido em unidades do FOB pelo câmbio do dia. */
  crossConverted: boolean;
  /** Venda fora de reais: R$ por 1 unidade da moeda da venda usado na conversão. */
  sellRate: number | null;
  /** Unidades do FOB que entraram no custo (pago + saldo), base do efeito do câmbio. */
  costedFob: number;
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
  /** Algum pedido do efeito tem custo estimado ("~" no total). */
  fxEffectEstimated: boolean;
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
  // Pago e a pagar na moeda do FOB, como na conta corrente do fornecedor; o
  // pago em outra moeda aparece à parte, na moeda dele.
  // (Pagamento sem moeda, de antes de a moeda ser obrigatória: a do FOB.)
  const inFob = (p: Payment) =>
    !p.currency || sameCurrency(p.currency, fobCurrency);
  const paid = outbound.filter(inFob).reduce((s, p) => s + p.amount, 0);
  const paidOther: Record<string, number> = {};
  for (const p of outbound.filter((x) => !inFob(x))) {
    const c = p.currency.toUpperCase();
    paidOther[c] = cents((paidOther[c] ?? 0) + p.amount);
  }

  const rates = fx.today?.rates ?? null;
  // Cada pagamento em reais (real com câmbio informado ou pago em reais) e em
  // unidades do FOB (outra moeda: pelo câmbio do dia, estimado).
  let realBrl = 0;
  let realUnits = 0;
  // Só pagamentos na moeda do FOB com câmbio próprio: o câmbio médio "real".
  let fobRealBrl = 0;
  let fobRealUnits = 0;
  let noFxUnits = 0;
  let crossConverted = false;
  let unconvertible = false;
  for (const p of outbound) {
    let units: number | null = p.amount;
    if (!inFob(p)) {
      const r = rates ? crossRate(rates, p.currency, fobCurrency) : null;
      units = r !== null ? p.amount * r : null;
      crossConverted = true;
    }
    if (units === null) {
      unconvertible = true;
      continue;
    }
    const brl =
      fxKey(p.currency) === "BRL"
        ? p.amount
        : p.fxRate && p.fxRate > 0
          ? p.amount * p.fxRate
          : null;
    if (brl === null) noFxUnits += units;
    else {
      realBrl += brl;
      realUnits += units;
      if (inFob(p)) {
        fobRealBrl += brl;
        fobRealUnits += units;
      }
    }
  }
  // Cancelado: o que não foi pago não vai ser; só conta o que saiu.
  const unpaid = cancelled ? 0 : Math.max(0, fob - realUnits - noFxUnits);
  const estUnits = noFxUnits + unpaid;
  const needEstimate = estUnits > 0.005;
  const avgBrl = realUnits > 0 ? realBrl / realUnits : null;
  const todayBrl = rates ? rateFor(rates, fobCurrency) : null;
  const todayFrom =
    fx.today && todayBrl !== null
      ? fx.today.status === "stale" || fx.today.status === "manual"
        ? fx.today.status
        : "today"
      : null;
  const estBrl = todayBrl ?? avgBrl;
  // Venda fora de reais: o custo em reais vai à moeda da venda pelo câmbio do dia.
  const sellBrl =
    fxKey(sellCurrency) === "BRL"
      ? 1
      : rates
        ? rateFor(rates, sellCurrency)
        : null;

  let cost: number | null = null;
  let estimated = false;
  let fxBasis: OrderFinance["fxBasis"] = null;
  let estimateRate: number | null = null;
  let estimateFrom: OrderFinance["estimateFrom"] = null;
  if (sameCurrency(fobCurrency, sellCurrency)) {
    // Cancelado: só o que foi pago (nada pago, sem custo).
    cost = cancelled ? (paid > 0.005 ? paid : null) : fob;
    fxBasis = "same";
  } else if (
    !unconvertible &&
    (realUnits + noFxUnits > 0.005 || (fob > 0 && !cancelled)) &&
    (!needEstimate || estBrl !== null) &&
    sellBrl !== null &&
    sellBrl > 0
  ) {
    // (FOB zerado e nada pago: preço ainda não informado, sem margem estimada.)
    cost =
      (realBrl + (needEstimate ? estUnits * (estBrl as number) : 0)) / sellBrl;
    estimated = needEstimate || crossConverted || sellBrl !== 1;
    fxBasis = !estimated ? "paid" : realUnits > 0 ? "partial" : "estimate";
    if (needEstimate) {
      estimateRate = (estBrl as number) / sellBrl;
      estimateFrom = todayBrl !== null ? todayFrom : "paid";
    }
  }
  // Câmbio médio real: só o que foi pago na moeda do FOB com câmbio
  // informado (pagamento em reais ou em outra moeda depende do câmbio do dia).
  const avgFx =
    fobRealUnits > 0 && sellBrl !== null && sellBrl > 0 && fxBasis !== "same"
      ? fobRealBrl / fobRealUnits / sellBrl
      : null;
  const margin = cost !== null ? sell - cost : null;
  const marginPct = margin !== null && sell > 0 ? (margin / sell) * 100 : null;
  // Efeito do câmbio desde a venda: as mesmas unidades do FOB que entraram no
  // custo, ao câmbio da venda × custo de agora (pagamento a mais ou FOB
  // reduzido depois de pago não viram "perda de câmbio").
  const costedFob = fxBasis === "same" ? fob : realUnits + estUnits;
  const saleFx =
    fxBasis !== "same" && fx.saleFx && fx.saleFx > 0 ? fx.saleFx : null;
  const saleCost = saleFx !== null ? costedFob * saleFx : null;
  const marginAtSale = saleCost !== null ? sell - saleCost : null;
  const fxEffect =
    saleCost !== null && cost !== null && !cancelled
      ? cents(saleCost - cost) || 0
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
    paidOther,
    cost,
    avgFx,
    estimated,
    fxBasis,
    estimateRate,
    estimateFrom,
    estimateDay:
      estimateFrom && estimateFrom !== "paid" ? (fx.today?.day ?? null) : null,
    paidNoFx: noFxUnits,
    unpaid,
    crossConverted,
    sellRate: sellBrl !== null && sellBrl !== 1 ? sellBrl : null,
    costedFob,
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
    // Pago em outra moeda conta na moeda dele (não soma como se fosse a do FOB).
    for (const [c, v] of Object.entries(r.paidOther))
      paidByCurrency[c] = (paidByCurrency[c] ?? 0) + v;
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
        ? cents(effects.reduce((s, r) => s + (r.fxEffect as number), 0)) || 0
        : null,
      fxEffectEstimated: effects.some((r) => r.estimated),
      payableByCurrency,
      paidByCurrency,
    },
  };
}

export async function loadOrderFinance(
  order: Order,
  options: {
    /**
     * Câmbio do dia e da venda (custo, margem e efeito do câmbio). Só a Wellmix
     * vê; para o cliente a tela não busca câmbio nem lê a auditoria.
     */
    estimate?: boolean;
  } = {},
): Promise<OrderFinance> {
  const estimate = options.estimate !== false;
  const store = getStore();
  const [payments, customer, supplier, items, today, sales] = await Promise.all(
    [
      store.list("payments", { filter: { orderId: order.id } }),
      store.get("parties", order.customerId),
      store.get("parties", order.supplierId),
      store.list("order_items", { filter: { orderId: order.id } }),
      estimate ? todayFx() : Promise.resolve(null),
      estimate
        ? saleRecords([order.requestId])
        : Promise.resolve(new Map<string, PricingRecord>()),
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
