"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx, inputClass, inputDenseClass } from "./ui";

/** Textos do campo (já no idioma de quem vê). */
export interface SearchPickerLabels {
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

/** Uma opção da busca: o valor gravado e o texto mostrado. */
export interface SearchOption {
  id: string;
  name: string;
  /** Texto curto ao lado do nome (ex.: o tipo da empresa). */
  hint?: string | null;
}

/**
 * Campo com busca no servidor, no lugar de uma lista de seleção com o
 * cadastro inteiro (auditoria de performance, 14/11/2026): com a carga do
 * Sankhya são ~26 mil clientes, ~5,7 mil fornecedores e ~17 mil produtos, e
 * a página mandava todos ao navegador. Busca a partir de 2 letras em
 * `endpoint` (o texto vai em `q`; a resposta é `{ options }`) e grava o valor
 * escolhido num campo escondido com o mesmo `name` do antigo <select>: os
 * formulários e as ações continuam iguais.
 *
 * `marker` dá nome aos atributos de teste (`data-<marker>`,
 * `data-<marker>-input`, `-option`, `-hint`, `-clear`).
 */
export function SearchPicker({
  endpoint,
  marker,
  kind,
  name,
  inputId,
  initial,
  required,
  disabled,
  dense,
  className,
  inputClassName,
  ariaLabel,
  labels,
  onChoose,
}: {
  /** Rota de busca, com os parâmetros fixos (ex.: `/api/products/search?scope=catalog`). */
  endpoint: string;
  /** Nome dos atributos de teste (ex.: "party-picker"). */
  marker: string;
  /** Valor de `data-<marker>` (ex.: o tipo de parceiro). */
  kind: string;
  name?: string;
  /** Id do campo de texto (para o <label htmlFor>). */
  inputId?: string;
  initial?: SearchOption | null;
  required?: boolean;
  disabled?: boolean;
  dense?: boolean;
  /** Classes do bloco (largura, margem). */
  className?: string;
  /** Classes a mais no campo de texto (ex.: o campo maior do celular). */
  inputClassName?: string;
  ariaLabel?: string;
  labels: SearchPickerLabels;
  /** Avisado a cada escolha (ex.: preencher a ficha do produto). */
  onChoose?: (option: SearchOption | null) => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SearchOption | null>(
    initial ?? null,
  );
  const [text, setText] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  // Última resposta da busca (com o texto buscado): a lista e o "buscando"
  // saem dela, sem estado extra no efeito.
  const [result, setResult] = useState<{ q: string; options: SearchOption[] }>({
    q: "",
    options: [],
  });
  const [active, setActive] = useState(0);
  const q = text.trim();
  const searching =
    open && !disabled && q.length >= 2 && !(selected && selected.name === text);
  const options = searching && result.q === q ? result.options : [];
  const loading = searching && result.q !== q;
  const data = (suffix: string, value: string | boolean = true) => ({
    [`data-${marker}${suffix}`]: value,
  });

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
        const join = endpoint.includes("?") ? "&" : "?";
        const url = `${endpoint}${join}q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: controller.signal });
        const body = (await res.json()) as { options?: SearchOption[] };
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
  }, [searching, q, endpoint]);

  const choose = (option: SearchOption | null) => {
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
    <div className={cx("relative min-w-0", className)} {...data("", kind)}>
      {name ? (
        <input type="hidden" name={name} value={selected?.id ?? ""} />
      ) : null}
      <div className="flex items-center gap-1">
        <input
          ref={input}
          id={inputId}
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
          className={cx(
            dense ? inputDenseClass : inputClass,
            "min-w-0 flex-1",
            inputClassName,
          )}
          {...data("-input")}
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
            {...data("-clear")}
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
            <li className="px-3 py-2 text-zinc-500" {...data("-hint")}>
              {hint}
            </li>
          ) : (
            options.map((option, i) => (
              <li
                key={option.id}
                role="option"
                aria-selected={i === active}
                className={cx(
                  "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5",
                  i === active ? "bg-brand-50 text-brand-800" : "text-zinc-800",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(option)}
                {...data("-option", option.id)}
              >
                <span className="min-w-0 break-words">{option.name}</span>
                {option.hint ? (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {option.hint}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
