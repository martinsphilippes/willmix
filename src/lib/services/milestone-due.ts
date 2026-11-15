import "server-only";

import { getStore, type OrderMilestone, type Requirement } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { milestoneOfRequirement, type MilestoneKey } from "@/lib/milestones";
import { isOffFlowStage } from "@/lib/workflow/stages";
import { storedMilestone } from "./order-milestones";

/*
 * Prazos pelos marcos gravados (fase 5c, docs/MILESTONES.md): lembretes e o
 * painel de SLA leem o prazo, a conclusão e o último lembrete de
 * `order_milestones` no lugar das etapas.
 *
 * As pendências de um marco são os itens pendentes (ou recusados) do pedido
 * com aquele marco (`requirements.milestoneKey`; sem ele, pela etapa e a
 * chave) que já podem ser feitos: o motor ainda libera os itens pelas etapas
 * até a fase 5d, então só conta o item de etapa em andamento ou bloqueada. O
 * pagamento ao fornecedor continua fora (Contas a pagar cobra o prazo dele).
 */

export type MilestoneRow = Pick<
  OrderMilestone,
  "id" | "orderId" | "key" | "status" | "dueAt" | "reminderSentAt"
>;

/** Os marcos em andamento ou travados (fora do histórico em espera). */
export function openMilestoneRows(): Promise<MilestoneRow[]> {
  return listColumns(
    getStore(),
    "order_milestones",
    ["orderId", "key", "status", "dueAt", "reminderSentAt"],
    { filter: { status: ["active", "blocked"] } },
  ).catch(() => [] as MilestoneRow[]);
}

/** Chave do mapa de pendências: pedido + marco. */
export const milestonePendingKey = (orderId: string, key: string) =>
  `${orderId}:${key}`;

/**
 * Itens pendentes (ou recusados) dos pedidos dados, por pedido e marco, só
 * os que já podem ser feitos (etapa em andamento ou bloqueada).
 */
export async function pendingByMilestone(
  orderIds: readonly string[],
): Promise<Map<string, Requirement[]>> {
  const out = new Map<string, Requirement[]>();
  const ids = [...new Set(orderIds)];
  if (!ids.length) return out;
  const store = getStore();
  const [requirements, stages] = await Promise.all([
    store.list("requirements", {
      filter: { orderId: ids, status: ["pending", "rejected"] },
    }),
    listColumns(store, "stages", ["key", "status"], {
      filter: { orderId: ids },
    }),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));
  for (const r of requirements) {
    const stage = stageById.get(r.stageId);
    if (!stage || (stage.status !== "active" && stage.status !== "blocked"))
      continue;
    if (isOffFlowStage(stage.key)) continue;
    const key: MilestoneKey | null =
      storedMilestone(r.milestoneKey) ??
      milestoneOfRequirement(stage.key, r.key);
    if (!key) continue;
    const k = milestonePendingKey(r.orderId, key);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}
