"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx, inputClass, inputDenseClass } from "./ui";

/** Textos do campo (já no idioma de quem vê). */
export interface PartyPickerLabels {
  /** Dentro do campo vazio ("Digite para buscar"). */
  placeholder: string;
  /** Menos de 2 letras digitadas. */
  typeMore: string;
  /** Nada encontrado. */
  none: string;
  /** Buscando. */
  loading: string;
  /** Digitou sem escolher da lista (campo obrigatório). */
  pick: string;
  /** Botão que limpa a escolha. */
  clear: string;
}

interface Option {
  id: string;
  name: string;
}

/**
 * Campo de cliente/fornecedor com busca: com a carga do Sankhya são ~26 mil
 * clientes e ~5,7 mil fornecedores, que não cabem numa lista de seleção (a
 * página mandava todos ao navegador). Busca pelo nome a partir de 2 letras
 * (/api/parties/search) e grava o id num campo escondido com o mesmo `name`
 * do antigo <select>: os formulários e as ações continuam iguais.
 */
export function PartyPicker({
  name,
  type,
  initial,
  required,
  disabled,
  activeOnly,
  dense,
  className,
  ariaLabel,
  labels,
  onChoose,
}: {
  name?: string;
  type: "customer" | "supplier";
  initial?: Option | null;
  required?: boolean;
  disabled?: boolean;
  /** Só parceiros ativos. */
  activeOnly?: boolean;
  dense?: boolean;
  className?: string;
  ariaLabel?: string;
  labels: PartyPickerLabels;
  /** Avisado a cada escolha (ex.: incluir a empresa numa lista). */
  onChoose?: (option: Option | null) => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Option | null>(initial ?? null);
  const [text, setText] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  // Última resposta da busca (com o texto buscado): a lista e o "buscando"
  // saem dela, sem estado extra no efeito.
  const [result, setResult] = useState<{ q: string; options: Option[] }>({
    q: "",
    options: [],
  });
  const [active, setActive] = useState(0);
  const q = text.trim();
  const searching =
    open && !disabled && q.length >= 2 && !(selected && selected.name === text);
  const options = searching && result.q === q ? result.options : [];
  const loading = searching && result.q !== q;

  // Obrigatório: digitar sem escolher da lista não vale.
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected ? (text ? labels.pick : "") : "",
    );
  }, [required, selected, text, labels.pick]);

  // Busca com espera curta (não a cada letra); só a última resposta vale.
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `/api/parties/search?type=${type}&q=${encodeURIComponent(q)}${activeOnly ? "&active=1" : ""}`;
        const res = await fetch(url, { signal: controller.signal });
        const body = (await res.json()) as { options?: Option[] };
        setResult({ q, options: body.options ?? [] });
        setActive(0);
      } catch {
        // Cancelada (nova letra) ou sem rede: fica "buscando" até a próxima.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searching, q, type, activeOnly]);

  const choose = (option: Option | null) => {
    setSelected(option);
    setText(option?.name ?? "");
    setOpen(false);
    onChoose?.(option);
  };

  const hint =
    q.length < 2
      ? labels.typeMore
      : loading
        ? labels.loading
        : options.length === 0
          ? labels.none
          : null;

  return (
    <div className={cx("relative min-w-0", className)} data-party-picker={type}>
      {name ? (
        <input type="hidden" name={name} value={selected?.id ?? ""} />
      ) : null}
      <div className="flex items-center gap-1">
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={text}
          placeholder={labels.placeholder}
          className={cx(dense ? inputDenseClass : inputClass, "min-w-0 flex-1")}
          data-party-picker-input
          onChange={(e) => {
            setText(e.target.value);
            // Mudou o texto: a escolha anterior não vale mais.
            if (selected && e.target.value !== selected.name) setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Deixa o clique na lista acontecer antes de fechar.
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                Math.min(i + 1, Math.max(options.length - 1, 0)),
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {selected && !disabled && !required ? (
          <button
            type="button"
            onClick={() => choose(null)}
            className="shrink-0 rounded px-1.5 text-sm text-zinc-500 hover:text-zinc-800"
            aria-label={labels.clear}
            title={labels.clear}
            data-party-picker-clear
          >
            ×
          </button>
        ) : null}
      </div>
      {open && !disabled && !(selected && selected.name === text) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
        >
          {hint ? (
            <li className="px-3 py-2 text-zinc-500" data-party-picker-hint>
              {hint}
            </li>
          ) : (
            options.map((option, i) => (
              <li
                key={option.id}
                role="option"
                aria-selected={i === active}
                className={cx(
                  "cursor-pointer px-3 py-1.5",
                  i === active ? "bg-brand-50 text-brand-800" : "text-zinc-800",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(option)}
                data-party-picker-option={option.id}
              >
                {option.name}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
