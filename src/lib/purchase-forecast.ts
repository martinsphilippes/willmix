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

/** Uma compra: a data (AAAA-MM-DD), a quantidade em peças e o valor (R$). */
export interface Purchase {
  date: string;
  quantity: number;
  /** Valor após descontos (só para quem vê valores). */
  value?: number | null;
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

/** Um mês do histórico (com ou sem compra). */
export interface MonthTotal {
  month: string;
  quantity: number;
  /** Nulo quando quem vê não vê valores. */
  value: number | null;
  purchases: number;
}

/**
 * Quantidade e valor por ano, com os meses de cada um. Do mês da 1ª compra
 * até o mês de hoje, os meses sem compra entram com zero (dono, 20/11/2026:
 * o buraco de compras fica visível). Anos do mais recente ao mais antigo;
 * meses em ordem.
 */
export interface YearTotal {
  year: string;
  quantity: number;
  value: number | null;
  purchases: number;
  months: MonthTotal[];
}

export function yearTotals(
  purchases: readonly Purchase[],
  today: string = new Date().toISOString().slice(0, 10),
): YearTotal[] {
  const list = byDate(purchases);
  if (!list.length) return [];
  const withValue = purchases.some(
    (p) => p.value !== null && p.value !== undefined,
  );
  const months = new Map<string, MonthTotal>();
  for (const p of list) {
    const key = monthKey(p.date);
    const m = months.get(key) ?? {
      month: key,
      quantity: 0,
      value: withValue ? 0 : null,
      purchases: 0,
    };
    m.quantity += p.quantity;
    m.purchases += 1;
    months.set(key, m);
  }
  // Valor por dia (as compras do mesmo dia somadas).
  if (withValue)
    for (const p of purchases) {
      const m = months.get(monthKey(p.date));
      if (m && p.quantity > 0) m.value = (m.value ?? 0) + (p.value ?? 0);
    }
  // Do 1º mês até o mês de hoje (ou o da última compra, se for depois).
  const first = monthKey(list[0].date);
  const lastKey = [monthKey(today), monthKey(list.at(-1)!.date)].sort().at(-1)!;
  let [y, mo] = first.split("-").map(Number);
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    if (key > lastKey) break;
    if (!months.has(key))
      months.set(key, {
        month: key,
        quantity: 0,
        value: withValue ? 0 : null,
        purchases: 0,
      });
    mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
  }
  const years = new Map<string, YearTotal>();
  for (const m of [...months.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  )) {
    const year = m.month.slice(0, 4);
    const t = years.get(year) ?? {
      year,
      quantity: 0,
      value: withValue ? 0 : null,
      purchases: 0,
      months: [],
    };
    t.quantity += m.quantity;
    t.purchases += m.purchases;
    if (withValue) t.value = (t.value ?? 0) + (m.value ?? 0);
    t.months.push(m);
    years.set(year, t);
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

/**
 * "Usar a recomendação" (dono, 20/11/2026): a quantidade sugerida repartida
 * nas entregas do pedido pela demanda prevista de cada uma (a entrega cobre
 * do dia dela até a entrega seguinte; a última, o intervalo médio entre as
 * entregas ou, com uma só, o intervalo médio entre as compras), em caixas
 * inteiras e somando exatamente o sugerido (arredondado para cima em
 * caixas). É o percentual deste produto entre as entregas; o do pedido não
 * muda.
 */
export function splitRecommendation(
  estimate: Pick<
    DemandEstimate,
    "suggestedQuantity" | "monthly" | "months" | "intervalMonths"
  >,
  deliveryDates: readonly string[],
  perCarton: number | null,
): number[] {
  const per = perCarton && perCarton > 0 ? perCarton : 1;
  const units = Math.max(0, Math.ceil(estimate.suggestedQuantity / per - 1e-9));
  if (deliveryDates.length <= 1) return [units * per];
  // Uma entrega por data do pedido; sem todas as datas, partes iguais.
  const known = deliveryDates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const dates = known ? [...deliveryDates] : [];
  const rate = new Map(estimate.months.map((m) => [m.month, m.quantity]));
  const demandAt = (date: string) =>
    rate.get(monthKey(date)) ?? estimate.monthly;
  const gaps = dates
    .slice(1)
    .map((d, i) => monthsBetween(dates[i], d))
    .filter((g) => g > 0);
  const lastSpan = gaps.length
    ? gaps.reduce((a, b) => a + b, 0) / gaps.length
    : estimate.intervalMonths;
  const weights = dates.map((d, i) => {
    const span =
      i + 1 < dates.length ? monthsBetween(d, dates[i + 1]) : lastSpan;
    const middle = addMonths(d, Math.max(0, span) / 2);
    return Math.max(0, span) * Math.max(0, demandAt(middle));
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares =
    known && sum > 0
      ? weights.map((w) => w / sum)
      : deliveryDates.map(() => 1 / deliveryDates.length);
  // Maiores restos: as caixas somam exatamente o total.
  const raw = shares.map((s) => s * units);
  const out = raw.map(Math.floor);
  let left = units - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out.map((u) => u * per);
}
