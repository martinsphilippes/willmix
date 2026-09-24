import type { BaseRow, TableName, Tables } from "./schema";

/**
 * Camada de dados mínima. Duas implementações:
 * - MemoryStore: JSON em disco (.data/), para desenvolvimento e testes;
 * - AppwriteStore: TablesDB + Storage, para produção.
 *
 * Filtros são igualdade simples (ou lista de valores). Consultas mais ricas
 * (atrasos, agregações) são feitas em memória sobre listas pequenas.
 */

export type FilterValue = string | number | boolean | null | Array<string | number>;
export type Filter<T> = Partial<Record<keyof T & string, FilterValue>>;

export interface ListOptions<T> {
  filter?: Filter<T>;
  orderBy?: keyof T & string;
  direction?: "asc" | "desc";
  limit?: number;
}

export type NewRow<T extends BaseRow> = Omit<T, keyof BaseRow> & { id?: string };
export type Patch<T extends BaseRow> = Partial<Omit<T, keyof BaseRow>>;

export interface StoredFile {
  key: string;
  name: string;
  mime: string;
  size: number;
}

export interface Store {
  readonly mode: "memory" | "appwrite";
  list<K extends TableName>(table: K, options?: ListOptions<Tables[K]>): Promise<Tables[K][]>;
  get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null>;
  create<K extends TableName>(table: K, data: NewRow<Tables[K]>): Promise<Tables[K]>;
  update<K extends TableName>(table: K, id: string, patch: Patch<Tables[K]>): Promise<Tables[K]>;
  remove<K extends TableName>(table: K, id: string): Promise<void>;
  putFile(bytes: Uint8Array, name: string, mime: string): Promise<StoredFile>;
  getFile(key: string): Promise<{ bytes: Uint8Array; name: string; mime: string } | null>;
  /** Próximo valor de um contador sequencial (ex.: número do pedido). */
  nextNumber(key: string): Promise<number>;
}

export function matchesFilter<T extends object>(row: T, filter?: Filter<T>): boolean {
  if (!filter) return true;
  for (const [key, expected] of Object.entries(filter)) {
    const actual = (row as Record<string, unknown>)[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual as string | number)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
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
