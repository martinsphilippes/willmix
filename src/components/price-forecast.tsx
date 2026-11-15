"use client";

import { useState } from "react";
import type { PriceForecastAnswer } from "@/lib/integrations/price-forecast";
import { useRequestCustomer } from "./request-customer-context";
import { cx, inputDenseClass } from "./ui";

export interface PriceForecastLabels {
  intl: string;
  title: string;
  hint: string;
  view: string;
  target: string;
  targetField: string;
  calculate: string;
  loading: string;
  noProduct: string;
  manual: string;
  error: string;
  /** "Preço previsto ao cliente final: {price} por peça". */
  result: string;
  /** "Para vender a {target} ao cliente final: {price} por peça". */
  resultTarget: string;
}

type Mode = "view" | "target";

/**
 * Previsão de preço ao cliente final de um produto da Nova solicitação
 * (dono, 15/11/2026; src/lib/integrations/price-forecast.ts): o operador vê
 * o preço previsto ou informa o preço de venda desejado para encontrar o
 * preço. A conta é da API externa; sem ela ligada, a tela diz e nada é
 * estimado. Só a Wellmix. Nada é gravado na solicitação.
 */
export function PriceForecast({
  productId,
  quantity,
  labels,
  className,
}: {
  /** Produto do catálogo da linha ("" sem produto). */
  productId: string;
  quantity: string;
  labels: PriceForecastLabels;
  className?: string;
}) {
  const shared = useRequestCustomer();
  const [mode, setMode] = useState<Mode>("view");
  const [target, setTarget] = useState("");
  const [answer, setAnswer] = useState<{
    for: string;
    value: PriceForecastAnswer | "error";
    target: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const shown = answer && answer.for === `${productId}:${mode}` ? answer : null;
  const money = (n: number) =>
    n.toLocaleString(labels.intl, { style: "currency", currency: "BRL" });
  const targetNumber = Number(target.replace(",", "."));
  const targetOk = Number.isFinite(targetNumber) && targetNumber > 0;

  async function calculate() {
    if (!productId || (mode === "target" && !targetOk)) return;
    const key = `${productId}:${mode}`;
    setLoading(true);
    try {
      const params = new URLSearchParams({ productId });
      const pieces = Math.floor(Number(quantity.replace(",", ".")));
      if (Number.isFinite(pieces) && pieces > 0)
        params.set("quantity", String(pieces));
      if (shared?.customer?.id) params.set("customerId", shared.customer.id);
      if (mode === "target") params.set("target", String(targetNumber));
      const res = await fetch(`/api/price-forecast?${params.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      setAnswer({
        for: key,
        value: (await res.json()) as PriceForecastAnswer,
        target: mode === "target" ? targetNumber : null,
      });
    } catch {
      setAnswer({ for: key, value: "error", target: null });
    } finally {
      setLoading(false);
    }
  }

  const chip = (on: boolean) =>
    cx(
      "rounded-md border px-2.5 py-1 text-xs font-semibold",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
    );

  return (
    <div
      className={cx(
        "space-y-2 rounded-lg border border-zinc-200 bg-white p-2.5 text-xs",
        className,
      )}
      role="group"
      aria-label={labels.title}
      data-price-forecast
    >
      <p className="text-sm font-semibold text-zinc-900">{labels.title}</p>
      <p className="text-zinc-600">{labels.hint}</p>
      {!productId ? (
        <p className="text-zinc-500" data-price-forecast-no-product>
          {labels.noProduct}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="group">
            <button
              type="button"
              aria-pressed={mode === "view"}
              onClick={() => setMode("view")}
              data-price-forecast-mode="view"
              className={chip(mode === "view")}
            >
              {labels.view}
            </button>
            <button
              type="button"
              aria-pressed={mode === "target"}
              onClick={() => setMode("target")}
              data-price-forecast-mode="target"
              className={chip(mode === "target")}
            >
              {labels.target}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {mode === "target" ? (
              <label className="space-y-1">
                <span className="block font-medium text-zinc-700">
                  {labels.targetField}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter calcula; não envia a solicitação.
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void calculate();
                  }}
                  data-price-forecast-target
                  className={cx(inputDenseClass, "w-36 tabular-nums")}
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => void calculate()}
              disabled={loading || (mode === "target" && !targetOk)}
              data-price-forecast-submit
              className="min-h-8 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {loading ? labels.loading : labels.calculate}
            </button>
          </div>
          {shown ? (
            shown.value === "error" ? (
              <p className="font-medium text-red-700" role="alert">
                {labels.error}
              </p>
            ) : shown.value.mode === "manual" ? (
              <p
                className="rounded-md bg-amber-50 px-2.5 py-1.5 font-medium text-amber-900"
                role="status"
                data-price-forecast-result="manual"
              >
                {labels.manual}
              </p>
            ) : (
              <p
                className="rounded-md bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-900"
                role="status"
                data-price-forecast-result="api"
              >
                {shown.target !== null && shown.value.priceBrl !== null
                  ? labels.resultTarget
                      .replace("{target}", money(shown.target))
                      .replace("{price}", money(shown.value.priceBrl))
                  : labels.result.replace(
                      "{price}",
                      money(shown.value.finalPriceBrl),
                    )}
              </p>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
