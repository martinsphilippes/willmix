"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Menu "⋯" de uma linha (tipos de parceiro: Editar, Renomear, Inativar). Os
 * itens vêm prontos do servidor (links e formulários com Server Action). Abre
 * no toque; fecha com Esc, com o toque fora ou ao escolher um item.
 */
export function RowMenu({
  label,
  children,
  ...rest
}: {
  /** Nome do botão para leitor de tela (ex.: "Ações de Trading"). */
  label: string;
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.setAttribute("data-ready", "1");
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // Primeiro item com o foco, para seguir pelo teclado.
    root.current
      ?.querySelector<HTMLElement>("[role=menu] a, [role=menu] button")
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative inline-block text-left">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          open && "bg-zinc-100 text-zinc-900",
        )}
        {...rest}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={label}
          // Link escolhido: o menu fecha. Envio de formulário não fecha aqui
          // (tirar o formulário da tela cancelaria o envio); a página volta
          // da ação já sem o menu aberto.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg [&_a]:block [&_a]:w-full [&_a]:px-3 [&_a]:py-2 [&_a]:text-left [&_a]:text-zinc-800 [&_a:hover]:bg-zinc-50 [&_button]:block [&_button]:w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-zinc-800 [&_button:hover]:bg-zinc-50"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
