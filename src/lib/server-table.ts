import {
  compareKeys,
  matchesQuery,
  pageRange,
  sortKey,
  type SortKey,
} from "./table-tools";

/*
 * Tabela paginada no servidor (auditoria de performance, 14/11/2026).
 *
 * As listas de cadastro (Parceiros, Clientes, Fornecedores) mandavam todas as
 * linhas ao navegador, e a TableTools escondia o que não cabia na página. Com
 * o volume de produção (26 mil clientes, 5,7 mil fornecedores), a página saía
 * com 108 MB (Parceiros), 281 MB (Clientes) e 54 MB (Fornecedores), medido no
 * servidor compilado com dados sintéticos do mesmo tamanho.
 *
 * Aqui a busca, a ordem e a página acontecem no servidor, com as mesmas regras
 * da TableTools (src/lib/table-tools.ts):
 * - a busca acha todas as palavras, sem acento nem caixa, no texto da linha;
 * - a ordem usa o texto de cada coluna: número, data e texto com número
 *   natural; vazio fica sempre no fim; um terceiro clique volta à ordem original;
 * - a ordem vale para a lista inteira, e não só para a página.
 */

export interface ServerColumn<T> {
  /** Chave da coluna no endereço (`?sort=chave` ou `?sort=-chave`). */
  key: string;
  /** Texto da célula como a tela mostra: base da busca e da ordem. */
  text: (row: T) => string;
  /** Coluna que não ordena (ações). */
  sortable?: boolean;
}

export interface ServerSort {
  key: string;
  desc: boolean;
}

export const SERVER_PAGE_SIZE = 50;

/**
 * Até quantas linhas a lista continua inteira no navegador, com a TableTools
 * de sempre (busca ao digitar, ordem e páginas de 15/25/50). Acima disso,
 * busca, ordem e página no servidor. Uma linha de cliente pesa ~10 kB de
 * HTML: 200 linhas ficam em ~2 MB; 26 mil passavam de 280 MB.
 */
export const SERVER_TABLE_FROM = 200;

/** `?sort=nome` (crescente) ou `?sort=-nome` (decrescente); chave desconhecida: sem ordem. */
export function parseServerSort<T>(
  raw: string | undefined,
  columns: readonly ServerColumn<T>[],
): ServerSort | null {
  const value = (raw ?? "").trim();
  const key = value.replace(/^-/, "");
  const column = columns.find((c) => c.key === key);
  if (!column || column.sortable === false) return null;
  return { key, desc: value.startsWith("-") };
}

/** Próxima ordem ao clicar na coluna: crescente → decrescente → original. */
export function nextServerSort(
  current: ServerSort | null,
  key: string,
): string | null {
  if (current?.key !== key) return key;
  return current.desc ? null : `-${key}`;
}

/** Página pedida (`?pg=2`, base 1) como índice base 0. */
export function parseServerPage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n - 1 : 0;
}

export interface ServerTablePage<T> {
  rows: T[];
  /** Linhas antes da busca. */
  total: number;
  /** Linhas que a busca achou. */
  matched: number;
  /** Página mostrada (base 0) e quantas há. */
  page: number;
  pages: number;
  from: number;
  to: number;
}

export function serverTable<T>(
  rows: readonly T[],
  columns: readonly ServerColumn<T>[],
  state: {
    q?: string;
    sort?: ServerSort | null;
    page?: number;
    size?: number;
    /** Vírgula decimal (pt); en e zh usam ponto. */
    decimalComma?: boolean;
    /**
     * Linha que precisa aparecer (ex.: a volta de uma ação nela): a página
     * dela, no lugar da pedida, como o "mostrar a linha" da TableTools.
     */
    reveal?: (row: T) => boolean;
  },
): ServerTablePage<T> {
  const size = state.size ?? SERVER_PAGE_SIZE;
  const q = state.q ?? "";
  const matched = q
    ? rows.filter((row) =>
        matchesQuery(columns.map((c) => c.text(row)).join(" "), q),
      )
    : [...rows];
  const sort = state.sort;
  const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (sort && column && column.sortable !== false) {
    const keys = new Map<T, SortKey>(
      matched.map((row) => [
        row,
        sortKey(column.text(row), state.decimalComma ?? true),
      ]),
    );
    const original = new Map(matched.map((row, i) => [row, i]));
    matched.sort(
      (a, b) =>
        compareKeys(keys.get(a)!, keys.get(b)!, sort.desc) ||
        original.get(a)! - original.get(b)!,
    );
  }
  const wanted = state.reveal ? matched.findIndex(state.reveal) : -1;
  const { pages, current, from, to } = pageRange(
    wanted >= 0 ? Math.floor(wanted / size) : (state.page ?? 0),
    size,
    matched.length,
  );
  return {
    rows: matched.slice(current * size, current * size + size),
    total: rows.length,
    matched: matched.length,
    page: current,
    pages,
    from,
    to,
  };
}
