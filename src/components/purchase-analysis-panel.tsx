"use client";

import { Fragment, useEffect, useState } from "react";
import type { PurchaseAnalysis } from "@/lib/services/purchase-analysis";
import {
  splitRecommendation,
  type DemandEstimate,
} from "@/lib/purchase-forecast";
import { ROUNDS_EVENT, type RoundsEventDetail } from "./selection-quantity";

/** O formulário da Nova solicitação (as linhas escutam o evento nele). */
const FORM_ID = "new-request-form";
import { useRequestCustomer } from "./request-customer-context";
import { cx } from "./ui";

/** Textos da aba Análise (no idioma de quem vê). */
export interface PurchaseAnalysisLabels {
  /** Sem produto aberto no pedido. */
  pick: string;
  loading: string;
  error: string;
  retry: string;
  noProductCode: string;
  /** "Somando {n} empresas do grupo econômico". */
  group: string;
  /** "Compras por ano (histórico inteiro)". */
  historyTitle: string;
  historyEmpty: string;
  year: string;
  month: string;
  quantity: string;
  purchases: string;
  /** "Abrir os meses de {year}". */
  expandYear: string;
  /** "Estimativa de demanda". */
  estimateTitle: string;
  estimateFew: string;
  /** Mês | Ano. */
  byMonth: string;
  byYear: string;
  monthly: string;
  trend: string;
  /** "{n} peças/mês a cada mês". */
  trendValue: string;
  last: string;
  runOut: string;
  suggestion: string;
  /** "Comprar em {date}: {q} peças (4 meses antes de acabar)". */
  suggestionValue: string;
  late: string;
  how: string;
  mixedUnits: string;
  pieces: string;
  /** Valor (R$), só com "Ver valores e margem". */
  value?: string;
  /** "Expandir tudo" / "Recolher tudo". */
  expandAll?: string;
  collapseAll?: string;
  /** "Usar a recomendação" e o aviso "{q} peças em {n} entregas". */
  use?: string;
  applied?: string;
}

type Loaded = {
  key: string;
  attempt: number;
  result: PurchaseAnalysis | { state: "no_product_code" } | null;
  failed: boolean;
};

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

/**
 * Aba Análise do histórico de compras (dono, 19/11/2026;
 * docs/PURCHASE_HISTORY.md seção 12): o produto da linha aberta no pedido
 * (só uma fica aberta), com a quantidade comprada por ano (que abre nos
 * meses) no histórico inteiro do cliente, somando o grupo econômico, e a
 * estimativa de demanda por mês ou por ano com a sugestão da próxima compra.
 */
