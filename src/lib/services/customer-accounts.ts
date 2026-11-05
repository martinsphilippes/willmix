import "server-only";

import {
  getStore,
  type Order,
  type Party,
  type Payment,
  type Request,
} from "@/lib/db";
import { loadFinance, type OrderFinance } from "./finance";

/*
 * Conta do cliente (tela Clientes, docs/CUSTOMERS.md): por cliente, o que foi
 * contratado, entregue, recebido antes da entrega, o que falta receber e o
 * que já entrou. Vem dos pedidos e dos recebimentos já lançados (nada novo
 * no banco). Valores por moeda de venda: não se soma real com dólar.
 *
 * - Valor do contrato: venda dos pedidos não cancelados.
 * - Entregue: venda dos pedidos entregues ou encerrados.
 * - Pagamento antecipado: recebido de pedidos ainda não entregues (até o
 *   valor da venda) mais o sinal pago na solicitação, antes de virar pedido.
 * - A receber: venda menos o recebido de cada pedido (nunca negativo).
 * - Recebido: tudo o que entrou (confirmado ou recebido), inclusive o sinal.
 */

export type Money = Record<string, number>;

const cents = (n: number) => Math.round(n * 100) / 100;

function add(m: Money, currency: string, value: number) {
  if (!value) return;
  const c = (currency || "BRL").toUpperCase();
  m[c] = cents((m[c] ?? 0) + value);
}

const DELIVERED: readonly string[] = ["DELIVERED", "CLOSED"];
export const isDelivered = (o: Pick<Order, "status">) =>
  DELIVERED.includes(o.status);

const settled = (p: Payment) =>
  p.status === "confirmed" || p.status === "received";

export interface AccountTotals {
  contract: Money;
  delivered: Money;
  prepaid: Money;
  receivable: Money;
  received: Money;
}

export const emptyTotals = (): AccountTotals => ({
  contract: {},
  delivered: {},
  prepaid: {},
  receivable: {},
  received: {},
});

/** Situação do recebimento de um pedido. */
export type ReceiptStatus = "paid" | "partial" | "open" | "cancelled";
/** Situação da entrega de um pedido. */
export type DeliveryStatus = "delivered" | "in_progress" | "cancelled";

export interface CustomerOrderRow {
  orderId: string;
  number: number;
  createdAt: string;
  product: string;
  status: Order["status"];
  currency: string;
  contract: number;
  delivered: number;
  receivable: number;
  received: number;
  receipt: ReceiptStatus;
  delivery: DeliveryStatus;
}

/** Uma linha por pedido, com as situações de recebimento e entrega. */
export function orderRow(f: OrderFinance): CustomerOrderRow {
  const o = f.order;
  const cancelled = o.status === "CANCELLED";
  const delivered = isDelivered(o);
  return {
    orderId: o.id,
    number: o.number,
    createdAt: o.createdAt,
    product: f.productName,
    status: o.status,
    currency: f.sellCurrency,
    contract: cancelled ? 0 : f.sell,
    delivered: delivered && !cancelled ? f.sell : 0,
    receivable: cancelled ? 0 : Math.max(0, f.receivable),
    received: f.received,
    receipt: cancelled
      ? "cancelled"
      : f.sell > 0 && f.received >= f.sell - 0.005
        ? "paid"
        : f.received > 0
          ? "partial"
          : "open",
    delivery: cancelled ? "cancelled" : delivered ? "delivered" : "in_progress",
  };
}

/**
 * Totais de um cliente a partir das linhas dos pedidos e do sinal pago nas
 * solicitações (pagamentos sem pedido). Função pura: testada à parte.
 */
export function accountTotals(
  rows: CustomerOrderRow[],
  requestPayments: Payment[] = [],
): AccountTotals {
  const t = emptyTotals();
  for (const r of rows) {
    add(t.contract, r.currency, r.contract);
    add(t.delivered, r.currency, r.delivered);
    add(t.receivable, r.currency, r.receivable);
    add(t.received, r.currency, r.received);
    if (r.delivery === "in_progress")
      add(t.prepaid, r.currency, Math.min(r.received, r.contract));
  }
  for (const p of requestPayments) {
    if (p.direction !== "customer_in" || p.orderId || !settled(p)) continue;
    add(t.prepaid, p.currency, p.amount);
    add(t.received, p.currency, p.amount);
  }
  return t;
}

/** Soma de várias contas (cartões do alto da lista). */
export function sumTotals(list: AccountTotals[]): AccountTotals {
  const t = emptyTotals();
  for (const a of list)
    for (const key of Object.keys(t) as (keyof AccountTotals)[])
      for (const [c, v] of Object.entries(a[key])) add(t[key], c, v);
  return t;
}

export interface CustomerAccount {
  party: Party;
  orders: number;
  openOrders: number;
  openRequests: number;
  lastOrderAt: string | null;
  totals: AccountTotals;
}

