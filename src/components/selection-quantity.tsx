"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { cx, inputDenseClass } from "@/components/ui";
import {
  RequestScheduleFields,
  type ScheduleLabels,
} from "@/components/request-schedule";
import type { RequestSchedule } from "@/lib/db/schema";
import {
  MAX_PURCHASE_ROUNDS,
  containersPerRound,
  parseCount,
  piecesFromCartons,
  planPurchaseRounds,
  quantityFields,
  roundLoad,
  scheduleOnItemChange,
  type RoundLoad,
  type RoundStep,
  type TypedQuantity,
} from "@/lib/purchase-rounds";
import { scheduleTotal, splitEvenly } from "@/lib/workflow/request-schedule";
import { splitByColor, spreadCartons } from "@/lib/color-split";

/*
 * Quantidade da escolha do grupo com a programação de compra
 * (docs/PURCHASE_SCHEDULE.md): sem programação, a quantidade digitada (em
 * branco = a da planilha); com ela, rodadas com peças e intervalo, e a
 * quantidade gravada passa a ser a soma das rodadas.
 *
 * "Quantidade (peças)" fica na linha do gerador, logo depois de "Total de
 * caixas", com o mesmo tamanho (pedido do dono, 13/11/2026). Os dois são o
 * mesmo número em duas unidades: o que se digita num aparece no outro, pelas
 * peças por caixa master do item escolhido (`quantityFields`). Sem
 * programação, "Quantidade (peças)" é a quantidade que a escolha grava; com
 * ela, os dois são o total do gerador (vale ao apertar "Gerar programação")
 * e voltam a acompanhar as rodadas quando elas mudam.
 *
 * "Gerar programação" parte da QUANTIDADE (regra do dono, 12/11/2026): o
 * total e o número de rodadas viram rodadas iguais, em caixas master
 * inteiras. O total é digitado em CAIXAS master (decisão do dono,
 * 13/11/2026): a conta multiplica pelas peças por caixa master do item
 * escolhido, e a quantidade e as rodadas continuam em peças. Os containers
 * de cada rodada saem da conta ("Containers por rodada" é só informativo). O cálculo fica sempre escrito na tela (a
 * caixa, o container, caixas, m³ e containers) e cada rodada tem "+ Aumentar"
 * e "− Diminuir" para fechar o container; com 95% ou mais ele conta como
 * cheio.
 *
 * A conta usa só a caixa master e o CBM do item marcado em "Escolher" na
 * tabela (pedido do dono, 13/11/2026; antes, sem item marcado, usava o
 * primeiro item do grupo com esses dados). Sem item marcado nada é calculado
 * nem gerado: o gerador pede para marcar um item, "Gerar programação" e
 * "+ Programação de compra" ficam desligados e os resultados em branco.
 * Trocar ou desmarcar o item desfaz a programação ainda não gravada do item
 * anterior; voltar ao item da escolha gravada traz de volta a programação
 * gravada com ele (`scheduleOnItemChange`).
 */

/** Caixa master do item do grupo (o CBM já resolvido das medidas, quando falta). */
export interface SelectionCarton {
  id: string;
  masterCartonQty: number | null;
  cbmPerCarton: number | null;
  /** Quantidade da planilha (total sugerido). */
  sheetQty: number | null;
  /** Cores do item no Book (duas ou mais = variações). */
  colors?: string[];
}

/** Textos da composição por cor (docs/PURCHASE_SCHEDULE.md, "Cores"). */
export interface ColorPreviewLabels {
  title: string;
  hint: string;
  single: string;
  /** "Programação {n} · {date}". */
  round: string;
  subtotal: string;
  total: string;
  color: string;
  pieces: string;
  cartons: string;
  /** Ajuste: {pieces}, {where}, {carton}, {down}, {up}. */
  adjust: string;
  /** " na programação {n}". */
  adjustWhere: string;
  none: string;
  /** Caixas por cor digitadas: o total é a soma. */
  custom: string;
  /** Voltar à divisão igual. */
  reset: string;
}

/** Evento do formulário com as cores incluídas do vencedor (card "Variações"). */
export const COLORS_EVENT = "selection:colors";
/** Evento do formulário com as peças de cada cor (o card mostra ao lado da cor). */
export const SPLIT_EVENT = "selection:split";

export interface ColorsEventDetail {
  itemId: string;
  colors: string[];
}
/**
 * Evento do card "Variações": caixas digitadas para uma cor (dono,
 * 14/11/2026), ou `reset` para voltar à divisão igual.
 */
export const CARTONS_EVENT = "selection:cartons";
export interface CartonsEventDetail {
  itemId: string;
  color?: string;
  cartons?: number;
  reset?: boolean;
}
export interface SplitEventDetail {
  itemId: string | null;
  rows: Array<{ color: string; quantity: number }> | null;
}

