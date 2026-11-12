import "server-only";
import { indexBy, listByIds } from "@/lib/db/lookup";

import { getStore } from "@/lib/db";
import { rateFor } from "@/lib/pricing";
import { brazilDay, addDays } from "@/lib/supplier-terms";
import { loadFinance } from "./finance";
import { listPayables, payableRows } from "./supplier-terms";
import { STOCK_PARTY_ID } from "./stock-party";

/*
 * Fluxo de caixa previsto (só quem abre Finanças), semana a semana:
 * - entradas: o que falta receber dos clientes. Sinal de solicitação
 *   aguardando pagamento vence agora; saldo do pedido, na entrega ao cliente
 *   (data prevista da etapa "Entregue"; já entregue e não pago = atrasado);
 * - saídas: as parcelas ao fornecedor pela condição de pagamento (as mesmas
 *   de Contas a pagar), com o vencimento de cada uma; parcela que espera o
 *   embarque ou a entrega fica em "sem data".
 * Saídas em outra moeda entram no saldo em reais pelo câmbio do dia; sem
 * câmbio, o saldo daquela moeda não é inventado (fica de fora e é avisado).
 */

export interface CashItem {
  /** Sinal da solicitação, saldo do pedido do cliente ou parcela ao fornecedor. */
  type: "down" | "balance" | "installment";
  day: string | null;
  amount: number;
  currency: string;
  label: string;
  href: string;
}

export type BucketKey = "overdue" | "later" | "nodate" | `w${number}`;

export interface CashBucket {
  key: BucketKey;
  /** Segunda-feira da semana (AAAA-MM-DD) nas semanas. */
  start: string | null;
  inflow: Map<string, number>;
  outflow: Map<string, number>;
  /** Entradas − saídas, em reais (nulo se faltou câmbio de alguma moeda). */
  net: number | null;
  /** Saldo acumulado em reais até esta semana. */
  cumulative: number | null;
  items: { kind: "in" | "out"; item: CashItem }[];
}

/** Segunda-feira da semana do dia (AAAA-MM-DD). */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  return addDays(day, -dow);
}

const add = (m: Map<string, number>, c: string, v: number) =>
  m.set(c, Math.round(((m.get(c) ?? 0) + v) * 100) / 100);

/** Monta as semanas (função pura). `rate(c)` = reais por unidade da moeda. */
export function buildCashflow(input: {
  inflows: CashItem[];
  outflows: CashItem[];
  today: string;
  weeks: number;
  rate: (currency: string) => number | null;
}): { buckets: CashBucket[]; missingRates: string[] } {
  const first = mondayOf(input.today);
  const starts = Array.from({ length: input.weeks }, (_, i) =>
    addDays(first, i * 7),
  );
  const end = addDays(first, input.weeks * 7);
  const make = (key: BucketKey, start: string | null): CashBucket => ({
    key,
    start,
    inflow: new Map(),
    outflow: new Map(),
    net: 0,
    cumulative: null,
    items: [],
  });
  const buckets: CashBucket[] = [
    make("overdue", null),
    ...starts.map((s, i) => make(`w${i}`, s)),
    make("later", end),
    make("nodate", null),
  ];
  const bucketFor = (day: string | null) => {
    if (!day) return buckets[buckets.length - 1];
    if (day < first) return buckets[0];
    if (day >= end) return buckets[buckets.length - 2];
    const i = Math.floor(
      (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) /
        (7 * 86_400_000),
    );
    return buckets[1 + i];
  };
  const missing = new Set<string>();
  const place = (kind: "in" | "out", item: CashItem) => {
    if (!(item.amount > 0)) return;
    const b = bucketFor(item.day);
    add(kind === "in" ? b.inflow : b.outflow, item.currency, item.amount);
    b.items.push({ kind, item });
    const r = input.rate(item.currency);
    if (r === null) {
      missing.add(item.currency);
      b.net = null;
    } else if (b.net !== null)
      b.net =
        Math.round((b.net + (kind === "in" ? 1 : -1) * item.amount * r) * 100) /
        100;
  };
  for (const i of input.inflows) place("in", i);
  for (const o of input.outflows) place("out", o);
  // Acumulado: do atrasado até "depois"; "sem data" fica de fora.
  let acc: number | null = 0;
  for (const b of buckets) {
    if (b.key === "nodate") continue;
    acc =
      acc === null || b.net === null
        ? null
        : Math.round((acc + b.net) * 100) / 100;
    b.cumulative = acc;
  }
  for (const b of buckets)
    b.items.sort((a, c) =>
      (a.item.day ?? "9").localeCompare(c.item.day ?? "9"),
    );
  return { buckets, missingRates: [...missing] };
}

