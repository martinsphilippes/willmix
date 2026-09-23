import "server-only";

import { cookies, headers } from "next/headers";
import {
  Account,
  Client,
  Storage,
  TablesDB,
  Teams,
  Users,
} from "node-appwrite";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Nome do cookie de sessão. Segue a convenção do Appwrite (a_session_<projectId>)
 * para que o SDK reconheça a sessão em qualquer integração futura.
 */
export function sessionCookieName() {
  return `a_session_${publicEnv?.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "willmix"}`;
}

function baseClient(): Client {
  if (!publicEnv) {
    throw new Error(
      "Appwrite não configurado: defina NEXT_PUBLIC_APPWRITE_ENDPOINT e NEXT_PUBLIC_APPWRITE_PROJECT_ID.",
    );
  }
  return new Client()
    .setEndpoint(publicEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(publicEnv.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
}

function resourceIds() {
  const env = serverEnv();
  return {
    databaseId: env.success ? env.data.APPWRITE_DATABASE_ID : "willmix",
    bucketId: env.success ? env.data.APPWRITE_BUCKET_ID : "arquivos",
  };
}

/**
 * Cliente administrativo (API key). Ignora permissões de linha e arquivo.
 * Use apenas em código de servidor que já validou papel e regras de negócio.
 */
export function createAdminClient() {
  const env = serverEnv();
  if (!env.success) {
    throw new Error("Appwrite não configurado: defina APPWRITE_API_KEY.");
  }
  const client = baseClient().setKey(env.data.APPWRITE_API_KEY);
  return {
    client,
    account: new Account(client),
    users: new Users(client),
    teams: new Teams(client),
    tables: new TablesDB(client),
    storage: new Storage(client),
    ...resourceIds(),
  };
}

/**
 * Cliente na identidade do usuário logado (respeita permissões).
 * Criado por requisição, nunca compartilhado. Retorna null sem cookie.
 */
export async function createSessionClient() {
  const store = await cookies();
  const secret = store.get(sessionCookieName())?.value;
  if (!secret) return null;

  const client = baseClient().setSession(secret);
  const userAgent = (await headers()).get("user-agent");
  if (userAgent) client.setForwardedUserAgent(userAgent);

  return {
    client,
    account: new Account(client),
    teams: new Teams(client),
    tables: new TablesDB(client),
    storage: new Storage(client),
    ...resourceIds(),
  };
}
