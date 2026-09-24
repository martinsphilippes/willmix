import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { BaseRow, TableName, Tables } from "./schema";
import { TABLES } from "./schema";
import {
  matchesFilter,
  sortRows,
  type ListOptions,
  type NewRow,
  type Patch,
  type Store,
  type StoredFile,
} from "./store";

type Db = { [K in TableName]: Tables[K][] };

function emptyDb(): Db {
  const db = {} as Db;
  for (const name of Object.keys(TABLES) as TableName[]) {
    (db as Record<string, unknown[]>)[name] = [];
  }
  return db;
}

/**
 * Armazenamento em memória com persistência em JSON.
 * Um único arquivo por ambiente (.data/db.json) e arquivos binários em .data/files.
 * Adequado para desenvolvimento, demonstração e testes. Não usar em produção.
 */
export class MemoryStore implements Store {
  readonly mode = "memory" as const;
  private db: Db;
  private readonly dbPath: string;
  private readonly filesDir: string;

  constructor(private readonly dir: string, private readonly persist = true) {
    this.dbPath = join(dir, "db.json");
    this.filesDir = join(dir, "files");
    if (persist) {
      mkdirSync(this.filesDir, { recursive: true });
    }
    this.db = this.load();
  }

  private load(): Db {
    if (this.persist && existsSync(this.dbPath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.dbPath, "utf8")) as Partial<Db>;
        return { ...emptyDb(), ...parsed };
      } catch {
        return emptyDb();
      }
    }
    return emptyDb();
  }

  private save() {
    if (!this.persist) return;
    writeFileSync(this.dbPath, JSON.stringify(this.db));
  }

  reset() {
    this.db = emptyDb();
    this.save();
  }

  async list<K extends TableName>(table: K, options: ListOptions<Tables[K]> = {}) {
    const rows = this.db[table].filter((row) => matchesFilter(row, options.filter));
    const sorted = sortRows(rows, options.orderBy ?? "createdAt", options.direction ?? "asc");
    return (options.limit ? sorted.slice(0, options.limit) : sorted).map(clone);
  }

  async get<K extends TableName>(table: K, id: string) {
    const row = this.db[table].find((r) => r.id === id);
    return row ? clone(row) : null;
  }

  async create<K extends TableName>(table: K, data: NewRow<Tables[K]>) {
    const now = new Date().toISOString();
    const row = { ...data, id: data.id ?? randomUUID(), createdAt: now, updatedAt: now } as Tables[K];
    for (const idx of TABLES[table].indexes ?? []) {
      if (idx.type !== "unique") continue;
      const candidate = row as unknown as Record<string, unknown>;
      const clash = (this.db[table] as unknown as Record<string, unknown>[]).find((r) =>
        idx.columns.every((c) => r[c] === candidate[c]),
      );
      if (clash) throw new Error(`Valor duplicado em ${table}.${idx.columns.join("+")}`);
    }
    this.db[table].push(row);
    this.save();
    return clone(row);
  }

  async update<K extends TableName>(table: K, id: string, patch: Patch<Tables[K]>) {
    const index = this.db[table].findIndex((r) => r.id === id);
    if (index < 0) throw new Error(`${table}/${id} não encontrado`);
    const updated = {
      ...this.db[table][index],
      ...patch,
      updatedAt: new Date().toISOString(),
    } as Tables[K];
    this.db[table][index] = updated;
    this.save();
    return clone(updated);
  }

  async remove<K extends TableName>(table: K, id: string) {
    (this.db[table] as BaseRow[]) = (this.db[table] as BaseRow[]).filter((r) => r.id !== id) as Tables[K][];
    this.save();
  }

  async putFile(bytes: Uint8Array, name: string, mime: string): Promise<StoredFile> {
    const key = randomUUID();
    if (this.persist) {
      writeFileSync(join(this.filesDir, key), bytes);
      writeFileSync(join(this.filesDir, `${key}.json`), JSON.stringify({ name, mime }));
    } else {
      this.memFiles.set(key, { bytes, name, mime });
    }
    return { key, name, mime, size: bytes.byteLength };
  }

  private memFiles = new Map<string, { bytes: Uint8Array; name: string; mime: string }>();

  async getFile(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key)) return null;
    if (!this.persist) return this.memFiles.get(key) ?? null;
    const path = join(this.filesDir, key);
    if (!existsSync(path)) return null;
    const meta = JSON.parse(readFileSync(`${path}.json`, "utf8")) as { name: string; mime: string };
    return { bytes: new Uint8Array(readFileSync(path)), ...meta };
  }

  async nextNumber(key: string) {
    const existing = this.db.counters.find((c) => c.key === key);
    if (existing) {
      existing.value += 1;
      existing.updatedAt = new Date().toISOString();
      this.save();
      return existing.value;
    }
    await this.create("counters", { key, value: 1 });
    return 1;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
