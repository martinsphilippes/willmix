/**
 * Cria no Appwrite de produção as empresas e os logins de demonstração que
 * faltam, direto pelo GitHub (Actions → "Criar contas de demonstração"), com o
 * mesmo cadastro do portal (src/lib/demo-data.ts). Quando uma conta não pode
 * ser criada, o erro inteiro do Appwrite (tipo, código e mensagem) fica no
 * registro da execução, que a tela do portal não consegue mostrar.
 *
 * Uso: node scripts/appwrite-demo-accounts.ts  (NEXT_PUBLIC_APPWRITE_*, APPWRITE_API_KEY)
 *
 * Só cria o que falta; nunca altera nem apaga. A chave precisa dos escopos de
 * linhas (rows) e de usuários (users.read, users.write).
 */
import { Client, ID, Query, TablesDB, Users } from "node-appwrite";
import {
  DATABASE_ID,
  PARTY_EXTRA_DEFAULTS,
  TABLES,
  USER_EXTRA_DEFAULTS,
  type TableName,
} from "../src/lib/db/schema.ts";
import {
  DEMO_PARTIES,
  DEMO_PASSWORD,
  DEMO_USERS,
  demoPartyFields,
  demoUserFields,
} from "../src/lib/demo-data.ts";

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
const authUsers = new Users(client);
const databaseId = DATABASE_ID;

/** Mesma serialização do portal (src/lib/db/appwrite-store.ts toAppwrite): só colunas do esquema, json como texto. */
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

function describe(error: unknown) {
  const e = error as { type?: unknown; code?: unknown; message?: unknown };
  return [e?.type, e?.code, e?.message ?? String(error)]
    .filter((v) => v !== undefined && v !== "")
    .join(" · ");
}

let created = 0;
let failed = 0;

const haveParties = new Set(
  (
    await tables.listRows({
      databaseId,
      tableId: "parties",
      queries: [
        Query.equal(
          "$id",
          DEMO_PARTIES.map((p) => p.id),
        ),
        Query.limit(100),
      ],
    })
  ).rows.map((r) => r.$id),
);
for (const party of DEMO_PARTIES) {
  if (haveParties.has(party.id)) continue;
  try {
    await tables.createRow({
      databaseId,
      tableId: "parties",
      rowId: party.id,
      data: toAppwrite("parties", {
        ...PARTY_EXTRA_DEFAULTS,
        ...demoPartyFields(party),
      }),
    });
    haveParties.add(party.id);
    created++;
    console.log(`+ empresa ${party.id} (${party.name})`);
  } catch (error) {
    failed++;
    console.error(`✗ empresa ${party.id}: ${describe(error)}`);
  }
}

const haveUsers = new Set(
  (
    await tables.listRows({
      databaseId,
      tableId: "users",
      queries: [
        Query.equal(
          "email",
          DEMO_USERS.map((u) => u.email),
        ),
        Query.limit(100),
      ],
    })
  ).rows.map((r) => String(r.email)),
);
for (const u of DEMO_USERS) {
  if (haveUsers.has(u.email)) continue;
  if (u.party && !haveParties.has(u.party)) {
    failed++;
    console.error(`✗ login ${u.email}: a empresa ${u.party} não existe`);
    continue;
  }
  try {
    const found = await authUsers.list({
      queries: [Query.equal("email", u.email)],
    });
    if (found.total === 0) {
      await authUsers.create({
        userId: ID.unique(),
        email: u.email,
        password: DEMO_PASSWORD,
        name: u.name,
      });
      console.log(`+ login ${u.email} no Appwrite Auth`);
    }
  } catch (error) {
    failed++;
    console.error(`✗ login ${u.email} (Appwrite Auth): ${describe(error)}`);
    continue;
  }
  try {
    await tables.createRow({
      databaseId,
      tableId: "users",
      rowId: ID.unique(),
      data: toAppwrite("users", {
        ...USER_EXTRA_DEFAULTS,
        ...demoUserFields(u),
        passwordHash: null,
      }),
    });
    created++;
    console.log(`+ login ${u.email} (${u.role})`);
  } catch (error) {
    failed++;
    console.error(`✗ login ${u.email} (tabela users): ${describe(error)}`);
  }
}

console.log(
  `${failed ? "✗" : "✓"} Contas de demonstração: ${created} criada(s), ${failed} com falha, ${DEMO_USERS.length} logins no cadastro.`,
);
if (failed) process.exit(1);
