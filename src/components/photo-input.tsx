"use client";

import { useRef, useState } from "react";

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
      for (const file of files) {
        const reduced = await shrink(file, maxDimension, quality);
        transfer.items.add(reduced);
        urls.push(URL.createObjectURL(reduced));
      }
      input.files = transfer.files;
      setPreviews((old) => {
        old.forEach((u) => URL.revokeObjectURL(u));
        return urls;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-4 py-5 text-center text-sm text-brand-800 transition hover:bg-brand-50 active:bg-brand-100">
        <span aria-hidden className="text-2xl">
          📷
        </span>
        <span className="font-semibold">{busy ? "…" : label}</span>
        {hint ? (
          <span className="text-xs text-brand-700/80">{hint}</span>
        ) : null}
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept="image/*"
          capture={capture === false ? undefined : capture}
          multiple={multiple}
          required={required}
          onChange={onChange}
          className="sr-only"
        />
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
