import type { User } from "@/lib/db";

/*
 * Aprovações do mapa no fim dos marcos (docs/MILESTONES.md): nos testes que
 * percorrem o pedido de compra, quem aprova (aqui o login dado, em geral o
 * administrador) aprova tudo o que já está liberado.
 */
export async function approveMilestones(user: User, orderId: string) {
  const { getStore } = await import("@/lib/db");
  const engine = await import("@/lib/workflow/engine");
  const { blockedBy, milestoneApprovalOf } =
    await import("@/lib/purchase-lanes");
  const store = getStore();
  for (let round = 0; round < 5; round++) {
    const reqs = await store.list("requirements", { filter: { orderId } });
    const stages = await store.list("stages", { filter: { orderId } });
    const active = new Set(
      stages
        .filter((s) => s.status === "active" || s.status === "blocked")
        .map((s) => s.id),
    );
    const open = reqs.filter(
      (r) =>
        milestoneApprovalOf(r.key) &&
        r.status !== "done" &&
        active.has(r.stageId) &&
        !blockedBy(r.key, reqs).length,
    );
    if (!open.length) return;
    for (const r of open) await engine.submitRequirement(user, r.id, {});
  }
}
