import "server-only";

import { cookies } from "next/headers";
import {
  createAdminClient,
  createSessionClient,
  sessionCookieName,
} from "@/lib/appwrite/server";

/**
 * Sessão SSR do Appwrite: o servidor cria a sessão com a API key e guarda o
 * segredo em cookie HttpOnly. Cada requisição recria um cliente com esse
 * segredo, então permissões de linha valem para o usuário logado.
 */
export async function signInWithPassword(email: string, password: string) {
  const { account } = createAdminClient();
  const session = await account.createEmailPasswordSession({ email, password });

  const store = await cookies();
  store.set(sessionCookieName(), session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(session.expire),
  });
  return session;
}

export async function signOut() {
  const session = await createSessionClient();
  if (session) {
    await session.account
      .deleteSession({ sessionId: "current" })
      .catch(() => undefined);
  }
  const store = await cookies();
  store.delete(sessionCookieName());
}

/** Retorna o usuário autenticado ou null. Nunca lança. */
export async function getCurrentUser() {
  try {
    const session = await createSessionClient();
    if (!session) return null;
    return await session.account.get();
  } catch {
    return null;
  }
}
