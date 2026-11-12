import type { TableName, Tables } from "./schema";
import type { Store } from "./store";

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
