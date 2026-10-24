import type { Requirement, Role, Stage, StageKey, User } from "@/lib/db";
import { isPartner, isWellmix } from "@/lib/auth/permissions";

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
