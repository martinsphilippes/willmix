import type { User } from "@/lib/db";

/*
 * Aprovações do mapa no fim dos marcos (docs/MILESTONES.md): nos testes que
 * percorrem o pedido de compra, quem aprova (aqui o login dado, em geral o
 * administrador) aprova tudo o que já está liberado (pelo marco, fase 5d).
 */
export async function approveMilestones(user: User, orderId: string) {
  const { getStore } = await import("@/lib/db");
  const engine = await import("@/lib/workflow/engine");
  const { blockedBy, milestoneApprovalOf } =
    await import("@/lib/purchase-lanes");
  const { orderRelease } = await import("@/lib/services/order-milestones");
  const { requirementReleased } = await import("@/lib/milestone-release");
  const store = getStore();
  for (let round = 0; round < 5; round++) {
    const reqs = await store.list("requirements", { filter: { orderId } });
    const order = (await store.get("orders", orderId))!;
    // Fase 5d: liberado pelo marco (não mais pela etapa em andamento).
    const { release } = (await orderRelease(orderId))!;
    const open = reqs.filter(
      (r) =>
        milestoneApprovalOf(r.key) &&
        r.status !== "done" &&
        requirementReleased(order, r, release) &&
        !blockedBy(r.key, reqs).length,
    );
    if (!open.length) return;
    for (const r of open) await engine.submitRequirement(user, r.id, {});
  }
}
