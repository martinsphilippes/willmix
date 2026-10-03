"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormDoneSignal } from "./submit-button";

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
  pendingLabel,
}: {
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
  /** Texto enquanto reduz/envia (ex.: "Enviando…"). */
  pendingLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
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
      if (autoSubmit) input.form?.requestSubmit();
    } finally {
      setBusy(false);
    }
  }

  const { pending } = useFormStatus();
  // Envio no lugar (sem navegar): avisa a barra de progresso que terminou.
  useFormDoneSignal(pending);
  const working = busy || pending;
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
    return (
      <label
        aria-disabled={disabled || working || undefined}
        aria-busy={working || undefined}
        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${
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
        <span>{working && pendingLabel ? pendingLabel : label}</span>
        {input}
      </label>
    );
  }

  return (
    <div className={className}>
      <label
        aria-disabled={disabled || undefined}
        className={
          disabled
            ? "flex cursor-not-allowed flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-400 opacity-70"
            : "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-4 py-5 text-center text-sm text-brand-800 transition hover:bg-brand-50 active:bg-brand-100"
        }
      >
        <span aria-hidden className="text-2xl">
          📷
        </span>
        <span className="font-semibold">
          {working ? (pendingLabel ?? "…") : label}
        </span>
        {hint ? (
          <span className="text-xs text-brand-700/80">{hint}</span>
        ) : null}
        {input}
      </label>
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

/** Reduz a imagem quando maior que o limite; se o navegador não decodificar (ex.: HEIC), devolve o original. */
async function shrink(file: File, maxDimension: number, quality: number) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
