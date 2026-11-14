"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx, inputClass } from "./ui";

/** Uma opção do filtro: o valor que vai no endereço e o texto mostrado. */
export interface FilterOption {
  value: string;
  label: string;
}

/** Sem acento nem caixa, para comparar o que foi digitado. */
const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Lista de escolha com busca (filtro por tipo de parceiro em Cadastros →
 * Parceiros; dono, 14/11/2026): digita parte do nome e escolhe. O valor vai
 * num campo escondido com o nome do filtro; escolher aplica o filtro (o
 * formulário de filtros com `AutoApply` recebe o "change"). Teclado: setas,
 * Enter e Esc. `marker` dá nome aos atributos de teste (`data-<marker>`,
 * `-input`, `-option`). Quem usa passa `key={value}`: a página que volta com
 * outro filtro remonta o campo com ele.
 */
export function FilterCombobox({
  name,
  value,
  options,
  label,
  placeholder,
  emptyText,
  marker,
}: {
  name: string;
  value: string;
  options: FilterOption[];
  /** Nome do campo para leitor de tela. */
  label: string;
  placeholder: string;
  /** Nada encontrado. */
  emptyText: string;
  marker: string;
}) {
  const listId = useId();
  const hidden = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(value);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const open = query !== null;
  const current = options.find((o) => o.value === selected) ?? options[0];
  const shown = useMemo(() => {
    const q = fold(query ?? "");
    return q ? options.filter((o) => fold(o.label).includes(q)) : options;
  }, [options, query]);
  useEffect(() => {
    input.current?.setAttribute(`data-${marker}-ready`, "1");
  }, [marker]);

  const choose = (option: FilterOption) => {
    setQuery(null);
    setSelected(option.value);
    if (hidden.current && hidden.current.value !== option.value) {
      hidden.current.value = option.value;
      // Avisa o formulário de filtros (AutoApply) que o filtro mudou.
      hidden.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div
      className="relative"
      data-filter-combobox={marker}
      {...{ [`data-${marker}`]: "" }}
    >
      <input ref={hidden} type="hidden" name={name} defaultValue={value} />
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && shown[active] ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        value={open ? query : (current?.label ?? "")}
        onFocus={(e) => {
          setQuery("");
          setActive(0);
          // Mostra a lista inteira e deixa digitar por cima do nome.
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onBlur={() => setQuery(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setQuery("");
            setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (open) {
              e.preventDefault();
              const option = shown[active];
              if (option) {
                choose(option);
                input.current?.blur();
              }
            }
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
        className={cx(inputClass, "pr-8")}
        {...{ [`data-${marker}-input`]: "" }}
      />
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg"
        >
          {shown.length ? (
            shown.map((option, i) => (
              <li
                key={option.value || "all"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={option.value === selected}
                // O toque não tira o foco do campo (a lista não some antes
                // do clique, no mouse e no toque do iPad); o clique escolhe.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  choose(option);
                  input.current?.blur();
                }}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2",
                  i === active && "bg-brand-50 text-brand-800",
                  option.value === selected && "font-semibold",
                )}
                {...{ [`data-${marker}-option`]: option.value }}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.value === selected ? (
                  <span aria-hidden className="text-brand-700">
                    ✓
                  </span>
                ) : null}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-zinc-500" role="presentation">
              {emptyText}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
