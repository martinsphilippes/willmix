"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, inputClass } from "@/components/ui";

const noSubscribe = () => () => {};

/**
 * Link de confirmação do atendimento com o endereço do portal na frente,
 * pronto para copiar e mandar ao cliente (WhatsApp ou e-mail de quem atendeu:
 * o portal ainda não manda mensagem sozinho).
 */
export function CopyLink({
  path,
  labels,
}: {
  path: string;
  labels: { copy: string; copied: string };
}) {
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;
  const [copied, setCopied] = useState(false);

  async function copy(input: HTMLInputElement | null) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem a API de cópia: o link fica selecionado para copiar à mão.
      input?.select();
    }
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} min-w-0 flex-1 basis-64 font-mono text-xs`}
        data-attendance-link=""
        aria-label={labels.copy}
      />
      <Button
        type="button"
        variant="secondary"
        className="px-2.5 py-1 text-xs"
        onClick={(e) =>
          void copy(
            e.currentTarget.parentElement?.querySelector("input") ?? null,
          )
        }
        data-attendance-copy=""
      >
        {copied ? labels.copied : labels.copy}
      </Button>
    </span>
  );
}
