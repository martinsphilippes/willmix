"use client";

import { useState } from "react";
import { Field, Input, Select, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { parseNumberInput } from "@/lib/number-input";
import {
  packingParcels,
  packingSeal,
  packingTotals,
  type PackingBasis,
} from "@/lib/strategy-packing";
import { orderFromStrategyAction } from "../../actions/purchase-demand";
import {
  PackingCells,
  packingGridClass,
  type PackingTexts,
} from "./packing-cells";

/*
 * Formulário do pedido direto da estratégia aprovada (fornecedor da última
 * compra; dono, 18/11/2026; docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na
 * Estratégia"). Por produto: Quantidade (peças), editável, e ao lado as
 * caixas master, as caixas inner e a cubagem, refeitas a cada tecla com a
 * mesma conta do servidor. Depois: Preço unitário | Moeda | Prazo de
 * produção (dias) | Incoterm. O formulário manda, por produto, o que a tela
 * mostrou (`seal__<produto>`): o servidor refaz a conta com a embalagem de
 * agora e recusa se mudou. Os nomes dos campos são os de sempre.
 */

export interface StrategyOrderLine {
  productId: string;
  productName: string;
  /** Quantidade inicial (a soma das encomendas, em peças). */
  quantity: number;
  /** Contas por programação (peças), enquanto a quantidade é a inicial. */
  planned: number[];
  /** Nula: encomendas do produto com embalagens diferentes. */
  basis: PackingBasis | null;
  /** Preço inicial, com a precisão gravada (só com "Ver preço de compra"). */
  unitPrice: string;
  /** Avisos do servidor (programação, unidade, embalagens diferentes). */
  warnings: string[];
}

export interface StrategyOrderTexts {
  packing: PackingTexts;
  price: string;
  currency: string;
  leadTime: string;
  incoterm: string;
  generate: string;
}

/** Campo compacto da tela: mais baixo, sem sombra, mais alto no toque. */
const fieldClass = "h-8 px-2 shadow-none tabular-nums pointer-coarse:h-10";

export function StrategyOrderForm({
  decisionId,
  lines,
  seesPrice,
  currency,
  leadTime,
  incoterm,
  texts,
  intl,
}: {
  decisionId: string;
  lines: StrategyOrderLine[];
  seesPrice: boolean;
  currency: string;
  leadTime: string;
  incoterm: "" | "FOB" | "EXW";
  texts: StrategyOrderTexts;
  intl: string;
}) {
  // A quantidade inicial com o milhar do idioma ("526.320"): a tela e o
  // servidor leem as peças como número inteiro.
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [l.productId, l.quantity.toLocaleString(intl)]),
    ),
  );
  const single = lines.length === 1;

  const priceField = (line: StrategyOrderLine) => (
    <Field label={texts.price}>
      <Input
        name={`unitPrice__${line.productId}`}
        inputMode="decimal"
        defaultValue={line.unitPrice}
        className={cx(fieldClass, "sm:w-36")}
        data-strategy-order-price
      />
    </Field>
  );

  return (
    <form
      action={orderFromStrategyAction}
      className="mt-3 space-y-3 border-t border-zinc-100 pt-3"
      data-strategy-order-form
      data-compact-fields
    >
      <input type="hidden" name="id" value={decisionId} />
      {lines.map((line) => {
        const raw = quantities[line.productId] ?? "";
        const parsed = parseNumberInput(raw, { int: true });
        const valid =
          typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0;
        const totals =
          valid && line.basis
            ? packingTotals(packingParcels(parsed, line.planned), line.basis)
            : null;
        return (
          <div
            key={line.productId}
            className="space-y-2"
            data-strategy-order-line={line.productId}
          >
            <input type="hidden" name="productIds" value={line.productId} />
            <input
              type="hidden"
              name={`seal__${line.productId}`}
              value={totals ? packingSeal(totals) : "-|-|-"}
              data-strategy-order-seal
            />
            <p className="text-sm font-medium text-zinc-900">
              {line.productName}
            </p>
            <PackingCells
              marker={line.productId}
              totals={totals}
              basis={line.basis}
              texts={texts.packing}
              intl={intl}
              extraWarnings={[
                ...line.warnings,
                ...(valid ? [] : [texts.packing.warnQtyInvalid]),
              ]}
              quantity={
                <Input
                  name={`quantity__${line.productId}`}
                  inputMode="numeric"
                  value={raw}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [line.productId]: e.target.value,
                    }))
                  }
                  required
                  aria-invalid={!valid || undefined}
                  className={cx(fieldClass, "sm:w-36")}
                  data-strategy-order-quantity
                />
              }
            />
            {seesPrice && !single ? (
              <div className={packingGridClass}>{priceField(line)}</div>
            ) : null}
          </div>
        );
      })}
      <div className={packingGridClass} data-strategy-order-terms>
        {seesPrice && single ? priceField(lines[0]) : null}
        {seesPrice ? (
          <Field label={texts.currency}>
            <Input
              name="currency"
              defaultValue={currency}
              maxLength={3}
              required
              autoCapitalize="characters"
              className={cx(fieldClass, "uppercase sm:w-20")}
            />
          </Field>
        ) : null}
        <Field label={texts.leadTime}>
          <Input
            name="leadTimeDays"
            inputMode="numeric"
            defaultValue={leadTime}
            className={cx(fieldClass, "sm:w-24")}
            data-strategy-order-lead-time
          />
        </Field>
        <Field label={texts.incoterm}>
          <Select
            name="incoterm"
            defaultValue={incoterm}
            className={cx(fieldClass, "pr-7 sm:w-28")}
          >
            <option value="">—</option>
            <option value="FOB">FOB</option>
            <option value="EXW">EXW</option>
          </Select>
        </Field>
      </div>
      <p className="text-[11px] leading-4 text-zinc-500">
        {texts.packing.legend}
      </p>
      <SubmitButton data-strategy-order>{texts.generate}</SubmitButton>
    </form>
  );
}
