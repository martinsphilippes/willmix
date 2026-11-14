import type { ColorPlan, ColorQuantity } from "@/lib/db/schema";

/*
 * Variações de cor do produto vencedor (Seleção de itens → "Variações";
 * docs/PURCHASE_SCHEDULE.md, "Cores"). As cores vêm do item do Book
 * (`colorAssortment`, "BEGE / CARVALHO / MARROM"); a Wellmix tira ou põe
 * cada uma na compra, e o total de peças é dividido entre as incluídas da
 * forma mais igual possível, em caixas master inteiras, e por data quando há
 * programação. As cores do Book não mudam. Regras puras: a prévia da tela,
 * a gravação e o pedido usam as mesmas.
 */

/** Separadores das cores na planilha: "/", ",", ";", "|", "+" e quebra de linha. */
const SEPARATORS = /[/,;|+\n\r]+/;

/** Cores do item do Book, na ordem da planilha, sem repetir (maiúsc./minúsc. iguais). */
export function colorsOf(assortment: string | null | undefined): string[] {
  if (!assortment) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of assortment.split(SEPARATORS)) {
    const color = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!color) continue;
    const key = color.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out.slice(0, 30);
}

/** O item tem variações de cor (duas ou mais cores no Book)? Sem elas, o fluxo de sempre. */
export const hasVariations = (assortment: string | null | undefined) =>
  colorsOf(assortment).length > 1;

export type ColorSplitResult =
  | { ok: true; rows: ColorPlan["rows"] }
  | {
      ok: false;
      error: "colors_none";
    }
  | {
      ok: false;
      /**
       * Caixas digitadas por cor (`cartons`) que não somam as caixas das
       * datas: `expected` caixas nas datas, `got` caixas nas cores.
       */
      error: "colors_total";
      expected: number;
      got: number;
    }
  | {
      ok: false;
      /**
       * A data (rodada) não fecha caixas master inteiras para dividir entre as
       * cores: o ajuste é para `down` ou `up` peças (múltiplos da caixa).
       */
      error: "colors_cartons";
      /** Índice da data (0 = a 1ª; sem programação, 0 é o pedido único). */
      round: number;
      pieces: number;
      carton: number;
      down: number;
      up: number;
    };

/**
 * Divide as peças de cada data entre as cores incluídas.
 *
 * - Com duas ou mais cores e peças por caixa master, cada célula é feita de
 *   caixas inteiras: a data que não fecha caixas inteiras é recusada com o
 *   ajuste (nada é mudado sozinho). Sem a caixa, divide-se em peças.
 * - O total de cada cor é o mais igual possível (diferença de no máximo uma
 *   caixa; o saldo vai para as primeiras cores, na ordem do Book) e, dentro
 *   de cada cor, as caixas são espalhadas pelas datas na proporção de cada
 *   data. As linhas de cada data somam exatamente as peças da data.
 * - Uma cor só fica com tudo, sem regra de caixa (como antes, sem variações).
 */
export function splitByColor(input: {
  /** Peças de cada data (sem programação: uma data só, a quantidade). */
  rounds: number[];
  /** Cores incluídas, na ordem do Book. */
  colors: string[];
  /** Peças por caixa master do item escolhido (nulo: sem caixa). */
  carton: number | null | undefined;
  /**
   * Caixas de cada cor digitadas na tela (dono, 14/11/2026: a quantidade de
   * caixas por cor é livre). Com elas, cada cor fica com as suas caixas,
   * espalhadas pelas datas na proporção de cada data; a soma tem de bater
   * com as caixas das datas. Sem elas: divisão igual.
   */
  cartons?: Record<string, number> | null;
}): ColorSplitResult {
  const colors = input.colors;
  const rounds = input.rounds.map((q) => Math.max(0, Math.round(q)));
  if (!colors.length) return { ok: false, error: "colors_none" };
  const typed =
    input.cartons && input.carton && input.carton >= 1 ? input.cartons : null;
  if (colors.length === 1 && !typed)
    return {
      ok: true,
      rows: [
        {
          color: colors[0],
          quantity: rounds.reduce((s, q) => s + q, 0),
          rounds,
        },
      ],
    };
  const carton =
    input.carton && Number.isFinite(input.carton) && input.carton >= 1
      ? Math.round(input.carton)
      : 1;
  for (let r = 0; r < rounds.length; r++)
    if (rounds[r] % carton !== 0) {
      const down = Math.floor(rounds[r] / carton) * carton;
      return {
        ok: false,
        error: "colors_cartons",
        round: r,
        pieces: rounds[r],
        carton,
        down,
        up: down + carton,
      };
    }
  const units = rounds.map((q) => q / carton);
  const total = units.reduce((s, u) => s + u, 0);
  const k = colors.length;
  // Caixas de cada cor: as digitadas ou, sem elas, iguais (o saldo para as
  // primeiras).
  const need = typed
    ? colors.map((c) => Math.max(0, Math.round(typed[c] ?? 0)))
    : colors.map((_, c) => Math.floor(total / k) + (c < total % k ? 1 : 0));
  if (typed) {
    const got = need.reduce((s, n) => s + n, 0);
    if (got !== total)
      return { ok: false, error: "colors_total", expected: total, got };
  }
  const cells = colors.map(() => rounds.map(() => 0));
  let remaining = total;
  for (let r = 0; r < units.length; r++) {
    const u = units[r];
    if (!u) continue;
    // Proporção do que falta a cada cor; o resto pelas maiores frações.
    const exact = need.map((n) => (remaining ? (n * u) / remaining : 0));
    const give = exact.map((x) => Math.floor(x));
    let left = u - give.reduce((s, g) => s + g, 0);
    const order = colors
      .map((_, c) => c)
      .sort(
        (a, b) =>
          exact[b] - give[b] - (exact[a] - give[a]) ||
          need[b] - give[b] - (need[a] - give[a]) ||
          a - b,
      );
    for (const c of order) {
      if (left <= 0) break;
      if (give[c] < need[c]) {
        give[c]++;
        left--;
      }
    }
    for (let c = 0; c < k; c++) {
      cells[c][r] = give[c];
      need[c] -= give[c];
    }
    remaining -= u;
  }
  return {
    ok: true,
    rows: colors.map((color, c) => {
      const byRound = cells[c].map((n) => n * carton);
      return {
        color,
        quantity: byRound.reduce((s, q) => s + q, 0),
        rounds: byRound,
      };
    }),
  };
}

