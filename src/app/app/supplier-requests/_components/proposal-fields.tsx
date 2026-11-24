"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import {
  FxNoteLine,
  prefetchFx,
  useFxConversion,
} from "@/components/fx-conversion";
import { parseNumberInput } from "@/lib/number-input";

/*
 * Campos da contraproposta da Wellmix (docs/SUPPLIER_REQUESTS.md,
 * "Contraproposta"): os mesmos da resposta do fornecedor (preço, moeda, MOQ,
 * prazo e FOB/EXW), numa linha só (docs/SUPPLIER_REQUESTS.md, "Tela da
 * negociação reorganizada"). A estimativa do custo que o portal fazia aqui
 * saiu em 24/11/2026 (dono: o custo oficial é o da cotação do Sankhya).
 */

export interface ProposalFieldsLabels {
  price: string;
  currency: string;
  moq: string;
  leadTime: string;
  incoterm: string;
}

export function ProposalFields({
  values,
  currencies,
  incoterms,
  intl,
  labels: l,
  showPrice = true,
}: {
  values: {
    price: number | null;
    currency: string;
    moq: number | null;
    leadTimeDays: number | null;
    incoterm: string;
  };
  currencies: readonly string[];
  incoterms: readonly string[];
  intl: string;
  labels: ProposalFieldsLabels;
  /**
   * Preço e moeda: falso para a Wellmix sem "Ver preço de compra" (propõe
   * MOQ, prazo e FOB/EXW; o servidor ignora preço dela).
   */
  showPrice?: boolean;
}) {
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  const [price, setPrice] = useState(raw(values.price));
  const [currency, setCurrency] = useState(values.currency);
  // Trocar a moeda converte o preço (dono, 21/11/2026): câmbio do dia do
  // portal, com o aviso e o "Manter" (`src/components/fx-conversion.tsx`).
  const fx = useFxConversion({
    decimals: 4,
    format: (n, c) =>
      `${c} ${n.toLocaleString(intl, { maximumFractionDigits: 4 })}`,
  });

  return (
    <div className="@container space-y-2">
      {/* Uma linha só quando cabe (tela da negociação reorganizada):
          Preço/peça | Moeda | Mínimo | Produção | Incoterm; em espaço
          estreito (iPad em pé, celular), duas ou três colunas. Pela largura
          do quadro, não da tela. */}
      <div
        className={
          showPrice
            ? "grid grid-cols-2 gap-2 @sm:grid-cols-3 @xl:grid-cols-5"
            : "grid grid-cols-2 gap-2 @sm:grid-cols-3"
        }
        data-offer-row
      >
        {showPrice ? (
          <>
            <Field label={l.price}>
              <Input
                name="price"
                inputMode="decimal"
                className="min-h-9"
                value={price}
                onChange={(e) => {
                  fx.clear();
                  setPrice(e.target.value);
                }}
                data-negotiation-price
              />
              <FxNoteLine note={fx.note} onKeep={fx.keep} />
            </Field>
            <Field label={l.currency}>
              <Select
                name="currency"
                className="min-h-9"
                value={currency}
                onFocus={prefetchFx}
                onChange={(e) => {
                  const next = e.target.value;
                  const typed = parseNumberInput(price);
                  fx.convert(
                    currency,
                    next,
                    typed !== null && Number.isFinite(typed) ? typed : null,
                    (n) => setPrice(raw(n)),
                  );
                  setCurrency(next);
                }}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
        <Field label={l.moq}>
          <Input
            name="moq"
            inputMode="numeric"
            className="min-h-9"
            defaultValue={raw(values.moq)}
            data-negotiation-moq
          />
        </Field>
        <Field label={l.leadTime}>
          <Input
            name="leadTimeDays"
            inputMode="numeric"
            className="min-h-9"
            defaultValue={raw(values.leadTimeDays)}
            data-negotiation-lead-time
          />
        </Field>
        <Field label={l.incoterm}>
          <Select
            name="incoterm"
            className="min-h-9"
            defaultValue={values.incoterm}
            data-negotiation-incoterm
          >
            {incoterms.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}
