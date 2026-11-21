import { getStore, type Order, type Request, type Store } from "@/lib/db";

/*
 * Solicitação do cliente que deu origem ao pedido. O pedido de compra lido do
 * Sankhya pode não ter uma (reposição, D1 de docs/SANKHYA_INTEGRACAO.md): sem
 * `requestId`, devolve nulo sem ir ao banco.
 */
export function orderRequest(
  order: Pick<Order, "requestId">,
  store: Store = getStore(),
): Promise<Request | null> {
  return order.requestId
    ? store.get("requests", order.requestId)
    : Promise.resolve(null);
}

/** Ids das solicitações dos pedidos, sem vazios nem repetidos. */
export function orderRequestIds(orders: Array<Pick<Order, "requestId">>) {
  return [
    ...new Set(
      orders.map((o) => o.requestId).filter((id): id is string => !!id),
    ),
  ];
}
