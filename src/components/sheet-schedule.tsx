"use client";

import { useEffect, useRef, useState } from "react";
import type { PurchaseLot } from "@/lib/db/schema";
import {
  MAX_LOTS,
  planSheet,
  suggestContainerFill,
  type ContainerFill,
} from "@/lib/services/purchase-sheet-calc";
import { cx, formatDate, inputDenseClass } from "@/components/ui";

/*
 * Programação de compra ao vivo (dentro do <form> da ficha): lotes com
 * caixas e intervalo, peças/CBM/datas/containers recalculados a cada tecla com
 * a MESMA conta do servidor (planSheet), e a sugestão para fechar o container
 * (faltam N caixas para 5; ou tirar M para 4) com botão que aplica no lote.
 * Peças por caixa, CBM da caixa, medidas, início da produção e container são
 * lidos do próprio formulário (eventos de input), sem duplicar campos.
 */
export interface ScheduleLabels {
  lotColumn: string;
  interval: string;
  cartons: string;
  pieces: string;
  cbm: string;
  departure: string;
  lotTitle: string;
  required: string;
  totalPieces: string;
  totalCbm: string;
  totalContainers: string;
  live: string;
  fillTitle: string;
  partial: string;
  add: string;
  addNoPieces: string;
  apply: string;
  remove: string;
  removeNoPieces: string;
  applyRemove: string;
  exact: string;
  full: string;
  need: string;
  applied: string;
  /** "+ Programação" (nova linha) e "Pedido do cliente: {quantity} {unit} em {date}". */
  addLot: string;
  requested: string;
}

interface FormValues {
  masterCartonQty: number | null;
  cbmPerCarton: number | null;
  heightCm: number | null;
  widthCm: number | null;
  lengthCm: number | null;
  productionStartAt: string | null;
  containerType: string | null;
}

const fmt = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

