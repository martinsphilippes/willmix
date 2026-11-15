import "server-only";

import { getStore, type OrderMilestone, type Requirement } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import {
  isOffFlowItem,
  milestoneOfStoredItem,
  type MilestoneKey,
} from "@/lib/milestones";

/*
 * Prazos pelos marcos gravados (fase 5c, docs/MILESTONES.md): lembretes e o
 * painel de SLA leem o prazo, a conclusão e o último lembrete de
 * `order_milestones` no lugar das etapas.
 *
 * As pendências de um marco são os itens pendentes (ou recusados) do pedido
 * com aquele marco (`requirements.milestoneKey`; sem ele, pelo passo) que já
 * podem ser feitos (o marco em andamento os libera, fase 5d). O pagamento
 * antigo ao fornecedor continua fora (Contas a pagar cobra o prazo dele).
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
 * Itens pendentes (ou recusados) dos pedidos dados, por pedido e marco. Quem
 * chama lê só os marcos em andamento (linhas abertas de `order_milestones`),
 * cujos itens já podem ser feitos (fase 5d: liberados pelo marco).
 */
export async function pendingByMilestone(
  orderIds: readonly string[],
): Promise<Map<string, Requirement[]>> {
  const out = new Map<string, Requirement[]>();
  const ids = [...new Set(orderIds)];
  if (!ids.length) return out;
  const requirements = await getStore().list("requirements", {
    filter: { orderId: ids, status: ["pending", "rejected"] },
  });
  for (const r of requirements) {
    // Fase 5d: o marco em andamento (a linha aberta) libera os itens dele;
    // fase 5g: sem etapas, só o pagamento antigo (fora do fluxo) fica fora.
    if (isOffFlowItem(r)) continue;
    const key: MilestoneKey | null = milestoneOfStoredItem(r);
    if (!key) continue;
    const k = milestonePendingKey(r.orderId, key);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}
