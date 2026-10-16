"use client";

import { useEffect, useRef, useState } from "react";
import { parseNumberInput } from "@/lib/number-input";
import { cx } from "./ui";

/*
 * Sinal da proposta em porcentagem do valor ao cliente: o "%" fica fixo no
 * campo e só vale de 0 a 100 (o que passa disso vira 100). Embaixo, o valor
 * do sinal na moeda escolhida, ao vivo, com o valor ao cliente do mesmo
 * formulário. O servidor refaz a conta (não confia no navegador).
 */
export function DownPaymentInput({
  name,
  defaultPercent,
  sellField,
  currencyField,
  locale,
  equals,
  id,
}: {
  name: string;
  /** Padrão das configurações (ex.: 30). */
  defaultPercent: number;
  /** Campo do valor ao cliente (número cru) e da moeda no mesmo formulário. */
  sellField: string;
  currencyField: string;
  locale: string;
  /** "= {amount} de sinal" */
  equals: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(String(defaultPercent));
  const [sell, setSell] = useState<{ value: number; currency: string } | null>(
    null,
  );

  // Valor ao cliente e moeda do formulário (mudam com o fornecedor e o frete).
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    let timer = 0;
    const read = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const v = (field: string) => {
          const el = form.elements.namedItem(field);
          return el instanceof HTMLInputElement ||
            el instanceof HTMLSelectElement
            ? el.value
            : "";
        };
        const value = Number(v(sellField));
        setSell(
          v(sellField) !== "" && Number.isFinite(value) && value > 0
            ? { value, currency: v(currencyField) || "BRL" }
            : null,
        );
      }, 0);
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [sellField, currencyField]);

  const percent = parseNumberInput(text);
  const amount =
    sell && percent !== null && Number.isFinite(percent)
      ? Math.round(sell.value * percent) / 100
      : null;
  let money = "";
  if (amount !== null && sell) {
    try {
      money = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: sell.currency,
      }).format(amount);
    } catch {
      money = `${sell.currency} ${amount.toFixed(2)}`;
    }
  }

  return (
    <div className="space-y-1">
      <span className="inline-flex w-full items-center rounded-lg border border-zinc-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-brand-200">
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            // Só número (vírgula ou ponto); acima de 100 vira 100.
            const clean = e.target.value
              .replace(/[^\d.,]/g, "")
              .replace(/([.,].*)[.,]/g, "$1");
            const n = parseNumberInput(clean);
            setText(n !== null && Number.isFinite(n) && n > 100 ? "100" : clean);
          }}
          aria-describedby={id ? `${id}-amount` : undefined}
          data-down-payment
          className="w-full min-w-16 rounded-l-lg border-0 bg-transparent py-2 pl-3 text-right text-sm tabular-nums focus:outline-none"
        />
        <span
          aria-hidden
          className="shrink-0 pl-1 pr-3 text-sm font-semibold text-zinc-500"
        >
          %
        </span>
      </span>
      <p
        id={id ? `${id}-amount` : undefined}
        className={cx("text-xs text-zinc-600", !money && "invisible")}
        data-down-payment-amount
      >
        {money ? equals.replace("{amount}", money) : "—"}
      </p>
    </div>
  );
}
