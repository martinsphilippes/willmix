"use client";

import { useState } from "react";

/**
 * Quantidade com − e + (como nas lojas), aceitando também digitar. Abaixo do
 * pedido mínimo mostra o aviso na hora (não bloqueia: a Wellmix confirma).
 */
export function QuantityStepper({
  name = "quantity",
  defaultValue,
  moq,
  label,
  decreaseLabel,
  increaseLabel,
  belowMoqText,
  id,
}: {
  name?: string;
  defaultValue: number;
  moq: number | null;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** Aviso já traduzido para quantidade abaixo do mínimo. */
  belowMoqText: string;
  id: string;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const n = Number(value);
  const step = (delta: number) => {
    const current = Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
    setValue(String(Math.max(1, current + delta)));
  };
  // Passo de 10% do mínimo (pelo menos 1): perto do jeito de comprar no atacado.
  const delta = moq && moq >= 10 ? Math.max(1, Math.round(moq / 10)) : 1;
  const below =
    moq !== null && moq > 0 && Number.isFinite(n) && n > 0 && n < moq;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium text-zinc-700"
      >
        {label}
      </label>
      <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <button
          type="button"
          onClick={() => step(-delta)}
          aria-label={decreaseLabel}
          className="px-3 text-lg font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          −
        </button>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 border-x border-zinc-200 py-2 text-center text-base font-semibold tabular-nums text-zinc-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          data-quantity-input=""
        />
        <button
          type="button"
          onClick={() => step(delta)}
          aria-label={increaseLabel}
          className="px-3 text-lg font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          +
        </button>
      </div>
      {below ? (
        <p className="mt-1.5 text-xs text-amber-800" data-below-moq="">
          {belowMoqText}
        </p>
      ) : null}
    </div>
  );
}
