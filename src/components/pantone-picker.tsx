"use client";

import { useEffect, useRef, useState } from "react";
import { cx, inputDenseClass } from "@/components/ui";
import type { PantoneColor, PantoneRef, PantoneScale } from "@/lib/pantone";
import { PANTONE_SCALES } from "@/lib/pantone";
import { syncColorText } from "@/lib/pantone/color-text";
import { DRAFT_RESTORE_EVENT } from "./form-draft-guard";

/*
 * Seletor de cores Pantone (ficha de compra): busca por número/nome, filtro
 * por escala, cada resultado com amostra, código, RGB e hex. As escolhidas
 * viram "chips" e vão no campo oculto `name` como JSON de [{code, hex}]; o
 * servidor confere o código na própria tabela. A tabela (~6 mil cores) só é
 * carregada quando o campo de busca recebe foco. Com `syncName`, o campo de
 * texto da cor do mesmo formulário (ex.: "Cor / sortimento") acompanha a
 * seleção: cada cor escolhida entra como "PANTONE <código>".
 */
export function PantonePicker({
  name,
  initial,
  disabled,
  max = 20,
  labels,
  id,
  syncName,
  syncMax = 200,
}: {
  name: string;
  /** Nome do campo de texto da cor a preencher com os códigos escolhidos. */
  syncName?: string;
  /** Tamanho máximo daquele campo (o servidor recusa acima disso). */
  syncMax?: number;
  /** Vem do FieldRow: o rótulo aponta para o campo de busca. */
  id?: string;
  initial: PantoneRef[];
  disabled?: boolean;
  max?: number;
  labels: {
    search: string;
    scaleAll: string;
    scales: Record<PantoneScale, string>;
    loading: string;
    none: string;
    more: string;
    remove: string;
    max: string;
    empty: string;
  };
}) {
  const [selected, setSelected] = useState<PantoneRef[]>(initial);
  // O campo só vai no formulário quando há cores ou o usuário mexeu (ficha sem
  // Pantone continua salvando antes de a coluna existir no banco).
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [scale, setScale] = useState<PantoneScale | "">("");
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<PantoneColor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Clique/arraste dentro da caixa (ex.: barra de rolagem da lista) não fecha a lista.
  const pressing = useRef(false);

  async function load() {
    if (table || loading) return;
    setLoading(true);
    const mod = await import("@/lib/pantone");
    setTable(mod.allPantone());
    setLoading(false);
  }

  // Hidratado: a tela (e o E2E) pode interagir com segurança.
  useEffect(() => {
    box.current?.setAttribute("data-ready", "1");
  }, []);

  // Volta de um envio que não salvou: as cores escolhidas voltam (o texto da
  // Cor volta pelo guarda da ficha) e vão no próximo envio.
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const onRestore = (e: Event) => {
      const raw = (e as CustomEvent<Record<string, string>>).detail?.[name];
      if (typeof raw !== "string") return;
      try {
        const list: unknown = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const next = list
          .filter(
            (c): c is PantoneRef =>
              !!c &&
              typeof (c as PantoneRef).code === "string" &&
              typeof (c as PantoneRef).hex === "string",
          )
          .slice(0, max)
          .map((c) => ({ code: c.code, hex: c.hex }));
        setSelected(next);
        setDirty(true);
      } catch {
        // Rascunho ilegível: fica o que o servidor mostrou.
      }
    };
    form.addEventListener(DRAFT_RESTORE_EVENT, onRestore);
    return () => form.removeEventListener(DRAFT_RESTORE_EVENT, onRestore);
  }, [name, max]);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const LIMIT = 60;
  const q = query.trim().replace(/\s+/g, " ").toUpperCase();
  const numeric = /^\d/.test(q);
  const results: PantoneColor[] = [];
  if (table) {
    const chosen = new Set(selected.map((s) => s.code.toUpperCase()));
    const pass = (c: PantoneColor, strict: boolean) => {
      const code = c.code.toUpperCase();
      if (numeric) return strict ? code.startsWith(q) : code.includes(q);
      return strict
        ? code.startsWith(q) || c.name.toUpperCase().startsWith(q)
        : code.includes(q) || c.name.toUpperCase().includes(q);
    };
    outer: for (const strict of [true, false]) {
      for (const c of table) {
        if (scale && c.scale !== scale) continue;
        if (chosen.has(c.code.toUpperCase())) continue;
        if (q && !pass(c, strict)) continue;
        if (!strict && pass(c, true)) continue;
        results.push(c);
        if (results.length >= LIMIT) break outer;
      }
      if (!q) break;
    }
  }

  /* Texto da cor do mesmo formulário acompanha a seleção (sem apagar o que a
     pessoa escreveu). O campo é não controlado: basta trocar o valor e avisar. */
  const syncTarget = () => {
    if (!syncName) return null;
    const el = box.current?.closest("form")?.elements.namedItem(syncName);
    return el instanceof HTMLInputElement ? el : null;
  };
  /* Campo obrigatório vermelho: deixa de aparecer pendente quando tem texto
     ou cores escolhidas (o servidor escreve os códigos na cor vazia) e volta
     ao vermelho se ficar vazio de novo. Acompanha também o que se digita. */
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const markResolved = (el: HTMLInputElement, chosen: number) => {
    const row = el.closest("[data-field-row]");
    if (el.value.trim() || chosen > 0) row?.setAttribute("data-resolved", "");
    else row?.removeAttribute("data-resolved");
  };
  useEffect(() => {
    const el = syncTarget();
    if (!el) return;
    const onInput = () => markResolved(el, selectedRef.current.length);
    onInput();
    el.addEventListener("input", onInput);
    return () => el.removeEventListener("input", onInput);
  });
  function syncText(prev: PantoneRef[], next: PantoneRef[]) {
    const el = syncTarget();
    if (!el || el.disabled || el.readOnly) return;
    const value = syncColorText(el.value, prev, next, syncMax);
    if (value !== el.value) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    markResolved(el, next.length);
  }

  function add(c: PantoneColor) {
    if (selected.length >= max) return;
    const next = [...selected, { code: c.code, hex: c.hex }];
    setSelected(next);
    syncText(selected, next);
    setDirty(true);
    setQuery("");
    // Fecha a lista: ela cobriria a Cor logo abaixo, que acabou de mudar.
    // Outra cor: clicar na busca (ou digitar) abre de novo.
    setOpen(false);
  }
  function remove(code: string) {
    const next = selected.filter((x) => x.code !== code);
    setSelected(next);
    syncText(selected, next);
    setDirty(true);
  }
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

  return (
    <div
      ref={box}
      className="min-w-0 space-y-2"
      data-pantone-picker
      onPointerDown={() => {
        pressing.current = true;
      }}
      onPointerUp={() => {
        pressing.current = false;
      }}
      onPointerCancel={() => {
        pressing.current = false;
      }}
      onBlur={(e) => {
        // Saiu da caixa por teclado (Tab): fecha a lista para não cobrir os campos abaixo.
        if (pressing.current) return;
        if (!box.current?.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      {selected.length > 0 || dirty ? (
        <input
          type="hidden"
          name={name}
          value={JSON.stringify(selected)}
          data-draft
        />
      ) : null}
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <li
              key={c.code}
              data-pantone-chip={c.code}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white py-0.5 pl-1 pr-1.5 text-[12px] text-zinc-800 shadow-sm"
            >
              <span
                aria-hidden
                className="h-5 w-5 shrink-0 rounded-sm ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: c.hex }}
              />
              <span className="font-semibold">PANTONE {c.code}</span>
              <span className="tabular-nums text-zinc-500">
                RGB {rgb(c.hex)} · {c.hex.toUpperCase()}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => remove(c.code)}
                  aria-label={`${labels.remove}: PANTONE ${c.code}`}
                  className="ml-0.5 rounded px-1 text-zinc-400 hover:bg-red-50 hover:text-red-700"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : disabled ? (
        <p className="text-xs text-zinc-500">{labels.empty}</p>
      ) : null}
      {!disabled ? (
        <div className="relative">
          <div className="flex flex-wrap gap-1.5">
            <input
              id={id}
              type="search"
              value={query}
              placeholder={labels.search}
              data-pantone-search
              autoComplete="off"
              onFocus={() => {
                setOpen(true);
                void load();
              }}
              onClick={() => {
                setOpen(true);
                void load();
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Lista fechada (depois de escolher): Enter só a abre; nunca
                  // escolhe uma cor que a pessoa não está vendo.
                  if (!open) {
                    setOpen(true);
                    void load();
                    return;
                  }
                  if (q && results[0]) add(results[0]);
                }
              }}
              className={cx(inputDenseClass, "min-w-0 flex-1 sm:max-w-sm")}
              disabled={selected.length >= max}
            />
            <select
              value={scale}
              onChange={(e) => {
                setScale(e.target.value as PantoneScale | "");
                setOpen(true);
                void load();
              }}
              aria-label={labels.scaleAll}
              className={cx(inputDenseClass, "w-auto")}
            >
              <option value="">{labels.scaleAll}</option>
              {PANTONE_SCALES.map((s) => (
                <option key={s} value={s}>
                  {labels.scales[s]}
                </option>
              ))}
            </select>
          </div>
          {selected.length >= max ? (
            <p className="mt-1 text-xs text-amber-700">
              {labels.max.replace("{n}", String(max))}
            </p>
          ) : null}
          {open && selected.length < max ? (
            <div
              role="listbox"
              data-pantone-results
              className="absolute left-0 z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg sm:max-w-md"
            >
              {loading || !table ? (
                <p className="px-2 py-1.5 text-xs text-zinc-500">
                  {labels.loading}
                </p>
              ) : results.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-zinc-500">
                  {labels.none}
                </p>
              ) : (
                <>
                  {results.map((c) => (
                    <button
                      key={`${c.scale}-${c.code}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => add(c)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-brand-50"
                    >
                      <span
                        aria-hidden
                        className="h-6 w-6 shrink-0 rounded-sm ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">PANTONE {c.code}</span>
                        {c.name !== c.code.replace(/ (C|U|TCX)$/, "") ? (
                          <span className="text-zinc-500"> · {c.name}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-zinc-500">
                        RGB {rgb(c.hex)} · {c.hex.toUpperCase()}
                      </span>
                    </button>
                  ))}
                  {results.length >= LIMIT ? (
                    <p className="px-2 py-1.5 text-xs text-zinc-500">
                      {labels.more.replace("{n}", String(LIMIT))}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
