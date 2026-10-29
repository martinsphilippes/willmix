import "server-only";

import type { Translate } from "@/i18n";
import {
  getStore,
  type Order,
  type OrderCancelReason,
  type StageKey,
  type User,
} from "@/lib/db";
import { assertRole, canViewOrder } from "@/lib/auth/permissions";
import { audit } from "./audit";
import {
  notify,
  notifyWellmix,
  requesterTarget,
  type NotifyText,
} from "./notifications";

/*
 * Cancelamento de pedido.
 * - Só o administrador cancela, em qualquer etapa. Nada é apagado: o pedido
 *   fica CANCELLED, as etapas abertas viram "cancelled", sai dos containers e
 *   dos fretes em aberto, e todos os envolvidos são avisados. O que ficaria
 *   pendurado como "em andamento" também é encerrado: itens de revisão abertos
 *   (descartados), pós-venda aberto (encerrado), programação de compra ligada
 *   ao pedido (cancelada) e o cliente do container, quando o pedido era o
 *   último dele lá.
 * - Acerto financeiro (sinal, pagamentos) é texto livre: a Wellmix resolve com
 *   o cliente e registra quando quiser.
 * - O cliente pode pedir o cancelamento até o produto entrar em produção; a
 *   Wellmix aceita (cancela) ou recusa com resposta.
 */

export class OrderCancelError extends Error {}

/*
 * O pagamento ao fornecedor saiu do fluxo (condição do fornecedor, Contas a
 * pagar): o pedido vai da Preparação direto à Embalagem. A janela continua a
 * mesma regra de antes: até a produção começar e até haver pagamento ao
 * fornecedor feito.
 */
const OPEN_FOR_REQUEST: StageKey[] = [
  "ORDER_CREATED",
  "PREPARATION",
  "SUPPLIER_PAYMENT",
  "PACKAGING",
];

/** Dia de hoje em Brasília (AAAA-MM-DD). */
function todayBr(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
}

/**
 * O cliente ainda pode pedir o cancelamento? Até o produto entrar em produção:
 * antes de haver pagamento ao fornecedor feito (confirmado ou recebido, ou o
 * recebimento confirmado na etapa antiga) e antes da data de início da
 * produção da ficha de compra.
 */
export async function customerCanRequestCancel(
  order: Order,
  now = new Date(),
): Promise<boolean> {
  if (!OPEN_FOR_REQUEST.includes(order.status as StageKey)) return false;
  const store = getStore();
  const [[sheet], paid, receivedInOldFlow] = await Promise.all([
    store.list("purchase_sheets", {
      filter: { orderId: order.id },
      limit: 1,
    }),
    store.list("payments", {
      filter: {
        orderId: order.id,
        direction: "supplier_out",
        status: ["confirmed", "received"],
      },
      limit: 1,
    }),
    // Pedido antigo: o fornecedor confirmou o recebimento pela etapa de
    // pagamento (às vezes sem linha de pagamento confirmada).
    store.list("requirements", {
      filter: { orderId: order.id, key: "payment_received", status: "done" },
      limit: 1,
    }),
  ]);
  if (paid.length || receivedInOldFlow.length) return false;
  const start = sheet?.productionStartAt?.slice(0, 10);
  return !start || todayBr(now) < start;
}

/** Quem acompanha o pedido e deve saber do cancelamento. */
async function notifyEveryone(
  order: Order,
  text: (t: Translate) => NotifyText,
) {
  const link = `/app/orders/${order.id}`;
  const message = { kind: "alert", actor: null, link, text } as const;
  await notify(requesterTarget(order.requestedByUserId), message);
  const partners: Array<[string | null, Parameters<typeof notify>[0]["role"]]> =
    [
      [order.supplierId, "supplier"],
      [order.agencyId, "agency"],
      [order.brokerId, "broker"],
      [order.shippingLineId, "shipping_line"],
      [order.carrierId, "carrier"],
      [order.comexId ?? null, "comex"],
      [order.logisticsId ?? null, "logistics"],
      [order.ocpId ?? null, "ocp"],
    ];
  for (const [partyId, role] of partners)
    if (partyId) await notify({ role, partyId }, message);
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
    // Container que ficou sem pedidos deixa de ser "do cliente" deste pedido
    // (o próximo pedido incluído define o cliente de novo).
    for (const containerId of new Set(items.map((i) => i.containerId))) {
      const container = await store.get("containers", containerId);
      if (!container || container.customerId !== order.customerId) continue;
      const left = await store.list("container_items", {
        filter: { containerId },
      });
      if (!left.some((i) => i.orderId))
        await store.update("containers", containerId, { customerId: null });
    }
  }
  const { cancelFreightForRequest } = await import("./freight");
  await cancelFreightForRequest(order.requestId);
  // Itens de revisão abertos do pedido saem da fila (Pendências, Control Tower).
  const reviews = await store.list("review_items", {
    filter: { orderId, status: "open" },
  });
  for (const r of reviews)
    await store.update("review_items", r.id, {
      status: "dismissed",
      resolvedByUserId: user.id,
      resolvedAt: now,
      resolutionNote: "Pedido cancelado",
    });
  // Pós-venda aberto ("Avalie a compra") não faz mais sentido.
  const afterSales = await store.list("after_sales", {
    filter: { orderId, status: "open" },
  });
  for (const a of afterSales)
    await store.update("after_sales", a.id, {
      status: "closed",
      closedAt: now,
    });
  // Programação de compra que virou este pedido fica cancelada (o vínculo fica).
  const schedules = await store.list("purchase_schedules", {
    filter: { orderId },
  });
  for (const ps of schedules)
    if (ps.status !== "cancelled")
      await store.update("purchase_schedules", ps.id, { status: "cancelled" });

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
  await notifyEveryone(order, (t) => ({
    subject: t("notif.cancelled.subject", { n: order.number }),
    body: input.note
      ? t("notif.cancelled.note", { note: input.note })
      : t("notif.cancelled.body"),
  }));
  if (order.erpNumber)
    await notifyWellmix({
      kind: "action",
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
    kind: "action",
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
    kind: "info",
    link: `/app/orders/${orderId}`,
    text: (t) => ({
      subject: t("notif.cancelRefused.subject", { n: order.number }),
      body: response,
    }),
  });
}
