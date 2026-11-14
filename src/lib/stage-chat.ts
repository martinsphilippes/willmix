import type { Order, Role } from "@/lib/db";

/*
 * Conversa da linha de cada etapa do pedido ("Etapas do pedido"): com quem
 * falar sobre a etapa. A Wellmix fala com a empresa responsável (fornecedor,
 * cliente ou o parceiro designado no pedido). Quem é de fora fala só com a
 * Wellmix (nunca direto com outra empresa: o isolamento entre clientes,
 * fornecedores e parceiros continua no serviço de mensagens).
 */

/** Campo do pedido que guarda a empresa de cada papel. */
export const STAGE_PARTY_FIELD = {
  customer: "customerId",
  supplier: "supplierId",
  agency: "agencyId",
  broker: "brokerId",
  shipping_line: "shippingLineId",
  carrier: "carrierId",
  comex: "comexId",
  logistics: "logisticsId",
  ocp: "ocpId",
  marketing_agency: "marketingAgencyId",
} as const satisfies Partial<Record<Role, keyof Order>>;

export type StageChat =
  /** Wellmix: conversa com a empresa responsável. */
  | { kind: "party"; partyId: string }
  /** Wellmix: o parceiro do papel ainda não foi designado no pedido. */
  | { kind: "unassigned" }
  /** Quem é de fora: a conversa dele com a Wellmix sobre o pedido. */
  | { kind: "wellmix" };

/**
 * Com quem conversar na linha da etapa. Nulo quando não há com quem: a
 * própria Wellmix é a responsável (Pedido criado) ou a etapa não tem
 * responsável de empresa.
 */
export function stageChat(
  order: Pick<
    Order,
    (typeof STAGE_PARTY_FIELD)[keyof typeof STAGE_PARTY_FIELD]
  >,
  role: Role | null | undefined,
  viewerIsWellmix: boolean,
): StageChat | null {
  if (!viewerIsWellmix) return { kind: "wellmix" };
  if (!role || !(role in STAGE_PARTY_FIELD)) return null;
  const field = STAGE_PARTY_FIELD[role as keyof typeof STAGE_PARTY_FIELD];
  const partyId = order[field];
  return partyId ? { kind: "party", partyId } : { kind: "unassigned" };
}
