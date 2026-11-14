import "server-only";
import { realName } from "@/lib/placeholder-name";
import { indexBy, listByIds, listColumns } from "@/lib/db/lookup";

import { getStore, type User } from "@/lib/db";
import {
  ORDER_ACCESS_FIELDS,
  canSeeInternalCosts,
  canViewOrder,
  isWellmix,
} from "@/lib/auth/permissions";

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
  if (!isWellmix(user) && user.role !== "customer") return [];
  // Cliente sem parceiro vinculado não tem histórico (nunca cai no "todos os clientes").
  if (user.role === "customer" && !user.partyId) return [];
  const customerId =
    user.role === "customer" ? (user.partyId ?? undefined) : filter.customerId;
  // Só as colunas usadas (auditoria de performance, 14/11/2026): antes, as
  // tabelas inteiras com a cópia do registro do ERP (sankhyaRefs, ~60% de
  // pedidos e itens; 16 mil pedidos e 184 mil itens em produção). Com um
  // cliente, só os itens dos pedidos dele.
  const ordersP = listColumns(
    store,
    "orders",
    [
      ...ORDER_ACCESS_FIELDS,
      "status",
      "number",
      "sellPrice",
      "fobTotal",
      "sellCurrency",
      "fobCurrency",
    ],
    customerId ? { filter: { customerId } } : {},
  );
  const itemColumns = [
    "orderId",
    "productId",
    "name",
    "quantity",
    "unit",
    "unitPrice",
  ] as const;
  const [orders, items, requests, afterSales] = await Promise.all([
    ordersP,
    customerId
      ? ordersP.then((list) =>
          list.length
            ? listColumns(store, "order_items", itemColumns, {
                filter: { orderId: list.map((o) => o.id) },
              })
            : [],
        )
      : listColumns(store, "order_items", itemColumns),
    // Só as que contam como reposição (as outras não entram na conta).
    listColumns(store, "requests", ["sourceOrderId", "origin"], {
      filter: { origin: ["replenishment", "proposal"] },
    }),
    listColumns(store, "after_sales", ["orderId", "repurchaseInterest"]),
  ]);
  // Só os clientes dos pedidos (antes: a tabela inteira, ~32 mil).
  const parties = indexBy(
    await listByIds(
      store,
      "parties",
      orders.map((o) => o.customerId),
    ),
    "id",
  );
  const itemByOrder = indexBy(items, "orderId");
  // Reposições por pedido de origem e o primeiro pós-venda de cada pedido
  // (antes, uma busca na lista inteira por pedido: 16 mil × 16 mil).
  const replenishmentsOf = new Map<string, number>();
  for (const r of requests)
    if (r.sourceOrderId)
      replenishmentsOf.set(
        r.sourceOrderId,
        (replenishmentsOf.get(r.sourceOrderId) ?? 0) + 1,
      );
  const afterByOrder = indexBy(afterSales, "orderId");
  const nameOf = (id: string) => parties.get(id)?.name ?? "—";
  const groups = new Map<string, HistoryRow & { dates: number[] }>();
  const sorted = [...orders].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  for (const order of sorted) {
    // Cliente: só os pedidos do próprio login.
    if (user.role === "customer" && !canViewOrder(user, order)) continue;
    // Pedido cancelado não é compra: não conta nem vira o "último pedido"
    // (Comprar de novo / Nova proposta).
    if (order.status === "CANCELLED") continue;
    const item = itemByOrder.get(order.id);
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
    const replenishments = replenishmentsOf.get(order.id) ?? 0;
    const after = afterByOrder.get(order.id);
    const row = groups.get(key);
    if (!row) {
      groups.set(key, {
        customerId: order.customerId,
        customer: nameOf(order.customerId),
        productId: item.productId,
        product: realName(item.name) ?? "—",
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
