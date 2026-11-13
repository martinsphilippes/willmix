"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Linha de lista com um detalhe que abre embaixo dela. Só a seta, com o
 * título ao lado, é o botão: o resto da linha (`children`: links e ações)
 * fica fora dele, então tocar num link nunca abre nem fecha a linha. Começa
 * sempre recolhida e não lembra o estado entre visitas.
 *
 * As colunas são de quem usa (`className` da linha, com a seta na primeira
 * célula); `data-expand-row` (open | closed) serve ao estilo e aos testes.
 */
export function ExpandRow({
  title,
  className,
  toggleClassName,
  detailClassName,
  children,
  detail,
}: {
  /** Nome ao lado da seta; faz parte do botão. */
  title: ReactNode;
  className?: string;
  toggleClassName?: string;
  detailClassName?: string;
  /** Resto da linha, sempre à vista. */
  children: ReactNode;
  /** O que aparece embaixo quando a linha abre. */
  detail: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  // Hidratado: a seta já responde ao toque (o E2E espera por isto).
  useEffect(() => {
    toggle.current?.setAttribute("data-ready", "1");
  }, []);
  return (
    <>
      <div className={className} data-expand-row={open ? "open" : "closed"}>
        <button
          ref={toggle}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className={cx(
            "-mx-1 flex min-h-9 min-w-0 items-center gap-1.5 rounded-md px-1 text-left transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            toggleClassName,
          )}
          data-expand-toggle
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={cx(
              "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
              open && "rotate-90",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 5l5 5-5 5" />
          </svg>
          <span className="min-w-0">{title}</span>
        </button>
        {children}
      </div>
      <div
        id={id}
        hidden={!open}
        className={detailClassName}
        data-expand-detail
      >
        {detail}
      </div>
    </>
  );
}
