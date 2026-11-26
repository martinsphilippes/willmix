import "server-only";

import { getStore, type Request } from "@/lib/db";
import type { Filter } from "@/lib/db/store";
import { listColumns } from "@/lib/db/lookup";
import { REQUEST_STATUSES } from "@/lib/db/schema";
import { STOCK_PARTY_ID, isStockCustomer } from "./stock-party";

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

/**
 * Encomendas não lista o "Estoque Wellmix" (dono, 26/11/2026): o que é do
 * estoque é reposição (a Pre-order 1100 do Sankhya, que entra a cada carga,
 * e a compra para estoque) e fica só na Reposição (`listDemands`). Vale para
 * a lista, os cards, o CSV e "Ver canceladas e excluídas"; o lote aberto pelo
 * endereço (?group=) segue mostrando tudo.
 */
export const listedInRequests = (r: Pick<Request, "customerId">) =>
  !isStockCustomer(r.customerId);

const scoped = (scope: Scope) =>
  scope.customerId ? { customerId: scope.customerId } : {};

/**
 * As solicitações em andamento, mais novas primeiro, com as do estoque (a
 * vez de cada uma no Pipeline). A lista de Encomendas usa `listedRequests`.
 */
export function activeRequests(scope: Scope = {}): Promise<Request[]> {
  return getStore().list("requests", {
    filter: { ...scoped(scope), status: [...ACTIVE_REQUEST_STATUSES] },
    orderBy: "createdAt",
    direction: "desc",
  });
}

/** As encomendas em andamento da lista (tela e CSV): sem as do estoque. */
export async function listedRequests(scope: Scope = {}): Promise<Request[]> {
  return (await activeRequests(scope)).filter(listedInRequests);
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
  const rows = [...deleted, ...orderCancelled]
    .filter(listedInRequests)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows, cancelled: new Set(orderIds) };
}

/** Quantas encerradas (o link "Ver canceladas e excluídas"), sem trazê-las. */
export async function closedRequestCount(scope: Scope = {}): Promise<number> {
  const store = getStore();
  const orderIds = await cancelledOrders(scope);
  const countOf = (filter: Filter<Request>) =>
    store.count
      ? store.count("requests", filter)
      : listColumns(store, "requests", ["status"], { filter }).then(
          (r) => r.length,
        );
  // As do estoque não entram (listedInRequests): contadas à parte e tiradas.
  const ownStock = !scope.customerId || isStockCustomer(scope.customerId);
  const [deleted, stockDeleted, orderCancelled] = await Promise.all([
    countOf({ ...scoped(scope), status: "CANCELLED" }),
    ownStock
      ? countOf({ customerId: STOCK_PARTY_ID, status: "CANCELLED" })
      : Promise.resolve(0),
    orderIds.length
      ? listColumns(store, "requests", ["customerId"], {
          filter: { ...scoped(scope), status: "ORDERED", orderId: orderIds },
        }).then((r) => r.filter(listedInRequests).length)
      : Promise.resolve(0),
  ]);
  return deleted - stockDeleted + orderCancelled;
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
