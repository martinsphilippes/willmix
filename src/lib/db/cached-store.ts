import { cache } from "react";
import type { TableName, Tables } from "./schema";
import type { ListOptions, NewRow, Patch, Store } from "./store";
import { pickColumns } from "./store";
import type { ByteRange } from "@/lib/http-range";

/**
 * Leituras memorizadas por requisição. Uma página chama o mesmo `get`/`list`
 * várias vezes (layout, página, serviços); cada chamada ao Appwrite custa uma
 * ida e volta. Aqui a mesma leitura vira uma chamada só por requisição.
 *
 * - Escopo: `cache()` do React vale para uma renderização; fora dela (testes,
 *   scripts) não memoriza e tudo passa direto.
 * - Qualquer escrita limpa o que foi memorizado, para a página não ler dado velho.
 * - Cada chamada recebe uma cópia, para ninguém alterar o resultado de outra.
 * - DB_TRACE=1 registra cada ida ao banco com o tempo (diagnóstico).
 */
const requestReads = cache(() => new Map<string, Promise<unknown>>());

const trace = process.env.DB_TRACE === "1";
/** DB_CACHE=0 desliga a memorização (comparação e emergência). */
const enabled = process.env.DB_CACHE !== "0";

export class CachedStore implements Store {
  constructor(private readonly base: Store) {}

  get createSignedUpload() {
    return this.base.createSignedUpload?.bind(this.base);
  }

  get mode() {
    return this.base.mode;
  }

  private read<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!enabled) {
      const started = trace ? performance.now() : 0;
      return load().then((value) => {
        if (trace)
          console.info(
            `[db] ${key.slice(0, 120)} ${(performance.now() - started).toFixed(0)}ms`,
          );
        return value;
      });
    }
    const reads = requestReads();
    let pending = reads.get(key) as Promise<T> | undefined;
    if (!pending) {
      const started = trace ? performance.now() : 0;
      pending = load().then((value) => {
        if (trace)
          console.info(
            `[db] ${key.slice(0, 120)} ${(performance.now() - started).toFixed(0)}ms`,
          );
        return value;
      });
      // Falha não fica memorizada: a próxima leitura tenta de novo.
      pending.catch(() => reads.delete(key));
      reads.set(key, pending);
    }
    return pending.then((value) => structuredClone(value));
  }

  private written() {
    requestReads().clear();
  }

  list<K extends TableName>(table: K, options: ListOptions<Tables[K]> = {}) {
    return this.read(`list:${table}:${JSON.stringify(options)}`, () =>
      this.base.list(table, options),
    );
  }

  /** Colunas escolhidas (Supabase); nos outros stores, a linha recortada. */
  listColumns<K extends TableName, C extends keyof Tables[K] & string>(
    table: K,
    columns: readonly C[],
    options: ListOptions<Tables[K]> = {},
  ) {
    return this.read(
      `cols:${table}:${columns.join(",")}:${JSON.stringify(options)}`,
      async () =>
        this.base.listColumns
          ? this.base.listColumns(table, columns, options)
          : (await this.base.list(table, options)).map((r) =>
              pickColumns(r, columns),
            ),
    );
  }

  get<K extends TableName>(table: K, id: string) {
    return this.read(`get:${table}:${id}`, () => this.base.get(table, id));
  }

  async create<K extends TableName>(table: K, data: NewRow<Tables[K]>) {
    this.written();
    try {
      return await this.base.create(table, data);
    } finally {
      this.written();
    }
  }

  async update<K extends TableName>(
    table: K,
    id: string,
    patch: Patch<Tables[K]>,
  ) {
    this.written();
    try {
      return await this.base.update(table, id, patch);
    } finally {
      this.written();
    }
  }

  async remove<K extends TableName>(table: K, id: string) {
    this.written();
    try {
      return await this.base.remove(table, id);
    } finally {
      this.written();
    }
  }

  putFile(bytes: Uint8Array, name: string, mime: string) {
    return this.base.putFile(bytes, name, mime);
  }

  getFile(key: string) {
    return this.base.getFile(key);
  }

  statFile(key: string) {
    return this.base.statFile(key);
  }

  streamFile(key: string, range?: ByteRange | null) {
    return this.base.streamFile(key, range);
  }

  removeFile(key: string) {
    return this.base.removeFile(key);
  }

  async nextNumber(key: string) {
    this.written();
    return this.base.nextNumber(key);
  }
}
