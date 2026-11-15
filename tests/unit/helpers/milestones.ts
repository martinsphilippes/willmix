import type { MilestoneKey } from "@/lib/milestones";

/*
 * Fase 5d (docs/MILESTONES.md): o motor libera os itens pelos marcos, não
 * pela etapa em andamento. Os testes que montam o pedido direto numa etapa
 * (etapas anteriores "done" no banco) usam isto para deixar também os marcos
 * anteriores concluídos: os itens deles feitos e os passos do embarque, da
 * certificação e da origem validados. Fase 5e: a produção e o recebimento
 * também seguem os marcos (a Inspeção e a Nota fiscal e transporte
 * concluídas), não a etapa.
 */
export async function completeMilestonesBefore(
  orderId: string,
  target: MilestoneKey,
  /** Só os passos (embarque, certificação, origem); os itens ficam. */
  options: { stepsOnly?: boolean } = {},
) {
  const { getStore } = await import("@/lib/db");
  const { milestoneRank } = await import("@/lib/milestones");
  const { orderRelease, flushMilestoneSync } =
    await import("@/lib/services/order-milestones");
  const { IMPORT_STEPS } = await import("@/lib/services/import-flow");
  const store = getStore();
  const found = await orderRelease(orderId);
  if (!found) return;
  const [requirements, steps] = await Promise.all([
    store.list("requirements", { filter: { orderId } }),
    store.list("import_steps", { filter: { orderId } }),
  ]);
  const at = new Date().toISOString();
  for (const view of found.views) {
    if (milestoneRank(view.key) >= milestoneRank(target)) continue;
    for (const sub of view.subtasks) {
      if (sub.done) continue;
      const req = requirements.find(
        (r) =>
          r.key === sub.key &&
          r.status !== "done" &&
          (!r.step || r.step === sub.step),
      );
      if (req && options.stepsOnly) continue;
      if (req) {
        await store.update("requirements", req.id, {
          status: "done",
          value: req.value ?? "ok",
          submittedAt: at,
        });
        continue;
      }
      if (!IMPORT_STEPS.some((t) => t.key === sub.key)) continue;
      const data = {
        status: "validated" as const,
        // Canal verde (cinza ou vermelho pausaria o pedido).
        value: sub.key === "channel" ? "green" : "ok",
        submittedAt: at,
        validatedAt: at,
      };
      const have = steps.find((s) => s.key === sub.key);
      if (have) await store.update("import_steps", have.id, data);
      else
        await store.create("import_steps", {
          orderId,
          key: sub.key as never,
          amount: null,
          currency: null,
          documentId: null,
          submittedByUserId: null,
          validatedByUserId: null,
          rejectReason: null,
          ...data,
        });
    }
  }
  await flushMilestoneSync();
}