/**
 * O plano de cores gravado na escolha (e copiado para a solicitação): todas
 * as cores do Book, as incluídas e a divisão. Nulo quando o item não tem
 * variações (uma cor ou nenhuma): segue o fluxo de uma linha só.
 */
export function buildColorPlan(input: {
  assortment: string | null | undefined;
  /** Cores marcadas na tela; undefined = todas (o padrão). */
  included?: string[] | null;
  rounds: number[];
  carton: number | null | undefined;
  /** Caixas de cada cor digitadas na tela (nulo: divisão igual). */
  cartons?: Record<string, number> | null;
}): { plan: ColorPlan | null } | { error: ColorSplitResult & { ok: false } } {
  const colors = colorsOf(input.assortment);
  if (colors.length < 2) return { plan: null };
  const wanted = input.included
    ? new Set(input.included.map((c) => c.toLocaleLowerCase("pt-BR")))
    : null;
  const included = wanted
    ? colors.filter((c) => wanted.has(c.toLocaleLowerCase("pt-BR")))
    : colors;
  const split = splitByColor({
    rounds: input.rounds,
    colors: included,
    carton: input.carton,
    cartons: input.cartons ?? null,
  });
  if (!split.ok) return { error: split };
  return {
    plan: {
      colors,
      included,
      rows: split.rows,
      ...(input.cartons ? { custom: true } : {}),
    },
  };
}

/**
 * Total de caixas espalhado por datas na proporção de `weights` (as peças de
 * cada data), em caixas inteiras; o saldo pelas maiores frações (empate: as
 * primeiras datas). Pesos zerados: partes iguais. Usado quando as caixas de
 * uma cor mudam e o total das datas acompanha a soma das cores.
 */
export function spreadCartons(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (!n) return [];
  const t = Math.max(0, Math.round(total));
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  const exact = weights.map((w) =>
    sum > 0 ? (Math.max(0, w) * t) / sum : t / n,
  );
  const out = exact.map((x) => Math.floor(x));
  let left = t - out.reduce((s, x) => s + x, 0);
  const order = exact
    .map((x, i) => ({ i, f: x - Math.floor(x) }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

/** Peças de cada cor numa data do plano (para a rodada e o pedido filho). */
export function colorsOfRound(
  plan: ColorPlan | null | undefined,
  round: number,
): ColorQuantity[] | null {
  if (!plan?.rows.length) return null;
  return plan.rows
    .map((r) => ({ color: r.color, quantity: r.rounds[round] ?? 0 }))
    .filter((r) => r.quantity > 0);
}

/** Peças de cada cor no total do plano (o pedido sem programação ou o pai). */
export function colorTotals(
  plan: ColorPlan | null | undefined,
): ColorQuantity[] | null {
  if (!plan?.rows.length) return null;
  return plan.rows
    .map((r) => ({ color: r.color, quantity: r.quantity }))
    .filter((r) => r.quantity > 0);
}

/** O plano bate com o total (as linhas somam as peças)? */
export const planMatches = (
  plan: ColorPlan | null | undefined,
  total: number,
): boolean =>
  !plan || plan.rows.reduce((s, r) => s + r.quantity, 0) === Math.round(total);
