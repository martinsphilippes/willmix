"use server";

import { createUploadToken, type UploadToken } from "@/lib/services/uploads";
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
