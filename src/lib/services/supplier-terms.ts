import "server-only";

import {
  getStore,
  type Order,
  type OrderItem,
  type Party,
  type Payment,
  type PaymentTermInstallment,
  type Requirement,
  type Stage,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { evaluateStage } from "@/lib/workflow/engine";
import { OFF_FLOW_STAGES } from "@/lib/workflow/stages";
import {
  INSTALLMENT_STATUS_ORDER,
  MAX_TERM_DAYS,
  MAX_TERM_INSTALLMENTS,
  brazilDay,
  buildSupplierSchedule,
  parseTerms,
  paymentEventsFor,
  termsTotal,
  type ScheduleInstallment,
  type SupplierSchedule,
} from "@/lib/supplier-terms";
import { audit } from "./audit";
import { notify } from "./notifications";

/*
 * Condição de pagamento ao fornecedor: configurada no cadastro dele (só a
 * Wellmix), copiada no pedido quando o pedido nasce e transformada em
 * parcelas com vencimento. O pagamento não segura mais o fluxo do pedido.
 */

export class SupplierTermsError extends Error {}

export type TermsSource = "order" | "supplier";

/** A condição que vale para o pedido: a copiada nele ou, nos antigos, a atual do fornecedor. */
export function termsForOrder(
  order: Order,
  supplier: Party | null,
): { terms: PaymentTermInstallment[] | null; source: TermsSource | null } {
  const own = parseTerms(order.supplierPaymentTerms ?? null);
  if (own) return { terms: own, source: "order" };
  const current = parseTerms(supplier?.paymentTerms ?? null);
  if (current) return { terms: current, source: "supplier" };
  return { terms: null, source: null };
}

const describe = (terms: PaymentTermInstallment[] | null) =>
  terms?.length
    ? terms.map((t) => `${t.percent}% ${t.base}+${t.days}d`).join(" · ")
    : "sem condição";

/** Salva a condição no cadastro do fornecedor (só a Wellmix). Lista vazia = não configurada. */
export async function saveSupplierPaymentTerms(
  user: User,
  partyId: string,
  input: { terms: PaymentTermInstallment[]; note: string | null },
): Promise<Party> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party) throw new SupplierTermsError("not_found");
  if (party.type !== "supplier") throw new SupplierTermsError("not_supplier");
  if (input.terms.length > MAX_TERM_INSTALLMENTS)
    throw new SupplierTermsError("terms_too_many");
  for (const term of input.terms)
    if (
      !(term.percent > 0) ||
      term.percent > 100 ||
      !Number.isInteger(term.days) ||
      term.days < 0 ||
      term.days > MAX_TERM_DAYS
    )
      throw new SupplierTermsError("terms_invalid");
  const terms = input.terms.length ? parseTerms(input.terms) : null;
  if (input.terms.length && !terms) {
    throw new SupplierTermsError(
      Math.abs(termsTotal(input.terms) - 100) > 0.01
        ? "terms_total"
        : "terms_invalid",
    );
  }
  const note = input.note?.trim() || null;
  const before = {
    paymentTerms: parseTerms(party.paymentTerms ?? null),
    paymentTermsNote: party.paymentTermsNote ?? null,
  };
  const updated = await store.update("parties", partyId, {
    paymentTerms: terms,
    paymentTermsNote: note,
  });
  await audit(
    user,
    "party.payment_terms",
    "party",
    partyId,
    `${party.name}: ${describe(terms)}`,
    before,
    { paymentTerms: terms, paymentTermsNote: note },
  );
  return updated;
}

/**
 * Copia a condição atual do fornecedor no pedido que acaba de nascer. Nunca
 * impede o pedido: sem condição, ou com a coluna ainda não publicada no
 * Appwrite, o pedido segue (e usa a condição atual do fornecedor).
 */
