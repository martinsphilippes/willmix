"use client";

import { useState, type ReactNode } from "react";

/*
 * Blocos da linha do tempo do pedido (dono, 27/11/2026): as etapas de cada
 * bloco ficam recolhidas; um clique no bloco mostra as dele embaixo, outro
 * clique recolhe. O bloco em foco (de onde o pedido foi aberto, ou o atual)
 * segue em cor.
 */
export type ProgressBlockTab = {
  key: string;
  /** Bloco em foco: em cor. */
  here: boolean;
  percent: number;
  /** Nome, selos e percentual do bloco. */
  face: ReactNode;
  /** Etapas do bloco: o relatório, o Overview e a tabela. */
  detail: ReactNode;
};

export function OrderProgressBlocks({
  blocks,
}: {
  blocks: readonly ProgressBlockTab[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = blocks.find((b) => b.key === open) ?? null;
  return (
    <>
      <ol className="grid gap-2 sm:grid-cols-3" data-order-progress-blocks>
        {blocks.map((b) => {
          const expanded = open === b.key;
          return (
            <li key={b.key}>
              <button
                type="button"
                onClick={() => setOpen((o) => (o === b.key ? null : b.key))}
                aria-expanded={expanded}
                aria-controls={`order-progress-detail-${b.key}`}
                aria-current={b.here ? "step" : undefined}
                data-order-progress-block={b.key}
                data-order-progress-percent={b.percent}
                data-order-progress-expanded={expanded ? "" : undefined}
                className={[
                  "block w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  b.here
                    ? "border-brand-300 bg-brand-50"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500",
                  expanded ? "ring-2 ring-brand-400" : "",
                ].join(" ")}
              >
                {b.face}
              </button>
            </li>
          );
        })}
      </ol>
      {shown ? (
        <div
          id={`order-progress-detail-${shown.key}`}
          className="mt-4"
          data-order-progress-detail={shown.key}
        >
          {shown.detail}
        </div>
      ) : null}
    </>
  );
}
