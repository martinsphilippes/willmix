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
  Permission,
  Query,
  Role,
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

/** Coluna como o Appwrite a devolve (só o que o publicador compara). */
interface LiveColumn {
  key: string;
  type: string;
  status: string;
  error?: string;
  required?: boolean;
  default?: unknown;
  size?: number;
  elements?: string[];
  format?: string;
}

/**
 * Todas as colunas da tabela. A listagem vem paginada (25 por padrão): sem
 * paginar, tabelas com mais colunas (pedidos, fichas, produtos) tinham as
 * últimas colunas ignoradas, e um valor novo de enum nelas nunca era publicado.
 */
async function listAllColumns(tableId: TableName): Promise<LiveColumn[]> {
  const all: LiveColumn[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = (
      await tables.listColumns({
        databaseId,
        tableId,
        queries: [Query.limit(100), Query.offset(offset)],
      })
    ).columns as unknown as LiveColumn[];
    all.push(...page);
    if (page.length < 100) return all;
  }
}

async function listAllIndexKeys(tableId: TableName): Promise<string[]> {
  const all: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = (
      await tables.listIndexes({
        databaseId,
        tableId,
        queries: [Query.limit(100), Query.offset(offset)],
      })
    ).indexes;
    all.push(...page.map((i) => i.key));
    if (page.length < 100) return all;
  }
}

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
    case "json_large":
      return tables.createLongtextColumn(base);
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
  const columns = await listAllColumns(tableId);
  const existing = new Set(columns.map((c) => c.key));
  let created = 0;
  for (const [key, col] of Object.entries(def.columns)) {
    if (existing.has(key)) {
      await ensureEnumElements(tableId, key, col, columns);
      await ensureVarcharSize(tableId, key, col, columns);
      await ensureOptional(tableId, key, col, columns);
      continue;
    }
    try {
      await createColumn(tableId, key, col);
      created++;
    } catch (e) {
      if (!isConflict(e)) throw e;
    }
  }
  if (created) console.log(`  ${tableId}: ${created} coluna(s)`);
}

/**
 * Enum que ganhou valores novos no esquema: acrescenta os elementos que faltam.
 * Nunca remove elementos (poderia invalidar linhas existentes).
 */
async function ensureEnumElements(
  tableId: TableName,
  key: string,
  col: ColumnDef,
  columns: LiveColumn[],
) {
  if (col.type !== "string" || !col.enum) return;
  const current = columns.find((c) => c.key === key);
  const have = new Set(current?.elements ?? []);
  const missing = col.enum.filter((v) => !have.has(v));
  if (missing.length === 0) return;
  await tables.updateEnumColumn({
    databaseId,
    tableId,
    key,
    elements: [...(current?.elements ?? []), ...missing],
    required: current?.required ?? col.required ?? false,
    // O SDK exige o campo (aceita nulo, embora o tipo diga string): mantém o
    // padrão atual; coluna obrigatória não tem padrão.
    xdefault: (current?.required || typeof current?.default !== "string"
      ? null
      : current.default) as unknown as string,
  });
  console.log(`  ${tableId}.${key}: +${missing.join(", ")}`);
}

/**
 * Texto curto que cresceu no esquema: aumenta o tamanho em produção. Nunca
 * diminui (cortaria valores gravados).
 */
async function ensureVarcharSize(
  tableId: TableName,
  key: string,
  col: ColumnDef,
  columns: LiveColumn[],
) {
  if (col.type !== "string" || col.enum) return;
  const current = columns.find((c) => c.key === key);
  const want = col.size ?? 255;
  if (!current || typeof current.size !== "number" || current.size >= want)
    return;
  await tables.updateVarcharColumn({
    databaseId,
    tableId,
    key,
    required: current.required ?? col.required ?? false,
    xdefault: (current.required || typeof current.default !== "string"
      ? null
      : current.default) as unknown as string,
    size: want,
  });
  console.log(`  ${tableId}.${key}: tamanho ${current.size} → ${want}`);
}

/**
 * Coluna que o esquema diz opcional mas está obrigatória em produção (criada
 * assim por engano numa tabela que já tinha linhas): passa a opcional. O
 * contrário (opcional → obrigatória) nunca é feito aqui: invalidaria linhas.
 */
