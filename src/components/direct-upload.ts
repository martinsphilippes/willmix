"use client";

import {
  createSignedUploadAction,
  createUploadTokenAction,
} from "@/app/app/actions/uploads";
import type { UploadToken } from "@/lib/services/uploads";
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
 * Teto por arquivo no armazenamento (o mesmo MAX_DOCUMENT_BYTES do servidor,
 * plano do Appwrite): acima disso nem adianta começar a subir.
 */
export const DIRECT_MAX_BYTES = 50_000_000;

/** PUT no link assinado do Supabase com progresso (fetch não mede o envio). */
function putSigned(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload_failed_${xhr.status}`));
    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.send(file);
  });
}

/**
 * Sobe um arquivo direto ao armazenamento com o token: Appwrite (JWT da
 * sessão) ou Supabase (link assinado pedido ao servidor). Devolve a chave.
 */
export async function uploadOne(
  token: Exclude<UploadToken, { mode: "server" }>,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const ready = lowerExtension(file);
  if (token.mode === "signed") {
    const { key, url } = await createSignedUploadAction(ready.name);
    await putSigned(url, ready, onProgress);
    return key;
  }
  const { Client, ID, Storage } = await import("appwrite");
  const client = new Client()
    .setEndpoint(token.endpoint)
    .setProject(token.project)
    .setJWT(token.jwt);
  const created = await new Storage(client).createFile({
    bucketId: token.bucket,
    fileId: ID.unique(),
    // Extensão em minúsculas ("IMG_1.MOV"): a lista do bucket é em minúsculas.
    file: ready,
    onProgress: (p) => onProgress(p.progress / 100),
  });
  return created.$id;
}

/**
 * Sobe arquivos direto ao armazenamento (Appwrite ou Supabase) com o token;
 * devolve os ids. Sem envio direto (modo memória, desenvolvimento), devolve
 * nulo e os arquivos seguem no formulário.
 */
export async function uploadDirect(
  files: File[],
  onProgress: (percent: number) => void,
): Promise<string[] | null> {
  const token = await createUploadTokenAction();
  if (token.mode === "server") return null;
  const ids: string[] = [];
  onProgress(0);
  for (let i = 0; i < files.length; i++) {
    ids.push(
      await uploadOne(token, files[i], (fraction) =>
        onProgress(
          Math.min(99, Math.round(((i + fraction) / files.length) * 100)),
        ),
      ),
    );
  }
  return ids;
}
