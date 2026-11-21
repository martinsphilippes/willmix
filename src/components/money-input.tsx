"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CURRENCIES, isCurrency, type Currency } from "@/lib/currencies";
import {
  formatMoneyDigits,
  moneyDigits,
  moneyDigitsOfPaste,
  moneyDigitsOfValue,
  moneySeparators,
  moneyValueOfDigits,
} from "@/lib/money-mask";
import { CURRENCY_SYMBOL } from "@/lib/workflow/money";
import { cx, inputClass, inputDenseClass } from "./ui";
import { FxNoteLine, prefetchFx, useFxConversion } from "./fx-conversion";

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
 *
 * Com `autoDecimal` (dono, 20/11/2026; cotação de compra), a digitação é de
 * caixa registradora: só números, a vírgula das casas entra sozinha (4000 =
 * 40,00) e o separador é o da moeda (Yuan e Dólar com ponto, Real e Euro com
 * vírgula; `src/lib/money-mask.ts`). Sem ele, nada muda: digitação livre,
 * formatada ao sair do campo no idioma de quem usa.
 *
 * Trocar a moeda converte o valor (dono, 21/11/2026): pelo câmbio do dia do
 * portal, na hora, com o aviso "Convertido de US$ 1,0194 · câmbio de
 * 21/11/2026" e o "Manter" (o número de antes na moeda nova). Vale para o
 * seletor próprio (`currencyName`) e para o seguido (`watchField`); a moeda
 * fixa (`currency`) é trocada pela tela, que converte se quiser
 * (`src/components/fx-conversion.tsx`).
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
  size = "sm",
  id,
  autoDecimal = false,
  form,
  error = false,
  ariaLabel,
  inputData,
}: {
  /** Só números, a vírgula das casas entra sozinha, separador da moeda. */
  autoDecimal?: boolean;
  /** O formulário do campo, quando ele fica fora do <form> (atributo `form`). */
  form?: string;
  /** Campo apontado (falta preencher): borda e fundo vermelhos. */
  error?: boolean;
  /** Nome do campo visível para leitores de tela. */
  ariaLabel?: string;
  /** Atributos data-* a mais no campo visível (testes da tela). */
  inputData?: Record<`data-${string}`, string>;
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
  // Valor numérico vindo do sistema vira texto com as casas do campo
  // ("350.39"): nunca notação científica (5.6e-14) nem um número com 3 casas
  // que a leitura do texto tomaria por milhar.
  const [rawState, setRaw] = useState(
    normalizeRaw(
      defaultAmount == null
        ? ""
        : typeof defaultAmount === "number"
          ? Number.isFinite(defaultAmount)
            ? defaultAmount.toFixed(decimals)
            : ""
          : defaultAmount,
      locale,
      decimals,
    ),
  );
  const [textState, setText] = useState(() =>
    formatOrRaw(rawState, decimals, locale),
  );
  // Caixa registradora (`autoDecimal`): os números digitados ("4000").
  const [digitsState, setDigits] = useState(() =>
    moneyDigitsOfValue(rawState, decimals),
  );
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const fx = useFxConversion({
    decimals,
    format: (n, c) =>
      `${symbolOf(c)} ${formatPlain(n, decimals, locale)}`.trim(),
  });
  // Controlado: o valor vem de fora; fora do foco, a tela mostra formatado.
  const raw = value ?? rawState;
  const freeText =
    value !== undefined && !focused
      ? formatOrRaw(value, decimals, locale)
      : textState;
  const digits = !autoDecimal
    ? ""
    : value !== undefined
      ? moneyDigitsOfValue(value, decimals)
      : digitsState;

  // Moeda fixa (sem seletor próprio nem campo seguido): a de agora, para o
  // símbolo acompanhar quando a tela troca a moeda.
  const code = watchField
    ? watched
    : currencyName
      ? ownCurrency
      : (currency ?? defaultCurrency ?? "").toUpperCase();
  const symbol = symbolOf(code);
  const legacy =
    ownCurrency && !(CURRENCIES as readonly string[]).includes(ownCurrency)
      ? ownCurrency
      : null;
  const sep = moneySeparators(code);
  const text = autoDecimal
    ? formatMoneyDigits(digits, sep, decimals)
    : freeText;
  const submitted = autoDecimal ? moneyValueOfDigits(digits, decimals) : raw;
  const amountNumber = submitted === "" ? NaN : Number(submitted);
  const amount = Number.isFinite(amountNumber) ? amountNumber : null;

  /** Valor posto pela conversão (ou pelo "Manter"): campo e valor enviado. */
  function setAmount(n: number) {
    const normalized = n.toFixed(decimals);
    if (autoDecimal) setDigits(moneyDigitsOfValue(normalized, decimals));
    else {
      setRaw(normalized);
      setText(formatPlain(n, decimals, locale));
    }
    setInvalid(false);
    onValueChange?.(normalized);
  }

  // Troca da moeda seguida (`watchField`): o ouvinte do seletor chama sempre
  // a conversão com o valor de agora.
  const onCurrency = useRef<(from: string, to: string) => void>(() => {});
  useEffect(() => {
    onCurrency.current = (from, to) => fx.convert(from, to, amount, setAmount);
  });

  // Segue o seletor de moeda já existente no formulário (a leitura inicial
  // é adiada: o campo só existe depois de montar).
  useEffect(() => {
    if (!watchField) return;
    const field = inputRef.current?.form?.elements.namedItem(watchField);
    if (!(
      field instanceof HTMLSelectElement || field instanceof HTMLInputElement
    ))
      return;
    // A primeira leitura só mostra a moeda; as trocas depois dela convertem o
    // valor ("change" e "input" chegam juntos: a segunda já não muda nada).
    let last = "";
    const read = () => {
      const next = field.value.toUpperCase();
      if (next === last) return;
      const before = last;
      last = next;
      setWatched(next);
      if (before) onCurrency.current(before, next);
    };
    const first = setTimeout(read, 0);
    field.addEventListener("change", read);
    field.addEventListener("input", read);
    field.addEventListener("focus", prefetchFx);
    return () => {
      clearTimeout(first);
      field.removeEventListener("change", read);
      field.removeEventListener("input", read);
      field.removeEventListener("focus", prefetchFx);
    };
  }, [watchField]);

  /** Caixa registradora: novos números → campo e valor. */
  function typeDigits(next: string) {
    fx.clear();
    setDigits(next);
    setInvalid(false);
    onValueChange?.(moneyValueOfDigits(next, decimals));
  }

  /**
   * Caixa registradora: o cursor fica no fim (o número entra pela direita).
   * Uma seleção feita pela pessoa (para apagar tudo) fica como está.
   */
  function caretToEnd(event: MouseEvent<HTMLInputElement>) {
    if (!autoDecimal) return;
    const el = event.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    requestAnimationFrame(() => {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }

  function update(next: string) {
    fx.clear();
    setText(next);
    setInvalid(false);
    const normalized = normalizeRaw(next, locale, decimals);
    setRaw(normalized);
    onValueChange?.(normalized);
  }

  function blur() {
    setFocused(false);
    // Caixa registradora: o campo já está formatado a cada número.
    if (autoDecimal) return;
    if (!text.trim()) {
      update("");
      return;
    }
    // Mesma leitura da digitação (no idioma do usuário): "1,234.56" em inglês
    // e "1.234,56" em português dão 1234.56 também ao sair do campo.
    const n = parseMoneyText(text, locale, decimals);
    if (n === null) {
      setInvalid(true);
      return;
    }
    setText(formatPlain(n, decimals, locale));
    const normalized = n.toFixed(decimals);
    setRaw(normalized);
    // Só avisa quando o número mudou: entrar e sair do campo sem editar não
    // transforma o valor calculado (calculadora) em valor digitado.
    if (Number(normalized) !== Number(raw)) onValueChange?.(normalized);
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
          form={form}
          value={ownCurrency}
          onFocus={prefetchFx}
          onChange={(e) => {
            const next = e.target.value;
            fx.convert(ownCurrency, next, amount, setAmount);
            setOwnCurrency(next);
          }}
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
          "inline-flex min-w-0 flex-1 items-center border shadow-sm focus-within:ring-2 focus-within:ring-brand-200",
          size === "sm" ? "min-h-8 rounded-md" : "rounded-lg",
          invalid || error ? "border-red-400" : "border-zinc-300",
          disabled ? "bg-zinc-50 opacity-70" : error ? "bg-red-50" : "bg-white",
        )}
      >
        {symbol ? (
          <span
            data-money-symbol=""
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
          {...inputData}
          type="text"
          inputMode={autoDecimal ? "numeric" : "decimal"}
          aria-label={ariaLabel}
          required={required}
          disabled={disabled}
          placeholder={
            placeholder ??
            (autoDecimal
              ? formatMoneyDigits("0", sep, decimals)
              : formatPlain(0, decimals, locale))
          }
          value={text}
          onFocus={() => {
            if (value !== undefined && !autoDecimal)
              setText(formatOrRaw(value, decimals, locale));
            setFocused(true);
          }}
          onClick={caretToEnd}
          onChange={(e) =>
            autoDecimal
              ? typeDigits(moneyDigits(e.target.value))
              : update(e.target.value)
          }
          onPaste={(e) => {
            if (!autoDecimal) return;
            // Colado vale como está escrito ("40,50" = 40,50; "4000" = 4.000).
            const pasted = e.clipboardData.getData("text");
            if (!pasted.trim()) return;
            e.preventDefault();
            typeDigits(moneyDigitsOfPaste(pasted, decimals));
          }}
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
        <input
          type="hidden"
          name={name}
          form={form}
          value={submitted}
          disabled={disabled}
        />
      ) : null}
      <FxNoteLine note={fx.note} onKeep={fx.keep} />
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
 * Só um tipo de separador:
 * - idioma de vírgula decimal (pt-BR): vírgula é decimal; vários pontos são milhar ("1.234.567");
 *   um ponto só é decimal ("2.35"), salvo em campo inteiro (`decimals` 0), onde é milhar;
 * - idioma de ponto decimal (en-US, zh-CN): vírgula é milhar, salvo vírgula única seguida de 1–2
 *   dígitos (hábito brasileiro: "1,5" → 1.5) fora de campo inteiro.
 */
export function normalizeMoneyText(
  text: string,
  locale = "pt-BR",
  decimals = 2,
) {
  const s = text.replace(/\s|[A-Za-z$€¥]/g, "");
  if (!s) return "";
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0)
    return lastComma > lastDot
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  if (decimalSeparator(locale) === ",") {
    if (lastComma >= 0) return s.replace(",", ".");
    const dots = s.split(".").length - 1;
    // Ponto sozinho com 3 dígitos depois ("1.000", "12.500") num valor de até
    // 2 casas só pode ser milhar (antes "1.000" virava 1); "2.35" fica 2,35.
    const grouped = /^[1-9]\d{0,2}\.\d{3}$/.test(s) && decimals < 3;
    return dots > 1 || (dots === 1 && (decimals === 0 || grouped))
      ? s.replace(/\./g, "")
      : s;
  }
  if (lastComma >= 0 && decimals > 0 && /^[^,]*,\d{1,2}$/.test(s))
    return s.replace(",", ".");
  return s.replace(/,/g, "");
}

/** Texto do campo → número (arredondado a `decimals`); inválido ou negativo → null. */
export function parseMoneyText(
  text: string,
  locale = "pt-BR",
  decimals = 2,
): number | null {
  const normalized = normalizeMoneyText(text, locale, decimals);
  if (!normalized) return null;
  const n = Number(normalized);
  const k = 10 ** decimals;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * k) / k : null;
}

const normalizeRaw = normalizeMoneyText;

/** Exportado para os testes de ida e volta (formatar → ler). */
export { formatPlain as formatMoneyText };

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
