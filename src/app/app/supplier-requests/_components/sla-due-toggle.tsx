"use client";

import { useId, useState, type ReactNode } from "react";

/*
 * SLA na coluna compacta "Situação / SLA" da tabela da solicitação (pedido do
 * dono, 13/11/2026): o selo (Atrasada ou No prazo) e, à direita dele, na
 * mesma linha, um botão pequeno "+". A data e a hora do prazo começam
 * recolhidas; "+" mostra embaixo do selo, dentro da própria célula, e vira
 * "−", que recolhe de novo. Cada linha guarda o próprio estado, e a largura
 * da coluna não muda (a data quebra dentro da caixa da célula).
 */
export function SlaDueToggle({
  children,
  due,
  late,
  labels,
}: {
  /** O selo do SLA, já pronto (o servidor monta). */
  children: ReactNode;
  /** Data e hora do prazo, já formatadas. */
  due: string;
  late: boolean;
  /** Nome do botão para leitores de tela e dica ao passar o mouse. */
  labels: { show: string; hide: string };
}) {
  const [open, setOpen] = useState(false);
  const dueId = useId();
  const label = open ? labels.hide : labels.show;
  return (
    <>
      <span className="flex items-center gap-1">
        {children}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={dueId}
          aria-label={label}
          title={label}
          onClick={() => setOpen((value) => !value)}
          data-supplier-table-sla-toggle={open ? "open" : "closed"}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-sm leading-none font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
        >
          <span aria-hidden>{open ? "−" : "+"}</span>
        </button>
      </span>
      <span
        id={dueId}
        hidden={!open}
        className={
          late
            ? "mt-1 block text-[11px] leading-tight break-words text-red-700 tabular-nums"
            : "mt-1 block text-[11px] leading-tight break-words text-zinc-500 tabular-nums"
        }
        data-supplier-table-sla-due
      >
        {due}
      </span>
    </>
  );
}