const OPEN_REQUEST: readonly string[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

interface Loaded {
  customers: Party[];
  finance: OrderFinance[];
  requests: Request[];
  requestPayments: Payment[];
}

async function load(): Promise<Loaded> {
  const store = getStore();
  const [customers, { rows }, requests, payments] = await Promise.all([
    store.list("parties", { filter: { type: "customer" }, orderBy: "name" }),
    loadFinance({ estimate: false }),
    store.list("requests"),
    store.list("payments", { filter: { direction: "customer_in" } }),
  ]);
  return {
    customers,
    finance: rows,
    requests,
    requestPayments: payments.filter((p) => !p.orderId && p.requestId),
  };
}

function accountOf(party: Party, data: Loaded): CustomerAccount {
  const mine = data.finance.filter((f) => f.order.customerId === party.id);
  const rows = mine.map(orderRow);
  const myRequests = data.requests.filter((r) => r.customerId === party.id);
  const requestIds = new Set(myRequests.map((r) => r.id));
  return {
    party,
    orders: rows.length,
    openOrders: rows.filter((r) => r.delivery === "in_progress").length,
    openRequests: myRequests.filter((r) => OPEN_REQUEST.includes(r.status))
      .length,
    lastOrderAt:
      rows.map((r) => r.createdAt).sort((a, b) => b.localeCompare(a))[0] ??
      null,
    totals: accountTotals(
      rows,
      data.requestPayments.filter(
        (p) => p.requestId && requestIds.has(p.requestId),
      ),
    ),
  };
}

/** Normaliza para busca (sem acento, minúsculas). */
const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface CustomerListFilter {
  q?: string | null;
  status?: "active" | "inactive" | "all";
}

/** Lista de clientes com a conta de cada um e os totais de todos os listados. */
export async function customerAccounts(
  filter: CustomerListFilter = {},
): Promise<{ rows: CustomerAccount[]; totals: AccountTotals }> {
  const data = await load();
  const q = norm(filter.q).trim();
  const status = filter.status ?? "active";
  const rows = data.customers
    .filter((p) =>
      status === "all" ? true : status === "active" ? p.active : !p.active,
    )
    .filter(
      (p) =>
        !q ||
        [p.name, p.email, p.phone, p.taxId, p.contactName, p.city]
          .map(norm)
          .some((v) => v.includes(q)),
    )
    .map((p) => accountOf(p, data));
  return { rows, totals: sumTotals(rows.map((r) => r.totals)) };
}

export interface CustomerDetail {
  account: CustomerAccount;
  orders: CustomerOrderRow[];
  /** Recebimentos do cliente (pedidos e sinal das solicitações), mais novos primeiro. */
  payments: Array<
    Payment & { orderNumber: number | null; requestNumber: number | null }
  >;
}

/** Ficha do cliente: conta, pedidos e recebimentos. Nulo se não é cliente. */
export async function customerDetail(
  partyId: string,
): Promise<CustomerDetail | null> {
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party || party.type !== "customer") return null;
  const data = await load();
  const mine = data.finance.filter((f) => f.order.customerId === party.id);
  const orders = mine
    .map(orderRow)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const orderIds = mine.map((f) => f.order.id);
  const requestIds = data.requests
    .filter((r) => r.customerId === party.id)
    .map((r) => r.id);
  const payments =
    orderIds.length || requestIds.length
      ? (
          await store.list("payments", { filter: { direction: "customer_in" } })
        ).filter(
          (p) =>
            (p.orderId && orderIds.includes(p.orderId)) ||
            (!p.orderId && p.requestId && requestIds.includes(p.requestId)),
        )
      : [];
  const numberOfOrder = new Map(mine.map((f) => [f.order.id, f.order.number]));
  const numberOfRequest = new Map(
    data.requests.map((r) => [r.id, r.number ?? null]),
  );
  return {
    account: accountOf(party, data),
    orders,
    payments: payments
      .map((p) => ({
        ...p,
        orderNumber: p.orderId ? (numberOfOrder.get(p.orderId) ?? null) : null,
        requestNumber:
          !p.orderId && p.requestId
            ? (numberOfRequest.get(p.requestId) ?? null)
            : null,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

/** CSV (Excel abre direto) da lista de clientes. */
export function customersCsv(
  rows: CustomerAccount[],
  header: string[],
  yesNo: { yes: string; no: string },
): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const money = (m: Money) =>
    Object.entries(m)
      .map(([c, v]) => `${c} ${v.toFixed(2)}`)
      .join(" + ");
  const lines = [header.map(cell).join(";")];
  for (const r of rows)
    lines.push(
      [
        r.party.name,
        r.party.taxId,
        r.party.phone,
        r.party.email,
        r.party.city,
        r.party.country,
        r.orders,
        money(r.totals.contract),
        money(r.totals.delivered),
        money(r.totals.prepaid),
        money(r.totals.receivable),
        money(r.totals.received),
        r.party.active ? yesNo.yes : yesNo.no,
      ]
        .map(cell)
        .join(";"),
    );
  return `﻿${lines.join("\r\n")}\r\n`;
}
