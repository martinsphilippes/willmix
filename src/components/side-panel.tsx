"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./ui";

/*
 * Painel lateral à direita (Comparar e Copiar acesso, Novo tipo de parceiro;
 * dono, 14/11/2026). Abrir e fechar mudam só o endereço: fechar volta ao
 * endereço de antes do painel (`closeHref`), com a visão e os filtros que
 * estavam. O conteúdo vem pronto do servidor. Em tela estreita (celular), o
 * painel ocupa a largura inteira. Esc, o ✕ e o toque fora fecham.
 */
export function SidePanel({
  title,
  subtitle,
  closeHref,
  closeLabel,
  footer,
  wide = false,
  children,
  ...rest
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Para onde volta ao fechar (a página como estava). */
  closeHref: string;
  closeLabel: string;
  /** Rodapé fixo (ações do painel). */
  footer?: ReactNode;
  /** Mais largo no computador (tabelas de comparação). */
  wide?: boolean;
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const router = useRouter();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // A página de baixo não rola com o painel aberto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });
    panel.current?.setAttribute("data-side-panel-ready", "1");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.replace(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [router, closeHref]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      {/* Fundo: tocar fora fecha (funciona até sem JavaScript, é um link). */}
      <Link
        href={closeHref}
        replace
        scroll={false}
        aria-label={closeLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-zinc-900/30"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "relative flex h-full w-full flex-col bg-white shadow-2xl outline-none",
          wide ? "sm:max-w-2xl" : "sm:max-w-xl",
        )}
        {...rest}
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-bold tracking-tight text-zinc-900"
            >
              {title}
            </h2>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-zinc-600">{subtitle}</div>
            ) : null}
          </div>
          <Link
            href={closeHref}
            replace
            scroll={false}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            data-side-panel-close
          >
            <span aria-hidden>×</span>
            <span className="sr-only">{closeLabel}</span>
          </Link>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
