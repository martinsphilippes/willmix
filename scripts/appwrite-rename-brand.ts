/**
 * Migração de marca Willmix → Wellmix nos dados já persistidos no Appwrite.
 * Seguro e idempotente: não recria nada, só atualiza nomes exibidos e as
 * contas de demonstração (e-mail @willmix.com → @wellmix.com e senha).
 * O ID do banco ("willmix") permanece: renomear ID exigiria recriar o banco.
 *
 * Uso: node scripts/appwrite-rename-brand.ts   (lê NEXT_PUBLIC_APPWRITE_*, APPWRITE_API_KEY)
 */
import { Client, Query, TablesDB, Users } from "node-appwrite";
import { DATABASE_ID } from "../src/lib/db/schema.ts";

// Espelho de src/lib/seed.ts (que importa "server-only" e não roda fora do Next).
const DEMO_PASSWORD = "wellmix123";
const DEMO_USERS = [
  "admin@wellmix.com",
  "operador@wellmix.com",
  "joao@lojista.com",
  "supplier.a@china.com",
  "supplier.b@china.com",
  "supplier.c@china.com",
  "agencia@design.com",
  "despachante@comex.com",
  "armador@maritima.com",
  "transportadora@rodo.com",
  "juridico@wellmix.com",
].map((email) => ({ email }));

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
const users = new Users(client);

// 1. Nome exibido do banco.
const db = await tables.get({ databaseId: DATABASE_ID });
if (db.name !== "Wellmix") {
  await tables.update({ databaseId: DATABASE_ID, name: "Wellmix" });
  console.log(`~ banco ${DATABASE_ID}: nome "${db.name}" → "Wellmix"`);
}

// 2. Contas de demonstração: e-mail antigo → novo, senha padrão nova.
const oldDomain = "@willmix.com";
for (const demo of DEMO_USERS) {
  const oldEmail = demo.email.replace("@wellmix.com", oldDomain);
  const candidates =
    oldEmail !== demo.email ? [oldEmail, demo.email] : [demo.email];

  for (const email of candidates) {
    const found = await users.list({ queries: [Query.equal("email", email)] });
    const authUser = found.users[0];
    if (!authUser) continue;
    if (authUser.email !== demo.email) {
      await users.updateEmail({ userId: authUser.$id, email: demo.email });
      console.log(`~ auth: ${authUser.email} → ${demo.email}`);
    }
    await users.updatePassword({
      userId: authUser.$id,
      password: DEMO_PASSWORD,
    });
    break;
  }

  for (const email of candidates) {
    const rows = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: "users",
      queries: [Query.equal("email", email)],
    });
    const row = rows.rows[0];
    if (!row) continue;
    if (row.email !== demo.email) {
      await tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: "users",
        rowId: row.$id,
        data: { email: demo.email },
      });
      console.log(`~ users: ${row.email} → ${demo.email}`);
    }
    break;
  }
}
console.log("✓ Marca atualizada nos dados persistidos.");
