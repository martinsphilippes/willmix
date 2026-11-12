import { TABLES, type TableName, type Tables } from "./schema";
import type { ListOptions, Store } from "./store";
import { pickColumns } from "./store";

/**
 * Ajudas de leitura para telas que mostram nomes de cadastros grandes
 * (parceiros ~32 mil, produtos ~17 mil). Baixar a tabela inteira para achar
 * o nome de poucas dezenas de ids custava dezenas de MB por página; aqui sai
 * só o que a tela usa.
 */

/** Linhas com esses ids (sem repetir, sem vazios); lista vazia não consulta. */
export function listByIds<K extends TableName>(
  store: Store,
  table: K,
  ids: Iterable<string | null | undefined>,
): Promise<Tables[K][]> {
  const unique = [...new Set([...ids].filter((v): v is string => !!v))];
  if (!unique.length) return Promise.resolve([]);
  return store.list(table, {
    filter: { id: unique } as never,
  });
}

/**
 * Mapa campo → primeira linha com aquele valor (na ordem da lista), como o
 * `rows.find((r) => r[campo] === valor)` que ele substitui, sem percorrer a
 * lista inteira a cada busca.
 */
export function indexBy<T, F extends keyof T>(
  rows: readonly T[],
  field: F,
): Map<T[F], T> {
  const map = new Map<T[F], T>();
  for (const row of rows) if (!map.has(row[field])) map.set(row[field], row);
  return map;
}

/**
 * Só as colunas que a tela usa (mais id e datas). No Supabase o banco já
 * devolve só elas; nos outros stores a linha inteira é recortada, para o
 * resultado ser igual nos dois.
 */
export async function listColumns<
  K extends TableName,
  C extends keyof Tables[K] & string,
>(
  store: Store,
  table: K,
  columns: readonly C[],
  options: ListOptions<Tables[K]> = {},
): Promise<Pick<Tables[K], C | "id" | "createdAt" | "updatedAt">[]> {
  if (store.listColumns) return store.listColumns(table, columns, options);
  return (await store.list(table, options)).map((r) => pickColumns(r, columns));
}

/**
 * Todas as colunas da tabela menos as indicadas (ex.: a cópia do registro do
 * ERP, `sankhyaRefs`, que nenhuma lista usa e pesa mais que o resto).
 */
export function columnsExcept<
  K extends TableName,
  O extends keyof Tables[K] & string,
>(table: K, omit: readonly O[]): Exclude<keyof Tables[K] & string, O>[] {
  return Object.keys(TABLES[table].columns).filter(
    (c) => !(omit as readonly string[]).includes(c),
  ) as Exclude<keyof Tables[K] & string, O>[];
}
