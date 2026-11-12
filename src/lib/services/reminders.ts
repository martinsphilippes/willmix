import "server-only";

import { getStore } from "@/lib/db";
import { indexBy, listByIds } from "@/lib/db/lookup";
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

  // As etapas que podem receber lembrete agora; pedidos e itens pendentes
  // delas lidos de uma vez (antes: duas leituras por etapa).
  const due = stages.filter(
    (stage) =>
      // Pagamento ao fornecedor não cobra prazo de etapa (tem Contas a pagar).
      !isOffFlowStage(stage.key) &&
      !!stage.dueAt &&
      Date.parse(stage.dueAt) <= soon &&
      !(
        stage.reminderSentAt &&
        now - Date.parse(stage.reminderSentAt) < 86_400_000
      ),
  );
  const [orders, pendingAll] = due.length
    ? await Promise.all([
        listByIds(
          store,
          "orders",
          due.map((s) => s.orderId),
        ),
        store.list("requirements", {
          filter: {
            stageId: due.map((s) => s.id),
            status: ["pending", "rejected"],
          },
        }),
      ])
    : [[], []];
  const orderById = indexBy(orders, "id");
  const pendingByStage = new Map<string, typeof pendingAll>();
  for (const r of pendingAll) {
    const list = pendingByStage.get(r.stageId);
    if (list) list.push(r);
    else pendingByStage.set(r.stageId, [r]);
  }

  for (const stage of due) {
    if (!stage.dueAt) continue;
    const order = orderById.get(stage.orderId);
    if (!order) continue;
    const pending = pendingByStage.get(stage.id) ?? [];
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
  return { checked: stages.length, sent };
}
