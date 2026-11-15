"use client";

import { useState } from "react";
import type {
  PriceForecastAnswer,
  SuperplanAudit,
} from "@/lib/integrations/price-forecast";
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
  /** Linhas da previsão (SuperPlan do Sankhya). */
  sale: string;
  table: string;
  wholesale: string;
  retail: string;
  goal: string;
  cost: string;
  profit: string;
  /** "{profit}% (meta {goal}%)". */
  profitValue: string;
  /** "Para vender a {target} por peça: preço máximo de compra". */
  resultTarget: string;
  /** Sem "Ver valores e margem": o preço máximo de compra não aparece. */
  targetLocked?: string;
  source: string;
  /** Memória de cálculo do Sankhya (só com "Ver valores e margem"). */
  auditTitle?: string;
  /** "Enviado à função {fn}". */
  auditInputs?: string;
  auditDefaults?: string;
  auditOutputs?: string;
  /** Vê o preço máximo de compra (custo): só com "Ver valores e margem". */
  canSolve?: boolean;
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
  const canSolve = labels.canSolve ?? true;
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
  const money = (n: number | null) =>
    n === null
      ? "—"
      : n.toLocaleString(labels.intl, { style: "currency", currency: "BRL" });
  const num = (n: number, digits = 2) =>
    n.toLocaleString(labels.intl, { maximumFractionDigits: digits });
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
              hidden={!canSolve}
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
            ) : shown.value.kind === "error" ? (
              <p
                className="rounded-md bg-red-50 px-2.5 py-1.5 font-medium text-red-800"
                role="alert"
                data-price-forecast-result="error"
              >
                {labels.error} {shown.value.message}
              </p>
            ) : shown.value.kind === "solve" ? (
              <p
                className="rounded-md bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-900"
                role="status"
                data-price-forecast-result="solve"
              >
                {labels.resultTarget.replace("{target}", money(shown.target))}{" "}
                {shown.value.maxPurchasePrice === null
                  ? "—"
                  : `${num(shown.value.maxPurchasePrice, 4)} ${shown.value.maxPurchaseCurrency ?? ""}`}
                {shown.value.maxPurchaseUsd !== null
                  ? ` (US$ ${num(shown.value.maxPurchaseUsd, 4)})`
                  : ""}
              </p>
            ) : (
              <dl
                className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-emerald-950"
                role="status"
                data-price-forecast-result="forecast"
              >
                {(
                  [
                    ["retail", labels.retail, money(shown.value.retailPrice)],
                    ["sale", labels.sale, money(shown.value.salePrice)],
                    ["table", labels.table, money(shown.value.tablePrice)],
                    [
                      "wholesale",
                      labels.wholesale,
                      money(shown.value.wholesalePrice),
                    ],
                    ["goal", labels.goal, money(shown.value.targetPrice)],
                    ...(shown.value.cost !== null
                      ? [["cost", labels.cost, money(shown.value.cost)]]
                      : []),
                    ...(shown.value.profitPercent !== null
                      ? [
                          [
                            "profit",
                            labels.profit,
                            labels.profitValue
                              .replace(
                                "{profit}",
                                num(shown.value.profitPercent),
                              )
                              .replace(
                                "{goal}",
                                num(shown.value.goalPercent ?? 0),
                              ),
                          ],
                        ]
                      : []),
                  ] as Array<[string, string, string]>
                ).map(([key, label, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-emerald-800">{label}</dt>
                    <dd
                      className="font-semibold tabular-nums"
                      data-price-forecast-line={key}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
                <p className="col-span-2 pt-0.5 text-[11px] text-emerald-800">
                  {labels.source}
                </p>
              </dl>
            )
          ) : null}
          {shown &&
          shown.value !== "error" &&
          shown.value.mode === "api" &&
          shown.value.audit ? (
            <AuditBox audit={shown.value.audit} labels={labels} />
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Memória de cálculo da SuperPlan para auditoria: o que foi enviado à
 * função e todas as colunas que ela devolveu, como vieram do Sankhya.
 */
function AuditBox({
  audit,
  labels,
}: {
  audit: SuperplanAudit;
  labels: PriceForecastLabels;
}) {
  const value = (v: string | number | null) =>
    v === null || v === ""
      ? "—"
      : typeof v === "number"
        ? v.toLocaleString(labels.intl, { maximumFractionDigits: 8 })
        : v;
  const table = (
    rows: Array<[string, string | number | null]>,
    key: string,
  ) => (
    <dl
      className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]"
      data-price-forecast-audit={key}
    >
      {rows.map(([name, v]) => (
        <div key={name} className="contents">
          <dt className="break-all text-zinc-600">{name}</dt>
          <dd className="break-all tabular-nums text-zinc-900">{value(v)}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <details className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
      <summary className="cursor-pointer font-semibold text-zinc-800">
        {labels.auditTitle ?? "Sankhya"}
      </summary>
      <div className="mt-2 space-y-3">
        <section className="space-y-1">
          <p className="font-medium text-zinc-700">
            {(labels.auditInputs ?? "{fn}").replace("{fn}", audit.fn)}
          </p>
          {table(audit.inputs, "inputs")}
          {labels.auditDefaults ? (
            <p className="text-[11px] text-zinc-500">{labels.auditDefaults}</p>
          ) : null}
        </section>
        <section className="space-y-1">
          <p className="font-medium text-zinc-700">{labels.auditOutputs}</p>
          {table(audit.outputs, "outputs")}
        </section>
      </div>
    </details>
  );
}
