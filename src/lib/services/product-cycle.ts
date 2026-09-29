import "server-only";

import { getStore, type Product } from "@/lib/db";

/**
 * Ciclo contínuo do produto (princípio de dados: o produto é o objeto central).
 * Sourcing → produto → solicitações → pedidos → pós-venda → reposição → kits.
 * Só leitura, tudo por relacionamento (nada duplicado).
 */
export interface ProductCycle {
  product: Product;
  sourcing: {
    itemId: string;
    name: string;
    status: string;
    visitId: string | null;
    visitDate: string | null;
    supplierName: string | null;
  } | null;
  requests: Array<{
    id: string;
    status: string;
    origin: string | null;
    quantity: number;
    unit: string;
    createdAt: string;
    customerName: string;
  }>;
  orders: Array<{
    id: string;
    number: number;
    status: string;
    quantity: number;
    createdAt: string;
    customerName: string;
    afterSalesStatus: string | null;
    rating: number | null;
    repurchaseInterest: string | null;
  }>;
  kits: Array<{
    id: string;
    name: string;
    status: string;
    customerName: string | null;
  }>;
  schedules: number;
  counts: {
    requests: number;
    orders: number;
    delivered: number;
    replenishments: number;
    afterSalesAnswered: number;
  };
}

export async function loadProductCycle(
  productId: string,
): Promise<ProductCycle | null> {
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) return null;
  const [items, requests, parties, afterSales, kits, schedules, sourcing] =
    await Promise.all([
      store.list("order_items", { filter: { productId } }),
      store.list("requests", { filter: { productId } }),
      store.list("parties"),
      store.list("after_sales"),
      store.list("marketing_kits", { filter: { productId } }),
      store.list("purchase_schedules", { filter: { productId } }),
      product.sourcingItemId
        ? store.get("sourcing_items", product.sourcingItemId)
        : Promise.resolve(null),
    ]);
  const nameOf = (id: string | null) =>
    id ? (parties.find((p) => p.id === id)?.name ?? "—") : null;
  const visit = sourcing?.visitId
    ? await store.get("supplier_visits", sourcing.visitId)
    : null;
  const orders = (
    await Promise.all(items.map((i) => store.get("orders", i.orderId)))
  ).filter((o): o is NonNullable<typeof o> => !!o);
  const orderRows = orders
    .map((o) => {
      const item = items.find((i) => i.orderId === o.id);
      const after = afterSales.find((a) => a.orderId === o.id) ?? null;
      return {
        id: o.id,
        number: o.number,
        status: o.status,
        quantity: item?.quantity ?? 0,
        createdAt: o.createdAt,
        customerName: nameOf(o.customerId) ?? "—",
        afterSalesStatus: after?.status ?? null,
        rating: after?.rating ?? null,
        repurchaseInterest: after?.repurchaseInterest ?? null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const requestRows = requests
    .map((r) => ({
      id: r.id,
      status: r.status,
      origin: r.origin,
      quantity: r.quantity,
      unit: r.unit,
      createdAt: r.createdAt,
      customerName: nameOf(r.customerId) ?? "—",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    product,
    sourcing: sourcing
      ? {
          itemId: sourcing.id,
          name: sourcing.name,
          status: sourcing.status,
          visitId: sourcing.visitId,
          visitDate: visit?.visitedAt ?? null,
          supplierName: sourcing.supplierName ?? nameOf(sourcing.supplierId),
        }
      : null,
    requests: requestRows,
    orders: orderRows,
    kits: kits.map((k) => ({
      id: k.id,
      name: k.name,
      status: k.status,
      customerName: nameOf(k.customerId),
    })),
    schedules: schedules.length,
    counts: {
      requests: requests.length,
      orders: orders.length,
      delivered: orders.filter(
        (o) => o.status === "DELIVERED" || o.status === "CLOSED",
      ).length,
      replenishments: requests.filter(
        (r) => r.origin === "replenishment" || r.origin === "proposal",
      ).length,
      afterSalesAnswered: orderRows.filter(
        (o) =>
          o.afterSalesStatus === "answered" || o.afterSalesStatus === "closed",
      ).length,
    },
  };
}
