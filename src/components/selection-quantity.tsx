"use client";

import { useEffect, useRef, useState } from "react";
import { Input, cx, inputDenseClass } from "@/components/ui";
import {
  RequestScheduleFields,
  type ScheduleLabels,
} from "@/components/request-schedule";
import type { RequestSchedule } from "@/lib/db/schema";
import {
  MAX_PURCHASE_ROUNDS,
  planPurchaseRounds,
  roundLoad,
  type RoundsPlan,
} from "@/lib/purchase-rounds";
import { splitEvenly } from "@/lib/workflow/request-schedule";

/*
 * Quantidade da escolha do grupo com a programação de compra
 * (docs/PURCHASE_SCHEDULE.md): sem programação, a quantidade digitada (em
 * branco = a da planilha); com ela, rodadas com peças e intervalo, e a
 * quantidade passa a ser a soma das rodadas (o campo fica só para leitura).
 * "Gerar programação" monta as rodadas pelo total de peças, pela caixa master
 * e CBM do item marcado como escolhido e pelo container (containers cheios;
 * a última rodada fica com o resto).
 */

/** Caixa master do item do grupo (o CBM já resolvido das medidas, quando falta). */
export interface SelectionCarton {
  id: string;
  masterCartonQty: number | null;
  cbmPerCarton: number | null;
  /** Quantidade da planilha (total sugerido). */
  sheetQty: number | null;
}

export interface GenerateLabels {
  title: string;
  hint: string;
  total: string;
  container: string;
  perRound: string;
  rounds: string;
  submit: string;
  item: string;
  noItem: string;
  noCarton: string;
  tooBig: string;
  errorTotal: string;
  result: string;
  extra: string;
  raised: string;
  last: string;
  fillUp: string;
  trim: string;
  load: string;
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

/** Peças são inteiras: pontos, vírgulas e espaços são separador de milhar. */
const parseNum = (s: string) => {
  const t = String(s).replace(/[.,\s]/g, "");
  return t ? Number(t) : NaN;
};

export function SelectionQuantity({
  label,
  hint,
  scheduledHint,
  defaultQuantity,
  schedule,
  labels,
  gen,
  items,
  chosenItemId,
  containerTypes,
}: {
  label: string;
  hint: string;
  /** Dica do campo quando a programação está ligada. */
  scheduledHint: string;
  defaultQuantity: number | null;
  schedule: RequestSchedule | null;
  labels: ScheduleLabels;
  gen: GenerateLabels;
  items: SelectionCarton[];
  /** Item marcado como escolhido ao abrir (a escolha gravada). */
  chosenItemId: string | null;
  containerTypes: Array<{ code: string; capacityCbm: number }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [qty, setQty] = useState(
    defaultQuantity === null ? "" : String(defaultQuantity),
  );
  const [scheduled, setScheduled] = useState(!!schedule?.items.length);
  const [chosen, setChosen] = useState<string | null>(chosenItemId);
  const [container, setContainer] = useState(
    () =>
      containerTypes.find((c) => c.code === "40HC")?.code ??
      [...containerTypes].sort((a, b) => b.capacityCbm - a.capacityCbm)[0]
        ?.code ??
      "",
  );
  const [perRound, setPerRound] = useState("1");
  const [roundsCount, setRoundsCount] = useState("2");
  const [totalText, setTotalText] = useState<string | null>(null);
  const [result, setResult] = useState<RoundsPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // O item escolhido é o rádio "chosen" da tabela (no mesmo formulário).
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.name === "chosen" && el.checked)
        setChosen(el.value);
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);

  const intl = labels.intl;
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(intl, { maximumFractionDigits: digits });
  const item = items.find((i) => i.id === chosen) ?? null;
  const capacity =
    containerTypes.find((c) => c.code === container)?.capacityCbm ?? null;
  const total =
    totalText ??
    (qty.trim() ? qty : item?.sheetQty ? String(item.sheetQty) : "");
  const hasCarton = !!(item?.masterCartonQty && item.cbmPerCarton && capacity);
  const perContainer =
    hasCarton && item
      ? Math.floor(capacity! / item.cbmPerCarton! + 1e-9)
      : null;

