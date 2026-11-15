import type { Order, Requirement, Stage } from "@/lib/db/schema";
import {
  MILESTONE_KEYS,
  MILESTONES,
  milestoneOfRequirement,
  milestoneRank,
  type MilestoneKey,
  type MilestoneState,
  type MilestoneView,
} from "@/lib/milestones";
import { isOrderOpen } from "@/lib/order-status";
import { isRoundsParent } from "@/lib/purchase-rounds";
import { canCompleteLater, isOffFlowStage } from "@/lib/workflow/stages";

/*
 * Fase 5d (docs/MILESTONES.md): o motor libera os itens pelos marcos. Um
 * item pode ser enviado ou decidido quando o marco dele não está
 * "aguardando" (as dependências do mapa, `MILESTONES[].deps`, concluídas
 * pelas obrigatórias). Não depende mais da etapa estar em andamento: a
 * etapa continua gravada só para compatibilidade (até a fase 5f).
 *
 * Regra pura: as telas, as Pendências e o servidor usam a mesma.
 */

/** O que a liberação lê: a situação de cada marco e as etapas do pedido. */
export interface MilestoneRelease {
  states: ReadonlyMap<MilestoneKey, MilestoneState>;
  stages: ReadonlyMap<string, Pick<Stage, "id" | "key" | "status">>;
}

/** Monta a liberação a partir dos marcos calculados e das etapas. */
export function releaseOf(
  views: readonly Pick<MilestoneView, "key" | "state">[],
  stages: readonly Pick<Stage, "id" | "key" | "status">[],
): MilestoneRelease {
  return {
    states: new Map(views.map((v) => [v.key, v.state])),
    stages: new Map(stages.map((s) => [s.id, s])),
  };
}

/**
 * Pedido pai de uma programação de compra (docs/PURCHASE_SCHEDULE.md): anda
 * só pelos marcos 1 a 4 (pedido novo, certificação, material de arte e
 * arte); contrato em diante é de cada rodada.
 */
export const ROUNDS_PARENT_MILESTONES: readonly MilestoneKey[] =
  MILESTONE_KEYS.slice(0, 4);

const isMilestone = (key: string | null | undefined): key is MilestoneKey =>
  !!key && (MILESTONE_KEYS as readonly string[]).includes(key);

/** Marco do item: o gravado (fase 5b); sem ele, pela etapa e a chave. */
export function milestoneOfItem(
  r: Pick<Requirement, "key"> & { milestoneKey?: string | null },
  stage: Pick<Stage, "key">,
): MilestoneKey | null {
  return isMilestone(r.milestoneKey)
    ? r.milestoneKey
    : milestoneOfRequirement(stage.key, r.key);
}

/**
 * O item está liberado (pode ser enviado, trocado ou decidido agora)?
 *
 * - pedido encerrado ou cancelado, etapa cancelada: não;
 * - dado do Embarque que ainda dá para completar depois (`canCompleteLater`):
 *   sim, como antes;
 * - etapa fora do fluxo (pagamento ao fornecedor): só com a etapa aberta,
 *   como antes (não é tarefa dos marcos);
 * - pedido pai da programação de compra: só os marcos 1 a 4;
 * - o resto: o marco do item em andamento ou concluído (não "aguardando");
 *   o obrigatório já feito só enquanto nenhum marco que depende do dele
 *   começou.
 */
export function requirementReleased(
  order: Pick<Order, "status" | "purchaseRounds">,
  requirement: Pick<Requirement, "key" | "required" | "stageId"> & {
    milestoneKey?: string | null;
    status?: Requirement["status"];
  },
  release: MilestoneRelease,
): boolean {
  const stage = release.stages.get(requirement.stageId);
  if (!stage || stage.status === "cancelled") return false;
  if (!isOrderOpen(order.status)) return false;
  if (canCompleteLater(stage, requirement, order)) return true;
  if (isOffFlowStage(stage.key))
    return stage.status === "active" || stage.status === "blocked";
  const key = milestoneOfItem(requirement, stage);
  if (!key) return stage.status === "active" || stage.status === "blocked";
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
