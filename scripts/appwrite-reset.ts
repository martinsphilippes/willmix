/**
 * Apaga os dados transacionais no Appwrite (solicitações, cotações, pedidos,
 * etapas, requisitos, documentos, pagamentos, notificações, auditoria, multas,
 * contadores) e mantém cadastros (usuários, parceiros, linhas, produtos,
 * configurações). Uso: demonstrações e testes. Nunca rode em produção com dados reais.
 *
 * Uso: node scripts/appwrite-reset.ts   (lê NEXT_PUBLIC_APPWRITE_*, APPWRITE_API_KEY)
 */
import { Client, Query, Storage, TablesDB } from "node-appwrite";
import {
  BUCKET_ID,
  DATABASE_ID,
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

const TRANSACTIONAL: TableName[] = [
  "requests",
  "quotes",
  "orders",
  "order_items",
  "stages",
  "requirements",
  "documents",
  "payments",
  "notifications",
  "audit_log",
  "penalties",
  "counters",
];

for (const tableId of TRANSACTIONAL) {
  let deleted = 0;
  for (;;) {
    const page = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.limit(100)],
    });
    if (page.rows.length === 0) break;
    for (const row of page.rows) {
      await tables.deleteRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: row.$id,
      });
      deleted++;
    }
  }
  if (deleted) console.log(`- ${tableId}: ${deleted}`);
}

let files = 0;
for (;;) {
  const page = await storage.listFiles({
    bucketId: BUCKET_ID,
    queries: [Query.limit(100)],
  });
  if (page.files.length === 0) break;
  for (const file of page.files) {
    await storage.deleteFile({ bucketId: BUCKET_ID, fileId: file.$id });
    files++;
  }
}
if (files) console.log(`- arquivos: ${files}`);
console.log("✓ Dados transacionais apagados.");
