import "server-only";

import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ROLE_PARTY_FIELD } from "@/lib/workflow/stages";
import { notify } from "./notifications";

/**
 * Pendência + prazo + lembrete. Um lembrete por etapa a cada 24h enquanto
 * estiver vencida ou a `reminderDaysBeforeDue` dias do vencimento.
 */
export async function runReminders() {
  const store = getStore();
  const settings = await getSettings();
  const now = Date.now();
  const soon = now + settings.reminderDaysBeforeDue * 86_400_000;
  const stages = await store.list("stages", {
    filter: { status: ["active", "blocked"] },
  });
  let sent = 0;

  for (const stage of stages) {
    if (!stage.dueAt || Date.parse(stage.dueAt) > soon) continue;
    if (
      stage.reminderSentAt &&
      now - Date.parse(stage.reminderSentAt) < 86_400_000
    )
      continue;
    const order = await store.get("orders", stage.orderId);
    if (!order) continue;
    const pending = await store.list("requirements", {
      filter: { stageId: stage.id, status: ["pending", "rejected"] },
    });
    const required = pending.filter((r) => r.required);
    if (required.length === 0) continue;
    const role = required[0].role;
    const partyField = ROLE_PARTY_FIELD[role];
    const overdue = Date.parse(stage.dueAt) < now;
    await notify(
      {
        role: role === "operator" ? ["admin", "operator"] : role,
        partyId: partyField ? order[partyField] : null,
      },
      {
        subject: `${overdue ? "ATRASADO" : "Vence em breve"}: pedido #${order.number}, etapa ${stage.key}`,
        body: `Pendências: ${required.map((r) => r.label).join(", ")}.`,
        link: `/app/orders/${order.id}`,
      },
    );
    await store.update("stages", stage.id, {
      reminderSentAt: new Date(now).toISOString(),
    });
    sent++;
  }
  return { checked: stages.length, sent };
}
