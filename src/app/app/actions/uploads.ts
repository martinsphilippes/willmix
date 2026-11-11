"use server";

import { z } from "zod";
import {
  createSignedUpload,
  createUploadToken,
  type UploadToken,
} from "@/lib/services/uploads";
import { requireUser } from "./helpers";

/**
 * Token para o navegador subir um arquivo grande direto ao armazenamento.
 * Só devolve dados (nada é gravado); o documento é registrado depois pela
 * ação do requisito, com o id do arquivo.
 */
export async function createUploadTokenAction(): Promise<UploadToken> {
  const user = await requireUser();
  return createUploadToken(user);
}

/**
 * Supabase: link assinado para subir um arquivo direto (a chave é escolhida
 * no servidor). Nada é gravado no banco; o documento é registrado depois.
 */
export async function createSignedUploadAction(
  name: string,
): Promise<{ key: string; url: string }> {
  const user = await requireUser();
  return createSignedUpload(
    user,
    z.string().trim().min(1).max(255).parse(name),
  );
}