export function PurchaseAnalysisPanel({
  customerId,
  labels,
  intl,
}: {
  customerId: string;
  labels: PurchaseAnalysisLabels;
  intl: string;
}) {
  const shared = useRequestCustomer();
  const focus = shared?.focusProduct ?? null;
  const productId = focus?.productId ?? null;
  const key = productId ? `${customerId}|${productId}` : null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Anos abertos (dono, 20/11/2026: também "Expandir tudo / Recolher tudo").
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggleYear = (year: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  const [applied, setApplied] = useState<string | null>(null);
  const [by, setBy] = useState<"month" | "year">("month");

  useEffect(() => {
    if (!key || !productId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/purchase-history/sankhya?${new URLSearchParams({
            customer: customerId,
            view: "analysis",
            product: productId,
          }).toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Loaded["result"];
        setLoaded({ key, attempt, result: body, failed: false });
      } catch {
        if (controller.signal.aborted) return;
        setLoaded({ key, attempt, result: null, failed: true });
      }
    })();
    return () => controller.abort();
  }, [key, attempt, customerId, productId]);

  const qty = (n: number) =>
    Math.round(n).toLocaleString(intl, { maximumFractionDigits: 0 });
  const date = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(intl, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const monthName = (ym: string) =>
    new Date(`${ym}-15T00:00:00`).toLocaleDateString(intl, {
      month: "short",
      year: "numeric",
    });

  const money = (n: number | null) =>
    n === null
      ? "—"
      : n.toLocaleString(intl, { style: "currency", currency: "BRL" });
  /**
   * "Usar a recomendação" (dono, 20/11/2026): a quantidade sugerida vai para
   * a linha aberta, repartida nas entregas do pedido pela demanda prevista
   * de cada uma, em caixas inteiras. A matriz das empresas do grupo
   * acompanha, na distribuição dele; o percentual geral do pedido não muda.
   */
  function applyRecommendation(estimate: DemandEstimate) {
    const row = focus?.rowIndex;
    if (row === undefined) return;
    const load = shared?.loads[`row-${row}`];
    const quantities = splitRecommendation(
      estimate,
      shared?.planDates ?? [],
      load?.masterCartonQty ?? null,
    );
    document.getElementById(FORM_ID)?.dispatchEvent(
      new CustomEvent<RoundsEventDetail>(ROUNDS_EVENT, {
        detail: { prefix: `p${row}.`, quantities },
      }),
    );
    setApplied(
      fill(labels.applied ?? "", {
        q: qty(quantities.reduce((a, b) => a + b, 0)),
        n: quantities.length,
      }),
    );
  }

  if (!key)
    return (
      <p className="text-sm text-zinc-500" data-purchase-analysis="pick">
        {labels.pick}
      </p>
    );
  const mine =
    loaded && loaded.key === key && loaded.attempt === attempt ? loaded : null;
  if (!mine)
    return (
      <p className="text-sm text-zinc-500" role="status">
        {labels.loading}
      </p>
    );
  const result = mine.result;
  if (mine.failed || !result || result.state === "error")
    return (
      <p className="text-sm text-red-700" role="alert">
        {labels.error}
        {result?.state === "error" ? (
          <span className="block text-xs text-red-600">{result.message}</span>
        ) : null}{" "}
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={() => setAttempt((n) => n + 1)}
        >
          {labels.retry}
        </button>
      </p>
    );
  if (result.state === "no_product_code")
    return (
      <p className="text-sm text-zinc-500" data-purchase-analysis="no-code">
        {labels.noProductCode}
      </p>
    );
  if (result.state !== "ok") return null;
  const e = result.estimate;
  const table =
    "w-full text-left text-xs [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1";
  return (
    <div className="space-y-4" data-purchase-analysis="ready">
      <div>
        <p className="text-sm font-semibold text-zinc-900">
          {result.product.name || focus?.name}
        </p>
        {result.companies > 1 ? (
          <p className="text-xs text-zinc-500" data-purchase-analysis-group>
            {fill(labels.group, { n: result.companies })}
          </p>
        ) : null}
        {result.mixedUnits ? (
          <p className="mt-1 text-xs text-amber-800">{labels.mixedUnits}</p>
        ) : null}
      </div>

      <section className="space-y-1.5" data-purchase-analysis-history>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {labels.historyTitle}
          </h3>
          {result.years.length && labels.expandAll ? (
            <button
              type="button"
              onClick={() =>
                setOpen(
                  open.size === result.years.length
                    ? new Set()
                    : new Set(result.years.map((y) => y.year)),
                )
              }
              className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
              data-purchase-analysis-expand-all={
                open.size === result.years.length ? "collapse" : "expand"
              }
            >
              {open.size === result.years.length
                ? labels.collapseAll
                : labels.expandAll}
            </button>
          ) : null}
        </div>
        {result.years.length ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className={table}>
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="font-medium">{labels.year}</th>
                  <th className="text-right font-medium">{labels.quantity}</th>
                  {result.money && labels.value ? (
                    <th className="text-right font-medium">{labels.value}</th>
                  ) : null}
                  <th className="text-right font-medium">{labels.purchases}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {result.years.map((y) => (
                  <Fragment key={y.year}>
                    <tr data-purchase-analysis-year={y.year}>
                      <td>
                        <button
                          type="button"
                          aria-expanded={open.has(y.year)}
                          aria-label={fill(labels.expandYear, { year: y.year })}
                          onClick={() => toggleYear(y.year)}
                          className="inline-flex items-center gap-1 font-semibold text-zinc-900 hover:text-brand-700"
                          data-purchase-analysis-year-toggle={y.year}
                        >
                          <span
                            aria-hidden
                            className={cx(
                              "inline-block transition-transform",
                              open.has(y.year) && "rotate-90",
                            )}
                          >
                            ›
                          </span>
                          {y.year}
                        </button>
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {qty(y.quantity)}
                      </td>
                      {result.money && labels.value ? (
                        <td className="text-right tabular-nums">
                          {money(y.value)}
                        </td>
                      ) : null}
                      <td className="text-right tabular-nums text-zinc-600">
                        {y.purchases}
                      </td>
                    </tr>
                    {open.has(y.year)
                      ? y.months.map((m) => (
                          <tr
                            key={m.month}
                            // Mês sem compra: zero, apagado (o buraco aparece).
                            className={cx(
                              "bg-zinc-50/60",
                              !m.purchases && "text-zinc-400",
                            )}
                            data-purchase-analysis-month={m.month}
                            data-purchase-analysis-month-empty={
                              m.purchases ? undefined : ""
                            }
                          >
                            <td
                              className={cx(
                                "pl-6",
                                m.purchases ? "text-zinc-600" : "",
                              )}
                            >
                              {monthName(m.month)}
                            </td>
                            <td className="text-right tabular-nums">
                              {qty(m.quantity)}
                            </td>
                            {result.money && labels.value ? (
                              <td className="text-right tabular-nums">
                                {money(m.value)}
                              </td>
                            ) : null}
                            <td className="text-right tabular-nums">
                              {m.purchases}
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">{labels.historyEmpty}</p>
        )}
      </section>

      <section className="space-y-1.5" data-purchase-analysis-estimate>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {labels.estimateTitle}
          </h3>
          {e ? (
            <div className="flex gap-1" role="group">
              {(["month", "year"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={by === v}
                  onClick={() => setBy(v)}
                  data-purchase-analysis-by={v}
                  className={cx(
                    "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                    by === v
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
                  )}
                >
                  {v === "month" ? labels.byMonth : labels.byYear}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!e ? (
          <p className="text-xs text-zinc-500" data-purchase-analysis-few>
            {labels.estimateFew}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs">
              <dt className="text-zinc-500">{labels.monthly}</dt>
              <dd
                className="text-right font-semibold tabular-nums"
                data-purchase-analysis-monthly={e.monthly}
              >
                {qty(e.monthly)} {labels.pieces}
              </dd>
              <dt className="text-zinc-500">{labels.trend}</dt>
              <dd className="text-right tabular-nums">
                {fill(labels.trendValue, {
                  n: `${e.slope >= 0 ? "+" : "−"}${qty(Math.abs(e.slope))}`,
                })}
              </dd>
              <dt className="text-zinc-500">{labels.last}</dt>
              <dd className="text-right tabular-nums">
                {date(e.last.date)} · {qty(e.last.quantity)} {labels.pieces}
              </dd>
              <dt className="text-zinc-500">{labels.runOut}</dt>
              <dd className="text-right tabular-nums">{date(e.runOut)}</dd>
            </dl>
            <p
              className={cx(
                "rounded-lg px-2.5 py-2 text-xs font-medium",
                e.late
                  ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                  : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
              )}
              data-purchase-analysis-suggestion={e.suggestedDate}
            >
              <span className="block text-[11px] uppercase tracking-wide opacity-80">
                {labels.suggestion}
              </span>
              {fill(labels.suggestionValue, {
                date: date(e.suggestedDate),
                q: qty(e.suggestedQuantity),
              })}
              {e.late ? ` ${labels.late}` : ""}
              {labels.use ? (
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyRecommendation(e)}
                    disabled={focus?.rowIndex === undefined}
                    className="rounded-md bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                    data-purchase-analysis-use
                  >
                    {labels.use}
                  </button>
                  {applied ? (
                    <span
                      role="status"
                      className="text-[11px] font-normal"
                      data-purchase-analysis-applied
                    >
                      {applied}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className={table}>
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="font-medium">
                      {by === "month" ? labels.month : labels.year}
                    </th>
                    <th className="text-right font-medium">
                      {labels.quantity}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(by === "month"
                    ? e.months.map(
                        (m) =>
                          [monthName(m.month), m.quantity, m.month] as const,
                      )
                    : e.years.map((y) => [y.year, y.quantity, y.year] as const)
                  ).map(([label, q, k]) => (
                    <tr key={k} data-purchase-analysis-forecast={k}>
                      <td className="text-zinc-700">{label}</td>
                      <td className="text-right tabular-nums">{qty(q)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {labels.how}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
