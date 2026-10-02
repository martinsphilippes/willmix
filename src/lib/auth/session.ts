import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getStore, type User } from "@/lib/db";
import { dataMode, sessionSecret } from "@/lib/env";
import { verifyPassword } from "./password";
import { signToken, verifyToken } from "./token";

export const MEMORY_COOKIE = "wm_session";
const SESSION_DAYS = 7;

export class AuthError extends Error {}

/**
 * Login. Modo memória: valida senha localmente e assina um cookie.
 * Modo Appwrite: cria sessão com a API key e guarda o segredo em cookie.
 * Em ambos, o usuário precisa existir na tabela `users` (papel e parceiro).
 */
export async function signIn(email: string, password: string): Promise<User> {
  const store = getStore();
  const normalized = email.trim().toLowerCase();
  const [user] = await store.list("users", {
    filter: { email: normalized },
    limit: 1,
  });
  if (!user || !user.active) throw new AuthError("invalid");

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";

  if (dataMode() === "memory") {
    if (!verifyPassword(password, user.passwordHash))
      throw new AuthError("invalid");
    const exp = Date.now() + SESSION_DAYS * 86_400_000;
    jar.set(
      MEMORY_COOKIE,
      signToken({ userId: user.id, exp }, sessionSecret()),
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        expires: new Date(exp),
      },
    );
    return user;
  }

  const { createAdminClient, sessionCookieName } =
    await import("@/lib/appwrite/server");
  const { account } = createAdminClient();
  const session = await account.createEmailPasswordSession({
    email: normalized,
    password,
  });
  jar.set(sessionCookieName(), session.secret, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expire),
  });
  return user;
}

export async function signOut() {
  const jar = await cookies();
  if (dataMode() === "memory") {
    jar.delete(MEMORY_COOKIE);
    return;
  }
  const { createSessionClient, sessionCookieName } =
    await import("@/lib/appwrite/server");
  const secret = jar.get(sessionCookieName())?.value;
  if (secret) recentSessions.delete(sessionKey(secret));
  const session = await createSessionClient();
  if (session) {
    await session.account
      .deleteSession({ sessionId: "current" })
      .catch(() => undefined);
  }
  jar.delete(sessionCookieName());
}

/*
 * Cache curto de sessões conferidas (por instância do servidor). Guarda só o
 * hash do segredo. Validade curta: usuário desativado ou com papel trocado
 * perde o acesso antigo em no máximo SESSION_RECHECK_MS; logout apaga na hora.
 */
const SESSION_RECHECK_MS = 60_000;
const recentSessions = new Map<string, { user: User; expires: number }>();

function sessionKey(secret: string) {
  return createHash("sha256").update(secret).digest("base64url");
}

function rememberSession(key: string, user: User) {
  if (recentSessions.size > 5_000) recentSessions.clear();
  recentSessions.set(key, { user, expires: Date.now() + SESSION_RECHECK_MS });
}

/** Usuário autenticado ou null. Nunca lança. Memoizado por requisição. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const store = getStore();
    const jar = await cookies();
    if (dataMode() === "memory") {
      const payload = verifyToken(
        jar.get(MEMORY_COOKIE)?.value,
        sessionSecret(),
      );
      if (!payload) return null;
      const user = await store.get("users", payload.userId);
      return user && user.active ? user : null;
    }
    const { createSessionClient, sessionCookieName } =
      await import("@/lib/appwrite/server");
    const secret = jar.get(sessionCookieName())?.value;
    if (!secret) return null;
    // Sessão já conferida há pouco nesta instância: evita 2 idas ao Appwrite
    // (conta + usuário) em toda página e em toda foto.
    const key = sessionKey(secret);
    const hit = recentSessions.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;
    const session = await createSessionClient();
    if (!session) return null;
    const account = await session.account.get();
    const [user] = await store.list("users", {
      filter: { email: account.email.toLowerCase() },
      limit: 1,
    });
    const valid = user && user.active ? user : null;
    if (valid) rememberSession(key, valid);
    return valid;
  } catch {
    return null;
  }
});