async function ensureOptional(
  tableId: TableName,
  key: string,
  col: ColumnDef,
  columns: LiveColumn[],
) {
  const current = columns.find((c) => c.key === key);
  if (!current || !current.required || col.required) return;
  const base = { databaseId, tableId, key, required: false };
  const text = { ...base, xdefault: null as unknown as string };
  switch (col.type) {
    case "string":
      if (col.enum)
        await tables.updateEnumColumn({
          ...text,
          elements: current.elements ?? [...col.enum],
        });
      else
        await tables.updateVarcharColumn({
          ...text,
          size: current.size ?? col.size ?? 255,
        });
      break;
    case "text":
    case "json":
      await tables.updateTextColumn(text);
      break;
    case "json_large":
      await tables.updateLongtextColumn(text);
      break;
    case "int":
      await tables.updateIntegerColumn({
        ...base,
        xdefault: null as unknown as number,
      });
      break;
    case "float":
      await tables.updateFloatColumn({
        ...base,
        xdefault: null as unknown as number,
      });
      break;
    case "bool":
      await tables.updateBooleanColumn({
        ...base,
        xdefault: null as unknown as boolean,
      });
      break;
    case "datetime":
      await tables.updateDatetimeColumn(text);
      break;
  }
  console.log(`  ${tableId}.${key}: obrigatória → opcional`);
}

