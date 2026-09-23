"use client";

import { Account, Client, Realtime, Storage, TablesDB } from "appwrite";
import { publicEnv } from "@/lib/env";

/**
 * SDK Web do Appwrite para uso no browser: realtime, uploads com progresso
 * e leituras que respeitam permissões. A autenticação principal é feita no
 * servidor (cookie HttpOnly); aqui o cliente usa a sessão via /api/auth/jwt
 * quando precisar agir em nome do usuário.
 */
let cached: Client | null = null;

export function getBrowserClient(): Client {
  if (cached) return cached;
  if (!publicEnv) {
    throw new Error(
      "Appwrite não configurado: defina as variáveis NEXT_PUBLIC_APPWRITE_* (veja .env.example).",
    );
  }
  cached = new Client()
    .setEndpoint(publicEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(publicEnv.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
  return cached;
}

export const browserAccount = () => new Account(getBrowserClient());
export const browserTables = () => new TablesDB(getBrowserClient());
export const browserStorage = () => new Storage(getBrowserClient());
export const browserRealtime = () => new Realtime(getBrowserClient());
