/**
 * Regras puras da busca e da ordenação das tabelas (src/components/table-tools.tsx).
 * Sem DOM, para o teste unitário cobrir os formatos que aparecem nas telas:
 * moeda (R$ 1.234,56 / US$ 1,234.56), percentual, data dd/mm/aaaa e texto.
 */

export const PAGE_SIZES = [15, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Evento (disparado numa linha da tabela, borbulha) que pede para mostrar a
 * linha: a tabela limpa a busca que a esconde e vai à página dela (ex.: o
 * link de um campo na lista de pendências do Book).
 */
export const TABLE_REVEAL_EVENT = "wellmix:table-reveal";

/** Página (base 0) da linha na posição `index` da lista filtrada. */
export const pageOfIndex = (index: number, pageSize: number) =>
  index < 0 || pageSize <= 0 ? 0 : Math.floor(index / pageSize);

/** Minúsculas, sem acento e com espaços simples: "Ação  Nº" → "acao nº". */
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Todas as palavras da busca aparecem no texto da linha (em qualquer ordem). */
export function matchesQuery(rowText: string, query: string) {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const text = normalizeText(rowText);
  return terms.every((term) => text.includes(term));
}

export type SortKey =
  | { kind: "empty" }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string };

const DATE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/;
/* Até 5 caracteres de prefixo (R$, US$, CNY, ¥) e de sufixo (%, kg, m³, un). */
const NUMBER =
  /^[^\d\s-]{0,5}\s?(-?)\s?((?:\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:[.,]\d+)?)\s?[^\d\s]{0,5}$/;

function toNumber(raw: string, decimalComma: boolean) {
  const compact = raw.replace(/\s/g, "");
  const commas = compact.split(",").length - 1;
  const dots = compact.split(".").length - 1;
  let decimal: "," | "." | null = null;
  if (commas && dots) {
    // Os dois aparecem: o último é o decimal (1.234,56 ou 1,234.56).
    decimal = compact.lastIndexOf(",") > compact.lastIndexOf(".") ? "," : ".";
  } else if (commas + dots === 1) {
    const sep = commas ? "," : ".";
    const after = compact.length - compact.indexOf(sep) - 1;
    // Um separador seguido de 3 dígitos é milhar quando é o milhar do idioma
    // da tela ("1.234" é mil e duzentos em pt; "1,234" em en).
    const thousands = decimalComma ? "." : ",";
    decimal = after === 3 && sep === thousands ? null : sep;
  }
  // Repetido (1.234.567) ou ausente: só milhar.
  const digits = compact
    .split("")
    .filter((c) => (c !== "," && c !== "." ? true : c === decimal))
    .join("")
    .replace(",", ".");
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** Chave de ordenação de uma célula: número, data (como número) ou texto. */
export function sortKey(raw: string, decimalComma = true): SortKey {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text === "—" || text === "-") return { kind: "empty" };
  const date = DATE.exec(text);
  if (date) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = date;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return {
      kind: "number",
      value: Date.UTC(year, Number(m) - 1, Number(d), +hh, +mm, +ss),
    };
  }
  const iso = ISO_DATE.exec(text);
  if (iso && iso[0].length === text.length) {
    const [, y, m, d, hh = "0", mm = "0", ss = "0"] = iso;
    return {
      kind: "number",
      value: Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss),
    };
  }
  const number = NUMBER.exec(text);
  if (number) {
    const value = toNumber(number[2], decimalComma);
    if (value !== null)
      return { kind: "number", value: number[1] ? -value : value };
  }
  return { kind: "text", value: text };
}

const collator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Compara duas chaves. Vazio fica sempre no fim (nas duas direções); número
 * antes de texto; texto em ordem alfabética com números naturais ("Item 2"
 * antes de "Item 10").
 */
export function compareKeys(a: SortKey, b: SortKey, desc: boolean) {
  if (a.kind === "empty" || b.kind === "empty") {
    if (a.kind === b.kind) return 0;
    return a.kind === "empty" ? 1 : -1;
  }
  let result: number;
  if (a.kind === "number" && b.kind === "number") result = a.value - b.value;
  else if (a.kind === "number") result = -1;
  else if (b.kind === "number") result = 1;
  else result = collator.compare(a.value, b.value);
  return desc ? -result : result;
}

/** Faixa mostrada no rodapé: "16–30 de 42". */
export function pageRange(page: number, size: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  const from = total ? current * size + 1 : 0;
  const to = Math.min(total, (current + 1) * size);
  return { pages, current, from, to };
}