  function generate(apply: (q: number[]) => void, override?: number) {
    const n = override ?? parseNum(total);
    if (!Number.isFinite(n) || n <= 0) {
      setError(gen.errorTotal);
      return;
    }
    setError(null);
    if (!hasCarton) {
      const count = Math.max(
        1,
        Math.min(MAX_PURCHASE_ROUNDS, Math.floor(parseNum(roundsCount)) || 1),
      );
      setResult(null);
      apply(splitEvenly(n, count, MAX_PURCHASE_ROUNDS));
      return;
    }
    const out = planPurchaseRounds({
      total: n,
      masterCartonQty: item!.masterCartonQty,
      cbmPerCarton: item!.cbmPerCarton,
      containerCbm: capacity,
      containersPerRound: Math.floor(parseNum(perRound)) || 1,
    });
    if ("error" in out) {
      setResult(null);
      setError(
        out.error === "too_big"
          ? fill(gen.tooBig, {
              cbm: fmt(item!.cbmPerCarton!, 4),
              container,
              cap: fmt(capacity!, 2),
            })
          : gen.errorTotal,
      );
      return;
    }
    if (override !== undefined) setTotalText(String(override));
    setResult(out.plan);
    apply(out.plan.rounds.map((r) => r.pieces));
  }

  const chip = (on: boolean) =>
    cx(
      "rounded-md border px-2.5 py-1 text-xs font-semibold",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
    );

