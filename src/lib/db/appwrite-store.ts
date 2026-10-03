import { Client, ID, Query, Storage, TablesDB } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import type { TableName, Tables } from "./schema";
import { BUCKET_ID, DATABASE_ID, TABLES } from "./schema";
import type { ListOptions, NewRow, Patch, Store, StoredFile } from "./store";
import { downloadBytes } from "./download-bytes";

/**
 * Implementação sobre Appwrite TablesDB e Storage.
 * Todas as chamadas usam a API key (servidor). A autorização é feita na
 * camada de aplicação antes de chegar aqui.
 */
const PAGE = 500;
const MAX_ROWS = 10_000;
const MAX_IN = 100;

export class AppwriteStore implements Store {
  readonly mode = "appwrite" as const;
  private readonly tables: TablesDB;
  private readonly storage: Storage;

  private readonly endpoint: string;
  private readonly projectId: string;
  private readonly apiKey: string;

  constructor(endpoint: string, projectId: string, apiKey: string) {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);
    this.tables = new TablesDB(client);
    this.storage = new Storage(client);
    this.endpoint = endpoint.replace(/\/$/, "");
    this.projectId = projectId;
    this.apiKey = apiKey;
  }

  async list<K extends TableName>(
    table: K,
    options: ListOptions<Tables[K]> = {},
  ): Promise<Tables[K][]> {
    // O Appwrite aceita até 100 valores por filtro "igual a um destes": listas
    // maiores viram consultas em paralelo, juntadas e reordenadas aqui.
    const big = Object.entries(options.filter ?? {}).find(
      ([, v]) => Array.isArray(v) && v.length > MAX_IN,
    );
    if (big) {
      const [field, values] = big as [string, Array<string | number>];
      const chunks: Array<Array<string | number>> = [];
      for (let i = 0; i < values.length; i += MAX_IN)
        chunks.push(values.slice(i, i + MAX_IN));
      const parts = await Promise.all(
        chunks.map((chunk) =>
          this.list(table, {
            ...options,
            filter: { ...options.filter, [field]: chunk } as ListOptions<
              Tables[K]
            >["filter"],
          }),
        ),
      );
      const orderBy = (options.orderBy ?? "createdAt") as string;
      const dir = options.direction === "desc" ? -1 : 1;
      const merged = parts.flat().sort((a, b) => {
        const x = (a as unknown as Record<string, string | number>)[orderBy];
        const y = (b as unknown as Record<string, string | number>)[orderBy];
        return x < y ? -dir : x > y ? dir : 0;
      });
      return options.limit ? merged.slice(0, options.limit) : merged;
    }
    const queries: string[] = [];
    for (const [rawKey, value] of Object.entries(options.filter ?? {})) {
      const key = toAppwriteKey(rawKey);
      if (value === null) queries.push(Query.isNull(key));
      else if (Array.isArray(value)) {
        // Lista vazia: nenhum valor casa (o Appwrite rejeitaria a consulta).
        if (value.length === 0) return [];
        queries.push(Query.equal(key, value));
      } else queries.push(Query.equal(key, value as string | number | boolean));
    }
    const orderBy = toAppwriteKey(options.orderBy ?? "createdAt");
    queries.push(
      options.direction === "desc"
        ? Query.orderDesc(orderBy)
        : Query.orderAsc(orderBy),
    );
    // Sem limite explícito, percorre todas as páginas (até MAX_ROWS) em vez de truncar em 500.
    const wanted = options.limit ?? MAX_ROWS;
    const rows: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    while (rows.length < wanted) {
      const page = [
        ...queries,
        Query.limit(Math.min(PAGE, wanted - rows.length)),
      ];
      if (cursor) page.push(Query.cursorAfter(cursor));
      const result = await this.tables.listRows({
        databaseId: DATABASE_ID,
        tableId: table,
        queries: page,
      });
      rows.push(...result.rows);
      if (result.rows.length < PAGE) break;
      cursor = (result.rows[result.rows.length - 1] as { $id: string }).$id;
    }
    return rows.map((row) => fromAppwrite<Tables[K]>(table, row));
  }

  async get<K extends TableName>(table: K, id: string) {
    try {
      const row = await this.tables.getRow({
        databaseId: DATABASE_ID,
        tableId: table,
        rowId: id,
      });
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

  async update<K extends TableName>(
    table: K,
    id: string,
    patch: Patch<Tables[K]>,
  ) {
    const row = await this.tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: table,
      rowId: id,
      data: toAppwrite(table, patch as Record<string, unknown>),
    });
    return fromAppwrite<Tables[K]>(table, row);
  }

  async remove<K extends TableName>(table: K, id: string) {
    await this.tables.deleteRow({
      databaseId: DATABASE_ID,
      tableId: table,
      rowId: id,
    });
  }

  async putFile(
    bytes: Uint8Array,
    name: string,
    mime: string,
  ): Promise<StoredFile> {
    const file = await this.storage.createFile({
      bucketId: BUCKET_ID,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(Buffer.from(bytes), name),
    });
    return { key: file.$id, name, mime, size: bytes.byteLength };
  }

  async removeFile(key: string) {
    try {
      await this.storage.deleteFile({ bucketId: BUCKET_ID, fileId: key });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async getFile(key: string) {
    try {
      // Metadados e conteúdo em paralelo: uma ida ao Appwrite em vez de duas.
      const [meta, bytes] = await Promise.all([
        this.storage.getFile({ bucketId: BUCKET_ID, fileId: key }),
        this.storage.getFileDownload({ bucketId: BUCKET_ID, fileId: key }),
      ]);
      return {
        // JSON vem "aberto" pelo SDK; downloadBytes devolve os bytes do arquivo.
        bytes: downloadBytes(bytes),
        name: meta.name,
        mime: meta.mimeType,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async statFile(key: string): Promise<StoredFile | null> {
    try {
      const meta = await this.storage.getFile({
        bucketId: BUCKET_ID,
        fileId: key,
      });
      return {
        key: meta.$id,
        name: meta.name,
        mime: meta.mimeType,
        size: meta.sizeOriginal,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Download em fluxo direto da API REST (o SDK carrega o arquivo inteiro na
   * memória): arquivos grandes (arte da embalagem) descem sem estourar a função.
   */
  async streamFile(key: string) {
    const meta = await this.statFile(key);
    if (!meta) return null;
    const res = await fetch(
      `${this.endpoint}/storage/buckets/${BUCKET_ID}/files/${encodeURIComponent(key)}/download`,
      {
        headers: {
          "X-Appwrite-Project": this.projectId,
          "X-Appwrite-Key": this.apiKey,
        },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok || !res.body) throw new Error(`storage download ${res.status}`);
    return {
      body: res.body,
      name: meta.name,
      mime: meta.mime,
      size: meta.size,
    };
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
    out[key] =
      def.type === "json" || def.type === "json_large"
        ? value === null
          ? null
          : JSON.stringify(value)
        : value;
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
    if (def.type === "json" || def.type === "json_large") {
      out[key] =
        typeof value === "string" && value !== ""
          ? JSON.parse(value)
          : (value ?? null);
    } else if (def.type === "bool") {
      out[key] = value ?? false;
    } else {
      out[key] = value ?? null;
    }
  }
  return out as T;
}

function isNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 404
  );
}
