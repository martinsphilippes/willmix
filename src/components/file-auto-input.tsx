"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/** Teto do envio pela Server Action na Vercel (~4,5 MB); acima disso o envio falha. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Anexo de arquivo (PDF, planilha, imagem) que envia sozinho ao escolher.
 * Cancelar a escolha não muda nada: dá para tocar de novo a qualquer momento.
 * Arquivo grande demais é barrado aqui, com aviso, em vez de travar o envio.
 */
export function FileAutoInput({
  name,
  label,
  pendingLabel,
  tooBigLabel,
  accept,
}: {
  name: string;
  label: string;
  pendingLabel: string;
  tooBigLabel: string;
  accept?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const { pending } = useFormStatus();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(tooBigLabel);
      input.value = "";
      return;
    }
    setError(null);
    input.form?.requestSubmit();
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label
        aria-busy={pending || undefined}
        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${
          pending
            ? "pointer-events-none cursor-wait border-zinc-200 bg-zinc-50 text-zinc-500"
            : "cursor-pointer border-brand-300 bg-white text-brand-700 hover:bg-brand-50 active:bg-brand-100"
        }`}
      >
        {pending ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
        ) : (
          <span aria-hidden>📎</span>
        )}
        <span>{pending ? pendingLabel : label}</span>
        <input
          name={name}
          type="file"
          accept={accept}
          onChange={onChange}
          className="sr-only"
        />
      </label>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
