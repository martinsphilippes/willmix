"use client";

import { useRef, type ReactNode } from "react";
import { cx } from "./ui";

/*
 * Botão de ação rápida que abre uma caixa pequena (um formulário curto) por
 * cima da tela: tabela de produtos da solicitação ao fornecedor. O conteúdo
 * vem pronto do servidor (formulário com Server Action); tocar fora ou em
 * "×" fecha.
 */
export function QuickDialog({
  label,
  title,
  closeLabel,
  tone = "secondary",
  children,
  ...rest
}: {
  label: ReactNode;
  title: string;
  closeLabel: string;
  tone?: "primary" | "secondary";
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={cx(
          "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-600",
          tone === "primary"
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
        )}
        {...rest}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-left shadow-2xl backdrop:bg-zinc-900/40"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        data-quick-dialog
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5">
          <h2 className="truncate text-sm font-semibold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={closeLabel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            ×
          </button>
        </div>
        {/* Enviado o formulário, a caixa fecha (a tela volta com o aviso). */}
        <div
          className="p-4"
          onSubmit={() => requestAnimationFrame(() => dialog.current?.close())}
        >
          {children}
        </div>
      </dialog>
    </>
  );
}
