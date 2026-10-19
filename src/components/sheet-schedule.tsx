"use client";

import { parseNumberInput } from "@/lib/number-input";
import { useEffect, useRef, useState } from "react";
import { DRAFT_RESTORE_EVENT } from "./form-draft-guard";
import type { PurchaseLot } from "@/lib/db/schema";
import {
  MAX_LOTS,
  cartonTotalFor,
  generateLots,
  planSheet,
  spreadCartons,
  suggestContainerFill,
  type CartonTotal,
  type ContainerFill,
  type ContainerStep,
  type GenerateLotsError,
} from "@/lib/services/purchase-sheet-calc";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
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
  /** Duas direções, sempre que der (também quando já fecha exato). */
  exactNow: string;
  up: string;
  upNoPieces: string;
  applyUp: string;
  down: string;
  downNoPieces: string;
  applyDown: string;
  appliedTotal: string;
  /** CBM da caixa fora do normal (provável erro de digitação). */
  cbmHigh: string;
  /** O mesmo, quando o CBM vem das medidas (medida provavelmente em mm). */
  cbmHighSize: string;
  cbmMismatch: string;
  /** Quantidade do pedido acompanhando as caixas. */
  qty: {
    title: string;
    same: string;
    order: string;
    quote: string;
    quoteDraft: string;
    readonly: string;
    paid: string;
  };
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
  /** De onde veio o total: programações de hoje, do cliente ou a quantidade pedida. */
  fromLots: string;
  /** "{quantity} {unit} ÷ {perCarton} por caixa … = {cartons} caixas" */
  fromRequested: string;
  fromQuantity: string;
  /** "As caixas fecham {pieces} peças: {extra} a mais que o pedido." */
  extra: string;
  /** Falta "Peças por caixa master" para calcular. */
  needPerCarton: string;
  goTo: string;
  /** "Usar o calculado ({cartons})" */
  useCalc: string;
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

