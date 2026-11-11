import type { ReactNode } from "react";
import { cx } from "./ui";

/**
 * Seção recolhível da página (o mesmo desenho do quadro recolhível do
 * cadastro): fechada, mostra só o título; um toque abre. `bare` tira a
 * moldura e o título do cartão que vem dentro (o título já está na barra).
 * Quem lembra o que estava aberto e abre a seção de um link é o
 * `FoldMemory`, uma vez por página.
 */
export function FoldSection({
  title,
  fold,
  id,
  badge,
  bare,
  defaultOpen,
  className,
  children,
}: {
  title: ReactNode;
  /** Nome da seção (memória do que estava aberto e testes). */
  fold: string;
  id?: string;
  /** Selo ao lado do título (ex.: situação). */
  badge?: ReactNode;
  bare?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className={cx(
        "group/fold min-w-0 scroll-mt-4 rounded-lg border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]",
        className,
      )}
      data-fold-section={fold}
      open={defaultOpen}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        {badge}
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open/fold:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </summary>
      <div
        className="border-t border-zinc-100 px-3 pb-3 pt-3"
        data-fold-bare={bare ? "" : undefined}
      >
        {children}
      </div>
    </details>
  );
}
