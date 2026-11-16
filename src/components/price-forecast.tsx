"use client";

import { useEffect, useState } from "react";
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
  /** Linhas antigas (a tela mostra só "Preço" e "Valor total" desde 16/11/2026). */
  sale: string;
  table: string;
  wholesale: string;
  retail: string;
  goal: string;
  cost: string;
  profit: string;
  profitValue: string;
  /** "Para vender a {target} por peça: preço máximo de compra". */
  resultTarget: string;
  targetLocked?: string;
  source: string;
  auditTitle?: string;
  auditInputs?: string;
  auditDefaults?: string;
  auditOutputs?: string;
  /** Vê o preço máximo de compra (custo): só com "Ver valores e margem". */
  canSolve?: boolean;
  /** Cotação de encomenda V2 (dono, 16/11/2026). */
  productPrice?: string;
  freightUnit?: string;
  withFreight?: string;
  wdPrice?: string;
  wdWithFreight?: string;
  wdBase?: string;
  wdPercent?: string;
  goalReached?: string;
  goalYes?: string;
  goalNo?: string;
  freightPending?: string;
  quotePending?: string;
  sent?: string;
  freightNull?: string;
  formats?: Record<string, string>;
  /** "Preço" e "Valor total" (preço × quantidade) do produto. */
  price?: string;
  rowTotal?: string;
  /** Sem a quantidade, o valor total espera. */
  noQuantity?: string;
}

type Mode = "view" | "target";

const DEBOUNCE_MS = 600;

/**
 * Previsão de preço ao cliente final de um produto da Nova solicitação
 * (dono, 15 e 16/11/2026; docs/ORDER_TERMS.md 11.8): a conta é da cotação
 * V2 do Sankhya e roda sozinha quando o produto é escolhido e sempre que
 * muda algo que vai para ela (quantidade, cliente, formato, nível, quem
 * chama o transportador, valor do transporte). Mostra só o **Preço**: o
 * preço com frete (referência) quando a Wellmix chama o transportador, e o
 * preço WD quando é o cliente; e o **Valor total** (preço × quantidade),
 * que as condições do pedido somam. "Informar o preço de venda desejado"
 * só na compra para estoque. Sem a API, a tela diz e nada é estimado.
 */
