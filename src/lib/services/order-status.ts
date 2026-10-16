import "server-only";

import { getStore, type Request, type RequestStatus } from "@/lib/db";

/*
 * Pedido cancelado visto de fora do pedido. Cancelar não mexe na solicitação
 * (ela continua ORDERED: na solicitação, CANCELLED quer dizer "excluída"),
 * então as telas que mostram a solicitação perguntam aqui se o pedido dela foi
 * cancelado. Vale também para pedidos cancelados antes desta regra.
 */

/** Situação mostrada da solicitação: ORDER_CANCELLED quando o pedido foi cancelado. */
export type RequestDisplayStatus = RequestStatus | "ORDER_CANCELLED";

/** Ids dos pedidos cancelados entre os informados (só consulta se houver algum). */
export async function cancelledOrderIds(
  orderIds: Array<string | null | undefined>,
): Promise<Set<string>> {
  const ids = [...new Set(orderIds.filter((id): id is string => !!id))];
  if (!ids.length) return new Set();
  const rows = await getStore().list("orders", {
    filter: { id: ids, status: "CANCELLED" },
  });
  return new Set(rows.map((o) => o.id));
}

export function requestDisplayStatus(
  request: Pick<Request, "status" | "orderId">,
  cancelled: Set<string>,
): RequestDisplayStatus {
  return request.status === "ORDERED" &&
    request.orderId &&
    cancelled.has(request.orderId)
    ? "ORDER_CANCELLED"
    : request.status;
}

/** Cor do selo da situação (mesma regra em todas as telas). */
export function requestStatusTone(
  status: RequestDisplayStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ORDERED") return "success";
  if (status === "ORDER_CANCELLED") return "danger";
  if (status === "WAITING_DOWN_PAYMENT") return "warning";
  return "neutral";
}
