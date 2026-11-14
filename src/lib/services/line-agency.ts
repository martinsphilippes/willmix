import "server-only";

import { getStore, type Order } from "@/lib/db";

/*
 * Agência de arte por linha de produto (dono, 13/11/2026): a linha diz qual
 * agência faz a arte dos pedidos dela. O pedido novo herda a agência da linha;
 * ao salvar a agência na linha, os pedidos abertos da linha ainda sem agência
 * a recebem (quem já tem agência fica como está). Sem agência na linha vale a
 * regra de antes (a única agência ativa, ou a designação no pedido).
 */

const OPEN_STATUSES = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
  "INSPECTION",
] as const;

/** Agência ativa da linha do pedido (nula sem linha, sem agência ou agência inativa). */
export async function lineAgencyOf(
  lineId: string | null | undefined,
): Promise<string | null> {
  if (!lineId) return null;
  const store = getStore();
  const line = await store.get("product_lines", lineId);
  const agencyId = line?.agencyId ?? null;
  if (!agencyId) return null;
  const party = await store.get("parties", agencyId);
  return party && party.type === "agency" && party.active ? party.id : null;
}

/**
 * Designa a agência no pedido e faz o que a troca em "Parceiros do pedido"
 * faz: a arte ainda não enviada passa a ser da agência e quem faz a arte é
 * avisado do selo que já chegou.
 */
export async function assignOrderAgency(order: Order, agencyId: string) {
  const store = getStore();
  await store.update("orders", order.id, { agencyId });
  const stages = await store.list("stages", {
    filter: { orderId: order.id, key: "PACKAGING" },
  });
  const { normalizePackagingStage } = await import("./packaging");
  for (const stage of stages)
    await normalizePackagingStage(stage.id, { reassign: true });
  try {
    const updated = await store.get("orders", order.id);
    const { notifySealPartner } = await import("./import-flow");
    if (updated) await notifySealPartner(updated, "agencyId", null);
  } catch (error) {
    console.error("[line-agency] aviso do selo à agência", error);
  }
}

/** Pedidos abertos da linha sem agência: recebem a agência da linha. Devolve quantos. */
export async function applyLineAgency(lineId: string): Promise<number> {
  const agencyId = await lineAgencyOf(lineId);
  if (!agencyId) return 0;
  const orders = (
    await getStore().list("orders", {
      filter: { lineId, status: [...OPEN_STATUSES] },
    })
  ).filter((o) => !o.agencyId);
  for (const order of orders) await assignOrderAgency(order, agencyId);
  return orders.length;
}
