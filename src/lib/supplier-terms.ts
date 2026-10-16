import {
  PAYMENT_TERM_BASES,
  type PaymentStatus,
  type PaymentTermBase,
  type PaymentTermInstallment,
} from "@/lib/db/schema";

/*
 * Condição de pagamento da Wellmix ao fornecedor: parcelas em % do FOB, cada
 * uma N dias depois de um marco (pedido gerado, embarque, entrega ao cliente).
 * Aqui só contas puras (sem banco): a condição gravada é conferida, os marcos
 * do pedido viram datas, e os pagamentos já lançados são distribuídos pelas
 * parcelas na ordem (o primeiro dinheiro quita a primeira parcela).
 */

export const MAX_TERM_INSTALLMENTS = 6;
export const MAX_TERM_DAYS = 720;
/** "Vence em breve": até tantos dias à frente. */
export const DUE_SOON_DAYS = 7;

const cents = (n: number) => Math.round(n * 100) / 100;
/** Tolerância de centavos (conta em ponto flutuante). */
const EPS = 0.005;

export function termsTotal(terms: PaymentTermInstallment[]): number {
  return cents(terms.reduce((sum, term) => sum + term.percent, 0));
}

/**
 * Lê a condição gravada (JSON do banco) e devolve só uma condição válida:
 * 1 a 6 parcelas, cada uma com 0 < % ≤ 100, marco conhecido e 0 a 720 dias,
 * somando 100%. Qualquer outra coisa conta como "não configurada".
 */
export function parseTerms(raw: unknown): PaymentTermInstallment[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.length > MAX_TERM_INSTALLMENTS) return null;
  const out: PaymentTermInstallment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { percent, base, days } = item as Record<string, unknown>;
    if (
      typeof percent !== "number" ||
      !Number.isFinite(percent) ||
      !(percent > 0) ||
      percent > 100
    )
      return null;
    if (
      typeof base !== "string" ||
      !(PAYMENT_TERM_BASES as readonly string[]).includes(base)
    )
      return null;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 0 ||
      days > MAX_TERM_DAYS
    )
      return null;
    out.push({ percent: cents(percent), base: base as PaymentTermBase, days });
  }
  if (Math.abs(termsTotal(out) - 100) > 0.01) return null;
  return out;
}

export function sameTerms(
  a: PaymentTermInstallment[] | null,
  b: PaymentTermInstallment[] | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.length === b.length &&
    a.every(
      (term, i) =>
        term.percent === b[i].percent &&
        term.base === b[i].base &&
        term.days === b[i].days,
    )
  );
}

