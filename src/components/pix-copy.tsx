"use client";

import { useRef, useState } from "react";
import { inputClass } from "@/components/ui";

/**
 * Pix copia e cola: o código inteiro num campo só de leitura e um botão que
 * copia para a área de transferência (no celular, cola direto no app do banco).
 * Sem a API de cópia (navegador antigo), o texto fica selecionado para copiar.
 */
export function PixCopy({
  payload,
  labels,
}: {
  payload: string;
  labels: { code: string; copy: string; copied: string };
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      ref.current?.focus();
      ref.current?.select();
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="pix-payload"
        className="block text-sm font-medium text-zinc-800"
      >
        {labels.code}
      </label>
      <textarea
        ref={ref}
        id="pix-payload"
        readOnly
        rows={3}
        value={payload}
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} resize-none break-all font-mono text-xs`}
      />
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-base font-semibold text-white shadow-sm transition sm:w-auto ${
          copied
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-brand-600 hover:bg-brand-700"
        }`}
      >
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
