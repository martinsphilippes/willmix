"use client";

import { useState } from "react";
import type { Currency } from "@/lib/currencies";
import { CURRENCIES, CURRENCY_SYMBOL, parseAmount } from "@/lib/workflow/money";
import { Select, cx } from "./ui";

/**
 * Valor em dinheiro para requisitos de custo: moeda à esquerda (Real, Yuan,
 * Dólar, Euro) e valor com o símbolo da moeda escolhida na frente. Ao sair do
 * campo o número é formatado (1.234,56). O formulário recebe `currency` e
 * `amount`; a Server Action monta o valor guardado.
 */
export function MoneyInput({
  currencyLabels,
  defaultCurrency = "BRL",
  defaultAmount,
  required,
}: {
  currencyLabels: Record<Currency, string>;
  defaultCurrency?: Currency;
  defaultAmount?: number | null;
  required?: boolean;
}) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [amount, setAmount] = useState(
    defaultAmount != null ? formatPlain(defaultAmount) : "",
  );
  const [invalid, setInvalid] = useState(false);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Select
        name="currency"
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        className="w-auto"
        aria-label="Moeda"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {currencyLabels[c]}
          </option>
        ))}
      </Select>
      <span
        className={cx(
          "inline-flex items-center rounded-lg border bg-white shadow-sm focus-within:ring-2 focus-within:ring-brand-200",
          invalid ? "border-red-400" : "border-zinc-300",
        )}
      >
        <span className="pl-3 pr-1 text-sm font-semibold text-zinc-500">
          {CURRENCY_SYMBOL[currency]}
        </span>
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          required={required}
          placeholder="0,00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => {
            if (!amount.trim()) return;
            const n = parseAmount(amount);
            if (n === null) setInvalid(true);
            else setAmount(formatPlain(n));
          }}
          className="w-32 rounded-r-lg border-0 bg-transparent py-2 pr-3 text-right text-sm tabular-nums focus:outline-none"
        />
      </span>
    </span>
  );
}

/** 1234.5 → "1.234,50" (sem símbolo; o símbolo fica fora do campo). */
function formatPlain(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
