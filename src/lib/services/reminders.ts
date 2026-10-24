import "server-only";

import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ROLE_PARTY_FIELD, isOffFlowStage } from "@/lib/workflow/stages";
import { requirementLabel } from "@/i18n";
import { requesterTarget, notify } from "./notifications";

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
    // Pagamento ao fornecedor não cobra prazo de etapa (tem Contas a pagar).
    if (isOffFlowStage(stage.key)) continue;
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
            stage: t(`stage.${stage.key}`),
          }),
          body: t("notif.stage.body", {
            items: required.map((r) => requirementLabel(t, r)).join(", "),
          }),
        }),
      },
    );
    await store.update("stages", stage.id, {
      reminderSentAt: new Date(now).toISOString(),
    });
    sent++;
  }
  // Briefings de embalagem (faca e arte) vencidos ou vencendo.
  const { remindPackagingBriefs } = await import("./packaging-brief");
  sent += await remindPackagingBriefs(now, soon);
  return { checked: stages.length, sent };
}
