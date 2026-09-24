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
    APPWRITE_API_KEY: z.string().min(20),
  });
  return schema.safeParse({ APPWRITE_API_KEY: process.env.APPWRITE_API_KEY });
}

export const isAppwriteServerConfigured = () =>
  isAppwriteClientConfigured && serverEnv().success;

export type DataMode = "memory" | "appwrite";

/**
 * Modo de dados. `DATA_MODE=memory|appwrite` força; sem a variável, usa
 * Appwrite quando configurado e memória caso contrário (desenvolvimento).
 */
export function dataMode(): DataMode {
  const forced = process.env.DATA_MODE;
  if (forced === "memory" || forced === "appwrite") return forced;
  return isAppwriteServerConfigured() ? "appwrite" : "memory";
}

/**
 * Diretório do modo memória. Testes usam diretórios isolados.
 * Na Vercel o sistema de arquivos é somente leitura fora de /tmp: o modo memória
 * ali serve apenas para demonstração (dados efêmeros).
 */
export const dataDir = () =>
  process.env.DATA_DIR ?? (process.env.VERCEL ? "/tmp/willmix-data" : ".data");

/** Segredo para assinar o cookie de sessão no modo memória. */
export const sessionSecret = () =>
  process.env.SESSION_SECRET ?? "willmix-dev-secret-troque-em-producao";
