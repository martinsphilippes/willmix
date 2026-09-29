import "server-only";

import { getStore, type User } from "@/lib/db";
import { canSeeInternalCosts, isWellmix } from "@/lib/auth/permissions";

/**
 * Histórico comercial: Cliente → Produto → Compra → Quantidade → Custo → Data →
 * Frequência → Reposição. Só dados lançados (pedidos, itens, solicitações);
 * a frequência é a média de dias entre compras do mesmo produto.
 */
export interface HistoryRow {
  customerId: string;
  customer: string;
  productId: string | null;
  product: string;
  purchases: number;
  totalQuantity: number;
  unit: string;
  lastQuantity: number;
  /** Preço unitário de venda da última compra (moeda de venda). */
  lastSellUnit: number | null;
  sellCurrency: string;
  /** Custo unitário FOB da última compra; só para a Wellmix. */
  lastFobUnit: number | null;
  fobCurrency: string | null;
  firstAt: string;
  lastAt: string;
  lastOrderId: string;
  lastOrderNumber: number;
  /** Média de dias entre compras (null com uma compra só). */
  avgIntervalDays: number | null;
  /** Solicitações de recompra/nova proposta derivadas de pedidos deste produto. */
  replenishments: number;
  /** Interesse em recompra declarado no último pós-venda. */
  repurchaseInterest: string | null;
}

export async function loadCommercialHistory(
  user: User,
  filter: { customerId?: string } = {},
): Promise<HistoryRow[]> {
  const store = getStore();
  const customerId =
    user.role === "customer" ? (user.partyId ?? "") : filter.customerId;
  if (!isWellmix(user) && user.role !== "customer") return [];
  const [orders, items, parties, requests, afterSales] = await Promise.all([
    store.list("orders", customerId ? { filter: { customerId } } : {}),
    store.list("order_items"),
    store.list("parties"),
    store.list("requests"),
    store.list("after_sales"),
  ]);
  const nameOf = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
  const groups = new Map<string, HistoryRow & { dates: number[] }>();
  const sorted = [...orders].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  for (const order of sorted) {
    const item = items.find((i) => i.orderId === order.id);
    if (!item) continue;
    const key = `${order.customerId}|${item.productId ?? item.name.toLowerCase()}`;
    const sellUnit =
      order.sellPrice !== null && item.quantity > 0
        ? order.sellPrice / item.quantity
        : null;
    const fobUnit =
      order.fobTotal !== null && item.quantity > 0
        ? order.fobTotal / item.quantity
        : item.unitPrice;
    const replenishments = requests.filter(
      (r) =>
        r.sourceOrderId === order.id &&
        (r.origin === "replenishment" || r.origin === "proposal"),
    ).length;
    const after = afterSales.find((a) => a.orderId === order.id);
    const row = groups.get(key);
    if (!row) {
      groups.set(key, {
        customerId: order.customerId,
        customer: nameOf(order.customerId),
        productId: item.productId,
        product: item.name,
        purchases: 1,
        totalQuantity: item.quantity,
        unit: item.unit,
        lastQuantity: item.quantity,
        lastSellUnit: sellUnit,
        sellCurrency: order.sellCurrency ?? "BRL",
        lastFobUnit: canSeeInternalCosts(user) ? fobUnit : null,
        fobCurrency: canSeeInternalCosts(user) ? order.fobCurrency : null,
        firstAt: order.createdAt,
        lastAt: order.createdAt,
        lastOrderId: order.id,
        lastOrderNumber: order.number,
        avgIntervalDays: null,
        replenishments,
        repurchaseInterest: after?.repurchaseInterest ?? null,
        dates: [Date.parse(order.createdAt)],
      });
    } else {
      row.purchases++;
      row.totalQuantity += item.quantity;
      row.lastQuantity = item.quantity;
      row.lastSellUnit = sellUnit;
      row.lastFobUnit = canSeeInternalCosts(user) ? fobUnit : null;
      row.lastAt = order.createdAt;
      row.lastOrderId = order.id;
      row.lastOrderNumber = order.number;
      row.replenishments += replenishments;
      if (after?.repurchaseInterest)
        row.repurchaseInterest = after.repurchaseInterest;
      row.dates.push(Date.parse(order.createdAt));
    }
  }
  return [...groups.values()]
    .map(({ dates, ...row }) => {
      const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / 86400000);
      return {
        ...row,
        avgIntervalDays: gaps.length
          ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
          : null,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
