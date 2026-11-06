import "server-only";

import { getStore } from "@/lib/db";
import type {
  Container,
  ContainerItem,
  Order,
  OrderItem,
  Product,
  StockMovement,
} from "@/lib/db";
import { boxesFor } from "@/lib/logistics/cbm";
import { STOCK_PARTY_ID } from "./purchase-flow";
import { isSchemaMissing } from "./packaging-brief";

/*
 * Estoque da Wellmix (tela Estoque), por produto, a partir do que já existe:
 * - itens de container sem pedido (mercadoria livre) e itens de pedidos de
 *   compra para estoque: no Brasil quando o container chegou, em trânsito
 *   enquanto planejado, carregando ou no mar;
 * - itens de compras para estoque ainda fora de container: em produção (ou
 *   no Brasil, se o pedido já foi entregue).
 * Pedido cancelado não conta. Nada é inventado: sem esses registros, o
 * produto não aparece.
 */

export const INVENTORY_SITUATIONS = [
  "all",
  "brazil",
  "transit",
  "production",
  "below",
] as const;
export type InventorySituation = (typeof INVENTORY_SITUATIONS)[number];

export interface InventoryRow {
  productId: string;
  brazil: number;
  transit: number;
  production: number;
  total: number;
  boxes: number;
  unit: string;
  /** Última movimentação (item de container ou pedido de estoque). */
  lastAt: string | null;
  /** Containers e pedidos de estoque de onde vem a quantidade. */
  containerIds: string[];
  orderIds: string[];
}

const TRANSIT: readonly string[] = ["planning", "loading", "shipped"];
const ORDER_IN_BRAZIL: readonly string[] = ["DELIVERED", "CLOSED"];

/** Monta as linhas do estoque (função pura; o carregador busca os dados). */
export function buildInventory(input: {
  containers: Pick<Container, "id" | "status">[];
  containerItems: Pick<
    ContainerItem,
    | "containerId"
    | "orderId"
    | "orderItemId"
    | "productId"
    | "quantity"
    | "unit"
    | "boxCount"
    | "updatedAt"
  >[];
  stockOrders: Pick<Order, "id" | "status" | "updatedAt">[];
  stockOrderItems: Pick<
    OrderItem,
    "id" | "orderId" | "productId" | "quantity" | "unit"
  >[];
  products: Pick<Product, "id" | "masterBoxQty">[];
  /** Baixas por venda e ajustes do inventário: mexem no que está no Brasil. */
  movements?: Pick<
    StockMovement,
    "productId" | "quantity" | "unit" | "updatedAt"
  >[];
}): InventoryRow[] {
  const status = new Map(input.containers.map((c) => [c.id, c.status]));
  const stockOrder = new Map(input.stockOrders.map((o) => [o.id, o]));
  const product = new Map(input.products.map((p) => [p.id, p]));
  const rows = new Map<string, InventoryRow>();
  const row = (productId: string, unit: string) => {
    let r = rows.get(productId);
    if (!r) {
      r = {
        productId,
        brazil: 0,
        transit: 0,
        production: 0,
        total: 0,
        boxes: 0,
        unit,
        lastAt: null,
        containerIds: [],
        orderIds: [],
      };
      rows.set(productId, r);
    }
    return r;
  };
  const touch = (r: InventoryRow, at: string | null | undefined) => {
    if (at && (!r.lastAt || at > r.lastAt)) r.lastAt = at;
  };
  // Quanto de cada item de pedido de estoque já foi para um container.
  const containerized = new Map<string, number>();
  for (const it of input.containerItems) {
    if (!it.productId || !(it.quantity > 0)) continue;
    const st = status.get(it.containerId);
    if (!st) continue;
    const fromStockOrder = !!it.orderId && stockOrder.has(it.orderId);
    if (it.orderId && !fromStockOrder) continue; // mercadoria vendida
    if (fromStockOrder && it.orderItemId)
      containerized.set(
        it.orderItemId,
        (containerized.get(it.orderItemId) ?? 0) + it.quantity,
      );
    // Mercadoria livre segue a vitrine: container fechado sai da conta.
    if (st === "closed" && !fromStockOrder) continue;
    const r = row(it.productId, it.unit);
    if (TRANSIT.includes(st)) r.transit += it.quantity;
    else r.brazil += it.quantity;
    r.boxes += it.boxCount;
    touch(r, it.updatedAt);
    if (!r.containerIds.includes(it.containerId))
      r.containerIds.push(it.containerId);
    if (it.orderId && !r.orderIds.includes(it.orderId))
      r.orderIds.push(it.orderId);
  }
  for (const oi of input.stockOrderItems) {
    const order = stockOrder.get(oi.orderId);
    if (!order || !oi.productId) continue;
    const rest = oi.quantity - (containerized.get(oi.id) ?? 0);
    if (!(rest > 0)) continue;
    const r = row(oi.productId, oi.unit);
    if (ORDER_IN_BRAZIL.includes(order.status)) r.brazil += rest;
    else r.production += rest;
    r.boxes += boxesFor(rest, product.get(oi.productId)?.masterBoxQty ?? null);
    touch(r, order.updatedAt);
    if (!r.orderIds.includes(order.id)) r.orderIds.push(order.id);
  }
  for (const m of input.movements ?? []) {
    if (!m.productId || !m.quantity) continue;
    const r = row(m.productId, m.unit ?? "un");
    r.brazil = Math.max(0, r.brazil + m.quantity);
    touch(r, m.updatedAt);
  }
  for (const r of rows.values()) r.total = r.brazil + r.transit + r.production;
  return [...rows.values()].filter((r) => r.total > 0);
}

