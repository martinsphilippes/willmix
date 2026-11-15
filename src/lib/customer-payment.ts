/*
 * Forma de pagamento do cliente no pedido (dono, 15/11/2026;
 * docs/CUSTOMER_PAYMENT.md). Só a conta, sem banco: cada parcela é um
 * percentual da venda ao cliente que vence num evento do pedido (no pedido,
 * no embarque, na Presença de Carga, na entrega) mais N dias. Parcela depois
 * da entrega (evento "entrega" com dias) paga juros compostos ao mês da
 * forma de pagamento: valor × (1 + juros)^(dias ÷ 30).
 */

export const PAYMENT_PLAN_EVENTS = [
  "order",
  "shipment",
  "cargo_presence",
  "delivery",
] as const;
export type PaymentPlanEvent = (typeof PAYMENT_PLAN_EVENTS)[number];

export interface PaymentPlanInstallment {
  /** Percentual da venda (0 a 100; 0 = só marca o evento, sem cobrança). */
  percent: number;
  event: PaymentPlanEvent;
  /** Dias depois do evento (0 = no evento). */
  days: number;
}

/** Situação da forma escolhida no pedido (alçada). */
import { PAYMENT_PLAN_STATUSES } from "@/lib/db/schema";
export { PAYMENT_PLAN_STATUSES };
export type PaymentPlanStatus = (typeof PAYMENT_PLAN_STATUSES)[number];

/** Forma de pagamento escolhida no pedido (cópia da forma no momento da escolha). */
export interface OrderPaymentPlan {
  planId: string;
  name: string;
  installments: PaymentPlanInstallment[];
  monthlyInterestPercent: number | null;
  requiresApproval: boolean;
  approverUserId: string | null;
  status: PaymentPlanStatus;
  chosenByUserId: string;
  chosenAt: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** NUNOTA do pedido de venda no Sankhya (os boletos são títulos dele). */
  saleNunota: string | null;
}

/** Boleto de uma parcela (lido do Sankhya ou registrado à mão pelo financeiro). */
export interface CustomerCharge {
  /** Parcela (1, 2, 3… na ordem da forma). */
  index: number;
  source: "sankhya" | "manual";
  /** NUFIN do título no Sankhya (TGFFIN). */
  nufin: string | null;
  dueDate: string | null;
  amount: number | null;
  nossoNumero: string | null;
  /** Linha digitável ou código de barras. */
  barcode: string | null;
  /** PDF do boleto (documents). */
  documentId: string | null;
  status: "open" | "paid";
  paidAt: string | null;
  updatedAt: string;
  /** Última cobrança enviada ao cliente. */
  chargedAt?: string | null;
}

/** Avisos já enviados por parcela ("gerar o boleto"), para não repetir. */
export interface ChargeNotices {
  [index: string]: string;
}

/** Centavo, meio para cima (7.211,575 → 7.211,58, sem o erro do ponto flutuante). */
const round2 = (n: number) =>
  Math.round(Number((n * 100).toPrecision(12))) / 100;

/** Soma dos percentuais (a forma vale com 100%). */
export function planPercent(installments: readonly PaymentPlanInstallment[]) {
  return round2(installments.reduce((s, i) => s + i.percent, 0));
}

/**
 * Confere uma forma: 1 a 12 parcelas, percentuais de 0 a 100 somando 100,
 * dias de 0 a 720, juros de 0 a 20% ao mês. Devolve o motivo ou nulo.
 */
export function planProblem(input: {
  installments: readonly PaymentPlanInstallment[];
  monthlyInterestPercent: number | null;
  requiresApproval: boolean;
  approverUserId: string | null;
}): string | null {
  const list = input.installments;
  if (!list.length || list.length > 12) return "plan_installments";
  for (const i of list) {
    if (!PAYMENT_PLAN_EVENTS.includes(i.event)) return "plan_event";
    if (!Number.isFinite(i.percent) || i.percent < 0 || i.percent > 100)
      return "plan_percent";
    if (!Number.isInteger(i.days) || i.days < 0 || i.days > 720)
      return "plan_days";
  }
  if (Math.abs(planPercent(list) - 100) > 0.001) return "plan_total";
  const rate = input.monthlyInterestPercent;
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 20))
    return "plan_interest";
  if (input.requiresApproval && !input.approverUserId) return "plan_approver";
  return null;
}

