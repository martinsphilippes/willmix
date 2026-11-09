import type { ReactNode } from "react";
import { cx } from "./ui";

/*
 * Linha fina com "ver mais" (tabelas de itens do pedido: Clientes,
 * Fornecedores e Pedidos). Cada produto ocupa uma linha da altura da foto: o
 * texto que não cabe termina em "…". A setinha no começo da linha abre,
 * logo abaixo, uma faixa com os textos inteiros. Só CSS (:has), sem
 * JavaScript: serve em componente de servidor e funciona no toque (iPad).
 */

/** Texto que não pode quebrar a linha: termina em "…". */
export const oneLine = "block truncate whitespace-nowrap";

/** Setinha "ver mais" (primeira coluna da linha). */
export function RowMoreToggle({ label }: { label: string }) {
  return (
    <label
      className="mr-1 inline-flex cursor-pointer select-none items-center align-middle"
      title={label}
    >
      <input
        type="checkbox"
        className="row-more peer sr-only"
        aria-label={label}
        data-row-more-toggle
      />
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center rounded text-xs text-zinc-500 transition peer-checked:rotate-90 peer-checked:text-brand-700 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600 hover:bg-zinc-100"
      >
        ▶
      </span>
    </label>
  );
}

/**
 * Faixa com os textos inteiros, logo abaixo da linha: aparece quando a
 * setinha da linha de cima está marcada.
 */
export function RowMoreDetails({
  colSpan,
  items,
}: {
  colSpan: number;
  /** [rótulo, valor, ocupa duas colunas?] */
  items: Array<[string, ReactNode, boolean?]>;
}) {
  return (
    <tr
      className="hidden bg-zinc-50/80 [tr:has(.row-more:checked)+&]:table-row"
      data-row-more
    >
      <td colSpan={colSpan} className="border-b border-zinc-200 px-3 py-2.5">
        <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([label, value, wide], i) => (
            <div key={i} className={cx("min-w-0", wide && "sm:col-span-2")}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {label}
              </dt>
              <dd className="whitespace-pre-line break-words text-zinc-800">
                {value === null || value === undefined || value === ""
                  ? "—"
                  : value}
              </dd>
            </div>
          ))}
        </dl>
      </td>
    </tr>
  );
}
