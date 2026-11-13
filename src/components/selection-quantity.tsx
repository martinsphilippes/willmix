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
  cartonsFromPieces,
  containersPerRound,
  piecesFromCartons,
  planPurchaseRounds,
  roundLoad,
  type RoundLoad,
  type RoundStep,
} from "@/lib/purchase-rounds";
import { splitEvenly } from "@/lib/workflow/request-schedule";

/*
 * Quantidade da escolha do grupo com a programação de compra
 * (docs/PURCHASE_SCHEDULE.md): sem programação, a quantidade digitada (em
 * branco = a da planilha); com ela, rodadas com peças e intervalo, e a
 * quantidade passa a ser a soma das rodadas (o campo fica só para leitura).
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
 * A conta usa a caixa master e o CBM do item marcado como escolhido na
 * tabela. Sem nenhum marcado, usa o primeiro item do grupo que tem esses
 * dados (e diz qual): a conta, os containers e os botões não somem.
 */

/** Caixa master do item do grupo (o CBM já resolvido das medidas, quando falta). */
export interface SelectionCarton {
  id: string;
  /** Como o item aparece na conta (código e fornecedor). */
  label: string;
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
  /** "{min} a {max}" quando as rodadas precisam de containers diferentes. */
  perRoundRange: string;
  /** "Containers no total" (informativo: a soma das rodadas) e a explicação. */
  totalField: string;
  totalFieldHint: string;
  submit: string;
  /** Título do cálculo escrito. */
  calc: string;
  /** A caixa do item escolhido; `itemAssumed` quando nenhum está marcado. */
  item: string;
  itemAssumed: string;
  assumedNote: string;
  noItem: string;
  /** O item não tem peças por caixa master: caixas não viram peças. */
  noPieces: string;
  noCarton: string;
  tooBig: string;
  errorTotal: string;
  errorRounds: string;
  result: string;
  extra: string;
  reduced: string;
  /** As rodadas foram geradas com a caixa de outro item. */
  regen: string;
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

/** Peças são inteiras: pontos, vírgulas e espaços são separador de milhar. */
const parseNum = (s: string) => {
  const t = String(s).replace(/[.,\s]/g, "");
  return t ? Number(t) : NaN;
};

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
  const totalFieldId = useId();
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
  // Os dois campos do gerador acompanham a tela: o total é a soma das
  // rodadas e o número de rodadas é o dos cartões. O digitado vale só
  // enquanto as rodadas não mudam (`at` = como estavam ao digitar): mexer
  // numa rodada (Aumentar, Diminuir, digitar, "+ Rodada", "×") atualiza os
  // dois na hora.
  const [totalEdit, setTotalEdit] = useState<{
    text: string;
    at: string;
  } | null>(null);
  const [roundsEdit, setRoundsEdit] = useState<{
    text: string;
    at: number;
  } | null>(null);
  // O que a última geração arredondou e com a caixa de qual item (some
  // quando as rodadas mudam).
  const [note, setNote] = useState<{
    pieces: number;
    extra: number;
    reduced: { cartons: number; rounds: number } | null;
    itemId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // O item escolhido é o rádio "chosen" da tabela (no mesmo formulário). Além
  // de ouvir a troca, lê o que já está marcado ao abrir e ao voltar para a
  // página: o navegador pode devolver o rádio marcado sem avisar.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const el = form.querySelector<HTMLInputElement>(
        'input[name="chosen"]:checked',
      );
      if (el) setChosen(el.value);
    };
    const onChange = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.name === "chosen" && el.checked)
        setChosen(el.value);
    };
    const frame = requestAnimationFrame(sync);
    form.addEventListener("change", onChange);
    window.addEventListener("pageshow", sync);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("change", onChange);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  const intl = labels.intl;
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(intl, { maximumFractionDigits: digits });
  /** Fração de container: nunca "0" para o que ocupa pouco. */
  const frac = (n: number) =>
    n > 0 && n < 0.005 ? `<${fmt(0.01, 2)}` : fmt(n, 2);
  /** Ocupação: menos de 1% aparece como "<1". */
  const pctText = (pct: number) => (pct === 0 ? "<1" : String(pct));

  // A caixa da conta: a do item marcado; sem nenhum marcado, a do primeiro
  // item do grupo que tem peças por caixa master e CBM.
  const marked = items.find((i) => i.id === chosen) ?? null;
  const fallback = marked ? null : (items.find(usable) ?? null);
  const item = marked ?? fallback;
  const assumed = !marked && !!fallback;
  const capacity =
    containerTypes.find((c) => c.code === container)?.capacityCbm ?? null;
  // O total do gerador é em CAIXAS master; a conta segue em peças (caixas ×
  // peças por caixa master do item). O campo acompanha a tela: as peças de
  // agora (as da quantidade ou, em branco, as da planilha) em caixas
  // inteiras. Sem as peças por caixa não há como converter: fica vazio.
  const perCarton = item?.masterCartonQty ?? null;
  const piecesNow = qty.trim() ? parseNum(qty) : (item?.sheetQty ?? NaN);
  const total =
    totalEdit && totalEdit.at === qty
      ? totalEdit.text
      : String(cartonsFromPieces(piecesNow, perCarton) ?? "");
  /** Peças do total digitado (caixas × peças por caixa); NaN sem conversão. */
  const totalPieces = () =>
    piecesFromCartons(parseNum(total), perCarton) ?? NaN;
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
    const boxes = parseNum(total);
    if (!Number.isInteger(boxes) || boxes <= 0) {
      setError(gen.errorTotal);
      return;
    }
    const count = parseNum(roundsValue);
    if (!Number.isInteger(count) || count < 1 || count > MAX_PURCHASE_ROUNDS) {
      setError(fill(gen.errorRounds, { max: MAX_PURCHASE_ROUNDS }));
      return;
    }
    // Caixas → peças: sem as peças por caixa master do item não há conversão.
    const n = piecesFromCartons(boxes, perCarton);
    if (n === null) {
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
        splitEvenly(boxes, count, MAX_PURCHASE_ROUNDS)
          .filter((b) => b > 0)
          .map((b) => b * perCarton!),
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
        itemId: item!.id,
      });
      apply(plan.rounds.map((r) => r.pieces));
    }
    // Gerado: os campos voltam a acompanhar as rodadas da tela.
    setTotalEdit(null);
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
        <p className="text-amber-800" data-generate-item="none">
          {gen.noItem}
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
    const typedRounds = parseNum(roundsValue);
    const planned =
      !live.length &&
      typedTotal > 0 &&
      Number.isInteger(typedRounds) &&
      typedRounds >= 1 &&
      typedRounds <= MAX_PURCHASE_ROUNDS
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
        <p data-generate-item={assumed ? "assumed" : "ok"}>
          {fill(assumed ? gen.itemAssumed : gen.item, {
            label: item.label,
            pcs: fmt(item.masterCartonQty!),
            cbm: fmt(item.cbmPerCarton!, 4),
            cartons: fmt(perContainer),
            pieces: fmt(perContainer * item.masterCartonQty!),
            container,
          })}
        </p>
        {assumed ? (
          <p className="text-amber-800" data-generate-assumed>
            {gen.assumedNote}
          </p>
        ) : null}
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
            {live.length && note && note.itemId !== item.id ? (
              <p className="text-amber-800" data-generate-regen>
                {gen.regen}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  const generator = (apply: (q: number[]) => void, live: number[]) => {
    const roundsValue =
      roundsEdit && roundsEdit.at === live.length
        ? roundsEdit.text
        : String(live.length || 2);
    // "Containers por rodada": o que as rodadas da tela precisam; sem
    // programação, o que a prévia (total ÷ rodadas) precisaria.
    const typedTotal = totalPieces();
    const typedRounds = parseNum(roundsValue);
    const shown = live.length
      ? live
      : hasCarton &&
          typedTotal > 0 &&
          Number.isInteger(typedRounds) &&
          typedRounds >= 1 &&
          typedRounds <= MAX_PURCHASE_ROUNDS
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
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            generate(apply, roundsValue);
          }
        }}
      >
        <p className="font-semibold text-zinc-900">{gen.title}</p>
        <p className="text-zinc-600">{gen.hint}</p>
        {/* Os campos numa linha só quando o cartão tem largura (ele ocupa a
            área de conteúdo inteira): os quatro números dividem o espaço, o
            container e o botão ficam do tamanho deles. Em cartão estreito,
            em 3 ou 2 colunas. A medida é a do bloco (@container), que é a
            mesma com a programação ligada ou desligada num tablet deitado. */}
        <div
          className="grid grid-cols-2 items-end gap-x-2.5 gap-y-2 @md:grid-cols-3 @[47rem]:grid-cols-[minmax(5rem,1fr)_minmax(5rem,1fr)_auto_minmax(max-content,1fr)_minmax(max-content,1fr)_auto]"
          data-generate-fields
        >
          <label className="min-w-0 space-y-1">
            <span className="block font-medium text-zinc-700">{gen.total}</span>
            <input
              type="text"
              inputMode="numeric"
              value={total}
              onChange={(e) => {
                setTotalEdit({ text: e.target.value, at: qty });
                setError(null);
              }}
              data-generate-total
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
              max={MAX_PURCHASE_ROUNDS}
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
            disabled={!total}
            data-generate-submit
            className="min-h-8 justify-self-start whitespace-nowrap rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {gen.submit}
          </button>
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
          onTotalChange={(t) => {
            // As rodadas mudaram: a quantidade é a soma e os campos do
            // gerador voltam a acompanhar a tela (o digitado neles caduca).
            setQty(t);
            setTotalEdit(null);
            setRoundsEdit(null);
          }}
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
