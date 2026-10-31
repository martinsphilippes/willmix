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
import { OFF_FLOW_STAGES, nextStageKey } from "@/lib/workflow/stages";
import {
  INSTALLMENT_STATUS_ORDER,
  MAX_TERM_DAYS,
  MAX_TERM_INSTALLMENTS,
  brazilDay,
  buildSupplierSchedule,
  installmentFromNote,
  parseTerms,
  paymentEventsFor,
  sortTerms,
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
  // Salva na ordem em que vencem: a parcela 1 é a primeira a vencer.
  const terms = input.terms.length ? parseTerms(sortTerms(input.terms)) : null;
  if (input.terms.length && !terms) {
    throw new SupplierTermsError(
      Math.round(termsTotal(input.terms) * 100) !== 10_000
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
  const [supplier, paid] = await Promise.all([
    store.get("parties", order.supplierId),
    store.list("payments", {
      filter: { orderId, direction: "supplier_out" },
      limit: 1,
    }),
  ]);
  const terms = parseTerms(supplier?.paymentTerms ?? null);
  if (!terms) throw new SupplierTermsError("terms_missing");
  // Com dinheiro já lançado pela condição do pedido, trocar a condição
  // mudaria a parcela que esse dinheiro pagou.
  if (paid.length) throw new SupplierTermsError("terms_has_payments");
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
  /**
   * Pedido antigo: quando o fornecedor confirmou o recebimento pela etapa de
   * pagamento. Pagamentos registrados até ali já foram recebidos; os
   * registrados depois seguem pedindo a confirmação dele.
   */
  legacyReceivedAt: string | null;
}

/** Itens da etapa antiga de pagamento: quem marcou, pagou no fluxo antigo. */
export const LEGACY_PAYMENT_KEYS = ["payment_registered", "payment_received"];

/**
 * Pedido de antes da mudança pago pela etapa "Pagamento ao fornecedor" (algum
 * item dela concluído). Os pedidos novos não têm itens nessa etapa, e liberar
 * um pedido parado não conclui item nenhum.
 */
function paidInOldFlow(requirements: Requirement[]) {
  return requirements.some(
    (r) => LEGACY_PAYMENT_KEYS.includes(r.key) && r.status === "done",
  );
}

/** Quando o fornecedor confirmou o recebimento pela etapa antiga (o mais recente). */
export function legacyReceivedAt(
  requirements: Array<
    Pick<Requirement, "key" | "status" | "submittedAt" | "updatedAt">
  >,
): string | null {
  const times = requirements
    .filter((r) => r.key === "payment_received" && r.status === "done")
    .map((r) => r.submittedAt ?? r.updatedAt)
    .filter((t): t is string => !!t)
    .sort();
  return times.at(-1) ?? null;
}

/** Pagamento que já existia quando o fornecedor confirmou pela etapa antiga. */
export function receivedInOldFlow(
  payment: Pick<Payment, "createdAt">,
  receivedAt: string | null,
): boolean {
  return (
    !!receivedAt && Date.parse(payment.createdAt) <= Date.parse(receivedAt)
  );
}

/** Requisitos que o cronograma usa: data de embarque e os itens da etapa antiga. */
const SCHEDULE_REQUIREMENT_KEYS = ["ship_date", ...LEGACY_PAYMENT_KEYS];

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
    payments: payments
      .filter((p) => p.direction === "supplier_out")
      .map((p) => ({
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        // "Parcela 1/2" gravado pelo portal liga o pagamento à parcela.
        installment: terms ? installmentFromNote(p.note, terms.length) : null,
      })),
    today,
    cancelled: order.status === "CANCELLED",
    legacySettled: paidInOldFlow(requirements),
  });
  return {
    order,
    supplier,
    productName: items[0]?.name ?? "—",
    schedule,
    source,
    legacyReceivedAt: legacyReceivedAt(requirements),
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
    filter: { orderId: order.id, key: SCHEDULE_REQUIREMENT_KEYS },
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
  // Com a chave presente (mesmo vazia), só os pedidos daquele fornecedor.
  const orders = await store.list("orders", {
    filter:
      "supplierId" in filter
        ? { supplierId: filter.supplierId ?? "" }
        : undefined,
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
    store.list("requirements", {
      filter: { orderId: ids, key: SCHEDULE_REQUIREMENT_KEYS },
    }),
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

/** Última passada geral sem nada a liberar (nesta instância do servidor). */
let quietSince = 0;
/** Telas não repetem a passada geral antes disso; o job diário sempre passa. */
const QUIET_MS = 10 * 60_000;
/** Passada em andamento nesta instância: chamadas ao mesmo tempo esperam a mesma. */
const inflight = new Map<string, Promise<number>>();
/** Etapa sendo liberada agora: a passada geral e a do pedido não liberam duas vezes. */
const releasing = new Map<string, Promise<boolean>>();

async function releaseStageOnce(stage: Stage): Promise<boolean> {
  const store = getStore();
  // Lê de novo: outra chamada pode ter liberado enquanto esta esperava.
  const fresh = await store.get("stages", stage.id);
  if (!fresh) return false;
  const order = await store.get("orders", fresh.orderId);
  const open = fresh.status === "active" || fresh.status === "blocked";
  let stuck = false;
  if (fresh.status === "done" && order?.status === fresh.key) {
    // Concluída, mas o pedido ainda está nela: só se a próxima não começou.
    const next = nextStageKey(fresh.key);
    const [nextStage] = next
      ? await store.list("stages", {
          filter: { orderId: fresh.orderId, key: next },
          limit: 1,
        })
      : [];
    stuck = !nextStage || nextStage.status === "pending";
  }
  if (!open && !stuck) return false;
  await audit(
    null,
    "stage.off_flow",
    "stage",
    fresh.id,
    `${fresh.key}: fora do fluxo (condição de pagamento do fornecedor); o pedido segue`,
  );
  if (fresh.status !== "active")
    await store.update("stages", fresh.id, {
      status: "active",
      blockReason: null,
    });
  await evaluateStage(null, fresh.id);
  return true;
}

function releaseStage(stage: Stage): Promise<boolean> {
  const running = releasing.get(stage.id);
  if (running) return running.then(() => false);
  const job = releaseStageOnce(stage).finally(() => releasing.delete(stage.id));
  releasing.set(stage.id, job);
  return job;
}

async function runRelease(orderId?: string): Promise<number> {
  const store = getStore();
  let stages: Stage[];
  if (orderId) {
    stages = await store.list("stages", {
      filter: { orderId, key: [...OFF_FLOW_STAGES] },
    });
  } else {
    // Etapas abertas e pedidos que ainda estão nela (etapa já concluída).
    const [openStages, stuckOrders] = await Promise.all([
      store.list("stages", {
        filter: { key: [...OFF_FLOW_STAGES], status: ["active", "blocked"] },
      }),
      store.list("orders", { filter: { status: [...OFF_FLOW_STAGES] } }),
    ]);
    const stuckStages = stuckOrders.length
      ? await store.list("stages", {
          filter: {
            orderId: stuckOrders.map((o) => o.id),
            key: [...OFF_FLOW_STAGES],
          },
        })
      : [];
    stages = [
      ...new Map(
        [...openStages, ...stuckStages].map((st) => [st.id, st]),
      ).values(),
    ];
  }
  let released = 0;
  let failed = false;
  for (const stage of stages) {
    try {
      if (await releaseStage(stage)) released++;
    } catch (error) {
      failed = true;
      // Um pedido com problema não segura os outros nem a tela.
      console.error("[supplier-terms] etapa não liberada", stage.id, error);
    }
  }
  // Nada liberado e nada falhou (inclusive pedido que não há o que refazer):
  // as telas esperam 10 minutos para olhar de novo.
  if (!orderId) quietSince = released === 0 && !failed ? Date.now() : 0;
  return released;
}

/**
 * Pedidos parados na etapa de pagamento ao fornecedor (de antes da mudança)
 * seguem para a próxima etapa. Idempotente e sem erro para quem chama (falha
 * vai para o log). Telas chamam à vontade: depois de uma passada geral sem
 * nada a liberar, esta instância espera 10 minutos para olhar de novo; o job
 * diário (`force`) sempre olha.
 */
export async function releaseOffFlowStages(
  orderId?: string,
  opts: { force?: boolean } = {},
): Promise<number> {
  if (!orderId && !opts.force && Date.now() - quietSince < QUIET_MS) return 0;
  const key = orderId ?? "*";
  const running = inflight.get(key);
  if (running) return running;
  const job = runRelease(orderId)
    .catch((error) => {
      console.error("[supplier-terms] liberação falhou", error);
      return 0;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

const PAYABLES_DIGEST_SUBJECT = "Pagamento a fornecedores:";
const CONFIRM_REMINDER_SUBJECT = "Wellmix: please confirm receipt of";

/**
 * Já mandou este aviso nas últimas 20 horas? Olha o histórico de e-mail
 * (o in-app pode ser apagado pelo usuário; o e-mail fica como registro).
 */
async function sentRecently(
  target: { partyId: string } | { role: Array<"admin" | "operator"> },
  subjectPrefix: string,
): Promise<boolean> {
  // Relógio real: o que conta é quando o aviso saiu de fato.
  const since = Date.now() - 20 * 3_600_000;
  const rows = await getStore().list("notifications", {
    filter: { channel: "email", ...target },
    orderBy: "createdAt",
    direction: "desc",
    limit: 200,
  });
  return rows.some(
    (n) =>
      n.subject.startsWith(subjectPrefix) && Date.parse(n.createdAt) > since,
  );
}

/**
 * Aviso diário à Wellmix (job de lembretes): parcelas vencidas e as que vencem
 * nos próximos dias, num resumo só, com link para Contas a pagar.
 */
export async function notifyPayablesDue(): Promise<number> {
  // Job chamado duas vezes no mesmo dia: um resumo só.
  if (await sentRecently({ role: ["admin"] }, PAYABLES_DIGEST_SUBJECT))
    return 0;
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
    { role: ["admin"] },
    {
      kind: overdue.length ? "alert" : "action",
      actor: "recipient",
      subject: overdue.length
        ? `${PAYABLES_DIGEST_SUBJECT} ${overdue.length} parcela(s) vencida(s)`
        : `${PAYABLES_DIGEST_SUBJECT} ${rows.length} parcela(s) vencem nos próximos dias`,
      body: lines.join("\n"),
      link: overdue.length ? "/app/payables?status=overdue" : "/app/payables",
    },
  );
  return rows.length;
}

/**
 * Lembrete diário ao fornecedor (job de lembretes): pagamentos que a Wellmix
 * marcou como pagos há mais de 3 dias e que ele ainda não confirmou ter
 * recebido. Um aviso por fornecedor, com link para a conta corrente. Pedidos
 * cancelados e os antigos já confirmados pela etapa ficam de fora.
 */
export async function notifySuppliersToConfirm(
  now = new Date(),
): Promise<number> {
  const store = getStore();
  const limit = now.getTime() - 3 * 86_400_000;
  const paid = (
    await store.list("payments", {
      filter: { direction: "supplier_out", status: "confirmed" },
    })
  ).filter((p) => p.orderId && Date.parse(p.updatedAt) < limit);
  if (!paid.length) return 0;
  const orderIds = [...new Set(paid.map((p) => p.orderId as string))];
  const [orders, oldConfirmed] = await Promise.all([
    store.list("orders", { filter: { id: orderIds } }),
    store.list("requirements", {
      filter: { orderId: orderIds, key: "payment_received", status: "done" },
    }),
  ]);
  const bySupplier = new Map<string, string[]>();
  for (const p of paid) {
    const order = orders.find((o) => o.id === p.orderId);
    if (!order || order.status === "CANCELLED") continue;
    // Já recebido pela etapa antiga (pagamento anterior à confirmação dela).
    const receivedAt = legacyReceivedAt(
      oldConfirmed.filter((r) => r.orderId === order.id),
    );
    if (receivedInOldFlow(p, receivedAt)) continue;
    bySupplier.set(order.supplierId, [
      ...(bySupplier.get(order.supplierId) ?? []),
      `#${order.number} ${p.currency} ${p.amount.toFixed(2)}`,
    ]);
  }
  let sent = 0;
  for (const [supplierId, lines] of bySupplier) {
    // Job chamado duas vezes no mesmo dia: um lembrete só.
    if (await sentRecently({ partyId: supplierId }, CONFIRM_REMINDER_SUBJECT))
      continue;
    await notify(
      { role: "supplier", partyId: supplierId },
      {
        kind: "action",
        subject: `${CONFIRM_REMINDER_SUBJECT} ${lines.length} payment(s)`,
        body: lines.slice(0, 6).join("\n"),
        link: "/app/account",
      },
    );
    sent++;
  }
  return sent;
}
