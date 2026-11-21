"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx, inputClass, inputDenseClass } from "./ui";
import { HoverZoomPhoto } from "./hover-zoom-photo";
import { matchesWords, searchWords } from "@/lib/db/store";

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
  /** Código do parceiro no Sankhya (Wellmix; resumo abaixo do campo). */
  code?: string | null;
  /**
   * Cliente que representa um grupo econômico do Sankhya: quantas outras
   * empresas o grupo tem (docs/ECONOMIC_GROUPS.md); 0 ou ausente = nenhuma.
   */
  groupSize?: number;
  /**
   * Foto do item (produto: a primeira foto; dono, 19/11/2026): miniatura à
   * esquerda do nome, que amplia ao passar o mouse.
   */
  photoId?: string | null;
  /**
   * Grupo da opção na lista (lista local; ex.: "Do cliente" e "Outros
   * vendedores"): opções seguidas do mesmo grupo ficam sob um título.
   */
  group?: string | null;
  /** Opção que aparece mas não pode ser escolhida (ex.: BRASIL no TS). */
  disabled?: boolean;
  /** Texto a mais que a busca considera (não aparece). */
  keywords?: string | null;
}

/** Quantas opções da lista local aparecem de cada vez. */
const LOCAL_LIMIT = 60;

/**
 * Busca da lista local (dono, 21/11/2026): as mesmas regras da busca no
 * banco (palavras soltas, em qualquer ordem, sem acento nem caixa) sobre o
 * nome, o código, o texto ao lado e as palavras a mais de cada opção.
 */
export function filterSearchOptions(
  options: readonly SearchOption[],
  text: string,
): SearchOption[] {
  const words = searchWords(text);
  if (!words.length) return [...options];
  return options.filter((o) =>
    matchesWords(
      [o.code, o.name, o.hint, o.group, o.keywords].filter(Boolean).join(" "),
      words,
    ),
  );
}

/** "Código - Item" do escolhido (abaixo do campo; sem código, só o item). */
export const searchOptionSummary = (o: SearchOption) =>
  [o.code, o.name].filter(Boolean).join(" - ");

/**
 * Campo com busca (dono, 21/11/2026: o componente único dos formulários, no
 * lugar das listas de seleção simples). Dois modos:
 * - `endpoint`: busca no servidor (cadastros grandes, abaixo);
 * - `options`: a lista já está na tela; a busca é local, com as mesmas
 *   regras (palavras soltas, sem acento), e a lista abre ao entrar no campo.
 * Com foto, as opções mostram a miniatura; com `summary`, o escolhido
 * aparece abaixo do campo como "Código - Item".
 *
 * Busca no servidor, no lugar de uma lista de seleção com o
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
  options: localOptions,
  summary,
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
  onDeselect,
}: {
  /** Rota de busca, com os parâmetros fixos (ex.: `/api/products/search?scope=catalog`). */
  endpoint?: string;
  /** Lista local (sem `endpoint`): a busca filtra estas opções na tela. */
  options?: readonly SearchOption[];
  /** Mostra "Código - Item" do escolhido abaixo do campo. */
  summary?: boolean;
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
  /**
   * Avisado quando a escolha some porque a pessoa voltou a digitar (sem
   * escolher outra). O `onChoose` não é chamado nesse caso.
   */
  onDeselect?: () => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  // Fechar a lista ao sair do campo espera o clique na lista; voltar ao
  // campo antes disso cancela o fechamento (senão a lista aberta de novo
  // fechava sozinha).
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  };
  useEffect(() => cancelClose, []);
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
  const local = !endpoint;
  const unchanged = !!selected && selected.name === text;
  // Lista local: ao entrar no campo já escolhido, abre a lista inteira (como
  // uma lista de seleção); na busca no servidor, só depois de digitar.
  const showing = open && !disabled && (local || !unchanged);
  const searching = !local && showing && q.length >= 2;
  const filtered = local
    ? filterSearchOptions(localOptions ?? [], unchanged ? "" : q).slice(
        0,
        LOCAL_LIMIT,
      )
    : [];
  const options = local
    ? showing
      ? filtered
      : []
    : searching && result.q === q
      ? result.options
      : [];
  const loading = searching && result.q !== q;
  // Lista com fotos (produtos): cada opção tem a miniatura, com ou sem foto.
  const photos = options.some((o) => o.photoId !== undefined);
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
    if (!searching || !endpoint) return;
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
    if (option?.disabled) return;
    setSelected(option);
    setText(option?.name ?? "");
    setOpen(false);
    onChoose?.(option);
  };

  const hint = local
    ? options.length === 0
      ? labels.none
      : null
    : q.length < 2
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
            setActive(0);
            // Mudou o texto: a escolha anterior não vale mais.
            if (selected && e.target.value !== selected.name) {
              setSelected(null);
              onDeselect?.();
            }
            setOpen(true);
          }}
          onFocus={() => {
            cancelClose();
            setOpen(true);
          }}
          onBlur={() => {
            // Deixa o clique na lista acontecer antes de fechar.
            cancelClose();
            closing.current = setTimeout(() => {
              closing.current = null;
              setOpen(false);
            }, 150);
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
      {summary && selected ? (
        <p className="mt-1 text-xs text-zinc-600" {...data("-summary")}>
          <span className="font-medium text-zinc-800">
            {searchOptionSummary(selected)}
          </span>
        </p>
      ) : null}
      {showing ? (
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
            options.map((option, i) => [
              option.group && option.group !== options[i - 1]?.group ? (
                <li
                  key={`g:${option.group}:${i}`}
                  role="presentation"
                  className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
                  {...data("-group")}
                >
                  {option.group}
                </li>
              ) : null,
              <li
                key={option.id}
                role="option"
                aria-selected={i === active}
                aria-disabled={option.disabled || undefined}
                className={cx(
                  option.disabled && "cursor-not-allowed opacity-50",
                  // O texto ao lado do nome (tipo da empresa, código e CNPJ)
                  // desce para baixo do nome quando não cabe: o nome nunca
                  // fica espremido letra por letra.
                  "flex cursor-pointer justify-between gap-x-3 gap-y-0.5 px-3 py-1.5",
                  photos ? "items-center" : "flex-wrap items-baseline",
                  i === active ? "bg-brand-50 text-brand-800" : "text-zinc-800",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(option)}
                {...data("-option", option.id)}
              >
                {photos ? (
                  <HoverZoomPhoto
                    photoId={option.photoId ?? null}
                    className="self-center"
                  />
                ) : null}
                <span className="min-w-0 flex-[1_1_10rem] break-words">
                  {local && option.code
                    ? searchOptionSummary(option)
                    : option.name}
                </span>
                {option.hint ? (
                  <span
                    className="max-w-full shrink-0 break-words text-xs text-zinc-500"
                    {...data("-option-hint")}
                  >
                    {option.hint}
                  </span>
                ) : null}
              </li>,
            ])
          )}
        </ul>
      ) : null}
    </div>
  );
}
