"use client";

import { useRef, useState } from "react";
import type { NcmChipView } from "@/lib/services/ncm-suggestions";

/**
 * Sugestões de NCM abaixo do campo da ficha: um clique em "Usar" preenche o
 * NCM e, quando a tabela tem, o II e o IPI do mesmo formulário. Quem salva
 * continua sendo a ficha; a classificação oficial segue no card Tributos.
 */
export function NcmSuggestions({
  items,
  labels,
}: {
  items: NcmChipView[];
  labels: { title: string; use: string; hint: string; applied: string };
}) {
  const root = useRef<HTMLDivElement>(null);
  const [applied, setApplied] = useState<string | null>(null);
  function apply(item: NcmChipView) {
    const form = root.current?.closest("form");
    if (!form) return;
    const set = (name: string, value: string | null) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (!el || value === null) return;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("ncm", item.label);
    set("importTaxPercent", item.ii === null ? null : String(item.ii));
    set("ipiPercent", item.ipi === null ? null : String(item.ipi));
    setApplied(item.ncm);
  }
  if (items.length === 0) return null;
  return (
    <div ref={root} data-ncm-suggestions className="space-y-1.5">
      <p className="text-xs font-medium text-zinc-700">{labels.title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.ncm}
            data-ncm-chip={item.ncm}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1 text-xs ${
              applied === item.ncm
                ? "border-emerald-300 bg-emerald-50"
                : "border-zinc-200 bg-white"
            }`}
          >
            <span className="font-mono text-[13px] font-semibold text-zinc-900">
              {item.label}
            </span>
            {item.description ? (
              <span className="min-w-0 truncate text-zinc-700">
                {item.description}
              </span>
            ) : null}
            <span className="text-zinc-500">
              {item.source} · {item.rates}
            </span>
            <button
              type="button"
              onClick={() => apply(item)}
              className="ml-auto rounded-md border border-brand-300 bg-white px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              {labels.use}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-500" aria-live="polite">
        {applied ? labels.applied.replace("{ncm}", applied) : labels.hint}
      </p>
    </div>
  );
}