/** Dia (AAAA-MM-DD) no fuso de Brasília; data pura (AAAA-MM-DD) vale como está. */
export function brazilDay(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Soma dias corridos a um dia AAAA-MM-DD. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Data de cada marco do pedido (AAAA-MM-DD); nulo = ainda não aconteceu. */
export type PaymentEvents = Record<PaymentTermBase, string | null>;

interface EventStage {
  id: string;
  key: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface EventRequirement {
  stageId: string;
  key: string;
  status: string;
  value: string | null;
}

/**
 * Marcos do pedido:
 * - pedido gerado: criação do pedido;
 * - embarque: a "Data de embarque" informada no embarque (ou, sem ela, o dia
 *   em que a etapa de embarque foi concluída);
 * - entrega ao cliente: o dia em que a entrega foi registrada (início da
 *   etapa "Entregue"; sem ele, a conclusão dela).
 */
export function paymentEventsFor(
  order: { createdAt: string },
  stages: EventStage[],
  requirements: EventRequirement[],
): PaymentEvents {
  const shipping = stages.find((s) => s.key === "SHIPPING");
  const delivered = stages.find((s) => s.key === "DELIVERED");
  const shipDate = shipping
    ? requirements.find(
        (r) =>
          r.stageId === shipping.id &&
          r.key === "ship_date" &&
          r.status === "done" &&
          !!r.value &&
          /^\d{4}-\d{2}-\d{2}/.test(r.value),
      )?.value
    : null;
  const deliveredStarted =
    delivered &&
    (delivered.status === "active" ||
      delivered.status === "blocked" ||
      delivered.status === "done")
      ? (delivered.startedAt ?? delivered.completedAt)
      : null;
  return {
    order_created: brazilDay(order.createdAt),
    shipped: shipDate
      ? shipDate.slice(0, 10)
      : shipping?.status === "done"
        ? brazilDay(shipping.completedAt)
        : null,
    delivered: brazilDay(deliveredStarted),
  };
}

export type InstallmentStatus =
  /** Paga e o fornecedor confirmou o recebimento. */
  | "received"
  /** Paga (registrada como paga pela Wellmix), aguardando o fornecedor confirmar. */
  | "paid"
  /** Pedida ao banco/financeiro, ainda não confirmada como paga. */
  | "requested"
  | "overdue"
  | "due_soon"
  | "scheduled"
  /** O marco (embarque/entrega) ainda não aconteceu: sem data. */
  | "waiting"
  /** Pedido cancelado: o acerto é livre, nada mais vence pelo sistema. */
  | "cancelled";

export interface ScheduleInstallment {
  /** 1, 2, 3… */
  index: number;
  count: number;
  percent: number;
  base: PaymentTermBase;
  days: number;
  amount: number;
  /** Pago (confirmado pela Wellmix ou recebido) nesta parcela. */
  paid: number;
  /** Pedido ao banco/financeiro, sem confirmação ainda. */
  requested: number;
  /** Falta pagar ou pedir. */
  open: number;
  /** Vencimento (AAAA-MM-DD); nulo enquanto o marco não acontece. */
  dueDate: string | null;
  status: InstallmentStatus;
}

export interface SupplierSchedule {
  currency: string;
  total: number | null;
  terms: PaymentTermInstallment[] | null;
  installments: ScheduleInstallment[];
  /** Totais do pedido, na moeda do FOB. */
  paid: number;
  requested: number;
  open: number;
  /** Próxima parcela com valor em aberto (a que se paga agora). */
  next: ScheduleInstallment | null;
}

export interface SchedulePayment {
  amount: number;
  currency: string;
  status: PaymentStatus;
}

/** Ordem de prioridade (a lista de contas a pagar começa pelo que venceu). */
export const INSTALLMENT_STATUS_ORDER: InstallmentStatus[] = [
  "overdue",
  "due_soon",
  "scheduled",
  "waiting",
  "requested",
  "paid",
  "received",
  "cancelled",
];

export function buildSupplierSchedule(input: {
  total: number | null;
  currency: string;
  terms: PaymentTermInstallment[] | null;
  events: PaymentEvents;
  /** Pagamentos ao fornecedor deste pedido (outras moedas não entram na conta). */
  payments: SchedulePayment[];
  /** Hoje (AAAA-MM-DD, Brasília). */
  today: string;
  cancelled: boolean;
}): SupplierSchedule {
  const currency = input.currency.toUpperCase();
  const same = input.payments.filter(
    (p) => p.currency.toUpperCase() === currency && p.amount > 0,
  );
  const sum = (status: PaymentStatus) =>
    cents(
      same.filter((p) => p.status === status).reduce((s, p) => s + p.amount, 0),
    );
  const received = sum("received");
  const confirmed = sum("confirmed");
  const pending = sum("pending");
  const paidTotal = cents(received + confirmed);

  if (input.total === null || !input.terms) {
    const open =
      input.total === null || input.cancelled
        ? 0
        : Math.max(0, cents(input.total - paidTotal - pending));
    return {
      currency,
      total: input.total,
      terms: input.terms,
      installments: [],
      paid: paidTotal,
      requested: pending,
      open,
      next: null,
    };
  }

  const total = input.total;
  const terms = input.terms;
  // Valor de cada parcela; a última fica com o resto (a soma bate com o FOB).
  const amounts = terms.map((term) => cents((total * term.percent) / 100));
  amounts[amounts.length - 1] = cents(
    total - amounts.slice(0, -1).reduce((s, a) => s + a, 0),
  );
  // Distribui o dinheiro na ordem das parcelas: recebido, depois pago, depois pedido.
  let receivedLeft = received;
  let confirmedLeft = confirmed;
  let pendingLeft = pending;
  const soon = addDays(input.today, DUE_SOON_DAYS);
  const installments = terms.map((term, i): ScheduleInstallment => {
    const amount = amounts[i];
    let need = Math.max(0, amount);
    const take = (left: number) => {
      const used = Math.min(left, need);
      need = cents(need - used);
      return cents(used);
    };
    const fromReceived = take(receivedLeft);
    receivedLeft = cents(receivedLeft - fromReceived);
    const fromConfirmed = take(confirmedLeft);
    confirmedLeft = cents(confirmedLeft - fromConfirmed);
    const fromPending = take(pendingLeft);
    pendingLeft = cents(pendingLeft - fromPending);
    const paid = cents(fromReceived + fromConfirmed);
    const event = input.events[term.base];
    const dueDate = event ? addDays(event, term.days) : null;
    const status: InstallmentStatus =
      fromReceived >= amount - EPS
        ? "received"
        : paid >= amount - EPS
          ? "paid"
          : input.cancelled
            ? "cancelled"
            : paid + fromPending >= amount - EPS
              ? "requested"
              : !dueDate
                ? "waiting"
                : dueDate < input.today
                  ? "overdue"
                  : dueDate <= soon
                    ? "due_soon"
                    : "scheduled";
    return {
      index: i + 1,
      count: terms.length,
      percent: term.percent,
      base: term.base,
      days: term.days,
      amount,
      paid,
      requested: fromPending,
      open: status === "cancelled" ? 0 : need,
      dueDate,
      status,
    };
  });
  return {
    currency,
    total,
    terms,
    installments,
    paid: paidTotal,
    requested: pending,
    open: cents(installments.reduce((s, i) => s + i.open, 0)),
    next: installments.find((i) => i.open > EPS) ?? null,
  };
}