export function PriceForecast({
  productId,
  quantity,
  rowKey,
  labels,
  className,
}: {
  /** Produto do catálogo da linha ("" sem produto). */
  productId: string;
  quantity: string;
  /** Linha do formulário (o valor total vai para a soma do pedido). */
  rowKey?: string;
  labels: PriceForecastLabels;
  className?: string;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  // O preço de venda desejado só na compra para estoque (dono, 16/11/2026).
  const canTarget = (labels.canSolve ?? true) && stock;
  const [chosenMode, setMode] = useState<Mode>("view");
  const mode: Mode = canTarget ? chosenMode : "view";
  const [target, setTarget] = useState("");
  const [answer, setAnswer] = useState<{
    for: string;
    value: PriceForecastAnswer | "error";
    target: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const pieces = Math.floor(Number(quantity.replace(",", ".")));
  const piecesOk = Number.isFinite(pieces) && pieces > 0;
  const targetNumber = Number(target.replace(",", "."));
  const targetOk = Number.isFinite(targetNumber) && targetNumber > 0;
  const terms = stock ? null : (shared?.saleTerms ?? null);
  const caller = terms?.carrierCaller ?? null;

  // O que vai para a API: quando muda, a conta roda de novo.
  // (Uma string: o efeito abaixo só roda quando ela muda.)
  const query = (() => {
    if (!productId || (mode === "target" && !targetOk)) return null;
    const params = new URLSearchParams({ productId });
    if (piecesOk) params.set("quantity", String(pieces));
    const customerId = shared?.customer?.id;
    if (!stock && customerId) params.set("customerId", customerId);
    if (terms?.saleFormat) params.set("saleFormat", terms.saleFormat);
    if (terms?.wellmixTier) params.set("tier", terms.wellmixTier);
    if (terms?.carrierCaller) params.set("caller", terms.carrierCaller);
    const freight = terms?.deliveryFreightBrl;
    if (freight !== null && freight !== undefined)
      params.set("freight", String(freight));
    if (mode === "target") params.set("target", String(targetNumber));
    return params.toString();
  })();

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/price-forecast?${query}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const value = (await res.json()) as PriceForecastAnswer;
        setAnswer({
          for: query,
          value,
          target: mode === "target" ? targetNumber : null,
        });
      } catch {
        if (!controller.signal.aborted)
          setAnswer({ for: query, value: "error", target: null });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, mode, targetNumber]);

  const shown = answer && answer.for === query ? answer : null;
  const forecast =
    shown &&
    shown.value !== "error" &&
    shown.value.mode === "api" &&
    shown.value.kind === "forecast"
      ? shown.value
      : null;
  // Preço na tela (dono, 16/11/2026): formato WD → PRECO_WD_COM_FRETE_
  // REFERENCIA; Wellmix chamando o transportador → PRECO_COM_FRETE_
  // REFERENCIA. Os dois com o "Valor do transporte (R$)" enviado na chamada.
  // Fora disso (formato Wellmix e o cliente chama), o WD como antes.
  const wd = terms?.saleFormat === "wd";
  const price = forecast
    ? wd
      ? (forecast.wdWithFreight ?? null)
      : caller === "wellmix"
        ? (forecast.withFreight ?? null)
        : caller === "customer"
          ? (forecast.wdPrice ?? null)
          : (forecast.withFreight ?? forecast.productPrice ?? null)
    : null;
  const total = price !== null && piecesOk ? price * pieces : null;

  // O valor total da linha vai para a soma do pedido.
  const setRowTotal = shared?.setRowTotal;
  useEffect(() => {
    if (!rowKey || !setRowTotal) return;
    setRowTotal(rowKey, mode === "view" ? total : null);
  }, [rowKey, setRowTotal, total, mode]);
  useEffect(
    () => () => {
      if (rowKey) setRowTotal?.(rowKey, null);
    },
    [rowKey, setRowTotal],
  );

  const money = (n: number | null) =>
    n === null
      ? "—"
      : n.toLocaleString(labels.intl, { style: "currency", currency: "BRL" });
  const num = (n: number, digits = 2) =>
    n.toLocaleString(labels.intl, { maximumFractionDigits: digits });
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
      aria-busy={loading}
      data-price-forecast
      data-price-forecast-loading={loading ? "1" : undefined}
    >
      <p className="text-sm font-semibold text-zinc-900">{labels.title}</p>
      {!productId ? (
        <p className="text-zinc-500" data-price-forecast-no-product>
          {labels.noProduct}
        </p>
      ) : (
        <>
          {canTarget ? (
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
          ) : null}
          {mode === "target" ? (
            <label className="block space-y-1">
              <span className="block font-medium text-zinc-700">
                {labels.targetField}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => {
                  // Enter não envia a solicitação.
                  if (e.key === "Enter") e.preventDefault();
                }}
                data-price-forecast-target
                className={cx(inputDenseClass, "w-36 tabular-nums")}
              />
            </label>
          ) : null}
          {loading && !shown ? (
            <p className="text-zinc-500" role="status">
              {labels.loading}
            </p>
          ) : null}
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
                className={cx(
                  "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-emerald-950",
                  loading && "opacity-60",
                )}
                role="status"
                data-price-forecast-result="forecast"
              >
                <dt className="text-emerald-800">{labels.price ?? "Preço"}</dt>
                <dd
                  className="font-semibold tabular-nums"
                  data-price-forecast-line="price"
                >
                  {money(price)}
                </dd>
                <dt className="text-emerald-800">
                  {labels.rowTotal ?? "Valor total"}
                </dt>
                <dd
                  className="font-semibold tabular-nums"
                  data-price-forecast-line="total"
                >
                  {total !== null
                    ? money(total)
                    : price !== null
                      ? (labels.noQuantity ?? "—")
                      : "—"}
                </dd>
                {shown.value.status === "FRETE_PENDENTE" &&
                labels.freightPending ? (
                  <p
                    className="col-span-2 pt-0.5 text-[11px] font-medium text-amber-800"
                    data-price-forecast-status="FRETE_PENDENTE"
                  >
                    {labels.freightPending}
                  </p>
                ) : shown.value.status === "PENDENTE" && labels.quotePending ? (
                  <p
                    className="col-span-2 pt-0.5 text-[11px] font-medium text-amber-800"
                    data-price-forecast-status="PENDENTE"
                  >
                    {labels.quotePending}
                  </p>
                ) : null}
              </dl>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
