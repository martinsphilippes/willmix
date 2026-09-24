import "server-only";

import { getStore, type Order, type Payment } from "@/lib/db";

/**
 * Visão financeira por pedido, derivada dos lançamentos já existentes:
 * - venda ao cliente (sellPrice/sellCurrency) e recebimentos (payments customer_in);
 * - custo FOB (fobTotal/fobCurrency) e pagamentos ao fornecedor (payments supplier_out).
 * O custo em BRL usa o câmbio informado em cada pagamento; sem câmbio, estima pela
 * média dos pagamentos que têm câmbio e sinaliza `estimated`.
 */
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
  avgFx: number | null;
  estimated: boolean;
  margin: number | null;
  marginPct: number | null;
}

export interface FinanceSummary {
  currency: string;
  sell: number;
  received: number;
  receivable: number;
  /** Custo, margem e percentual só sobre os pedidos com câmbio conhecido. */
  cost: number;
  margin: number;
  marginPct: number | null;
  /** Pedidos sem câmbio informado, fora da margem consolidada. */
  missingFx: number;
  payableByCurrency: Record<string, number>;
  paidByCurrency: Record<string, number>;
}

const settled = (p: Payment) =>
  p.status === "confirmed" || p.status === "received";

export function computeOrderFinance(
  order: Order,
  payments: Payment[],
  names: { customer: string; supplier: string; product: string },
): OrderFinance {
  const sellCurrency = order.sellCurrency ?? "BRL";
  const fobCurrency = order.fobCurrency ?? "USD";
  const sell = order.sellPrice ?? 0;
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
  const remaining = fob - knownAmount; // pago sem câmbio + saldo a pagar
  let cost: number | null = null;
  let estimated = false;
  if (fobCurrency === sellCurrency) {
    cost = fob;
  } else if (avgFx !== null) {
    cost = knownCost + Math.max(0, remaining) * avgFx;
    estimated = remaining > 0.005;
  }
  const margin = cost !== null ? sell - cost : null;
  const marginPct = margin !== null && sell > 0 ? (margin / sell) * 100 : null;

  return {
    order,
    customerName: names.customer,
    supplierName: names.supplier,
    productName: names.product,
    sellCurrency,
    sell,
    received,
    receivable: Math.max(0, sell - received),
    fobCurrency,
    fob,
    paid,
    payable: Math.max(0, fob - paid),
    cost,
    avgFx,
    estimated,
    margin,
    marginPct,
  };
}

export async function loadFinance(): Promise<{
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
    ),
  );
  const currency = rows[0]?.sellCurrency ?? "BRL";
  const same = rows.filter((r) => r.sellCurrency === currency);
  const sell = same.reduce((s, r) => s + r.sell, 0);
  const received = same.reduce((s, r) => s + r.received, 0);
  const known = same.filter((r) => r.cost !== null);
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
  return {
    rows,
    summary: {
      currency,
      sell,
      received,
      receivable: Math.max(0, sell - received),
      cost,
      margin,
      marginPct: knownSell > 0 ? (margin / knownSell) * 100 : null,
      missingFx: same.length - known.length,
      payableByCurrency,
      paidByCurrency,
    },
  };
}

export async function loadOrderFinance(order: Order): Promise<OrderFinance> {
  const store = getStore();
  const [payments, customer, supplier, items] = await Promise.all([
    store.list("payments", { filter: { orderId: order.id } }),
    store.get("parties", order.customerId),
    store.get("parties", order.supplierId),
    store.list("order_items", { filter: { orderId: order.id } }),
  ]);
  return computeOrderFinance(order, payments, {
    customer: customer?.name ?? "—",
    supplier: supplier?.name ?? "—",
    product: items[0]?.name ?? "—",
  });
}
