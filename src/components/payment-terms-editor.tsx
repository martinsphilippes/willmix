"use client";

import { useState, type ReactNode } from "react";
import type { PaymentTermBase, PaymentTermInstallment } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import { SubmitButton } from "./submit-button";
import { Button, cx, inputClass } from "./ui";

/*
 * Parcelas da condição de pagamento ao fornecedor: % do FOB, marco (pedido,
 * embarque, entrega) e dias depois. Cada linha mostra em palavras quando vence;
 * o total precisa dar 100% (o botão só salva assim; o servidor confere de novo).
 * Linha vazia não conta: apagar todas e salvar deixa "sem condição".
 */

interface Row {
  id: number;
  percent: string;
  base: PaymentTermBase;
  days: string;
}

export interface PaymentTermsTexts {
  percent: string;
  base: string;
  days: string;
  add: string;
  /** "Remover parcela {n}" */
  remove: string;
  /** "Total {sum}%" */
  sum: string;
  sumOff: string;
  presets: string;
  save: string;
  /** "Parcela {n}/{count}" */
  installment: string;
  /** Parcela fora do que o servidor aceita (% ou dias). */
  rowInvalid: string;
  /** Máximo de dias depois do marco (o mesmo do servidor). */
  maxDays: number;
  baseLabels: Record<PaymentTermBase, string>;
  /** Por marco: texto com 0 dias e com {days} dias. */
  when: Record<PaymentTermBase, { zero: string; days: string }>;
}

const MAX_ROWS = 6;

const PRESETS: PaymentTermInstallment[][] = [
  [{ percent: 100, base: "delivered", days: 60 }],
  [{ percent: 100, base: "order_created", days: 90 }],
  [
    { percent: 30, base: "order_created", days: 0 },
    { percent: 70, base: "delivered", days: 90 },
  ],
  [
    { percent: 30, base: "order_created", days: 0 },
    { percent: 70, base: "shipped", days: 0 },
  ],
];

