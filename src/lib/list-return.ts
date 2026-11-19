/*
 * Volta para a lista como ela estava (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 7): ao abrir os detalhes de uma linha (o número ou o ícone), a lista
 * guarda nesta aba o endereço dela (busca, filtros, ordem e página do
 * servidor), a busca, a ordem e a página da tabela e a posição da rolagem.
 * "Voltar às solicitações" leva a esse endereço e a lista, ao voltar, abre na
 * mesma página da tabela e na mesma rolagem. Sem nada guardado (link aberto
 * direto, outra aba), a lista abre do início.
 *
 * Fica só nesta aba (sessionStorage) e vale por 30 minutos; é só a vista da
 * pessoa, nunca dado do portal.
 */

/** Estado da tabela (TableTools): a busca, a ordem e a página. */
export interface TableViewState {
  query: string;
  sort: { column: number; desc: boolean } | null;
  page: number;
}

export interface ListReturn {
  /** Endereço da lista (caminho e parâmetros) quando a linha foi aberta. */
  url: string;
  /** Rolagem da janela naquele momento. */
  y: number;
  /** Quando foi guardado (ms). */
  at: number;
  /** A vista da tabela, quando a lista usa a TableTools. */
  table: TableViewState | null;
}

/** As listas que lembram a vista, com o endereço de cada uma. */
export const LIST_RETURN_PATHS = {
  requests: "/app/requests",
} as const;
export type ReturnList = keyof typeof LIST_RETURN_PATHS;

export const LIST_RETURN_PREFIX = "wellmix:list-return:";
/** Depois disso a lista volta a abrir do início. */
export const LIST_RETURN_FRESH_MS = 30 * 60 * 1000;

const MAX_QUERY = 200;

/** A vista da tabela lida de um texto (ou nula, se não for uma). */
export function parseTableView(value: unknown): TableViewState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const query = typeof v.query === "string" ? v.query.slice(0, MAX_QUERY) : "";
  const page =
    typeof v.page === "number" && Number.isInteger(v.page) && v.page >= 0
      ? Math.min(v.page, 10_000)
      : 0;
  const s = v.sort as Record<string, unknown> | null | undefined;
  const sort =
    s &&
    typeof s === "object" &&
    typeof s.column === "number" &&
    Number.isInteger(s.column) &&
    s.column >= 0 &&
    s.column < 100 &&
    typeof s.desc === "boolean"
      ? { column: s.column, desc: s.desc }
      : null;
  return { query, sort, page };
}

/** O que foi guardado, conferido (endereço da própria lista, números válidos). */
export function parseListReturn(
  raw: string | null,
  listPath: string,
): ListReturn | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const v = data as Record<string, unknown>;
  const url = typeof v.url === "string" ? v.url : "";
  // Só o endereço da própria lista (nunca outro caminho ou outro site).
  if (url !== listPath && !url.startsWith(`${listPath}?`)) return null;
  if (url.length > 2000) return null;
  const y =
    typeof v.y === "number" && Number.isFinite(v.y) && v.y >= 0
      ? Math.round(v.y)
      : 0;
  const at = typeof v.at === "number" && Number.isFinite(v.at) ? v.at : 0;
  return { url, y, at, table: parseTableView(v.table) };
}

/** Ainda vale (guardado há menos de 30 minutos)? */
export function isFresh(saved: ListReturn, now: number): boolean {
  return now - saved.at >= 0 && now - saved.at < LIST_RETURN_FRESH_MS;
}

/** A chave da lista no sessionStorage. */
export const listReturnKey = (list: ReturnList) =>
  `${LIST_RETURN_PREFIX}${list}`;

/** Lê o que a lista guardou (nulo sem armazenamento ou sem nada guardado). */
export function readListReturn(list: ReturnList): ListReturn | null {
  try {
    return parseListReturn(
      window.sessionStorage.getItem(listReturnKey(list)),
      LIST_RETURN_PATHS[list],
    );
  } catch {
    return null;
  }
}

export function writeListReturn(list: ReturnList, value: ListReturn | null) {
  try {
    if (value)
      window.sessionStorage.setItem(listReturnKey(list), JSON.stringify(value));
    else window.sessionStorage.removeItem(listReturnKey(list));
  } catch {
    // Sem armazenamento (aba privada): a lista abre do início.
  }
}
