import "server-only";

import { getStore } from "@/lib/db";
import type {
  Document,
  Order,
  OrderItem,
  Party,
  Product,
  ProductPhoto,
  Request,
  Stage,
} from "@/lib/db";
import { boxesFor } from "@/lib/logistics/cbm";
import { customerDetail, isDelivered } from "./customer-accounts";
import { productPhotoList, productThumbId } from "./product-list";

/*
 * Pedido de venda em lista (ficha do cliente → registro de vendas → pedido):
 * uma linha por produto, com quantidade, caixas, volume, peso, valor ao
 * cliente e o que já foi entregue; depois os recebimentos, as observações e
 * os anexos. Pedidos do mesmo lote (solicitações com vários produtos) vêm
 * juntos, como um pedido de venda só. Nada aqui grava: a tela completa do
 * pedido continua sendo onde se registra e se aprova.
 */

export interface SaleLine {
  orderId: string;
  orderNumber: number;
  orderStatus: Order["status"];
  productId: string | null;
  photoDocumentId: string | null;
  /** Todas as fotos do produto (galeria da linha), a principal primeiro. */
  photos: { documentId: string; kind: string | null }[];
  name: string;
  variantName: string | null;
  sku: string | null;
  supplierSku: string | null;
  specification: string | null;
  color: string | null;
  quantity: number;
  unit: string;
  unitsPerBox: number | null;
  boxes: number;
  /** Volume total (m³) = caixas × CBM da caixa master. */
  cbm: number | null;
  /** Peso bruto total (kg) = quantidade × peso bruto por unidade. */
  weightKg: number | null;
  /** Preço unitário ao cliente (valor de venda ÷ quantidade do pedido). */
  unitPrice: number | null;
  amount: number | null;
  currency: string | null;
  /** Quantidade entregue (o pedido todo, quando chegou ao cliente). */
  delivered: number;
  notes: string | null;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Monta as linhas (função pura; o carregador busca os dados). */
export function buildSaleLines(input: {
  orders: Pick<
    Order,
    "id" | "number" | "status" | "sellPrice" | "sellCurrency" | "notes"
  >[];
  items: Pick<
    OrderItem,
    "orderId" | "productId" | "name" | "quantity" | "unit" | "variant"
  >[];
  products: Product[];
  requests: Pick<Request, "orderId" | "specification" | "notes">[];
  photos: {
    productId: string | null;
    documentId: string;
    isPrimary: boolean;
    kind: ProductPhoto["kind"];
  }[];
}): SaleLine[] {
  const product = new Map(input.products.map((p) => [p.id, p]));
  const lines: SaleLine[] = [];
  for (const o of [...input.orders].sort((a, b) => a.number - b.number)) {
    const items = input.items.filter((i) => i.orderId === o.id);
    const orderQty = items.reduce((s, i) => s + i.quantity, 0);
    const unit =
      o.sellPrice !== null && orderQty > 0 ? o.sellPrice / orderQty : null;
    const req = input.requests.find((r) => r.orderId === o.id);
    for (const it of items) {
      const p = it.productId ? (product.get(it.productId) ?? null) : null;
      const v = it.variant ?? null;
      const perBox = v?.masterBoxQty ?? p?.masterBoxQty ?? null;
      const boxes = boxesFor(it.quantity, perBox);
      const boxCbm = v?.cbm ?? p?.cbm ?? null;
      const gross = v?.grossWeightKg ?? p?.grossWeightKg ?? null;
      lines.push({
        orderId: o.id,
        orderNumber: o.number,
        orderStatus: o.status,
        productId: it.productId,
        photoDocumentId: p ? productThumbId(p, input.photos) : null,
        photos: p ? productPhotoList(p, input.photos) : [],
        name: it.name,
        variantName: v?.name ?? null,
        sku: p?.sku ?? null,
        supplierSku: v?.factoryItemCode ?? p?.supplierSku ?? null,
        specification: req?.specification ?? p?.specification ?? null,
        color: v?.colorAssortment ?? p?.color ?? null,
        quantity: it.quantity,
        unit: it.unit,
        unitsPerBox: perBox,
        boxes,
        cbm: boxCbm !== null ? round(boxes * boxCbm, 4) : null,
        weightKg: gross !== null ? round(it.quantity * gross, 2) : null,
        unitPrice: unit !== null ? round(unit, 4) : null,
        amount: unit !== null ? round(unit * it.quantity) : null,
        currency: o.sellCurrency,
        delivered: o.status !== "CANCELLED" && isDelivered(o) ? it.quantity : 0,
        notes: req?.notes ?? o.notes ?? null,
      });
    }
  }
  return lines;
}

/** Soma das colunas de quantidade, caixas, volume, peso e valor. */
export function saleTotals(lines: SaleLine[]) {
  const sum = (f: (l: SaleLine) => number | null) =>
    lines.reduce((s, l) => s + (f(l) ?? 0), 0);
  const amounts = new Map<string, number>();
  for (const l of lines)
    if (l.amount !== null && l.orderStatus !== "CANCELLED")
      amounts.set(
        l.currency ?? "BRL",
        round((amounts.get(l.currency ?? "BRL") ?? 0) + l.amount),
      );
  return {
    quantity: sum((l) => l.quantity),
    boxes: sum((l) => l.boxes),
    cbm: round(
      sum((l) => l.cbm),
      4,
    ),
    weightKg: round(sum((l) => l.weightKg)),
    delivered: sum((l) => l.delivered),
    amounts,
  };
}

/**
 * Carrega o pedido de venda do cliente: o pedido pedido e os do mesmo lote.
 * Nulo quando o pedido não é deste cliente (ou não existe).
 */
export async function loadSaleSheet(partyId: string, orderId: string) {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || order.customerId !== partyId) return null;
  const detail = await customerDetail(partyId);
  if (!detail) return null;
  const request = order.requestId
    ? await store.get("requests", order.requestId)
    : null;
  // Lote: as solicitações do mesmo grupo (deste cliente) que viraram pedido.
  const groupRequests = request?.groupId
    ? (
        await store.list("requests", { filter: { groupId: request.groupId } })
      ).filter((r) => r.customerId === partyId)
    : request
      ? [request]
      : [];
  const orderIds = [
    ...new Set([
      order.id,
      ...(groupRequests.map((r) => r.orderId).filter(Boolean) as string[]),
    ]),
  ];
  const orders = (
    await store.list("orders", { filter: { id: orderIds } })
  ).filter((o) => o.customerId === partyId);
  const requestIds = groupRequests.map((r) => r.id);
  const [items, stages, documents] = await Promise.all([
    store.list("order_items", { filter: { orderId: orderIds } }),
    store.list("stages", { filter: { orderId: orderIds } }),
    store.list("documents", { filter: { orderId: orderIds } }),
  ]);
  const productIds = [
    ...new Set(items.map((i) => i.productId).filter(Boolean) as string[]),
  ];
  const [products, photos, party] = await Promise.all([
    productIds.length
      ? store.list("products", { filter: { id: productIds } })
      : Promise.resolve([] as Product[]),
    productIds.length
      ? store.list("product_photos", { filter: { productId: productIds } })
      : Promise.resolve([]),
    store.get("parties", partyId) as Promise<Party | null>,
  ]);
  const lines = buildSaleLines({
    orders,
    items,
    products,
    requests: groupRequests,
    photos,
  });
  const rows = detail.orders.filter((r) => orderIds.includes(r.orderId));
  const payments = detail.payments.filter(
    (p) =>
      (p.orderId && orderIds.includes(p.orderId)) ||
      (!p.orderId && p.requestId && requestIds.includes(p.requestId)),
  );
  const stageDate = (key: Stage["key"]) => {
    const list = stages.filter((s) => s.key === key);
    const done = list.map((s) => s.completedAt).filter(Boolean) as string[];
    if (done.length) return { at: done.sort().at(-1)!, done: true };
    const due = list.map((s) => s.dueAt).filter(Boolean) as string[];
    return due.length ? { at: due.sort()[0], done: false } : null;
  };
  return {
    order,
    orders: orders.sort((a, b) => a.number - b.number),
    party,
    request,
    lines,
    totals: saleTotals(lines),
    rows,
    payments,
    shipping: stageDate("SHIPPING"),
    delivery: stageDate("DELIVERED"),
    documents: documents
      .filter((d: Document) => d.type !== "photo")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
