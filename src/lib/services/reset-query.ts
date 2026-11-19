import "server-only";

import { getStore, TABLES, type TableName } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import {
  HELD_TABLES,
  type FilterValue,
  type ListOptions,
} from "@/lib/db/store";
import { isSchemaMissing } from "@/lib/db/errors";

/*
 * Leituras das limpezas (Configurações → Limpar dados; 19/11/2026). A tela e
 * as ações estouravam a memória da Vercel lendo tabelas inteiras (pedidos,
 * requisitos, histórico). Aqui só saem as colunas pedidas, filtradas no banco,
 * e as consultas por id vão em pedaços.
 */

export type Row = Record<string, unknown> & { id: string };

/** Ids por consulta "igual a um destes" (o Supabase ainda parte em 100). */
const CHUNK = 1000;

/** Só id, datas e as colunas pedidas; tabela não publicada volta vazia. */
export async function cols(
  table: TableName,
  columns: readonly string[],
  options: ListOptions<Record<string, unknown>> = {},
): Promise<Row[]> {
  const known = columns.filter((c) => c in TABLES[table].columns);
  try {
    return (await listColumns(
      getStore(),
      table,
      known as never,
      options as never,
    )) as unknown as Row[];
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Linhas cuja coluna está entre os ids (em pedaços; sem ids, nada). */
export async function colsWhereIn(
  table: TableName,
  column: string,
  ids: Iterable<string>,
  columns: readonly string[],
  filter: Record<string, FilterValue> = {},
): Promise<Row[]> {
  if (!(column in TABLES[table].columns) && column !== "id") return [];
  const list = [...new Set(ids)];
  const out: Row[] = [];
  for (let i = 0; i < list.length; i += CHUNK)
    out.push(
      ...(await cols(table, columns, {
        filter: { ...filter, [column]: list.slice(i, i + CHUNK) },
      })),
    );
  return out;
}

/**
 * Filtros que cobrem a tabela inteira. Nas tabelas com histórico em espera
 * (`held`) a lista sem filtro esconde essas linhas; pelos três valores de
 * `held` a limpeza vê todas.
 */
export function wholeTable(
  table: TableName,
): Array<Record<string, FilterValue>> {
  return HELD_TABLES.has(table)
    ? [{ held: true }, { held: false }, { held: null }]
    : [{}];
}

/** Quantas linhas casam com o filtro, sem trazê-las. */
export async function countRows(
  table: TableName,
  filter: Record<string, FilterValue> = {},
): Promise<number> {
  const store = getStore();
  try {
    if (store.count) return await store.count(table, filter as never);
    return (await cols(table, [], { filter })).length;
  } catch (error) {
    if (isSchemaMissing(error)) return 0;
    throw error;
  }
}

/** Linhas da tabela inteira (inclusive as em espera). */
export async function countTable(table: TableName): Promise<number> {
  let total = 0;
  for (const filter of wholeTable(table))
    total += await countRows(table, filter);
  return total;
}

/**
 * Roda em lotes (o banco apaga uma linha por vez). Para antes do lote
 * seguinte se o tempo acabou; devolve se terminou tudo.
 */
export async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<unknown>,
  deadline = Infinity,
) {
  for (let i = 0; i < items.length; i += size) {
    if (Date.now() >= deadline) return false;
    // Espera o lote inteiro antes de acusar a falha: nada fica rodando depois.
    const results = await Promise.allSettled(items.slice(i, i + size).map(fn));
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  }
  return true;
}

/**
 * Apaga a tabela inteira em páginas (só os ids na memória), das linhas mais
 * antigas para as mais novas. O que foi criado depois de `startedAt` (venda
 * nova durante a limpeza) fica. Devolve se terminou (false: acabou o tempo).
 */
export async function sweepTable(
  table: TableName,
  startedAt: string,
  remove: (id: string) => Promise<unknown>,
  deadline = Infinity,
  page = 500,
): Promise<boolean> {
  for (const filter of wholeTable(table)) {
    for (;;) {
      if (Date.now() >= deadline) return false;
      const rows = await cols(table, [], {
        filter,
        orderBy: "createdAt",
        limit: page,
      });
      const old = rows.filter((r) => String(r.createdAt) <= startedAt);
      if (old.length) {
        const ok = await inBatches(
          old.map((r) => r.id),
          10,
          remove,
          deadline,
        );
        if (!ok) return false;
      }
      // Página incompleta ou só com linhas novas: acabou esta parte.
      if (rows.length < page || old.length < rows.length) break;
    }
  }
  return true;
}
