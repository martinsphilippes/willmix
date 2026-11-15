import "server-only";
import { isOrderOpen } from "@/lib/order-status";
import { realName } from "@/lib/placeholder-name";

import { getStore, type Order, type User } from "@/lib/db";
import { currentMilestone, type MilestoneKey } from "@/lib/milestones";
import { requirementReleased } from "@/lib/milestone-release";
import { orderRelease } from "./order-milestones";
import { canViewOrder } from "@/lib/auth/permissions";

export interface OrderInProgress {
  order: Order;
  productName: string;
  /** Marco atual do pedido (fase 5e; antes, a etapa). */
  milestone: MilestoneKey | null;
  blocked: boolean;
  /** Andamento do marco atual. */
  percent: number;
  /** Prazo do marco atual. */
  stageDueAt: string | null;
  overdue: boolean;
  /** Há item liberado agora que só o cliente pode cumprir. */
  waitingOnYou: boolean;
  /** Previsão de chegada do container do pedido (só quando informada). */
  eta: string | null;
}

/**
 * Pedidos em andamento do cliente para o início (Solicitações): só os que o
 * login pode ver (canViewOrder), sem os encerrados. Nada de fornecedor nem
 * custo. Fase 5e: marco atual, andamento, prazo e trava pelos marcos.
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
  ).filter((o) => isOrderOpen(o.status) && canViewOrder(user, o));
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const [items, containerItems, rows, requirements] = await Promise.all([
    store.list("order_items", { filter: { orderId: ids } }),
    store.list("container_items", { filter: { orderId: ids } }),
    store
      .list("order_milestones", { filter: { orderId: ids } })
      .catch(() => []),
    store.list("requirements", {
      filter: {
        orderId: ids,
        status: ["pending", "rejected"],
        role: "customer",
      },
    }),
  ]);
  const containerIds = [...new Set(containerItems.map((c) => c.containerId))];
  const containers = containerIds.length
    ? await store.list("containers", { filter: { id: containerIds } })
    : [];
  const now = Date.now();
  const out: OrderInProgress[] = [];
  for (const order of orders) {
    const found = await orderRelease(order.id);
    const views = found?.views ?? [];
    const milestone = currentMilestone(views, order.status);
    const view = views.find((v) => v.key === milestone);
    const mine = rows.filter((r) => r.orderId === order.id);
    const row = mine.find((r) => r.key === milestone);
    const due = row?.dueAt ?? view?.dueAt ?? null;
    const etas = containerItems
      .filter((c) => c.orderId === order.id)
      .map((c) => containers.find((k) => k.id === c.containerId)?.eta)
      .filter((d): d is string => !!d)
      .sort();
    out.push({
      order,
      productName:
        realName(items.find((i) => i.orderId === order.id)?.name) ??
        `#${order.number}`,
      milestone,
      blocked: mine.some((r) => r.status === "blocked"),
      percent: view?.percent ?? 0,
      stageDueAt: due,
      overdue: !!due && Date.parse(due) < now,
      waitingOnYou:
        !!found &&
        requirements.some(
          (r) =>
            r.orderId === order.id &&
            requirementReleased(order, r, found.release),
        ),
      eta: etas.at(-1) ?? null,
    });
  }
  return out;
}
