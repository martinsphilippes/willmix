"use client";

import { useState } from "react";
import { PartyPicker } from "./party-picker";
import type { SearchOption, SearchPickerLabels } from "./search-picker";
import { useRequestCustomer } from "./request-customer-context";
import { GroupCustomerExtra } from "./economic-group-ui";
import type { EconomicGroupLabels } from "./economic-group-labels";
import {
  QuickCustomerButton,
  type QuickCustomerLabels,
} from "./quick-customer";

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
  groupLabels,
  quick,
}: {
  /**
   * Cadastro rápido de cliente pelo "+" ao lado da busca (dono, 21/11/2026;
   * docs/ORDER_TERMS.md, seção 11.25). Sem os textos, sem o "+".
   */
  quick?: QuickCustomerLabels;
  /**
   * Pedido para um grupo econômico (docs/ECONOMIC_GROUPS.md): "+ x empresas
   * do grupo" e a distribuição padrão ao lado do cliente. Sem eles, nada.
   */
  groupLabels?: EconomicGroupLabels;
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
  // Cliente do cadastro rápido: o campo remonta já com ele escolhido.
  const [quickChosen, setQuickChosen] = useState<SearchOption | null>(null);
  const [quickDone, setQuickDone] = useState<string | null>(null);
  const stock = allowStock && (shared ? shared.stock : localStock);
  return (
    <div className="space-y-1.5" data-request-customer>
      {stock ? (
        <input type="hidden" name="customerId" value={stockValue} />
      ) : null}
      <div className="flex items-start gap-1.5">
        <PartyPicker
          key={pickerKey}
          name={stock ? undefined : "customerId"}
          type="customer"
          activeOnly
          required={!stock}
          disabled={stock}
          initial={cleared ? null : (quickChosen ?? initial)}
          ariaLabel={ariaLabel}
          labels={labels}
          className="min-w-0 flex-1"
          onChoose={(option) => {
            setQuickDone(null);
            shared?.setCustomer(option);
          }}
          onDeselect={() => {
            setQuickDone(null);
            shared?.setCustomer(null);
          }}
        />
        {quick && !stock ? (
          <QuickCustomerButton
            labels={quick}
            onChosen={(option, created) => {
              setQuickChosen(option);
              setCleared(false);
              setPickerKey((k) => k + 1);
              setQuickDone(created ? option.name : null);
              shared?.setCustomer(option);
            }}
          />
        ) : null}
      </div>
      {quick && quickDone && !stock ? (
        <p
          className="text-xs font-medium text-emerald-700"
          data-quick-customer-done
        >
          {quick.done.replace("{name}", quickDone)}
        </p>
      ) : null}
      {summary && !stock && shared?.customer ? (
        <div className="text-xs text-zinc-600" data-request-customer-summary>
          <span className="font-medium text-zinc-800">
            {summary.code.replace(
              "{code}",
              shared.customer.code || summary.none,
            )}
          </span>
          {" · "}
          {shared.customer.name}
          {groupLabels ? <GroupCustomerExtra labels={groupLabels} /> : null}
        </div>
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
                setQuickChosen(null);
                setQuickDone(null);
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
