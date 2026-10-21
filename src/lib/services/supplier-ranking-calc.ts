/*
 * Disputa entre fornecedores (sem banco): cada cotação ganha pontos de 0 a
 * 100 em cada critério, comparada com a melhor; a nota final é a média
 * ponderada pelos pesos das Configurações. Critério sem dado em nenhuma
 * cotação fica fora da conta (o peso dele não pesa contra ninguém); sem dado
 * só numa cotação, ela fica com 0 naquele critério.
 */

export const RANKING_CRITERIA = [
  "price",
  "delivery",
  "production",
  "freight",
  "moq",
] as const;
export type RankingCriterion = (typeof RANKING_CRITERIA)[number];
export type RankingWeights = Record<RankingCriterion, number>;

/** Pesos padrão (o admin ajusta em Configurações). */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  price: 50,
  delivery: 20,
  production: 15,
  freight: 10,
  moq: 5,
};

/** Valores comparados de uma cotação (null = sem dado). */
export interface RankingValues {
  /** Preço por peça (moeda comum das cotações, ou R$ pelo câmbio). Menor é melhor. */
  price: number | null;
  /** Dias até a mercadoria chegar (1ª saída + trânsito, se informado). Menor é melhor. */
  delivery: number | null;
  /** Prazo de produção em dias. Menor é melhor. */
  production: number | null;
  /** Frete marítimo por peça em R$. Menor é melhor. */
  freight: number | null;
  /** MOQ do fornecedor (peças) e quantidade pedida: atende ou não. */
  moq: { moq: number; quantity: number } | null;
}

export interface RankingInput {
  quoteId: string;
  values: RankingValues;
}

export interface CriterionScore {
  criterion: RankingCriterion;
  weight: number;
  /** 0 a 100. */
  score: number;
  /** Esta cotação tem o melhor valor do critério. */
  best: boolean;
  hasValue: boolean;
}

export interface RankingRow {
  quoteId: string;
  /** Nota final de 0 a 100. */
  total: number;
  rank: number;
  criteria: CriterionScore[];
}

export interface RankingResult {
  rows: RankingRow[];
  /** Critérios que entraram na conta (peso > 0 e algum dado). */
  used: RankingCriterion[];
  winnerId: string | null;
  /** Empate na primeira posição. */
  tie: boolean;
}

/** Pontos de um critério "menor é melhor" (dias com folga de 1 para o zero). */
function lowerIsBetter(min: number, value: number, plusOne: boolean) {
  if (plusOne) return (100 * (min + 1)) / (value + 1);
  if (value <= 0) return 100;
  return (100 * min) / value;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function rankQuotes(
  inputs: RankingInput[],
  weights: RankingWeights,
): RankingResult {
  const used = RANKING_CRITERIA.filter(
    (c) => (weights[c] ?? 0) > 0 && inputs.some((i) => i.values[c] !== null),
  );
  const scoreOf = (c: RankingCriterion, v: RankingValues): number | null => {
    if (c === "moq") {
      const m = v.moq;
      if (!m) return null;
      return m.moq <= m.quantity ? 100 : (100 * m.quantity) / m.moq;
    }
    const value = v[c] as number | null;
    if (value === null) return null;
    const all = inputs
      .map((i) => i.values[c] as number | null)
      .filter((x): x is number => x !== null);
    const min = Math.min(...all);
    return lowerIsBetter(min, value, c !== "price" && c !== "freight");
  };
  const rows = inputs.map((input) => {
    const criteria: CriterionScore[] = used.map((c) => {
      const s = scoreOf(c, input.values);
      return {
        criterion: c,
        weight: weights[c],
        score: round1(s ?? 0),
        best: false,
        hasValue: s !== null,
      };
    });
    const sumW = criteria.reduce((sum, c) => sum + c.weight, 0);
    const total = sumW
      ? criteria.reduce((sum, c) => sum + c.weight * c.score, 0) / sumW
      : 0;
    return { quoteId: input.quoteId, total: round1(total), rank: 0, criteria };
  });
  // Melhor de cada critério (pode haver mais de um, empatados).
  for (const c of used) {
    const top = Math.max(
      ...rows.map((r) => r.criteria.find((x) => x.criterion === c)!.score),
    );
    for (const r of rows) {
      const cs = r.criteria.find((x) => x.criterion === c)!;
      cs.best = cs.hasValue && cs.score === top;
    }
  }
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  sorted.forEach((r, i) => {
    r.rank =
      i > 0 && r.total === sorted[i - 1].total ? sorted[i - 1].rank : i + 1;
  });
  const tie = sorted.length > 1 && sorted[0].total === sorted[1].total;
  return {
    rows: sorted,
    used,
    winnerId: sorted.length && sorted[0].total > 0 ? sorted[0].quoteId : null,
    tie,
  };
}

/**
 * Preço por peça comparável entre as cotações. Todas na mesma moeda: compara
 * direto nela (não depende do câmbio). Moedas diferentes: converte para R$
 * pelo câmbio do dia; se faltar a taxa de alguma, o preço sai da disputa (não
 * dá para comparar sem pôr uma cotação em desvantagem por falta de câmbio).
 */
export function comparablePrices(
  items: {
    quoteId: string;
    unitPrice: number | null;
    currency: string | null;
  }[],
  rate: (currency: string | null) => number | null,
): { currency: string | null; prices: Map<string, number | null> } {
  const priced = items.filter((i) => i.unitPrice !== null && i.unitPrice > 0);
  const currencies = new Set(priced.map((i) => i.currency ?? ""));
  const prices = new Map<string, number | null>(
    items.map((i) => [i.quoteId, null]),
  );
  if (currencies.size <= 1) {
    for (const i of priced) prices.set(i.quoteId, i.unitPrice);
    return { currency: [...currencies][0] || null, prices };
  }
  const converted = priced.map((i) => {
    const r = rate(i.currency);
    return { id: i.quoteId, brl: r ? i.unitPrice! * r : null };
  });
  if (converted.some((c) => c.brl === null)) return { currency: null, prices };
  for (const c of converted) prices.set(c.id, c.brl);
  return { currency: "BRL", prices };
}

/** Pesos gravados (vazio ou inválido → padrão), cada um de 0 a 100. */
export function normalizeWeights(
  raw: Partial<Record<string, unknown>> | null | undefined,
): RankingWeights {
  const out = { ...DEFAULT_RANKING_WEIGHTS };
  if (!raw) return out;
  for (const c of RANKING_CRITERIA) {
    const n = Number(raw[c]);
    if (Number.isFinite(n) && n >= 0 && n <= 100) out[c] = Math.round(n);
  }
  return out;
}
