"use client";

import { useState, type ReactNode } from "react";
import { cx, inputClass } from "@/components/ui";
import {
  DEFAULT_SCHEDULE_INTERVAL,
  MAX_REQUEST_SCHEDULE,
  SCHEDULE_INTERVALS,
  addDaysIso,
  splitEvenly,
  todayIso,
  type RequestSchedule,
} from "@/lib/workflow/request-schedule";

/*
 * Programação de entregas na solicitação: "+ Programação de entregas" liga o
 * bloco; a quantidade total é dividida nas programações (1, 2, 3…), cada uma
 * com quantidade editável e data prevista calculada (1ª data + intervalo).
 * O total da solicitação passa a ser a soma das programações.
 */
export interface ScheduleLabels {
  /** Tag Intl do idioma (datas e números): pt-BR, en-US, zh-CN. */
  intl: string;
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

const fmtDate = (iso: string, intl: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export function RequestScheduleFields({
  prefix,
  total,
  unit,
  onTotalChange,
  labels,
  max = MAX_REQUEST_SCHEDULE,
  initial = null,
  className,
  onToggle,
  generator,
  roundInfo,
  split,
}: {
  prefix: string;
  /** Quantidade total da linha (texto do campo). */
  total: string;
  unit: string;
  /** Soma das programações muda a quantidade total da linha. */
  onTotalChange: (total: string) => void;
  labels: ScheduleLabels;
  /** Máximo de programações (padrão: as 6 da solicitação do cliente). */
  max?: number;
  /** Programação já gravada (reabrir para rever): começa ligada com ela. */
  initial?: RequestSchedule | null;
  /** Classes do bloco (fora da grade da linha de produto). */
  className?: string;
  /** Avisa quando a programação liga ou desliga. */
  onToggle?: (on: boolean) => void;
  /**
   * Gerador de rodadas (programação de compra): recebe `apply`, que liga a
   * programação com as peças de cada rodada já preenchidas, e as peças das
   * rodadas de agora (vazio com a programação desligada).
   */
  generator?: (
    apply: (quantities: number[]) => void,
    quantities: number[],
  ) => ReactNode;
  /**
   * Linhas extras de cada rodada (caixas, CBM, ocupação do container e os
   * ajustes para fechar o container): recebe as peças e `set`, que troca as
   * peças daquela rodada.
   */
  roundInfo?: (quantity: number, set: (quantity: number) => void) => ReactNode;
  /**
   * Como dividir um total em N rodadas ao ligar, acrescentar ou tirar uma
   * rodada (programação de compra: em caixas master inteiras). Padrão: em
   * partes iguais.
   */
  split?: (total: number, count: number) => number[];
}) {
  const known = (SCHEDULE_INTERVALS as readonly number[]).includes(
    initial?.intervalDays ?? -1,
  );
  const [on, setOn] = useState(!!initial?.items.length);
  const [interval, setInterval] = useState<number>(
    initial ? (known ? initial.intervalDays : 0) : DEFAULT_SCHEDULE_INTERVAL,
  );
  const [customInterval, setCustomInterval] = useState(
    initial && !known ? String(initial.intervalDays) : "",
  );
  const [firstDate, setFirstDate] = useState(
    () =>
      initial?.firstDate ?? addDaysIso(todayIso(), DEFAULT_SCHEDULE_INTERVAL),
  );
  const [qtys, setQtys] = useState<string[]>(
    () => initial?.items.map((i) => String(i.quantity)) ?? [],
  );

  const days =
    interval > 0 ? interval : Math.max(0, Number(customInterval) || 0);
  const num = (q: string) => Number(String(q).replace(",", ".")) || 0;
  const divide = (amount: number, count: number) =>
    split ? split(amount, count) : splitEvenly(amount, count, max);

  function enable() {
    const n = Math.max(0, Number(String(total).replace(",", ".")) || 0);
    const parts = divide(n, 2);
    setQtys(parts.map(String));
    setOn(true);
    onToggle?.(true);
    onTotalChange(String(parts.reduce((a, b) => a + b, 0)));
  }
  function apply(list: number[]) {
    const clean = list.slice(0, max).map((q) => Math.max(0, Math.round(q)));
    if (!clean.length) return;
    setQtys(clean.map(String));
    if (!on) {
      setOn(true);
      onToggle?.(true);
    }
    onTotalChange(String(clean.reduce((a, b) => a + b, 0)));
  }
  function disable() {
    setOn(false);
    setQtys([]);
    onToggle?.(false);
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
    if (qtys.length >= max) return;
    update(divide(sum(qtys), qtys.length + 1).map(String));
  }
  function remove() {
    if (qtys.length <= 2) return;
    update(divide(sum(qtys), qtys.length - 1).map(String));
  }

  /* Na grade da linha de produto (RequestItems): desligada, fica ao lado de
     quantidade e unidade; ligada, ocupa a linha toda. */
  if (!on)
    return (
      <div
        className={
          className ??
          "col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 self-end sm:min-h-8"
        }
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
        {generator ? (
          <div className="basis-full">{generator(apply, [])}</div>
        ) : null}
      </div>
    );

  return (
    <fieldset
      className={cx(
        "min-w-0 max-w-full space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-2.5",
        className ? null : "col-span-2 sm:col-span-4",
      )}
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
      {generator ? generator(apply, qtys.map(num)) : null}
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
                onChange={(e) => {
                  // Só passa para "outro" quando algo é digitado: passar pelo
                  // campo não zera o intervalo (0 dias é recusado ao enviar).
                  const v = e.target.value;
                  setCustomInterval(v);
                  if (v.trim() !== "" || interval === 0) setInterval(0);
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
            className={cx(inputClass, "w-40")}
          />
        </label>
      </div>
      {/* Com os ajustes do container (programação de compra) os cartões
          quebram de linha: os botões de cada rodada ficam sempre à vista.
          Sem eles (solicitação do cliente), a fileira rola para o lado. */}
      <div
        className={
          roundInfo
            ? "min-w-0"
            : "-mx-1 min-w-0 max-w-full overflow-x-auto px-1"
        }
      >
        <div
          className={roundInfo ? "flex flex-wrap gap-2" : "flex w-max gap-2"}
        >
          {qtys.map((q, i) => (
            <div
              key={i}
              data-schedule-item={i + 1}
              className={cx(
                "shrink-0 space-y-1 rounded-md border border-zinc-200 bg-white p-2",
                // Com os ajustes do container, o cartão precisa de mais largura.
                roundInfo ? "w-40" : "w-36",
              )}
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
                  className={cx(inputClass, "tabular-nums")}
                />
              </label>
              <p className="text-[11px] text-zinc-500">
                {labels.expected}:{" "}
                <span className="font-medium text-zinc-800" data-schedule-date>
                  {firstDate
                    ? fmtDate(addDaysIso(firstDate, days * i), labels.intl)
                    : "—"}
                </span>
              </p>
              {roundInfo
                ? roundInfo(num(q), (v) =>
                    update(qtys.map((x, j) => (j === i ? String(v) : x))),
                  )
                : null}
            </div>
          ))}
          {qtys.length < max ? (
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
            total: sum(qtys).toLocaleString(labels.intl),
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