/** Índices só podem ser criados quando as colunas estão "available". */
async function waitColumns(tableId: TableName) {
  for (let i = 0; i < 60; i++) {
    const cols = await listAllColumns(tableId);
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

/**
 * Índice substituído (`drops` no esquema, ex.: o único do carrinho que ganhou
 * a variação): apaga só os listados e espera sumirem antes de criar o novo.
 * Nenhum outro índice é tocado.
 */
async function dropReplacedIndexes(tableId: TableName, keys: string[]) {
  const current = new Set(await listAllIndexKeys(tableId));
  const toDrop = keys.filter((k) => current.has(k));
  for (const key of toDrop) {
    try {
      await tables.deleteIndex({ databaseId, tableId, key });
      console.log(`  ${tableId}: índice ${key} removido (substituído)`);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }
  if (!toDrop.length) return;
  for (let i = 0; i < 60; i++) {
    const left = (await listAllIndexKeys(tableId)).filter((k) =>
      toDrop.includes(k),
    );
    if (left.length === 0) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${tableId}: índices ${toDrop.join(", ")} ainda em remoção`);
}

async function ensureIndexes(tableId: TableName) {
  const def = TABLES[tableId];
  const existing = new Set(await listAllIndexKeys(tableId));
  let created = 0;
  for (const idx of def.indexes ?? []) {
    if (existing.has(idx.key)) continue;
    if (idx.drops?.length) await dropReplacedIndexes(tableId, idx.drops);
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

const BUCKET_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
  "xlsx",
  "xlsm",
  "xls",
  "csv",
  "json",
  "zip",
  "ai",
  "svg",
  "psd",
  "eps",
  "cdr",
  "tif",
  "tiff",
];
/** 50 MB (teto do Appwrite Cloud): arte da embalagem sobe direto do navegador. */
const BUCKET_MAX_BYTES = 50_000_000;
/** Usuário logado cria arquivo (envio direto com JWT); leitura só pelo servidor. */
const BUCKET_PERMISSIONS = [Permission.create(Role.users())];

async function ensureBucket() {
  try {
    const bucket = await storage.getBucket({ bucketId: BUCKET_ID });
    // Só acrescenta: extensões novas, permissão de criação e teto maior.
    const have = new Set(bucket.allowedFileExtensions);
    const missing = BUCKET_EXTENSIONS.filter((x) => !have.has(x));
    const permissions = [
      ...bucket.$permissions,
      ...BUCKET_PERMISSIONS.filter((p) => !bucket.$permissions.includes(p)),
    ];
    const maximumFileSize = Math.max(bucket.maximumFileSize, BUCKET_MAX_BYTES);
    if (
      missing.length ||
      permissions.length !== bucket.$permissions.length ||
      maximumFileSize !== bucket.maximumFileSize
    ) {
      await storage.updateBucket({
        bucketId: BUCKET_ID,
        name: bucket.name,
        permissions,
        fileSecurity: bucket.fileSecurity,
        enabled: bucket.enabled,
        maximumFileSize,
        allowedFileExtensions: [...bucket.allowedFileExtensions, ...missing],
        compression: bucket.compression as Compression,
        encryption: bucket.encryption,
        antivirus: bucket.antivirus,
      });
      console.log(
        `  bucket: ${[missing.length ? `+${missing.join(", ")}` : null, permissions.length !== bucket.$permissions.length ? "create(users)" : null, maximumFileSize !== bucket.maximumFileSize ? `${maximumFileSize} bytes` : null].filter(Boolean).join(" · ")}`,
      );
    }
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await storage.createBucket({
      bucketId: BUCKET_ID,
      name: "Arquivos",
      permissions: BUCKET_PERMISSIONS,
      fileSecurity: false,
      enabled: true,
      maximumFileSize: BUCKET_MAX_BYTES,
      allowedFileExtensions: BUCKET_EXTENSIONS,
      compression: Compression.Gzip,
      encryption: true,
      antivirus: true,
    });
    console.log("+ bucket arquivos");
  }
}

/** Tipos do Appwrite aceitos para cada tipo do esquema (texto é texto, número é número). */
const COMPATIBLE_TYPES: Record<ColumnDef["type"], string[]> = {
  string: ["string", "varchar", "text", "mediumtext", "longtext"],
  text: ["string", "varchar", "text", "mediumtext", "longtext"],
  json: ["string", "varchar", "text", "mediumtext", "longtext"],
  json_large: ["string", "varchar", "text", "mediumtext", "longtext"],
  int: ["integer", "bigint"],
  float: ["double", "float"],
  bool: ["boolean"],
  datetime: ["datetime"],
};

/**
 * Conferência final: produção contra o esquema, coluna por coluna e índice
 * por índice. O que o publicador não corrige sozinho (coluna com outro tipo,
 * obrigatória onde o esquema diz opcional, coluna com falha) aparece aqui,
 * em vez de virar "esquema desatualizado" na tela sem ninguém saber por quê.
 */
async function verifySchema(): Promise<string[]> {
  const problems: string[] = [];
  for (const tableId of Object.keys(TABLES) as TableName[]) {
    const def = TABLES[tableId];
    const live = new Map(
      (await listAllColumns(tableId)).map((c) => [c.key, c] as const),
    );
    for (const [key, col] of Object.entries(def.columns)) {
      const current = live.get(key);
      const where = `${tableId}.${key}`;
      if (!current) {
        problems.push(`${where}: coluna não existe em produção`);
        continue;
      }
      if (current.status !== "available")
        problems.push(
          `${where}: coluna "${current.status}"${current.error ? ` (${current.error})` : ""}`,
        );
      if (!COMPATIBLE_TYPES[col.type].includes(current.type))
        problems.push(
          `${where}: tipo "${current.type}" em produção, esquema pede ${col.type}`,
        );
      if (col.enum) {
        if (current.format !== "enum")
          problems.push(`${where}: não é enum em produção`);
        const have = new Set(current.elements ?? []);
        const missing = col.enum.filter((v) => !have.has(v));
        if (missing.length)
          problems.push(`${where}: faltam os valores ${missing.join(", ")}`);
      }
      const required = col.required ?? false;
      if ((current.required ?? false) !== required)
        problems.push(
          `${where}: ${current.required ? "obrigatória" : "opcional"} em produção, esquema diz ${required ? "obrigatória" : "opcional"}`,
        );
      if (
        col.type === "string" &&
        !col.enum &&
        typeof current.size === "number" &&
        current.size < (col.size ?? 255)
      )
        problems.push(
          `${where}: tamanho ${current.size} em produção, esquema pede ${col.size ?? 255}`,
        );
    }
    // Coluna obrigatória com linha vazia em produção: foi acrescentada depois
    // de a tabela ter linhas. Toda gravação nessas linhas (e toda linha nova
    // sem o campo) é recusada com "Missing required attribute": o esquema
    // precisa marcá-la opcional (enumOf(X, false), id(false)…).
    for (const [key, col] of Object.entries(def.columns)) {
      if (!(col.required ?? false) || !live.has(key)) continue;
      const empty = await tables.listRows({
        databaseId,
        tableId,
        queries: [Query.isNull(key), Query.limit(1)],
      });
      if (empty.rows.length)
        problems.push(
          `${tableId}.${key}: obrigatória, mas há linhas sem valor em produção; marque opcional no esquema`,
        );
    }
    // Coluna que só existe em produção (criada no console): informação, não
    // erro; obrigatória, porém, recusa toda linha nova que o portal grava.
    for (const [key, c] of live)
      if (!(key in def.columns))
        (c.required ? problems : extras).push(
          `${tableId}.${key}: só em produção (${c.type}${c.required ? ", obrigatória" : ""})`,
        );
    const indexes = new Set(await listAllIndexKeys(tableId));
    for (const idx of def.indexes ?? [])
      if (!indexes.has(idx.key))
        problems.push(`${tableId}: índice ${idx.key} não existe em produção`);
  }
  return problems;
}
const extras: string[] = [];

await ensureDatabase();
const names = Object.keys(TABLES) as TableName[];
for (const name of names) await ensureTable(name);
for (const name of names) await ensureColumns(name);
for (const name of names) await waitColumns(name);
for (const name of names) await ensureIndexes(name);
await ensureBucket();
console.log(`✓ Esquema publicado: ${names.length} tabelas, 1 bucket.`);
const problems = await verifySchema();
for (const line of extras) console.log(`  i ${line}`);
if (problems.length) {
  console.error(
    `✗ Conferência: ${problems.length} diferença(s) entre produção e o esquema:`,
  );
  for (const p of problems) console.error(`  ! ${p}`);
  process.exit(1);
}
console.log("✓ Conferência: produção igual ao esquema (colunas e índices).");
