/**
 * Gera appwrite.config.json a partir de src/lib/db/schema.ts.
 *
 * Uso: npm run appwrite:config
 *
 * Mantém projectId e endpoint já gravados no arquivo (pelo appwrite:connect).
 * Tabelas: sem permissões para usuários (toda leitura e escrita passa pelo
 * servidor com a API key); bucket `arquivos` idem.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  BUCKET_ID,
  DATABASE_ID,
  TABLES,
  type ColumnDef,
  type TableName,
} from "../src/lib/db/schema.ts";

const root = resolve(import.meta.dirname, "..");
const configPath = resolve(root, "appwrite.config.json");

const existing = existsSync(configPath)
  ? (JSON.parse(readFileSync(configPath, "utf8")) as {
      projectId?: string;
      endpoint?: string;
    })
  : {};

function column(key: string, def: ColumnDef) {
  const base = {
    key,
    required: def.required ?? false,
    array: false,
    default: null as unknown,
  };
  switch (def.type) {
    case "string":
      return def.enum
        ? { ...base, type: "varchar", format: "enum", elements: [...def.enum] }
        : { ...base, type: "varchar", size: def.size ?? 255 };
    case "text":
    case "json":
      return { ...base, type: "text" };
    case "int":
      return { ...base, type: "integer" };
    case "float":
      return { ...base, type: "double" };
    case "bool":
      return { ...base, type: "boolean", default: def.required ? null : false };
    case "datetime":
      return { ...base, type: "datetime" };
  }
}

const tables = (Object.keys(TABLES) as TableName[]).map((name) => {
  const def = TABLES[name];
  return {
    $id: name,
    databaseId: DATABASE_ID,
    name: def.label,
    enabled: true,
    rowSecurity: false,
    $permissions: [],
    columns: Object.entries(def.columns).map(([key, col]) => column(key, col)),
    indexes: (def.indexes ?? []).map((idx) => ({
      key: idx.key,
      type: idx.type,
      columns: idx.columns,
      orders: idx.columns.map(() => "ASC"),
    })),
  };
});

const config = {
  projectId: existing.projectId ?? "<PROJECT_ID>",
  endpoint: existing.endpoint ?? "https://<REGION>.cloud.appwrite.io/v1",
  tablesDB: [{ $id: DATABASE_ID, name: "Wellmix", enabled: true }],
  tables,
  buckets: [
    {
      $id: BUCKET_ID,
      name: "Arquivos",
      enabled: true,
      fileSecurity: false,
      $permissions: [],
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
      compression: "gzip",
      encryption: true,
      antivirus: true,
    },
  ],
};

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`appwrite.config.json: ${tables.length} tabelas, 1 bucket.`);