/** Avisa o card "Variações" das peças de cada cor (só quando mudam). */
function SplitBroadcast({ detail }: { detail: SplitEventDetail }) {
  const ref = useRef<HTMLSpanElement>(null);
  const key = JSON.stringify(detail);
  useEffect(() => {
    ref.current?.closest("form")?.dispatchEvent(
      new CustomEvent<SplitEventDetail>(SPLIT_EVENT, {
        detail: JSON.parse(key) as SplitEventDetail,
      }),
    );
  }, [key]);
  return <span ref={ref} hidden />;
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
  /** "{min} a {max}" quando as rodadas precisam de containers diferentes. */
  perRoundRange: string;
  /** "Containers no total" (informativo: a soma das rodadas) e a explicação. */
  totalField: string;
  totalFieldHint: string;
  submit: string;
  /** Título do cálculo escrito. */
  calc: string;
  /** A caixa do item escolhido. */
  item: string;
  /** Nenhum item marcado em "Escolher": nada é calculado nem gerado. */
  selectItem: string;
  /**
   * O item (produto) mudou depois de gerar: a programação saiu e precisa ser
   * gerada de novo. Sem ele, nada é dito (Seleção de itens).
   */
  regenerate?: string;
  /** O item não tem peças por caixa master: caixas não viram peças. */
  noPieces: string;
  noCarton: string;
  tooBig: string;
  errorTotal: string;
  errorRounds: string;
  result: string;
  extra: string;
  reduced: string;
  /** Rodadas iguais: "Cada rodada: … = {n} container…". */
  each: string;
  eachMany: string;
  /** Rodadas diferentes: "Containers por rodada: {list}." e cada item da lista. */
  list: string;
  listItem: string;
  listItemMany: string;
  totalContainers: string;
  load: string;
  /** Situação do container no cartão da rodada (com a quantidade de containers). */
  cardPartial: string;
  cardPartialMany: string;
  cardFull: string;
  cardFullMany: string;
  cardFullMargin: string;
  cardFullMarginMany: string;
  /** Ajustes da rodada: "+ Aumentar {pieces}" / "fecha {n} container". */
  up: string;
  upTo: string;
  upToMany: string;
  down: string;
  downTo: string;
  downToMany: string;
  /**
   * "− Diminuir" quando não há container cheio abaixo, e o motivo: a rodada
   * tem menos de um container, ou já está no mínimo de um container cheio.
   */
  downOff: string;
  downOffWhy: string;
  downOffMin: string;
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

const usable = (i: SelectionCarton) => !!(i.masterCartonQty && i.cbmPerCarton);

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
  savedColors = null,
  savedCartons = null,
  colorLabels,
  prefix = "",
  maxRounds = MAX_PURCHASE_ROUNDS,
  controlledItemId,
  quantityValue,
  onQuantityChange,
  unit = "pcs",
  className = "md:col-span-3",
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
  /** Cores incluídas na escolha gravada (do item `chosenItemId`). */
  savedColors?: string[] | null;
  /** Caixas por cor digitadas na escolha gravada (do `chosenItemId`). */
  savedCartons?: Record<string, number> | null;
  /** Sem ele, nada da composição por cor (Nova solicitação). */
  colorLabels?: ColorPreviewLabels;
  /**
   * Prefixo dos campos da programação no formulário (Nova solicitação:
   * `p<n>.`, um por produto).
   */
  prefix?: string;
  /** Máximo de programações (Seleção: 12; Nova solicitação: as 6 de sempre). */
  maxRounds?: number;
  /**
   * Item dado pela tela (Nova solicitação: o produto escolhido no campo
   * acima), em vez do rádio "Escolher" da tabela. `undefined` = o rádio.
   */
  controlledItemId?: string | null;
  /**
   * Quantidade do formulário (Nova solicitação): o card lê e escreve nela,
   * e o campo de peças do card não vai no formulário (vai o do produto).
   */
  quantityValue?: string;
  onQuantityChange?: (quantity: string) => void;
  /** Unidade mostrada no total das programações. */
  unit?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const perRoundId = useId();
  const totalFieldId = useId();
  const quantityHintId = useId();
  const selectItemId = useId();
  const [ownQty, setOwnQty] = useState(
    defaultQuantity === null ? "" : String(defaultQuantity),
  );
  const controlledQty = quantityValue !== undefined;
  const qty = controlledQty ? quantityValue : ownQty;
  const setQty = (v: string) => {
    if (onQuantityChange) onQuantityChange(v);
    if (!controlledQty) setOwnQty(v);
  };
  const radioMode = controlledItemId === undefined;
  const [scheduled, setScheduled] = useState(!!schedule?.items.length);
  const [chosen, setChosen] = useState<string | null>(
    radioMode ? chosenItemId : (controlledItemId ?? null),
  );
  // Programação desfeita porque o item (produto) mudou: avisa que é preciso
  // gerar de novo.
  const [regenerate, setRegenerate] = useState(false);
  // A programação gravada é do item da escolha gravada. Ela sai da tela
  // quando outro item é marcado e volta com ele, a não ser que o usuário a
  // desligue ("Sem programação") com esse item marcado.
  const savedItem = schedule?.items.length ? chosenItemId : null;
  const [savedKept, setSavedKept] = useState(true);
  // O bloco da programação é montado de novo quando ela sai da tela ou volta
  // (`initial`: sem rodadas, ou as gravadas).
  const [seed, setSeed] = useState<{
    key: number;
    initial: RequestSchedule | null;
  }>({ key: 0, initial: schedule });
  const [container, setContainer] = useState(
    () =>
      containerTypes.find((c) => c.code === "40HC")?.code ??
      [...containerTypes].sort((a, b) => b.capacityCbm - a.capacityCbm)[0]
        ?.code ??
      "",
  );
  // Os campos do gerador acompanham a tela: o total (em caixas e em peças)
  // é a soma das rodadas e o número de rodadas é o dos cartões. O digitado
  // vale só enquanto as rodadas não mudam (`at` = como estavam ao digitar):
  // mexer numa rodada (Aumentar, Diminuir, digitar, "+ Rodada", "×")
  // atualiza todos na hora. Do total guarda-se o último campo digitado
  // (caixas ou peças); o outro sai da conta.
  const [amountEdit, setAmountEdit] = useState<
    (TypedQuantity & { at: string }) | null
  >(null);
  const [roundsEdit, setRoundsEdit] = useState<{
    text: string;
    at: number;
  } | null>(null);
  // O que a última geração arredondou (some quando as rodadas ou o item
  // mudam).
  const [note, setNote] = useState<{
    pieces: number;
    extra: number;
    reduced: { cartons: number; rounds: number } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cores incluídas do vencedor, vindas do card "Variações" (evento).
  const [colorsPicked, setColorsPicked] = useState<ColorsEventDetail | null>(
    null,
  );
  // Caixas digitadas por cor (o total do pedido passa a ser a soma). Valem
  // enquanto somam as peças da tela; mexer no total ou nas datas depois
  // volta à divisão igual.
  const [custom, setCustom] = useState<{
    itemId: string;
    cartons: Record<string, number>;
  } | null>(() =>
    chosenItemId && savedCartons
      ? { itemId: chosenItemId, cartons: savedCartons }
      : null,
  );
  // O que a última renderização mostrou: as rodadas da tela, o `apply` da
  // programação e a divisão por cor (para editar a partir dela).
  const liveRef = useRef<number[]>([]);
  const applyRef = useRef<((q: number[]) => void) | null>(null);
  const shownRef = useRef<{
    itemId: string;
    cartons: Record<string, number>;
  } | null>(null);

  // Marcou outro item (ou nenhum): o que vinha do anterior sai. O aviso e o
  // arredondamento anotados somem; a programação ainda não gravada sai da
  // tela ou, de volta ao item da escolha gravada, a gravada volta.
  const markItem = useEffectEvent((next: string | null) => {
    if (next === chosen) return;
    setChosen(next);
    setNote(null);
    setError(null);
    const action = scheduleOnItemChange({
      on: scheduled,
      next,
      savedItem,
      savedKept,
    });
    if (action === "keep") return;
    const rounds =
      ref.current?.querySelectorAll("[data-schedule-item]").length ?? 0;
    setSeed((s) => ({
      key: s.key + 1,
      initial: action === "restore" ? schedule : null,
    }));
    setScheduled(action === "restore");
    if (action === "restore" && schedule) {
      setQty(String(scheduleTotal(schedule)));
      setAmountEdit(null);
      setRoundsEdit(null);
    } else if (rounds) {
      // Sem as rodadas, "Programações" continua com quantas eram.
      setRoundsEdit({ text: String(rounds), at: 0 });
      setRegenerate(true);
    }
  });

  // Nova solicitação: o item é o produto escolhido no campo acima.
  useEffect(() => {
    if (radioMode) return;
    const frame = requestAnimationFrame(() =>
      markItem(controlledItemId ?? null),
    );
    return () => cancelAnimationFrame(frame);
  }, [radioMode, controlledItemId]);

  // O item escolhido é o rádio "chosen" da tabela (no mesmo formulário). Além
  // de ouvir a troca, lê o que está marcado ao abrir e ao voltar para a
  // página: o navegador pode devolver o rádio marcado (ou nenhum) sem avisar.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      if (!radioMode) return;
      const el = form.querySelector<HTMLInputElement>(
        'input[name="chosen"]:checked',
      );
      markItem(el ? el.value : null);
    };
    const onChange = (e: Event) => {
      if (!radioMode) return;
      const el = e.target;
      if (el instanceof HTMLInputElement && el.name === "chosen" && el.checked)
        markItem(el.value);
    };
    const onColors = (e: Event) => {
      const detail = (e as CustomEvent<ColorsEventDetail>).detail;
      colorsChanged(detail);
      setColorsPicked(detail);
    };
    // Variações: com a composição por cor sem fechar caixas inteiras, nada é
    // gravado; a tela já diz o ajuste (o servidor também recusa).
    const onSubmit = (e: SubmitEvent) => {
      const blocked = ref.current?.querySelector<HTMLElement>(
        "[data-colors-error]",
      );
      if (!blocked) return;
      e.preventDefault();
      blocked.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const onCartons = (e: Event) =>
      typeCartons((e as CustomEvent<CartonsEventDetail>).detail);
    const frame = requestAnimationFrame(sync);
    form.addEventListener("change", onChange);
    form.addEventListener(COLORS_EVENT, onColors);
    form.addEventListener(CARTONS_EVENT, onCartons);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", sync);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("change", onChange);
      form.removeEventListener(COLORS_EVENT, onColors);
      form.removeEventListener(CARTONS_EVENT, onCartons);
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", sync);
    };
  }, [radioMode]);

  const intl = labels.intl;
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(intl, { maximumFractionDigits: digits });
  /** Fração de container: nunca "0" para o que ocupa pouco. */
  const frac = (n: number) =>
    n > 0 && n < 0.005 ? `<${fmt(0.01, 2)}` : fmt(n, 2);
  /** Ocupação: menos de 1% aparece como "<1". */
  const pctText = (pct: number) => (pct === 0 ? "<1" : String(pct));

  // A caixa da conta: só a do item marcado em "Escolher" (sem item marcado,
  // nenhuma: nada é calculado nem gerado).
  const item = items.find((i) => i.id === chosen) ?? null;
  const capacity =
    containerTypes.find((c) => c.code === container)?.capacityCbm ?? null;
  // "Total de caixas" e "Quantidade (peças)": o mesmo número em duas
  // unidades, pelas peças por caixa master do item. Sem nada digitado
  // acompanham a tela: as peças de agora e, em caixas inteiras, elas ou (em
  // branco) as da planilha. Sem as peças por caixa não há como converter: o
  // campo que sairia da conta fica como estava.
  const perCarton = item?.masterCartonQty ?? null;
  const typed = amountEdit && amountEdit.at === qty ? amountEdit : null;
  const { cartons: total, pieces } = quantityFields({
    typed,
    base: qty,
    masterCartonQty: perCarton,
    sheetQty: item?.sheetQty,
  });
  /**
   * Total do gerador em peças; NaN sem conversão. Digitado em peças vale
   * como está (a conta arredonda para caixas master inteiras e diz quanto);
   * senão, caixas × peças por caixa.
   */
  const totalPieces = () =>
    typed?.unit === "pieces" && perCarton
      ? parseCount(typed.text)
      : (piecesFromCartons(parseCount(total), perCarton) ?? NaN);
  const typeAmount = (unit: TypedQuantity["unit"], text: string) => {
    setAmountEdit({
      unit,
      text,
      pieces: unit === "pieces" ? text : pieces,
      at: qty,
    });
    setError(null);
  };
  // Nova solicitação: sem programação, o que se digita no card (caixas ou
  // peças) é a quantidade do produto no formulário.
  useEffect(() => {
    if (controlledQty && !scheduled && typed && pieces !== qty)
      onQuantityChange?.(pieces);
  });
  const hasCarton = !!(item && usable(item) && capacity);
  const perContainer =
    hasCarton && item
      ? Math.floor(capacity! / item.cbmPerCarton! + 1e-9)
      : null;
  const loadOf = (pieces: number) =>
    roundLoad(pieces, item?.masterCartonQty, item?.cbmPerCarton, capacity);

  /** Total em N rodadas iguais: caixas master inteiras quando o item as tem. */
  function divide(amount: number, count: number): number[] {
    if (hasCarton && amount > 0) {
      const out = planPurchaseRounds({
        total: amount,
        rounds: Math.max(1, Math.min(maxRounds, Math.floor(count))),
        masterCartonQty: item!.masterCartonQty,
        cbmPerCarton: item!.cbmPerCarton,
        containerCbm: capacity,
      });
      if ("plan" in out) return out.plan.rounds.map((r) => r.pieces);
    }
    return splitEvenly(amount, count, maxRounds);
  }

  function generate(apply: (q: number[]) => void, roundsValue: string) {
    // Sem item marcado não há caixa para a conta: nada é gerado (o botão fica
    // desligado e Enter nos campos também não gera).
    if (!item) return;
    const boxes = parseCount(total);
    if (!Number.isInteger(boxes) || boxes <= 0) {
      setError(gen.errorTotal);
      return;
    }
    const count = parseCount(roundsValue);
    if (!Number.isInteger(count) || count < 1 || count > maxRounds) {
      setError(fill(gen.errorRounds, { max: maxRounds }));
      return;
    }
    // Caixas → peças: sem as peças por caixa master do item não há conversão.
    const n = totalPieces();
    if (!perCarton || !(n > 0)) {
      setNote(null);
      setError(gen.noPieces);
      return;
    }
    setError(null);
    if (!hasCarton) {
      // Sem o CBM da caixa não há conta de containers: as caixas são
      // divididas igualmente (rodada sem caixa não entra).
      setNote(null);
      apply(
        splitEvenly(boxes, count, maxRounds)
          .filter((b) => b > 0)
          .map((b) => b * perCarton),
      );
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
              ? fill(gen.errorRounds, { max: maxRounds })
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
    setAmountEdit(null);
    setRoundsEdit(null);
  }

  const chip = (on: boolean) =>
    cx(
      "rounded-md border px-2.5 py-1 text-xs font-semibold",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
    );

  /** O cálculo escrito: a caixa, o container e o que as rodadas ocupam. */
  const calculation = (live: number[], roundsValue: string) => {
    if (!item)
      return (
        <p
          id={selectItemId}
          className="font-medium text-amber-800"
          data-generate-item="none"
          data-generate-select-item
        >
          {gen.selectItem}
        </p>
      );
    if (!hasCarton || perContainer === null)
      return (
        // Com as peças por caixa a conversão vale (só não há containers);
        // sem elas, caixas não viram peças.
        <p
          className="text-amber-800"
          data-generate-item={perCarton ? "missing" : "no-pieces"}
        >
          {perCarton ? gen.noCarton : gen.noPieces}
        </p>
      );
    // Rodadas da tela; sem programação, a prévia do que seria gerado.
    const typedTotal = totalPieces();
    const typedRounds = parseCount(roundsValue);
    const planned =
      !live.length &&
      typedTotal > 0 &&
      Number.isInteger(typedRounds) &&
      typedRounds >= 1 &&
      typedRounds <= maxRounds
        ? planPurchaseRounds({
            total: typedTotal,
            rounds: typedRounds,
            masterCartonQty: item.masterCartonQty,
            cbmPerCarton: item.cbmPerCarton,
            containerCbm: capacity,
          })
        : null;
    const preview = planned && "plan" in planned ? planned.plan : null;
    const shown = live.length
      ? live
      : preview
        ? preview.rounds.map((r) => r.pieces)
        : [];
    const loads = shown
      .map(loadOf)
      .filter(
        (l): l is RoundLoad & { containers: number; needed: number } =>
          !!l && l.containers !== null && l.needed !== null,
      );
    const complete = loads.length > 0 && loads.length === shown.length;
    const liveSum = live.reduce((a, q) => a + q, 0);
    const fresh = live.length && note && liveSum === note.pieces ? note : null;
    const rounding = live.length
      ? fresh
      : preview
        ? {
            extra: preview.extraPieces,
            reduced: preview.reduced
              ? { cartons: preview.cartons, rounds: preview.rounds.length }
              : null,
          }
        : null;
    const first = loads[0];
    const same =
      complete &&
      loads.every(
        (l) =>
          l.cartons === first.cartons &&
          l.needed === first.needed &&
          l.lastPct === first.lastPct,
      );
    return (
      <div className="space-y-1 text-zinc-700" data-generate-calc>
        <p className="font-semibold text-zinc-900">{gen.calc}</p>
        <p data-generate-item="ok">
          {fill(gen.item, {
            pcs: fmt(item.masterCartonQty!),
            cbm: fmt(item.cbmPerCarton!, 4),
            cartons: fmt(perContainer),
            pieces: fmt(perContainer * item.masterCartonQty!),
            container,
          })}
        </p>
        {complete ? (
          <>
            <p className="font-medium text-zinc-900" data-generate-result>
              {fill(gen.result, {
                rounds: loads.length,
                cartons: fmt(loads.reduce((a, l) => a + l.cartons, 0)),
                // As caixas em peças: o total que vai para a quantidade.
                pieces: fmt(shown.reduce((a, q) => a + q, 0)),
                cbm: fmt(
                  loads.reduce((a, l) => a + l.cbm, 0),
                  2,
                ),
                containers: frac(loads.reduce((a, l) => a + l.containers, 0)),
                container,
              })}
            </p>
            {rounding && rounding.extra > 0 ? (
              <p data-generate-extra>
                {fill(gen.extra, { extra: fmt(rounding.extra) })}
              </p>
            ) : null}
            {rounding?.reduced ? (
              <p className="text-amber-800" data-generate-reduced>
                {fill(gen.reduced, {
                  cartons: fmt(rounding.reduced.cartons),
                  rounds: rounding.reduced.rounds,
                })}
              </p>
            ) : null}
            <p data-generate-each>
              {same
                ? fill(first.needed > 1 ? gen.eachMany : gen.each, {
                    cartons: fmt(first.cartons),
                    cbm: fmt(first.cbm, 2),
                    n: fmt(first.needed),
                    pct: pctText(first.lastPct ?? 0),
                    container,
                  })
                : fill(gen.list, {
                    list: loads
                      .map((l, i) =>
                        fill(l.needed > 1 ? gen.listItemMany : gen.listItem, {
                          i: i + 1,
                          n: fmt(l.needed),
                          pct: pctText(l.lastPct ?? 0),
                        }),
                      )
                      .join(" · "),
                  })}
            </p>
            <p className="font-medium text-zinc-900" data-generate-containers>
              {fill(gen.totalContainers, {
                n: fmt(loads.reduce((a, l) => a + l.needed, 0)),
                container,
              })}
            </p>
          </>
        ) : null}
      </div>
    );
  };

  /**
   * Caixas de uma cor digitadas no card (dono, 14/11/2026): as outras cores
   * ficam como estão e o total do pedido vira a soma das cores. Com a
   * programação, o novo total é espalhado pelas datas na proporção de cada
   * uma (caixas inteiras); sem ela, vira a quantidade.
   */
  const typeCartons = useEffectEvent((d: CartonsEventDetail) => {
    if (!item || item.id !== d.itemId) return;
    if (d.reset) {
      setCustom(null);
      return;
    }
    const per = item.masterCartonQty;
    if (!per || per < 1 || !d.color || d.cartons === undefined) return;
    const base =
      shownRef.current?.itemId === item.id ? shownRef.current.cartons : {};
    retotal(
      item.id,
      per,
      {
        ...(custom?.itemId === item.id ? custom.cartons : {}),
        ...base,
        [d.color]: Math.max(0, Math.round(d.cartons)),
      },
      Object.keys(base),
    );
  });

  /** Grava as caixas por cor e faz do total a soma das cores incluídas. */
  function retotal(
    itemId: string,
    per: number,
    map: Record<string, number>,
    included: string[],
  ) {
    const total = included.reduce((s, c) => s + (map[c] ?? 0), 0);
    setCustom({ itemId, cartons: map });
    setNote(null);
    setError(null);
    const live = liveRef.current;
    if (scheduled && live.length && applyRef.current)
      applyRef.current(spreadCartons(total, live).map((n) => n * per));
    else {
      setQty(String(total * per));
      setAmountEdit(null);
    }
  }

  /**
   * Com caixas digitadas, tirar uma cor tira as caixas dela do total; pôr de
   * volta devolve as que ela tinha (ou a média das outras).
   */
  const colorsChanged = useEffectEvent((d: ColorsEventDetail) => {
    const before = shownRef.current;
    if (!item || item.id !== d.itemId || custom?.itemId !== item.id) return;
    if (!before || before.itemId !== item.id) return;
    const was = Object.keys(before.cartons);
    if (
      was.length === d.colors.length &&
      d.colors.every((c) => was.includes(c))
    )
      return;
    const per = item.masterCartonQty;
    if (!per || per < 1 || !d.colors.length) return;
    const known = d.colors.filter((c) => c in before.cartons);
    const avg = known.length
      ? Math.round(
          known.reduce((s, c) => s + before.cartons[c], 0) / known.length,
        )
      : 0;
    const map = { ...custom.cartons, ...before.cartons };
    for (const c of d.colors) if (!(c in map)) map[c] = avg;
    retotal(item.id, per, map, d.colors);
  });

  const generator = (apply: (q: number[]) => void, live: number[]) => {
    applyRef.current = apply;
    liveRef.current = live;
    const roundsValue =
      roundsEdit && roundsEdit.at === live.length
        ? roundsEdit.text
        : String(live.length || 2);
    // "Containers por rodada": o que as rodadas da tela precisam; sem
    // programação, o que a prévia (total ÷ rodadas) precisaria.
    const typedTotal = totalPieces();
    const typedRounds = parseCount(roundsValue);
    const shown = live.length
      ? live
      : hasCarton &&
          typedTotal > 0 &&
          Number.isInteger(typedRounds) &&
          typedRounds >= 1 &&
          typedRounds <= maxRounds
        ? divide(typedTotal, typedRounds)
        : [];
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
      : range.needed.min === range.needed.max
        ? fmt(range.needed.max)
        : fill(gen.perRoundRange, {
            min: fmt(range.needed.min),
            max: fmt(range.needed.max),
          });
    return (
      <div
        className="@container mt-1 space-y-2 rounded-lg border border-brand-200 bg-white p-2.5 text-xs"
        data-rounds-generator
        role="group"
        aria-label={gen.title}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement))
            return;
          // Sem programação, "Quantidade (peças)" é a quantidade da escolha:
          // Enter grava, como antes de o campo vir para esta linha.
          if (!scheduled && e.target.hasAttribute("data-selection-quantity"))
            return;
          e.preventDefault();
          generate(apply, roundsValue);
        }}
      >
        <p className="font-semibold text-zinc-900">{gen.title}</p>
        <p className="text-zinc-600">{gen.hint}</p>
        {/* Os campos numa linha só quando o cartão tem largura (ele ocupa a
            área de conteúdo inteira): os números dividem o espaço, o
            container e o botão ficam do tamanho deles. "Total de caixas" e
            "Quantidade (peças)" ficam lado a lado em colunas iguais (mesma
            largura), nunca menores que o rótulo mais comprido. Com menos
            largura (tablet deitado com o menu aberto), os campos seguem numa
            linha e o botão desce; em cartão estreito, em 3 ou 2 colunas. A
            medida é a do bloco (@container), que é a mesma com a programação
            ligada ou desligada. */}
        <div
          className="grid grid-cols-2 items-end gap-x-2.5 gap-y-2 @md:grid-cols-3 @[47.5rem]:grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(5rem,1fr)_auto_minmax(max-content,1fr)_minmax(max-content,1fr)] @[57rem]:grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(5rem,1fr)_auto_minmax(max-content,1fr)_minmax(max-content,1fr)_auto]"
          data-generate-fields
        >
          <label className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700">{gen.total}</span>
            <input
              type="text"
              inputMode="numeric"
              value={total}
              onChange={(e) => typeAmount("cartons", e.target.value)}
              data-generate-total
              className={cx(inputDenseClass, "w-full tabular-nums")}
            />
          </label>
          {/* A quantidade da escolha, em peças: só vai no formulário sem
              programação (com ela, a quantidade é a soma das rodadas). */}
          <label className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700">{label}</span>
            <input
              type="text"
              name={scheduled || controlledQty ? undefined : "quantity"}
              inputMode="numeric"
              autoComplete="off"
              value={pieces}
              onChange={(e) => typeAmount("pieces", e.target.value)}
              aria-describedby={quantityHintId}
              data-selection-quantity
              className={cx(inputDenseClass, "w-full tabular-nums")}
            />
          </label>
          <label className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700">
              {gen.rounds}
            </span>
            <input
              type="number"
              min="1"
              max={maxRounds}
              value={roundsValue}
              onChange={(e) => {
                setRoundsEdit({ text: e.target.value, at: live.length });
                setError(null);
              }}
              data-generate-rounds
              className={cx(inputDenseClass, "w-full tabular-nums")}
            />
          </label>
          <div className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700">
              {gen.container}
            </span>
            <div
              className="flex min-h-8 flex-wrap items-center gap-1"
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
          <div className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700" id={perRoundId}>
              {gen.perRound}
            </span>
            {/* Informativo: sai das peças de cada rodada, ninguém digita. */}
            <output
              aria-labelledby={perRoundId}
              title={gen.perRoundHint}
              data-generate-per-round
              className="flex min-h-8 w-full min-w-20 cursor-default items-center rounded-md border border-dashed border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-zinc-700"
            >
              {perRoundText}
            </output>
          </div>
          <div className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700" id={totalFieldId}>
              {gen.totalField}
            </span>
            {/* Informativo: a soma dos containers de todas as rodadas. */}
            <output
              aria-labelledby={totalFieldId}
              title={gen.totalFieldHint}
              data-generate-total-containers
              className="flex min-h-8 w-full min-w-20 cursor-default items-center rounded-md border border-dashed border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-zinc-700"
            >
              {range ? fmt(range.needed.total) : "—"}
            </output>
          </div>
          <button
            type="button"
            onClick={() => generate(apply, roundsValue)}
            disabled={!item || !total}
            aria-describedby={item ? undefined : selectItemId}
            data-generate-submit
            className="order-1 min-h-8 justify-self-start whitespace-nowrap rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50 @[57rem]:order-none"
          >
            {gen.submit}
          </button>
          {/* A dica da quantidade fica logo abaixo dos campos: quando o
              botão não cabe na linha deles, ele vem depois dela. */}
          <p
            id={quantityHintId}
            className="col-span-full text-zinc-500"
            data-selection-quantity-hint
          >
            {scheduled ? scheduledHint : hint}
          </p>
        </div>
        {calculation(live, roundsValue)}
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

  const stepClass =
    "block w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight";

  /** Um ajuste da rodada: o quanto muda e com quantos containers fica. */
  const stepButton = (
    kind: "up" | "down",
    step: RoundStep,
    set: (quantity: number) => void,
  ) => {
    const main = fill(kind === "up" ? gen.up : gen.down, {
      pieces: fmt(step.pieces),
    });
    const many = step.containers > 1;
    const to = fill(
      kind === "up"
        ? many
          ? gen.upToMany
          : gen.upTo
        : many
          ? gen.downToMany
          : gen.downTo,
      { n: fmt(step.containers), container },
    );
    return (
      <button
        type="button"
        onClick={() => set(step.target)}
        aria-label={`${main}: ${to}`}
        {...(kind === "up"
          ? { "data-round-up": step.target }
          : { "data-round-down": step.target })}
        className={cx(
          stepClass,
          "border-brand-200 bg-white hover:border-brand-400 hover:bg-brand-50",
        )}
      >
        <span className="block font-semibold text-brand-700">{main}</span>
        <span className="block text-zinc-500">{to}</span>
      </button>
    );
  };

  // Variações de cor do vencedor: as incluídas no card (padrão: todas; na
  // escolha gravada, as gravadas).
  const itemColors = item?.colors ?? [];
  const variants = itemColors.length > 1;
  const included = !variants
    ? []
    : colorsPicked?.itemId === item!.id
      ? colorsPicked.colors
      : item!.id === chosenItemId && savedColors
        ? itemColors.filter((c) => savedColors.includes(c))
        : itemColors;

  /**
   * Composição por cor (dono, 14/11/2026): o total dividido entre as cores
   * incluídas, em caixas master inteiras, e por data com a programação. A
   * mesma conta do servidor (`splitByColor`); sem fechar caixas, diz o ajuste.
   */
  const colorPreview = (live: number[], dates: string[]) => {
    if (!item || !variants || !colorLabels) return null;
    const single = !live.length;
    const typedPieces = parseCount(pieces);
    const rounds = single
      ? [typedPieces > 0 ? typedPieces : (item.sheetQty ?? 0)]
      : live;
    const cl = colorLabels!;
    if (!included.length)
      return (
        <div data-color-preview="none">
          <SplitBroadcast detail={{ itemId: item.id, rows: null }} />
          <p
            className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
            data-colors-error="none"
          >
            {cl.none}
          </p>
        </div>
      );
    if (!(rounds.reduce((s, q) => s + q, 0) > 0)) return null;
    // Caixas digitadas por cor: valem enquanto somam as peças da tela.
    const per = item.masterCartonQty ?? 0;
    const typed =
      custom?.itemId === item.id && per > 0
        ? Object.fromEntries(
            included.map((c) => [c, custom.cartons[c] ?? 0] as const),
          )
        : null;
    const active =
      !!typed &&
      Object.values(typed).reduce((s, n) => s + n, 0) * per ===
        rounds.reduce((s, q) => s + q, 0);
    const out = splitByColor({
      rounds,
      colors: included,
      carton: item.masterCartonQty,
      cartons: active ? typed : null,
    });
    shownRef.current =
      out.ok && per > 0
        ? {
            itemId: item.id,
            cartons: Object.fromEntries(
              out.rows.map((r) => [r.color, Math.round(r.quantity / per)]),
            ),
          }
        : null;
    const where = (i: number) =>
      single ? "" : fill(cl.adjustWhere, { n: i + 1 });
    if (!out.ok)
      return (
        <div data-color-preview="error">
          <SplitBroadcast detail={{ itemId: item.id, rows: null }} />
          <p
            className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
            data-colors-error="cartons"
            role="alert"
          >
            {out.error === "colors_none"
              ? cl.none
              : out.error === "colors_total"
                ? cl.none
                : fill(cl.adjust, {
                    pieces: fmt(out.pieces),
                    where: where(out.round),
                    carton: fmt(out.carton),
                    down: fmt(out.down),
                    up: fmt(out.up),
                  })}
          </p>
        </div>
      );
    const carton = item.masterCartonQty;
    const boxes = (q: number) =>
      carton && carton > 0 && included.length > 1
        ? fmt(Math.round(q / carton))
        : "—";
    const grand = out.rows.reduce((s, r) => s + r.quantity, 0);
    const dateText = (iso: string) => {
      if (!iso) return "—";
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intl, {
        timeZone: "UTC",
      });
    };
    const cellClass = "px-2 py-1 text-right tabular-nums";
    return (
      <div
        className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2.5"
        data-color-preview="ok"
      >
        <SplitBroadcast
          detail={{
            itemId: item.id,
            rows: out.rows.map((r) => ({
              color: r.color,
              quantity: r.quantity,
            })),
          }}
        />
        <p className="text-xs font-semibold text-zinc-800">{cl.title}</p>
        {active ? (
          <p
            className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-600"
            data-color-custom
          >
            <input
              type="hidden"
              name={`colorCartons.${item.id}`}
              value={JSON.stringify(typed)}
            />
            <span>{cl.custom}</span>
            <button
              type="button"
              onClick={() => setCustom(null)}
              className="font-medium text-brand-700 underline underline-offset-2"
              data-color-reset
            >
              {cl.reset}
            </button>
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500">{cl.hint}</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-72 text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-1 font-semibold">{cl.color}</th>
                <th className="px-2 py-1 text-right font-semibold">
                  {cl.pieces}
                </th>
                <th className="px-2 py-1 text-right font-semibold">
                  {cl.cartons}
                </th>
              </tr>
            </thead>
            {rounds.map((q, i) => (
              <tbody
                key={i}
                className="border-t border-zinc-200"
                data-color-round={i + 1}
              >
                <tr>
                  <th
                    colSpan={3}
                    className="px-2 pt-1.5 text-left font-semibold text-zinc-700"
                  >
                    {single
                      ? cl.single
                      : fill(cl.round, { n: i + 1, date: dateText(dates[i]) })}
                  </th>
                </tr>
                {out.rows.map((r) => (
                  <tr key={r.color} data-color-line={r.color}>
                    <td className="px-2 py-1 text-zinc-700">{r.color}</td>
                    <td className={cellClass} data-color-pieces>
                      {fmt(r.rounds[i])}
                    </td>
                    <td className={cx(cellClass, "text-zinc-500")}>
                      {boxes(r.rounds[i])}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-zinc-800">
                  <td className="px-2 py-1">{cl.subtotal}</td>
                  <td className={cellClass} data-color-subtotal>
                    {fmt(q)}
                  </td>
                  <td className={cx(cellClass, "text-zinc-500")}>{boxes(q)}</td>
                </tr>
              </tbody>
            ))}
            <tbody className="border-t-2 border-zinc-300">
              {single
                ? null
                : out.rows.map((r) => (
                    <tr key={r.color} data-color-total={r.color}>
                      <td className="px-2 py-1 text-zinc-700">{r.color}</td>
                      <td className={cellClass}>{fmt(r.quantity)}</td>
                      <td className={cx(cellClass, "text-zinc-500")}>
                        {boxes(r.quantity)}
                      </td>
                    </tr>
                  ))}
              <tr className="font-semibold text-zinc-900">
                <td className="px-2 py-1">{cl.total}</td>
                <td className={cellClass} data-color-grand>
                  {fmt(grand)}
                </td>
                <td className={cx(cellClass, "text-zinc-500")}>
                  {boxes(grand)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const roundInfo = (pieces: number, set: (quantity: number) => void) => {
    const load = loadOf(pieces);
    if (!load) return null;
    const many = (load.needed ?? 1) > 1;
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
            containers: load.containers === null ? "—" : frac(load.containers),
            container,
          })}
        </p>
        {load.containers !== null &&
        load.needed !== null &&
        load.lastPct !== null ? (
          <>
            <p
              className={cx(
                "text-[11px] font-semibold",
                load.full ? "text-emerald-700" : "text-amber-800",
              )}
              data-round-status
            >
              {fill(
                load.full
                  ? load.lastPct === 100
                    ? many
                      ? gen.cardFullMany
                      : gen.cardFull
                    : many
                      ? gen.cardFullMarginMany
                      : gen.cardFullMargin
                  : many
                    ? gen.cardPartialMany
                    : gen.cardPartial,
                { n: fmt(load.needed), pct: pctText(load.lastPct), container },
              )}
            </p>
            {load.up ? stepButton("up", load.up, set) : null}
            {load.down ? (
              stepButton("down", load.down, set)
            ) : (
              // Os dois botões ficam sempre no cartão: sem container cheio
              // abaixo, o de diminuir aparece desligado, com o motivo.
              <button
                type="button"
                disabled
                data-round-down-off
                className={cx(
                  stepClass,
                  "cursor-not-allowed border-zinc-200 bg-zinc-50",
                )}
              >
                <span className="block font-semibold text-zinc-400">
                  {gen.downOff}
                </span>
                <span className="block text-zinc-400">
                  {load.full ? gen.downOffMin : gen.downOffWhy}
                </span>
              </button>
            )}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className={cx("space-y-3", className)}
      data-selection-quantity-block
    >
      {/* De qual produto é a programação: o servidor recusa a programação
          gerada para outro produto (Nova solicitação). */}
      {scheduled && chosen && !radioMode ? (
        <input type="hidden" name={`${prefix}schedule.for`} value={chosen} />
      ) : null}
      {regenerate && gen.regenerate && !scheduled ? (
        <p
          className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
          role="status"
          data-schedule-regenerate
        >
          {gen.regenerate}
        </p>
      ) : null}
      <div>
        <RequestScheduleFields
          key={seed.key}
          prefix={prefix}
          total={pieces}
          unit={unit}
          onTotalChange={(t) => {
            // As rodadas mudaram: a quantidade é a soma e os campos do
            // gerador voltam a acompanhar a tela (o digitado neles caduca).
            setQty(t);
            setAmountEdit(null);
            setRoundsEdit(null);
          }}
          labels={labels}
          max={maxRounds}
          initial={seed.initial}
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
          onToggle={(on) => {
            setScheduled(on);
            if (on) {
              setRegenerate(false);
              return;
            }
            setNote(null);
            // "Sem programação" com o item da escolha gravada: a gravada
            // não volta mais ao remarcar o item.
            if (chosen !== null && chosen === savedItem) setSavedKept(false);
          }}
          blocked={!item}
          generator={generator}
          roundInfo={roundInfo}
          split={divide}
          after={colorPreview}
        />
      </div>
    </div>
  );
}
