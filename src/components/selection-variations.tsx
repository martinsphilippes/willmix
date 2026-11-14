"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cx } from "@/components/ui";
import {
  CARTONS_EVENT,
  COLORS_EVENT,
  SPLIT_EVENT,
  type CartonsEventDetail,
  type ColorsEventDetail,
  type SplitEventDetail,
} from "@/components/selection-quantity";

/*
 * Logo abaixo da tabela do grupo (Seleção de itens; docs/PURCHASE_SCHEDULE.md,
 * "Cores"): com um vencedor marcado em "Escolher", a barra diz qual é e quantos
 * itens ficaram recolhidos, com "Rever opções" para abrir a comparação de novo
 * (o recolher é do CSS, por `data-selection-review`). Abaixo, o card
 * recolhível "Variações": uma linha por cor do item no Book, todas incluídas
 * ao começar; tirar ou pôr uma cor vale só para esta compra (as cores do Book
 * não mudam). As cores marcadas vão no formulário (`colors.<item>`) e a
 * composição por cor (peças de cada cor) vem do gerador da quantidade.
 */

export interface VariationItem {
  id: string;
  name: string;
  /** Cores do item no Book (duas ou mais = variações). */
  colors: string[];
  /** Peças por caixa master (com ela, as caixas de cada cor são editáveis). */
  carton?: number | null;
}

