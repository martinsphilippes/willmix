"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createUploadTokenAction } from "@/app/app/actions/uploads";
import { useFormDoneSignal } from "./submit-button";

/**
 * Teto do corpo da requisição na Vercel (~4,5 MB) com folga para os outros
 * campos: acima disso, com `direct`, as fotos sobem direto ao armazenamento.
 */
const SERVER_MAX_BYTES = 3.5 * 1024 * 1024;

/**
 * Campo de foto para o celular: abre a câmera (ou a galeria), reduz cada imagem
 * no próprio aparelho (lado maior 1600 px, JPEG ~82%) antes de enviar, e mostra
 * miniaturas. Sem isso, fotos de 4-8 MB estourariam o limite do envio pela
 * Server Action e a rede lenta na fábrica. O original só é reduzido, nunca
 * editado: continua sendo a evidência.
 */
export function PhotoInput({
  name,
  multiple = true,
  capture = "environment",
  maxDimension = 1600,
  quality = 0.82,
  required = false,
  label,
  hint,
  className,
  autoSubmit = false,
  disabled = false,
  compact = false,
  dense = false,
  pendingLabel,
  direct = false,
  uploadingLabel,
  failedLabel,
}: {
  /**
   * A Server Action do formulário aceita fotos já subidas (`uploadedPhotoId`):
   * lote acima do teto da requisição sobe direto ao armazenamento.
   */
  direct?: boolean;
  /** Com {percent}: progresso do envio direto. */
  uploadingLabel?: string;
  /** Falha do envio direto (o motivo técnico vai entre parênteses). */
  failedLabel?: string;
  name: string;
  multiple?: boolean;
  capture?: "environment" | "user" | false;
  maxDimension?: number;
  quality?: number;
  required?: boolean;
  label: string;
  hint?: string;
  className?: string;
  /** Envia o formulário assim que a foto estiver pronta (busca automática). */
  autoSubmit?: boolean;
  /** Recurso indisponível: campo inativo e esmaecido. */
  disabled?: boolean;
  /** Botão pequeno (cabe numa linha) em vez da área grande pontilhada. */
  compact?: boolean;
  /** Com `compact`: botão ainda menor (linhas finas da ficha). */
  dense?: boolean;
  /** Texto enquanto reduz/envia (ex.: "Enviando…"). */
  pendingLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Campos escondidos com os ids das fotos que já subiram direto.
  const uploaded = useRef<HTMLInputElement[]>([]);

  function clearUploaded() {
    uploaded.current.forEach((el) => el.remove());
    uploaded.current = [];
    if (inputRef.current) inputRef.current.required = required;
  }

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const form = input.form;
    const files = Array.from(input.files ?? []);
    setError(null);
    clearUploaded();
    if (files.length === 0) {
      setPreviews([]);
      return;
    }
    setBusy(true);
    try {
      const transfer = new DataTransfer();
      const urls: string[] = [];
      // Todas as fotos são reduzidas ao mesmo tempo (antes, uma por vez).
      const reducedFiles = await Promise.all(
        files.map((file) => shrink(file, maxDimension, quality)),
      );
      for (const reduced of reducedFiles) {
        transfer.items.add(reduced);
        urls.push(URL.createObjectURL(reduced));
      }
      input.files = transfer.files;
      setPreviews((old) => {
        old.forEach((u) => URL.revokeObjectURL(u));
        return urls;
      });
      const total = reducedFiles.reduce((sum, f) => sum + f.size, 0);
      if (direct && form && total > SERVER_MAX_BYTES) {
        // Lote grande demais para a requisição: sobe direto ao armazenamento
        // e o formulário leva só os ids.
        const ids = await uploadDirect(reducedFiles, setProgress);
        if (ids) {
          input.value = "";
          input.required = false;
          for (const id of ids) {
            const hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.name = "uploadedPhotoId";
            hidden.value = id;
            form.appendChild(hidden);
            uploaded.current.push(hidden);
          }
        }
      }
      if (autoSubmit) form?.requestSubmit();
    } catch (err) {
      console.error("envio da foto falhou", err);
      const detail =
        err instanceof Error && err.message
          ? ` (${err.message.slice(0, 160)})`
          : "";
      setError(`${failedLabel ?? "Falha no envio"}${detail}`);
      input.value = "";
      clearUploaded();
      setPreviews((old) => {
        old.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  const { pending } = useFormStatus();
  // Envio no lugar (sem navegar): avisa a barra de progresso que terminou.
  useFormDoneSignal(pending);
  // Terminou o envio do formulário: os ids já foram usados; a próxima foto
  // começa limpa (sem miniaturas antigas nem ids repetidos).
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      uploaded.current.forEach((el) => el.remove());
      uploaded.current = [];
      if (inputRef.current) inputRef.current.required = required;
      setPreviews((old) => {
        old.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
    }
    wasPending.current = pending;
  }, [pending, required]);
  const working = busy || pending;
  const workingText =
    progress !== null && uploadingLabel
      ? uploadingLabel.replace("{percent}", String(progress))
      : pendingLabel;
  const errorLine = error ? (
    <span role="alert" className="block text-xs font-medium text-red-700">
      {error}
    </span>
  ) : null;
  const input = (
    <input
      ref={inputRef}
      name={name}
      type="file"
      accept="image/*"
      capture={capture === false ? undefined : capture}
      multiple={multiple}
      required={required}
      disabled={disabled}
      onChange={onChange}
      className="sr-only"
    />
  );

  if (compact) {
    const button = (
      <label
        aria-disabled={disabled || working || undefined}
        aria-busy={working || undefined}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-semibold shadow-sm transition ${
          dense
            ? "min-h-7 px-2.5 py-0.5 text-xs"
            : "min-h-11 gap-2 rounded-lg px-4 py-2 text-sm"
        } ${
          disabled || working
            ? "pointer-events-none cursor-wait border-zinc-200 bg-zinc-50 text-zinc-500"
            : "cursor-pointer border-brand-300 bg-white text-brand-700 hover:bg-brand-50 active:bg-brand-100"
        } ${className ?? ""}`}
      >
        {working ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
        ) : (
          <span aria-hidden>📷</span>
        )}
        <span>{working && workingText ? workingText : label}</span>
        {input}
      </label>
    );
    return errorLine ? (
      <span className="inline-flex max-w-full flex-col items-end gap-1">
        {button}
        {errorLine}
      </span>
    ) : (
      button
    );
  }

  return (
    <div className={className}>
      <label
        aria-disabled={disabled || undefined}
        className={
          disabled
            ? "flex cursor-not-allowed flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5 text-center text-[13px] text-zinc-400 opacity-70"
            : "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/60 px-3 py-2.5 text-center text-[13px] text-brand-800 transition hover:bg-brand-50 active:bg-brand-100"
        }
      >
        <span aria-hidden className="text-lg leading-none">
          📷
        </span>
        <span className="font-semibold">
          {working ? (workingText ?? "…") : label}
        </span>
        {hint ? (
          <span className="text-xs text-brand-700/80">{hint}</span>
        ) : null}
        {input}
      </label>
      {errorLine ? <div className="mt-1.5">{errorLine}</div> : null}
      {previews.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {previews.map((src) => (
            <li key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) */}
              <img
                src={src}
                alt=""
                className="h-16 w-16 rounded-lg border border-zinc-200 object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Foto já reduzida acima deste tamanho é reduzida de novo (menor e mais leve). */
const TARGET_BYTES = 1.2 * 1024 * 1024;

/**
 * Lê a imagem: `createImageBitmap` e, se o navegador não conseguir (alguns
 * iPads com HEIC), pela tag <img>, que o Safari decodifica.
 */
async function decodeImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
}

/**
 * Reduz a foto no aparelho (JPEG, lado maior até `maxDimension`); se ainda
 * passar de ~1,2 MB, reduz mais um pouco (até 3 tentativas). Foto pequena em
 * JPEG/PNG/WebP fica como está; o que o navegador não decodificar vai original.
 */
async function shrink(file: File, maxDimension: number, quality: number) {
  if (file.type && !file.type.startsWith("image/")) return file;
  let image: Awaited<ReturnType<typeof decodeImage>>;
  try {
    image = await decodeImage(file);
  } catch {
    return file;
  }
  try {
    const light = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (
      light &&
      Math.max(image.width, image.height) <= maxDimension &&
      file.size < 600 * 1024
    )
      return file;
    let dimension = maxDimension;
    let q = quality;
    let best: Blob | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const scale = Math.min(
        1,
        dimension / Math.max(image.width, image.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", q),
      );
      if (!blob) break;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
      dimension = Math.round(dimension * 0.8);
      q = Math.max(0.6, q - 0.1);
    }
    if (!best) return file;
    const name = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([best], name, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    image.close();
  }
}

/**
 * Sobe as fotos direto ao armazenamento (Appwrite) com o token da sessão;
 * devolve os ids. Sem envio direto (modo memória, desenvolvimento), devolve
 * nulo e as fotos seguem no formulário.
 */
async function uploadDirect(
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
      file: files[i],
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
