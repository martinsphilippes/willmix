import "server-only";

import { BUCKET_ID, type User } from "@/lib/db";
import { dataMode, publicEnv } from "@/lib/env";
import { MAX_DOCUMENT_BYTES } from "./documents";

/*
 * Envio direto do navegador ao armazenamento (arquivos grandes).
 * A Server Action na Vercel aceita ~4 MB por requisição; a arte da embalagem
 * passa disso. O navegador recebe um token curto (JWT da própria sessão) e
 * sobe o arquivo em pedaços direto ao Appwrite Storage; depois a Server Action
 * só registra o documento (`registerUploadedDocument`). O bucket dá só
 * "create" a usuários logados: leitura continua pelo servidor (/api/files).
 */

/** Teto do corpo da requisição na Vercel: acima disso o envio é direto. */
export const SERVER_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Validade do token: só o tempo de subir o arquivo. */
const TOKEN_SECONDS = 900;

export type UploadToken =
  | {
      mode: "direct";
      endpoint: string;
      project: string;
      bucket: string;
      jwt: string;
      maxBytes: number;
    }
  /** Supabase: o navegador pede um link assinado por arquivo e sobe nele. */
  | { mode: "signed"; maxBytes: number }
  | { mode: "server"; maxBytes: number };

/** Token para o usuário logado subir um arquivo direto; sem Appwrite, envio só pelo servidor. */
export async function createUploadToken(user: User): Promise<UploadToken> {
  if (dataMode() === "supabase")
    return { mode: "signed", maxBytes: MAX_DOCUMENT_BYTES };
  if (dataMode() === "memory" || !publicEnv)
    return { mode: "server", maxBytes: SERVER_UPLOAD_BYTES };
  const { createAdminClient, createSessionClient } =
    await import("@/lib/appwrite/server");
  const session = await createSessionClient();
  if (!session) throw new Error("unauthorized");
  const account = await session.account.get();
  if (account.email.toLowerCase() !== user.email.toLowerCase())
    throw new Error("unauthorized");
  const { users } = createAdminClient();
  const token = await users.createJWT({
    userId: account.$id,
    duration: TOKEN_SECONDS,
  });
  return {
    mode: "direct",
    endpoint: publicEnv.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    project: publicEnv.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    bucket: BUCKET_ID,
    jwt: token.jwt,
    maxBytes: MAX_DOCUMENT_BYTES,
  };
}

/** Link assinado (Supabase) para o usuário logado subir um arquivo direto. */
export async function createSignedUpload(user: User, name: string) {
  void user; // quem chama já conferiu a sessão (requireUser)
  const { getStore } = await import("@/lib/db");
  const sign = getStore().createSignedUpload;
  if (!sign) throw new Error("signed_upload_unavailable");
  return sign(name);
}
