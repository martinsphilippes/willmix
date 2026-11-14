"use client";

import { useState } from "react";
import { PartyPicker } from "./party-picker";
import type { SearchOption, SearchPickerLabels } from "./search-picker";

/**
 * Cliente da nova solicitação (Wellmix): busca pelo nome (~26 mil clientes
 * não cabem numa lista de seleção) ou "Compra para estoque" (origem interna,
 * sem cliente). O valor vai no mesmo campo `customerId` de antes: o id do
 * cliente ou `stockValue` (a opção de estoque da lista antiga).
 */
export function RequestCustomerField({
  stockValue,
  stockLabel,
  initial,
  initialStock,
  ariaLabel,
  labels,
}: {
  /** Valor gravado para compra para estoque (STOCK_OPTION). */
  stockValue: string;
  stockLabel: string;
  initial: SearchOption | null;
  /** Começa marcada (ex.: programação de compra para estoque). */
  initialStock: boolean;
  ariaLabel: string;
  labels: SearchPickerLabels;
}) {
  const [stock, setStock] = useState(initialStock);
  return (
    <div className="space-y-1.5" data-request-customer>
      {stock ? (
        <input type="hidden" name="customerId" value={stockValue} />
      ) : null}
      <PartyPicker
        name={stock ? undefined : "customerId"}
        type="customer"
        activeOnly
        required={!stock}
        disabled={stock}
        initial={initial}
        ariaLabel={ariaLabel}
        labels={labels}
      />
      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={stock}
          onChange={(e) => setStock(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-brand-600"
          data-stock-option
        />
        {stockLabel}
      </label>
    </div>
  );
}
