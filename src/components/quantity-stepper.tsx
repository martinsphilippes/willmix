"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { cx } from "./ui";

/** Teto do carrinho (o mesmo do serviço). */
const MAX = 10_000_000;

/**
 * Quantidade com − e + (de um em um) e a caixa para digitar o total. Nunca
 * fica abaixo do pedido mínimo: começa nele, o − não desce dele e um valor
 * menor digitado volta ao mínimo ao sair do campo (enquanto se digita, o
 * aviso diz qual é o mínimo). Sem mínimo, o piso é 1. O aviso flutua acima
 * da caixa, sem empurrar o que vem abaixo: assim o botão logo embaixo não
 * muda de lugar quando o aviso some ao sair do campo (o clique não se perde).
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
  compact = false,
  onValueChange,
}: {
  name?: string;
  defaultValue: number;
  moq: number | null;
  /** Rótulo visível (sem ele, só para leitores de tela). */
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** Aviso já traduzido para quantidade digitada abaixo do mínimo. */
  belowMoqText: string;
  id: string;
  /** Cartão da vitrine: sem rótulo visível, ocupa a largura do cartão. */
  compact?: boolean;
  /** Quantidade que vai no formulário (já ajustada ao mínimo). */
  onValueChange?: (quantity: number) => void;
}) {
  const min = moq && moq > 0 ? Math.round(moq) : 1;
  const clamp = (n: number) =>
    Math.min(
      MAX,
      Math.max(min, Number.isFinite(n) && n > 0 ? Math.round(n) : min),
    );
  const [value, setValue] = useState(String(clamp(defaultValue)));
  const typed = Number(value);
  const current = clamp(typed);
  const set = (next: number) => {
    const v = clamp(next);
    setValue(String(v));
    onValueChange?.(v);
  };
  const below = Number.isFinite(typed) && typed > 0 && typed < min;
  const button =
    "shrink-0 font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-white";
  return (
    <div className={cx("relative", compact && "w-full")}>
      <label
        htmlFor={id}
        className={cx(
          "mb-1 block text-xs font-medium text-zinc-700",
          compact && "sr-only",
        )}
      >
        {label}
      </label>
      <div
        className={cx(
          "flex items-stretch overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100",
          compact ? "w-full" : "inline-flex",
        )}
        data-quantity-stepper=""
      >
        <button
          type="button"
          onClick={() => set(current - 1)}
          disabled={current <= min}
          aria-label={decreaseLabel}
          className={cx(button, compact ? "px-3 text-base" : "px-3 text-lg")}
          data-quantity-decrease=""
        >
          −
        </button>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          min={min}
          max={MAX}
          step={1}
          required
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onValueChange?.(clamp(Number(e.target.value)));
          }}
          onBlur={() => set(typed)}
          // Enter envia o formulário: o mínimo entra no campo antes de o
          // navegador validar (senão ele mostra o próprio aviso e não envia).
          onKeyDown={(e) => {
            if (e.key === "Enter" && below) flushSync(() => set(typed));
          }}
          className={cx(
            "min-w-0 border-x border-zinc-200 text-center font-semibold tabular-nums text-zinc-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            compact ? "w-full flex-1 py-1.5 text-sm" : "w-28 py-2 text-base",
          )}
          data-quantity-input=""
          data-quantity-min={min}
        />
        <button
          type="button"
          onClick={() => set(current + 1)}
          disabled={current >= MAX}
          aria-label={increaseLabel}
          className={cx(button, compact ? "px-3 text-base" : "px-3 text-lg")}
          data-quantity-increase=""
        >
          +
        </button>
      </div>
      {below ? (
        <p
          role="status"
          className="absolute bottom-full left-0 z-10 mb-1 max-w-full rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 shadow-sm ring-1 ring-amber-200"
          data-below-moq=""
        >
          {belowMoqText}
        </p>
      ) : null}
    </div>
  );
}
