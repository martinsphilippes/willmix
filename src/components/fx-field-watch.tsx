"use client";

import { useCallback, useEffect, useRef } from "react";
import { parseNumberInput } from "@/lib/number-input";
import { FxNoteLine, prefetchFx, useFxConversion } from "./fx-conversion";

/**
 * Conversão ao trocar a moeda num formulário de campos simples (o texto do
 * preço e o seletor de moeda, sem estado no navegador; ex.: a oferta da
 * negociação com o fornecedor). Fica embaixo do preço: ao trocar a moeda, o
 * número do campo `price` vai para a moeda nova pelo câmbio do dia, com o
 * aviso e o "Manter" (dono, 21/11/2026; `src/components/fx-conversion.tsx`).
 */
export function FxFieldWatch({
  price,
  currency,
  locale,
  decimals = 4,
}: {
  /** Nome do campo de preço no mesmo <form>. */
  price: string;
  /** Nome do seletor de moeda no mesmo <form>. */
  currency: string;
  /** Tag Intl do idioma (vírgula decimal em pt-BR). */
  locale: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const decimal = locale.startsWith("pt") ? "," : ".";
  const format = useCallback(
    (n: number, code: string) =>
      `${code} ${n.toLocaleString(locale, { maximumFractionDigits: decimals })}`,
    [locale, decimals],
  );
  const { note, convert, clear, keep } = useFxConversion({ decimals, format });

  useEffect(() => {
    const form = ref.current?.closest("form");
    const select = form?.elements.namedItem(currency);
    const input = form?.elements.namedItem(price);
    if (
      !(select instanceof HTMLSelectElement) ||
      !(input instanceof HTMLInputElement)
    )
      return;
    let last = select.value;
    // O número como a pessoa digita: sem zeros sobrando, vírgula em pt.
    const write = (n: number) => {
      input.value = n
        .toFixed(decimals)
        .replace(/\.?0+$/, "")
        .replace(".", decimal);
    };
    const onChange = () => {
      const next = select.value;
      if (next === last) return;
      const before = last;
      last = next;
      const typed = parseNumberInput(input.value);
      convert(
        before,
        next,
        typed !== null && Number.isFinite(typed) ? typed : null,
        write,
      );
    };
    select.addEventListener("change", onChange);
    select.addEventListener("focus", prefetchFx);
    input.addEventListener("input", clear);
    return () => {
      select.removeEventListener("change", onChange);
      select.removeEventListener("focus", prefetchFx);
      input.removeEventListener("input", clear);
    };
  }, [price, currency, decimal, decimals, convert, clear]);

  return (
    <span ref={ref} className="block" data-fx-watch={price}>
      <FxNoteLine note={note} onKeep={keep} />
    </span>
  );
}
