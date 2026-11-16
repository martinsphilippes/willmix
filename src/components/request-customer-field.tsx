"use client";

import { useState } from "react";
import { PartyPicker } from "./party-picker";
import type { SearchOption, SearchPickerLabels } from "./search-picker";
import { useRequestCustomer } from "./request-customer-context";

/**
 * Cliente da nova solicitação (Wellmix): busca pelo nome (~26 mil clientes
 * não cabem numa lista de seleção) ou "Compra para estoque" (origem interna,
 * sem cliente). O valor vai no mesmo campo `customerId` de antes: o id do
 * cliente ou `stockValue` (a opção de estoque da lista antiga). Dentro do
 * RequestCustomerProvider, a escolha e o estoque também vão para quem está
 * ao lado do formulário (o histórico de compras do cliente).
 */
export function RequestCustomerField({
  stockValue,
  stockLabel,
  initial,
  initialStock,
  ariaLabel,
  labels,
  summary,
  allowStock = true,
}: {
  /** Valor gravado para compra para estoque (STOCK_OPTION). */
  stockValue: string;
  stockLabel: string;
  initial: SearchOption | null;
  /** Começa marcada (ex.: programação de compra para estoque). */
  initialStock: boolean;
  ariaLabel: string;
  labels: SearchPickerLabels;
  /**
   * Resumo abaixo do campo com o cliente escolhido (dono, 15/11/2026):
   * "Código {code} · {name}". Sem ele, nada.
   */
  summary?: { code: string; none: string };
  /**
   * Mostra a caixa "Compra para estoque" (padrão). As telas de TS e de Venda
   * (docs/REQUEST_SCREENS.md) vendem ao cliente: sem a caixa, sem estoque.
   */
  allowStock?: boolean;
}) {
  const shared = useRequestCustomer();
  const [localStock, setLocalStock] = useState(initialStock);
  // Compra para estoque tira o cliente da busca (dono, 16/11/2026): o campo
  // volta em branco (nova montagem, sem o cliente de antes).
  const [pickerKey, setPickerKey] = useState(0);
  const [cleared, setCleared] = useState(false);
  const stock = allowStock && (shared ? shared.stock : localStock);
  return (
    <div className="space-y-1.5" data-request-customer>
      {stock ? (
        <input type="hidden" name="customerId" value={stockValue} />
      ) : null}
      <PartyPicker
        key={pickerKey}
        name={stock ? undefined : "customerId"}
        type="customer"
        activeOnly
        required={!stock}
        disabled={stock}
        initial={cleared ? null : initial}
        ariaLabel={ariaLabel}
        labels={labels}
        onChoose={(option) => shared?.setCustomer(option)}
        onDeselect={() => shared?.setCustomer(null)}
      />
      {summary && !stock && shared?.customer ? (
        <p className="text-xs text-zinc-600" data-request-customer-summary>
          <span className="font-medium text-zinc-800">
            {summary.code.replace(
              "{code}",
              shared.customer.code || summary.none,
            )}
          </span>
          {" · "}
          {shared.customer.name}
        </p>
      ) : null}
      {allowStock ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={stock}
            onChange={(e) => {
              const on = e.target.checked;
              if (shared) shared.setStock(on);
              else setLocalStock(on);
              if (on) {
                shared?.setCustomer(null);
                setCleared(true);
                setPickerKey((k) => k + 1);
              }
            }}
            className="h-4 w-4 shrink-0 accent-brand-600"
            data-stock-option
          />
          {stockLabel}
        </label>
      ) : null}
    </div>
  );
}
