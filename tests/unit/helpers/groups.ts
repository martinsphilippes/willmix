/*
 * Fase 5g (docs/MILESTONES.md): sem a tabela `stages`. Os testes que olhavam
 * "a etapa" de um pedido olham o grupo de itens equivalente (`itemGroupsOf`,
 * src/lib/order-groups.ts), com a situação tirada dos marcos do pedido.
 */
import type { Requirement } from "@/lib/db";

/** O grupo `key` do pedido (id `pedido|CHAVE`, situação pelos marcos). */
export async function groupOf(orderId: string, key: string) {
  const { getStore } = await import("@/lib/db");
  const { itemGroupsOf } = await import("@/lib/order-groups");
  const { orderRelease } = await import("@/lib/services/order-milestones");
  const store = getStore();
  const order = (await store.get("orders", orderId))!;
  const [requirements, rows, found] = await Promise.all([
    store.list("requirements", { filter: { orderId } }),
    store.list("order_milestones", { filter: { orderId } }),
    orderRelease(orderId),
  ]);
  const groups = itemGroupsOf(
    order,
    requirements,
    found?.release.states ?? new Map(),
    rows,
  );
  return (
    groups.find((g) => g.key === key) ?? {
      id: `${orderId}|${key}`,
      orderId,
      key,
      status: "pending" as const,
      responsibleRole: "operator" as const,
      startedAt: null,
      dueAt: null,
    }
  );
}

/** Os itens do grupo `key` do pedido. */
export async function groupItems(
  orderId: string,
  key: string,
): Promise<Requirement[]> {
  const { getStore } = await import("@/lib/db");
  const { itemGroupKey } = await import("@/lib/order-groups");
  const store = getStore();
  const order = (await store.get("orders", orderId))!;
  return (await store.list("requirements", { filter: { orderId } })).filter(
    (r) => itemGroupKey(r, order) === key,
  );
}

/** A chave do grupo do item. */
export async function groupKeyOf(r: Requirement) {
  const { getStore } = await import("@/lib/db");
  const { itemGroupKey } = await import("@/lib/order-groups");
  const order = (await getStore().get("orders", r.orderId))!;
  return itemGroupKey(r, order);
}

/**
 * Fase 5g: monta o registro antigo das etapas de um pedido (como os pedidos
 * de antes da 5g estão no banco): uma linha em `stages` por grupo, na ordem
 * antiga, e o `stageId` de cada item. Só para os testes da migração e da
 * conferência, que ainda leem as etapas antigas.
 */
export async function legacyStagesFor(orderId: string) {
  const { getStore } = await import("@/lib/db");
  const { STAGE_KEYS } = await import("@/lib/db/schema");
  const store = getStore();
  const order = (await store.get("orders", orderId))!;
  const { itemGroupKey } = await import("@/lib/order-groups");
  const reqs = await store.list("requirements", { filter: { orderId } });
  const groups = new Map<string, string>();
  for (const [i, key] of STAGE_KEYS.entries()) {
    const g = await groupOf(orderId, key);
    const stage = await store.create("stages", {
      orderId,
      key,
      sequence: i,
      status:
        g.status === "pending" ||
        g.status === "done" ||
        g.status === "cancelled"
          ? g.status
          : g.status === "blocked"
            ? "blocked"
            : "active",
      responsibleRole: g.responsibleRole,
      responsiblePartyId: null,
      dueAt: null,
      startedAt: null,
      completedAt: null,
      percent: 0,
      reminderSentAt: null,
      blockReason: null,
    } as never);
    groups.set(key, stage.id);
  }
  for (const r of reqs)
    await store.update("requirements", r.id, {
      stageId: groups.get(itemGroupKey(r, order)) ?? null,
    });
  return groups;
}