export async function snapshotOrderPaymentTerms(order: Order): Promise<void> {
  try {
    const store = getStore();
    const supplier = await store.get("parties", order.supplierId);
    const terms = parseTerms(supplier?.paymentTerms ?? null);
    if (terms)
      await store.update("orders", order.id, { supplierPaymentTerms: terms });
  } catch (error) {
    console.warn("[supplier-terms] condição não copiada no pedido", error);
  }
}

/** Troca a condição do pedido pela atual do cadastro do fornecedor (só a Wellmix). */
export async function applySupplierTermsToOrder(
  user: User,
  orderId: string,
): Promise<void> {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new SupplierTermsError("not_found");
  const supplier = await store.get("parties", order.supplierId);
  const terms = parseTerms(supplier?.paymentTerms ?? null);
  if (!terms) throw new SupplierTermsError("terms_missing");
  const before = parseTerms(order.supplierPaymentTerms ?? null);
  await store.update("orders", orderId, { supplierPaymentTerms: terms });
  await audit(
    user,
    "order.payment_terms",
    "order",
    orderId,
    `Pedido #${order.number}: ${describe(terms)}`,
    { supplierPaymentTerms: before },
    { supplierPaymentTerms: terms },
  );
}

export interface OrderPayable {
  order: Order;
  supplier: Party | null;
  productName: string;
  schedule: SupplierSchedule;
  source: TermsSource | null;
}

/** Hoje (AAAA-MM-DD) em Brasília. */
export const todayInBrazil = () => brazilDay(new Date()) as string;

function payableFor(
  order: Order,
  supplier: Party | null,
  payments: Payment[],
  stages: Stage[],
  requirements: Requirement[],
  items: OrderItem[],
  today: string,
): OrderPayable {
  const { terms, source } = termsForOrder(order, supplier);
  const schedule = buildSupplierSchedule({
    total: order.fobTotal,
    currency: order.fobCurrency ?? "USD",
    terms,
    events: paymentEventsFor(order, stages, requirements),
    payments: payments.filter((p) => p.direction === "supplier_out"),
    today,
    cancelled: order.status === "CANCELLED",
  });
  return {
    order,
    supplier,
    productName: items[0]?.name ?? "—",
    schedule,
    source,
  };
}

/** Cronograma de pagamento de um pedido (card do pedido e valor a pagar agora). */
export async function orderPayable(order: Order): Promise<OrderPayable> {
  const store = getStore();
  const [supplier, payments, stages, items] = await Promise.all([
    store.get("parties", order.supplierId),
    store.list("payments", {
      filter: { orderId: order.id, direction: "supplier_out" },
    }),
    store.list("stages", {
      filter: { orderId: order.id, key: ["SHIPPING", "DELIVERED"] },
    }),
    store.list("order_items", { filter: { orderId: order.id }, limit: 1 }),
  ]);
  const requirements = await store.list("requirements", {
    filter: { orderId: order.id, key: "ship_date" },
  });
  return payableFor(
    order,
    supplier,
    payments,
    stages,
    requirements,
    items,
    todayInBrazil(),
  );
}

/**
 * Cronograma de todos os pedidos (Contas a pagar) ou de um fornecedor (conta
 * corrente dele). Pedido cancelado entra com as parcelas "canceladas" (o que
 * já foi pago continua aparecendo).
 */
export async function listPayables(
  filter: { supplierId?: string } = {},
): Promise<OrderPayable[]> {
  const store = getStore();
  const orders = await store.list("orders", {
    filter: filter.supplierId ? { supplierId: filter.supplierId } : undefined,
    orderBy: "number",
    direction: "desc",
  });
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const supplierIds = [...new Set(orders.map((o) => o.supplierId))];
  const [payments, stages, requirements, items, suppliers] = await Promise.all([
    store.list("payments", {
      filter: { orderId: ids, direction: "supplier_out" },
    }),
    store.list("stages", {
      filter: { orderId: ids, key: ["SHIPPING", "DELIVERED"] },
    }),
    store.list("requirements", { filter: { orderId: ids, key: "ship_date" } }),
    store.list("order_items", { filter: { orderId: ids } }),
    store.list("parties", { filter: { id: supplierIds } }),
  ]);
  const today = todayInBrazil();
  const by = <T extends { orderId: string | null }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.orderId) continue;
      map.set(row.orderId, [...(map.get(row.orderId) ?? []), row]);
    }
    return map;
  };
  const paymentsBy = by(payments);
  const stagesBy = by(stages);
  const reqsBy = by(requirements);
  const itemsBy = by(items);
  return orders.map((order) =>
    payableFor(
      order,
      suppliers.find((s) => s.id === order.supplierId) ?? null,
      paymentsBy.get(order.id) ?? [],
      stagesBy.get(order.id) ?? [],
      reqsBy.get(order.id) ?? [],
      itemsBy.get(order.id) ?? [],
      today,
    ),
  );
}