export function PaymentTermsEditor({
  initial,
  bases,
  texts,
  locale,
  children,
}: {
  initial: PaymentTermInstallment[];
  bases: readonly PaymentTermBase[];
  texts: PaymentTermsTexts;
  locale: string;
  /** Campos extras antes do botão de salvar (ex.: observação). */
  children?: ReactNode;
}) {
  const toRows = (terms: PaymentTermInstallment[]) =>
    terms.map((term, i) => ({
      id: i + 1,
      percent: String(term.percent).replace(
        ".",
        locale.startsWith("pt") ? "," : ".",
      ),
      base: term.base,
      days: String(term.days),
    }));
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length
      ? toRows(initial)
      : [{ id: 1, percent: "", base: "order_created", days: "" }],
  );
  const [nextId, setNextId] = useState(initial.length + 2);

  const fmt = (n: number) =>
    n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const when = (base: PaymentTermBase, days: number) =>
    days === 0
      ? texts.when[base].zero
      : texts.when[base].days.replace("{days}", String(days));
  const filled = rows.filter((r) => r.percent !== "" || r.days !== "");
  // Mesmas regras do servidor: 0 < % ≤ 100 e 0 a 720 dias.
  const rowValid = (r: Row) => {
    const percent = parseNumberInput(r.percent);
    const days = r.days === "" ? 0 : parseNumberInput(r.days, { int: true });
    return (
      percent !== null &&
      Number.isFinite(percent) &&
      percent > 0 &&
      percent <= 100 &&
      days !== null &&
      Number.isInteger(days) &&
      days >= 0 &&
      days <= texts.maxDays
    );
  };
  const sum =
    Math.round(
      filled.reduce((s, r) => s + (parseNumberInput(r.percent) ?? 0), 0) * 100,
    ) / 100;
  const ok =
    filled.length === 0 ||
    (filled.every(rowValid) && Math.abs(sum - 100) <= 0.01);
  const update = (id: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => {
    if (rows.length >= MAX_ROWS) return;
    // A nova parcela já vem com o que falta para 100%.
    const rest = Math.round((100 - sum) * 100) / 100;
    setRows((list) => [
      ...list,
      {
        id: nextId,
        percent: rest > 0 ? fmt(rest).replace(/\s/g, "") : "",
        base: list[list.length - 1]?.base ?? "order_created",
        days: "",
      },
    ]);
    setNextId((n) => n + 1);
  };
  const applyPreset = (terms: PaymentTermInstallment[]) => {
    setRows(terms.map((term, i) => ({ ...toRows([term])[0], id: nextId + i })));
    setNextId((n) => n + terms.length);
  };

  return (
    <div className="space-y-3" data-payment-terms>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-zinc-500">
          {texts.presets}:
        </span>
        {PRESETS.map((terms, i) => (
          <button
            key={i}
            type="button"
            onClick={() => applyPreset(terms)}
            className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700 transition hover:border-brand-300 hover:bg-brand-50"
            data-terms-preset={i}
          >
            {terms
              .map((t) => `${fmt(t.percent)}% ${when(t.base, t.days)}`)
              .join(" + ")}
          </button>
        ))}
      </div>

      <ol className="space-y-2">
        {rows.map((row, i) => {
          const percent = parseNumberInput(row.percent);
          const days =
            row.days === "" ? 0 : parseNumberInput(row.days, { int: true });
          const blank = row.percent === "" && row.days === "";
          const invalid = !blank && !rowValid(row);
          const described =
            !blank && !invalid && percent !== null && days !== null
              ? `${fmt(percent)}% ${when(row.base, days)}`
              : null;
          return (
            <li
              key={row.id}
              className={cx(
                "rounded-lg border p-2",
                invalid
                  ? "border-red-300 bg-red-50/60"
                  : "border-zinc-200 bg-zinc-50/60",
              )}
              data-term-row={i + 1}
            >
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_5rem_auto] items-end gap-2">
                <label className="block min-w-0 space-y-1">
                  <span className="block text-xs font-medium text-zinc-700">
                    {texts.percent}
                  </span>
                  <span className="relative block">
                    <input
                      name="termPercent"
                      aria-invalid={invalid || undefined}
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.percent}
                      onChange={(e) =>
                        update(row.id, {
                          percent: e.target.value.replace(/[^\d.,]/g, ""),
                        })
                      }
                      className={cx(inputClass, "pr-6 text-right tabular-nums")}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-zinc-500"
                    >
                      %
                    </span>
                  </span>
                </label>
                <label className="block min-w-0 space-y-1">
                  <span className="block text-xs font-medium text-zinc-700">
                    {texts.base}
                  </span>
                  <select
                    name="termBase"
                    value={row.base}
                    onChange={(e) =>
                      update(row.id, {
                        base: e.target.value as PaymentTermBase,
                      })
                    }
                    className={inputClass}
                  >
                    {bases.map((b) => (
                      <option key={b} value={b}>
                        {texts.baseLabels[b]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0 space-y-1">
                  <span className="block text-xs font-medium text-zinc-700">
                    {texts.days}
                  </span>
                  <input
                    name="termDays"
                    aria-invalid={invalid || undefined}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={row.days}
                    onChange={(e) =>
                      update(row.id, {
                        days: e.target.value.replace(/\D/g, "").slice(0, 3),
                      })
                    }
                    className={cx(inputClass, "text-right tabular-nums")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setRows((list) =>
                      list.length > 1
                        ? list.filter((r) => r.id !== row.id)
                        : [{ ...list[0], percent: "", days: "" }],
                    )
                  }
                  aria-label={texts.remove.replace("{n}", String(i + 1))}
                  title={texts.remove.replace("{n}", String(i + 1))}
                  className="mb-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-700"
                >
                  ×
                </button>
              </div>
              {invalid ? (
                <p
                  className="mt-1 text-xs font-medium text-red-700"
                  role="alert"
                >
                  {texts.rowInvalid}
                </p>
              ) : described ? (
                <p className="mt-1 text-xs text-zinc-600">
                  <span className="font-semibold">
                    {texts.installment
                      .replace("{n}", String(i + 1))
                      .replace("{count}", String(rows.length))}
                    :
                  </span>{" "}
                  {described}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={rows.length >= MAX_ROWS}
        >
          + {texts.add}
        </Button>
        <span
          className={cx(
            "text-sm font-semibold tabular-nums",
            filled.length === 0
              ? "text-zinc-500"
              : ok
                ? "text-emerald-700"
                : "text-red-700",
          )}
          data-terms-sum={sum}
          aria-live="polite"
        >
          {(Math.abs(sum - 100) <= 0.01 ? texts.sum : texts.sumOff).replace(
            "{sum}",
            fmt(sum),
          )}
        </span>
      </div>
      {children}
      <div>
        <SubmitButton disabled={!ok}>{texts.save}</SubmitButton>
      </div>
    </div>
  );
}
