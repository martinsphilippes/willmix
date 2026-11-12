import "server-only";

import { getStore, type Payment } from "@/lib/db";
import { loadFinance, type OrderFinance } from "./finance";
import {
  IDLE_DAYS,
  listStockMovements,
  loadInventory,
  limitStatus,
} from "./inventory";
import { safeList } from "./stock";
import { STOCK_PARTY_ID } from "./stock-party";

/*
 * Painel do dono: os números do negócio numa tela só (só quem abre
 * Finanças). Vendas e margem do mês com o mês anterior, recebido e a
 * receber, pago e a pagar aos fornecedores, estoque (valor, abaixo do
 * limite, perdas do último inventário), operação (solicitações e pedidos em
 * andamento por etapa), vendas dos últimos 6 meses e os maiores clientes e
 * fornecedores em 12 meses. Tudo vem do que o sistema já guarda.
 */

/** Mês (AAAA-MM) em Brasília. */
export function monthOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

/** Os últimos `n` meses (AAAA-MM), do mais antigo ao atual. */
export function lastMonths(now: Date, n: number): string[] {
  const cur = monthOf(now.toISOString());
  const [y, m] = cur.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const add = (map: Map<string, number>, key: string, v: number) =>
  map.set(key, Math.round(((map.get(key) ?? 0) + v) * 100) / 100);

/** Vendas e margem por mês, sobre os pedidos não cancelados (função pura). */
export function salesByMonth(
  rows: Pick<
    OrderFinance,
    "order" | "sell" | "margin" | "sellCurrency" | "customerName"
  >[],
  currency: string,
) {
  const sell = new Map<string, number>();
  const margin = new Map<string, number>();
  const marginSell = new Map<string, number>();
  const orders = new Map<string, number>();
  for (const r of rows) {
    if (r.order.status === "CANCELLED" || r.sellCurrency !== currency) continue;
    if (r.order.customerId === STOCK_PARTY_ID) continue;
    const m = monthOf(r.order.createdAt);
    add(sell, m, r.sell);
    orders.set(m, (orders.get(m) ?? 0) + 1);
    if (r.margin !== null) {
      add(margin, m, r.margin);
      add(marginSell, m, r.sell);
    }
  }
  return { sell, margin, marginSell, orders };
}

/** Soma dos pagamentos confirmados do mês, por moeda (função pura). */
export function paidInMonth(
  payments: Pick<
    Payment,
    "direction" | "status" | "amount" | "currency" | "confirmedAt" | "createdAt"
  >[],
  direction: Payment["direction"],
  month: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of payments) {
    if (p.direction !== direction) continue;
    if (p.status !== "confirmed" && p.status !== "received") continue;
    if (monthOf(p.confirmedAt ?? p.createdAt) !== month) continue;
    add(out, p.currency, p.amount);
  }
  return out;
}

/** Maiores contas em 12 meses (valor na moeda principal), função pura. */
export function topBy<T>(
  items: T[],
  key: (i: T) => string | null,
  value: (i: T) => number,
  limit = 5,
): { key: string; value: number; count: number }[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const i of items) {
    const k = key(i);
    if (!k) continue;
    const cur = map.get(k) ?? { value: 0, count: 0 };
    cur.value = Math.round((cur.value + value(i)) * 100) / 100;
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

const OPEN_REQUEST = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
];
const DONE_ORDER = ["DELIVERED", "CLOSED", "CANCELLED"];