export interface PayableRow {
  payable: OrderPayable;
  installment: ScheduleInstallment;
}

/** Uma linha por parcela, na ordem de prioridade (vencidas primeiro, depois pela data). */
export function payableRows(payables: OrderPayable[]): PayableRow[] {
  const rows = payables.flatMap((payable) =>
    payable.schedule.installments.map((installment) => ({
      payable,
      installment,
    })),
  );
  const rank = (s: ScheduleInstallment["status"]) =>
    INSTALLMENT_STATUS_ORDER.indexOf(s);
  return rows.sort(
    (a, b) =>
      rank(a.installment.status) - rank(b.installment.status) ||
      (a.installment.dueDate ?? "9999").localeCompare(
        b.installment.dueDate ?? "9999",
      ) ||
      a.payable.order.number - b.payable.order.number ||
      a.installment.index - b.installment.index,
  );
}

/*
 * Pedidos parados na etapa de pagamento ao fornecedor (de antes da mudança)
 * seguem para a próxima etapa. Idempotente: depois da primeira passada não
 * sobra nenhum, e esta instância do servidor deixa de consultar.
 */
let releasedAll = false;

export async function releaseOffFlowStages(orderId?: string): Promise<number> {
  if (!orderId && releasedAll) return 0;
  const store = getStore();
  const stages = await store.list("stages", {
    filter: {
      key: [...OFF_FLOW_STAGES],
      status: "active",
      ...(orderId ? { orderId } : {}),
    },
  });
  for (const stage of stages) {
    await audit(
      null,
      "stage.off_flow",
      "stage",
      stage.id,
      `${stage.key}: fora do fluxo (condição de pagamento do fornecedor); o pedido segue`,
    );
    await evaluateStage(null, stage.id);
  }
  if (!orderId && stages.length === 0) releasedAll = true;
  return stages.length;
}

/**
 * Aviso diário à Wellmix (job de lembretes): parcelas vencidas e as que vencem
 * nos próximos dias, num resumo só, com link para Contas a pagar.
 */
export async function notifyPayablesDue(): Promise<number> {
  const rows = payableRows(await listPayables()).filter(
    (r) =>
      (r.installment.status === "overdue" ||
        r.installment.status === "due_soon") &&
      r.installment.open > 0,
  );
  if (!rows.length) return 0;
  const overdue = rows.filter((r) => r.installment.status === "overdue");
  const lines = rows
    .slice(0, 6)
    .map(
      (r) =>
        `#${r.payable.order.number} ${r.payable.supplier?.name ?? "—"} · parcela ${r.installment.index}/${r.installment.count} · ${r.payable.schedule.currency} ${r.installment.open.toFixed(2)} · ${r.installment.dueDate}`,
    );
  if (rows.length > lines.length)
    lines.push(`… e mais ${rows.length - lines.length}.`);
  await notify(
    { role: ["admin", "operator"] },
    {
      subject: overdue.length
        ? `Pagamento a fornecedores: ${overdue.length} parcela(s) vencida(s)`
        : `Pagamento a fornecedores: ${rows.length} parcela(s) vencem nos próximos dias`,
      body: lines.join("\n"),
      link: overdue.length ? "/app/payables?status=overdue" : "/app/payables",
    },
  );
  return rows.length;
}
