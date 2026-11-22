import "server-only";

import { getStore, type Request } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { getSettings } from "@/lib/settings";
import { confirmReminderStep } from "@/lib/confirm-reminders";
import type { ConfirmReminders } from "@/lib/order-terms";
import { audit } from "./audit";
import { notify, type NotifyMessage } from "./notifications";
import { customerConfirmUserIds } from "./requests";

/*
 * Lembrete da confirmação do cliente (dono, 22/11/2026; docs/ORDER_TERMS.md,
 * "Lembrete da confirmação"). No job diário (/api/jobs/reminders): cada
 * encomenda (o lote inteiro, um aviso só) que espera o cliente há pelo menos
 * um dia recebe um lembrete por dia, para o mesmo login do aviso inicial
 * (o login com acesso ou, sem ele, todos os logins ativos do cliente), até
 * o limite das Configurações. Com o último, o vendedor que lançou a
 * encomenda é avisado uma vez (sem ele ativo, o administrador). A contagem
 * fica em `orderTerms.confirmReminders` de cada solicitação do lote; a
 * edição da encomenda refaz as condições e zera a contagem.
 */

const batchKey = (r: Pick<Request, "groupId" | "id">) =>
  r.groupId ? `g:${r.groupId}` : `r:${r.id}`;

export async function remindCustomerConfirmations(
  now = new Date(),
): Promise<{ reminded: number; sellers: number }> {
  const store = getStore();
  const max = (await getSettings()).customerConfirmReminderMax;
  if (!(max > 0)) return { reminded: 0, sellers: 0 };
  const waiting = await store.list("requests", {
    filter: { status: "AWAITING_CUSTOMER" },
    orderBy: "createdAt",
  });
  const batches = new Map<string, Request[]>();
  for (const r of waiting)
    batches.set(batchKey(r), [...(batches.get(batchKey(r)) ?? []), r]);
  const customers = await listByIds(store, "parties", [
    ...new Set(waiting.map((r) => r.customerId)),
  ]);
  let reminded = 0;
  let sellers = 0;
  for (const batch of batches.values()) {
    const first = batch[0];
    if (!first.orderTerms) continue;
    const reminders = first.orderTerms.confirmReminders ?? null;
    const sentAt = batch.reduce(
      (min, r) => (r.createdAt < min ? r.createdAt : min),
      first.createdAt,
    );
    const step = confirmReminderStep({ sentAt, reminders, max, now });
    if (step !== "remind" && step !== "remind_last") continue;
    const count = (reminders?.count ?? 0) + 1;
    const values = {
      n: first.number ?? "—",
      count,
      max,
      products: batch.length,
      customer: customers.find((c) => c.id === first.customerId)?.name ?? "—",
    };
    const userIds = await customerConfirmUserIds(first);
    const delivered = userIds.length
      ? ((await notify(
          { userIds },
          {
            kind: "action",
            link: `/app/requests/${first.id}`,
            text: (t) => ({
              subject: t("confirmReminder.notify.subject", values),
              body: t(
                step === "remind_last"
                  ? "confirmReminder.notify.bodyLast"
                  : "confirmReminder.notify.body",
                values,
              ),
            }),
          },
        )) ?? 0)
      : 0;
    // Sem login ativo do cliente não há quem lembrar (o administrador já tem
    // "Login do cliente a definir"): a contagem não anda.
    if (!delivered) continue;
    reminded++;
    let sellerNotifiedAt = reminders?.sellerNotifiedAt ?? null;
    if (step === "remind_last" && !sellerNotifiedAt) {
      const message: NotifyMessage = {
        kind: "action",
        link: `/app/requests/${first.id}`,
        text: (t) => ({
          subject: t("confirmReminder.seller.subject", values),
          body: t("confirmReminder.seller.body", values),
        }),
      };
      const toSeller = await notify(
        { userIds: [first.createdByUserId] },
        message,
      );
      if (!toSeller) await notify({ role: "admin" }, message);
      sellerNotifiedAt = now.toISOString();
      sellers++;
    }
    const state: ConfirmReminders = {
      count,
      lastAt: now.toISOString(),
      sellerNotifiedAt,
    };
    for (const r of batch)
      await store.update("requests", r.id, {
        orderTerms: {
          ...(r.orderTerms ?? first.orderTerms),
          confirmReminders: state,
        },
      });
    await audit(
      null,
      "request.confirm_reminder",
      "request",
      first.id,
      `Lembrete ${count} de ${max} ao cliente para confirmar a encomenda nº ${first.number ?? "—"}${step === "remind_last" ? " (o último; o vendedor foi avisado)" : ""}`,
    );
  }
  return { reminded, sellers };
}