export type LimitStatus = "ok" | "incoming" | "reorder";

/**
 * Situação diante do limite (estoque mínimo): acima dele; abaixo no Brasil
 * mas coberto pelo que vem a caminho; ou repor (nem com o que vem chega).
 * Sem limite definido, nulo.
 */
export function limitStatus(
  r: Pick<InventoryRow, "brazil" | "total">,
  minStock: number | null | undefined,
): LimitStatus | null {
  if (!minStock || !(minStock > 0)) return null;
  if (r.brazil >= minStock) return "ok";
  return r.total >= minStock ? "incoming" : "reorder";
}

/** A linha está na situação do filtro? ("below": abaixo do limite no Brasil.) */
export function inInventorySituation(
  r: Pick<InventoryRow, "brazil" | "transit" | "production" | "total">,
  s: InventorySituation,
  minStock?: number | null,
): boolean {
  if (s === "all") return true;
  if (s === "below") {
    const st = limitStatus(r, minStock);
    return st === "incoming" || st === "reorder";
  }
  return r[s] > 0;
}

/** Carrega containers, itens e compras para estoque e monta as linhas. */
export async function loadInventory(): Promise<InventoryRow[]> {
  const store = getStore();
  const [containers, orders, movements] = await Promise.all([
    store.list("containers"),
    store.list("orders", { filter: { customerId: STOCK_PARTY_ID } }),
    listStockMovements(),
  ]);
  const stockOrders = orders.filter((o) => o.status !== "CANCELLED");
  const [containerItems, stockOrderItems] = await Promise.all([
    containers.length
      ? store.list("container_items", {
          filter: { containerId: containers.map((c) => c.id) },
        })
      : Promise.resolve([]),
    stockOrders.length
      ? store.list("order_items", {
          filter: { orderId: stockOrders.map((o) => o.id) },
        })
      : Promise.resolve([]),
  ]);
  const productIds = [
    ...new Set(
      [...containerItems, ...stockOrderItems, ...movements]
        .map((i) => i.productId)
        .filter(Boolean) as string[],
    ),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  return buildInventory({
    containers,
    containerItems,
    stockOrders,
    stockOrderItems,
    products,
    movements,
  });
}

/** Movimentações de estoque; banco sem a tabela (esquema não publicado) = nenhuma. */
export async function listStockMovements(): Promise<StockMovement[]> {
  try {
    return await getStore().list("stock_movements");
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}
