import type { ByteRange } from "@/lib/http-range";
import type { BaseRow, TableName, Tables } from "./schema";

/**
 * Camada de dados mínima. Duas implementações:
 * - MemoryStore: JSON em disco (.data/), para desenvolvimento e testes;
 * - AppwriteStore: TablesDB + Storage, para produção.
 *
 * Filtros são igualdade simples (ou lista de valores). Consultas mais ricas
 * (atrasos, agregações) são feitas em memória sobre listas pequenas.
 */

export type FilterValue =
  string | number | boolean | null | Array<string | number>;
export type Filter<T> = Partial<Record<keyof T & string, FilterValue>>;

export interface ListOptions<T> {
  filter?: Filter<T>;
  orderBy?: keyof T & string;
  direction?: "asc" | "desc";
  limit?: number;
  /**
   * Texto contido na coluna, sem diferenciar maiúsculas (busca dos campos
   * de cliente/fornecedor: ~26 mil clientes não cabem numa lista).
   */
  search?: { column: keyof T & string; text: string };
}

/** O texto da busca sem os caracteres especiais do LIKE e do PostgREST. */
export function searchText(text: string) {
  return text
    .replace(/[%_*,()\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca do modo memória e do Appwrite: contém o texto, sem caixa nem acento. */
export function matchesSearch<T extends object>(
  row: T,
  search?: { column: keyof T & string; text: string },
): boolean {
  if (!search) return true;
  const fold = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const value = (row as Record<string, unknown>)[search.column];
  return (
    typeof value === "string" &&
    fold(value).includes(fold(searchText(search.text)))
  );
}

/**
 * Etapas e pendências em espera (`held`): as dos pedidos da carga do
 * histórico do Sankhya, ocultas até o go-live, quando uma sincronização traz
 * a situação real (docs/SANKHYA.md, "Histórico em espera"). Ficam de fora
 * das listas gerais (Pendências, lembretes, SLA, contagens), que filtram só
 * por situação ou chave. A leitura de um pedido ou de linhas já escolhidas
 * (filtro `orderId`, `stageId` ou `id`), a leitura por id (`get`) e quem
 * filtra `held` de propósito continuam vendo tudo: as ações num pedido do
 * histórico funcionam como antes.
 */
export const HELD_TABLES: ReadonlySet<TableName> = new Set<TableName>([
  "stages",
  "requirements",
]);

const SCOPED_FILTERS = ["orderId", "stageId", "id", "held"];

export function hidesHeld(
  table: TableName,
  options: { filter?: object } = {},
): boolean {
  if (!HELD_TABLES.has(table)) return false;
  const filter = (options.filter ?? {}) as Record<string, unknown>;
  return !SCOPED_FILTERS.some((field) => field in filter);
}

/** Linha em espera (ver `hidesHeld`). */
export const isHeld = (row: object) =>
  (row as { held?: unknown }).held === true;

export type NewRow<T extends BaseRow> = Omit<T, keyof BaseRow> & {
  id?: string;
};
export type Patch<T extends BaseRow> = Partial<Omit<T, keyof BaseRow>>;

export interface StoredFile {
  key: string;
  name: string;
  mime: string;
  size: number;
}

export interface Store {
  readonly mode: "memory" | "appwrite" | "supabase";
  list<K extends TableName>(
    table: K,
    options?: ListOptions<Tables[K]>,
  ): Promise<Tables[K][]>;
  get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null>;
  create<K extends TableName>(
    table: K,
    data: NewRow<Tables[K]>,
  ): Promise<Tables[K]>;
  update<K extends TableName>(
    table: K,
    id: string,
    patch: Patch<Tables[K]>,
  ): Promise<Tables[K]>;
  remove<K extends TableName>(table: K, id: string): Promise<void>;
  /**
   * Grava várias linhas de uma vez pelo id: cria as que não existem e
   * substitui as que existem (resumos derivados; docs/RESUMOS.md). Opcional:
   * sem ele, quem chama grava uma a uma.
   */
  upsertMany?<K extends TableName>(
    table: K,
    rows: Array<NewRow<Tables[K]> & { id: string }>,
  ): Promise<void>;
  /**
   * Muda as linhas que casam com o filtro (igualdade ou lista de valores),
   * numa ida ao banco. Opcional: sem ele, quem chama lista e grava uma a
   * uma. Não refaz resumos (docs/RESUMOS.md): quem usa reconstrói depois.
   */
  updateWhere?<K extends TableName>(
    table: K,
    filter: Filter<Tables[K]>,
    patch: Patch<Tables[K]>,
  ): Promise<void>;
  /** Quantas linhas casam com o filtro, sem trazê-las. Opcional. */
  count?<K extends TableName>(
    table: K,
    filter: Filter<Tables[K]>,
  ): Promise<number>;
  putFile(bytes: Uint8Array, name: string, mime: string): Promise<StoredFile>;
  /** Metadados de um arquivo já no armazenamento (ex.: enviado direto pelo navegador); null se não existe. */
  statFile(key: string): Promise<StoredFile | null>;
  /**
   * Conteúdo em fluxo, sem carregar o arquivo inteiro na memória (downloads
   * grandes). Com `range`, só aquele pedaço (vídeo no Safari); `range` na
   * resposta diz o pedaço entregue (null: o arquivo inteiro).
   */
  streamFile(
    key: string,
    range?: ByteRange | null,
  ): Promise<{
    body: ReadableStream<Uint8Array>;
    name: string;
    mime: string;
    size: number;
    range: ByteRange | null;
  } | null>;
  getFile(
    key: string,
  ): Promise<{ bytes: Uint8Array; name: string; mime: string } | null>;
  /** Apaga o arquivo do armazenamento (sem erro se já não existir). */
  removeFile(key: string): Promise<void>;
  /**
   * Link assinado para o navegador subir um arquivo direto (só Supabase; os
   * outros stores não têm).
   */
  createSignedUpload?(name: string): Promise<{ key: string; url: string }>;
  /** Próximo valor de um contador sequencial (ex.: número do pedido). */
  nextNumber(key: string): Promise<number>;
  /**
   * Só algumas colunas (mais id e datas), para listas grandes. Opcional: sem
   * ela, `listColumns` (lookup.ts) lê a linha inteira e recorta.
   */
  listColumns?<K extends TableName, C extends keyof Tables[K] & string>(
    table: K,
    columns: readonly C[],
    options?: ListOptions<Tables[K]>,
  ): Promise<Pick<Tables[K], C | "id" | "createdAt" | "updatedAt">[]>;
}

/** A linha só com id, datas e as colunas pedidas. */
export function pickColumns<T extends object, C extends keyof T & string>(
  row: T,
  columns: readonly C[],
): Pick<
  T,
  C | ("id" & keyof T) | ("createdAt" & keyof T) | ("updatedAt" & keyof T)
> {
  const out: Record<string, unknown> = {};
  for (const key of ["id", "createdAt", "updatedAt", ...columns])
    if (key in row) out[key] = (row as Record<string, unknown>)[key];
  return out as never;
}

/**
 * Teste de uma linha contra o filtro. Para filtrar muitas linhas, use
 * `rowMatcher` (monta os conjuntos do "igual a um destes" uma vez só: com
 * milhares de ids, o `includes` linha a linha levava segundos).
 */
export function matchesFilter<T extends object>(
  row: T,
  filter?: Filter<T>,
): boolean {
  return rowMatcher(filter)(row);
}

export function rowMatcher<T extends object>(
  filter?: Filter<T>,
): (row: T) => boolean {
  if (!filter) return () => true;
  const checks = Object.values(filter).map((expected) => {
    if (Array.isArray(expected)) {
      const set = new Set<unknown>(expected);
      return (actual: unknown) => set.has(actual);
    }
    return (actual: unknown) => matchesValue(actual, expected as FilterValue);
  });
  const keys = Object.keys(filter);
  return (row: T) => {
    for (let i = 0; i < keys.length; i++)
      if (!checks[i]((row as Record<string, unknown>)[keys[i]])) return false;
    return true;
  };
}

function matchesValue(actual: unknown, expected: FilterValue): boolean {
  // Como o "is null" do banco: campo ausente também é vazio.
  if (expected === null) return actual == null;
  return actual === expected;
}

export function sortRows<T extends object>(
  rows: T[],
  orderBy?: keyof T & string,
  direction: "asc" | "desc" = "asc",
): T[] {
  if (!orderBy) return rows;
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[orderBy];
    const bv = (b as Record<string, unknown>)[orderBy];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return (av < bv ? -1 : 1) * sign;
  });
}
