import type { Requirement, Role, Stage, StageKey, User } from "@/lib/db";
import { isPartner, isWellmix } from "@/lib/auth/permissions";
import {
  MILESTONE_KEYS,
  milestoneOfRequirement,
  type MilestoneKey,
  type MilestoneState,
} from "@/lib/milestones";
import type { OrderPartKey } from "@/lib/order-parts";

/*
 * O que cada papel vê das etapas na tela do pedido. A Wellmix vê tudo; cliente
 * e fornecedor veem o andamento (etapas começadas ou concluídas); um parceiro
 * (agência, despachante, companhia marítima, transportador) vê só as etapas
 * em que tem o que fazer, mais as que precisa ler para trabalhar, nunca os
 * valores das etapas dos outros (custos do despachante, por exemplo).
 */

/** Etapas que o parceiro lê sem agir nelas. */
export const PARTNER_READ_STAGES: Partial<Record<Role, readonly StageKey[]>> = {
  // O despachante desembaraça com o BL, o navio e a chegada do embarque.
  broker: ["SHIPPING"],
  // Comex e agente de carga acompanham o embarque (BL, navio, chegada).
  comex: ["SHIPPING"],
  logistics: ["SHIPPING"],
};

/** A etapa é do parceiro (algum item é do papel dele, ou ele responde por ela). */
export function stageOfRole(
  stage: Pick<Stage, "responsibleRole">,
  reqs: readonly Pick<Requirement, "role">[],
  role: Role,
): boolean {
  return stage.responsibleRole === role || reqs.some((r) => r.role === role);
}

/** Cartão da etapa aparece para o usuário? (`reqs`: os itens da etapa.) */
export function stageVisibleTo(
  user: Pick<User, "role">,
  stage: Pick<Stage, "key" | "status" | "responsibleRole">,
  reqs: readonly Pick<Requirement, "role">[],
): boolean {
  if (stage.key === "CLOSED") return false;
  if (isWellmix(user)) return true;
  if (stage.status === "cancelled") return false;
  if (isPartner(user)) {
    // A própria etapa aparece mesmo antes de começar (o que vai ter de fazer).
    if (stageOfRole(stage, reqs, user.role)) return true;
    const reads = PARTNER_READ_STAGES[user.role] ?? [];
    return reads.includes(stage.key) && stage.status !== "pending";
  }
  return stage.status !== "pending";
}

/*
 * Tabela "Etapas do pedido": quais linhas cada login vê (decisão do dono).
 * A Wellmix e o cliente veem o fluxo inteiro (o cliente acompanha o pedido).
 * Fornecedor e parceiros veem só o que é responsabilidade do próprio login:
 * as etapas em que respondem ou têm item a preencher, as partes do pedido em
 * que atuam e, no caso dos parceiros, as etapas que precisam ler.
 */

/** Papéis de fora da Wellmix que atuam em cada parte do pedido. */
export const ORDER_PART_ROLES: Record<OrderPartKey, readonly Role[]> = {
  document: ["supplier"],
  sheet: ["supplier"],
  // Certificação: a certificadora e o despachante (dono, 13/11/2026).
  certification: ["ocp", "broker"],
  artwork: ["agency"],
  // Pagamento ao fornecedor e recebimento: só a Wellmix age.
  supplier_payment: [],
  production: ["supplier"],
  import: ["comex", "broker", "logistics"],
  receiving: [],
};

const seesWholeFlow = (user: Pick<User, "role">) =>
  isWellmix(user) || user.role === "customer";

/** A linha da etapa aparece na tabela para este login? */
export function stageRowFor(
  user: Pick<User, "role">,
  stage: Pick<Stage, "key" | "status" | "responsibleRole">,
  reqs: readonly Pick<Requirement, "role">[],
): boolean {
  if (seesWholeFlow(user)) return true;
  if (stageOfRole(stage, reqs, user.role)) return true;
  // Etapa que o parceiro só lê (ex.: o despachante e o embarque).
  const reads = PARTNER_READ_STAGES[user.role] ?? [];
  return reads.includes(stage.key) && stageVisibleTo(user, stage, reqs);
}

/** A linha da parte do pedido aparece na tabela para este login? */
export function partRowFor(
  user: Pick<User, "role">,
  part: OrderPartKey,
): boolean {
  return seesWholeFlow(user) || ORDER_PART_ROLES[part].includes(user.role);
}

/*
 * Fase 5c (docs/MILESTONES.md): a tela do pedido de cliente, fornecedor e
 * parceiros mostra os marcos no lugar da tabela "Etapas do pedido". Quem vê
 * cada item continua igual: o item do papel do login, os itens que andam
 * junto com os dele (a mesma etapa do motor, que ainda libera os itens até a
 * fase 5d) e, para o parceiro, os marcos que ele precisa ler. O que muda é o
 * agrupamento (pelo marco gravado no item, `requirements.milestoneKey`) e a
 * leitura do parceiro, por marco no lugar das etapas (PARTNER_READ_STAGES).
 */

