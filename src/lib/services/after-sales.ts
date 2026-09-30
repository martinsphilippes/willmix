import "server-only";

import {
  getStore,
  type AfterSales,
  type Order,
  type RepurchaseInterest,
  type User,
} from "@/lib/db";
import { assertWellmix, canViewOrder, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { notify, notifyWellmix, requesterTarget } from "./notifications";

/**
 * Pós-venda: o processo não termina na entrega. Ao concluir DELIVERED, abre-se
 * um registro para o cliente avaliar (experiência, problemas, custos
 * percebidos, sugestões, interesse em nova compra). Entidade própria: as etapas
 * do pedido (STAGE_KEYS) não mudaram.
 */
export async function openAfterSales(
  user: User | null,
  order: Order,
): Promise<AfterSales | null> {
  const settings = await getSettings();
  if (!settings.afterSalesEnabled) return null;
  const store = getStore();
  const [existing] = await store.list("after_sales", {
    filter: { orderId: order.id },
    limit: 1,
  });
  if (existing) return existing;
  const row = await store.create("after_sales", {
    orderId: order.id,
    customerId: order.customerId,
    status: "open",
    rating: null,
    experience: null,
    problems: null,
    perceivedCosts: null,
    suggestions: null,
    repurchaseInterest: null,
    answeredAt: null,
    answeredByUserId: null,
    closedAt: null,
    notes: null,
  });
  await audit(user, "afterSales.open", "order", order.id, "Pós-venda aberto");
  await notify(requesterTarget(order.requestedByUserId), {
    subject: `Pedido #${order.number}: como foi a sua compra?`,
    body: "Avalie a experiência, conte problemas e diga se quer repor. Leva um minuto.",
    link: `/app/orders/${order.id}#after-sales`,
  });
  return row;
}

export async function getAfterSales(orderId: string) {
  const [row] = await getStore().list("after_sales", {
    filter: { orderId },
    limit: 1,
  });
  return row ?? null;
}

export async function answerAfterSales(
  user: User,
  id: string,
  input: {
    rating: number | null;
    experience?: string | null;
    problems?: string | null;
    perceivedCosts?: string | null;
    suggestions?: string | null;
    repurchaseInterest?: RepurchaseInterest | null;
  },
) {
  const store = getStore();
  const row = await store.get("after_sales", id);
  if (!row) throw new Error("not_found");
  const order = await store.get("orders", row.orderId);
  if (!order || !canViewOrder(user, order)) throw new Error("forbidden");
  if (!(isWellmix(user) || user.role === "customer"))
    throw new Error("forbidden");
  if (input.rating !== null && (input.rating < 1 || input.rating > 5))
    throw new Error("invalid_rating");
  const updated = await store.update("after_sales", id, {
    ...input,
    status: "answered",
    answeredAt: new Date().toISOString(),
    answeredByUserId: user.id,
  });
  await audit(
    user,
    "afterSales.answer",
    "order",
    row.orderId,
    `Nota ${input.rating ?? "—"}; recompra: ${input.repurchaseInterest ?? "—"}`,
  );
  await notifyWellmix({
    subject: `Pedido #${order.number}: avaliação de pós-venda recebida`,
    body: `Nota ${input.rating ?? "—"}. ${input.problems ? `Problemas: ${input.problems}` : "Sem problemas relatados."}`,
    link: `/app/orders/${order.id}#after-sales`,
  });
  return updated;
}

export async function closeAfterSales(
  user: User,
  id: string,
  notes?: string | null,
) {
  assertWellmix(user);
  const store = getStore();
  const row = await store.get("after_sales", id);
  if (!row) throw new Error("not_found");
  const updated = await store.update("after_sales", id, {
    status: "closed",
    closedAt: new Date().toISOString(),
    notes: notes ?? row.notes,
  });
  await audit(
    user,
    "afterSales.close",
    "order",
    row.orderId,
    notes ?? "Pós-venda encerrado",
  );
  return updated;
}

export async function listAfterSales(
  filter: { status?: AfterSales["status"]; customerId?: string } = {},
) {
  return getStore().list("after_sales", {
    filter: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    orderBy: "createdAt",
    direction: "desc",
  });
}
