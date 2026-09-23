import { z } from "zod";

/**
 * Variáveis públicas (expostas ao browser). Precisam ser referenciadas
 * literalmente como process.env.NEXT_PUBLIC_* para o Next.js fazer o inline.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: z.string().min(1),
});

const publicResult = publicSchema.safeParse({
  NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
});

export const publicEnv = publicResult.success ? publicResult.data : null;
export const isAppwriteClientConfigured = publicResult.success;

/** Somente servidor. Lido de forma preguiçosa para não vazar em bundles do browser. */
export function serverEnv() {
  const schema = z.object({
    APPWRITE_API_KEY: z.string().min(1),
    APPWRITE_DATABASE_ID: z.string().min(1).default("willmix"),
    APPWRITE_BUCKET_ID: z.string().min(1).default("arquivos"),
  });
  return schema.safeParse({
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY,
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
    APPWRITE_BUCKET_ID: process.env.APPWRITE_BUCKET_ID,
  });
}

export const isAppwriteServerConfigured = () =>
  isAppwriteClientConfigured && serverEnv().success;
