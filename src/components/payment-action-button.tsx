"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Botão de ação do pagamento ao fornecedor, dentro de um formulário (Server
 * Action que registra o pagamento). No mesmo toque, antes de enviar:
 * - copyText: copia os dados para colar no banco;
 * - openUrl: abre o e-mail ou o WhatsApp com a mensagem pronta.
 * Tudo dentro do toque, que é o que o Safari do iPad permite.
 */
export function PaymentActionButton({
  children,
  copyText,
  openUrl,
  variant = "secondary",
}: {
  children: ReactNode;
  copyText?: string;
  openUrl?: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (copyText)
          void navigator.clipboard?.writeText(copyText).catch(() => {});
        if (openUrl) window.open(openUrl, "_blank", "noopener");
      }}
      className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-60 sm:w-auto ${
        variant === "primary"
          ? "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800"
          : "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
      }`}
    >
      {pending ? (
        <span
          aria-hidden
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
