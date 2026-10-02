"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";
import {
  priceToCustomer,
  type PricingInput,
  type PricingMissing,
} from "@/lib/pricing";

/*
 * Escolha do fornecedor com o valor ao cliente calculado (custo importado +
 * margem), atualizado ao trocar o fornecedor ou informar o frete do
 * transportador. O valor segue editável; editar à mão para de atualizar até
 * clicar em "Usar valor calculado". O servidor refaz a conta ao gravar.
 */

export interface CalculatorQuote {
  quoteId: string;
  label: string;
  hasSheet: boolean;
  input: PricingInput;
  marginSource: "customer" | "line" | "default";
  /** Frete da companhia marítima (R$) para pré-preencher; null se não houver. */
  shippingFreightBrl: number | null;
  /** Linha de situação do frete da companhia marítima (já traduzida). */
  shippingFreightNote: string | null;
  /** De onde vieram II e IPI (já traduzido, ex.: "TEC/TIPI · NCM 8517.13.00"). */
  iiSource: string | null;
  ipiSource: string | null;
  /** Sem NCM confirmado: II e IPI em 0%. */
  ncmPending: boolean;
}

type Labels = Record<
  | "supplier"
  | "sellPrice"
  | "carrierFreight"
  | "carrierFreightHint"
  | "title"
  | "fob"
  | "fx"
  | "freightCarrier"
  | "freightCbm"
  | "freightNone"
  | "importTax"
  | "ipi"
  | "insurance"
  | "customsValue"
  | "pis"
  | "cofins"
  | "icms"
  | "ncmPending"
  | "landed"
  | "margin"
  | "sell"
  | "useCalculated"
  | "noSheet"
  | "marginZero"
  | "sourceCustomer"
  | "sourceLine"
  | "sourceDefault",
  string
> & { missing: Record<PricingMissing, string>; fxStale: string | null };

const brl = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pctText = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

