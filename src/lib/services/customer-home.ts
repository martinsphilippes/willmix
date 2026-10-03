import "server-only";

import { getStore, type Order, type StageKey, type User } from "@/lib/db";
import { canViewOrder } from "@/lib/auth/permissions";

export interface OrderInProgress {
  order: Order;
  productName: string;
  stageKey: StageKey;
  blocked: boolean;
  percent: number;
  stageDueAt: string | null;
  overdue: boolean;
  /** Há requisito da etapa atual que só o cliente pode cumprir. */
  waitingOnYou: boolean;
  /** Previsão de chegada do container do pedido (só quando informada). */
  eta: string | null;
}

/**
 * Pedidos em andamento do cliente para o início (Solicitações): só os que o
 * login pode ver (canViewOrder), sem os encerrados. Nada de fornecedor nem custo.
 */
export async function customerOrdersInProgress(
  user: User,
): Promise<OrderInProgress[]> {
  if (user.role !== "customer" || !user.partyId) return [];
  const store = getStore();
  const orders = (
    await store.list("orders", {
      filter: { customerId: user.partyId },
      orderBy: "number",
      direction: "desc",
    })
  ).filter(
    (o): o is Order & { status: StageKey } =>
      o.status !== "CLOSED" &&
      o.status !== "CANCELLED" &&
      canViewOrder(user, o),
  );
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const [stages, items, containerItems] = await Promise.all([
    store.list("stages", {
      filter: { orderId: ids, status: ["active", "blocked"] },
    }),
    store.list("order_items", { filter: { orderId: ids } }),
    store.list("container_items", { filter: { orderId: ids } }),
  ]);
  const containerIds = [...new Set(containerItems.map((c) => c.containerId))];
  const [containers, requirements] = await Promise.all([
    containerIds.length
      ? store.list("containers", { filter: { id: containerIds } })
      : Promise.resolve([]),
    stages.length
      ? store.list("requirements", {
          filter: {
            stageId: stages.map((s) => s.id),
            status: ["pending", "rejected"],
            role: "customer",
          },
        })
      : Promise.resolve([]),
  ]);
  const now = Date.now();
  return orders.map((order) => {
    const stage = stages.find((s) => s.orderId === order.id);
    const etas = containerItems
      .filter((c) => c.orderId === order.id)
      .map((c) => containers.find((k) => k.id === c.containerId)?.eta)
      .filter((d): d is string => !!d)
      .sort();
    return {
      order,
      productName:
        items.find((i) => i.orderId === order.id)?.name ?? `#${order.number}`,
      stageKey: order.status,
      blocked: stage?.status === "blocked",
      percent: stage?.percent ?? 0,
      stageDueAt: stage?.dueAt ?? null,
      overdue: !!stage?.dueAt && Date.parse(stage.dueAt) < now,
      waitingOnYou: !!stage && requirements.some((r) => r.stageId === stage.id),
      eta: etas.at(-1) ?? null,
    };
  });
}
