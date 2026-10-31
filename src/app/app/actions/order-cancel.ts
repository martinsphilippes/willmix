"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { ORDER_CANCEL_REASONS } from "@/lib/db";
import {
  cancelOrder,
  rejectCancelRequest,
  requestOrderCancel,
  updateCancelSettlement,
} from "@/lib/services/order-cancel";
import { field, requireUser, run, str } from "./helpers";

/*
 * Cancelamento de pedido. Só o administrador cancela (o serviço confere o
 * papel); o cliente só pede, até o produto entrar em produção.
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v || null);

function orderBack(form: FormData) {
  const orderId = str(form, "orderId").slice(0, 64);
  return { orderId, back: `/app/orders/${encodeURIComponent(orderId)}` };
}

export async function cancelOrderAction(form: FormData) {
  const user = await requireUser();
  const { orderId, back } = orderBack(form);
  await run(back, async () => {
    assertRole(user, ["admin"]);
    id.parse(orderId);
    if (str(form, "confirm") !== "1") throw new Error("confirm_required");
    await cancelOrder(user, orderId, {
      reason: field(form, "reason", z.enum(ORDER_CANCEL_REASONS)),
      note: field(form, "note", text(1000)),
      settlement: field(form, "settlement", text(2000)),
    });
    return `${back}?cancelled=1`;
  });
}

export async function updateCancelSettlementAction(form: FormData) {
  const user = await requireUser();
  const { orderId, back } = orderBack(form);
  await run(back, async () => {
    assertRole(user, ["admin"]);
    id.parse(orderId);
    await updateCancelSettlement(
      user,
      orderId,
      field(form, "settlement", text(2000)),
    );
    return `${back}?settlementSaved=1`;
  });
}

export async function requestOrderCancelAction(form: FormData) {
  const user = await requireUser();
  const { orderId, back } = orderBack(form);
  await run(back, async () => {
    assertScreen(user, "orders");
    id.parse(orderId);
    const reason = field(form, "reason", z.string().min(3).max(1000));
    await requestOrderCancel(user, orderId, reason);
    return `${back}?cancelRequested=1#cancel`;
  });
}

export async function rejectCancelRequestAction(form: FormData) {
  const user = await requireUser();
  const { orderId, back } = orderBack(form);
  await run(back, async () => {
    assertRole(user, ["admin"]);
    id.parse(orderId);
    const response = field(form, "response", z.string().min(3).max(1000));
    await rejectCancelRequest(user, orderId, response);
    return `${back}?cancelRejected=1#cancel`;
  });
}
