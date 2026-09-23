import "server-only";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Sessão via cookie HttpOnly assinado pelo Firebase (session cookie).
 * Fluxo: login no browser (Firebase Auth) -> POST /api/auth/session com o idToken
 * -> servidor grava cookie -> Server Components/Route Handlers verificam com verifySessionCookie.
 */
export const SESSION_COOKIE = "__session";
const SESSION_DAYS = 5;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export async function createSession(idToken: string) {
  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MS,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Retorna o usuário autenticado ou null. Nunca lança. */
export async function getCurrentUser() {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    return await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}
