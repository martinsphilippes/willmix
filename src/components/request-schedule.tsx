"use client";

import { useState } from "react";
import { cx, inputClass } from "@/components/ui";
import {
  DEFAULT_SCHEDULE_INTERVAL,
  MAX_REQUEST_SCHEDULE,
  SCHEDULE_INTERVALS,
  addDaysIso,
  splitEvenly,
  todayIso,
} from "@/lib/workflow/request-schedule";

/*
 * Programação de entregas na solicitação: "+ Programação de entregas" liga o
 * bloco; a quantidade total é dividida nas programações (1, 2, 3…), cada uma
 * com quantidade editável e data prevista calculada (1ª data + intervalo).
 * O total da solicitação passa a ser a soma das programações.
 */
export interface ScheduleLabels {
  toggle: string;
  ask: string;
  hint: string;
  interval: string;
  days: string;
  custom: string;
  firstDate: string;
  n: string;
  quantity: string;
  expected: string;
  add: string;
  remove: string;
  total: string;
  off: string;
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function RequestScheduleFields({
  prefix,
  total,
  unit,
  onTotalChange,
  labels,
}: {
  prefix: string;
  /** Quantidade total da linha (texto do campo). */
  total: string;
  unit: string;
  /** Soma das programações muda a quantidade total da linha. */
  onTotalChange: (total: string) => void;
  labels: ScheduleLabels;
}) {
  const [on, setOn] = useState(false);
  const [interval, setInterval] = useState<number>(DEFAULT_SCHEDULE_INTERVAL);
  const [customInterval, setCustomInterval] = useState("");
  const [firstDate, setFirstDate] = useState(() =>
    addDaysIso(todayIso(), DEFAULT_SCHEDULE_INTERVAL),
  );
  const [qtys, setQtys] = useState<string[]>([]);

  const days =
    interval > 0 ? interval : Math.max(0, Number(customInterval) || 0);

  function enable() {
    const n = Math.max(0, Number(String(total).replace(",", ".")) || 0);
    const parts = splitEvenly(n, 2);
    setQtys(parts.map(String));
    setOn(true);
    onTotalChange(String(parts.reduce((a, b) => a + b, 0)));
  }
  function disable() {
    setOn(false);
    setQtys([]);
  }
  function sum(list: string[]) {
    return list.reduce(
      (a, q) => a + (Number(String(q).replace(",", ".")) || 0),
      0,
    );
  }
  function update(list: string[]) {
    setQtys(list);
    onTotalChange(String(sum(list)));
  }
  function add() {
    if (qtys.length >= MAX_REQUEST_SCHEDULE) return;
    update(splitEvenly(sum(qtys), qtys.length + 1).map(String));
  }
  function remove() {
    if (qtys.length <= 2) return;
    update(splitEvenly(sum(qtys), qtys.length - 1).map(String));
  }

  if (!on)
    return (
      <div
        className="flex flex-wrap items-center gap-2"
        data-request-schedule="off"
      >
        <span className="text-xs text-zinc-500">{labels.ask}</span>
        <button
          type="button"
          onClick={enable}
          data-schedule-on
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        >
          <span aria-hidden>+</span>
          {labels.toggle}
        </button>
      </div>
    );

  return (
    <fieldset
      className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3"
      data-request-schedule="on"
    >
      <legend className="px-1 text-sm font-semibold text-zinc-800">
        {labels.toggle}
      </legend>
      <input
        type="hidden"
        name={`${prefix}schedule.count`}
        value={qtys.length}
      />
      <input
        type="hidden"
        name={`${prefix}schedule.intervalDays`}
        value={days}
      />
      <input
        type="hidden"
        name={`${prefix}schedule.firstDate`}
        value={firstDate}
      />
      <p className="text-xs leading-relaxed text-zinc-600">{labels.hint}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.interval}
          </span>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={labels.interval}
          >
            {SCHEDULE_INTERVALS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={interval === d}
                onClick={() => setInterval(d)}
                data-schedule-interval={d}
                className={cx(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  interval === d
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
                )}
              >
                {fill(labels.days, { n: d })}
              </button>
            ))}
            <label className="inline-flex items-center gap-1 text-xs">
              <input
                type="number"
                min="1"
                max="365"
                placeholder={labels.custom}
                value={interval === 0 ? customInterval : ""}
                onFocus={() => setInterval(0)}
                onChange={(e) => {
                  setInterval(0);
                  setCustomInterval(e.target.value);
                }}
                aria-label={labels.custom}
                className={cx(inputClass, "w-20 py-1 text-xs")}
              />
            </label>
          </div>
        </div>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.firstDate}
          </span>
          <input
            type="date"
            value={firstDate}
            onChange={(e) => setFirstDate(e.target.value)}
            className={cx(inputClass, "w-40 py-1 text-sm")}
          />
        </label>
      </div>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-2">
          {qtys.map((q, i) => (
            <div
              key={i}
              data-schedule-item={i + 1}
              className="w-36 shrink-0 space-y-1 rounded-md border border-zinc-200 bg-white p-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-zinc-800">
                  {fill(labels.n, { n: i + 1 })}
                </span>
                {qtys.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => remove()}
                    aria-label={fill(labels.remove, { n: i + 1 })}
                    className="rounded px-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-700"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <label className="block space-y-0.5">
                <span className="block text-[11px] text-zinc-500">
                  {labels.quantity}
                </span>
                <input
                  name={`${prefix}schedule.qty.${i + 1}`}
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={q}
                  onChange={(e) =>
                    update(qtys.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  className={cx(inputClass, "py-1 text-sm tabular-nums")}
                />
              </label>
              <p className="text-[11px] text-zinc-500">
                {labels.expected}:{" "}
                <span className="font-medium text-zinc-800" data-schedule-date>
                  {firstDate ? fmtDate(addDaysIso(firstDate, days * i)) : "—"}
                </span>
              </p>
            </div>
          ))}
          {qtys.length < MAX_REQUEST_SCHEDULE ? (
            <button
              type="button"
              onClick={add}
              data-schedule-add
              className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-brand-300 bg-white p-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              <span aria-hidden className="text-lg leading-none">
                +
              </span>
              {labels.add}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-zinc-800" data-schedule-total>
          {fill(labels.total, {
            total: sum(qtys).toLocaleString("pt-BR"),
            unit,
          })}
        </span>
        <button
          type="button"
          onClick={disable}
          className="text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
        >
          {labels.off}
        </button>
      </div>
    </fieldset>
  );
}
