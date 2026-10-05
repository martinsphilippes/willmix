"use client";

import { useEffect, useRef, useState } from "react";
import { CURRENCIES, isCurrency, type Currency } from "@/lib/currencies";
import { CURRENCY_SYMBOL, parseAmount } from "@/lib/workflow/money";
import { cx, inputClass, inputDenseClass } from "./ui";

/**
 * Campo de dinheiro, o mesmo em todo o portal: símbolo da moeda na frente do
 * valor (R$, ¥, US$, €) e número formatado ao sair do campo (1.234,56).
 *
 * A moeda vem de um destes três jeitos:
 * - `currencyName`: o campo mostra o próprio seletor de moeda (com `labels`);
 * - `watchField`: segue um seletor de moeda que já existe no mesmo <form>;
 * - `currency`: moeda fixa (ex.: venda sempre em Real).
 *
 * O que vai ao servidor é um campo oculto `name` com o número normalizado
 * ("1234.56"), então as Server Actions atuais (`num`) seguem iguais. O campo
 * visível tem `data-money={name}` (testes). Com `value`/`onValueChange` o
 * campo fica controlado (calculadora do valor ao cliente).
 */
export function MoneyInput({
  name,
  currency,
  currencyName,
  watchField,
  labels,
  allowEmptyCurrency,
  defaultCurrency = "BRL",
  defaultAmount,
  value,
  onValueChange,
  required,
  disabled,
  decimals = 2,
  placeholder,
  className,
  selectClassName,
  size = "md",
  id,
}: {
  name?: string;
  currency?: string | null;
  currencyName?: string;
  watchField?: string;
  labels?: Record<string, string>;
  allowEmptyCurrency?: boolean;
  defaultCurrency?: string | null;
  defaultAmount?: number | string | null;
  value?: string;
  onValueChange?: (raw: string) => void;
  required?: boolean;
  disabled?: boolean;
  decimals?: number;
  placeholder?: string;
  className?: string;
  /** "sm": campo compacto (formulários densos). */
  size?: "md" | "sm";
  selectClassName?: string;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ownCurrency, setOwnCurrency] = useState(
    (currency ?? defaultCurrency ?? "").toUpperCase(),
  );
  const [watched, setWatched] = useState("");
  const [rawState, setRaw] = useState(
    normalizeRaw(defaultAmount == null ? "" : String(defaultAmount)),
  );
  const [textState, setText] = useState(() => formatOrRaw(rawState, decimals));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Controlado: o valor vem de fora; fora do foco, a tela mostra formatado.
  const raw = value ?? rawState;
  const text =
    value !== undefined && !focused ? formatOrRaw(value, decimals) : textState;

  // Segue o seletor de moeda já existente no formulário (a leitura inicial
  // é adiada: o campo só existe depois de montar).
  useEffect(() => {
    if (!watchField) return;
    const field = inputRef.current?.form?.elements.namedItem(watchField);
    if (!(
      field instanceof HTMLSelectElement || field instanceof HTMLInputElement
    ))
      return;
    const read = () => setWatched(field.value.toUpperCase());
    const first = setTimeout(read, 0);
    field.addEventListener("change", read);
    field.addEventListener("input", read);
    return () => {
      clearTimeout(first);
      field.removeEventListener("change", read);
      field.removeEventListener("input", read);
    };
  }, [watchField]);

  const code = watchField ? watched : ownCurrency;
  const symbol = symbolOf(code);
  const legacy =
    ownCurrency && !(CURRENCIES as readonly string[]).includes(ownCurrency)
      ? ownCurrency
      : null;

  function update(next: string) {
    setText(next);
    setInvalid(false);
    const normalized = normalizeRaw(next);
    setRaw(normalized);
    onValueChange?.(normalized);
  }

  function blur() {
    setFocused(false);
    if (!text.trim()) {
      update("");
      return;
    }
    const n = parseAmount(text, decimals);
    if (n === null) {
      setInvalid(true);
      return;
    }
    setText(formatPlain(n, decimals));
    const normalized = n.toFixed(decimals);
    setRaw(normalized);
    onValueChange?.(normalized);
  }

  return (
    <span
      className={cx(
        "inline-flex max-w-full flex-wrap items-center gap-2",
        className,
      )}
    >
      {currencyName ? (
        <select
          name={currencyName}
          value={ownCurrency}
          onChange={(e) => setOwnCurrency(e.target.value)}
          disabled={disabled}
          required={required && !allowEmptyCurrency}
          className={cx(
            size === "sm" ? inputDenseClass : inputClass,
            "w-auto",
            selectClassName,
          )}
          aria-label={labels?.currency ?? "Moeda"}
        >
          {allowEmptyCurrency ? <option value="">—</option> : null}
          {legacy ? <option value={legacy}>{legacy}</option> : null}
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {labels?.[c] ?? c}
            </option>
          ))}
        </select>
      ) : null}
      <span
        className={cx(
          "inline-flex min-w-0 flex-1 items-center border bg-white shadow-sm focus-within:ring-2 focus-within:ring-brand-200",
          size === "sm" ? "rounded-md" : "rounded-lg",
          invalid ? "border-red-400" : "border-zinc-300",
          disabled && "bg-zinc-50 opacity-70",
        )}
      >
        {symbol ? (
          <span
            className={cx(
              "shrink-0 font-semibold text-zinc-500",
              size === "sm" ? "pl-2 pr-1 text-xs" : "pl-3 pr-1 text-sm",
            )}
          >
            {symbol}
          </span>
        ) : (
          <span className={size === "sm" ? "pl-2" : "pl-3"} />
        )}
        <input
          ref={inputRef}
          id={id}
          data-money={name}
          type="text"
          inputMode="decimal"
          required={required}
          disabled={disabled}
          placeholder={placeholder ?? (decimals === 2 ? "0,00" : "0")}
          value={text}
          onFocus={() => {
            if (value !== undefined) setText(formatOrRaw(value, decimals));
            setFocused(true);
          }}
          onChange={(e) => update(e.target.value)}
          onBlur={blur}
          className={cx(
            "w-full border-0 bg-transparent text-right tabular-nums focus:outline-none disabled:cursor-not-allowed",
            size === "sm"
              ? "min-w-20 rounded-r-md py-1 pr-2 text-[13px] leading-5"
              : "min-w-24 rounded-r-lg py-2 pr-3 text-sm",
          )}
        />
      </span>
      {name ? (
        <input type="hidden" name={name} value={raw} disabled={disabled} />
      ) : null}
    </span>
  );
}

function symbolOf(code: string) {
  const c = code === "RMB" ? "CNY" : code;
  if (!c) return "";
  return isCurrency(c) ? CURRENCY_SYMBOL[c as Currency] : c;
}

/** Texto digitado → número normalizado com ponto ("1.234,56" → "1234.56"); vazio fica vazio. */
function normalizeRaw(text: string) {
  const s = text.replace(/\s|[A-Za-z$€¥]/g, "");
  if (!s) return "";
  return s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
}

/** 1234.5 → "1.234,50" (sem símbolo; o símbolo fica fora do campo). */
function formatPlain(n: number, decimals: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
  }).format(n);
}

function formatOrRaw(raw: string, decimals: number) {
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? formatPlain(n, decimals) : raw;
}
