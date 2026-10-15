"use client";

import { useEffect, useRef, useState } from "react";
import type { PurchaseLot } from "@/lib/db/schema";
import {
  MAX_LOTS,
  generateLots,
  planSheet,
  suggestContainerFill,
  type ContainerFill,
  type GenerateLotsError,
} from "@/lib/services/purchase-sheet-calc";
import {
  DEFAULT_SCHEDULE_INTERVAL,
  SCHEDULE_INTERVALS,
} from "@/lib/workflow/request-schedule";
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
  /** Tag Intl do idioma (números e datas): pt-BR, en-US, zh-CN. */
  intl: string;
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
  removeLot: string;
  requested: string;
  /** Atalho "Gerar programação". */
  gen: GenerateLabels;
}

export interface GenerateLabels {
  toggle: string;
  hint: string;
  total: string;
  count: string;
  interval: string;
  /** "{n} dias" */
  days: string;
  custom: string;
  first: string;
  /** "= {pieces} peças · {cbm} m³" */
  equals: string;
  replace: string;
  submit: string;
  cancel: string;
  /** "{total} caixas em {count} programações, a 1ª em {first} dias, depois a cada {days}" */
  done: string;
  /** Uma programação só: "{total} caixas, saída em {first} dias". */
  doneOne: string;
  undo: string;
  errorTotal: string;
  errorInterval: string;
  errorFirst: string;
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

const fmtIn = (intl: string, n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString(intl, { maximumFractionDigits: digits });

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

/** Inteiro digitado ("1000", "1.000" ou "1 000"); outra coisa vira NaN. */
function parseWhole(raw: string): number {
  const t = raw.trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d{1,3}([.,\s]\d{3})+$/.test(t)) return Number(t.replace(/\D/g, ""));
  return NaN;
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
  lot1Missing = false,
}: {
  /** Programação 1 obrigatória e vazia: a linha fica em vermelho (o aviso leva até ela). */
  lot1Missing?: boolean;
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
  const fmt = (n: number | null | undefined, digits = 2) =>
    fmtIn(labels.intl, n, digits);
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
  // Atalho "Gerar programação": painel aberto, aviso do que foi gerado e o
  // estado anterior para desfazer (some na próxima edição de uma linha).
  const [genOpen, setGenOpen] = useState(0);
  const [generated, setGenerated] = useState<{
    message: string;
    before: { lots: { interval: string; cartons: string }[]; visible: number };
  } | null>(null);
  // Linhas visíveis: começa com uma (ou as com dados / pedidas pelo cliente);
  // "+ Programação" abre outra e o × da linha a remove (as de baixo sobem).
  const filled = (ls: { interval: string; cartons: string }[]) =>
    ls.map((l) => l.interval !== "" || l.cartons !== "").lastIndexOf(true) + 1;
  const [visible, setVisible] = useState(() =>
    Math.min(MAX_LOTS, Math.max(1, filled(lots), requested.length)),
  );
  const shown = Math.max(visible, filled(lots));

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
  // Programação 1 marcada como faltando pelo servidor: o vermelho sai assim
  // que a linha ganha caixas e intervalo (digitados ou gerados).
  const lot1Open =
    lot1Missing &&
    !(
      (parseNum(lots[0].cartons) ?? 0) > 0 &&
      parseNum(lots[0].interval) !== null
    );
  // Lote que recebe o ajuste: o último com caixas (ou o 1º).
  const lastIdx = Math.max(
    0,
    lots.map((l) => (parseNum(l.cartons) ?? 0) > 0).lastIndexOf(true),
  );

  function setLot(i: number, key: "interval" | "cartons", value: string) {
    setApplied(null);
    setGenerated(null);
    setLots((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  }
  function removeLot(i: number) {
    setApplied(null);
    setGenerated(null);
    setLots((ls) => [
      ...ls.filter((_, j) => j !== i),
      { interval: "", cartons: "" },
    ]);
    setVisible((v) => Math.max(1, Math.min(v, shown) - 1));
  }
  function adjust(delta: number) {
    setGenerated(null);
    const current = parseNum(lots[lastIdx].cartons) ?? 0;
    const next = Math.max(0, current + delta);
    setLots((ls) =>
      ls.map((l, j) => (j === lastIdx ? { ...l, cartons: String(next) } : l)),
    );
    setApplied(fill(labels.applied, { lot: lastIdx + 1, cartons: next }));
  }

  // Valores iniciais do atalho: o que a ficha já tem (total, linhas,
  // intervalos) ou a programação pedida pelo cliente.
  function generatorDefaults(): GeneratorDefaults {
    const whole = (v: string) => {
      const n = parseNum(v);
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
    };
    const fromRequest =
      requested.length && form.masterCartonQty
        ? requested.reduce(
            (sum, r) => sum + Math.ceil(r.quantity / form.masterCartonQty!),
            0,
          )
        : 0;
    const total = plan.totalCartons || fromRequest;
    const interval =
      whole(lots[1]?.interval ?? "") ??
      whole(lots[0]?.interval ?? "") ??
      DEFAULT_SCHEDULE_INTERVAL;
    return {
      total: total > 0 ? String(total) : "",
      count: Math.min(MAX_LOTS, filled(lots) || requested.length || 2),
      interval,
      first: whole(lots[0]?.interval ?? "") ?? interval,
    };
  }
  function applyGenerated(input: {
    totalCartons: number;
    count: number;
    intervalDays: number;
    firstDays: number;
  }): GenerateLotsError | null {
    const result = generateLots(input);
    if ("error" in result) return result.error;
    setGenerated({
      message: fill(
        result.lots.length === 1 ? labels.gen.doneOne : labels.gen.done,
        {
          total: fmt(input.totalCartons, 0),
          count: result.lots.length,
          first: input.firstDays,
          days: input.intervalDays,
        },
      ),
      before: { lots, visible: shown },
    });
    setApplied(null);
    setLots(
      Array.from({ length: MAX_LOTS }, (_, i) => {
        const lot = result.lots[i];
        return lot
          ? {
              interval: String(lot.departureIntervalDays),
              cartons: String(lot.masterCartons),
            }
          : { interval: "", cartons: "" };
      }),
    );
    setVisible(result.lots.length);
    setGenOpen(0);
    return null;
  }
  function undoGenerated() {
    if (!generated) return;
    setLots(generated.before.lots);
    setVisible(generated.before.visible);
    setGenerated(null);
  }

  const th = "py-1 font-medium";
  return (
    <div ref={root} data-sheet-schedule>
      {!disabled ? (
        genOpen ? (
          <ScheduleGenerator
            key={genOpen}
            defaults={generatorDefaults()}
            hasData={filled(lots) > 0}
            masterCartonQty={form.masterCartonQty}
            cbmPerCarton={form.cbmPerCarton}
            labels={labels.gen}
            fmt={fmt}
            onGenerate={applyGenerated}
            onCancel={() => setGenOpen(0)}
          />
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGenOpen((k) => k + 1)}
              data-generate-open
              className="inline-flex items-center gap-1 rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              {labels.gen.toggle}
            </button>
            {generated ? (
              <p
                className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-800"
                data-generated
                aria-live="polite"
              >
                {generated.message}
                <button
                  type="button"
                  onClick={undoGenerated}
                  data-generate-undo
                  className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  {labels.gen.undo}
                </button>
              </p>
            ) : null}
          </div>
        )
      ) : null}
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
              <th className="relative w-8">
                <span className="sr-only">{labels.removeLot}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.lots.slice(0, shown).map((lot, i) => (
              <tr
                key={lot.index}
                className={cx(
                  "scroll-mt-24 border-t border-zinc-100",
                  lot.index === 1 &&
                    lot1Open &&
                    "bg-red-50 outline-2 -outline-offset-2 outline-red-400",
                )}
                data-field-anchor={lot.index === 1 ? "lot1" : undefined}
                data-missing={lot.index === 1 && lot1Open ? "true" : undefined}
              >
                <td className="relative py-1.5 pr-3 font-semibold text-zinc-800">
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
                  {lot.departureAt
                    ? formatDate(lot.departureAt, labels.intl)
                    : "—"}
                  {requested[i] ? (
                    <span
                      className="block text-[11px] text-brand-700"
                      data-lot-requested={lot.index}
                    >
                      {fill(labels.requested, {
                        quantity: fmt(requested[i].quantity, 0),
                        unit,
                        date: formatDate(requested[i].expectedAt, labels.intl),
                      })}
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pl-1 text-right">
                  {!disabled && shown > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeLot(i)}
                      aria-label={fill(labels.removeLot, { n: lot.index })}
                      title={fill(labels.removeLot, { n: lot.index })}
                      data-remove-lot={lot.index}
                      className="rounded px-1.5 text-base leading-none text-zinc-400 hover:bg-red-50 hover:text-red-700"
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && shown < MAX_LOTS ? (
        <button
          type="button"
          onClick={() => setVisible(Math.min(MAX_LOTS, shown + 1))}
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

interface GeneratorDefaults {
  total: string;
  count: number;
  interval: number;
  first: number;
}

/*
 * Painel do atalho: total de caixas, nº de programações (1 a 6), intervalo
 * (30/45/60 ou outro) e 1ª saída. Campos sem `name`: não vão no envio da
 * ficha; só preenchem as linhas, que continuam editáveis. Enter gera (não
 * envia a ficha) e Esc fecha.
 */
function ScheduleGenerator({
  defaults,
  hasData,
  masterCartonQty,
  cbmPerCarton,
  labels,
  fmt,
  onGenerate,
  onCancel,
}: {
  defaults: GeneratorDefaults;
  hasData: boolean;
  masterCartonQty: number | null;
  cbmPerCarton: number | null;
  labels: GenerateLabels;
  fmt: (n: number | null | undefined, digits?: number) => string;
  onGenerate: (input: {
    totalCartons: number;
    count: number;
    intervalDays: number;
    firstDays: number;
  }) => GenerateLotsError | null;
  onCancel: () => void;
}) {
  const preset = (SCHEDULE_INTERVALS as readonly number[]).includes(
    defaults.interval,
  );
  const [total, setTotal] = useState(defaults.total);
  const [count, setCount] = useState(defaults.count);
  const [interval, setInterval] = useState(preset ? defaults.interval : 0);
  const [custom, setCustom] = useState(preset ? "" : String(defaults.interval));
  const [first, setFirst] = useState(String(defaults.first));
  // A 1ª saída acompanha o intervalo até a pessoa mexer nela.
  const [firstTouched, setFirstTouched] = useState(
    defaults.first !== defaults.interval,
  );
  const [error, setError] = useState<GenerateLotsError | null>(null);
  const totalRef = useRef<HTMLInputElement>(null);
  useEffect(() => totalRef.current?.focus(), []);

  const days = interval > 0 ? interval : parseWhole(custom);
  const totalNum = parseWhole(total);
  function pickInterval(n: number, customText = custom) {
    setInterval(n);
    setError(null);
    const d = n > 0 ? n : parseWhole(customText);
    if (!firstTouched && Number.isFinite(d)) setFirst(String(d));
  }
  function submit() {
    setError(
      onGenerate({
        totalCartons: totalNum,
        count,
        intervalDays: days,
        firstDays: parseWhole(first),
      }),
    );
  }
  const chip = (on: boolean) =>
    cx(
      "min-w-8 rounded-md border px-2 py-1 text-xs font-semibold tabular-nums",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
    );
  const small = cx(inputDenseClass, "w-24 tabular-nums");
  const errorText =
    error === "total"
      ? labels.errorTotal
      : error === "interval"
        ? labels.errorInterval
        : error === "first"
          ? labels.errorFirst
          : null;

  return (
    <div
      className="mt-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3 text-[13px]"
      data-generate-panel
      role="group"
      aria-label={labels.toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <p className="font-semibold text-zinc-900">{labels.toggle}</p>
      <p className="mt-0.5 text-xs text-zinc-600">{labels.hint}</p>
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.total}
          </span>
          <input
            ref={totalRef}
            type="text"
            inputMode="numeric"
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setError(null);
            }}
            aria-invalid={error === "total" || undefined}
            data-generate-total
            className={cx(small, error === "total" && "border-red-400")}
          />
        </label>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.count}
          </span>
          <div className="flex gap-1" role="group" aria-label={labels.count}>
            {Array.from({ length: MAX_LOTS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                onClick={() => {
                  setCount(n);
                  setError(null);
                }}
                data-generate-count={n}
                className={chip(count === n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.interval}
          </span>
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label={labels.interval}
          >
            {SCHEDULE_INTERVALS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={interval === d}
                onClick={() => pickInterval(d)}
                data-generate-interval={d}
                className={chip(interval === d)}
              >
                {fill(labels.days, { n: d })}
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              placeholder={labels.custom}
              value={interval === 0 ? custom : ""}
              onFocus={() => pickInterval(0)}
              onChange={(e) => {
                setCustom(e.target.value);
                pickInterval(0, e.target.value);
              }}
              aria-label={`${labels.interval}: ${labels.custom}`}
              aria-invalid={error === "interval" || undefined}
              data-generate-custom
              className={cx(
                inputDenseClass,
                "w-20 tabular-nums",
                error === "interval" && "border-red-400",
              )}
            />
          </div>
        </div>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.first}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              setFirstTouched(true);
              setError(null);
            }}
            aria-invalid={error === "first" || undefined}
            data-generate-first
            className={cx(small, error === "first" && "border-red-400")}
          />
        </label>
      </div>
      {Number.isFinite(totalNum) &&
      totalNum > 0 &&
      (masterCartonQty || cbmPerCarton) ? (
        <p className="mt-2 text-xs text-zinc-600" data-generate-equals>
          {fill(labels.equals, {
            pieces: masterCartonQty ? fmt(totalNum * masterCartonQty, 0) : "—",
            cbm: cbmPerCarton ? fmt(totalNum * cbmPerCarton, 4) : "—",
          })}
        </p>
      ) : null}
      {hasData ? (
        <p className="mt-1 text-xs text-amber-800">{labels.replace}</p>
      ) : null}
      {errorText ? (
        <p
          role="alert"
          className="mt-1 text-xs font-medium text-red-700"
          data-generate-error
        >
          {errorText}
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          data-generate-submit
          className="rounded-md bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800"
        >
          {labels.submit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          {labels.cancel}
        </button>
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
