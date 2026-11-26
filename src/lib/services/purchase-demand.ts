import "server-only";

import { getStore, type Request, type User } from "@/lib/db";
import { assertCan } from "@/lib/auth/function-access";
import { isWellmix } from "@/lib/auth/permissions";
import { demandKind } from "@/lib/purchase-demand";
import { createRequest, RequestError } from "./requests";
import {
  STOCK_PARTY_ID,
  ensureStockParty,
  isStockCustomer,
} from "./stock-party";

/*
 * Compra por demanda (mapa B10 e B14, dono 15/11/2026;
 * docs/PURCHASE_DEMAND.md): a reposição aberta pelo Planner, a fila das
 * demandas e o saldo que decide, no carrinho, o que é pronta entrega.
 */

/** Situações em que a demanda ainda espera a compra (antes do pedido). */
export const OPEN_DEMAND_STATUSES = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
] as const;

export const isOpenDemand = (r: Pick<Request, "status">) =>
  (OPEN_DEMAND_STATUSES as readonly string[]).includes(r.status);

/**
 * Reposição aberta à mão pelo Planner (mapa B10): produto ativo, quantidade e
 * data desejada. Vai para a compra da Wellmix (empresa "Estoque Wellmix"),
 * sem cliente. Produto com variações: o produto inteiro (a variação, se
 * importar, vai na observação e o comprador decide na estratégia).
 */
export async function openReplenishment(
  user: User,
  input: {
    productId: string;
    quantity: number;
    desiredAt: string | null;
    notes: string | null;
  },
): Promise<Request> {
  if (!isWellmix(user)) throw new RequestError("forbidden");
  assertCan(user, "replenishment.open");
  const store = getStore();
  const product = await store.get("products", input.productId);
  if (!product?.active) throw new RequestError("product_unavailable");
  if (!(input.quantity > 0)) throw new RequestError("invalid_quantity");
  const stock = await ensureStockParty(user);
  return createRequest(
    user,
    {
      customerId: stock.id,
      productId: product.id,
      productName: product.name,
      description: product.category
        ? `${product.name} — ${product.category}`
        : product.name,
      specification: product.specification ?? null,
      quantity: input.quantity,
      unit: "un",
      deadline: null,
      notes: input.notes,
      origin: "replenishment",
      desiredAt: input.desiredAt,
    },
    { anyVariant: true },
  );
}

/**
 * As demandas de um tipo que ainda esperam a compra, as mais novas em cima.
 * A reposição que já virou pedido sai da fila (dono, 16/11/2026): segue de
 * Pedido em diante. O banco devolve só as abertas (índice `by_origin`).
 */
export async function listDemands(kind: "replenishment"): Promise<Request[]> {
  const store = getStore();
  const status = [...OPEN_DEMAND_STATUSES];
  // Tudo do Estoque Wellmix é reposição (dono, 26/11/2026): também a compra
  // para estoque aberta pela Nova solicitação, que saiu de Encomendas.
  const [byOrigin, stock] = await Promise.all([
    store.list("requests", {
      filter: { origin: "replenishment", status },
      orderBy: "createdAt",
      direction: "desc",
    }),
    store.list("requests", {
      filter: { customerId: STOCK_PARTY_ID, status },
      orderBy: "createdAt",
      direction: "desc",
    }),
  ]);
  const seen = new Set(byOrigin.map((r) => r.id));
  return [...byOrigin, ...stock.filter((r) => !seen.has(r.id))]
    .filter((r) => demandKind(r) === kind || isStockCustomer(r.customerId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Quanto de cada produto o estoque livre no Brasil mais o que está a caminho
 * sem pedido atende agora (o mesmo saldo dos selos da vitrine). Produto sem
 * saldo conhecido fica de fora (vira encomenda).
 */
export async function availableForSale(
  productIds: readonly string[],
): Promise<Map<string, number>> {
  const { availableStockByProduct } = await import("./containers");
  const stock = await availableStockByProduct();
  const out = new Map<string, number>();
  for (const id of productIds) {
    const entry = stock.get(id);
    if (entry && entry.quantity > 0) out.set(id, entry.quantity);
  }
  return out;
}
