"use client";

import { useRequestCustomer } from "./request-customer-context";

/** Textos do histórico → pedido (no idioma de quem vê). */
export interface HistoryPickLabels {
  /** "Acrescentar ao pedido" (dica do nome clicável). */
  add: string;
  /** "No pedido" (o check do produto que já entrou). */
  inOrder: string;
  /** "Só os produtos da família escolhida ({n} fora dela)." */
  filtered: string;
}

/**
 * Filtro da família no histórico de compras (dono, 15/11/2026;
 * docs/ORDER_TERMS.md seção 10): com a família escolhida nas condições do
 * pedido, só os produtos dela; sem família, todos.
 */
export function useHistoryFamilyFilter() {
  const family = useRequestCustomer()?.origin?.family ?? null;
  return {
    family,
    keep: (itemFamily: string | null | undefined) =>
      !family || itemFamily === family,
  };
}

/**
 * Nome do produto no histórico de compras do cliente: clicável quando é um
 * produto do catálogo (entra no pedido como mais uma linha) e marcado com o
 * check "No pedido" (riscado) quando já está nas linhas.
 */
export function HistoryProductName({
  name,
  productId,
  photoId,
  labels,
  className = "text-sm font-medium text-zinc-900",
}: {
  name: string;
  productId: string | null | undefined;
  /** Foto principal do produto (miniatura à esquerda do nome). */
  photoId?: string | null;
  labels?: HistoryPickLabels;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {/* Foto do produto (dono, 15/11/2026); sem foto, um quadro vazio. */}
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
        <img
          src={`/api/files/${photoId}`}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-md border border-zinc-200 bg-white object-cover"
          data-history-photo
        />
      ) : (
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-md border border-dashed border-zinc-200 bg-zinc-50"
        />
      )}
      <NameText
        name={name}
        productId={productId}
        labels={labels}
        className={className}
      />
    </div>
  );
}

function NameText({
  name,
  productId,
  labels,
  className,
}: {
  name: string;
  productId: string | null | undefined;
  labels?: HistoryPickLabels;
  className: string;
}) {
  const shared = useRequestCustomer();
  const inOrder = !!productId && !!shared?.chosenProductIds.includes(productId);
  const canAdd = !!productId && !!labels && !!shared?.requestAddProduct;
  if (!canAdd)
    return <p className={`min-w-0 break-words ${className}`}>{name}</p>;
  return (
    <p className={`min-w-0 break-words ${className}`}>
      <button
        type="button"
        onClick={() => shared!.requestAddProduct(productId!)}
        title={labels!.add}
        className={`text-left underline decoration-dotted underline-offset-2 hover:text-brand-700 ${inOrder ? "text-zinc-500 line-through" : ""}`}
        data-history-pick={productId}
        data-history-pick-state={inOrder ? "in-order" : "available"}
      >
        {name}
      </button>
      {inOrder ? (
        <span
          className="ml-1.5 inline-block whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 no-underline ring-1 ring-inset ring-emerald-200"
          data-history-in-order
        >
          ✓ {labels!.inOrder}
        </span>
      ) : null}
    </p>
  );
}
