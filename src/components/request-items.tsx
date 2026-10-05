"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";
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
    schedule: ScheduleLabels;
  };
}) {
  const [rows, setRows] = useState<number[]>([0]);
  const [next, setNext] = useState(1);
  // Quantidade e unidade por linha (a programação de entregas soma na quantidade).
  const [qty, setQty] = useState<Record<number, string>>({ 0: presetQuantity });
  const [unit, setUnit] = useState<Record<number, string>>({ 0: "un" });

  function add() {
    setRows((r) => [...r, next]);
    setNext((n) => n + 1);
  }
  function remove(index: number) {
    setRows((r) => (r.length > 1 ? r.filter((i) => i !== index) : r));
  }

  return (
    <div className="space-y-4">
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
        return (
          <fieldset
            key={index}
            data-request-item={index}
            className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/40 p-4"
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
            <RequestProductFields
              {...fields}
              labels={labels}
              prefix={prefix}
              presetProductId={first ? presetProductId : ""}
              defaultNotInCatalog={first ? defaultNotInCatalog : false}
              suggestions={first ? suggestions : {}}
            />
            <div className="grid grid-cols-2 gap-4">
              <label className="block min-w-0 space-y-1.5">
                <span className="block text-sm font-medium text-zinc-800">
                  {labels.quantity}
                </span>
                <input
                  name={`${prefix}quantity`}
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={qty[index] ?? ""}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [index]: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block min-w-0 space-y-1.5">
                <span className="block text-sm font-medium text-zinc-800">
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
            </div>
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
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={add}
        data-add-request-item
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        <span aria-hidden>+</span>
        {labels.add}
      </button>
    </div>
  );
}