export function SellPriceCalculator({
  quotes,
  labels,
}: {
  quotes: CalculatorQuote[];
  labels: Labels;
}) {
  const [quoteId, setQuoteId] = useState(quotes[0]?.quoteId ?? "");
  // Frete digitado por cotação; sem edição, vale o da companhia marítima.
  const [carrierEdits, setCarrierEdits] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<string | null>(null);
  const current = quotes.find((q) => q.quoteId === quoteId) ?? quotes[0];
  const carrier =
    (current && carrierEdits[current.quoteId]) ??
    (current?.shippingFreightBrl != null
      ? current.shippingFreightBrl.toFixed(2)
      : "");
  const carrierBrl = Number(carrier.replace(",", "."));
  const result = current
    ? priceToCustomer({
        ...current.input,
        freight: {
          ...current.input.freight,
          carrierBrl: carrier && carrierBrl > 0 ? carrierBrl : null,
        },
      })
    : null;
  const calculated =
    result?.sellBrl !== null && result?.sellBrl !== undefined
      ? result.sellBrl.toFixed(2)
      : "";
  const sellValue = manual ?? calculated;
  const source = {
    customer: labels.sourceCustomer,
    line: labels.sourceLine,
    default: labels.sourceDefault,
  }[current?.marginSource ?? "default"];
  const input = current?.input;
  // Sem NCM, o aviso do NCM substitui os de II e IPI.
  const shownMissing = (result?.missing ?? []).filter(
    (m) => !(current?.ncmPending && (m === "importTax" || m === "ipi")),
  );

  return (
    <>
      <div className="sm:col-span-3">
        <label
          htmlFor="sp-quote"
          className="mb-1.5 block text-sm font-medium text-zinc-800"
        >
          {labels.supplier}
        </label>
        <select
          id="sp-quote"
          name="quoteId"
          required
          value={quoteId}
          onChange={(e) => setQuoteId(e.target.value)}
          className={inputClass}
        >
          {quotes.map((q) => (
            <option key={q.quoteId} value={q.quoteId}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      {result && input ? (
        <div className="space-y-2 rounded-xl border border-brand-100 bg-white p-3 text-sm sm:col-span-3">
          <p className="font-semibold text-zinc-900">{labels.title}</p>
          {!current.hasSheet ? (
            <p className="text-xs text-amber-700">{labels.noSheet}</p>
          ) : null}
          {labels.fxStale ? (
            <p className="text-xs text-amber-700">{labels.fxStale}</p>
          ) : null}
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-zinc-600">
              {fill(labels.fob, {
                qty: input.quantity.toLocaleString("pt-BR"),
                price: `${input.currency ?? ""} ${input.unitPrice ?? "—"}`,
              })}
              {result.fxRate ? (
                <span className="block text-xs text-zinc-500">
                  {fill(labels.fx, {
                    currency: input.currency ?? "",
                    rate: result.fxRate.toFixed(4),
                  })}
                </span>
              ) : null}
            </dt>
            <dd className="text-right">{brl(result.fobBrl)}</dd>
            <dt className="text-zinc-600">
              {result.freightSource === "carrier"
                ? labels.freightCarrier
                : result.freightSource === "cbm"
                  ? fill(labels.freightCbm, {
                      cbm: (input.totalCbm ?? 0).toLocaleString("pt-BR", {
                        maximumFractionDigits: 3,
                      }),
                      rate: `${input.freight.perCbmCurrency ?? ""} ${input.freight.perCbm ?? ""}`,
                    })
                  : labels.freightNone}
            </dt>
            <dd className="text-right">{brl(result.freightBrl)}</dd>
            {result.insuranceBrl > 0 ? (
              <>
                <dt className="text-zinc-600">
                  {fill(labels.insurance, {
                    pct: pctText(input.insurancePercent),
                  })}
                </dt>
                <dd className="text-right">{brl(result.insuranceBrl)}</dd>
              </>
            ) : null}
            <dt className="border-t border-zinc-100 pt-1 text-zinc-700">
              {labels.customsValue}
            </dt>
            <dd className="border-t border-zinc-100 pt-1 text-right">
              {brl(result.cifBrl)}
            </dd>
            <dt className="text-zinc-600">
              {fill(labels.importTax, {
                pct: pctText(input.importTaxPercent),
              })}
              {current.iiSource ? (
                <span className="block text-xs text-zinc-500">
                  {current.iiSource}
                </span>
              ) : null}
            </dt>
            <dd className="text-right">{brl(result.importTaxBrl)}</dd>
            <dt className="text-zinc-600">
              {fill(labels.ipi, { pct: pctText(input.ipiPercent) })}
              {current.ipiSource ? (
                <span className="block text-xs text-zinc-500">
                  {current.ipiSource}
                </span>
              ) : null}
            </dt>
            <dd className="text-right">{brl(result.ipiBrl)}</dd>
            {input.pisPercent != null ? (
              <>
                <dt className="text-zinc-600">
                  {fill(labels.pis, { pct: pctText(input.pisPercent) })}
                </dt>
                <dd className="text-right">{brl(result.pisBrl)}</dd>
              </>
            ) : null}
            {input.cofinsPercent != null ? (
              <>
                <dt className="text-zinc-600">
                  {fill(labels.cofins, { pct: pctText(input.cofinsPercent) })}
                </dt>
                <dd className="text-right">{brl(result.cofinsBrl)}</dd>
              </>
            ) : null}
            {input.icmsPercent != null ? (
              <>
                <dt className="text-zinc-600">
                  {fill(labels.icms, { pct: pctText(input.icmsPercent) })}
                </dt>
                <dd className="text-right">{brl(result.icmsBrl)}</dd>
              </>
            ) : null}
            <dt className="border-t border-zinc-100 pt-1 font-medium text-zinc-800">
              {labels.landed}
            </dt>
            <dd className="border-t border-zinc-100 pt-1 text-right font-medium">
              {brl(result.landedBrl)}
            </dd>
            <dt className="text-zinc-600">
              {fill(labels.margin, {
                pct: String(result.marginPercent),
                source,
              })}
            </dt>
            <dd className="text-right">{brl(result.marginBrl)}</dd>
            <dt className="border-t border-zinc-100 pt-1 font-semibold text-zinc-900">
              {labels.sell}
            </dt>
            <dd className="border-t border-zinc-100 pt-1 text-right font-semibold text-brand-800">
              {brl(result.sellBrl)}
            </dd>
          </dl>
          {current.ncmPending ? (
            <p className="text-xs font-medium text-amber-700">
              {labels.ncmPending}
            </p>
          ) : null}
          {result.marginPercent === 0 ? (
            <p className="text-xs text-amber-700">{labels.marginZero}</p>
          ) : null}
          {shownMissing.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700">
              {shownMissing.map((m) => (
                <li key={m}>{labels.missing[m]}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="sp-carrier"
          className="mb-1.5 block text-sm font-medium text-zinc-800"
        >
          {labels.carrierFreight}
        </label>
        <input
          id="sp-carrier"
          name="freightCarrierBrl"
          type="number"
          step="0.01"
          min="0"
          value={carrier}
          onChange={(e) => {
            const value = e.target.value;
            if (current)
              setCarrierEdits((prev) => ({
                ...prev,
                [current.quoteId]: value,
              }));
          }}
          className={inputClass}
        />
        {current?.shippingFreightNote ? (
          <p className="mt-1 text-xs font-medium text-brand-800">
            {current.shippingFreightNote}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-500">
          {labels.carrierFreightHint}
        </p>
      </div>
      <div>
        <label
          htmlFor="sp-sell"
          className="mb-1.5 block text-sm font-medium text-zinc-800"
        >
          {labels.sellPrice}
        </label>
        <input
          id="sp-sell"
          name="sellPrice"
          type="number"
          step="0.01"
          min="0"
          required
          value={sellValue}
          onChange={(e) => setManual(e.target.value)}
          className={inputClass}
        />
        {manual !== null && calculated ? (
          <button
            type="button"
            onClick={() => setManual(null)}
            className="mt-1 text-xs font-medium text-brand-700 underline underline-offset-2"
          >
            {labels.useCalculated} ({brl(Number(calculated))})
          </button>
        ) : null}
      </div>
    </>
  );
}
