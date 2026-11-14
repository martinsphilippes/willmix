import type {
  PurchaseLot,
  RequestSchedule,
  RequestScheduleItem,
} from "@/lib/db/schema";

/*
 * Programação de entregas pedida pelo cliente na solicitação: a quantidade
 * dividida em N entregas (programação 1, 2, 3…) com intervalo fixo (30, 45,
 * 60 dias…) a partir de uma 1ª data prevista. Sem banco, sem IA: só a conta.
 * A ficha de compra (cotação e pedido) nasce com essas programações.
 */

export type { RequestSchedule, RequestScheduleItem };

/**
 * Teto técnico de programações (dono, 14/11/2026: sem o teto de 6 datas da
 * solicitação nem o de 12 da Seleção). Não é regra de negócio: o limite real
 * é ter ao menos uma caixa master por data. Só protege o servidor de um envio
 * absurdo (120 = dez anos de programações mensais). Vale para as duas telas,
 * para o servidor e para a gravação.
 */
export const MAX_SCHEDULE_ROUNDS = 120;
/** O mesmo teto, com o nome antigo da solicitação do cliente. */
export const MAX_REQUEST_SCHEDULE = MAX_SCHEDULE_ROUNDS;
export const SCHEDULE_INTERVALS = [30, 45, 60] as const;
export const DEFAULT_SCHEDULE_INTERVAL = 45;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dia de hoje (AAAA-MM-DD) em Brasília. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * A distribuição do portal (programação de compra, solicitação e lotes da
 * ficha de compra): divide a quantidade em n partes inteiras e o resto vai
 * para as primeiras. Em caixas master, as caixas; sem elas, as peças.
 */
export function splitEvenly(
  total: number,
  n: number,
  max: number = MAX_SCHEDULE_ROUNDS,
): number[] {
  const count = Math.max(1, Math.min(max, Math.floor(n)));
  const whole = Math.max(0, Math.floor(total));
  const base = Math.floor(whole / count);
  const rest = whole - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

export function buildSchedule(input: {
  intervalDays: number;
  firstDate: string;
  quantities: number[];
}): RequestSchedule {
  return {
    intervalDays: input.intervalDays,
    firstDate: input.firstDate,
    items: input.quantities.map((quantity, i) => ({
      index: i + 1,
      quantity,
      expectedAt: addDaysIso(input.firstDate, input.intervalDays * i),
    })),
  };
}

export function scheduleTotal(schedule: RequestSchedule): number {
  return schedule.items.reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Lê a programação do formulário da solicitação (campos `p<n>.schedule.*`):
 * count, intervalDays, firstDate e qty.1..N. Sem count (ou 0): nulo.
 * Entrada inválida: Error("invalid_input").
 */
export function parseRequestSchedule(
  form: FormData,
  prefix: string,
  max: number = MAX_SCHEDULE_ROUNDS,
): RequestSchedule | null {
  const get = (k: string) => {
    const v = form.get(`${prefix}schedule.${k}`);
    return typeof v === "string" ? v.trim() : "";
  };
  const count = Number(get("count") || 0);
  if (!count) return null;
  if (!Number.isInteger(count) || count < 1 || count > max)
    throw new Error("invalid_input");
  const intervalDays = Number(get("intervalDays"));
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)
    throw new Error("invalid_input");
  const firstDate = get("firstDate");
  if (!DAY.test(firstDate) || Number.isNaN(Date.parse(firstDate)))
    throw new Error("invalid_input");
  const quantities: number[] = [];
  for (let i = 1; i <= count; i++) {
    const q = Number(get(`qty.${i}`).replace(",", "."));
    if (!Number.isFinite(q) || q <= 0 || q > 100_000_000)
      throw new Error("invalid_input");
    quantities.push(q);
  }
  return buildSchedule({ intervalDays, firstDate, quantities });
}

/**
 * Programações do cliente viram as programações da ficha de compra: intervalo
 * igual entre elas e, com peças por caixa conhecidas, as caixas master de cada
 * uma (arredondadas para cima).
 */
export function scheduleToLots(
  schedule: RequestSchedule | null | undefined,
  masterCartonQty: number | null | undefined,
): PurchaseLot[] | null {
  if (!schedule?.items.length) return null;
  return schedule.items.map((item) => ({
    departureIntervalDays: schedule.intervalDays,
    masterCartons:
      masterCartonQty && masterCartonQty > 0
        ? Math.ceil(item.quantity / masterCartonQty)
        : null,
  }));
}
