import "server-only";

import { getStore, type Requirement } from "@/lib/db";
import { indexBy, listByIds } from "@/lib/db/lookup";
import { getSettings } from "@/lib/settings";
import { ROLE_PARTY_FIELD } from "@/lib/workflow/templates";
import { requirementLabel } from "@/i18n";
import { milestoneTitle, type MilestoneKey } from "@/lib/milestones";
import { isOrderOpen } from "@/lib/order-status";
import {
  milestonePendingKey,
  openMilestoneRows,
  pendingByMilestone,
} from "./milestone-due";
import { requesterTarget, notify } from "./notifications";

/**
 * Pendência + prazo + lembrete. Um lembrete por marco do pedido a cada 24h
 * enquanto estiver vencido ou a `reminderDaysBeforeDue` dias do vencimento.
 * Desde a fase 5c (docs/MILESTONES.md) o prazo, o marco e o último envio
 * saem de `order_milestones` (`dueAt`, `reminderSentAt`); as pendências são
 * os itens obrigatórios do marco que já podem ser feitos (milestone-due.ts).
 */
export async function runReminders() {
  const store = getStore();
  const settings = await getSettings();
  const now = Date.now();
  const soon = now + settings.reminderDaysBeforeDue * 86_400_000;
  const rows = await openMilestoneRows();
  let sent = 0;

  // Os marcos que podem receber lembrete agora; pedidos e itens pendentes
  // deles lidos de uma vez.
  const due = rows.filter(
    (row) =>
      !!row.dueAt &&
      Date.parse(row.dueAt) <= soon &&
      !(
        row.reminderSentAt && now - Date.parse(row.reminderSentAt) < 86_400_000
      ),
  );
  const orderIds = due.map((r) => r.orderId);
  const [orders, pending] = due.length
    ? await Promise.all([
        listByIds(store, "orders", orderIds),
        pendingByMilestone(orderIds),
      ])
    : [[], new Map<string, Requirement[]>()];
  const orderById = indexBy(orders, "id");

  for (const row of due) {
    if (!row.dueAt) continue;
    const order = orderById.get(row.orderId);
    // Pedido encerrado ou cancelado: a linha do marco pode ter ficado aberta.
    if (!order || !isOrderOpen(order.status)) continue;
    const required = (
      pending.get(milestonePendingKey(row.orderId, row.key)) ?? []
    ).filter((r) => r.required);
    if (required.length === 0) continue;
    const role = required[0].role;
    const partyField = ROLE_PARTY_FIELD[role];
    const overdue = Date.parse(row.dueAt) < now;
    const milestone = row.key as MilestoneKey;
    await notify(
      role === "customer"
        ? requesterTarget(order.requestedByUserId)
        : {
            role: role === "operator" ? ["admin", "operator"] : role,
            partyId: partyField ? order[partyField] : null,
          },
      {
        kind: overdue ? "alert" : "action",
        actor: "recipient",
        link: `/app/orders/${order.id}`,
        text: (t) => ({
          subject: t(overdue ? "notif.overdue.subject" : "notif.due.subject", {
            n: order.number,
            stage: milestoneTitle(t, milestone),
          }),
          body: t("notif.stage.body", {
            items: required.map((r) => requirementLabel(t, r)).join(", "),
          }),
        }),
      },
    );
    await store.update("order_milestones", row.id, {
      reminderSentAt: new Date(now).toISOString(),
    });
    sent++;
  }
  return { checked: rows.length, sent };
}
