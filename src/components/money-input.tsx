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
  locale = "pt-BR",
  className,
  selectClassName,
  size = "md",
  id,
}: {
  /** Tag Intl do idioma: separadores de milhar e decimal (pt-BR, en-US, zh-CN). */
  locale?: string;
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
    normalizeRaw(defaultAmount == null ? "" : String(defaultAmount), locale),
  );
  const [textState, setText] = useState(() =>
    formatOrRaw(rawState, decimals, locale),
  );
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Controlado: o valor vem de fora; fora do foco, a tela mostra formatado.
  const raw = value ?? rawState;
  const text =
    value !== undefined && !focused
      ? formatOrRaw(value, decimals, locale)
      : textState;

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
    const normalized = normalizeRaw(next, locale);
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
    setText(formatPlain(n, decimals, locale));
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
          size === "sm" ? "min-h-8 rounded-md" : "rounded-lg",
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
          placeholder={
            placeholder ?? (decimals === 2 ? formatPlain(0, 2, locale) : "0")
          }
          value={text}
          onFocus={() => {
            if (value !== undefined)
              setText(formatOrRaw(value, decimals, locale));
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

/** Separador decimal do idioma ("," em pt-BR, "." em en-US e zh-CN). */
function decimalSeparator(locale: string) {
  try {
    return (
      new Intl.NumberFormat(locale)
        .formatToParts(1.1)
        .find((p) => p.type === "decimal")?.value ?? "."
    );
  } catch {
    return ".";
  }
}

/**
 * Texto digitado → número normalizado com ponto; vazio fica vazio.
 * Com ponto e vírgula juntos, o último é o decimal ("1.234,56" e "1,234.56" → 1234.56) em qualquer idioma.
 * Só um separador: no idioma de vírgula decimal (pt-BR) a vírgula é decimal e o ponto fica como está;
 * no idioma de ponto decimal (en-US, zh-CN) a vírgula é milhar, salvo vírgula única seguida de 1–2 dígitos
 * (hábito brasileiro: "1,5" → 1.5).
 */
export function normalizeMoneyText(text: string, locale = "pt-BR") {
  const s = text.replace(/\s|[A-Za-z$€¥]/g, "");
  if (!s) return "";
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0)
    return lastComma > lastDot
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  if (decimalSeparator(locale) === ",")
    return s.includes(",") ? s.replace(",", ".") : s;
  if (lastComma >= 0 && /^[^,]*,\d{1,2}$/.test(s)) return s.replace(",", ".");
  return s.replace(/,/g, "");
}

const normalizeRaw = normalizeMoneyText;

/** 1234.5 → "1.234,50" (sem símbolo; o símbolo fica fora do campo). */
function formatPlain(n: number, decimals: number, locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
  }).format(n);
}

function formatOrRaw(raw: string, decimals: number, locale = "pt-BR") {
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? formatPlain(n, decimals, locale) : raw;
}
