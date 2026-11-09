"use client";

import { createUploadTokenAction } from "@/app/app/actions/uploads";
import { storageFileName } from "@/lib/file-kinds";

function lowerExtension(file: File): File {
  const name = storageFileName(file.name);
  return name === file.name
    ? file
    : new File([file], name, {
        type: file.type,
        lastModified: file.lastModified,
      });
}

/**
 * Teto do corpo da requisição na Vercel (~4,5 MB) com folga para os outros
 * campos: acima disso, os arquivos sobem direto ao armazenamento.
 */
export const SERVER_MAX_BYTES = 3.5 * 1024 * 1024;

/**
 * Sobe arquivos direto ao armazenamento (Appwrite) com o token da sessão;
 * devolve os ids. Sem envio direto (modo memória, desenvolvimento), devolve
 * nulo e os arquivos seguem no formulário.
 */
export async function uploadDirect(
  files: File[],
  onProgress: (percent: number) => void,
): Promise<string[] | null> {
  const token = await createUploadTokenAction();
  if (token.mode !== "direct") return null;
  const { Client, ID, Storage } = await import("appwrite");
  const client = new Client()
    .setEndpoint(token.endpoint)
    .setProject(token.project)
    .setJWT(token.jwt);
  const storage = new Storage(client);
  const ids: string[] = [];
  onProgress(0);
  for (let i = 0; i < files.length; i++) {
    const created = await storage.createFile({
      bucketId: token.bucket,
      fileId: ID.unique(),
      // Extensão em minúsculas ("IMG_1.MOV"): a lista do bucket é em minúsculas.
      file: lowerExtension(files[i]),
      onProgress: (p) =>
        onProgress(
          Math.min(
            99,
            Math.round(((i + p.progress / 100) / files.length) * 100),
          ),
        ),
    });
    ids.push(created.$id);
  }
  return ids;
}
