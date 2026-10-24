"use client";

import { useState } from "react";
import { addToCartAction } from "@/app/app/actions/cart";
import { QuantityStepper } from "./quantity-stepper";
import { SubmitButton } from "./submit-button";

/**
 * Formulário do cartão da vitrine: quantidade (−, digitar, +) começando no
 * pedido mínimo e o botão "Adicionar N un", que acompanha a quantidade. Um
 * clique adiciona o mínimo; a página do produto não é necessária.
 */
export function ExploreAddForm({
  productId,
  back,
  moq,
  startQty,
  intl,
  labels,
}: {
  productId: string;
  back: string;
  moq: number | null;
  startQty: number;
  /** Idioma dos números (ex.: "pt-BR"). */
  intl: string;
  labels: {
    /** "Adicionar {n} un". */
    add: string;
    quantity: string;
    decrease: string;
    increase: string;
    belowMoq: string;
  };
}) {
  const min = moq && moq > 0 ? moq : 1;
  const [quantity, setQuantity] = useState(Math.max(min, startQty));
  return (
    <form
      action={addToCartAction}
      className="space-y-1.5"
      data-explore-add-form={productId}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="back" value={back} />
      <QuantityStepper
        id={`explore-qty-${productId}`}
        compact
        defaultValue={startQty}
        moq={moq}
        label={labels.quantity}
        decreaseLabel={labels.decrease}
        increaseLabel={labels.increase}
        belowMoqText={labels.belowMoq}
        onValueChange={setQuantity}
      />
      <SubmitButton
        variant="secondary"
        className="w-full rounded-xl border-brand-200 px-2 text-brand-700 hover:border-brand-300 hover:bg-brand-50"
        data-explore-add={productId}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-4 w-4 shrink-0"
        >
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
          <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
        </svg>
        {/* Em cartão estreito (celular, 2 por linha) o texto quebra em vez de cortar. */}
        <span className="whitespace-normal leading-tight">
          {labels.add.replace("{n}", quantity.toLocaleString(intl))}
        </span>
      </SubmitButton>
    </form>
  );
}
