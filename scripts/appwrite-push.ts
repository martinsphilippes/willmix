/**
 * Publica o esquema (src/lib/db/schema.ts) no Appwrite com o SDK TablesDB.
 *
 * Uso: npm run appwrite:push   (lê NEXT_PUBLIC_APPWRITE_*, APPWRITE_API_KEY)
 *
 * Idempotente: cria só o que falta (banco, tabelas, colunas, índices, bucket).
 * Não apaga nem altera colunas existentes; mudanças destrutivas são feitas
 * conscientemente no console ou com o CLI. Usa as rotas novas de tabelas,
 * que a chave de API cobre com os escopos de tabelas, colunas e índices.
 */
import {
  Client,
  Compression,
  OrderBy,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from "node-appwrite";
import {
  BUCKET_ID,
  DATABASE_ID,
  TABLES,
  type ColumnDef,
  type TableName,
} from "../src/lib/db/schema.ts";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!endpoint || !projectId || !apiKey) {
  console.error(
    "✗ Defina NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID e APPWRITE_API_KEY.",
  );
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);
const tables = new TablesDB(client);
const storage = new Storage(client);
const databaseId = DATABASE_ID;

const isNotFound = (e: unknown) => (e as { code?: number })?.code === 404;
const isConflict = (e: unknown) => (e as { code?: number })?.code === 409;

async function ensureDatabase() {
  try {
    await tables.get({ databaseId });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await tables.create({ databaseId, name: "Wellmix" });
    console.log("+ banco Wellmix (id willmix)");
  }
}

async function ensureTable(tableId: TableName) {
  const def = TABLES[tableId];
  try {
    await tables.getTable({ databaseId, tableId });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await tables.createTable({
      databaseId,
      tableId,
      name: def.label,
      permissions: [],
      rowSecurity: false,
    });
    console.log(`+ tabela ${tableId}`);
  }
}

async function createColumn(tableId: string, key: string, def: ColumnDef) {
  const base = { databaseId, tableId, key, required: def.required ?? false };
  switch (def.type) {
    case "string":
      if (def.enum)
        return tables.createEnumColumn({ ...base, elements: [...def.enum] });
      return tables.createVarcharColumn({ ...base, size: def.size ?? 255 });
    case "text":
    case "json":
      return tables.createTextColumn(base);
    case "int":
      return tables.createIntegerColumn(base);
    case "float":
      return tables.createFloatColumn(base);
    case "bool":
      return tables.createBooleanColumn({
        ...base,
        xdefault: def.required ? undefined : false,
      });
    case "datetime":
      return tables.createDatetimeColumn(base);
  }
}

async function ensureColumns(tableId: TableName) {
  const def = TABLES[tableId];
  const existing = new Set(
    (await tables.listColumns({ databaseId, tableId })).columns.map(
      (c) => c.key,
    ),
  );
  let created = 0;
  for (const [key, col] of Object.entries(def.columns)) {
    if (existing.has(key)) continue;
    try {
      await createColumn(tableId, key, col);
      created++;
    } catch (e) {
      if (!isConflict(e)) throw e;
    }
  }
  if (created) console.log(`  ${tableId}: ${created} coluna(s)`);
}

/** Índices só podem ser criados quando as colunas estão "available". */
async function waitColumns(tableId: TableName) {
  for (let i = 0; i < 60; i++) {
    const cols = (await tables.listColumns({ databaseId, tableId })).columns;
    const pending = cols.filter((c) => c.status !== "available");
    const failed = cols.filter(
      (c) => c.status === "failed" || c.status === "stuck",
    );
    if (failed.length)
      throw new Error(
        `${tableId}: colunas com falha: ${failed.map((c) => `${c.key} (${c.error})`).join(", ")}`,
      );
    if (pending.length === 0) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${tableId}: colunas ainda em processamento`);
}

async function ensureIndexes(tableId: TableName) {
  const def = TABLES[tableId];
  const existing = new Set(
    (await tables.listIndexes({ databaseId, tableId })).indexes.map(
      (i) => i.key,
    ),
  );
  let created = 0;
  for (const idx of def.indexes ?? []) {
    if (existing.has(idx.key)) continue;
    try {
      await tables.createIndex({
        databaseId,
        tableId,
        key: idx.key,
        type:
          idx.type === "unique"
            ? TablesDBIndexType.Unique
            : TablesDBIndexType.Key,
        columns: idx.columns,
        orders: idx.columns.map(() => OrderBy.Asc),
      });
      created++;
    } catch (e) {
      if (!isConflict(e)) throw e;
    }
  }
  if (created) console.log(`  ${tableId}: ${created} índice(s)`);
}

async function ensureBucket() {
  try {
    await storage.getBucket({ bucketId: BUCKET_ID });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await storage.createBucket({
      bucketId: BUCKET_ID,
      name: "Arquivos",
      permissions: [],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 31457280,
      allowedFileExtensions: [
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "webp",
        "xlsx",
        "xls",
        "csv",
        "zip",
        "ai",
        "svg",
      ],
      compression: Compression.Gzip,
      encryption: true,
      antivirus: true,
    });
    console.log("+ bucket arquivos");
  }
}

await ensureDatabase();
const names = Object.keys(TABLES) as TableName[];
for (const name of names) await ensureTable(name);
for (const name of names) await ensureColumns(name);
for (const name of names) await waitColumns(name);
for (const name of names) await ensureIndexes(name);
await ensureBucket();
console.log(`✓ Esquema publicado: ${names.length} tabelas, 1 bucket.`);
