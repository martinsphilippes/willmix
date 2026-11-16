import "server-only";

import { getStore, type Request } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { REQUEST_STATUSES } from "@/lib/db/schema";

/*
 * Leitura da lista de Encomendas (tela e CSV; dono, 16/11/2026). A lista só
 * mostra o que ainda é encomenda: o que virou pedido segue de Pedido em
 * diante. Antes, a tela lia todas as solicitações (~16 mil, quase todas do
 * histórico, já pedidas) e procurava cada pedido para saber se estava
 * cancelado (~160 consultas). Agora o banco devolve só as da etapa
 * (índice `requests_by_status`), e as encerradas só quando pedidas.
 */

/** Situações de quem ainda é encomenda (nem pedido, nem excluída). */
export const ACTIVE_REQUEST_STATUSES = REQUEST_STATUSES.filter(
  (s) => s !== "ORDERED" && s !== "CANCELLED",
);

type Scope = { customerId?: string | null };

const scoped = (scope: Scope) =>
  scope.customerId ? { customerId: scope.customerId } : {};

/** As encomendas em andamento (a lista principal e o CSV), mais novas primeiro. */
export function activeRequests(scope: Scope = {}): Promise<Request[]> {
  return getStore().list("requests", {
    filter: { ...scoped(scope), status: [...ACTIVE_REQUEST_STATUSES] },
    orderBy: "createdAt",
    direction: "desc",
  });
}

/** Ids dos pedidos cancelados (do cliente, quando há). */
async function cancelledOrders(scope: Scope): Promise<string[]> {
  const rows = await listColumns(getStore(), "orders", ["status"], {
    filter: { ...scoped(scope), status: "CANCELLED" },
  });
  return rows.map((o) => o.id);
}

/**
 * Encerradas ("Ver canceladas e excluídas"): as excluídas e as que viraram
 * um pedido depois cancelado. Devolve também os pedidos cancelados, para o
 * selo "Pedido cancelado".
 */
export async function closedRequests(
  scope: Scope = {},
): Promise<{ rows: Request[]; cancelled: Set<string> }> {
  const store = getStore();
  const orderIds = await cancelledOrders(scope);
  const [deleted, orderCancelled] = await Promise.all([
    store.list("requests", {
      filter: { ...scoped(scope), status: "CANCELLED" },
      orderBy: "createdAt",
      direction: "desc",
    }),
    orderIds.length
      ? store.list("requests", {
          filter: { ...scoped(scope), status: "ORDERED", orderId: orderIds },
          orderBy: "createdAt",
          direction: "desc",
        })
      : Promise.resolve([]),
  ]);
  const rows = [...deleted, ...orderCancelled].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return { rows, cancelled: new Set(orderIds) };
}

/** Quantas encerradas (o link "Ver canceladas e excluídas"), sem trazê-las. */
export async function closedRequestCount(scope: Scope = {}): Promise<number> {
  const store = getStore();
  const orderIds = await cancelledOrders(scope);
  const [deleted, orderCancelled] = await Promise.all([
    store.count
      ? store.count("requests", { ...scoped(scope), status: "CANCELLED" })
      : listColumns(store, "requests", ["status"], {
          filter: { ...scoped(scope), status: "CANCELLED" },
        }).then((r) => r.length),
    orderIds.length
      ? listColumns(store, "requests", ["orderId"], {
          filter: { ...scoped(scope), status: "ORDERED", orderId: orderIds },
        }).then((r) => r.length)
      : Promise.resolve(0),
  ]);
  return deleted + orderCancelled;
}

/** As solicitações de um lote (?group=), em qualquer situação. */
export function groupRequests(
  groupId: string,
  scope: Scope = {},
): Promise<Request[]> {
  return getStore().list("requests", {
    filter: { ...scoped(scope), groupId },
    orderBy: "createdAt",
    direction: "desc",
  });
}

/** Tamanho de cada lote (o selo "lote de N"), contando todas as situações. */
export async function groupSizes(
  groupIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(groupIds.filter(Boolean))];
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const rows = await listColumns(getStore(), "requests", ["groupId"], {
    filter: { groupId: ids },
  });
  for (const r of rows)
    if (r.groupId) out.set(r.groupId, (out.get(r.groupId) ?? 0) + 1);
  return out;
}
