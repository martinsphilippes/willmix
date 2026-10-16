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

/** Soma exatamente 100% (em centésimos de ponto percentual, sem erro de conta). */
export function sumsTo100(terms: PaymentTermInstallment[]): boolean {
  return Math.round(termsTotal(terms) * 100) === 10_000;
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
    // Vale o que se grava (centésimos): 0,001% vira 0 e é recusado.
    const rounded = cents(percent);
    if (!(rounded > 0)) return null;
    out.push({ percent: rounded, base: base as PaymentTermBase, days });
  }
  if (!sumsTo100(out)) return null;
  return out;
}

/** Ordem dos marcos no pedido: pedido gerado, embarque, entrega. */
const BASE_RANK: Record<PaymentTermBase, number> = {
  order_created: 0,
  shipped: 1,
  delivered: 2,
};

/**
 * Parcelas na ordem em que vencem (marco, depois dias): a condição é salva
 * assim, e a parcela 1 é sempre a primeira a vencer.
 */
export function sortTerms(
  terms: PaymentTermInstallment[],
): PaymentTermInstallment[] {
  return terms
    .map((term, i) => ({ term, i }))
    .sort(
      (a, b) =>
        BASE_RANK[a.term.base] - BASE_RANK[b.term.base] ||
        a.term.days - b.term.days ||
        a.i - b.i,
    )
    .map(({ term }) => term);
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
  /**
   * Pedido de antes da mudança que já passou pela etapa "Pagamento ao
   * fornecedor" (pago no fluxo antigo): nada a pagar pelo cronograma.
   */
  legacySettled: boolean;
}

export interface SchedulePayment {
  amount: number;
  currency: string;
  status: PaymentStatus;
  /**
   * Parcela a que o pagamento foi feito (1, 2…), quando se sabe (pagamento
   * da parcela da vez, "Parcela 1/2"). Sem ela, o dinheiro quita as parcelas
   * na ordem da condição.
   */
  installment?: number | null;
}

/** "Parcela 2/3" (nota que o portal grava no pagamento) → 2, se a condição tem 3 parcelas. */
export function installmentFromNote(
  note: string | null | undefined,
  count: number,
): number | null {
  const m = /^Parcela (\d{1,2})\/(\d{1,2})$/.exec(note?.trim() ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return Number(m[2]) === count && n >= 1 && n <= count ? n : null;
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
  /** Pago no fluxo antigo (etapa de pagamento concluída pelos itens dela). */
  legacySettled?: boolean;
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

  if (input.total === null || !input.terms || input.legacySettled) {
    const open =
      input.total === null || input.cancelled || input.legacySettled
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
      legacySettled: !!input.legacySettled,
    };
  }

  const total = input.total;
  const terms = input.terms;
  // Valor de cada parcela; a última fica com o resto (a soma bate com o FOB).
  const amounts = terms.map((term) => cents((total * term.percent) / 100));
  amounts[amounts.length - 1] = cents(
    total - amounts.slice(0, -1).reduce((s, a) => s + a, 0),
  );
  const soon = addDays(input.today, DUE_SOON_DAYS);
  const dueDates = terms.map((term) => {
    const event = input.events[term.base];
    return event ? addDays(event, term.days) : null;
  });
  /*
   * Ordem fixa da condição (marco, dias, posição): não muda quando as datas
   * dos marcos chegam, então uma parcela paga não volta a ficar em aberto.
   */
  const fixed = terms
    .map((_, i) => i)
    .sort(
      (a, b) =>
        BASE_RANK[terms[a].base] - BASE_RANK[terms[b].base] ||
        terms[a].days - terms[b].days ||
        a - b,
    );
  const STATUSES: PaymentStatus[] = ["received", "confirmed", "pending"];
  const need = amounts.map((a) => Math.max(0, a));
  const got: Record<PaymentStatus, number[]> = {
    received: terms.map(() => 0),
    confirmed: terms.map(() => 0),
    pending: terms.map(() => 0),
  };
  const pool: Record<PaymentStatus, number> = {
    received: 0,
    confirmed: 0,
    pending: 0,
  };
  const fill = (status: PaymentStatus, i: number, money: number) => {
    const used = cents(Math.min(money, need[i]));
    need[i] = cents(need[i] - used);
    got[status][i] = cents(got[status][i] + used);
    return cents(money - used);
  };
  // 1) Pagamento feito para uma parcela quita aquela parcela; o que sobra
  //    vai para o caixa comum.
  for (const status of STATUSES)
    for (const p of same.filter((x) => x.status === status)) {
      const k = p.installment ?? 0;
      const left =
        k >= 1 && k <= terms.length ? fill(status, k - 1, p.amount) : p.amount;
      pool[status] = cents(pool[status] + left);
    }
  // 2) O resto quita as parcelas na ordem da condição: recebido, pago, pedido.
  for (const status of STATUSES)
    for (const i of fixed) pool[status] = fill(status, i, pool[status]);

  const byIndex: ScheduleInstallment[] = terms.map((term, i) => {
    const amount = amounts[i];
    const fromReceived = got.received[i];
    const paid = cents(fromReceived + got.confirmed[i]);
    const fromPending = got.pending[i];
    const dueDate = dueDates[i];
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
      open: status === "cancelled" ? 0 : need[i],
      dueDate,
      status,
    };
  });
  // A da vez: a primeira a vencer (data; sem data por último) com valor em aberto.
  const dueOrder = [...fixed].sort(
    (a, b) =>
      (dueDates[a] ?? "9999-12-31").localeCompare(
        dueDates[b] ?? "9999-12-31",
      ) || fixed.indexOf(a) - fixed.indexOf(b),
  );
  const installments = byIndex;
  return {
    currency,
    total,
    terms,
    installments,
    paid: paidTotal,
    requested: pending,
    open: cents(installments.reduce((s, i) => s + i.open, 0)),
    // A da vez é a primeira a vencer que ainda tem valor em aberto.
    next:
      dueOrder.map((i) => installments[i]).find((i) => i.open > EPS) ?? null,
    legacySettled: false,
  };
}
