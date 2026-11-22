"use client";

import { useEffect, useState } from "react";
import type {
  PriceForecastAnswer,
  SuperplanAudit,
} from "@/lib/integrations/price-forecast";
import { QuickDialog } from "./quick-dialog";
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
  /**
   * Modal "Ver o cálculo" (dono, 19/11/2026): os parâmetros enviados ao
   * Sankhya e o que voltou, com o que cada um é. Só com "Ver valores e
   * margem" (a memória de cálculo tem custo e margem).
   */
  auditOpen?: string;
  auditClose?: string;
  auditIntro?: string;
  auditParam?: string;
  auditValue?: string;
  auditMeaning?: string;
  auditUsed?: string;
  /** O que é cada parâmetro (nome do Sankhya → texto). */
  params?: Record<string, string>;
  /** "Exportar JSON" no canto do modal (dono, 20/11/2026). */
  auditExport?: string;
  /** "Preço {format} - com frete" e, sem formato, "Preço - com frete". */
  priceOf?: string;
  priceNoFormat?: string;
  /**
   * O mesmo preço sem frete (dono, 22/11/2026): "Preço {format} - sem
   * frete" e, sem formato, "Preço - sem frete".
   */
  priceOfNoFreight?: string;
  priceNoFormatNoFreight?: string;
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
 * Uma chamada de cada vez desta tela (dono, 19/11/2026): o Sankhya recusa
 * duas requisições simultâneas da mesma sessão ("situação de concorrência").
 */
let forecastQueue: Promise<unknown> = Promise.resolve();
function queued<T>(task: () => Promise<T>): Promise<T> {
  const run = forecastQueue.then(task, task);
  forecastQueue = run.catch(() => undefined);
  return run;
}

