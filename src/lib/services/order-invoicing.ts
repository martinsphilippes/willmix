import "server-only";
import { getStore, type User } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { emitProcessEvent } from "./process-engine";

/*
 * Faturamento do pedido (docs/PROCESSES.md): a Wellmix registra que o pedido
 * foi faturado. É mais um evento de status: a regra "Pedido faturado" de
 * Configurações → Processos decide o que acontece no estoque e no Sankhya
 * (faturar a nota para a TOP configurada).
 */

export class OrderInvoiceError extends Error {}

export async function registerOrderInvoice(user: User, orderId: string) {
  assertWellmix(user);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderInvoiceError("order_not_found");
  if (order.status === "CANCELLED")
    throw new OrderInvoiceError("order_cancelled");
  if (order.invoicedAt) throw new OrderInvoiceError("already_invoiced");
  const now = new Date().toISOString();
  await store.update("orders", orderId, {
    invoicedAt: now,
    invoicedByUserId: user.id,
  });
  await audit(
    user,
    "order.invoiced",
    "order",
    orderId,
    `Pedido #${order.number} faturado`,
    { invoicedAt: null },
    { invoicedAt: now },
  );
  await emitProcessEvent(user, "order:invoiced", { orderId });
}
