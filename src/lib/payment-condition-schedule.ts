import type { PaymentPlanEvent } from "@/lib/customer-payment";

/*
 * Parcelas de uma condição de pagamento do Sankhya (tipos de negociação,
 * VW_AD_TIPONEGOCIACAO_WELL; dono, 21/11/2026). A condição pode vencer:
 *
 * - por tempo: dias depois da emissão da nota ("30/60/90 DIAS", "30 A 120
 *   DIAS / VENCIM. DIARIOS", "A VISTA");
 * - por evento do fluxo do portal, a mesma estrutura das formas de pagamento
 *   do cliente (docs/CUSTOMER_PAYMENT.md): "10% SIN, 40% EMB, 50% REGISTRO".
 *
 * As parcelas saem da descrição (ou da regra escrita pelo administrador, no
 * mesmo formato). O que não dá para ler fica "a revisar", sem inventar parcela.
 */

/** Base do vencimento: a nota (tempo) ou um evento do pedido. */
export const CONDITION_BASES = [
  "invoice",
  "order",
  "shipment",
  "cargo_presence",
  "delivery",
] as const;
export type ConditionBase = "invoice" | PaymentPlanEvent;

export interface ConditionInstallment {
  /** Percentual do valor (0 a 100). */
  percent: number;
  base: ConditionBase;
  /** Dias depois da base (0 = na base). */
  days: number;
}

export type ConditionKind = "time" | "event";

export interface ConditionSchedule {
  /** Nulo = não deu para ler (a revisar). */
  kind: ConditionKind | null;
  installments: ConditionInstallment[];
  /** Motivo de revisar (soma diferente de 100, trecho não entendido). */
  problem: "unreadable" | "percent_sum" | null;
}

/** Até quantas parcelas uma faixa ("30 A 120, VENC DIARIOS") gera. */
export const MAX_CONDITION_INSTALLMENTS = 120;

const round2 = (n: number) => Math.round(n * 100) / 100;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Percentuais iguais que somam 100 (o resto do arredondamento na última). */
function evenSplit(days: number[], base: ConditionBase): ConditionInstallment[] {
  if (!days.length) return [];
  const each = Math.floor((100 / days.length) * 100) / 100;
  return days.map((d, i) => ({
    percent:
      i === days.length - 1 ? round2(100 - each * (days.length - 1)) : each,
    base,
    days: d,
  }));
}

/** Evento do fluxo citado no trecho (sinal, embarque, registro, entrega). */
function eventOf(part: string): PaymentPlanEvent | null {
  if (/\b(REGISTRO|PRESENCA|DI\b|DESEMBARACO)/.test(part))
    return "cargo_presence";
  if (/\b(ENTREGA|DELIVERY|RECEBIMENTO)/.test(part)) return "delivery";
  if (/\b(EMB|EMBQ|EMBARQUE|SHIP\w*|CARREGAMENTO|LOADING|BL)\b/.test(part))
    return "shipment";
  if (/\b(SIN|SINAL|ANT|ANTECIPADO|ADIANTAMENTO|PEDIDO|ORDER)\b/.test(part))
    return "order";
  return null;
}

/** Faixa "30 A 120 ... DIARIOS / DE 3 EM 3 / INTERV 3 / 7 EM 7". */
function rangeDays(text: string): number[] | null {
  const m = text.match(/\b(\d{1,3}) ?(?:A|ATE|-) ?(\d{1,3})\b/);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (!(to > from)) return null;
  let step: number | null = null;
  if (/DIARI/.test(text)) step = 1;
  const every = text.match(/\b(\d{1,2}) EM \1\b/);
  if (every) step = Number(every[1]);
  const interval = text.match(/INTERV\w*\.? ?(\d{1,2})/);
  if (interval) step = Number(interval[1]);
  if (!step) return null;
  const days: number[] = [];
  for (let d = from; d <= to; d += step) days.push(d);
  if (days[days.length - 1] !== to) days.push(to);
  return days.length <= MAX_CONDITION_INSTALLMENTS ? days : null;
}

/** Trechos com percentual: "10% SIN", "80% 150 DAYS AFTER SHIPPING". */
function percentParts(text: string): ConditionInstallment[] | null {
  const re = /(\d{1,3}(?:[.,]\d+)?) ?%/g;
  const marks = [...text.matchAll(re)];
  if (!marks.length) return null;
  const out: ConditionInstallment[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : text.length;
    const part = text.slice(start, end);
    const percent = Number(marks[i][1].replace(",", "."));
    const event = eventOf(part);
    const daysMatch = part.match(/\b(\d{1,3}) ?(?:DAYS?|DIAS?|DD)?\b/);
    const days = daysMatch ? Number(daysMatch[1]) : 0;
    // "30% ANT" sem evento nem dia = sinal no pedido; com dias sem evento =
    // dias depois da nota.
    if (event) out.push({ percent, base: event, days: event ? days : 0 });
    else if (daysMatch) out.push({ percent, base: "invoice", days });
    else return null;
  }
  return out;
}

/** Lista de dias: "30/60/90 DIAS", "30/45 - DIAS", "45 DIAS", "07 DIAS". */
function dayList(text: string): number[] | null {
  const list = text.match(/\b\d{1,3}(?: ?\/ ?\d{1,3})+\b/);
  if (list) return list[0].split("/").map((d) => Number(d.trim()));
  const single = text.match(/\b(\d{1,3}) ?(?:DIAS?|DD|DAYS?)\b/);
  return single ? [Number(single[1])] : null;
}

/**
 * Parcelas pela descrição da condição (ou pela regra do administrador).
 * `cashHint` = o Sankhya marca a condição como à vista (subtipo 1).
 */
export function scheduleFromText(
  raw: string | null | undefined,
  cashHint = false,
): ConditionSchedule {
  const text = normalize(raw ?? "");
  const done = (installments: ConditionInstallment[]): ConditionSchedule => {
    const sum = round2(installments.reduce((s, i) => s + i.percent, 0));
    return {
      kind: installments.some((i) => i.base !== "invoice") ? "event" : "time",
      installments,
      problem: sum === 100 ? null : "percent_sum",
    };
  };
  if (!text) return { kind: null, installments: [], problem: "unreadable" };

  const parts = percentParts(text);
  if (parts) return done(parts);

  const range = rangeDays(text);
  if (range) return done(evenSplit(range, "invoice"));

  const days = dayList(text);
  if (days) return done(evenSplit(days, "invoice"));

  if (cashHint || /\bA VISTA\b|\bANTECIPAD/.test(text))
    return done([{ percent: 100, base: "invoice", days: 0 }]);

  if (/\b100 ?% NO EMBARQUE\b/.test(text))
    return done([{ percent: 100, base: "shipment", days: 0 }]);

  return { kind: null, installments: [], problem: "unreadable" };
}

/** Texto curto das parcelas ("10% pedido · 40% embarque", "30/60/90 dias"). */
export function scheduleSummary(
  schedule: Pick<ConditionSchedule, "kind" | "installments">,
  labels: Record<ConditionBase, string>,
  daysWord: string,
): string {
  const list = schedule.installments;
  if (!list.length) return "—";
  if (schedule.kind === "time") {
    if (list.length > 6)
      return `${list.length}× ${list[0].days}–${list[list.length - 1].days} ${daysWord}`;
    return `${list.map((i) => i.days).join("/")} ${daysWord}`;
  }
  return list
    .map(
      (i) =>
        `${i.percent}% ${labels[i.base]}${i.days ? ` +${i.days} ${daysWord}` : ""}`,
    )
    .join(" · ");
}
