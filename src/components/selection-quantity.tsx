"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, cx, inputDenseClass } from "@/components/ui";
import {
  RequestScheduleFields,
  type ScheduleLabels,
} from "@/components/request-schedule";
import type { RequestSchedule } from "@/lib/db/schema";
import {
  MAX_PURCHASE_ROUNDS,
  containersPerRound,
  planPurchaseRounds,
  roundLoad,
} from "@/lib/purchase-rounds";
import { splitEvenly } from "@/lib/workflow/request-schedule";

/*
 * Quantidade da escolha do grupo com a programação de compra
 * (docs/PURCHASE_SCHEDULE.md): sem programação, a quantidade digitada (em
 * branco = a da planilha); com ela, rodadas com peças e intervalo, e a
 * quantidade passa a ser a soma das rodadas (o campo fica só para leitura).
 *
 * "Gerar programação" parte da QUANTIDADE (regra do dono, 12/11/2026): o
 * total de peças e o número de rodadas viram rodadas iguais, em caixas
 * master inteiras do item marcado como escolhido. Os containers de cada
 * rodada saem da conta ("Containers por rodada" é só informativo). Em cada
 * rodada, "Aumentar" e "Diminuir" ajustam as peças para fechar o container;
 * com 95% ou mais ele conta como cheio.
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
  rounds: string;
  container: string;
  /** "Containers por rodada" (informativo) e a explicação dele. */
  perRound: string;
  perRoundHint: string;
  /** "{min} a {max}" quando as rodadas ocupam containers diferentes. */
  perRoundRange: string;
  submit: string;
  item: string;
  noItem: string;
  noCarton: string;
  tooBig: string;
  errorTotal: string;
  errorRounds: string;
  result: string;
  extra: string;
  reduced: string;
  load: string;
  /** Situação do container da rodada. */
  full: string;
  fullMargin: string;
  partial: string;
  partialLast: string;
  /** Ajustes da rodada: "Aumentar +{pieces}" / "fecha {n} container(s)". */
  up: string;
  upTo: string;
  down: string;
  downTo: string;
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
  const perRoundId = useId();
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
  // Nulo = acompanha a tela: o total é a soma das rodadas e o número de
  // rodadas é o dos cartões; digitado, vale o que está no campo até gerar.
  const [totalText, setTotalText] = useState<string | null>(null);
  const [roundsText, setRoundsText] = useState<string | null>(null);
  // O que a última geração arredondou (some quando as rodadas mudam).
  const [note, setNote] = useState<{
    pieces: number;
    extra: number;
    reduced: { cartons: number; rounds: number } | null;
  } | null>(null);
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

  /** Total em N rodadas iguais: caixas master inteiras quando o item as tem. */
  function divide(amount: number, count: number): number[] {
    if (hasCarton && amount > 0) {
      const out = planPurchaseRounds({
        total: amount,
        rounds: Math.max(1, Math.min(MAX_PURCHASE_ROUNDS, Math.floor(count))),
        masterCartonQty: item!.masterCartonQty,
        cbmPerCarton: item!.cbmPerCarton,
        containerCbm: capacity,
      });
      if ("plan" in out) return out.plan.rounds.map((r) => r.pieces);
    }
    return splitEvenly(amount, count, MAX_PURCHASE_ROUNDS);
  }

  function generate(apply: (q: number[]) => void, roundsValue: string) {
    const n = parseNum(total);
    if (!Number.isFinite(n) || n <= 0) {
      setError(gen.errorTotal);
      return;
    }
    const count = parseNum(roundsValue);
    if (!Number.isInteger(count) || count < 1 || count > MAX_PURCHASE_ROUNDS) {
      setError(fill(gen.errorRounds, { max: MAX_PURCHASE_ROUNDS }));
      return;
    }
    setError(null);
    if (!hasCarton) {
      setNote(null);
      apply(splitEvenly(n, count, MAX_PURCHASE_ROUNDS));
    } else {
      const out = planPurchaseRounds({
        total: n,
        rounds: count,
        masterCartonQty: item!.masterCartonQty,
        cbmPerCarton: item!.cbmPerCarton,
        containerCbm: capacity,
      });
      if ("error" in out) {
        setNote(null);
        setError(
          out.error === "too_big"
            ? fill(gen.tooBig, {
                cbm: fmt(item!.cbmPerCarton!, 4),
                container,
                cap: fmt(capacity!, 2),
              })
            : out.error === "rounds"
              ? fill(gen.errorRounds, { max: MAX_PURCHASE_ROUNDS })
              : gen.errorTotal,
        );
        return;
      }
      const { plan } = out;
      setNote({
        pieces: plan.pieces,
        extra: plan.extraPieces,
        reduced: plan.reduced
          ? { cartons: plan.cartons, rounds: plan.rounds.length }
          : null,
      });
      apply(plan.rounds.map((r) => r.pieces));
    }
    // Gerado: os campos voltam a acompanhar as rodadas da tela.
    setTotalText(null);
    setRoundsText(null);
  }

  const chip = (on: boolean) =>
    cx(
      "rounded-md border px-2.5 py-1 text-xs font-semibold",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
    );

  const generator = (apply: (q: number[]) => void, live: number[]) => {
    const roundsValue = roundsText ?? String(live.length || 2);
    // Rodadas da tela; sem programação, a prévia do que seria gerado.
    const typedTotal = parseNum(total);
    const typedRounds = parseNum(roundsValue);
    const preview =
      !live.length &&
      hasCarton &&
      typedTotal > 0 &&
      Number.isInteger(typedRounds) &&
      typedRounds >= 1 &&
      typedRounds <= MAX_PURCHASE_ROUNDS
        ? divide(typedTotal, typedRounds)
        : [];
    const shown = live.length ? live : preview;
    const loads = hasCarton
      ? shown.map((q) =>
          roundLoad(q, item!.masterCartonQty, item!.cbmPerCarton, capacity),
        )
      : [];
    const summary =
      live.length && loads.length && loads.every((l) => l !== null)
        ? {
            rounds: loads.length,
            cartons: loads.reduce((a, l) => a + l!.cartons, 0),
            cbm: loads.reduce((a, l) => a + l!.cbm, 0),
            containers: loads.reduce((a, l) => a + (l!.containers ?? 0), 0),
          }
        : null;
    const range = hasCarton
      ? containersPerRound(
          shown,
          item!.masterCartonQty,
          item!.cbmPerCarton,
          capacity,
        )
      : null;
    const perRoundText = !range
      ? "—"
      : fmt(range.min, 2) === fmt(range.max, 2)
        ? fmt(range.max, 2)
        : fill(gen.perRoundRange, {
            min: fmt(range.min, 2),
            max: fmt(range.max, 2),
          });
    const liveSum = live.reduce((a, q) => a + q, 0);
    const fresh = note && liveSum === note.pieces ? note : null;
    return (
      <div
        className="mt-1 space-y-2 rounded-lg border border-brand-200 bg-white p-2.5 text-xs"
        data-rounds-generator
        role="group"
        aria-label={gen.title}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            generate(apply, roundsValue);
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
          <label className="space-y-1">
            <span className="block font-medium text-zinc-700">
              {gen.rounds}
            </span>
            <input
              type="number"
              min="1"
              max={MAX_PURCHASE_ROUNDS}
              value={roundsValue}
              onChange={(e) => {
                setRoundsText(e.target.value);
                setError(null);
              }}
              data-generate-rounds
              className={cx(inputDenseClass, "w-20 tabular-nums")}
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
              <div className="space-y-1">
                <span
                  className="block font-medium text-zinc-700"
                  id={perRoundId}
                >
                  {gen.perRound}
                </span>
                {/* Informativo: sai das peças de cada rodada, ninguém digita. */}
                <output
                  aria-labelledby={perRoundId}
                  title={gen.perRoundHint}
                  data-generate-per-round
                  className="flex min-h-8 min-w-20 cursor-default items-center rounded-md border border-dashed border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-zinc-700"
                >
                  {perRoundText}
                </output>
              </div>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => generate(apply, roundsValue)}
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
        {summary ? (
          <div className="space-y-1 text-zinc-700" data-generate-result>
            <p className="font-medium text-zinc-900">
              {fill(gen.result, {
                rounds: summary.rounds,
                cartons: fmt(summary.cartons),
                cbm: fmt(summary.cbm, 2),
                containers: fmt(summary.containers, 2),
                container,
              })}
            </p>
            {fresh && fresh.extra > 0 ? (
              <p data-generate-extra>
                {fill(gen.extra, { extra: fmt(fresh.extra) })}
              </p>
            ) : null}
            {fresh?.reduced ? (
              <p className="text-amber-800" data-generate-reduced>
                {fill(gen.reduced, {
                  cartons: fmt(fresh.reduced.cartons),
                  rounds: fresh.reduced.rounds,
                })}
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
  };

  /** Um ajuste da rodada: o quanto muda e com quantos containers fica. */
  const stepButton = (
    kind: "up" | "down",
    step: { pieces: number; containers: number; target: number },
    set: (quantity: number) => void,
  ) => {
    const main = fill(kind === "up" ? gen.up : gen.down, {
      pieces: fmt(step.pieces),
    });
    const to = fill(kind === "up" ? gen.upTo : gen.downTo, {
      n: fmt(step.containers),
      container,
    });
    return (
      <button
        type="button"
        onClick={() => set(step.target)}
        aria-label={`${main}: ${to}`}
        {...(kind === "up"
          ? { "data-round-up": step.target }
          : { "data-round-down": step.target })}
        className="block w-full rounded-md border border-brand-200 bg-white px-1.5 py-1 text-left text-[11px] leading-tight hover:border-brand-400 hover:bg-brand-50"
      >
        <span className="block font-semibold text-brand-700">{main}</span>
        <span className="block text-zinc-500">{to}</span>
      </button>
    );
  };

  const roundInfo = (pieces: number, set: (quantity: number) => void) => {
    const load = roundLoad(
      pieces,
      item?.masterCartonQty,
      item?.cbmPerCarton,
      capacity,
    );
    if (!load) return null;
    return (
      <div
        className="space-y-1"
        data-round-fill={
          load.containers === null ? "none" : load.full ? "full" : "partial"
        }
      >
        <p className="text-[11px] text-zinc-500" data-schedule-load>
          {fill(gen.load, {
            cartons: fmt(load.cartons),
            cbm: fmt(load.cbm, 2),
            containers:
              load.containers === null ? "—" : fmt(load.containers, 2),
            container,
          })}
        </p>
        {load.containers !== null && load.lastPct !== null ? (
          <>
            <p
              className={cx(
                "text-[11px] font-semibold",
                load.full ? "text-emerald-700" : "text-amber-800",
              )}
              data-round-status
            >
              {load.full
                ? load.lastPct === 100
                  ? gen.full
                  : fill(gen.fullMargin, { pct: load.lastPct })
                : fill((load.needed ?? 1) > 1 ? gen.partialLast : gen.partial, {
                    pct: load.lastPct,
                  })}
            </p>
            {load.up ? stepButton("up", load.up, set) : null}
            {load.down ? stepButton("down", load.down, set) : null}
          </>
        ) : null}
      </div>
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
            if (!on) setNote(null);
          }}
          generator={generator}
          roundInfo={roundInfo}
          split={divide}
        />
      </div>
    </div>
  );
}
