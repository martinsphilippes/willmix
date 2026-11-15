"use client";

import { useMemo, useState } from "react";
import { cx, inputClass } from "@/components/ui";
import {
  DEFAULT_SCHEDULE_INTERVAL,
  MAX_SCHEDULE_ROUNDS,
  SCHEDULE_INTERVALS,
  addDaysIso,
  todayIso,
} from "@/lib/workflow/request-schedule";
import type { FixedSchedulePlan } from "@/components/request-schedule";
import {
  PriceForecast,
  type PriceForecastLabels,
} from "@/components/price-forecast";
import { isPieceUnit } from "@/lib/moq";
import {
  RequestProductFields,
  type ProductFill,
} from "@/components/request-product-fields";
import type { ScheduleLabels } from "@/components/request-schedule";
import {
  SelectionQuantity,
  type GenerateLabels,
} from "@/components/selection-quantity";

type ProductFieldsProps = Omit<
  React.ComponentProps<typeof RequestProductFields>,
  | "prefix"
  | "presetProductId"
  | "presetVariantId"
  | "defaultNotInCatalog"
  | "suggestions"
  | "onCatalogModeChange"
>;

/**
 * Produtos da nova solicitação: uma linha por produto, com "+ Adicionar outro
 * produto". Cada linha vira uma solicitação própria (mesmo lote). Os campos de
 * cada linha levam o prefixo `p<n>.`; o que veio da busca por foto/link e da
 * programação de compra só preenche a primeira linha.
 */
