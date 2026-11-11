/*
 * NCM do item do booking por aproximação (docs/BOOKING.md, "NCM do item"):
 * o nome do item é comparado com os nomes dos produtos do cadastro que têm
 * NCM. Vale o NCM do produto mais provável; com vários igualmente
 * prováveis, a moda entre eles. Sem produto provável (ou com empate na
 * moda), não há correspondência e o despachante preenche. Regras puras.
 */

/** Semelhança mínima (0 a 1) para um produto contar como provável. */
export const NCM_MATCH_MIN = 0.5;
/** Diferença até a qual duas semelhanças contam como iguais. */
const TIE = 1e-9;

/** Palavras que não identificam o produto (artigos, unidades, embalagem genérica). */
const STOP = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "sem",
  "para",
  "e",
  "em",
  "o",
  "a",
  "the",
  "of",
  "with",
  "for",
  "and",
  "in",
  "to",
  "a",
  "an",
  "pcs",
  "pc",
  "set",
  "new",
  "ml",
  "cm",
  "mm",
  "kg",
  "g",
  "l",
]);

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palavras significativas de um nome (sem números, medidas e palavras vazias). */
export function nameTokens(name: string | null | undefined): Set<string> {
  return new Set(
    fold(name ?? "")
      .split(/[^a-z0-9一-鿿]+/)
      .filter((w) => w.length >= 2 && !/\d/.test(w) && !STOP.has(w)),
  );
}

/** Semelhança entre dois conjuntos de palavras (Jaccard: comuns ÷ todas). */
export function tokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / (a.size + b.size - common);
}

const codeKey = (c: string | null | undefined) =>
  (c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Um produto do cadastro com NCM e os nomes e códigos pelos quais é reconhecido. */
export interface NcmCandidate {
  productId: string;
  ncm: string;
  /** Nome do produto e descrições dos itens de booking já ligados a ele. */
  names: string[];
  /** Códigos de fábrica do produto (dele, dos fornecedores e dos itens ligados). */
  codes: string[];
}

export interface NcmMatch {
  ncm: string;
  /** Semelhança do(s) produto(s) mais provável(is). */
  score: number;
  /** Produtos igualmente prováveis (que deram a moda). */
  productIds: string[];
}

/**
 * NCM do item por aproximação. Código de fábrica igual conta como
 * semelhança 1. Nulo quando nenhum produto passa de `NCM_MATCH_MIN` ou
 * quando os mais prováveis empatam entre NCMs diferentes.
 */
export function matchNcm(
  item: { names: Array<string | null | undefined>; code: string | null },
  candidates: NcmCandidate[],
): NcmMatch | null {
  const tokens = new Set<string>();
  for (const n of item.names) for (const w of nameTokens(n)) tokens.add(w);
  const code = codeKey(item.code);
  let best = 0;
  let top: NcmCandidate[] = [];
  for (const c of candidates) {
    let score = 0;
    if (code.length >= 3 && c.codes.some((k) => codeKey(k) === code)) score = 1;
    else
      for (const n of c.names)
        score = Math.max(score, tokenSimilarity(tokens, nameTokens(n)));
    if (score < NCM_MATCH_MIN) continue;
    if (score > best + TIE) {
      best = score;
      top = [c];
    } else if (Math.abs(score - best) <= TIE) top.push(c);
  }
  if (!top.length) return null;
  // Moda dos NCMs entre os igualmente prováveis; empate = sem correspondência.
  const count = new Map<string, number>();
  for (const c of top) count.set(c.ncm, (count.get(c.ncm) ?? 0) + 1);
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  const ncm = ranked[0][0];
  return {
    ncm,
    score: Number(best.toFixed(4)),
    productIds: top.filter((c) => c.ncm === ncm).map((c) => c.productId),
  };
}

/**
 * Grupo de itens parecidos para o despachante (classifica de uma vez): as
 * duas primeiras palavras significativas do nome, em ordem alfabética.
 */
export function ncmGroupKey(name: string | null | undefined): string {
  const words = [...nameTokens(name)].filter((w) => w.length >= 3);
  return words.slice(0, 2).sort().join(" ") || "—";
}
