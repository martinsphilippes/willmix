"use client";

import { useState } from "react";
import { cx, inputClass } from "@/components/ui";
import { isPieceUnit } from "@/lib/moq";
import { RequestProductFields } from "@/components/request-product-fields";
import {
  RequestScheduleFields,
  type ScheduleLabels,
} from "@/components/request-schedule";

type ProductFieldsProps = Omit<
  React.ComponentProps<typeof RequestProductFields>,
  "prefix" | "presetProductId" | "defaultNotInCatalog" | "suggestions"
>;

/**
 * Produtos da nova solicitação: uma linha por produto, com "+ Adicionar outro
 * produto". Cada linha vira uma solicitação própria (mesmo lote). Os campos de
 * cada linha levam o prefixo `p<n>.`; o que veio da busca por foto/link e da
 * programação de compra só preenche a primeira linha.
 */
export function RequestItems({
  presetProductId,
  presetQuantity,
  defaultNotInCatalog,
  suggestions,
  labels,
  ...fields
}: ProductFieldsProps & {
  presetProductId: string;
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
    /** Idioma dos números (ex.: "pt-BR"). */
    intl: string;
    schedule: ScheduleLabels;
  };
}) {
  const [rows, setRows] = useState<number[]>([0]);
  const [next, setNext] = useState(1);
  // Produto escolhido por linha: o pedido mínimo dele vale para a quantidade.
  const [product, setProduct] = useState<Record<number, string>>({
    0: presetProductId,
  });
  const moqOf = (id: string | undefined) =>
    (id && fields.products.find((p) => p.id === id)?.moq) || null;
  // Quantidade e unidade por linha (a programação de entregas soma na quantidade).
  // Produto com pedido mínimo já começa nele (nunca abaixo).
  const [qty, setQty] = useState<Record<number, string>>(() => {
    const moq = moqOf(presetProductId);
    const preset = Number(presetQuantity.replace(",", ".")) || 0;
    return { 0: moq && preset < moq ? String(moq) : presetQuantity };
  });
  const [unit, setUnit] = useState<Record<number, string>>({ 0: "un" });

  /** Produto da linha mudou: quantidade vazia ou abaixo do mínimo sobe para ele. */
  function onProductChange(index: number, id: string) {
    setProduct((p) => ({ ...p, [index]: id }));
    const moq = moqOf(id);
    if (!moq) return;
    setQty((q) => {
      const current = Number((q[index] ?? "").replace(",", ".")) || 0;
      return current < moq && isPieceUnit(unit[index])
        ? { ...q, [index]: String(moq) }
        : q;
    });
  }
  /** Saiu do campo abaixo do mínimo: volta ao mínimo (a regra da vitrine). */
  function floorToMoq(index: number) {
    const moq = moqOf(product[index]);
    if (!moq || !isPieceUnit(unit[index])) return;
    setQty((q) => {
      const current = Number((q[index] ?? "").replace(",", ".")) || 0;
      return current < moq ? { ...q, [index]: String(moq) } : q;
    });
  }
  const fill = (text: string, n: number, u: string) =>
    text.replace("{n}", n.toLocaleString(labels.intl)).replace("{unit}", u);

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
        const current = Number((qty[index] ?? "").replace(",", ".")) || 0;
        const below = moqApplies && (qty[index] ?? "") !== "" && current < moq!;
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
                cheia; quantidade e unidade estreitas, ao lado da programação. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <RequestProductFields
                {...fields}
                labels={labels}
                prefix={prefix}
                presetProductId={first ? presetProductId : ""}
                defaultNotInCatalog={first ? defaultNotInCatalog : false}
                suggestions={first ? suggestions : {}}
                onProductChange={(id) => onProductChange(index, id)}
              />
              <label className="block min-w-0 space-y-1">
                <span className="block text-xs font-medium leading-5 text-zinc-700">
                  {labels.quantity}
                </span>
                <input
                  name={`${prefix}quantity`}
                  type="number"
                  // Produto com pedido mínimo: o campo não aceita menos (nem o navegador deixa enviar).
                  min={moqApplies ? moq! : "0.01"}
                  step="any"
                  required
                  value={qty[index] ?? ""}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [index]: e.target.value }))
                  }
                  onBlur={() => floorToMoq(index)}
                  aria-describedby={moq ? `moq-${index}` : undefined}
                  data-request-moq={moq ?? undefined}
                  className={cx(inputClass, below && "border-red-400")}
                />
                {moq ? (
                  <span
                    id={`moq-${index}`}
                    data-request-moq-hint={below ? "below" : "ok"}
                    className={cx(
                      "block text-xs leading-snug",
                      below ? "font-medium text-red-700" : "text-zinc-500",
                    )}
                  >
                    {fill(below ? labels.belowMoq : labels.moq, moq, rowUnit)}
                  </span>
                ) : null}
              </label>
              <label className="block min-w-0 space-y-1">
                <span className="block text-xs font-medium leading-5 text-zinc-700">
                  {labels.unit}
                </span>
                <input
                  name={`${prefix}unit`}
                  value={unit[index] ?? "un"}
                  onChange={(e) =>
                    setUnit((u) => ({ ...u, [index]: e.target.value }))
                  }
                  required
                  className={inputClass}
                />
              </label>
              {/* Programação de entregas: divide a quantidade em entregas com intervalo e datas previstas. */}
              <RequestScheduleFields
                prefix={prefix}
                total={qty[index] ?? ""}
                unit={unit[index] ?? "un"}
                onTotalChange={(total) =>
                  setQty((q) => ({ ...q, [index]: total }))
                }
                labels={labels.schedule}
              />
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
