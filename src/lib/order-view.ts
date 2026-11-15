import type { Requirement, Role, User } from "@/lib/db";
import type { ItemGroup } from "@/lib/order-groups";
import { isPartner, isWellmix } from "@/lib/auth/permissions";
import {
  MILESTONE_KEYS,
  milestoneOfStoredItem,
  type MilestoneKey,
  type MilestoneState,
} from "@/lib/milestones";
import type { OrderPartKey } from "@/lib/order-parts";

/*
 * O que cada papel vê dos itens na tela do pedido. A Wellmix vê tudo; cliente
 * e fornecedor veem o andamento (marcos começados ou concluídos); um parceiro
 * (agência, despachante, companhia marítima, transportador) vê só o que tem
 * a fazer, mais os marcos que precisa ler para trabalhar, nunca os valores
 * dos itens dos outros (custos do despachante, por exemplo). Fase 5g: sem
 * etapas; "os itens que andam junto" são os do mesmo grupo (`ItemGroup`).
 */

/** O grupo de itens é do parceiro (algum item é do papel dele, ou ele responde por ele). */
export function stageOfRole(
  stage: Pick<ItemGroup, "responsibleRole">,
  reqs: readonly Pick<Requirement, "role">[],
  role: Role,
): boolean {
  return stage.responsibleRole === role || reqs.some((r) => r.role === role);
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

type ViewGroup = Pick<ItemGroup, "id" | "key" | "status" | "responsibleRole">;
type ViewRequirement = Pick<Requirement, "id" | "key" | "role"> & {
  step?: string | null;
  milestoneKey?: string | null;
};

/** Marco do item: o gravado; sem ele, pelo passo (fase 5g). */
export function requirementMilestone(
  r: Pick<ViewRequirement, "key" | "milestoneKey" | "step">,
): MilestoneKey | null {
  return milestoneOfStoredItem(r);
}

/**
 * O item aparece para o login? (`stageReqs`: os itens que andam junto com
 * ele, os do mesmo grupo.)
 */
export function requirementVisibleTo(
  user: Pick<User, "role">,
  r: ViewRequirement,
  stage: ViewGroup,
  stageReqs: readonly Pick<Requirement, "role">[],
  /**
   * Fase 5d: a situação dos marcos do pedido. Liberado = o marco do item em
   * andamento ou concluído (não "aguardando").
   */
  states: ReadonlyMap<MilestoneKey, MilestoneState>,
): boolean {
  if (isWellmix(user)) return true;
  if (stage.status === "cancelled") return false;
  const milestone = requirementMilestone(r);
  const milestoneState = milestone ? states.get(milestone) : undefined;
  const released = milestoneState === "active" || milestoneState === "done";
  if (isPartner(user)) {
    // O item dele e os que andam junto com os dele, mesmo antes de começar.
    if (r.role === user.role) return true;
    if (stageOfRole(stage, stageReqs, user.role)) return true;
    const reads = PARTNER_READ_MILESTONES[user.role] ?? [];
    return !!milestone && reads.includes(milestone) && released;
  }
  // Cliente e fornecedor: o andamento (o que já começou).
  return released;
}

/**
 * Os itens que o login vê, por marco (na ordem dos 16; dentro do marco, na
 * ordem dos grupos e dos itens). `groups`: os grupos do pedido
 * (`itemGroupsOf`); `groupOf`: o grupo de cada item (`itemGroupId`).
 */
export function requirementsByMilestone<R extends ViewRequirement>(
  user: Pick<User, "role">,
  groups: readonly ViewGroup[],
  requirements: readonly R[],
  /** Fase 5d: a situação dos marcos (o "liberado" de `requirementVisibleTo`). */
  states: ReadonlyMap<MilestoneKey, MilestoneState>,
  groupOf: (r: R) => string,
): Map<MilestoneKey, Array<{ r: R; stage: ViewGroup }>> {
  const byGroup = new Map<string, R[]>();
  for (const r of requirements) {
    const id = groupOf(r);
    const list = byGroup.get(id);
    if (list) list.push(r);
    else byGroup.set(id, [r]);
  }
  const found = new Map<MilestoneKey, Array<{ r: R; stage: ViewGroup }>>();
  for (const stage of groups) {
    const reqs = byGroup.get(stage.id) ?? [];
    for (const r of reqs) {
      if (!requirementVisibleTo(user, r, stage, reqs, states)) continue;
      const key = requirementMilestone(r);
      if (!key) continue;
      const list = found.get(key);
      if (list) list.push({ r, stage });
      else found.set(key, [{ r, stage }]);
    }
  }
  const out = new Map<MilestoneKey, Array<{ r: R; stage: ViewGroup }>>();
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