/** Carrega entradas e saídas previstas e monta as próximas `weeks` semanas. */
export async function loadCashflow(weeks = 12, now = new Date()) {
  const store = getStore();
  const today = brazilDay(now.toISOString()) as string;
  const [{ rows }, payables, requests, payments] = await Promise.all([
    loadFinance({ estimate: false }),
    listPayables(),
    store.list("requests", { filter: { status: "WAITING_DOWN_PAYMENT" } }),
    store.list("payments", { filter: { direction: "customer_in" } }),
  ]);
  // Etapa "Entregue" de cada pedido: do resumo por pedido (docs/RESUMOS.md)
  // ou, sem ele, da tabela de etapas. Clientes: só os das solicitações.
  const { factsForOrders } = await import("./order-summary");
  const facts = await factsForOrders(rows.map((r) => r.order));
  const deliveredStages = facts
    ? null
    : await store.list("stages", { filter: { key: "DELIVERED" } });
  const deliveredByOrder = deliveredStages
    ? indexBy(deliveredStages, "orderId")
    : null;
  const deliveredOf = (orderId: string) =>
    facts
      ? facts.get(orderId)?.ship.find((x) => x.key === "DELIVERED")
      : deliveredByOrder!.get(orderId);
  const parties = await listByIds(
    store,
    "parties",
    requests.map((q) => q.customerId),
  );
  let rates: Record<string, number | undefined> = {};
  try {
    const { getFxRates } = await import("./fx");
    rates = (await getFxRates()).rates as Record<string, number | undefined>;
  } catch {
    rates = {};
  }
  const rate = (c: string) => rateFor(rates as never, c);

  const inflows: CashItem[] = [];
  for (const r of rows) {
    const o = r.order;
    if (o.status === "CANCELLED" || o.customerId === STOCK_PARTY_ID) continue;
    if (!(r.receivable > 0)) continue;
    const st = deliveredOf(o.id);
    const delivered = o.status === "DELIVERED" || o.status === "CLOSED";
    const day = delivered
      ? brazilDay(st?.startedAt ?? st?.completedAt ?? o.updatedAt)
      : brazilDay(st?.dueAt ?? null);
    inflows.push({
      type: "balance",
      day,
      amount: r.receivable,
      currency: r.sellCurrency,
      label: `#${o.number} · ${r.customerName}`,
      href: `/app/orders/${o.id}#payments`,
    });
  }
  for (const q of requests) {
    if (q.customerId === STOCK_PARTY_ID || !(q.downPaymentAmount ?? 0))
      continue;
    const got = payments
      .filter(
        (p) =>
          p.requestId === q.id &&
          (p.status === "confirmed" || p.status === "received"),
      )
      .reduce((s, p) => s + p.amount, 0);
    const open = Math.round(((q.downPaymentAmount ?? 0) - got) * 100) / 100;
    if (!(open > 0)) continue;
    inflows.push({
      type: "down",
      day: today,
      amount: open,
      currency: q.sellCurrency ?? "BRL",
      label: `#${q.number ?? "?"} · ${parties.find((p) => p.id === q.customerId)?.name ?? ""}`,
      href: `/app/requests/${q.id}`,
    });
  }

  const outflows: CashItem[] = payableRows(payables)
    .filter(
      (r) =>
        r.installment.open > 0 &&
        r.installment.status !== "cancelled" &&
        r.installment.status !== "paid" &&
        r.installment.status !== "received",
    )
    .map((r) => ({
      type: "installment" as const,
      day: r.installment.dueDate,
      amount: r.installment.open,
      currency: r.payable.schedule.currency,
      label: `#${r.payable.order.number} · ${r.payable.supplier?.name ?? ""} · ${r.installment.index}/${r.installment.count}`,
      href: `/app/orders/${r.payable.order.id}#supplier-payment`,
    }));

  return {
    today,
    ...buildCashflow({ inflows, outflows, today, weeks, rate }),
  };
}
