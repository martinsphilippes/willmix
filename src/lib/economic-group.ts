import { spreadCartons } from "./color-split";
import { splitEvenly } from "./workflow/request-schedule";

/*
 * Contas do pedido para um grupo econômico (dono, 18/11/2026;
 * docs/ECONOMIC_GROUPS.md), sem acesso ao banco: valem na tela e no
 * servidor. A quantidade de cada empresa é em caixas master quando o produto
 * tem a caixa (senão em peças) e se reparte nas entregas do pedido como o
 * total do produto (partes iguais, o resto nas primeiras).
 */

export interface GroupCompany {
  id: string;
  name: string;
  /** CNPJ/CPF só com números. */
  taxId: string | null;
  /** CODPARC no Sankhya. */
  code: string | null;
  /** A empresa que representa o grupo (o cliente do pedido). */
  head: boolean;
}

export interface EconomicGroup {
  /** Código do grupo (CODPARC da empresa que representa o grupo). */
  code: string;
  name: string;
  /** A empresa que representa o grupo primeiro; as outras pelo nome. */
  companies: GroupCompany[];
  /** Distribuição padrão (customerId → %); vazio = ainda não definida. */
  shares: Record<string, number>;
}

/** Quantidade por empresa (caixas ou peças, inteiras). */
export type CompanyAmounts = Record<string, number>;