/** Mesma leitura do servidor ("1.000" caixas = 1000; "0,050" m³ = 0,05). */
function parseNum(raw: string | null | undefined, int = false): number | null {
  const n = parseNumberInput(raw, { int });
  return n !== null && Number.isFinite(n) && n >= 0 ? n : null;
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
  quantity = null,
  target = null,
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
  /**
   * Quantidade do pedido hoje (item do pedido ou solicitação) e o que acontece
   * com ela: "order" = a Wellmix salva e o pedido acompanha; "quote" = a
   * proposta usa a da programação; "readonly" = só mostra (fornecedor).
   */
  quantity?: {
    current: number;
    unit: string;
    mode: "order" | "paid" | "quote" | "quoteDraft" | "readonly";
  } | null;
  /** Quantidade pedida hoje (sempre que houver): total de caixas do atalho. */
  target?: { quantity: number; unit: string } | null;
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
  // Foco do teclado depois de fechar o painel: no "Desfazer" (gerou) ou de
  // volta no botão do atalho (cancelou ou desfez), em vez de cair no <body>.
  const genToggleRef = useRef<HTMLButtonElement>(null);
  const genUndoRef = useRef<HTMLButtonElement>(null);
  const genFocus = useRef<"toggle" | "undo" | null>(null);
  useEffect(() => {
    if (genOpen || !genFocus.current) return;
    (genFocus.current === "undo" ? genUndoRef : genToggleRef).current?.focus();
    genFocus.current = null;
  }, [genOpen, generated]);
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
      // CBM da caixa pelas medidas quando há as três (o campo mostra o
      // mesmo calculado e o servidor grava assim); senão o digitado.
      // Quem só lê vê o salvo (é o que vale nas contas até salvar de novo).
      const boxCbm = disabled
        ? null
        : cbmFromDimensions(
            parseNum(v("lengthCm")),
            parseNum(v("widthCm")),
            parseNum(v("heightCm")),
          );
      setForm({
        masterCartonQty: parseNum(v("masterCartonQty"), true),
        cbmPerCarton: boxCbm ?? parseNum(v("cbmPerCarton")),
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
  }, [disabled]);

  // Volta de um envio que não salvou: a programação digitada volta, inclusive
  // linhas abertas com "+ Programação" e o que os botões mudaram.
  useEffect(() => {
    const el = root.current?.closest("form");
    if (!el) return;
    const onRestore = (e: Event) => {
      const d = (e as CustomEvent<Record<string, string>>).detail ?? {};
      const at = (i: number, k: "Interval" | "Cartons") => {
        const v = d[`lot${i + 1}${k}`];
        return typeof v === "string" ? v : null;
      };
      let last = 0;
      for (let i = 0; i < MAX_LOTS; i++)
        if (at(i, "Interval") || at(i, "Cartons")) last = i + 1;
      setLots((ls) =>
        ls.map((l, i) => ({
          interval: at(i, "Interval") ?? l.interval,
          cartons: at(i, "Cartons") ?? l.cartons,
        })),
      );
      if (last) setVisible((v) => Math.max(v, last));
    };
    el.addEventListener(DRAFT_RESTORE_EVENT, onRestore);
    return () => el.removeEventListener(DRAFT_RESTORE_EVENT, onRestore);
  }, []);

  const capacity =
    containerTypes.find((c) => c.code === form.containerType)?.capacityCbm ??
    null;
  const plan = planSheet(
    {
      lots: lots.map((l) => ({
        departureIntervalDays:
          l.interval === "" ? null : parseNum(l.interval, true),
        masterCartons: l.cartons === "" ? null : parseNum(l.cartons, true),
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
      (parseNum(lots[0].cartons, true) ?? 0) > 0 &&
      parseNum(lots[0].interval, true) !== null
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
  /* Ajuste para fechar o container: pôr vai para a última programação com
     caixas; tirar começa pela última e sobe (nenhuma fica negativa). */
  function adjust(delta: number) {
    setGenerated(null);
    const before = lots.map((l) => parseNum(l.cartons, true) ?? 0);
    const after = spreadCartons(before, delta);
    setLots((ls) =>
      ls.map((l, j) =>
        after[j] === before[j]
          ? l
          : { ...l, cartons: after[j] > 0 ? String(after[j]) : "" },
      ),
    );
    const changed = after
      .map((c, j) => (c !== before[j] ? j : -1))
      .filter((j) => j >= 0);
    const total = after.reduce((a, b) => a + b, 0);
    setApplied(
      changed.length === 1
        ? fill(labels.applied, {
            lot: changed[0] + 1,
            cartons: fmt(after[changed[0]], 0),
          })
        : fill(labels.appliedTotal, {
            cartons: fmt(total, 0),
            pieces:
              form.masterCartonQty !== null
                ? fmt(total * form.masterCartonQty, 0)
                : "—",
          }),
    );
  }
  const stepText = (
    step: ContainerStep,
    withPieces: string,
    noPieces: string,
  ) =>
    step.pieces !== null
      ? fill(withPieces, {
          cartons: fmt(step.cartons, 0),
          pieces: fmt(step.pieces, 0),
          cbm: fmt(step.cbm, 4),
          n: step.containers,
        })
      : fill(noPieces, {
          cartons: fmt(step.cartons, 0),
          cbm: fmt(step.cbm, 4),
          n: step.containers,
        });
  /* CBM da caixa master improvável: maior que 1 m³ (uma caixa master costuma
     ter 0,02–0,3 m³) ou muito diferente da medida da caixa. Avisa na hora,
     antes de a conta de containers enganar ("0,050" digitado como "50"). */
  const cbmWarning = (() => {
    const cbm = form.cbmPerCarton;
    if (cbm === null || cbm <= 0) return null;
    if (cbm >= 1)
      return fill(
        cbm === plan.cbmFromSize ? labels.cbmHighSize : labels.cbmHigh,
        {
          cbm: fmt(cbm, 4),
          capacity: capacity ? fmt(capacity, 0) : "68",
        },
      );
    const size = plan.cbmFromSize;
    if (size && (cbm / size > 2 || size / cbm > 2))
      return fill(labels.cbmMismatch, { cbm: fmt(cbm, 4), size: fmt(size, 4) });
    return null;
  })();
  // Quantidade do pedido x peças da programação (a que vai valer).
  const qtyNote = (() => {
    if (!quantity || plan.totalPieces === null) return null;
    const vars = {
      from: fmt(quantity.current, 0),
      to: fmt(plan.totalPieces, 0),
      unit: quantity.unit,
      diff: `${plan.totalPieces > quantity.current ? "+" : "−"}${fmt(
        Math.abs(plan.totalPieces - quantity.current),
        0,
      )}`,
    };
    if (plan.totalPieces === quantity.current)
      return { changed: false, text: fill(labels.qty.same, vars) };
    return { changed: true, text: fill(labels.qty[quantity.mode], vars) };
  })();

  // Total de caixas do atalho, sem digitar: as programações de hoje, a
  // programação pedida pelo cliente ou a quantidade pedida ÷ peças por caixa.
  // Ao vivo: acompanha "Peças por caixa master" enquanto o painel está aberto.
  const autoTotal = cartonTotalFor({
    lotsCartons: plan.totalCartons,
    masterCartonQty: form.masterCartonQty,
    requested,
    unit,
    target,
  });

  // Programação 1 resolvida na tela: o item "Programação 1" do aviso
  // "Faltam: …" fica riscado até salvar (como os outros campos).
  useEffect(() => {
    if (!lot1Missing) return;
    for (const item of document.querySelectorAll('[data-missing-field="lot1"]'))
      item.toggleAttribute("data-done", !lot1Open);
  }, [lot1Missing, lot1Open]);

  // Valores iniciais do atalho: o que a ficha já tem (total, linhas,
  // intervalos) ou a programação pedida pelo cliente.
  function generatorDefaults(): GeneratorDefaults {
    const whole = (v: string) => {
      const n = parseNum(v);
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
    };
    const total =
      autoTotal && autoTotal.source !== "missing" ? autoTotal.cartons : 0;
    // Intervalo entre programações vem da 2ª linha; a 1ª linha conta do
    // início da produção (prazo de produção), então vira a "1ª saída" e fica
    // como está ao trocar o intervalo.
    const interval =
      whole(lots[1]?.interval ?? "") ?? DEFAULT_SCHEDULE_INTERVAL;
    const sheetFirst = whole(lots[0]?.interval ?? "");
    return {
      total: total > 0 ? String(total) : "",
      count: Math.min(MAX_LOTS, filled(lots) || requested.length || 2),
      interval,
      first: sheetFirst ?? interval,
      firstFromSheet: sheetFirst !== null,
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
    genFocus.current = "undo";
    setGenOpen(0);
    return null;
  }
  function undoGenerated() {
    if (!generated) return;
    setLots(generated.before.lots);
    setVisible(generated.before.visible);
    setGenerated(null);
    genFocus.current = "toggle";
  }

  const th = "py-1 font-medium";
  return (
    <div ref={root} data-sheet-schedule>
      {/* Aviso do atalho sempre montado, para o leitor de tela anunciar. */}
      <p className="sr-only" role="status" aria-live="polite">
        {generated && !genOpen ? generated.message : ""}
      </p>
      {!disabled ? (
        genOpen ? (
          <ScheduleGenerator
            key={genOpen}
            defaults={generatorDefaults()}
            auto={autoTotal}
            unit={unit}
            hasData={filled(lots) > 0}
            masterCartonQty={form.masterCartonQty}
            cbmPerCarton={form.cbmPerCarton}
            labels={labels.gen}
            fmt={fmt}
            onGenerate={applyGenerated}
            onCancel={() => {
              genFocus.current = "toggle";
              setGenOpen(0);
            }}
          />
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              ref={genToggleRef}
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
              >
                {generated.message}
                <button
                  ref={genUndoRef}
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
        {/* Bordas nas células (não na linha): a linha que falta ganha uma
            moldura vermelha com cantos arredondados, como as fotos da ficha. */}
        <table className="min-w-[34rem] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="whitespace-nowrap text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className={cx(th, "w-12 pl-3 pr-3")}>{labels.lotColumn}</th>
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
                  "scroll-mt-24",
                  lot.index === 1 && lot1Open
                    ? "[&>td]:border-y [&>td]:border-red-400 [&>td]:bg-red-50 [&>td:first-child]:rounded-l-lg [&>td:first-child]:border-l [&>td:last-child]:rounded-r-lg [&>td:last-child]:border-r"
                    : "[&>td]:border-t [&>td]:border-zinc-100",
                )}
                data-field-anchor={lot.index === 1 ? "lot1" : undefined}
                data-missing={lot.index === 1 && lot1Open ? "true" : undefined}
              >
                <td className="relative py-1.5 pl-3 pr-3 font-semibold text-zinc-800">
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
                <td className="py-1.5 pl-1 pr-1.5 text-right">
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
      {cbmWarning ? (
        <p
          className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[13px] font-medium text-red-800 ring-1 ring-inset ring-red-200"
          data-cbm-warning
          role="alert"
        >
          {cbmWarning}
        </p>
      ) : null}
      {qtyNote ? (
        <p
          className={cx(
            "mt-1.5 rounded-md px-2.5 py-1.5 text-[13px]",
            qtyNote.changed
              ? "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200"
              : "text-zinc-600",
          )}
          data-sheet-quantity={qtyNote.changed ? "changed" : "same"}
          aria-live="polite"
        >
          <span className="font-semibold">{labels.qty.title}:</span>{" "}
          {qtyNote.text}
        </p>
      ) : null}

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
        ) : (
          <div className="mt-0.5 space-y-1.5">
            <p>
              {fillInfo.exact
                ? fill(labels.exactNow, { n: fillInfo.lower })
                : fill(labels.partial, {
                    containers: fmt(fillInfo.containers, 2),
                    capacity: fmt(fillInfo.capacityCbm, 2),
                    pct: fillInfo.lastPct,
                  })}
            </p>
            {/* Para cima e para baixo, sempre que der. */}
            {fillInfo.up ? (
              <p data-fill-up={fillInfo.up.containers}>
                {stepText(fillInfo.up, labels.up, labels.upNoPieces)}
              </p>
            ) : null}
            {fillInfo.down ? (
              <p
                className="text-zinc-700"
                data-fill-down={fillInfo.down.containers}
              >
                {stepText(fillInfo.down, labels.down, labels.downNoPieces)}
              </p>
            ) : null}
            {!disabled && (fillInfo.up || fillInfo.down) ? (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {fillInfo.up ? (
                  <button
                    type="button"
                    onClick={() => adjust(fillInfo.up!.cartons)}
                    data-fill-apply="add"
                    className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-800"
                  >
                    {fill(labels.applyUp, {
                      n: fillInfo.up.containers,
                      cartons: fmt(fillInfo.up.cartons, 0),
                    })}
                  </button>
                ) : null}
                {fillInfo.down ? (
                  <button
                    type="button"
                    onClick={() => adjust(-fillInfo.down!.cartons)}
                    data-fill-apply="remove"
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    {fill(labels.applyDown, {
                      n: fillInfo.down.containers,
                      cartons: fmt(fillInfo.down.cartons, 0),
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
  /** 1ª saída já preenchida na ficha: não acompanha o intervalo. */
  firstFromSheet: boolean;
}

/*
 * Painel do atalho: total de caixas, nº de programações (1 a 6), intervalo
 * (30/45/60 ou outro) e 1ª saída. Campos sem `name`: não vão no envio da
 * ficha; só preenchem as linhas, que continuam editáveis. Enter gera (não
 * envia a ficha) e Esc fecha. O total já vem calculado (`auto`), com a conta
 * à vista, e acompanha a ficha até a pessoa digitar outro.
 */
function ScheduleGenerator({
  defaults,
  auto,
  unit,
  hasData,
  masterCartonQty,
  cbmPerCarton,
  labels,
  fmt,
  onGenerate,
  onCancel,
}: {
  defaults: GeneratorDefaults;
  auto: CartonTotal | null;
  unit: string;
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
  // Total digitado: deixa de acompanhar o calculado (o link volta a ele).
  const [totalTouched, setTotalTouched] = useState(false);
  const [count, setCount] = useState(defaults.count);
  const [interval, setInterval] = useState(preset ? defaults.interval : 0);
  const [custom, setCustom] = useState(preset ? "" : String(defaults.interval));
  const [first, setFirst] = useState(String(defaults.first));
  // A 1ª saída acompanha o intervalo até a pessoa mexer nela.
  const [firstTouched, setFirstTouched] = useState(
    defaults.firstFromSheet || defaults.first !== defaults.interval,
  );
  const [error, setError] = useState<GenerateLotsError | null>(null);
  const totalRef = useRef<HTMLInputElement>(null);
  useEffect(() => totalRef.current?.focus(), []);

  const days = interval > 0 ? interval : parseWhole(custom);
  const autoCartons =
    auto && auto.source !== "missing" ? String(auto.cartons) : null;
  // Sem digitar, o total é o calculado; faltando dado para a conta, vazio.
  const totalText = totalTouched
    ? total
    : (autoCartons ?? (auto?.source === "missing" ? "" : total));
  const totalNum = parseWhole(totalText);
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
            value={totalText}
            onChange={(e) => {
              setTotal(e.target.value);
              setTotalTouched(true);
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
              onChange={(e) => {
                // Só passa para "outro" quando algo é digitado: passar pelo
                // campo (Tab, "próximo" do teclado) não troca o intervalo.
                const v = e.target.value;
                setCustom(v);
                setError(null);
                if (v.trim() !== "" || interval === 0) pickInterval(0, v);
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
      <TotalSource
        auto={auto}
        unit={unit}
        touched={
          totalTouched && autoCartons !== null && totalText !== autoCartons
        }
        labels={labels}
        fmt={fmt}
        onUseCalc={() => {
          setTotalTouched(false);
          setError(null);
          // O link some ao voltar ao calculado: o foco fica no total.
          totalRef.current?.focus();
        }}
      />
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

/**
 * De onde veio o total do atalho, com a conta à vista; ou o que falta para
 * calcular (com atalho até o campo); ou, se a pessoa digitou outro, o link
 * para voltar ao calculado.
 */
function TotalSource({
  auto,
  unit,
  touched,
  labels,
  fmt,
  onUseCalc,
}: {
  auto: CartonTotal | null;
  unit: string;
  touched: boolean;
  labels: GenerateLabels;
  fmt: (n: number | null | undefined, digits?: number) => string;
  onUseCalc: () => void;
}) {
  if (!auto) return null;
  if (auto.source === "missing")
    return (
      <p
        className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-amber-800"
        data-generate-source="missing"
      >
        {labels.needPerCarton}
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>(
              'input[name="masterCartonQty"]',
            );
            if (!el) return;
            el.scrollIntoView({ block: "center" });
            el.focus({ preventScroll: true });
          }}
          className="font-semibold underline underline-offset-2"
          data-generate-goto="masterCartonQty"
        >
          {labels.goTo}
        </button>
      </p>
    );
  if (touched)
    return (
      <p className="mt-2 text-xs" data-generate-source="typed">
        <button
          type="button"
          onClick={onUseCalc}
          className="font-semibold text-brand-700 underline underline-offset-2"
          data-generate-use-calc
        >
          {fill(labels.useCalc, { cartons: fmt(auto.cartons, 0) })}
        </button>
      </p>
    );
  if (auto.source === "lots")
    return (
      <p className="mt-2 text-xs text-zinc-600" data-generate-source="lots">
        {labels.fromLots}
      </p>
    );
  const extra = auto.pieces - auto.quantity;
  return (
    <p
      className="mt-2 text-xs text-zinc-600"
      data-generate-source={auto.source}
    >
      {fill(
        auto.source === "requested"
          ? labels.fromRequested
          : labels.fromQuantity,
        {
          quantity: fmt(auto.quantity, 0),
          unit,
          perCarton: fmt(auto.perCarton, 0),
          cartons: fmt(auto.cartons, 0),
        },
      )}
      {extra > 0
        ? ` ${fill(labels.extra, {
            pieces: fmt(auto.pieces, 0),
            extra: fmt(extra, 0),
          })}`
        : null}
    </p>
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