  const generator = (apply: (q: number[]) => void) => (
    <div
      className="mt-1 space-y-2 rounded-lg border border-brand-200 bg-white p-2.5 text-xs"
      data-rounds-generator
      role="group"
      aria-label={gen.title}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          generate(apply);
        }
      }}
    >
      <p className="font-semibold text-zinc-900">{gen.title}</p>
      <p className="text-zinc-600">{gen.hint}</p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="space-y-1">
          <span className="block font-medium text-zinc-700">{gen.total}</span>
          <input
            type="text"
            inputMode="numeric"
            value={total}
            onChange={(e) => {
              setTotalText(e.target.value);
              setError(null);
            }}
            data-generate-total
            className={cx(inputDenseClass, "w-28 tabular-nums")}
          />
        </label>
        {hasCarton || !item ? (
          <>
            <div className="space-y-1">
              <span className="block font-medium text-zinc-700">
                {gen.container}
              </span>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label={gen.container}
              >
                {containerTypes.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    aria-pressed={container === c.code}
                    onClick={() => setContainer(c.code)}
                    data-generate-container={c.code}
                    className={chip(container === c.code)}
                    title={`${fmt(c.capacityCbm, 2)} m³`}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
            <label className="space-y-1">
              <span className="block font-medium text-zinc-700">
                {gen.perRound}
              </span>
              <input
                type="number"
                min="1"
                max="50"
                value={perRound}
                onChange={(e) => setPerRound(e.target.value)}
                data-generate-per-round
                className={cx(inputDenseClass, "w-20 tabular-nums")}
              />
            </label>
          </>
        ) : (
          <label className="space-y-1">
            <span className="block font-medium text-zinc-700">
              {gen.rounds}
            </span>
            <input
              type="number"
              min="1"
              max={MAX_PURCHASE_ROUNDS}
              value={roundsCount}
              onChange={(e) => setRoundsCount(e.target.value)}
              data-generate-rounds
              className={cx(inputDenseClass, "w-20 tabular-nums")}
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => generate(apply)}
          disabled={!item && !total}
          data-generate-submit
          className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {gen.submit}
        </button>
      </div>
      <p
        className={cx(item && hasCarton ? "text-zinc-600" : "text-amber-800")}
        data-generate-item={item ? (hasCarton ? "ok" : "missing") : "none"}
      >
        {!item
          ? gen.noItem
          : hasCarton && perContainer !== null
            ? fill(gen.item, {
                pcs: fmt(item.masterCartonQty!),
                cbm: fmt(item.cbmPerCarton!, 4),
                cartons: fmt(perContainer),
                pieces: fmt(perContainer * item.masterCartonQty!),
                container,
              })
            : gen.noCarton}
      </p>
      {result ? (
        <div className="space-y-1 text-zinc-700" data-generate-result>
          <p className="font-medium text-zinc-900">
            {fill(gen.result, {
              rounds: result.rounds.length,
              cartons: fmt(result.cartons),
              cbm: fmt(result.cbm, 2),
              containers: fmt(
                result.rounds.reduce((a, r) => a + r.containers, 0),
                2,
              ),
              container,
            })}
          </p>
          {result.extraPieces > 0 ? (
            <p>{fill(gen.extra, { extra: fmt(result.extraPieces) })}</p>
          ) : null}
          {result.raised ? (
            <p className="text-amber-800">
              {fill(gen.raised, {
                max: MAX_PURCHASE_ROUNDS,
                n: result.containersPerRound,
              })}
            </p>
          ) : null}
          {result.fillUp !== null ? (
            <p className="flex flex-wrap items-center gap-2">
              <span>{fill(gen.last, { pct: result.lastFillPct })}</span>
              <button
                type="button"
                onClick={() => generate(apply, result.pieces + result.fillUp!)}
                data-generate-fill
                className="font-semibold text-brand-700 underline underline-offset-2"
              >
                {fill(gen.fillUp, { pieces: fmt(result.fillUp) })}
              </button>
              {result.trimDown !== null ? (
                <button
                  type="button"
                  onClick={() =>
                    generate(apply, result.pieces - result.trimDown!)
                  }
                  data-generate-trim
                  className="font-semibold text-brand-700 underline underline-offset-2"
                >
                  {fill(gen.trim, { pieces: fmt(result.trimDown) })}
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="font-medium text-red-700"
          data-generate-error
        >
          {error}
        </p>
      ) : null}
    </div>
  );

  const roundInfo = (pieces: number) => {
    const load = roundLoad(
      pieces,
      item?.masterCartonQty,
      item?.cbmPerCarton,
      capacity,
    );
    if (!load) return null;
    return (
      <p
        className={cx(
          "text-[11px]",
          load.containers !== null &&
            Math.abs(load.containers - Math.round(load.containers)) > 1e-6
            ? "text-amber-800"
            : "text-zinc-500",
        )}
        data-schedule-load
      >
        {fill(gen.load, {
          cartons: fmt(load.cartons),
          cbm: fmt(load.cbm, 2),
          containers: load.containers === null ? "—" : fmt(load.containers, 2),
          container,
        })}
      </p>
    );
  };

  return (
    <div
      ref={ref}
      className="space-y-3 md:col-span-3"
      data-selection-quantity-block
    >
      <label className="block max-w-xs space-y-1">
        <span className="block text-sm font-medium text-zinc-700">{label}</span>
        <Input
          name={scheduled ? undefined : "quantity"}
          inputMode="numeric"
          autoComplete="off"
          value={qty}
          readOnly={scheduled}
          onChange={(e) => setQty(e.target.value)}
          data-selection-quantity
        />
        <span className="block text-xs text-zinc-500">
          {scheduled ? scheduledHint : hint}
        </span>
      </label>
      <div>
        <RequestScheduleFields
          prefix=""
          total={qty}
          unit="pcs"
          onTotalChange={(t) => setQty(t)}
          labels={labels}
          max={MAX_PURCHASE_ROUNDS}
          initial={schedule}
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
          onToggle={(on) => {
            setScheduled(on);
            if (!on) setResult(null);
          }}
          generator={generator}
          roundInfo={roundInfo}
        />
      </div>
    </div>
  );
}
