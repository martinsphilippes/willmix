"use client";

import { useState } from "react";
import { recordOrderSaleAction } from "@/app/app/actions/order-sale";
import { CURRENCIES } from "@/lib/currencies";
import { formatAmount } from "@/lib/workflow/money";
import { MoneyInput } from "./money-input";
import { SubmitButton } from "./submit-button";
import { Select, cx } from "./ui";

/** Um produto do pedido no card "Venda ao cliente". */
export interface OrderSaleLine {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
}

/** Textos do card (no idioma de quem vê). */
export interface OrderSaleLabels {
  colProduct: string;
  colQty: string;
  colUnit: string;
  colSubtotal: string;
  currency: string;
  total: string;
  /** "Soma parcial: {sum} · faltam preços em {n} de {total} produtos…" */
  partial: string;
  /** "Total gravado antes, sem preço por produto: {total}…" */
  legacy: string;
  empty: string;
  save: string;
  saving: string;
  /** "Preço de venda de {name}" (rótulo do campo, para leitores de tela). */
  priceOf: string;
  /** Nome de cada moeda (BRL → "Real (BRL)"…). */
  currencyNames: Record<string, string>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

/**
 * Venda ao cliente por pedido e por produto (dono, 14/11/2026;
 * docs/ORDER_SALE.md): preço por produto, subtotal e o total do pedido (a
 * soma), recalculados enquanto se digita. Quem não grava vê a mesma tabela
 * só para leitura. O servidor confere a permissão e refaz a conta.
 */
export function OrderSaleForm({
  orderId,
  lines,
  currency,
  recordedTotal,
  editable,
  locale,
  labels,
}: {
  orderId: string;
  lines: OrderSaleLine[];
  currency: string;
  recordedTotal: number | null;
  editable: boolean;
  locale: string;
  labels: OrderSaleLabels;
}) {
  const [code, setCode] = useState(currency);
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.itemId,
        l.unitPrice === null ? "" : String(l.unitPrice),
      ]),
    ),
  );
  const unitOf = (itemId: string) => {
    const value = raw[itemId];
    if (value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const subtotals = lines.map((l) => {
    const unit = unitOf(l.itemId);
    return unit === null ? null : round2(unit * l.quantity);
  });
  const priced = subtotals.filter((s) => s !== null).length;
  const sum = round2(subtotals.reduce<number>((a, s) => a + (s ?? 0), 0));
  const complete = lines.length > 0 && priced === lines.length;
  const money = (v: number) => formatAmount(v, code, locale);
  const state = complete
    ? "complete"
    : priced > 0
      ? "partial"
      : recordedTotal !== null
        ? "legacy"
        : "empty";

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-3">{labels.colProduct}</th>
            <th className="py-2 pr-3 text-right">{labels.colQty}</th>
            <th className="w-44 py-2 pr-3 text-right">{labels.colUnit}</th>
            <th className="py-2 text-right">{labels.colSubtotal}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {lines.map((l, i) => {
            const unit = unitOf(l.itemId);
            const subtotal = subtotals[i];
            return (
              <tr key={l.itemId} data-order-sale-line={l.itemId}>
                <td className="py-2 pr-3 font-medium text-zinc-900">
                  {l.name}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">
                  {l.quantity.toLocaleString(locale)} {l.unit}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {editable ? (
                    <>
                      <label
                        htmlFor={`sale-price-${l.itemId}`}
                        className="sr-only"
                      >
                        {fill(labels.priceOf, { name: l.name })}
                      </label>
                      <MoneyInput
                        id={`sale-price-${l.itemId}`}
                        name={`price.${l.itemId}`}
                        watchField="currency"
                        defaultAmount={l.unitPrice}
                        locale={locale}
                        className="w-40"
                        onValueChange={(v) =>
                          setRaw((prev) => ({ ...prev, [l.itemId]: v }))
                        }
                      />
                    </>
                  ) : unit !== null ? (
                    money(unit)
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className="whitespace-nowrap py-2 text-right tabular-nums"
                  data-order-sale-subtotal
                >
                  {subtotal !== null ? money(subtotal) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const summary = (
    <div
      className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-zinc-200 pt-3"
      data-order-sale-state={state}
    >
      {state === "complete" ? (
        <p className="text-sm font-semibold text-zinc-900">
          {labels.total}:{" "}
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
      ) : state === "legacy" ? (
        <p className="text-sm text-zinc-700" data-order-sale-legacy>
          {fill(labels.legacy, { total: money(recordedTotal!) })}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">{labels.empty}</p>
      )}
    </div>
  );

  if (!editable)
    return (
      <div data-order-sale-form="read">
        {table}
        {summary}
      </div>
    );

  return (
    <form action={recordOrderSaleAction} data-order-sale-form="edit">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            {labels.currency}
          </span>
          <Select
            name="currency"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            dense
            data-order-sale-currency
          >
            {!(CURRENCIES as readonly string[]).includes(code) ? (
              <option value={code}>{code}</option>
            ) : null}
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {labels.currencyNames[c] ?? c}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {table}
      <div className={cx("flex flex-wrap items-center justify-between gap-3")}>
        <div className="min-w-0 flex-1">{summary}</div>
        <SubmitButton pendingText={labels.saving} data-order-sale-save>
          {labels.save}
        </SubmitButton>
      </div>
    </form>
  );
}
