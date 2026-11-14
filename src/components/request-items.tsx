"use client";

import { useState } from "react";
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
  };
}) {
  const [rows, setRows] = useState<number[]>([0]);
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
  // Quantidade e unidade por linha (a programação de entregas soma na quantidade).
  // Produto com pedido mínimo já começa nele (nunca abaixo).
  const [qty, setQty] = useState<Record<number, string>>(() => {
    const moq = moqOf({
      id: presetProductId,
      variantId: presetVariantId,
      fill: fields.products.find((x) => x.id === presetProductId) ?? null,
    });
    const preset = Number(presetQuantity.replace(",", ".")) || 0;
    return { 0: moq && preset < moq ? String(moq) : presetQuantity };
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
                    moq={
                      moqApplies
                        ? {
                            min: moq!,
                            hint: fill(labels.moq, moq!, rowUnit),
                            below: fill(labels.belowMoq, moq!, rowUnit),
                          }
                        : null
                    }
                    onQuantityBlur={() => floorToMoq(index)}
                    className="col-span-2 sm:col-span-4"
                  />
                );
              })()}
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