export interface VariationLabels {
  intl: string;
  chosen: string;
  collapsed: string;
  review: string;
  reviewHint: string;
  title: string;
  hint: string;
  include: string;
  excluded: string;
  count: string;
  pieces: string;
  line: string;
  /** Campo "Caixas" ao lado das peças de cada cor e o rótulo acessível dele. */
  cartons: string;
  cartonsOf: string;
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

export function SelectionVariations({
  items,
  chosenItemId,
  savedColors,
  labels,
}: {
  items: VariationItem[];
  /** O vencedor da escolha gravada. */
  chosenItemId: string | null;
  /** Cores incluídas na escolha gravada (do `chosenItemId`). */
  savedColors: string[] | null;
  labels: VariationLabels;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<string | null>(chosenItemId);
  // Cores incluídas por item (trocar de vencedor e voltar mantém o que foi
  // mexido; a escolha gravada começa com as cores gravadas).
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    chosenItemId && savedColors ? { [chosenItemId]: savedColors } : {},
  );
  const [split, setSplit] = useState<SplitEventDetail | null>(null);
  const [open, setOpen] = useState(true);

  const item = items.find((i) => i.id === chosen) ?? null;
  const variants = !!item && item.colors.length > 1;
  const included = item
    ? item.colors.filter((c) => (picked[item.id] ?? item.colors).includes(c))
    : [];

  const markItem = useEffectEvent((next: string | null, byUser: boolean) => {
    setChosen(next);
    // Escolher outro item recolhe de novo a comparação.
    if (byUser) {
      const review = ref.current
        ?.closest("form")
        ?.querySelector<HTMLInputElement>("input[data-selection-review]");
      if (review) review.checked = false;
    }
  });

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const el = form.querySelector<HTMLInputElement>(
        'input[name="chosen"]:checked',
      );
      markItem(el ? el.value : null, false);
    };
    const onChange = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.name === "chosen" && el.checked)
        markItem(el.value, true);
    };
    const onSplit = (e: Event) =>
      setSplit((e as CustomEvent<SplitEventDetail>).detail);
    const frame = requestAnimationFrame(sync);
    form.addEventListener("change", onChange);
    form.addEventListener(SPLIT_EVENT, onSplit);
    window.addEventListener("pageshow", sync);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("change", onChange);
      form.removeEventListener(SPLIT_EVENT, onSplit);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  // O gerador da quantidade refaz a composição com as cores incluídas.
  const key = item ? `${item.id}|${included.join("|")}` : "";
  useEffect(() => {
    if (!item) return;
    ref.current?.closest("form")?.dispatchEvent(
      new CustomEvent<ColorsEventDetail>(COLORS_EVENT, {
        detail: { itemId: item.id, colors: included },
      }),
    );
    // `key` resume o item e as cores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = (color: string, on: boolean) => {
    if (!item) return;
    const now = new Set(picked[item.id] ?? item.colors);
    if (on) now.add(color);
    else now.delete(color);
    setPicked((p) => ({
      ...p,
      [item.id]: item.colors.filter((c) => now.has(c)),
    }));
  };

  // Caixas sendo digitadas (o campo mostra o texto até sair dele).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const per = item?.carton && item.carton >= 1 ? Math.round(item.carton) : null;
  /** Caixas digitadas para uma cor: o gerador refaz o total (a soma). */
  const typeCartons = (color: string, text: string) => {
    setDrafts((d) => ({ ...d, [color]: text }));
    const n = Number(text.replace(/\D/g, ""));
    if (!item || text.trim() === "" || !Number.isInteger(n) || n < 0) return;
    ref.current?.closest("form")?.dispatchEvent(
      new CustomEvent<CartonsEventDetail>(CARTONS_EVENT, {
        detail: { itemId: item.id, color, cartons: n },
      }),
    );
  };

  const pieces = (color: string) =>
    split?.itemId === item?.id
      ? (split?.rows?.find((r) => r.color === color)?.quantity ?? null)
      : null;
  const others = Math.max(0, items.length - 1);

  return (
    <div ref={ref} className="space-y-3" data-selection-variations-block>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm"
        data-selection-winner-bar
      >
        <span className="min-w-0 text-zinc-800">
          <span className="font-semibold">✓ {labels.chosen}:</span>{" "}
          <span data-selection-winner-name>{item?.name ?? ""}</span>
          {others ? (
            <span className="ml-2 text-xs text-zinc-500">
              {fill(labels.collapsed, { n: others })}
            </span>
          ) : null}
        </span>
        {others ? (
          <label
            className="cursor-pointer text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 has-[:checked]:text-brand-700"
            title={labels.reviewHint}
          >
            <input type="checkbox" className="sr-only" data-selection-review />
            {labels.review}
          </label>
        ) : null}
      </div>

      {item && variants ? (
        <section
          className="rounded-xl border border-zinc-200 bg-white"
          data-selection-variations={item.id}
        >
          <input type="hidden" name={`colorsSent.${item.id}`} value="1" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            data-selection-variations-toggle
          >
            <span>
              <span className="block text-sm font-semibold text-zinc-900">
                {labels.title}
              </span>
              <span
                className="block text-xs text-zinc-500"
                data-selection-variations-count
              >
                {fill(labels.count, {
                  n: included.length,
                  total: item.colors.length,
                })}
              </span>
            </span>
            <span aria-hidden className="text-zinc-400">
              {open ? "▴" : "▾"}
            </span>
          </button>
          {/* Fechado, as caixas continuam no formulário (só escondidas). */}
          <div
            className={cx("space-y-2 px-4 pb-4", !open && "hidden")}
            data-selection-variations-body
          >
            <p className="text-xs text-zinc-500">{labels.hint}</p>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {item.colors.map((color) => {
                const on = included.includes(color);
                const n = on ? pieces(color) : null;
                return (
                  <li
                    key={color}
                    className={cx(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 pr-3",
                      !on && "bg-zinc-50 text-zinc-400",
                    )}
                    data-selection-color={color}
                    data-selection-color-on={on ? "1" : "0"}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        name={`colors.${item.id}`}
                        value={color}
                        checked={on}
                        onChange={(e) => toggle(color, e.target.checked)}
                        aria-label={fill(labels.include, { color })}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block font-medium",
                            on ? "text-zinc-900" : "line-through",
                          )}
                        >
                          {fill(labels.line, { product: item.name, color })}
                        </span>
                        {!on ? (
                          <span className="block text-xs">
                            {labels.excluded}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {/* Caixas da cor, livres (dono, 14/11/2026): mudar uma
                        cor muda só ela, e o total vira a soma das cores. */}
                    {on && per && n !== null ? (
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                        <span>{labels.cartons}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={drafts[color] ?? String(Math.round(n / per))}
                          onChange={(e) => typeCartons(color, e.target.value)}
                          onBlur={() =>
                            setDrafts((d) => {
                              const rest = { ...d };
                              delete rest[color];
                              return rest;
                            })
                          }
                          onKeyDown={(e) => {
                            // Enter não grava a escolha: só confirma o campo.
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          aria-label={fill(labels.cartonsOf, { color })}
                          className="h-8 w-20 rounded-md border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          data-selection-color-cartons
                        />
                      </label>
                    ) : null}
                    {n !== null ? (
                      <span
                        className="shrink-0 text-xs font-semibold tabular-nums text-zinc-700"
                        data-selection-color-pieces
                      >
                        {fill(labels.pieces, {
                          n: n.toLocaleString(labels.intl),
                        })}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
