import type { Order, Requirement } from "@/lib/db/schema";
import {
  MILESTONE_KEYS,
  MILESTONES,
  isOffFlowItem,
  milestoneOfRequirement,
  milestoneOfStoredItem,
  milestoneRank,
  type MilestoneKey,
  type MilestoneState,
  type MilestoneView,
  type StoredItem,
} from "@/lib/milestones";
import { isOrderOpen } from "@/lib/order-status";
import { isRoundsParent } from "@/lib/purchase-rounds";
import { canCompleteLater } from "@/lib/workflow/templates";

/*
 * Fase 5d (docs/MILESTONES.md): o motor libera os itens pelos marcos. Um
 * item pode ser enviado ou decidido quando o marco dele não está
 * "aguardando" (as dependências do mapa, `MILESTONES[].deps`, concluídas
 * pelas obrigatórias). Fase 5g: sem etapas; o item anda pelo marco gravado.
 *
 * Regra pura: as telas, as Pendências e o servidor usam a mesma.
 */

/** O que a liberação lê: a situação de cada marco (fase 5g: sem etapas). */
export interface MilestoneRelease {
  states: ReadonlyMap<MilestoneKey, MilestoneState>;
}

/** Monta a liberação a partir dos marcos calculados. */
export function releaseOf(
  views: readonly Pick<MilestoneView, "key" | "state">[],
): MilestoneRelease {
  return { states: new Map(views.map((v) => [v.key, v.state])) };
}

/**
 * Pedido pai de uma programação de compra (docs/PURCHASE_SCHEDULE.md): anda
 * só pelos marcos 1 a 4 (pedido novo, certificação, material de arte e
 * arte); contrato em diante é de cada rodada.
 */
export const ROUNDS_PARENT_MILESTONES: readonly MilestoneKey[] =
  MILESTONE_KEYS.slice(0, 4);

/**
 * Marco do item: o gravado (fase 5b); sem ele, pelo passo gravado ou pela
 * chave (fase 5g). A etapa antiga só entra se quem chama a tiver (a
 * conferência da migração).
 */
export function milestoneOfItem(
  r: StoredItem,
  legacyStage?: { key: string } | null,
): MilestoneKey | null {
  return (
    milestoneOfStoredItem(r) ??
    (legacyStage ? milestoneOfRequirement(legacyStage.key, r.key) : null)
  );
}

/**
 * O item está liberado (pode ser enviado, trocado ou decidido agora)?
 *
 * - pedido encerrado ou cancelado: não (a etapa cancelada era a do pedido
 *   cancelado);
 * - item do pagamento antigo ao fornecedor (fora do fluxo,
 *   `isOffFlowItem`): não (a etapa dele concluía na hora; o pagamento vive
 *   em Contas a pagar);
 * - dado do Embarque que ainda dá para completar depois (`canCompleteLater`,
 *   com o marco Embarque concluído): sim, como antes;
 * - pedido pai da programação de compra: só os marcos 1 a 4;
 * - o resto: o marco do item em andamento ou concluído (não "aguardando");
 *   o obrigatório já feito só enquanto nenhum marco que depende do dele
 *   começou.
 */
export function requirementReleased(
  order: Pick<Order, "status" | "purchaseRounds">,
  requirement: Pick<Requirement, "key" | "required"> & {
    step?: string | null;
    milestoneKey?: string | null;
    status?: Requirement["status"];
  },
  release: MilestoneRelease,
): boolean {
  if (!isOrderOpen(order.status)) return false;
  if (isOffFlowItem(requirement)) return false;
  if (canCompleteLater(requirement, release.states.get("shipment"), order))
    return true;
  const key = milestoneOfItem(requirement);
  if (!key) return false;
  if (
    isRoundsParent(order) &&
    milestoneRank(key) >= ROUNDS_PARENT_MILESTONES.length
  )
    return false;
  const state = release.states.get(key);
  if (state !== "active" && state !== "done") return false;
  // Obrigatório já feito: só se refaz enquanto os marcos que dependem do
  // dele não começaram (como antes, enquanto a etapa estava aberta); depois,
  // só por uma reprovação ou reabertura.
  if (requirement.status === "done" && requirement.required)
    return !MILESTONES.some((d) => {
      if (!d.deps.includes(key)) return false;
      const next = release.states.get(d.key);
      return next === "active" || next === "done";
    });
  return true;
}