/** Carrega tudo o que o painel do dono mostra. */
export async function loadOwnerPanel(now = new Date()) {
  const store = getStore();
  const [{ rows, summary }, payments, requests, inventory, movements, counts] =
    await Promise.all([
      loadFinance(),
      // Só os que entram nas contas do painel (antes: as tabelas inteiras).
      store.list("payments", { filter: { status: ["confirmed", "received"] } }),
      store.list("requests", {
        filter: { status: [...OPEN_REQUEST, "WAITING_DOWN_PAYMENT"] },
      }),
      loadInventory(now),
      listStockMovements(),
      safeList("stock_counts"),
    ]);
  const currency = summary.currency;
  const months = lastMonths(now, 6);
  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const byMonth = salesByMonth(rows, currency);

  // Estoque: valor de custo no Brasil + a caminho, abaixo do limite e perdas.
  const productIds = [
    ...new Set([
      ...inventory.map((r) => r.productId),
      ...movements.map((m) => m.productId),
    ]),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const product = (id: string) => products.find((p) => p.id === id) ?? null;
  const stockValue = new Map<string, number>();
  let below = 0;
  let idle = 0;
  for (const r of inventory) {
    const p = product(r.productId);
    if (p?.price != null)
      add(stockValue, p.currency ?? "USD", p.price * r.total);
    const st = limitStatus(r, p?.minStock);
    if (st === "incoming" || st === "reorder") below += 1;
    if ((r.idleDays ?? -1) >= IDLE_DAYS) idle += 1;
  }
  // Produtos com limite e sem estoque nenhum também estão abaixo.
  const withLimit = (await store.list("products", { filter: { active: true } }))
    .filter((p) => (p.minStock ?? 0) > 0)
    .filter((p) => !inventory.some((r) => r.productId === p.id));
  below += withLimit.length;
  const lastCount = [...counts]
    .filter((c) => c.status === "closed")
    .sort((a, b) => b.number - a.number)[0];
  const lossValue = new Map<string, number>();
  let lossQty = 0;
  for (const m of movements) {
    if (m.kind !== "count_loss" || !lastCount || m.countId !== lastCount.id)
      continue;
    lossQty += Math.abs(m.quantity);
    const p = product(m.productId);
    if (p?.price != null)
      add(lossValue, p.currency ?? "USD", Math.abs(m.quantity) * p.price);
  }

  // Operação.
  const openRequests = requests.filter((r) =>
    OPEN_REQUEST.includes(r.status),
  ).length;
  const waitingDown = requests.filter(
    (r) => r.status === "WAITING_DOWN_PAYMENT",
  ).length;
  const activeOrders = rows.filter((r) => !DONE_ORDER.includes(r.order.status));
  const byStage = new Map<string, number>();
  for (const r of activeOrders)
    byStage.set(r.order.status, (byStage.get(r.order.status) ?? 0) + 1);

  // Maiores clientes e fornecedores em 12 meses.
  const since = lastMonths(now, 12)[0];
  const recent = rows.filter(
    (r) =>
      r.order.status !== "CANCELLED" && monthOf(r.order.createdAt) >= since,
  );
  const fobCurrency = recent.find((r) => r.fobCurrency)?.fobCurrency ?? "USD";
  const topCustomers = topBy(
    recent.filter(
      (r) =>
        r.sellCurrency === currency && r.order.customerId !== STOCK_PARTY_ID,
    ),
    (r) => r.order.customerId,
    (r) => r.sell,
  ).map((t) => ({
    ...t,
    name: rows.find((r) => r.order.customerId === t.key)?.customerName ?? "—",
  }));
  const topSuppliers = topBy(
    recent.filter((r) => r.fobCurrency === fobCurrency),
    (r) => r.order.supplierId,
    (r) => r.fob,
  ).map((t) => ({
    ...t,
    name: rows.find((r) => r.order.supplierId === t.key)?.supplierName ?? "—",
  }));

  const pct = (a: number, b: number) =>
    b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null;
  const sellNow = byMonth.sell.get(thisMonth) ?? 0;
  const sellPrev = byMonth.sell.get(prevMonth) ?? 0;
  const marginNow = byMonth.margin.get(thisMonth) ?? null;
  const marginSellNow = byMonth.marginSell.get(thisMonth) ?? 0;

  return {
    currency,
    fobCurrency,
    month: thisMonth,
    sales: {
      now: sellNow,
      prev: sellPrev,
      change: pct(sellNow, sellPrev),
      orders: byMonth.orders.get(thisMonth) ?? 0,
      margin: marginNow,
      marginPct:
        marginNow !== null && marginSellNow > 0
          ? Math.round((marginNow / marginSellNow) * 1000) / 10
          : null,
    },
    chart: months.map((m) => ({
      month: m,
      sell: byMonth.sell.get(m) ?? 0,
      margin: byMonth.margin.get(m) ?? null,
      orders: byMonth.orders.get(m) ?? 0,
    })),
    receivable: summary.receivable,
    receivedMonth: paidInMonth(payments, "customer_in", thisMonth),
    payable: summary.payableByCurrency,
    paidMonth: paidInMonth(payments, "supplier_out", thisMonth),
    stock: {
      value: stockValue,
      below,
      idle,
      lastCount: lastCount ?? null,
      lossQty,
      lossValue,
    },
    ops: {
      openRequests,
      waitingDown,
      activeOrders: activeOrders.length,
      byStage,
    },
    topCustomers,
    topSuppliers,
  };
}
