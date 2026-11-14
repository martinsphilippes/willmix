import type { ReactNode } from "react";
import { OpenPartFromHash } from "./order-part-hash";

/*
 * Parte do detalhe do pedido que abre e fecha (dono, 14/11/2026: "enxugar a
 * tela do pedido"; docs/FLOW_MENU.md). Abertas só as partes da fase em que o
 * pedido está; as outras ficam fechadas, com o título, a um clique. Fechada,
 * o conteúdo continua na página (âncoras e links de pendência abrem a parte:
 * OpenPartFromHash).
 */
export function OrderPart({
  id,
  title,
  open,
  openLabel,
  closeLabel,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="group min-w-0"
      data-order-collapse={id}
      data-order-collapse-open={open ? "1" : "0"}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm group-open:mb-2 group-open:border-transparent group-open:bg-transparent group-open:px-0 group-open:py-0 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-zinc-800 group-open:hidden">
          {title}
        </span>
        <span className="ml-auto text-brand-700 group-open:hidden">
          {openLabel}
        </span>
        <span className="hidden text-xs text-zinc-500 group-open:inline">
          {closeLabel}
        </span>
      </summary>
      {children}
    </details>
  );
}

export { OpenPartFromHash };
