import "server-only";

import {
  getStore,
  type Order,
  type OrderItem,
  type Product,
  type PurchaseSnapshot,
  type Quote,
  type User,
} from "@/lib/db";
import { boxCbm } from "@/lib/logistics/cbm";
import { audit } from "./audit";

/**
 * Snapshot da negociação: o que foi efetivamente comprado naquele pedido.
 * Copia a ficha do produto e a cotação no momento da compra; alterações
 * posteriores no cadastro mestre não o afetam. Base da comparação na inspeção.
 */
export async function createPurchaseSnapshot(
  user: User | null,
  order: Order,
  item: OrderItem,
  quote: Quote | null,
  product: Product | null,
  note: string | null = null,
): Promise<PurchaseSnapshot> {
  const store = getStore();
  const photos = product
    ? await store.list("product_photos", { filter: { productId: product.id } })
    : [];
  const sourcing = product?.sourcingItemId
    ? await store.get("sourcing_items", product.sourcingItemId)
    : null;
  const snapshot = await store.create("purchase_snapshots", {
    orderId: order.id,
    orderItemId: item.id,
    requestId: order.requestId,
    productId: product?.id ?? null,
    sourcingItemId: product?.sourcingItemId ?? null,
    supplierId: order.supplierId,
    quoteId: quote?.id ?? null,
    name: item.name,
    supplierSku: product?.supplierSku ?? null,
    material: product?.material ?? null,
    color: product?.color ?? null,
    pantone: product?.pantone ?? null,
    unitPrice: quote?.price ?? item.unitPrice ?? product?.price ?? null,
    currency: quote?.currency ?? order.fobCurrency ?? product?.currency ?? null,
    quantity: item.quantity,
    unit: item.unit,
    moq: product?.moq ?? null,
    masterBoxQty: product?.masterBoxQty ?? null,
    innerBoxQty: product?.innerBoxQty ?? null,
    netWeightKg: product?.netWeightKg ?? null,
    grossWeightKg: product?.grossWeightKg ?? null,
    widthCm: product?.widthCm ?? null,
    heightCm: product?.heightCm ?? null,
    lengthCm: product?.lengthCm ?? null,
    boxLengthCm: product?.boxLengthCm ?? null,
    boxWidthCm: product?.boxWidthCm ?? null,
    boxHeightCm: product?.boxHeightCm ?? null,
    cbm: product ? boxCbm(product) : null,
    specification: product?.specification ?? null,
    conditions: quote?.conditions ?? sourcing?.conditions ?? null,
    photoDocumentIds: photos.map((p) => p.documentId),
    note,
    ncm: product?.ncm ?? null,
    createdByUserId: user?.id ?? order.customerId,
  });
  await audit(
    user,
    "snapshot.create",
    "order",
    order.id,
    `Snapshot da compra: ${item.name}`,
  );
  return snapshot;
}

export async function getSnapshotForOrder(orderId: string) {
  const [snapshot] = await getStore().list("purchase_snapshots", {
    filter: { orderId },
    orderBy: "createdAt",
    direction: "desc",
    limit: 1,
  });
  return snapshot ?? null;
}

/** Pedidos anteriores ao snapshot: gera retroativamente a partir do cadastro atual (marcado como tal). */
export async function ensureSnapshot(user: User, order: Order) {
  const existing = await getSnapshotForOrder(order.id);
  if (existing) return existing;
  const store = getStore();
  const [item] = await store.list("order_items", {
    filter: { orderId: order.id },
  });
  if (!item) throw new Error("order_item_missing");
  const request = await store.get("requests", order.requestId);
  const quote = request?.selectedQuoteId
    ? await store.get("quotes", request.selectedQuoteId)
    : null;
  const product = item.productId
    ? await store.get("products", item.productId)
    : null;
  return createPurchaseSnapshot(
    user,
    order,
    item,
    quote,
    product,
    "Gerado retroativamente a partir do cadastro atual; pode não refletir a negociação original.",
  );
}