export function RequestItems({
  presetProductId,
  presetVariantId = "",
  presetQuantity,
  defaultNotInCatalog,
  suggestions,
  labels,
  containerTypes,
  ...fields
}: ProductFieldsProps & {
  /** Containers das Configurações (o card de gerar a programação). */
  containerTypes: Array<{ code: string; capacityCbm: number }>;
  presetProductId: string;
  /** Variação pré-escolhida (?variantId=) da primeira linha. */
  presetVariantId?: string;
  presetQuantity: string;
  defaultNotInCatalog: boolean;
  suggestions: React.ComponentProps<typeof RequestProductFields>["suggestions"];
  labels: ProductFieldsProps["labels"] & {
    products: string;
    productN: string;
    add: string;
    remove: string;
    hint: string;
    quantity: string;
    unit: string;
    /** "Pedido mínimo: {n} {unit}". */
    moq: string;
    /** Quantidade digitada abaixo do mínimo ({n}, {unit}). */
    belowMoq: string;
    /** Os mesmos, com o mínimo em caixas ({cartons}) quando as peças vêm das caixas. */
    moqCartons?: string;
    belowMoqCartons?: string;
    /** Idioma dos números (ex.: "pt-BR"). */
    intl: string;
    schedule: ScheduleLabels;
    /** Card "Gerar programação pela quantidade" (o mesmo da Seleção de itens). */
    generate: GenerateLabels;
    /** O mesmo aviso de "sem peças por caixa" para o produto fora do catálogo. */
    generateOutside: string;
    /** "Quantidade (peças)" do card e as dicas dele. */
    pieces: string;
    piecesHint: string;
    piecesScheduledHint: string;
    /** Bloco "Programação de compra do pedido" (dono, 15/11/2026). */
    plan: OrderPlanLabels;
    /**
     * Previsão de preço ao cliente final por produto (Wellmix; dono,
     * 15/11/2026). Sem ela (login do cliente), o bloco não aparece.
     */
    forecast?: PriceForecastLabels;
  };
}) {
  const [rows, setRows] = useState<number[]>([0]);
  // Programação do pedido (dono, 15/11/2026): quantas programações e as
  // datas são do pedido; cada produto só reparte a quantidade dele nelas.
  const [planCount, setPlanCount] = useState("1");
  const [planInterval, setPlanInterval] = useState<number>(
    DEFAULT_SCHEDULE_INTERVAL,
  );
  const [planCustom, setPlanCustom] = useState("");
  const [planFirst, setPlanFirst] = useState(() =>
    addDaysIso(todayIso(), DEFAULT_SCHEDULE_INTERVAL),
  );
  const countNumber = Math.floor(Number(planCount));
  const count =
    Number.isFinite(countNumber) && countNumber >= 1
      ? Math.min(countNumber, MAX_SCHEDULE_ROUNDS)
      : 1;
  const intervalDays =
    planInterval > 0 ? planInterval : Math.max(0, Number(planCustom) || 0);
  const plan = useMemo<FixedSchedulePlan>(
    () => ({ count, firstDate: planFirst, intervalDays }),
    [count, planFirst, intervalDays],
  );
  const [next, setNext] = useState(1);
  // Produto (e variação) escolhidos por linha, com a ficha: o pedido mínimo
  // deles vale para a quantidade; com variação escolhida, o mínimo é o dela.
  type Chosen = { id: string; variantId: string; fill: ProductFill | null };
  const [product, setProduct] = useState<Record<number, Chosen>>(() => ({
    0: {
      id: presetProductId,
      variantId: presetVariantId,
      fill: fields.products.find((x) => x.id === presetProductId) ?? null,
    },
  }));
  const moqOf = (chosen: Chosen | undefined) => {
    if (!chosen?.id) return null;
    const p = chosen.fill;
    if (!p) return null;
    const v = chosen.variantId
      ? p.variants.find((x) => x.id === chosen.variantId)
      : null;
    return (v ? v.moq : p.moq) || null;
  };
  /** Peças por caixa master do produto (ou da variação) da linha. */
  const perCartonOf = (chosen: Chosen | undefined, rowUnit = "un") => {
    if (!chosen?.id || !isPieceUnit(rowUnit)) return null;
    const p = chosen.fill;
    const v = chosen.variantId
      ? p?.variants.find((x) => x.id === chosen.variantId)
      : null;
    const per = (v ? v.masterCartonQty : p?.masterCartonQty) ?? null;
    return per && per > 0 ? per : null;
  };
  /**
   * O pedido mínimo em caixas inteiras quando as peças vêm das caixas (dono,
   * 14/11/2026): 2.000 peças de 48 por caixa = 42 caixas = 2.016 peças.
   */
  const minQty = (moq: number, per: number | null) =>
    per ? Math.ceil(moq / per - 1e-9) * per : moq;
  // Quantidade e unidade por linha (a programação de entregas soma na quantidade).
  // Produto com pedido mínimo já começa nele (nunca abaixo).
  const [qty, setQty] = useState<Record<number, string>>(() => {
    const chosen: Chosen = {
      id: presetProductId,
      variantId: presetVariantId,
      fill: fields.products.find((x) => x.id === presetProductId) ?? null,
    };
    const moq = moqOf(chosen);
    const preset = Number(presetQuantity.replace(",", ".")) || 0;
    return {
      0:
        moq && preset < moq
          ? String(minQty(moq, perCartonOf(chosen)))
          : presetQuantity,
    };
  });
  // Unidade por linha: o campo saiu da tela (dono, 14/11/2026) e a
  // solicitação vai em peças ("un"), como o bloco "Programação de compra".
  const [unit] = useState<Record<number, string>>({ 0: "un" });
  // Linhas "fora do catálogo": sem produto do cadastro, a programação é feita
  // sem caixa master (dividida em partes iguais), como antes.
  const [outside, setOutside] = useState<Record<number, boolean>>({
    0: defaultNotInCatalog,
  });

  /**
   * O item do card de programação: o produto (e a variação) escolhido no
   * campo acima, com a caixa master dele. Fora do catálogo, um item sem
   * caixa; sem produto escolhido, nenhum (o card pede o produto).
   */
  const cartonOf = (index: number) => {
    const chosen = product[index];
    const pieceUnit = isPieceUnit(unit[index] ?? "un");
    if (outside[index] && !chosen?.id)
      return {
        id: "outside",
        masterCartonQty: null,
        cbmPerCarton: null,
        sheetQty: null,
      };
    if (!chosen?.id) return null;
    const p = chosen.fill;
    const v = chosen.variantId
      ? p?.variants.find((x) => x.id === chosen.variantId)
      : null;
    return {
      id: `${chosen.id}:${chosen.variantId}`,
      // Caixa master só vale com a quantidade em peças.
      masterCartonQty: pieceUnit
        ? ((v ? v.masterCartonQty : p?.masterCartonQty) ?? null)
        : null,
      cbmPerCarton: pieceUnit
        ? ((v ? v.cbmPerCarton : p?.cbmPerCarton) ?? null)
        : null,
      sheetQty: null,
    };
  };

  /** Produto ou variação da linha mudou: quantidade vazia ou abaixo do mínimo sobe para ele. */
  function onProductChange(
    index: number,
    id: string,
    variantId: string,
    fill: ProductFill | null,
  ) {
    setProduct((p) => ({ ...p, [index]: { id, variantId, fill } }));
    const moq = moqOf({ id, variantId, fill });
    if (!moq) return;
    const per = perCartonOf({ id, variantId, fill }, unit[index]);
    setQty((q) => {
      const current = Number((q[index] ?? "").replace(",", ".")) || 0;
      return current < moq && isPieceUnit(unit[index])
        ? { ...q, [index]: String(minQty(moq, per)) }
        : q;
    });
  }
  /** Saiu do campo abaixo do mínimo: volta ao mínimo (a regra da vitrine). */
  function floorToMoq(index: number) {
    const moq = moqOf(product[index]);
    if (!moq || !isPieceUnit(unit[index])) return;
    const per = perCartonOf(product[index], unit[index]);
    setQty((q) => {
      const current = Number((q[index] ?? "").replace(",", ".")) || 0;
      return current < moq ? { ...q, [index]: String(minQty(moq, per)) } : q;
    });
  }
  const fill = (text: string, n: number, u: string, cartons?: number) =>
    text
      .replace("{n}", n.toLocaleString(labels.intl))
      .replace("{unit}", u)
      .replace("{cartons}", (cartons ?? 0).toLocaleString(labels.intl));

  function add() {
    setRows((r) => [...r, next]);
    setNext((n) => n + 1);
  }
  function remove(index: number) {
    setRows((r) => (r.length > 1 ? r.filter((i) => i !== index) : r));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{labels.products}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
          {labels.hint}
        </p>
      </div>
      <OrderPlan
        labels={labels.plan}
        intl={labels.intl}
        countText={planCount}
        onCount={setPlanCount}
        count={count}
        interval={planInterval}
        onInterval={setPlanInterval}
        custom={planCustom}
        onCustom={setPlanCustom}
        firstDate={planFirst}
        onFirstDate={setPlanFirst}
        intervalDays={intervalDays}
      />
      {rows.map((index, position) => {
        const prefix = `p${index}.`;
        const first = index === 0;
        const productLabel = labels.productN.replace(
          "{n}",
          String(position + 1),
        );
        const moq = moqOf(product[index]);
        const rowUnit = unit[index] ?? "un";
        const moqApplies = !!moq && isPieceUnit(rowUnit);
        return (
          <fieldset
            key={index}
            data-request-item={index}
            className="min-w-0 max-w-full rounded-xl border border-zinc-200 bg-zinc-50/40 p-3"
          >
            <legend className="flex w-full items-center justify-between gap-2 px-1">
              <span className="text-sm font-semibold text-zinc-800">
                {productLabel}
              </span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`${labels.remove}: ${productLabel}`}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  {labels.remove}
                </button>
              ) : null}
            </legend>
            {/* Grade de 4 colunas (2 no celular): textos em meia linha ou linha
                cheia; o bloco "Programação de compra" na linha toda. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <RequestProductFields
                {...fields}
                labels={labels}
                prefix={prefix}
                presetProductId={first ? presetProductId : ""}
                presetVariantId={first ? presetVariantId : ""}
                defaultNotInCatalog={first ? defaultNotInCatalog : false}
                suggestions={first ? suggestions : {}}
                onProductChange={(id, variantId, fill) =>
                  onProductChange(index, id, variantId, fill)
                }
                onCatalogModeChange={(on) =>
                  setOutside((o) => ({ ...o, [index]: on }))
                }
              />
              {/* Quantidade e unidade saíram da tela (dono, 14/11/2026): a
                  quantidade se digita no bloco "Programação de compra"
                  (pedido único) ou é a soma das programações; os dois
                  continuam no formulário e no envio. */}
              <input
                type="hidden"
                name={`${prefix}quantity`}
                value={qty[index] ?? ""}
              />
              <input
                type="hidden"
                name={`${prefix}unit`}
                value={unit[index] ?? "un"}
              />
              {/* Programação de entregas pela quantidade (dono, 14/11/2026): o
                  mesmo card da Seleção de itens, ligado ao produto escolhido
                  acima e à quantidade desta linha; as entregas geradas vão
                  com as datas e o intervalo de sempre. */}
              {(() => {
                const item = cartonOf(index);
                return (
                  <SelectionQuantity
                    label={labels.pieces}
                    hint={labels.piecesHint}
                    scheduledHint={labels.piecesScheduledHint}
                    defaultQuantity={null}
                    schedule={null}
                    labels={labels.schedule}
                    gen={
                      item?.id === "outside"
                        ? {
                            ...labels.generate,
                            noPieces: labels.generateOutside,
                          }
                        : labels.generate
                    }
                    items={item ? [item] : []}
                    chosenItemId={null}
                    controlledItemId={item?.id ?? null}
                    containerTypes={containerTypes}
                    prefix={prefix}
                    quantityValue={qty[index] ?? ""}
                    onQuantityChange={(total) =>
                      setQty((q) => ({ ...q, [index]: total }))
                    }
                    unit={rowUnit}
                    quantityRequired
                    moq={(() => {
                      if (!moqApplies) return null;
                      // Com as peças travadas (vêm das caixas), o mínimo
                      // também em caixas: "2.000 un (42 caixas)".
                      const per = perCartonOf(product[index], rowUnit);
                      const boxes = per ? Math.ceil(moq! / per - 1e-9) : 0;
                      return {
                        min: moq!,
                        hint:
                          per && labels.moqCartons
                            ? fill(labels.moqCartons, moq!, rowUnit, boxes)
                            : fill(labels.moq, moq!, rowUnit),
                        below:
                          per && labels.belowMoqCartons
                            ? fill(labels.belowMoqCartons, moq!, rowUnit, boxes)
                            : fill(labels.belowMoq, moq!, rowUnit),
                      };
                    })()}
                    onQuantityBlur={() => floorToMoq(index)}
                    fixedPlan={plan}
                    className="col-span-2 sm:col-span-4"
                  />
                );
              })()}
              {labels.forecast ? (
                <PriceForecast
                  key={product[index]?.id ?? ""}
                  productId={outside[index] ? "" : (product[index]?.id ?? "")}
                  quantity={qty[index] ?? ""}
                  labels={labels.forecast}
                  className="col-span-2 sm:col-span-4"
                />
              ) : null}
            </div>
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={add}
        data-add-request-item
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        <span aria-hidden>+</span>
        {labels.add}
      </button>
    </div>
  );
}

/** Textos do bloco "Programação de compra do pedido". */
export interface OrderPlanLabels {
  title: string;
  hint: string;
  count: string;
  countHint: string;
  single: string;
  interval: string;
  days: string;
  custom: string;
  firstDate: string;
  /** "Programação {n}". */
  n: string;
  dates: string;
}

const fillText = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

/**
 * Programação de compra do pedido (dono, 15/11/2026): as datas não são do
 * produto. O número de programações, a 1ª data e o intervalo valem para
 * todos os produtos; o bloco de cada produto só reparte a quantidade dele
 * nessas datas. 1 programação = pedido único.
 */
function OrderPlan({
  labels,
  intl,
  countText,
  onCount,
  count,
  interval,
  onInterval,
  custom,
  onCustom,
  firstDate,
  onFirstDate,
  intervalDays,
}: {
  labels: OrderPlanLabels;
  intl: string;
  countText: string;
  onCount: (v: string) => void;
  count: number;
  interval: number;
  onInterval: (v: number) => void;
  custom: string;
  onCustom: (v: string) => void;
  firstDate: string;
  onFirstDate: (v: string) => void;
  intervalDays: number;
}) {
  const fmtDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(intl, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  };
  return (
    <section
      className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3"
      aria-label={labels.title}
      data-order-plan={count >= 2 ? count : "single"}
    >
      <div>
        <p className="text-sm font-semibold text-zinc-900">{labels.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
          {labels.hint}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">
            {labels.count}
          </span>
          <input
            type="number"
            min="1"
            max={MAX_SCHEDULE_ROUNDS}
            step="1"
            inputMode="numeric"
            value={countText}
            onChange={(e) => onCount(e.target.value)}
            onBlur={() => onCount(String(count))}
            data-order-plan-count
            className={cx(inputClass, "w-24 tabular-nums")}
          />
        </label>
        {count >= 2 ? (
          <>
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
                    onClick={() => onInterval(d)}
                    data-order-plan-interval={d}
                    className={cx(
                      "rounded-md border px-2.5 py-1 text-xs font-semibold",
                      interval === d
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-brand-50",
                    )}
                  >
                    {fillText(labels.days, { n: d })}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder={labels.custom}
                  value={interval === 0 ? custom : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onCustom(v);
                    if (v.trim() !== "" || interval === 0) onInterval(0);
                  }}
                  aria-label={labels.custom}
                  data-order-plan-custom
                  className={cx(inputClass, "w-20 py-1 text-xs")}
                />
              </div>
            </div>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-zinc-700">
                {labels.firstDate}
              </span>
              <input
                type="date"
                value={firstDate}
                required
                onChange={(e) => onFirstDate(e.target.value)}
                data-order-plan-first
                className={cx(inputClass, "w-40")}
              />
            </label>
          </>
        ) : null}
      </div>
      {count >= 2 ? (
        <div>
          <p className="text-xs font-medium text-zinc-700">{labels.dates}</p>
          <ol className="mt-1 flex flex-wrap gap-1.5" data-order-plan-dates>
            {Array.from({ length: count }, (_, i) => (
              <li
                key={i}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                data-order-plan-date={i + 1}
              >
                <span className="font-semibold">
                  {fillText(labels.n, { n: i + 1 })}
                </span>
                {": "}
                {firstDate && intervalDays > 0
                  ? fmtDate(addDaysIso(firstDate, intervalDays * i))
                  : "—"}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-xs text-zinc-600" data-order-plan-single>
          {labels.single}
        </p>
      )}
      <p className="text-xs text-zinc-500">{labels.countHint}</p>
    </section>
  );
}
