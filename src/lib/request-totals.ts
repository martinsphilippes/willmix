/*
 * Totais de uma encomenda (lista de Encomendas, página da encomenda e CSV;
 * dono, 18/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 5). Cada produto da
 * encomenda entra uma vez, com todas as programações dele:
 *
 * - Peças (UN): a programação gravada; sem ela, a quantidade (em caixas,
 *   caixas × peças por caixa). Outra unidade (kg, m) não vira peça.
 * - Caixas master, caixas inner e CBM: os da embalagem de cada produto
 *   (src/lib/services/request-packing.ts: por programação, para cima).
 * - Pedido mínimo (UN): o de cada produto (produto + variação) uma vez só,
 *   mesmo que o produto apareça em duas linhas.
 * - Preço total: a previsão de venda gravada no envio, somada por moeda.
 *
 * Dado ausente não vira zero: sem nenhum produto com o dado, o total é
 * nulo ("—"); com só alguns, a soma do que existe e a lista de quem faltou
 * ("Total parcial"). Puro: sem banco e sem tela.
 */

export interface TotalsLine {
  /** Nome do produto (para dizer quem ficou de fora do total). */
  name: string;
  /** Produto + variação (o mínimo conta uma vez); nulo fora do catálogo. */
  productKey: string | null;
  /** A quantidade está em peças ou em caixas (outra unidade não soma). */
  countable: boolean;
  pieces: number | null;
  boxes: number | null;
  innerBoxes: number | null;
  cbm: number | null;
  moq: number | null;
  /** Previsão de venda (total) gravada no envio. */
  sale: { amount: number; currency: string } | null;
}

export interface TotalPart {
  /** Soma do que se sabe; nulo quando nenhum produto tem o dado. */
  value: number | null;
  /** Produtos sem o dado (com valor, o total é parcial). */
  missing: string[];
}

export interface SaleTotal {
  /** Uma soma por moeda (moedas diferentes não se misturam). */
  amounts: Array<{ currency: string; amount: number }>;
  missing: string[];
}

export interface EncomendaTotals {
  pieces: TotalPart;
  boxes: TotalPart;
  inner: TotalPart;
  cbm: TotalPart;
  moq: TotalPart;
  sale: SaleTotal;
}

export type TotalKey = Exclude<keyof EncomendaTotals, "sale">;

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const finite = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n);

/** Nomes sem repetir, na ordem em que aparecem. */
const unique = (names: readonly string[]) => [...new Set(names)];

function part(
  lines: readonly TotalsLine[],
  value: (l: TotalsLine) => number | null,
  extra: readonly string[],
  round: (n: number) => number,
): TotalPart {
  let sum = 0;
  let known = 0;
  const missing: string[] = [];
  for (const l of lines) {
    const v = l.countable ? value(l) : null;
    if (finite(v)) {
      sum += v;
      known++;
    } else missing.push(l.name);
  }
  return {
    value: known ? round(sum) : null,
    missing: unique([...missing, ...extra]),
  };
}

/**
 * Os totais da encomenda. `uncovered`: produtos do pedido que não estão nas
 * linhas da encomenda (o pedido do histórico tem mais itens): entram como
 * faltando em todos os totais.
 */
export function encomendaTotals(
  lines: readonly TotalsLine[],
  uncovered: readonly string[] = [],
): EncomendaTotals {
  // Pedido mínimo: uma vez por produto (o mínimo vale para a quantidade
  // total do produto, não por linha nem por programação).
  const seen = new Set<string>();
  let moqSum = 0;
  let moqKnown = 0;
  const moqMissing: string[] = [];
  for (const l of lines) {
    if (l.productKey) {
      if (seen.has(l.productKey)) continue;
      seen.add(l.productKey);
    }
    if (l.productKey && finite(l.moq) && l.moq > 0) {
      moqSum += l.moq;
      moqKnown++;
    } else moqMissing.push(l.name);
  }
  const sales = new Map<string, number>();
  const saleMissing: string[] = [];
  for (const l of lines) {
    if (l.sale && finite(l.sale.amount)) {
      const code = l.sale.currency.trim().toUpperCase() || "BRL";
      sales.set(code, (sales.get(code) ?? 0) + l.sale.amount);
    } else saleMissing.push(l.name);
  }
  return {
    pieces: part(lines, (l) => l.pieces, uncovered, r4),
    boxes: part(lines, (l) => l.boxes, uncovered, r4),
    inner: part(lines, (l) => l.innerBoxes, uncovered, r4),
    cbm: part(lines, (l) => l.cbm, uncovered, r4),
    moq: {
      value: moqKnown ? moqSum : null,
      missing: unique([...moqMissing, ...uncovered]),
    },
    sale: {
      amounts: [...sales.entries()]
        .sort(([a], [b]) =>
          a === "BRL" ? -1 : b === "BRL" ? 1 : a.localeCompare(b),
        )
        .map(([currency, amount]) => ({ currency, amount: r2(amount) })),
      missing: unique([...saleMissing, ...uncovered]),
    },
  };
}

/**
 * Texto de ordenação de um total: o número com ponto e 6 casas (nunca 3, que
 * a ordenação leria como milhar em pt), vazio sem valor (fica no fim).
 */
export function totalSortText(value: number | null): string {
  return value === null ? "" : value.toFixed(6);
}
