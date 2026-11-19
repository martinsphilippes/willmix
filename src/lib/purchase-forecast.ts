/*
 * Análise de compras de um produto pelo cliente (dono, 19/11/2026;
 * docs/PURCHASE_HISTORY.md seção 12): a quantidade comprada por mês e por
 * ano no histórico inteiro e a estimativa de demanda.
 *
 * Demanda por mês: cada compra dura até a compra seguinte, então a demanda
 * daquele intervalo é a quantidade da compra ÷ os meses até a próxima. A
 * tendência é a reta (mínimos quadrados) dessas taxas nas últimas compras,
 * no tempo; a demanda prevista de cada mês segue a reta a partir de hoje
 * (nunca abaixo de zero). A próxima compra é sugerida 4 meses (o tempo do
 * pedido até chegar ao cliente) antes de a última compra acabar, na
 * quantidade que a demanda prevista consome no intervalo médio entre as
 * compras.
 */

/** Uma compra: a data (AAAA-MM-DD) e a quantidade em peças. */
export interface Purchase {
  date: string;
  quantity: number;
}

/** Meses de antecedência da sugestão (pedido → cliente). */
export const LEAD_MONTHS = 4;
/** Compras (intervalos) que entram na tendência. */
export const TREND_WINDOW = 6;
/** Meses previstos na tabela de estimativa. */
export const FORECAST_MONTHS = 12;

const DAY = 86_400_000;
/** Dias de um mês médio. */
const MONTH_DAYS = 30.4375;

const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
const monthsBetween = (a: string, b: string) =>
  (time(b) - time(a)) / DAY / MONTH_DAYS;
const monthKey = (date: string) => date.slice(0, 7);
const addMonths = (date: string, months: number) =>
  new Date(time(date) + months * MONTH_DAYS * DAY).toISOString().slice(0, 10);

/** Compras do mesmo dia somadas, em ordem de data. */
export function byDate(purchases: readonly Purchase[]): Purchase[] {
  const map = new Map<string, number>();
  for (const p of purchases)
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.quantity > 0)
      map.set(p.date, (map.get(p.date) ?? 0) + p.quantity);
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, quantity]) => ({ date, quantity }));
}

/** Quantidade por ano, com os meses de cada um (só os meses com compra). */
export interface YearTotal {
  year: string;
  quantity: number;
  purchases: number;
  months: Array<{ month: string; quantity: number; purchases: number }>;
}

export function yearTotals(purchases: readonly Purchase[]): YearTotal[] {
  const years = new Map<string, YearTotal>();
  for (const p of byDate(purchases)) {
    const year = p.date.slice(0, 4);
    const y =
      years.get(year) ??
      ({ year, quantity: 0, purchases: 0, months: [] } as YearTotal);
    y.quantity += p.quantity;
    y.purchases += 1;
    const key = monthKey(p.date);
    const m = y.months.find((x) => x.month === key);
    if (m) {
      m.quantity += p.quantity;
      m.purchases += 1;
    } else y.months.push({ month: key, quantity: p.quantity, purchases: 1 });
    years.set(year, y);
  }
  return [...years.values()].sort((a, b) => b.year.localeCompare(a.year));
}

export interface DemandEstimate {
  /** Demanda por mês hoje (pela tendência), em peças. */
  monthly: number;
  /** Quanto a demanda muda por mês (peças/mês a cada mês). */
  slope: number;
  /** Intervalo médio entre as compras (meses), nas últimas compras. */
  intervalMonths: number;
  /** Compras usadas na tendência. */
  used: number;
  last: Purchase;
  /** Quando a última compra acaba, pela demanda prevista. */
  runOut: string;
  /** Data sugerida da próxima compra (4 meses antes de acabar). */
  suggestedDate: string;
  /** Já passou da data sugerida. */
  late: boolean;
  /** Quantidade sugerida (a demanda do intervalo médio). */
  suggestedQuantity: number;
  /** Demanda prevista nos próximos meses e somada por ano. */
  months: Array<{ month: string; quantity: number }>;
  years: Array<{ year: string; quantity: number }>;
}

/**
 * A estimativa de demanda; nula com menos de duas compras (sem intervalo
 * não há demanda por mês).
 */
export function estimateDemand(
  purchases: readonly Purchase[],
  today: string = new Date().toISOString().slice(0, 10),
): DemandEstimate | null {
  const list = byDate(purchases);
  if (list.length < 2) return null;
  // Uma taxa por intervalo: compra ÷ meses até a seguinte, no meio dele.
  const rates = list.slice(0, -1).flatMap((p, i) => {
    const months = monthsBetween(p.date, list[i + 1].date);
    if (!(months > 0)) return [];
    return [
      {
        x: monthsBetween(list[0].date, p.date) + months / 2,
        rate: p.quantity / months,
        months,
      },
    ];
  });
  if (!rates.length) return null;
  const window = rates.slice(-TREND_WINDOW);
  const n = window.length;
  const meanX = window.reduce((s, r) => s + r.x, 0) / n;
  const meanY = window.reduce((s, r) => s + r.rate, 0) / n;
  const sxx = window.reduce((s, r) => s + (r.x - meanX) ** 2, 0);
  const slope =
    n >= 2 && sxx > 0
      ? window.reduce((s, r) => s + (r.x - meanX) * (r.rate - meanY), 0) / sxx
      : 0;
  const at = (x: number) => Math.max(0, meanY + slope * (x - meanX));
  const last = list.at(-1)!;
  const xToday = monthsBetween(list[0].date, today);
  const xLast = monthsBetween(list[0].date, last.date);
  // Demanda prevista de hoje; com a reta caindo a zero, a média recente.
  const monthly = at(xToday) || meanY;
  const lastRate = at(xLast) || meanY;
  const runOut = addMonths(last.date, last.quantity / lastRate);
  const suggestedDate = addMonths(runOut, -LEAD_MONTHS);
  const intervalMonths = window.reduce((s, r) => s + r.months, 0) / n;
  const xRunOut = monthsBetween(list[0].date, runOut);
  const suggestedQuantity = Math.round(
    (at(xRunOut + intervalMonths / 2) || meanY) * intervalMonths,
  );
  // Os próximos meses a partir do mês de hoje.
  const start = new Date(`${monthKey(today)}-01T00:00:00Z`);
  const months = Array.from({ length: FORECAST_MONTHS }, (_, i) => {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 15),
    );
    const iso = d.toISOString().slice(0, 10);
    return {
      month: monthKey(iso),
      quantity: Math.round(at(monthsBetween(list[0].date, iso)) || meanY),
    };
  });
  const years = new Map<string, number>();
  for (const m of months)
    years.set(
      m.month.slice(0, 4),
      (years.get(m.month.slice(0, 4)) ?? 0) + m.quantity,
    );
  return {
    monthly: Math.round(monthly),
    slope,
    intervalMonths,
    used: n,
    last,
    runOut,
    suggestedDate,
    late: suggestedDate < today,
    suggestedQuantity,
    months,
    years: [...years].map(([year, quantity]) => ({ year, quantity })),
  };
}
