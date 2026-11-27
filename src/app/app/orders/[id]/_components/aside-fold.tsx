import type { ReactNode } from "react";

/*
 * Quadro recolhido da lateral direita do pedido (dono, 27/11/2026): "Venda
 * ao cliente" e "Pagamento do cliente", um acima do outro, sem fixar na
 * rolagem. Fechado, é uma linha com o título; aberto, mostra o mesmo de
 * antes. Abre sozinho na volta de uma ação dele e pela âncora
 * (`RevealHashTarget`).
 */
export function AsideFold({
  id,
  title,
  open,
  children,
}: {
  /** Âncora e nome da seção (`data-order-section`), os mesmos de antes. */
  id: string;
  title: ReactNode;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group/aside min-w-0 scroll-mt-24 rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]"
      data-order-section={id}
      data-order-aside-fold={id}
    >
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden"
        data-order-aside-toggle={id}
      >
        <span>{title}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open/aside:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </summary>
      <div className="@container min-w-0 border-t border-zinc-100 p-3">
        {children}
      </div>
    </details>
  );
}