/**
 * Previsão de preço ao cliente final de um produto da Nova solicitação
 * (dono, 15 e 16/11/2026; docs/ORDER_TERMS.md 11.8): a conta é da cotação
 * V2 do Sankhya e roda sozinha quando o produto é escolhido e sempre que
 * muda algo que vai para ela (quantidade, cliente, formato, nível, quem
 * chama o transportador, valor do transporte). Mostra os dois preços do
 * formato escolhido, **sem frete** e **com frete** (dono, 22/11/2026;
 * docs/ORDER_TERMS.md 11.26), e o **Valor total** (preço com frete ×
 * quantidade), que as condições do pedido somam. "Informar o preço de venda desejado"
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

  // O que vai para a API: quando muda, a conta roda de novo.
  // (Uma string: o efeito abaixo só roda quando ela muda.)
  const query = (() => {
    if (!productId || (mode === "target" && !targetOk)) return null;
    const params = new URLSearchParams({ productId });
    // Sem a quantidade nem os containers (dono, 19/11/2026: o preço por
    // peça não depende deles; o valor total é preço × peças aqui na tela).
    // Uma chamada por produto: mexer nas quantidades não chama o Sankhya.
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
        const res = await queued(() =>
          controller.signal.aborted
            ? Promise.reject(new Error("aborted"))
            : fetch(`/api/price-forecast?${query}`, {
                signal: controller.signal,
              }),
        );
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
  // Os dois preços do formato escolhido (dono, 22/11/2026): sem frete e
  // com frete. Formato WD → PRECO_WD_REFERENCIA e
  // PRECO_WD_COM_FRETE_REFERENCIA; os demais (Wellmix ou sem formato) →
  // PRECO_PRODUTO_META e PRECO_COM_FRETE_REFERENCIA. O frete é o "Valor do
  // transporte (R$)" digitado ou, sem ele, o padrão das Configurações. O
  // valor total segue com frete (dono, 16/11/2026).
  const wd = terms?.saleFormat === "wd";
  const formatName = !terms?.saleFormat
    ? null
    : wd
      ? labels.formats?.wd
      : terms.wellmixTier
        ? labels.formats?.[terms.wellmixTier]
        : labels.formats?.wellmix;
  const priceLabel =
    formatName && labels.priceOf
      ? labels.priceOf.replace("{format}", formatName)
      : (labels.priceNoFormat ?? labels.price ?? "Preço");
  const priceNoFreightLabel =
    formatName && labels.priceOfNoFreight
      ? labels.priceOfNoFreight.replace("{format}", formatName)
      : (labels.priceNoFormatNoFreight ?? null);
  const price = forecast
    ? wd
      ? (forecast.wdWithFreight ?? null)
      : (forecast.withFreight ?? null)
    : null;
  const priceNoFreight = forecast
    ? wd
      ? (forecast.wdPrice ?? null)
      : (forecast.productPrice ?? null)
    : null;
  const total = price !== null && piecesOk ? price * pieces : null;
  // Memória de cálculo (só vem para quem vê valores e margem).
  const audit =
    shown && shown.value !== "error" && shown.value.mode === "api"
      ? (shown.value.audit ?? null)
      : null;
  const shownColumns = wd
    ? ["PRECO_WD_REFERENCIA", "PRECO_WD_COM_FRETE_REFERENCIA"]
    : ["PRECO_PRODUTO_META", "PRECO_COM_FRETE_REFERENCIA"];

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
                {/* Os dois preços do formato escolhido (dono, 22/11/2026):
                    sem frete e com frete. */}
                {priceNoFreightLabel ? (
                  <>
                    <dt
                      className="text-emerald-800"
                      data-price-forecast-price-no-freight-label
                    >
                      {priceNoFreightLabel}
                    </dt>
                    <dd
                      className="font-semibold tabular-nums"
                      data-price-forecast-line="priceNoFreight"
                    >
                      {money(priceNoFreight)}
                    </dd>
                  </>
                ) : null}
                <dt
                  className="text-emerald-800"
                  data-price-forecast-price-label
                >
                  {priceLabel}
                </dt>
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
          {audit && labels.auditOpen && labels.canSolve ? (
            <QuickDialog
              label={labels.auditOpen}
              title={labels.auditTitle ?? labels.title}
              closeLabel={labels.auditClose ?? "×"}
              size="lg"
              data-price-forecast-audit-open=""
              headerActions={
                labels.auditExport ? (
                  <button
                    type="button"
                    onClick={() =>
                      exportAnswer(
                        productId,
                        shown?.value === "error"
                          ? null
                          : (shown?.value ?? null),
                      )
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                    data-price-forecast-audit-export
                  >
                    {labels.auditExport}
                  </button>
                ) : null
              }
            >
              <AuditBody
                audit={audit}
                labels={labels}
                shownColumns={shownColumns}
              />
            </QuickDialog>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Exporta a resposta da cotação em JSON (dono, 20/11/2026): o que foi
 * enviado à função (por nome), o que ela devolveu e a resposta do portal,
 * para importar no Sankhya e conferir o que divergiu.
 */
function exportAnswer(productId: string, answer: PriceForecastAnswer | null) {
  if (!answer || answer.mode !== "api") return;
  const audit = answer.audit ?? null;
  const data = {
    exportedAt: new Date().toISOString(),
    productId,
    function: audit?.fn ?? null,
    inputs: audit ? Object.fromEntries(audit.inputs) : null,
    outputs: audit ? Object.fromEntries(audit.outputs) : null,
    answer,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cotacao-${productId}-${data.exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Conteúdo do modal "Ver o cálculo": enviado e devolvido, com o que é. */
function AuditBody({
  audit,
  labels,
  shownColumns,
}: {
  audit: SuperplanAudit;
  labels: PriceForecastLabels;
  /** As colunas que estão na tela (sem frete e com frete). */
  shownColumns: readonly string[];
}) {
  const value = (v: string | number | null) =>
    v === null || v === ""
      ? "—"
      : typeof v === "number"
        ? v.toLocaleString(labels.intl, { maximumFractionDigits: 6 })
        : String(v);
  const table = (
    rows: Array<[string, string | number | null]>,
    marker: string,
  ) => (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full min-w-[30rem] text-left text-xs">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            <th className="px-2.5 py-1.5 font-medium">{labels.auditParam}</th>
            <th className="px-2.5 py-1.5 text-right font-medium">
              {labels.auditValue}
            </th>
            <th className="px-2.5 py-1.5 font-medium">{labels.auditMeaning}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map(([name, v]) => {
            const used = shownColumns.includes(name);
            return (
              <tr
                key={name}
                className={used ? "bg-emerald-50 font-semibold" : undefined}
                {...{ [`data-price-forecast-audit-${marker}`]: name }}
              >
                <td className="px-2.5 py-1 font-mono text-[11px] text-zinc-800">
                  {name}
                </td>
                <td className="px-2.5 py-1 text-right tabular-nums text-zinc-900">
                  {value(v)}
                </td>
                <td className="px-2.5 py-1 text-zinc-600">
                  {labels.params?.[name] ?? "—"}
                  {used && labels.auditUsed ? (
                    <span className="ml-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                      {labels.auditUsed}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-3 text-sm" data-price-forecast-audit>
      {labels.auditIntro ? (
        <p className="text-xs leading-relaxed text-zinc-600">
          {labels.auditIntro}
        </p>
      ) : null}
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold text-zinc-800">
          {(labels.auditInputs ?? "{fn}").replace("{fn}", audit.fn)}
        </h3>
        {table(audit.inputs, "input")}
        {labels.auditDefaults ? (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {labels.auditDefaults}
          </p>
        ) : null}
      </section>
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold text-zinc-800">
          {labels.auditOutputs}
        </h3>
        {table(audit.outputs, "output")}
      </section>
    </div>
  );
}
