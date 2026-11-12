"use client";

import { useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { parseNumberInput } from "@/lib/number-input";
import { computeSuperplan, type SuperplanInput } from "@/lib/superplan";
import { priceForMinimum } from "@/lib/superplan-inverse";

/*
 * Campos da contraproposta da Wellmix (docs/SUPPLIER_REQUESTS.md,
 * "Contraproposta com o Superplan"): os mesmos da resposta do fornecedor
 * (preço, moeda, MOQ, prazo e FOB/EXW) e a estimativa do Superplan do item
 * nos dois sentidos, refeita no navegador a cada tecla:
 * - digita o preço sugerido → custo por peça e preço mínimo;
 * - digita o preço mínimo desejado (R$) → o preço por peça necessário (conta
 *   inversa), com o botão para usá-lo.
 * Só estimativa: o que vale é o que a Server Action grava.
 */

export interface ProposalFieldsLabels {
  price: string;
  currency: string;
  moq: string;
  leadTime: string;
  incoterm: string;
  simTitle: string;
  simCost: string;
  simMinimum: string;
  simBooking: string;
  simTarget: string;
  simTargetHint: string;
  simNeeded: string;
  simUse: string;
  simUnreachable: string;
  simCurrency: string;
  simMissing: string;
  simHint: string;
}

const brl = (n: number, intl: string) =>
  n.toLocaleString(intl, { style: "currency", currency: "BRL" });

/** Resultado da conta com outro preço/moeda (só USD e RMB entram no Superplan). */
function simulate(base: SuperplanInput, price: number, currency: string) {
  if (currency !== "USD" && currency !== "RMB") return null;
  return computeSuperplan({ ...base, unitPrice: price, currency });
}

export function ProposalFields({
  values,
  currencies,
  incoterms,
  base,
  bookingMinimum,
  intl,
  labels: l,
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
  /** Entrada do Superplan do item (sem base, sem estimativa). */
  base: SuperplanInput | null;
  /** Preço mínimo do booking (R$), para comparar. */
  bookingMinimum: number | null;
  intl: string;
  labels: ProposalFieldsLabels;
}) {
  const decimal = intl.startsWith("pt") ? "," : ".";
  const raw = (n: number | null) =>
    n === null ? "" : String(n).replace(".", decimal);
  const [price, setPrice] = useState(raw(values.price));
  const [currency, setCurrency] = useState(values.currency);
  const [target, setTarget] = useState("");

  const priceNum = parseNumberInput(price);
  const targetNum = parseNumberInput(target);
  const result = useMemo(() => {
    if (!base || priceNum === null || !Number.isFinite(priceNum)) return null;
    return simulate(base, priceNum, currency);
  }, [base, priceNum, currency]);
  const needed = useMemo(() => {
    if (
      !base ||
      targetNum === null ||
      !Number.isFinite(targetNum) ||
      targetNum <= 0 ||
      (currency !== "USD" && currency !== "RMB")
    )
      return undefined;
    return priceForMinimum(base, currency, targetNum);
  }, [base, targetNum, currency]);
  const missing = result?.missing.filter((m) => m !== "price") ?? [];
  const money = (n: number) =>
    n.toLocaleString(intl, { maximumFractionDigits: 4 });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label={l.price}>
          <Input
            name="price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-negotiation-price
          />
        </Field>
        <Field label={l.currency}>
          <Select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={l.moq}>
          <Input
            name="moq"
            inputMode="numeric"
            defaultValue={raw(values.moq)}
            data-negotiation-moq
          />
        </Field>
        <Field label={l.leadTime}>
          <Input
            name="leadTimeDays"
            inputMode="numeric"
            defaultValue={raw(values.leadTimeDays)}
            data-negotiation-lead-time
          />
        </Field>
        <Field label={l.incoterm}>
          <Select
            name="incoterm"
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

      {base ? (
        <div
          className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-2 text-xs"
          data-proposal-sim
        >
          <p className="font-semibold uppercase tracking-wide text-zinc-500">
            {l.simTitle}
          </p>
          {currency !== "USD" && currency !== "RMB" ? (
            <p className="text-amber-800">{l.simCurrency}</p>
          ) : missing.length ? (
            <p className="text-amber-800">{l.simMissing}</p>
          ) : result?.cost && result.prices ? (
            <p className="flex flex-col gap-0.5" data-proposal-sim-result>
              <span>
                {l.simCost}:{" "}
                <strong data-proposal-sim-cost>
                  {brl(result.cost.perPiece, intl)}
                </strong>
              </span>
              <span>
                {l.simMinimum}:{" "}
                <strong data-proposal-sim-minimum>
                  {brl(result.prices.minimum, intl)}
                </strong>
                {bookingMinimum !== null ? (
                  <span className="text-zinc-500">
                    {" "}
                    · {l.simBooking} {brl(bookingMinimum, intl)}
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          <Field label={l.simTarget} hint={l.simTargetHint}>
            <Input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              data-proposal-sim-target
            />
          </Field>
          {needed === null ? (
            <p className="text-amber-800" data-proposal-sim-unreachable>
              {l.simUnreachable}
            </p>
          ) : needed !== undefined ? (
            <p
              className="flex flex-wrap items-center gap-2"
              data-proposal-sim-needed
            >
              <span>
                {l.simNeeded}:{" "}
                <strong>
                  {money(needed)} {currency}
                </strong>
              </span>
              <button
                type="button"
                className="rounded-md border border-brand-300 bg-white px-2 py-0.5 font-medium text-brand-700 hover:bg-brand-50"
                onClick={() => setPrice(raw(needed))}
                data-proposal-sim-use
              >
                {l.simUse}
              </button>
            </p>
          ) : null}
          <p className="text-zinc-500">{l.simHint}</p>
        </div>
      ) : null}
    </div>
  );
}
