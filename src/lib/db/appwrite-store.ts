import { Client, ID, Query, Storage, TablesDB } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import type { TableName, Tables } from "./schema";
import { BUCKET_ID, DATABASE_ID, TABLES } from "./schema";
import type { ListOptions, NewRow, Patch, Store, StoredFile } from "./store";

/**
 * Implementação sobre Appwrite TablesDB e Storage.
 * Todas as chamadas usam a API key (servidor). A autorização é feita na
 * camada de aplicação antes de chegar aqui.
 */
export class AppwriteStore implements Store {
  readonly mode = "appwrite" as const;
  private readonly tables: TablesDB;
  private readonly storage: Storage;

  constructor(endpoint: string, projectId: string, apiKey: string) {
    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    this.tables = new TablesDB(client);
    this.storage = new Storage(client);
  }

  async list<K extends TableName>(table: K, options: ListOptions<Tables[K]> = {}) {
    const queries: string[] = [];
    for (const [key, value] of Object.entries(options.filter ?? {})) {
      if (value === null) queries.push(Query.isNull(key));
      else if (Array.isArray(value)) queries.push(Query.equal(key, value));
      else queries.push(Query.equal(key, value as string | number | boolean));
    }
    const orderBy = toAppwriteKey(options.orderBy ?? "createdAt");
    queries.push(options.direction === "desc" ? Query.orderDesc(orderBy) : Query.orderAsc(orderBy));
    queries.push(Query.limit(options.limit ?? 500));
    const result = await this.tables.listRows({ databaseId: DATABASE_ID, tableId: table, queries });
    return result.rows.map((row) => fromAppwrite<Tables[K]>(table, row));
  }

  async get<K extends TableName>(table: K, id: string) {
    try {
      const row = await this.tables.getRow({ databaseId: DATABASE_ID, tableId: table, rowId: id });
      return fromAppwrite<Tables[K]>(table, row);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async create<K extends TableName>(table: K, data: NewRow<Tables[K]>) {
    const { id, ...rest } = data as { id?: string } & Record<string, unknown>;
    const row = await this.tables.createRow({
      databaseId: DATABASE_ID,
      tableId: table,
      rowId: id ?? ID.unique(),
      data: toAppwrite(table, rest),
    });
    return fromAppwrite<Tables[K]>(table, row);
  }

  async update<K extends TableName>(table: K, id: string, patch: Patch<Tables[K]>) {
    const row = await this.tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: table,
      rowId: id,
      data: toAppwrite(table, patch as Record<string, unknown>),
    });
    return fromAppwrite<Tables[K]>(table, row);
  }

  async remove<K extends TableName>(table: K, id: string) {
    await this.tables.deleteRow({ databaseId: DATABASE_ID, tableId: table, rowId: id });
  }

  async putFile(bytes: Uint8Array, name: string, mime: string): Promise<StoredFile> {
    const file = await this.storage.createFile({
      bucketId: BUCKET_ID,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(Buffer.from(bytes), name),
    });
    return { key: file.$id, name, mime, size: bytes.byteLength };
  }

  async getFile(key: string) {
    try {
      const meta = await this.storage.getFile({ bucketId: BUCKET_ID, fileId: key });
      const bytes = await this.storage.getFileDownload({ bucketId: BUCKET_ID, fileId: key });
      return { bytes: new Uint8Array(bytes), name: meta.name, mime: meta.mimeType };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async nextNumber(key: string) {
    // Contador simples. Concorrência real é baixa (pedidos criados por operadores).
    const existing = await this.list("counters", { filter: { key }, limit: 1 });
    if (existing.length === 0) {
      await this.create("counters", { key, value: 1 });
      return 1;
    }
    const next = existing[0].value + 1;
    await this.update("counters", existing[0].id, { value: next });
    return next;
  }
}

function toAppwriteKey(key: string) {
  if (key === "id") return "$id";
  if (key === "createdAt") return "$createdAt";
  if (key === "updatedAt") return "$updatedAt";
  return key;
}

function toAppwrite(table: TableName, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const columns = TABLES[table].columns;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const def = columns[key];
    if (!def) continue;
    out[key] = def.type === "json" ? (value === null ? null : JSON.stringify(value)) : value;
  }
  return out;
}

function fromAppwrite<T>(table: TableName, row: Record<string, unknown>): T {
  const columns = TABLES[table].columns;
  const out: Record<string, unknown> = {
    id: row.$id,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
  for (const [key, def] of Object.entries(columns)) {
    const value = row[key];
    if (def.type === "json") {
      out[key] = typeof value === "string" && value !== "" ? JSON.parse(value) : (value ?? null);
    } else if (def.type === "bool") {
      out[key] = value ?? false;
    } else {
      out[key] = value ?? null;
    }
  }
  return out as T;
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 404;
}
