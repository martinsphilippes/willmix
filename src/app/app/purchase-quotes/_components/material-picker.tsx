"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import { materialKey } from "@/lib/materials";

/*
 * Material da ficha técnica pelo catálogo (dono, 21/11/2026): a digitação só
 * busca; ele escolhe uma ou mais opções da lista (a Composição real combina
 * materiais: "Plástico / Papel"). Não existe material novo nem texto livre
 * por aqui; o servidor confere os ids de novo. Sem a opção certa, a lista
 * orienta a falar com a Wellmix.
 */

export interface MaterialPickerOption {
  id: string;
  /** O nome no idioma da tela. */
  label: string;
  /** Os três nomes, para a busca achar em qualquer idioma. */
  search: string;
}

export interface MaterialPickerLabels {
  /** Nome do campo (leitor de tela). */
  field: string;
  placeholder: string;
  empty: string;
  missing: string;
  /** "Tirar {name}". */
  remove: string;
}

export function MaterialPicker({
  options,
  value,
  onChange,
  name,
  form,
  lacking,
  changed,
  labels,
  dataField,
}: {
  options: readonly MaterialPickerOption[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  /** Campo oculto com os ids separados por vírgula. */
  name: string;
  form: string;
  lacking: boolean;
  /** Mudou em relação ao nosso cadastro (amarelo). */
  changed: boolean;
  labels: MaterialPickerLabels;
  dataField: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const chosen = value.filter((id) => byId.has(id));
  const results = useMemo(() => {
    const words = materialKey(query).split(" ").filter(Boolean);
    return options
      .filter((o) => !value.includes(o.id))
      .filter((o) => {
        const hay = materialKey(o.search);
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 40);
  }, [options, query, value]);

  const add = (id: string) => {
    onChange([...chosen, id]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };
  const remove = (id: string) => onChange(chosen.filter((x) => x !== id));

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Enter escolhe a opção marcada; nunca envia a cotação.
      e.preventDefault();
      if (open && results[active]) add(results[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && chosen.length) {
      remove(chosen[chosen.length - 1]);
    }
  }

  return (
    <div
      className="relative min-w-0"
      data-material-picker={dataField}
      data-missing={lacking ? "true" : undefined}
    >
      <input type="hidden" form={form} name={name} value={chosen.join(",")} />
      <div
        className={cx(
          "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 shadow-sm transition focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
          lacking
            ? "border-red-400 bg-red-50"
            : changed
              ? "border-amber-400 bg-amber-50"
              : "border-zinc-300 bg-white",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {chosen.map((id) => (
          <span
            key={id}
            className="inline-flex max-w-full items-center gap-1 rounded bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-800"
            data-material-chip={id}
          >
            <span className="truncate">{byId.get(id)!.label}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(id);
              }}
              aria-label={labels.remove.replace("{name}", byId.get(id)!.label)}
              className="grid h-5 w-5 place-items-center rounded text-brand-700 hover:bg-brand-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={labels.field}
          value={query}
          placeholder={chosen.length ? "" : labels.placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          // Fecha depois do clique na opção (o clique vem antes do blur terminar).
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          className="h-7 min-w-[4rem] flex-1 border-0 bg-transparent px-1 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          data-sheet-field={dataField}
        />
        <span aria-hidden className="pr-1 text-xs text-zinc-400">
          ⌕
        </span>
      </div>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-[13px] shadow-lg"
          data-material-options={dataField}
        >
          {results.map((o, i) => (
            <button
              type="button"
              key={o.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(o.id)}
              className={cx(
                "block w-full px-3 py-2 text-left hover:bg-zinc-50",
                i === active && "bg-zinc-100",
              )}
              data-material-option={o.id}
            >
              {o.label}
            </button>
          ))}
          {!results.length ? (
            <p className="px-3 py-2 text-xs text-zinc-600">{labels.empty}</p>
          ) : null}
          <p
            className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500"
            data-material-missing
          >
            {labels.missing}
          </p>
        </div>
      ) : null}
    </div>
  );
}
