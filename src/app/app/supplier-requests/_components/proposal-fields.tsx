"use client";

import { useEffect, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import {
  FxNoteLine,
  prefetchFx,
  useFxConversion,
} from "@/components/fx-conversion";
import { parseNumberInput } from "@/lib/number-input";
import type { PriceForecastAnswer } from "@/lib/integrations/price-forecast";

/*
 * Campos da contraproposta da Wellmix (docs/SUPPLIER_REQUESTS.md,
 * "Contraproposta com a previsão de preço"): os mesmos da resposta do
 * fornecedor (preço, moeda, MOQ, prazo e FOB/EXW), numa linha só
 * (docs/SUPPLIER_REQUESTS.md, "Tela da negociação reorganizada"), e a
 * previsão de preço do item pela API de preço do Sankhya (a mesma da Nova
 * solicitação; dono, 24/11/2026), nos dois sentidos, quando a digitação
 * para (/api/price-forecast/booking-item):
 * - digita o preço sugerido → custo por peça e venda prevista;
 * - digita o preço de venda desejado (R$) → o preço máximo de compra (conta
 *   inversa do Sankhya), com o botão para usá-lo.
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
  simLoading: string;
  simManual: string;
}

type SimAnswer = PriceForecastAnswer | { mode: "missing"; missing: string[] };

const DEBOUNCE_MS = 600;
const FORECAST_CURRENCIES = ["USD", "RMB", "CNY", "EUR"];

/**
 * Uma chamada de cada vez (o Sankhya recusa duas simultâneas da mesma
 * sessão), como na previsão da Nova solicitação.
 */
let simQueue: Promise<unknown> = Promise.resolve();
function queued<T>(task: () => Promise<T>): Promise<T> {
  const run = simQueue.then(task, task);
  simQueue = run.catch(() => undefined);
  return run;
}

/** Pergunta à API de preço (null = falhou). */
function useForecast(
  itemId: string | null,
  params: Record<string, string> | null,
): { answer: SimAnswer | null; loading: boolean } {
  const key = params ? new URLSearchParams(params).toString() : "";
  const full = itemId && key ? `${itemId}?${key}` : "";
  // A resposta guarda a consulta de onde veio: outra consulta = esperando.
  const [state, setState] = useState<{
    key: string;
    answer: SimAnswer | null;
  }>({ key: "", answer: null });
  useEffect(() => {
    if (!itemId || !key) return;
    let live = true;
    const timer = setTimeout(() => {
      void queued(async () => {
        let body: SimAnswer | null = null;
        try {
          const res = await fetch(
            `/api/price-forecast/booking-item?itemId=${encodeURIComponent(itemId)}&${key}`,
            { cache: "no-store" },
          );
          body = res.ok ? ((await res.json()) as SimAnswer) : null;
        } catch {
          body = null;
        }
        if (live) setState({ key: `${itemId}?${key}`, answer: body });
      });
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [itemId, key]);
  if (!full) return { answer: null, loading: false };
  return state.key === full
    ? { answer: state.answer, loading: false }
    : { answer: null, loading: true };
}

/** O número digitado para a URL (ponto decimal, até 4 casas). */
const urlNumber = (n: number) => String(Math.round(n * 10000) / 10000);

const brl = (n: number, intl: string) =>
  n.toLocaleString(intl, { style: "currency", currency: "BRL" });

export function ProposalFields({
  values,
  currencies,
  incoterms,
  itemId,
  bookingMinimum,
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
  /** Item do book para a previsão (sem item, sem estimativa). */
  itemId: string | null;
  /** Venda prevista no book (R$), para comparar. */
  bookingMinimum: number | null;
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
  const [target, setTarget] = useState("");

  const priceNum = parseNumberInput(price);
  const targetNum = parseNumberInput(target);
  const knownCurrency = FORECAST_CURRENCIES.includes(currency);
  const forward = useForecast(
    showPrice ? itemId : null,
    knownCurrency &&
      priceNum !== null &&
      Number.isFinite(priceNum) &&
      priceNum > 0
      ? { price: urlNumber(priceNum), currency }
      : null,
  );
  const inverse = useForecast(
    showPrice ? itemId : null,
    knownCurrency &&
      targetNum !== null &&
      Number.isFinite(targetNum) &&
      targetNum > 0
      ? { target: urlNumber(targetNum), currency }
      : null,
  );
  const result =
    forward.answer?.mode === "api" && forward.answer.kind === "forecast"
      ? forward.answer
      : null;
  const needed =
    inverse.answer?.mode === "api" && inverse.answer.kind === "solve"
      ? inverse.answer.maxPurchasePrice
      : undefined;
  const inverseFailed =
    !inverse.loading &&
    !!inverse.answer &&
    (needed === null ||
      inverse.answer.mode === "missing" ||
      (inverse.answer.mode === "api" && inverse.answer.kind === "error"));
  const manual =
    forward.answer?.mode === "manual" || inverse.answer?.mode === "manual";
  const missing =
    !forward.loading &&
    (forward.answer?.mode === "missing" ||
      (forward.answer?.mode === "api" && forward.answer.kind === "error"));
  const money = (n: number) =>
    n.toLocaleString(intl, { maximumFractionDigits: 4 });

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

      {itemId && showPrice ? (
        <div
          className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-2 text-xs"
          data-proposal-sim
        >
          <p className="font-semibold uppercase tracking-wide text-zinc-500">
            {l.simTitle}
          </p>
          {!knownCurrency ? (
            <p className="text-amber-800">{l.simCurrency}</p>
          ) : manual ? (
            <p className="text-zinc-600" data-proposal-sim-manual>
              {l.simManual}
            </p>
          ) : forward.loading ? (
            <p className="text-zinc-500">{l.simLoading}</p>
          ) : missing ? (
            <p className="text-amber-800">{l.simMissing}</p>
          ) : result ? (
            <p className="flex flex-col gap-0.5" data-proposal-sim-result>
              {result.cost !== null ? (
                <span>
                  {l.simCost}:{" "}
                  <strong data-proposal-sim-cost>
                    {brl(result.cost, intl)}
                  </strong>
                </span>
              ) : null}
              <span>
                {l.simMinimum}:{" "}
                <strong data-proposal-sim-minimum>
                  {result.salePrice !== null
                    ? brl(result.salePrice, intl)
                    : "—"}
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
          {inverse.loading ? (
            <p className="text-zinc-500">{l.simLoading}</p>
          ) : manual ? null : inverseFailed ? (
            <p className="text-amber-800" data-proposal-sim-unreachable>
              {l.simUnreachable}
            </p>
          ) : needed !== undefined && needed !== null ? (
            <p
              className="flex flex-wrap items-center gap-2"
              data-proposal-sim-needed
            >
              <span>
                {l.simNeeded}:{" "}
                <strong>
                  {money(needed)}{" "}
                  {inverse.answer?.mode === "api" &&
                  inverse.answer.kind === "solve"
                    ? (inverse.answer.maxPurchaseCurrency ?? currency)
                    : currency}
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
