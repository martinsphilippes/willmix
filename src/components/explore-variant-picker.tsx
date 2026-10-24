"use client";

import { useState } from "react";
import { QuantityStepper } from "./quantity-stepper";
import { cx } from "./ui";

/** Variação como chega do servidor: só o que o cliente pode ver, já formatado. */
export interface VariantOption {
  id: string;
  name: string;
  moq: number | null;
  /** Preço estimado por unidade já formatado ("R$ 12,34"); nulo = sob consulta. */
  priceText: string | null;
  photoDocumentId: string | null;
  /** Linhas da especificação ("Tamanho: 8X10"). */
  specification: string[];
}

/**
 * Seletor de variação da página do produto (produto com variações) com o
 * controle de quantidade logo abaixo. A variação é obrigatória (rádio
 * `variantId`, exigido pelo navegador e conferido no servidor). O piso da
 * quantidade acompanha a variação escolhida: trocar de variação troca o
 * mínimo e, se a quantidade estava abaixo dele, sobe até ele (o controle é
 * remontado com o novo piso; o valor acima dele fica). Sem variação
 * escolhida, vale o mínimo do produto (o da variação de referência).
 */
export function ExploreVariantPicker({
  variants,
  productMoq,
  startQty,
  intl,
  quantityId = "explore-quantity",
  labels,
}: {
  variants: VariantOption[];
  productMoq: number | null;
  startQty: number;
  /** Idioma dos números (ex.: "pt-BR"). */
  intl: string;
  quantityId?: string;
  labels: {
    /** "Escolha a variação". */
    choose: string;
    /** "Pedido mínimo: {n} un". */
    moq: string;
    /** "/un". */
    perUnit: string;
    estimated: string;
    onRequest: string;
    noPhoto: string;
    quantity: string;
    decrease: string;
    increase: string;
    /** "Pedido mínimo: {n} un. Ao sair do campo, volta ao mínimo." */
    belowMoq: string;
  };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(startQty);
  const current = variants.find((v) => v.id === selected) ?? null;
  const moq = current ? current.moq : productMoq;
  const floor = moq && moq > 0 ? moq : 1;
  const fmt = (n: number) => n.toLocaleString(intl);
  return (
    <>
      <fieldset data-explore-variants={variants.length}>
        <legend className="mb-1.5 block text-xs font-medium text-zinc-700">
          {labels.choose}
        </legend>
        <ul className="grid gap-2">
          {variants.map((v) => {
            const active = selected === v.id;
            return (
              <li key={v.id}>
                <label
                  className={cx(
                    "flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-2 transition",
                    active
                      ? "border-brand-600 ring-2 ring-brand-100"
                      : "border-zinc-200 hover:border-zinc-300",
                  )}
                >
                  <input
                    type="radio"
                    name="variantId"
                    value={v.id}
                    required
                    checked={active}
                    onChange={() => setSelected(v.id)}
                    className="h-4 w-4 shrink-0 accent-brand-600"
                    data-explore-variant={v.id}
                  />
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
                    {v.photoDocumentId ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */
                      <img
                        src={`/api/files/${v.photoDocumentId}`}
                        alt=""
                        className="h-full w-full object-contain p-0.5"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-400"
                        aria-label={labels.noPhoto}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className="h-6 w-6 text-zinc-300"
                        >
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <circle cx="9" cy="10" r="2" />
                          <path d="m21 16-5-5-8 9" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold leading-tight text-zinc-900">
                      {v.name}
                    </span>
                    {v.specification.length ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
                        {v.specification.join(" · ")}
                      </span>
                    ) : null}
                    {v.moq ? (
                      <span className="mt-0.5 block text-xs text-zinc-600">
                        {labels.moq.replace("{n}", fmt(v.moq))}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    {v.priceText ? (
                      <>
                        <span
                          className="block text-sm font-semibold tabular-nums text-zinc-900"
                          data-explore-variant-price={v.id}
                        >
                          {v.priceText}
                          <span className="font-normal text-zinc-500">
                            {labels.perUnit}
                          </span>
                        </span>
                        <span className="block text-[11px] text-emerald-800">
                          {labels.estimated}
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs font-semibold text-zinc-700">
                        {labels.onRequest}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {/* Remontado a cada troca de variação: o piso novo entra no controle. */}
      <QuantityStepper
        key={selected ?? ""}
        id={quantityId}
        defaultValue={Math.max(quantity, floor)}
        moq={moq}
        label={labels.quantity}
        decreaseLabel={labels.decrease}
        increaseLabel={labels.increase}
        belowMoqText={labels.belowMoq.replace("{n}", fmt(floor))}
        onValueChange={setQuantity}
      />
    </>
  );
}
