/**
 * Cria um login de administrador da Wellmix (acesso a tudo) com senha
 * provisória: no primeiro acesso o portal só mostra a troca de senha
 * (`users.mustChangePassword`, src/lib/services/password-change.ts).
 *
 * Uso (a senha vem do ambiente, nunca fica no repositório):
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="..." \
 *     node scripts/appwrite-admin-login.ts
 * com NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID e
 * APPWRITE_API_KEY (escopos de linhas e de usuários).
 *
 * Só cria: se o e-mail já tem conta ou cadastro, para sem alterar nada. Se a
 * linha do portal não gravar, a conta criada é desfeita. Antes, o esquema
 * precisa estar publicado (coluna `mustChangePassword`).
 */
import { Client, ID, Query, TablesDB, Users } from "node-appwrite";
import { DATABASE_ID, USER_EXTRA_DEFAULTS } from "../src/lib/db/schema.ts";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
const name = (process.env.ADMIN_NAME ?? "").trim() || "Administrador";
if (!endpoint || !projectId || !apiKey) {
  console.error(
    "✗ Defina NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID e APPWRITE_API_KEY.",
  );
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
  console.error(
    "✗ Defina ADMIN_EMAIL (e-mail) e ADMIN_PASSWORD (8 ou mais caracteres).",
  );
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);
const tables = new TablesDB(client);
const authUsers = new Users(client);

const describe = (error: unknown) => {
  const e = error as { type?: unknown; code?: unknown; message?: unknown };
  return [e?.type, e?.code, e?.message ?? String(error)]
    .filter((v) => v !== undefined && v !== "")
    .join(" · ");
};

const rows = await tables.listRows({
  databaseId: DATABASE_ID,
  tableId: "users",
  queries: [Query.equal("email", email), Query.limit(1)],
});
const accounts = await authUsers.list({
  queries: [Query.equal("email", email), Query.limit(1)],
});
if (rows.total > 0 || accounts.total > 0) {
  console.error(
    `✗ ${email} já existe (cadastro: ${rows.total}, conta: ${accounts.total}). Nada foi alterado.`,
  );
  process.exit(1);
}

const account = await authUsers.create({
  userId: ID.unique(),
  email,
  password,
  name,
});
try {
  const row = await tables.createRow({
    databaseId: DATABASE_ID,
    tableId: "users",
    rowId: ID.unique(),
    data: {
      ...USER_EXTRA_DEFAULTS,
      email,
      name,
      role: "admin",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      mustChangePassword: true,
    },
  });
  console.log(
    `✓ Login de administrador criado: ${email} (cadastro ${row.$id}). Troca de senha obrigatória no primeiro acesso.`,
  );
} catch (error) {
  await authUsers.delete({ userId: account.$id }).catch(() => undefined);
  console.error(
    `✗ Cadastro não gravado; a conta foi desfeita. ${describe(error)}`,
  );
  process.exit(1);
}
