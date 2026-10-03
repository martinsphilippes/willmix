"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createUploadTokenAction } from "@/app/app/actions/uploads";

/** Teto do envio pela Server Action na Vercel (~4,5 MB); acima disso o arquivo sobe direto ao armazenamento. */
const SERVER_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Anexo de arquivo (PDF, planilha, imagem, arte) que envia sozinho ao escolher.
 * Até 4 MB vai no próprio formulário. Acima disso, o navegador pede um token e
 * sobe o arquivo em pedaços direto ao armazenamento, com progresso; o
 * formulário então só leva o id do arquivo (`uploadedFileId`). Cancelar a
 * escolha não muda nada: dá para tocar de novo a qualquer momento.
 */
export function FileAutoInput({
  name,
  label,
  pendingLabel,
  uploadingLabel,
  tooBigLabel,
  serverOnlyLabel,
  failedLabel,
  accept,
}: {
  name: string;
  label: string;
  pendingLabel: string;
  /** Com {percent}. */
  uploadingLabel: string;
  tooBigLabel: string;
  /** Ambiente sem envio direto (modo memória): só até 4 MB. */
  serverOnlyLabel: string;
  failedLabel: string;
  accept?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const { pending } = useFormStatus();
  const busy = pending || progress !== null;

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const form = input.form;
    const file = input.files?.[0];
    if (!file || !form) return;
    setError(null);
    if (file.size <= SERVER_MAX_BYTES) {
      form.requestSubmit();
      return;
    }
    setProgress(0);
    try {
      const token = await createUploadTokenAction();
      if (token.mode === "server") {
        setError(serverOnlyLabel);
        input.value = "";
        return;
      }
      if (file.size > token.maxBytes) {
        setError(tooBigLabel);
        input.value = "";
        return;
      }
      const { Client, ID, Storage } = await import("appwrite");
      const client = new Client()
        .setEndpoint(token.endpoint)
        .setProject(token.project)
        .setJWT(token.jwt);
      const created = await new Storage(client).createFile({
        bucketId: token.bucket,
        fileId: ID.unique(),
        file,
        onProgress: (p) => setProgress(Math.min(99, Math.round(p.progress))),
      });
      // O arquivo não vai no corpo da requisição: só o id do que já subiu.
      input.value = "";
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "uploadedFileId";
      hidden.value = created.$id;
      form.appendChild(hidden);
      form.requestSubmit();
    } catch (err) {
      console.error("upload direto falhou", err);
      // O motivo real ajuda a diagnosticar (ex.: 401 sem permissão no bucket,
      // "Failed to fetch" quando o domínio não está cadastrado no Appwrite).
      const detail =
        err instanceof Error && err.message
          ? ` (${err.message.slice(0, 160)})`
          : "";
      setError(`${failedLabel}${detail}`);
      input.value = "";
    } finally {
      setProgress(null);
    }
  }

  const text =
    progress !== null
      ? uploadingLabel.replace("{percent}", String(progress))
      : pending
        ? pendingLabel
        : label;

  return (
    <span className="inline-flex flex-col gap-1">
      <label
        aria-busy={busy || undefined}
        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${
          busy
            ? "pointer-events-none cursor-wait border-zinc-200 bg-zinc-50 text-zinc-500"
            : "cursor-pointer border-brand-300 bg-white text-brand-700 hover:bg-brand-50 active:bg-brand-100"
        }`}
      >
        {busy ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
        ) : (
          <span aria-hidden>📎</span>
        )}
        <span>{text}</span>
        <input
          name={name}
          type="file"
          accept={accept}
          disabled={busy}
          onChange={onChange}
          className="sr-only"
        />
      </label>
      {error ? (
        <span role="alert" className="text-xs font-medium text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