function parseNum(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function SheetSchedule({
  initialLots,
  initial,
  containerTypes,
  disabled,
  lotRequired,
  labels,
  requested = [],
  unit = "un",
}: {
  initialLots: PurchaseLot[];
  initial: FormValues;
  containerTypes: Array<{ code: string; capacityCbm: number }>;
  disabled: boolean;
  lotRequired: boolean;
  labels: ScheduleLabels;
  /** Programação pedida pelo cliente na solicitação (por programação). */
  requested?: { quantity: number; expectedAt: string }[];
  unit?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [lots, setLots] = useState<{ interval: string; cartons: string }[]>(
    () =>
      Array.from({ length: MAX_LOTS }, (_, i) => ({
        interval:
          initialLots[i]?.departureIntervalDays === null ||
          initialLots[i]?.departureIntervalDays === undefined
            ? ""
            : String(initialLots[i].departureIntervalDays),
        cartons:
          initialLots[i]?.masterCartons === null ||
          initialLots[i]?.masterCartons === undefined
            ? ""
            : String(initialLots[i].masterCartons),
      })),
  );
  const [form, setForm] = useState<FormValues>(initial);
  const [applied, setApplied] = useState<string | null>(null);
  // Linhas visíveis: as com dados (ou pedidas pelo cliente) e mais uma; "+ Programação" abre outra.
  const filled = (ls: { interval: string; cartons: string }[]) =>
    ls.map((l) => l.interval !== "" || l.cartons !== "").lastIndexOf(true) + 1;
  const [visible, setVisible] = useState(() =>
    Math.min(MAX_LOTS, Math.max(2, filled(lots), requested.length)),
  );

  // Lê os outros campos da ficha a cada digitação (mesmo formulário).
  useEffect(() => {
    const el = root.current?.closest("form");
    if (!el) return;
    const apply = () => {
      const v = (name: string) =>
        (el.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
      setForm({
        masterCartonQty: parseNum(v("masterCartonQty")),
        cbmPerCarton: parseNum(v("cbmPerCarton")),
        heightCm: parseNum(v("heightCm")),
        widthCm: parseNum(v("widthCm")),
        lengthCm: parseNum(v("lengthCm")),
        productionStartAt: v("productionStartAt") || null,
        containerType: v("containerType") || null,
      });
    };
    // Os lotes são controlados pelo próprio componente; os demais campos são
    // lidos depois de o React tratar o evento (senão a re-renderização
    // síncrona devolve o valor antigo ao campo antes do onChange dele).
    const read = (e?: Event) => {
      if (e && root.current?.contains(e.target as Node)) return;
      setTimeout(apply, 0);
    };
    el.addEventListener("input", read);
    el.addEventListener("change", read);
    const t = setTimeout(() => {
      apply();
      // Digitado antes da hidratação: o DOM tem o valor, o estado ainda não.
      setLots((ls) =>
        ls.map((l, i) => {
          const v = (name: string) =>
            (el.elements.namedItem(name) as HTMLInputElement | null)?.value ??
            "";
          const interval = v(`lot${i + 1}Interval`);
          const cartons = v(`lot${i + 1}Cartons`);
          return interval === l.interval && cartons === l.cartons
            ? l
            : { interval, cartons };
        }),
      );
      root.current?.setAttribute("data-ready", "1");
    }, 0);
    return () => {
      clearTimeout(t);
      el.removeEventListener("input", read);
      el.removeEventListener("change", read);
    };
  }, []);

  const capacity =
    containerTypes.find((c) => c.code === form.containerType)?.capacityCbm ??
    null;
  const plan = planSheet(
    {
      lots: lots.map((l) => ({
        departureIntervalDays: l.interval === "" ? null : parseNum(l.interval),
        masterCartons: l.cartons === "" ? null : parseNum(l.cartons),
      })),
      masterCartonQty: form.masterCartonQty,
      cbmPerCarton: form.cbmPerCarton,
      productionStartAt: form.productionStartAt
        ? `${form.productionStartAt.slice(0, 10)}T00:00:00.000Z`
        : null,
      heightCm: form.heightCm,
      widthCm: form.widthCm,
      lengthCm: form.lengthCm,
    },
    capacity,
  );
  const fillInfo: ContainerFill | null = suggestContainerFill(
    plan,
    form.cbmPerCarton,
    form.masterCartonQty,
  );
  // Lote que recebe o ajuste: o último com caixas (ou o 1º).
  const lastIdx = Math.max(
    0,
    lots.map((l) => (parseNum(l.cartons) ?? 0) > 0).lastIndexOf(true),
  );

  function setLot(i: number, key: "interval" | "cartons", value: string) {
    setApplied(null);
    setLots((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  }
  function adjust(delta: number) {
    const current = parseNum(lots[lastIdx].cartons) ?? 0;
    const next = Math.max(0, current + delta);
    setLots((ls) =>
      ls.map((l, j) => (j === lastIdx ? { ...l, cartons: String(next) } : l)),
    );
    setApplied(fill(labels.applied, { lot: lastIdx + 1, cartons: next }));
  }

  const th = "py-1 font-medium";
  return (
    <div ref={root} data-sheet-schedule>
      <div className="-mx-3 mt-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <table className="min-w-[34rem] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className={cx(th, "w-12 pr-3")}>{labels.lotColumn}</th>
              <th className={cx(th, "w-28 pr-3")}>{labels.interval}</th>
              <th className={cx(th, "w-32 pr-3")}>{labels.cartons}</th>
              <th className={cx(th, "w-24 pr-3 text-right")}>
                {labels.pieces}
              </th>
              <th className={cx(th, "w-24 pr-3 text-right")}>{labels.cbm}</th>
              <th className={cx(th, "w-32 pl-3")}>{labels.departure}</th>
            </tr>
          </thead>
          <tbody>
            {plan.lots
              .slice(0, Math.max(visible, filled(lots)))
              .map((lot, i) => (
                <tr key={lot.index} className="border-t border-zinc-100">
                  <td className="py-1.5 pr-3 font-semibold text-zinc-800">
                    {lot.index}
                    {lot.index === 1 && lotRequired ? (
                      <span
                        className="ml-0.5 font-semibold text-brand-600"
                        title={labels.required}
                      >
                        <span aria-hidden>*</span>
                        <span className="sr-only">({labels.required})</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      name={`lot${lot.index}Interval`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={lots[i].interval}
                      onChange={(e) => setLot(i, "interval", e.target.value)}
                      disabled={disabled}
                      aria-label={`${fill(labels.lotTitle, { n: lot.index })}: ${labels.interval}`}
                      className={cx(inputDenseClass, "w-20 tabular-nums")}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      name={`lot${lot.index}Cartons`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={lots[i].cartons}
                      onChange={(e) => setLot(i, "cartons", e.target.value)}
                      disabled={disabled}
                      aria-label={`${fill(labels.lotTitle, { n: lot.index })}: ${labels.cartons}`}
                      className={cx(inputDenseClass, "w-24 tabular-nums")}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-800">
                    {fmt(lot.pieces, 0)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-800">
                    {lot.cbm !== null ? `${fmt(lot.cbm, 4)} m³` : "—"}
                  </td>
                  <td className="py-1.5 pl-3 tabular-nums text-zinc-800">
                    {lot.departureAt ? formatDate(lot.departureAt) : "—"}
                    {requested[i] ? (
                      <span
                        className="block text-[11px] text-brand-700"
                        data-lot-requested={lot.index}
                      >
                        {fill(labels.requested, {
                          quantity: fmt(requested[i].quantity, 0),
                          unit,
                          date: formatDate(requested[i].expectedAt),
                        })}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!disabled && Math.max(visible, filled(lots)) < MAX_LOTS ? (
        <button
          type="button"
          onClick={() =>
            setVisible((v) => Math.min(MAX_LOTS, Math.max(v, filled(lots)) + 1))
          }
          data-add-lot
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        >
          <span aria-hidden>+</span>
          {labels.addLot}
        </button>
      ) : null}
      <dl
        className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-brand-50/60 px-3 py-2 text-sm ring-1 ring-inset ring-brand-100"
        data-sheet-totals
      >
        <Calc label={labels.totalPieces} value={fmt(plan.totalPieces, 0)} />
        <Calc
          label={labels.totalCbm}
          value={plan.totalCbm !== null ? `${fmt(plan.totalCbm, 4)} m³` : "—"}
        />
        <Calc
          label={fill(labels.totalContainers, {
            type: form.containerType ?? "—",
            capacity: capacity ?? "—",
          })}
          value={fmt(plan.containers, 2)}
          strong
        />
      </dl>
      <p className="mt-1.5 text-xs text-zinc-500">{labels.live}</p>

      {/* Sugestão para fechar o container. */}
      <div
        className={cx(
          "mt-3 rounded-lg border px-3 py-2 text-[13px]",
          fillInfo?.exact
            ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
            : "border-amber-200 bg-amber-50/70 text-amber-950",
        )}
        data-fill-suggestion={
          fillInfo ? (fillInfo.exact ? "exact" : "partial") : "none"
        }
        aria-live="polite"
      >
        <p className="font-semibold">{labels.fillTitle}</p>
        {!fillInfo ? (
          <p className="mt-0.5 text-zinc-600">{labels.need}</p>
        ) : fillInfo.exact ? (
          <p className="mt-0.5">{fill(labels.exact, { n: fillInfo.lower })}</p>
        ) : (
          <div className="mt-0.5 space-y-1.5">
            <p>
              {fill(labels.partial, {
                containers: fmt(fillInfo.containers, 2),
                capacity: fmt(fillInfo.capacityCbm, 2),
                pct: fillInfo.lastPct,
              })}
            </p>
            {fillInfo.addCartons > 0 ? (
              <p>
                {fillInfo.addPieces !== null
                  ? fill(labels.add, {
                      cartons: fmt(fillInfo.addCartons, 0),
                      pieces: fmt(fillInfo.addPieces, 0),
                      cbm: fmt(fillInfo.addCbm, 4),
                      n: fillInfo.target,
                    })
                  : fill(labels.addNoPieces, {
                      cartons: fmt(fillInfo.addCartons, 0),
                      cbm: fmt(fillInfo.addCbm, 4),
                      n: fillInfo.target,
                    })}
              </p>
            ) : (
              <p>{labels.full}</p>
            )}
            {fillInfo.removeCartons !== null && fillInfo.removeCartons > 0 ? (
              <p className="text-zinc-700">
                {fillInfo.removePieces !== null
                  ? fill(labels.remove, {
                      cartons: fmt(fillInfo.removeCartons, 0),
                      pieces: fmt(fillInfo.removePieces, 0),
                      n: fillInfo.lower,
                    })
                  : fill(labels.removeNoPieces, {
                      cartons: fmt(fillInfo.removeCartons, 0),
                      n: fillInfo.lower,
                    })}
              </p>
            ) : null}
            {!disabled ? (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {fillInfo.addCartons > 0 ? (
                  <button
                    type="button"
                    onClick={() => adjust(fillInfo.addCartons)}
                    data-fill-apply="add"
                    className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-800"
                  >
                    {fill(labels.apply, {
                      n: fillInfo.target,
                      cartons: fmt(fillInfo.addCartons, 0),
                      lot: lastIdx + 1,
                    })}
                  </button>
                ) : null}
                {fillInfo.removeCartons !== null &&
                fillInfo.removeCartons > 0 ? (
                  <button
                    type="button"
                    onClick={() => adjust(-fillInfo.removeCartons!)}
                    data-fill-apply="remove"
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    {fill(labels.applyRemove, {
                      n: fillInfo.lower,
                      cartons: fmt(fillInfo.removeCartons, 0),
                    })}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        {applied ? (
          <p
            className="mt-1 text-xs font-medium text-emerald-800"
            data-fill-applied
          >
            {applied}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Calc({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={cx(
          "tabular-nums text-zinc-900",
          strong ? "text-base font-bold" : "font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