const whole = (n: unknown) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** O total pelas empresas, na proporção dos percentuais (maiores frações). */
export function splitByPercent(
  total: number,
  ids: readonly string[],
  shares: Record<string, number>,
): CompanyAmounts {
  const weights = ids.map((id) => Math.max(0, Number(shares[id]) || 0));
  if (!weights.some((w) => w > 0)) return {};
  const parts = spreadCartons(whole(total), weights);
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

/**
 * A partir da quantidade de uma empresa: as outras na mesma proporção dos
 * percentuais (arredondadas). Nulo se a base não tem percentual.
 */
export function fromBaseCompany(
  baseId: string,
  baseAmount: number,
  ids: readonly string[],
  shares: Record<string, number>,
): CompanyAmounts | null {
  const basePct = Number(shares[baseId]) || 0;
  if (basePct <= 0) return null;
  const base = whole(baseAmount);
  return Object.fromEntries(
    ids.map((id) => [
      id,
      id === baseId
        ? base
        : Math.round((base * Math.max(0, Number(shares[id]) || 0)) / basePct),
    ]),
  );
}

/** Percentuais iguais (somam 100, centésimos no primeiro). */
export function equalShares(ids: readonly string[]): Record<string, number> {
  if (!ids.length) return {};
  const cents = splitEvenly(10_000, ids.length, ids.length);
  return Object.fromEntries(ids.map((id, i) => [id, cents[i] / 100]));
}

/** Soma dos percentuais (para o "Total: N%"). */
export const sharesTotal = (shares: Record<string, number>) =>
  Math.round(
    Object.values(shares).reduce((s, p) => s + (Number(p) || 0), 0) * 100,
  ) / 100;

/**
 * Peças de cada empresa em cada entrega e a soma por entrega (a programação
 * do produto). `perCarton` nulo = quantidades já em peças.
 */
export function companyRounds(
  amounts: CompanyAmounts,
  ids: readonly string[],
  rounds: number,
  perCarton: number | null,
): { byCompany: Record<string, number[]>; total: number[] } {
  const n = Math.max(1, Math.floor(rounds) || 1);
  const per = perCarton && perCarton > 0 ? perCarton : 1;
  const total = Array.from({ length: n }, () => 0);
  const byCompany: Record<string, number[]> = {};
  for (const id of ids) {
    const amount = whole(amounts[id]);
    if (!amount) continue;
    const pieces = splitEvenly(amount, n, n).map((x) => x * per);
    byCompany[id] = pieces;
    pieces.forEach((p, i) => (total[i] += p));
  }
  return { byCompany, total };
}

/**
 * Confere as peças das empresas contra a programação do produto: só
 * empresas do grupo, uma vez cada, o mesmo número de entregas e a soma de
 * cada entrega igual à da programação.
 */
export function allocationsMatch(
  allocations: ReadonlyArray<{ customerId: string; quantities: number[] }>,
  schedule: readonly number[],
  allowed: ReadonlySet<string>,
): boolean {
  if (!allocations.length) return false;
  const seen = new Set<string>();
  const sum = schedule.map(() => 0);
  for (const a of allocations) {
    if (!allowed.has(a.customerId) || seen.has(a.customerId)) return false;
    seen.add(a.customerId);
    if (a.quantities.length !== schedule.length) return false;
    a.quantities.forEach((q, i) => {
      sum[i] += Number.isInteger(q) && q >= 0 ? q : Number.NaN;
    });
  }
  return sum.every((s, i) => s === schedule[i]);
}

/** "12.345.678/0001-90" ou "123.456.789-01"; outro tamanho, como veio. */
export function taxIdText(taxId: string | null): string {
  const d = (taxId ?? "").replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d || "—";
}

/* ---- Matriz Empresas × Entregas (dono, 19/11/2026) ---- */

/** Quantidade de cada empresa em cada entrega (caixas, ou peças sem caixa). */
export type CompanyMatrix = Record<string, number[]>;

/** Pesos que valem para N entregas (somam algo e têm N posições). */
export function usableWeights(
  weights: readonly number[] | null | undefined,
  n: number,
): number[] | null {
  return weights &&
    weights.length === n &&
    weights.every((w) => Number.isFinite(w) && w >= 0) &&
    weights.some((w) => w > 0)
    ? [...weights]
    : null;
}

/** Um total em N entregas: pelos percentuais, ou em partes iguais. */
export function spreadRounds(
  total: number,
  n: number,
  weights?: readonly number[] | null,
): number[] {
  const count = Math.max(1, Math.floor(n) || 1);
  const w = usableWeights(weights, count);
  return w
    ? spreadCartons(whole(total), w)
    : splitEvenly(whole(total), count, count);
}

/** Totais por empresa → matriz (cada total repartido nas entregas). */
export function matrixFromTotals(
  totals: CompanyAmounts,
  ids: readonly string[],
  n: number,
  weights?: readonly number[] | null,
): CompanyMatrix {
  const out: CompanyMatrix = {};
  for (const id of ids) {
    const t = whole(totals[id]);
    if (t) out[id] = spreadRounds(t, n, weights);
  }
  return out;
}

/** Total de cada empresa na matriz. */
export function matrixTotals(
  matrix: CompanyMatrix,
  ids: readonly string[],
): CompanyAmounts {
  return Object.fromEntries(
    ids.map((id) => [id, (matrix[id] ?? []).reduce((a, b) => a + whole(b), 0)]),
  );
}

/** Soma de cada entrega (coluna) da matriz. */
export function matrixColumns(
  matrix: CompanyMatrix,
  ids: readonly string[],
  n: number,
): number[] {
  const out = Array.from({ length: n }, () => 0);
  for (const id of ids)
    (matrix[id] ?? []).forEach((v, i) => {
      if (i < n) out[i] += whole(v);
    });
  return out;
}

/**
 * Outro número de entregas: o total de cada empresa repartido de novo nas
 * N entregas (pelos percentuais, ou igual).
 */
export function reshapeMatrix(
  matrix: CompanyMatrix,
  ids: readonly string[],
  n: number,
  weights?: readonly number[] | null,
): CompanyMatrix {
  return matrixFromTotals(matrixTotals(matrix, ids), ids, n, weights);
}

/**
 * A programação do produto mudou fora da matriz (gerador ou "Programação
 * X"): cada entrega passa a ter `targets[i]` e é repartida entre as empresas
 * na proporção que elas já tinham nela; entrega vazia usa a proporção do
 * total de cada empresa e, sem nada, os percentuais do grupo. Sem nenhuma
 * base, nulo.
 */
export function rescaleMatrix(
  matrix: CompanyMatrix,
  ids: readonly string[],
  targets: readonly number[],
  shares: Record<string, number>,
): CompanyMatrix | null {
  const n = targets.length;
  const totals = matrixTotals(matrix, ids);
  const hasTotals = ids.some((id) => totals[id] > 0);
  const hasShares = ids.some((id) => (Number(shares[id]) || 0) > 0);
  const out: CompanyMatrix = Object.fromEntries(
    ids.map((id) => [id, Array.from({ length: n }, () => 0)]),
  );
  for (let i = 0; i < n; i++) {
    const target = whole(targets[i]);
    if (!target) continue;
    const column = ids.map((id) => whole(matrix[id]?.[i]));
    const weights = column.some((v) => v > 0)
      ? column
      : hasTotals
        ? ids.map((id) => totals[id])
        : hasShares
          ? ids.map((id) => Math.max(0, Number(shares[id]) || 0))
          : null;
    if (!weights) return null;
    spreadCartons(target, weights).forEach((v, k) => (out[ids[k]][i] = v));
  }
  for (const id of ids) if (!out[id].some((v) => v > 0)) delete out[id];
  return out;
}

/** Matriz (caixas ou peças) → peças por empresa e a soma por entrega. */
export function matrixPieces(
  matrix: CompanyMatrix,
  ids: readonly string[],
  n: number,
  perCarton: number | null,
): { byCompany: Record<string, number[]>; total: number[] } {
  const per = perCarton && perCarton > 0 ? perCarton : 1;
  const total = Array.from({ length: n }, () => 0);
  const byCompany: Record<string, number[]> = {};
  for (const id of ids) {
    const row = Array.from(
      { length: n },
      (_, i) => whole(matrix[id]?.[i]) * per,
    );
    if (!row.some((v) => v > 0)) continue;
    byCompany[id] = row;
    row.forEach((v, i) => (total[i] += v));
  }
  return { byCompany, total };
}
