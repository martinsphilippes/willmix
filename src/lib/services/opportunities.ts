import "server-only";

import { getStore, type PriceTier, type Product, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { boxCbm, boxesFor } from "@/lib/logistics/cbm";
import { listContainers } from "./containers";

/**
 * Análise de oportunidade com dados reais e fórmula reproduzível.
 * Regra 1 (faixa de preço): com faixas negociadas [{minQty, price}], mostra o
 * que custaria comprar até a próxima faixa. Regra 2 (container): espaço livre
 * num container do cliente cabe N caixas de um produto sem novo frete.
 * A IA pode explicar; nunca inventa o número.
 */
export function sortTiers(tiers: PriceTier[] | null | undefined): PriceTier[] {
  return [...(tiers ?? [])]
    .filter((t) => t.minQty > 0 && t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

export function tierFor(
  tiers: PriceTier[],
  quantity: number,
): PriceTier | null {
  let current: PriceTier | null = null;
  for (const t of tiers) if (quantity >= t.minQty) current = t;
  return current;
}

export interface TierOpportunity {
  quantity: number;
  currentUnitPrice: number;
  currentTotal: number;
  nextTier: PriceTier;
  extraQuantity: number;
  nextTotal: number;
  /** Diferença entre o total atual e o total na próxima faixa (positivo = comprar mais custa mais). */
  totalDifference: number;
  unitSaving: number;
  unitSavingPercent: number;
  /** Custo marginal por unidade extra: (nextTotal − currentTotal) / extraQuantity. */
  marginalUnitCost: number;
  formula: string;
}

/** Oportunidade de faixa: quantidade atual × preço atual vs. próxima faixa × preço da faixa. */
export function tierOpportunity(
  tiers: PriceTier[] | null | undefined,
  quantity: number,
  fallbackUnitPrice: number | null = null,
): TierOpportunity | null {
  const sorted = sortTiers(tiers);
  if (sorted.length === 0 || quantity <= 0) return null;
  const current = tierFor(sorted, quantity);
  const currentUnitPrice = current?.price ?? fallbackUnitPrice;
  if (currentUnitPrice === null) return null;
  const next = sorted.find(
    (t) => t.minQty > quantity && t.price < currentUnitPrice,
  );
  if (!next) return null;
  const currentTotal = round2(quantity * currentUnitPrice);
  const nextTotal = round2(next.minQty * next.price);
  const extraQuantity = next.minQty - quantity;
  return {
    quantity,
    currentUnitPrice,
    currentTotal,
    nextTier: next,
    extraQuantity,
    nextTotal,
    totalDifference: round2(nextTotal - currentTotal),
    unitSaving: round2(currentUnitPrice - next.price),
    unitSavingPercent: round1(
      ((currentUnitPrice - next.price) / currentUnitPrice) * 100,
    ),
    marginalUnitCost: round2((nextTotal - currentTotal) / extraQuantity),
    formula: `${quantity} × ${currentUnitPrice} = ${currentTotal}; ${next.minQty} × ${next.price} = ${nextTotal}; (${nextTotal} − ${currentTotal}) ÷ ${extraQuantity} = custo marginal por unidade`,
  };
}

export interface ContainerFillOpportunity {
  containerId: string;
  containerCode: string;
  customerId: string | null;
  customer: string | null;
  remainingCbm: number;
  suggestions: Array<{
    productId: string;
    product: string;
    cbmPerBox: number;
    unitsPerBox: number | null;
    boxes: number;
    units: number | null;
  }>;
}

/** Containers abertos com espaço: quantas caixas de cada produto do cliente ainda cabem. */
export async function containerFillOpportunities(
  user: User,
): Promise<ContainerFillOpportunity[]> {
  const store = getStore();
  const containers = (
    await listContainers({ status: ["planning", "loading"] })
  ).filter(
    (c) =>
      isWellmix(user) ||
      (user.role === "customer" && c.container.customerId === user.partyId),
  );
  if (containers.length === 0) return [];
  const [products, items, orders] = await Promise.all([
    store.list("products", { filter: { active: true } }),
    store.list("order_items"),
    store.list("orders"),
  ]);
  const out: ContainerFillOpportunity[] = [];
  for (const c of containers) {
    const remaining = c.usage.remainingCbm;
    if (remaining <= 0) continue;
    // Produtos já comprados pelo cliente do container (histórico real), senão todos com CBM.
    const customerProductIds = new Set(
      orders
        .filter((o) => o.customerId === c.container.customerId)
        .flatMap((o) =>
          items.filter((i) => i.orderId === o.id).map((i) => i.productId),
        )
        .filter((x): x is string => !!x),
    );
    const candidates = (
      c.container.customerId
        ? products.filter((p) => customerProductIds.has(p.id))
        : products
    )
      .map((p) => ({ product: p, cbmPerBox: boxCbm(p) }))
      .filter(
        (x): x is { product: Product; cbmPerBox: number } =>
          !!x.cbmPerBox && x.cbmPerBox > 0,
      );
    const suggestions = candidates
      .map(({ product, cbmPerBox }) => {
        const boxes = Math.floor(remaining / cbmPerBox);
        return {
          productId: product.id,
          product: product.name,
          cbmPerBox,
          unitsPerBox: product.masterBoxQty,
          boxes,
          units: product.masterBoxQty ? boxes * product.masterBoxQty : null,
        };
      })
      .filter((s) => s.boxes > 0)
      .sort((a, b) => b.boxes - a.boxes)
      .slice(0, 5);
    if (suggestions.length)
      out.push({
        containerId: c.container.id,
        containerCode: c.container.code,
        customerId: c.container.customerId,
        customer: c.customerName,
        remainingCbm: remaining,
        suggestions,
      });
  }
  return out;
}

/** Caixas necessárias para uma quantidade, para exibir junto da oportunidade de faixa. */
export function boxesForQuantity(
  product: Pick<Product, "masterBoxQty">,
  quantity: number,
) {
  return boxesFor(quantity, product.masterBoxQty);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
