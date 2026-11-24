"use client";

import { useEffect, useState } from "react";
import { recordOrderSaleFormatAction } from "@/app/app/actions/order-sale";
import {
  quotePrice,
  unitSalePrice,
  type ItemSalePrices,
} from "@/lib/order-sale-quote";
import type { SaleFormat } from "@/lib/order-terms";
import { formatAmount } from "@/lib/workflow/money";
import { SubmitButton } from "./submit-button";
import { cx } from "./ui";

/** Um produto do pedido no card "Venda ao cliente" com os preços da cotação. */
export interface QuoteSaleLine {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  boxes: number | null;
  cbm: number | null;
  /** Os preços já cotados hoje (sem chamar o Sankhya); nulo = buscar. */
  initial: ItemSalePrices | null;
}

/** Textos do card (no idioma de quem vê). */
export interface QuoteSaleLabels {
  colProduct: string;
  colSubtotal: string;
  /** "{n} caixas". */
  lineBoxes: string;
  /** "{n} m³". */
  lineCbm: string;
  wd: string;
  wellmix: string;
  format: string;
  pickFormat: string;
  /** "Total do pedido ({format})". */
  total: string;
  /** "Soma parcial: {sum} · faltam preços em {n} de {total} produtos…" */
  partial: string;
  empty: string;
  save: string;
  saving: string;
  /** "Buscando os preços no Sankhya… {n} de {total}". */
  loading: string;
  /** "Venda gravada: {total} ({format})". */
  recorded: string;
  /** "Venda gravada antes, com o preço digitado: {total}". */
  recordedTyped: string;
  /** "Preço {format} de {name}" (leitores de tela). */
  priceOf: string;
  /** "{format}: {reason}" (o preço que não veio). */
  missingPrice: string;
  reasonNoProduct: string;
  reasonNoPrice: string;
  reasonFailed: string;
}

type Slot = ItemSalePrices | "loading" | "failed";

const round2 = (n: number) => Math.round(n * 100) / 100;
const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

/** Quantas linhas buscam o preço ao mesmo tempo (cada uma, 2 cotações). */
const POOL = 3;

/**
 * Venda ao cliente com os preços da cotação V2 do Sankhya (dono, 24/11/2026;
 * docs/ORDER_SALE.md, "Preços pela API"): WD e Wellmix lado a lado, por
 * peça, só para leitura; o formato escolhido (WD ou Wellmix) dá o subtotal e
 * o total, e "Salvar a venda" grava esse formato (o servidor refaz a conta).
 * Os preços chegam aos poucos: o pedido abre sem esperar o Sankhya.
 */