/** Marcos que o parceiro lê sem agir neles, depois que começam. */
export const PARTNER_READ_MILESTONES: Partial<
  Record<Role, readonly MilestoneKey[]>
> = {
  // O despachante desembaraça com o BL, o navio e a chegada do embarque.
  broker: ["shipment"],
  // Comex e agente de carga acompanham o embarque (BL, navio, chegada).
  comex: ["shipment"],
  logistics: ["shipment"],
};

type ViewStage = Pick<Stage, "id" | "key" | "status" | "responsibleRole">;
type ViewRequirement = Pick<Requirement, "id" | "stageId" | "key" | "role"> & {
  milestoneKey?: string | null;
};

/** Marco do item: o gravado; sem ele, pela etapa e a chave. */
export function requirementMilestone(
  r: Pick<ViewRequirement, "key" | "milestoneKey">,
  stage: Pick<Stage, "key">,
): MilestoneKey | null {
  const stored = r.milestoneKey;
  if (stored && (MILESTONE_KEYS as readonly string[]).includes(stored))
    return stored as MilestoneKey;
  return milestoneOfRequirement(stage.key, r.key);
}

/**
 * O item aparece para o login? (`stageReqs`: os itens que andam junto com
 * ele, os da mesma etapa do motor.)
 */
export function requirementVisibleTo(
  user: Pick<User, "role">,
  r: ViewRequirement,
  stage: ViewStage,
  stageReqs: readonly Pick<Requirement, "role">[],
  /**
   * Fase 5d: a situação dos marcos do pedido. Liberado = o marco do item em
   * andamento ou concluído (não "aguardando"). Sem ela, pela etapa começada.
   */
  states?: ReadonlyMap<MilestoneKey, MilestoneState>,
): boolean {
  if (stage.key === "CLOSED") return false;
  if (isWellmix(user)) return true;
  if (stage.status === "cancelled") return false;
  // Liberado: o marco do item começou (fase 5d; sem os marcos, a etapa).
  const milestoneState = states?.get(requirementMilestone(r, stage) as never);
  const released = states
    ? milestoneState === "active" || milestoneState === "done"
    : stage.status !== "pending";
  if (isPartner(user)) {
    // O item dele e os que andam junto com os dele, mesmo antes de começar.
    if (r.role === user.role) return true;
    if (stageOfRole(stage, stageReqs, user.role)) return true;
    const milestone = requirementMilestone(r, stage);
    const reads = PARTNER_READ_MILESTONES[user.role] ?? [];
    return !!milestone && reads.includes(milestone) && released;
  }
  // Cliente e fornecedor: o andamento (o que já começou).
  return released;
}

/**
 * Os itens que o login vê, por marco (na ordem dos 16; dentro do marco, na
 * ordem das etapas e dos itens). `stages` na ordem do fluxo.
 */
export function requirementsByMilestone<R extends ViewRequirement>(
  user: Pick<User, "role">,
  stages: readonly ViewStage[],
  requirements: readonly R[],
  /** Fase 5d: a situação dos marcos (o "liberado" de `requirementVisibleTo`). */
  states?: ReadonlyMap<MilestoneKey, MilestoneState>,
): Map<MilestoneKey, Array<{ r: R; stage: ViewStage }>> {
  const byStage = new Map<string, R[]>();
  for (const r of requirements) {
    const list = byStage.get(r.stageId);
    if (list) list.push(r);
    else byStage.set(r.stageId, [r]);
  }
  const found = new Map<MilestoneKey, Array<{ r: R; stage: ViewStage }>>();
  for (const stage of stages) {
    const reqs = byStage.get(stage.id) ?? [];
    for (const r of reqs) {
      if (!requirementVisibleTo(user, r, stage, reqs, states)) continue;
      const key = requirementMilestone(r, stage);
      if (!key) continue;
      const list = found.get(key);
      if (list) list.push({ r, stage });
      else found.set(key, [{ r, stage }]);
    }
  }
  const out = new Map<MilestoneKey, Array<{ r: R; stage: ViewStage }>>();
  for (const key of MILESTONE_KEYS) {
    const list = found.get(key);
    if (list) out.set(key, list);
  }
  return out;
}

/** Marco em que cada parte do pedido aparece na tela do parceiro. */
export const ORDER_PART_MILESTONE: Record<OrderPartKey, MilestoneKey> = {
  sheet: "new-order",
  certification: "certification",
  artwork: "art",
  document: "contract",
  supplier_payment: "down-payment",
  production: "production",
  import: "shipment",
  receiving: "delivery",
};
