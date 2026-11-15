import "server-only";

import { getStore, type User } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";

/*
 * Ligações entre book, seleção, produto e pedido (fase 4b,
 * docs/MILESTONES.md): do pedido, do book, do produto ou da solicitação ao
 * fornecedor chega-se aos outros, pelo caminho do mapa do processo
 * (item do book → grupo da seleção → solicitação ao fornecedor → produto →
 * pedido). Só leitura, tudo pelos ids que já existem (nenhuma coluna nova):
 *
 * - `booking_items.lotId` e `booking_items.productId`;
 * - `selection_groups.chosenItemId` e `selection_groups.supplierRequestId`;
 * - `supplier_requests.bookingItemId`, `bookingLotId`, `productId` e
 *   `orderId` (gravado por `createPurchaseOrder`);
 * - `order_items.orderId` e `order_items.productId`.
 *
 * Toda leitura é por filtro com índice (lotId, productId, bookingItemId,
 * orderId, chosenItemId) ou por id; nenhuma tabela grande é lida inteira, e
 * só as colunas que as ligações usam.
 */

export interface LinkedLot {
  id: string;
  number: number;
  fileName: string;
}
export interface LinkedItem {
  id: string;
  lotId: string;
  position: number;
  /** Descrição, nome ou código do item (o que a planilha trouxe). */
  name: string;
  productId: string | null;
}
export interface LinkedSelection {
  id: string;
  status: string;
  chosenItemId: string;
  itemIds: string[];
  supplierRequestId: string | null;
}
export interface LinkedSupplierRequest {
  id: string;
  number: number;
  status: string;
  bookingItemId: string;
  bookingLotId: string;
  productId: string | null;
  orderId: string | null;
}
export interface LinkedProduct {
  id: string;
  name: string;
  sku: string | null;
}
export interface LinkedOrder {
  id: string;
  number: number;
  status: string;
}

export interface EntityLinks {
  lots: LinkedLot[];
  items: LinkedItem[];
  selections: LinkedSelection[];
  supplierRequests: LinkedSupplierRequest[];
  products: LinkedProduct[];
  orders: LinkedOrder[];
}

/** Telas que o login abre, para cada tipo de ligação (só a Wellmix vê as ligações). */
export interface EntityLinkAccess {
  book: boolean;
  supplierRequests: boolean;
  products: boolean;
  orders: boolean;
}

export function entityLinkAccess(user: User): EntityLinkAccess {
  const wellmix = isWellmix(user);
  return {
    book: wellmix && canOpen(user, "booking"),
    supplierRequests: wellmix && canOpen(user, "quotes"),
    products: wellmix && canOpen(user, "products"),
    orders: wellmix && canOpen(user, "orders"),
  };
}

/** Endereço da seleção de um grupo (a aba Seleção com os itens comparados). */
export function selectionHref(selection: Pick<LinkedSelection, "itemIds">) {
  const p = new URLSearchParams({
    tab: "selection",
    ids: selection.itemIds.join(","),
  });
  return `/app/booking/selection?${p.toString()}`;
}

const uniq = (ids: Iterable<string | null | undefined>) => [
  ...new Set([...ids].filter((v): v is string => !!v)),
];

const ITEM_COLUMNS = [
  "lotId",
  "position",
  "description",
  "productName",
  "factoryItemCode",
  "itemNumber",
  "productId",
] as const;
const REQUEST_COLUMNS = [
  "number",
  "status",
  "bookingItemId",
  "bookingLotId",
  "productId",
  "orderId",
] as const;

type ItemRow = {
  id: string;
  lotId: string;
  position: number;
  description: string | null;
  productName: string | null;
  factoryItemCode: string | null;
  itemNumber: string | null;
  productId: string | null;
};

const itemView = (i: ItemRow): LinkedItem => ({
  id: i.id,
  lotId: i.lotId,
  position: i.position,
  name:
    i.description ??
    i.productName ??
    i.factoryItemCode ??
    i.itemNumber ??
    String(i.position + 1),
  productId: i.productId ?? null,
});

const requestView = (r: LinkedSupplierRequest): LinkedSupplierRequest => ({
  id: r.id,
  number: r.number,
  status: r.status,
  bookingItemId: r.bookingItemId,
  bookingLotId: r.bookingLotId,
  productId: r.productId ?? null,
  orderId: r.orderId ?? null,
});

function itemsByIds(ids: string[]) {
  if (!ids.length) return Promise.resolve([] as ItemRow[]);
  return listColumns(getStore(), "booking_items", ITEM_COLUMNS, {
    filter: { id: ids },
  }) as Promise<ItemRow[]>;
}

function requestsBy(filter: Record<string, string | string[]>) {
  const values = Object.values(filter);
  if (values.some((v) => Array.isArray(v) && !v.length))
    return Promise.resolve([] as LinkedSupplierRequest[]);
  return listColumns(getStore(), "supplier_requests", REQUEST_COLUMNS, {
    filter: filter as never,
  }) as Promise<LinkedSupplierRequest[]>;
}

/**
 * Completa as ligações a partir do que já se sabe (solicitações, itens,
 * produtos e pedidos de partida): os itens das solicitações, os books dos
 * itens, os grupos da seleção que escolheram esses itens, os produtos e os
 * pedidos.
 */
