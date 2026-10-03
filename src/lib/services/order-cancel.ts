import "server-only";

import {
  getStore,
  type Order,
  type OrderCancelReason,
  type StageKey,
  type User,
} from "@/lib/db";
import { assertRole, canViewOrder } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notify, notifyWellmix, requesterTarget } from "./notifications";

/*
 * Cancelamento de pedido.
 * - Só o administrador cancela, em qualquer etapa. Nada é apagado: o pedido
 *   fica CANCELLED, as etapas abertas viram "cancelled", sai dos containers e
 *   dos fretes em aberto, e todos os envolvidos são avisados.
 * - Acerto financeiro (sinal, pagamentos) é texto livre: a Wellmix resolve com
 *   o cliente e registra quando quiser.
 * - O cliente pode pedir o cancelamento até o produto entrar em produção; a
 *   Wellmix aceita (cancela) ou recusa com resposta.
 */

export class OrderCancelError extends Error {}

const OPEN_FOR_REQUEST: StageKey[] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
];

/** Dia de hoje em Brasília (AAAA-MM-DD). */
function todayBr(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
}

/**
 * O cliente ainda pode pedir o cancelamento? Até o produto entrar em produção:
 * antes de o pagamento ao fornecedor ser concluído e antes da data de início
 * da produção da ficha de compra.
 */
export async function customerCanRequestCancel(
  order: Order,
  now = new Date(),
): Promise<boolean> {
  if (!OPEN_FOR_REQUEST.includes(order.status as StageKey)) return false;
  const [sheet] = await getStore().list("purchase_sheets", {
    filter: { orderId: order.id },
    limit: 1,
  });
  const start = sheet?.productionStartAt?.slice(0, 10);
  return !start || todayBr(now) < start;
}

/** Quem acompanha o pedido e deve saber do cancelamento. */
async function notifyEveryone(order: Order, subject: string, body: string) {
  const link = `/app/orders/${order.id}`;
  await notify(requesterTarget(order.requestedByUserId), {
    subject,
    body,
    link,
  });
  const partners: Array<[string | null, Parameters<typeof notify>[0]["role"]]> =
    [
      [order.supplierId, "supplier"],
      [order.agencyId, "agency"],
      [order.brokerId, "broker"],
      [order.shippingLineId, "shipping_line"],
      [order.carrierId, "carrier"],
    ];
  for (const [partyId, role] of partners)
    if (partyId) await notify({ role, partyId }, { subject, body, link });
}

export interface CancelInput {
  reason: OrderCancelReason;
  note: string | null;
  settlement: string | null;
}

export async function cancelOrder(
  user: User,
  orderId: string,
  input: CancelInput,
) {
  assertRole(user, ["admin"]);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderCancelError("not_found");
  if (order.status === "CANCELLED")
    throw new OrderCancelError("already_cancelled");
  const now = new Date().toISOString();
  const stageKey = order.status as StageKey;

  // Etapas que ainda não terminaram não acontecem mais.
  const stages = await store.list("stages", { filter: { orderId } });
  for (const stage of stages)
    if (stage.status !== "done")
      await store.update("stages", stage.id, {
        status: "cancelled",
        blockReason: null,
      });
  // Sai dos containers e dos fretes em aberto.
  const items = await store.list("container_items", { filter: { orderId } });
  if (items.length) {
    const { removeContainerItem } = await import("./containers");
    for (const item of items) await removeContainerItem(user, item.id);
  }
  const { cancelFreightForRequest } = await import("./freight");
  await cancelFreightForRequest(order.requestId);

  await store.update("orders", orderId, {
    status: "CANCELLED",
    currentStageId: null,
    cancelledAt: now,
    cancelledByUserId: user.id,
    cancelReason: input.reason,
    cancelNote: input.note,
    cancelSettlement: input.settlement,
    cancelStageKey: stageKey,
    ...(order.cancelRequestStatus === "requested"
      ? { cancelRequestStatus: "approved" as const }
      : {}),
  });
  await audit(
    user,
    "order.cancel",
    "order",
    orderId,
    `Pedido #${order.number} cancelado na etapa ${stageKey} (${input.reason})`,
    { status: stageKey },
    {
      status: "CANCELLED",
      reason: input.reason,
      note: input.note,
      settlement: input.settlement,
    },
  );
  await notifyEveryone(
    order,
    `Pedido #${order.number} cancelado`,
    input.note
      ? `O pedido foi cancelado pela Wellmix: ${input.note}`
      : "O pedido foi cancelado pela Wellmix.",
  );
  if (order.erpNumber)
    await notifyWellmix({
      subject: `Cancelar no Sankhya: pedido #${order.number}`,
      body: `O pedido foi cancelado no portal; cancele também o pedido ${order.erpNumber} no Sankhya.`,
      link: `/app/orders/${orderId}`,
    });
  return store.get("orders", orderId);
}

/** Acerto financeiro com o cliente: livre e editável depois do cancelamento. */
export async function updateCancelSettlement(
  user: User,
  orderId: string,
  settlement: string | null,
) {
  assertRole(user, ["admin"]);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderCancelError("not_found");
  if (order.status !== "CANCELLED") throw new OrderCancelError("not_cancelled");
  await store.update("orders", orderId, { cancelSettlement: settlement });
  await audit(
    user,
    "order.cancel_settlement",
    "order",
    orderId,
    `Acerto financeiro do pedido #${order.number}`,
    { settlement: order.cancelSettlement ?? null },
    { settlement },
  );
}

/** Cliente pede o cancelamento (até a produção começar). */
export async function requestOrderCancel(
  user: User,
  orderId: string,
  reason: string,
) {
  if (user.role !== "customer") throw new OrderCancelError("forbidden");
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewOrder(user, order))
    throw new OrderCancelError("not_found");
  if (order.status === "CANCELLED")
    throw new OrderCancelError("already_cancelled");
  if (order.cancelRequestStatus === "requested") return order;
  if (!(await customerCanRequestCancel(order)))
    throw new OrderCancelError("cancel_not_allowed");
  await store.update("orders", orderId, {
    cancelRequestStatus: "requested",
    cancelRequestedAt: new Date().toISOString(),
    cancelRequestedByUserId: user.id,
    cancelRequestReason: reason,
    cancelRequestResponse: null,
  });
  await audit(
    user,
    "order.cancel_request",
    "order",
    orderId,
    `Cliente pediu o cancelamento do pedido #${order.number}`,
    null,
    { reason },
  );
  await notifyWellmix({
    subject: `Pedido #${order.number}: cliente pediu cancelamento`,
    body: reason,
    link: `/app/orders/${orderId}#cancel`,
  });
  return store.get("orders", orderId);
}

/** Wellmix recusa o pedido de cancelamento, com resposta ao cliente. */
export async function rejectCancelRequest(
  user: User,
  orderId: string,
  response: string,
) {
  assertRole(user, ["admin"]);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderCancelError("not_found");
  if (order.cancelRequestStatus !== "requested")
    throw new OrderCancelError("no_cancel_request");
  await store.update("orders", orderId, {
    cancelRequestStatus: "rejected",
    cancelRequestResponse: response,
  });
  await audit(
    user,
    "order.cancel_request_reject",
    "order",
    orderId,
    `Pedido de cancelamento recusado (#${order.number})`,
    null,
    { response },
  );
  await notify(requesterTarget(order.cancelRequestedByUserId), {
    subject: `Pedido #${order.number}: cancelamento recusado`,
    body: response,
    link: `/app/orders/${orderId}`,
  });
}
