"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

/*
 * Liga a disputa de fornecedores ao formulário da escolha, logo abaixo: o
 * botão "Escolher" de cada linha seleciona aquele fornecedor no formulário
 * (SellPriceCalculator) e leva a tela até ele, onde fica o botão que conclui
 * a decisão. O formulário avisa qual está escolhido, para a linha mostrar.
 */

/** Pedido para escolher uma cotação no formulário (detail: { quoteId }). */
export const PICK_QUOTE_EVENT = "wellmix:pick-quote";
/** O formulário diz qual cotação está escolhida (detail: { quoteId }). */
export const QUOTE_CURRENT_EVENT = "wellmix:quote-current";

export function PickQuoteButton({
  quoteId,
  label,
  chosenLabel,
}: {
  quoteId: string;
  label: string;
  chosenLabel: string;
}) {
  const [chosen, setChosen] = useState(false);
  useEffect(() => {
    const onCurrent = (event: Event) => {
      const id = (event as CustomEvent<{ quoteId?: string }>).detail?.quoteId;
      setChosen(id === quoteId);
    };
    window.addEventListener(QUOTE_CURRENT_EVENT, onCurrent);
    return () => window.removeEventListener(QUOTE_CURRENT_EVENT, onCurrent);
  }, [quoteId]);
  return (
    <button
      type="button"
      data-pick-quote={quoteId}
      data-pick-chosen={chosen ? "" : undefined}
      aria-pressed={chosen}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent(PICK_QUOTE_EVENT, { detail: { quoteId } }),
        );
        // Leva até o formulário da escolha, onde está o botão de concluir.
        document
          .getElementById("sp-quote")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className={cx(
        "inline-flex h-7 items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition",
        chosen
          ? "bg-emerald-600 text-white ring-emerald-600"
          : "bg-white text-brand-700 ring-brand-200 hover:bg-brand-50",
      )}
    >
      {chosen ? chosenLabel : label}
    </button>
  );
}