async function expand(seed: {
  requests: LinkedSupplierRequest[];
  items?: ItemRow[];
  productIds?: Array<string | null>;
  orderIds?: string[];
}): Promise<EntityLinks> {
  const store = getStore();
  const requests = seed.requests.map(requestView);
  const known = new Map((seed.items ?? []).map((i) => [i.id, i]));
  const missing = uniq(requests.map((r) => r.bookingItemId)).filter(
    (id) => !known.has(id),
  );
  for (const row of await itemsByIds(missing)) known.set(row.id, row);
  const items = [...known.values()]
    .map(itemView)
    .sort((a, b) => a.lotId.localeCompare(b.lotId) || a.position - b.position);
  const itemIds = items.map((i) => i.id);
  const requestIds = new Set(requests.map((r) => r.id));
  const lotIds = uniq([
    ...items.map((i) => i.lotId),
    ...requests.map((r) => r.bookingLotId),
  ]);
  const productIds = uniq([
    ...(seed.productIds ?? []),
    ...items.map((i) => i.productId),
    ...requests.map((r) => r.productId),
  ]);
  const orderIds = uniq([
    ...(seed.orderIds ?? []),
    ...requests.map((r) => r.orderId),
  ]);
  const [lots, groups, products, orders] = await Promise.all([
    lotIds.length
      ? listColumns(store, "booking_lots", ["number", "fileName"], {
          filter: { id: lotIds },
        })
      : [],
    itemIds.length
      ? listColumns(
          store,
          "selection_groups",
          ["status", "chosenItemId", "itemIds", "supplierRequestId"],
          { filter: { chosenItemId: itemIds } },
        ).catch(async (error: unknown) => {
          // Banco sem a tabela da seleção (esquema antigo): sem grupos.
          const { isSchemaMissing } = await import("@/lib/db/errors");
          if (isSchemaMissing(error)) return [];
          throw error;
        })
      : [],
    productIds.length
      ? listColumns(store, "products", ["name", "sku"], {
          filter: { id: productIds },
        })
      : [],
    orderIds.length
      ? listColumns(store, "orders", ["number", "status"], {
          filter: { id: orderIds },
        })
      : [],
  ]);
  // O grupo da solicitação; sem ela, o grupo ainda vivo do item (a escolha
  // trocada fica de fora).
  const selections = groups
    .filter(
      (g) =>
        g.status !== "replaced" ||
        (!!g.supplierRequestId && requestIds.has(g.supplierRequestId)),
    )
    .map((g) => ({
      id: g.id,
      status: g.status,
      chosenItemId: g.chosenItemId,
      itemIds: Array.isArray(g.itemIds) ? g.itemIds : [g.chosenItemId],
      supplierRequestId: g.supplierRequestId ?? null,
    }));
  return {
    lots: lots
      .map((l) => ({ id: l.id, number: l.number, fileName: l.fileName }))
      .sort((a, b) => a.number - b.number),
    items,
    selections,
    supplierRequests: requests.sort((a, b) => a.number - b.number),
    products: products
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    orders: orders
      .map((o) => ({ id: o.id, number: o.number, status: o.status }))
      .sort((a, b) => a.number - b.number),
  };
}

/** Do pedido: as solicitações que viraram o pedido, os books e grupos delas e os produtos dos itens. */
export async function linksForOrder(orderId: string): Promise<EntityLinks> {
  const [requests, orderItems] = await Promise.all([
    requestsBy({ orderId }),
    listColumns(getStore(), "order_items", ["productId"], {
      filter: { orderId },
    }),
  ]);
  return expand({
    requests,
    productIds: orderItems.map((i) => i.productId),
    orderIds: [orderId],
  });
}

/** Do book: os itens, as solicitações abertas de cada item, os grupos, os produtos e os pedidos. */
export async function linksForLot(lotId: string): Promise<EntityLinks> {
  const items = (await listColumns(getStore(), "booking_items", ITEM_COLUMNS, {
    filter: { lotId },
  })) as ItemRow[];
  const requests = await requestsBy({
    bookingItemId: items.map((i) => i.id),
  });
  return expand({ requests, items });
}

/** Do produto: os itens de book ligados a ele, as solicitações e os pedidos delas. */
export async function linksForProduct(productId: string): Promise<EntityLinks> {
  const [items, requests] = await Promise.all([
    listColumns(getStore(), "booking_items", ITEM_COLUMNS, {
      filter: { productId },
    }) as Promise<ItemRow[]>,
    requestsBy({ productId }),
  ]);
  return expand({ requests, items, productIds: [productId] });
}

/** Da solicitação ao fornecedor: o item e o book, o grupo da seleção, o produto e o pedido. */
export async function linksForSupplierRequest(
  supplierRequestId: string,
): Promise<EntityLinks | null> {
  const [request] = await requestsBy({ id: supplierRequestId });
  if (!request) return null;
  return expand({ requests: [request] });
}

/** O que está ligado a um item do book (para a linha da tabela do book). */
export function linksOfItem(links: EntityLinks, itemId: string) {
  const requests = links.supplierRequests.filter(
    (r) => r.bookingItemId === itemId,
  );
  const item = links.items.find((i) => i.id === itemId) ?? null;
  const productIds = new Set(
    uniq([item?.productId, ...requests.map((r) => r.productId)]),
  );
  const orderIds = new Set(uniq(requests.map((r) => r.orderId)));
  return {
    selections: links.selections.filter((s) => s.chosenItemId === itemId),
    supplierRequests: requests,
    products: links.products.filter((p) => productIds.has(p.id)),
    orders: links.orders.filter((o) => orderIds.has(o.id)),
  };
}