export function OrderSaleQuoteForm({
  orderId,
  lines,
  initialFormat,
  recordedFormat,
  recordedTotal,
  recordedCurrency,
  editable,
  locale,
  labels,
}: {
  orderId: string;
  lines: QuoteSaleLine[];
  initialFormat: SaleFormat | null;
  recordedFormat: SaleFormat | null;
  recordedTotal: number | null;
  /** Moeda da venda gravada (a digitada antes pode não ser o Real). */
  recordedCurrency: string | null;
  editable: boolean;
  locale: string;
  labels: QuoteSaleLabels;
}) {
  const [format, setFormat] = useState<SaleFormat | null>(initialFormat);
  const [slots, setSlots] = useState<Record<string, Slot>>(() =>
    Object.fromEntries(lines.map((l) => [l.itemId, l.initial ?? "loading"])),
  );

  // Busca, POOL por vez, as linhas sem a cotação de hoje.
  useEffect(() => {
    const queue = lines.filter((l) => !l.initial).map((l) => l.itemId);
    if (!queue.length) return;
    let cancelled = false;
    const worker = async () => {
      while (!cancelled && queue.length) {
        const itemId = queue.shift()!;
        let slot: Slot = "failed";
        try {
          const response = await fetch(
            `/api/orders/${encodeURIComponent(orderId)}/sale-prices?items=${encodeURIComponent(itemId)}`,
            { cache: "no-store" },
          );
          if (response.ok) {
            const body = (await response.json()) as {
              mode: "api" | "manual";
              prices: ItemSalePrices[];
            };
            slot = body.prices.find((p) => p.itemId === itemId) ?? "failed";
          }
        } catch {
          slot = "failed";
        }
        if (!cancelled) setSlots((prev) => ({ ...prev, [itemId]: slot }));
      }
    };
    void Promise.all(
      Array.from({ length: Math.min(POOL, queue.length) }, worker),
    );
    return () => {
      cancelled = true;
    };
  }, [orderId, lines]);

  const money = (v: number) => formatAmount(v, "BRL", locale);
  const formatName = (f: SaleFormat) =>
    f === "wd" ? labels.wd : labels.wellmix;
  const loading = lines.filter((l) => slots[l.itemId] === "loading").length;
  const subtotals = lines.map((l) => {
    const slot = slots[l.itemId];
    if (!format || typeof slot !== "object") return null;
    const unit = unitSalePrice(quotePrice(slot, format), slot.perUnit);
    return unit === null ? null : round2(unit * l.quantity);
  });
  const priced = subtotals.filter((s) => s !== null).length;
  const sum = round2(subtotals.reduce<number>((a, s) => a + (s ?? 0), 0));
  const complete = lines.length > 0 && priced === lines.length;
  const state = loading
    ? "loading"
    : !format
      ? "pick"
      : complete
        ? "complete"
        : priced > 0
          ? "partial"
          : "empty";
  const reason = (slot: Slot, which: "wd" | "wellmix"): string | null => {
    if (slot === "loading") return null;
    if (slot === "failed") return labels.reasonFailed;
    const error = which === "wd" ? slot.wdError : slot.wellmixError;
    if (!error) return null;
    if (error === "no_product") return labels.reasonNoProduct;
    if (error === "no_price") return labels.reasonNoPrice;
    return error;
  };

  const field = (which: SaleFormat, slot: Slot, name: string) => {
    const value =
      typeof slot === "object"
        ? which === "wd"
          ? slot.wd
          : slot.wellmix
        : null;
    const chosen = format === which;
    return (
      <span
        className={cx(
          "w-[6.75rem] rounded-lg border px-2 py-1 transition-colors",
          chosen
            ? "border-brand-300 bg-brand-50/70"
            : "border-zinc-200 bg-zinc-50",
        )}
        data-sale-price={which}
      >
        <span className="block text-[10px] font-semibold uppercase leading-tight tracking-wider text-zinc-500">
          {formatName(which)}
        </span>
        <output
          aria-label={fill(labels.priceOf, {
            format: formatName(which),
            name,
          })}
          className="block truncate text-sm font-medium tabular-nums text-zinc-900"
        >
          {slot === "loading" ? (
            <span className="inline-block h-3.5 w-14 animate-pulse rounded bg-zinc-200 align-middle" />
          ) : value !== null ? (
            money(value)
          ) : (
            "—"
          )}
        </output>
      </span>
    );
  };

  // Um produto em duas linhas, em qualquer largura: o nome e o subtotal em
  // cima; caixas, cubagem e quantidade (pequenos) e os dois preços embaixo.
  const table = (
    <div className="text-sm">
      <div className="flex justify-between border-b border-zinc-200 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <span>{labels.colProduct}</span>
        <span>
          {format
            ? `${labels.colSubtotal} · ${formatName(format)}`
            : labels.colSubtotal}
        </span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {lines.map((l, i) => {
          const slot = slots[l.itemId] ?? "loading";
          const problems =
            slot === "failed"
              ? [labels.reasonFailed]
              : (["wd", "wellmix"] as const)
                  .map((which) => {
                    const why = reason(slot, which);
                    return why
                      ? fill(labels.missingPrice, {
                          format: formatName(which),
                          reason: why,
                        })
                      : null;
                  })
                  .filter((p): p is string => !!p);
          return (
            <li key={l.itemId} className="py-3" data-order-sale-line={l.itemId}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-zinc-900">
                  {l.name}
                </span>
                <span
                  className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-zinc-900"
                  data-order-sale-subtotal
                >
                  {subtotals[i] !== null ? money(subtotals[i]!) : "—"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <span className="text-xs tabular-nums text-zinc-500">
                  <span data-sale-boxes>
                    {l.boxes !== null
                      ? fill(labels.lineBoxes, {
                          n: l.boxes.toLocaleString(locale),
                        })
                      : "—"}
                  </span>
                  {" · "}
                  <span data-sale-cbm>
                    {l.cbm !== null
                      ? fill(labels.lineCbm, {
                          n: l.cbm.toLocaleString(locale, {
                            maximumFractionDigits: 3,
                          }),
                        })
                      : "—"}
                  </span>
                  {" · "}
                  {l.quantity.toLocaleString(locale)} {l.unit}
                </span>
                <span className="flex gap-1.5">
                  {field("wd", slot, l.name)}
                  {field("wellmix", slot, l.name)}
                </span>
              </div>
              {problems.length ? (
                <p className="mt-1 text-right text-[11px] leading-snug text-amber-700">
                  {problems.join(" · ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const summary = (
    <div className="min-w-0 flex-1 space-y-1" data-order-sale-state={state}>
      {state === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          {fill(labels.loading, {
            n: String(lines.length - loading),
            total: String(lines.length),
          })}
        </p>
      ) : state === "pick" ? (
        <p className="text-sm text-zinc-600">{labels.pickFormat}</p>
      ) : state === "complete" ? (
        <p className="text-sm font-semibold text-zinc-900">
          {fill(labels.total, { format: formatName(format!) })}:{" "}
          <span className="tabular-nums" data-order-sale-total>
            {money(sum)}
          </span>
        </p>
      ) : state === "partial" ? (
        <p className="text-sm text-amber-800" data-order-sale-partial>
          {fill(labels.partial, {
            sum: money(sum),
            n: String(lines.length - priced),
            total: String(lines.length),
          })}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">{labels.empty}</p>
      )}
      {recordedTotal !== null ? (
        <p className="text-xs text-zinc-500" data-order-sale-recorded>
          {recordedFormat
            ? fill(labels.recorded, {
                total: money(recordedTotal),
                format: formatName(recordedFormat),
              })
            : fill(labels.recordedTyped, {
                total: formatAmount(
                  recordedTotal,
                  recordedCurrency ?? "BRL",
                  locale,
                ),
              })}
        </p>
      ) : null}
    </div>
  );

  const selector = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-600">{labels.format}</span>
      <span
        role="radiogroup"
        aria-label={labels.format}
        className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
      >
        {(["wd", "wellmix"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={format === f}
            onClick={() => setFormat(f)}
            className={cx(
              "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
              format === f
                ? "bg-white text-brand-700 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800",
            )}
            data-sale-format={f}
          >
            {formatName(f)}
          </button>
        ))}
      </span>
    </div>
  );

  const body = (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {selector}
      </div>
      {table}
    </>
  );

  if (!editable)
    return (
      <div data-order-sale-form="quote-read">
        {body}
        <div className="mt-3 border-t border-zinc-200 pt-3">{summary}</div>
      </div>
    );

  return (
    <form action={recordOrderSaleFormatAction} data-order-sale-form="quote">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="format" value={format ?? ""} />
      {body}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3">
        {summary}
        <SubmitButton
          pendingText={labels.saving}
          disabled={!format || loading > 0 || priced === 0}
          data-order-sale-save
        >
          {labels.save}
        </SubmitButton>
      </div>
    </form>
  );
}