/** Parcela depois da entrega: a única que paga juros (dono, 15/11/2026). */
export const afterDelivery = (i: PaymentPlanInstallment) =>
  i.event === "delivery" && i.days > 0;

/** Juros compostos ao mês sobre `days` dias (mês de 30 dias). */
export function withInterest(
  amount: number,
  monthlyPercent: number | null,
  days: number,
): number {
  if (!monthlyPercent || monthlyPercent <= 0 || days <= 0)
    return round2(amount);
  return round2(amount * Math.pow(1 + monthlyPercent / 100, days / 30));
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Datas (AAAA-MM-DD) em que cada evento aconteceu; nulo = ainda não. */
export type PaymentEventDates = Record<PaymentPlanEvent, string | null>;

export type InstallmentState =
  | "no_charge" // 0%: só marca o evento
  | "waiting_event" // o evento ainda não aconteceu
  | "to_issue" // chegou o momento: o financeiro gera o boleto no Sankhya
  | "issued" // boleto em aberto
  | "overdue" // boleto vencido sem baixa
  | "paid";

export interface InstallmentView {
  index: number;
  percent: number;
  event: PaymentPlanEvent;
  days: number;
  /** Percentual × venda. */
  base: number | null;
  /** Juros (depois da entrega). */
  interest: number | null;
  amount: number | null;
  eventDate: string | null;
  dueDate: string | null;
  state: InstallmentState;
  charge: CustomerCharge | null;
}

/**
 * As parcelas da forma no pedido: valor (venda × %, mais juros depois da
 * entrega), data do evento, vencimento e situação do boleto.
 *
 * O momento de gerar o boleto é o do evento: a parcela "no pedido" assim que
 * a forma vale; "no embarque" quando o pedido embarca; e assim por diante. A
 * parcela com dias depois do evento entra em "gerar boleto" no evento também
 * (o boleto já sai com o vencimento adiante).
 */
export function customerSchedule(input: {
  installments: readonly PaymentPlanInstallment[];
  monthlyInterestPercent: number | null;
  /** Venda ao cliente (orders.sellPrice); nulo sem venda gravada. */
  sellTotal: number | null;
  events: PaymentEventDates;
  charges: readonly CustomerCharge[];
  /** Hoje (AAAA-MM-DD). */
  today: string;
}): InstallmentView[] {
  return input.installments.map((i, k) => {
    const index = k + 1;
    const charge = input.charges.find((c) => c.index === index) ?? null;
    const base =
      input.sellTotal === null
        ? null
        : round2((input.sellTotal * i.percent) / 100);
    const amount =
      base === null
        ? null
        : afterDelivery(i)
          ? withInterest(base, input.monthlyInterestPercent, i.days)
          : base;
    const eventDate = input.events[i.event];
    const dueDate =
      charge?.dueDate ?? (eventDate ? addDays(eventDate, i.days) : null);
    const state: InstallmentState =
      i.percent <= 0
        ? "no_charge"
        : charge?.status === "paid"
          ? "paid"
          : charge
            ? dueDate && dueDate < input.today
              ? "overdue"
              : "issued"
            : !eventDate
              ? "waiting_event"
              : "to_issue";
    return {
      index,
      percent: i.percent,
      event: i.event,
      days: i.days,
      base,
      interest: amount !== null && base !== null ? round2(amount - base) : null,
      amount,
      eventDate,
      dueDate,
      state,
      charge,
    };
  });
}

/**
 * Títulos do Sankhya → boletos das parcelas: os títulos a receber do pedido
 * de venda, na ordem do vencimento (e do desdobramento), vão para as
 * parcelas com valor, na ordem. Título sobrando fica de fora.
 */
export function chargesFromTitles(
  installments: readonly PaymentPlanInstallment[],
  titles: ReadonlyArray<Omit<CustomerCharge, "index" | "source" | "updatedAt">>,
  now: string,
): CustomerCharge[] {
  const payable = installments
    .map((i, k) => ({ i, index: k + 1 }))
    .filter((x) => x.i.percent > 0);
  return payable.slice(0, titles.length).map((x, k) => ({
    ...titles[k],
    index: x.index,
    source: "sankhya" as const,
    updatedAt: now,
  }));
}
