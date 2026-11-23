"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cx } from "@/components/ui";
import { STRATEGY_VIEW_COOKIE, type StrategyView } from "@/lib/strategy-view";

/*
 * Duas formas de ver a Estratégia de compra (dono, 23/11/2026;
 * docs/PURCHASE_DEMAND.md, "Cards ou tabela"): por cards (como sempre) ou em
 * tabela, à escolha de quem trabalha. A escolha vai no endereço (?view=) e
 * fica lembrada no navegador (cookie), para a tela abrir do mesmo jeito da
 * próxima vez.
 */

const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

/** Lembra a escolha no navegador (um ano). */
function remember(value: StrategyView) {
  try {
    window.document.cookie = `${STRATEGY_VIEW_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Sem cookie: a escolha vale pelo endereço.
  }
}

export function StrategyViewToggle({
  view,
  chosen,
  hrefs,
  labels,
}: {
  /** A visualização veio do endereço (alguém escolheu): lembrar. */
  chosen: boolean;
  view: StrategyView;
  hrefs: Record<StrategyView, string>;
  labels: { label: string; cards: string; table: string };
}) {
  // Escolha pelo endereço: fica lembrada para a próxima vez.
  useEffect(() => {
    if (chosen) remember(view);
  }, [chosen, view]);
  return (
    <div
      role="group"
      aria-label={labels.label}
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white text-xs"
      data-strategy-view={view}
    >
      {(["cards", "table"] as const).map((value) => (
        <Link
          key={value}
          href={hrefs[value]}
          scroll={false}
          aria-current={view === value ? "true" : undefined}
          onClick={() => remember(value)}
          className={cx(
            "px-2.5 py-1.5 font-medium",
            view === value
              ? "bg-brand-600 text-white"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
          )}
          data-strategy-view-option={value}
        >
          {labels[value]}
        </Link>
      ))}
    </div>
  );
}

/**
 * Linha da tabela que abre o card inteiro embaixo (o mesmo da outra
 * visualização, com as ações). O card fica montado mesmo fechado, para o que
 * foi marcado nele não se perder ao recolher. Endereço com `#<anchorId>`
 * (avisos e pendências) já abre a linha.
 */
export function StrategyTableRow({
  cells,
  columns,
  children,
  anchorId,
  labels,
  rowKey,
  highlight = false,
}: {
  cells: ReactNode[];
  /** Colunas da tabela (com a do botão), para o card ocupar a linha toda. */
  columns: number;
  children: ReactNode;
  anchorId?: string;
  labels: { open: string; close: string };
  rowKey: string;
  highlight?: boolean;
}) {
  // Aberta pelo botão; sem clique ainda, o endereço manda (`#<anchorId>`).
  const [manual, setManual] = useState<boolean | null>(null);
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const open = manual ?? (!!anchorId && hash === `#${anchorId}`);
  const setOpen = (next: (value: boolean) => boolean) => setManual(next(open));
  return (
    <>
      <tr
        className={cx(
          "border-t border-zinc-100 align-top",
          highlight && "bg-brand-50/40",
          open && "bg-zinc-50",
        )}
        data-strategy-row={rowKey}
        data-strategy-row-open={open ? "1" : "0"}
      >
        {cells.map((cell, i) => (
          <td key={i} className="px-2.5 py-2">
            {cell}
          </td>
        ))}
        <td className="whitespace-nowrap px-2.5 py-2 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            data-strategy-row-toggle={rowKey}
          >
            {open ? labels.close : labels.open}
          </button>
        </td>
      </tr>
      <tr hidden={!open} data-strategy-row-card={rowKey}>
        <td colSpan={columns} className="bg-zinc-50 px-2.5 pb-3 pt-1">
          <div className="max-w-xl">{children}</div>
        </td>
      </tr>
    </>
  );
}

/** A moldura da tabela das duas abas (rola de lado em tela estreita). */
export function StrategyTable({
  heads,
  children,
  marker,
}: {
  heads: string[];
  children: ReactNode;
  marker: string;
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-zinc-200 bg-white"
      data-strategy-table={marker}
    >
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
          <tr>
            {heads.map((head, i) => (
              <th key={i} className="whitespace-nowrap px-2.5 py-2">
                {head}
              </th>
            ))}
            <th className="w-10 px-2.5 py-2" />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
