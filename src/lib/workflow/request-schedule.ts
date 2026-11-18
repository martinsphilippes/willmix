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
 * Prazo da 1ª programação na Nova solicitação (dono, 15/11/2026): a data de
 * lançamento da solicitação + 120 dias corridos, o 120º dia incluso
 * (lançamento em 15/11/2026: a 1ª data permitida é 15/03/2027).
 */
export const MIN_FIRST_DATE_DAYS = 120;

/** A 1ª data permitida (AAAA-MM-DD) para uma data de lançamento. */
export const minFirstDate = (launchIso: string) =>
  addDaysIso(launchIso, MIN_FIRST_DATE_DAYS);

/**
 * A data de lançamento (AAAA-MM-DD, em Brasília) de uma solicitação gravada;
 * sem data gravada, hoje (a solicitação nova é lançada ao enviar).
 */
export function launchDateOf(createdAt: string | null | undefined): string {
  const ms = createdAt ? Date.parse(createdAt) : NaN;
  return todayIso(Number.isFinite(ms) ? new Date(ms) : new Date());
}

/**
 * As datas das programações (AAAA-MM-DD): a automática é 1ª data +
 * intervalo × (n − 1); a fixada à mão (`pins[i]`, dono, 15/11/2026) vale
 * no lugar dela e não desloca as outras.
 */
export function planDates(
  count: number,
  firstDate: string,
  intervalDays: number,
  pins: ReadonlyArray<string | null | undefined> = [],
): string[] {
  return Array.from(
    { length: Math.max(0, Math.floor(count)) },
    (_, i) =>
      pins[i] ||
      (firstDate && intervalDays > 0
        ? addDaysIso(firstDate, intervalDays * i)
        : firstDate),
  );
}

/**
 * Programações fora de ordem: cada data precisa ser depois da anterior.
 * Devolve, para cada uma que não é, o número dela e o da anterior (1, 2…).
 */
export function outOfOrderDates(
  dates: ReadonlyArray<string>,
): Array<{ n: number; prev: number }> {
  const out: Array<{ n: number; prev: number }> = [];
  // Data em branco não entra (o campo obrigatório já avisa).
  for (let i = 1; i < dates.length; i++)
    if (dates[i] && dates[i - 1] && dates[i] <= dates[i - 1])
      out.push({ n: i + 1, prev: i });
  return out;
}

/**
 * A janela das datas da Nova solicitação, no servidor: a 1ª programação a
 * partir do lançamento + 120 dias (Error("schedule_too_soon")) e cada data
 * depois da anterior (Error("schedule_out_of_order")).
 */
export function assertScheduleWindow(
  schedule: RequestSchedule | null | undefined,
  launchIso: string,
): void {
  if (!schedule?.items.length) return;
  const dates = schedule.items.map((i) => i.expectedAt);
  if (outOfOrderDates(dates).length) throw new Error("schedule_out_of_order");
  if (dates[0] < minFirstDate(launchIso)) throw new Error("schedule_too_soon");
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
  /** Datas fixadas à mão (dono, 15/11/2026); nulo = a automática. */
  pins?: ReadonlyArray<string | null | undefined>;
}): RequestSchedule {
  return {
    intervalDays: input.intervalDays,
    firstDate: input.firstDate,
    items: input.quantities.map((quantity, i) => {
      const pin = input.pins?.[i];
      return {
        index: i + 1,
        quantity,
        expectedAt: pin || addDaysIso(input.firstDate, input.intervalDays * i),
        ...(pin ? { manual: true } : {}),
      };
    }),
  };
}

export function scheduleTotal(schedule: RequestSchedule): number {
  return schedule.items.reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Lê a programação do formulário da solicitação (campos `p<n>.schedule.*`):
 * count, intervalDays, firstDate e qty.1..N. Sem count (ou 0): nulo.
 * Data fixada à mão numa programação (Nova solicitação, dono, 15/11/2026):
 * `manual.<n>` = "1" e a data em `date.<n>`; as outras são sempre as
 * automáticas (o servidor não confia na data automática da tela).
 * Entrada inválida: Error("invalid_input").
 */
export function parseRequestSchedule(
  form: FormData,
  prefix: string,
  max: number = MAX_SCHEDULE_ROUNDS,
  /**
   * Nova solicitação (dono, 15/11/2026): as datas são do pedido e um produto
   * pode ficar sem quantidade numa delas (0 ou em branco). O total do
   * produto continua maior que zero.
   */
  options: {
    allowZero?: boolean;
    /**
     * Rascunho (dono, 18/11/2026): a programação volta como foi salva, com as
     * quantidades ainda em branco (ou inválidas) como zero.
     */
    draft?: boolean;
  } = {},
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
  const pins: Array<string | null> = [];
  for (let i = 1; i <= count; i++) {
    const raw = get(`qty.${i}`);
    const parsed =
      (options.allowZero || options.draft) && raw === ""
        ? 0
        : Number(raw.replace(",", "."));
    const q =
      options.draft && (!Number.isFinite(parsed) || parsed < 0) ? 0 : parsed;
    if (
      !Number.isFinite(q) ||
      q < 0 ||
      (q === 0 && !options.allowZero && !options.draft) ||
      q > 100_000_000
    )
      throw new Error("invalid_input");
    quantities.push(q);
    const pin = get(`manual.${i}`) === "1" ? get(`date.${i}`) : "";
    const badPin = !!pin && (!DAY.test(pin) || Number.isNaN(Date.parse(pin)));
    if (badPin && !options.draft) throw new Error("invalid_input");
    pins.push(pin && !badPin ? pin : null);
  }
  if (!options.draft && !quantities.some((q) => q > 0))
    throw new Error("invalid_input");
  return buildSchedule({ intervalDays, firstDate, quantities, pins });
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
