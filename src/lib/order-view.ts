import type { Requirement, Role, Stage, StageKey, User } from "@/lib/db";
import { isPartner, isWellmix } from "@/lib/auth/permissions";
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
