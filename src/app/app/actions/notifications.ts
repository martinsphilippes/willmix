"use server";

import { z } from "zod";
import { requireUser, run, runInPlace, str } from "./helpers";

/*
 * Avisos da lista do portal: qualquer usuário logado exclui os próprios
 * (o serviço só encontra linhas do próprio usuário).
 */

const ID = z.string().min(1).max(64);
const BACK = "/app/notifications";

/** Exclui um aviso; a lista se atualiza no lugar. */
export async function deleteNotificationAction(form: FormData) {
  const user = await requireUser();
  await runInPlace(BACK, async () => {
    const id = ID.parse(str(form, "id"));
    const { deleteInAppNotifications } =
      await import("@/lib/services/notifications");
    await deleteInAppNotifications(user, [id]);
  });
}

/** Exclui todos os avisos do usuário. */
export async function deleteAllNotificationsAction() {
  const user = await requireUser();
  await run(BACK, async () => {
    const { deleteInAppNotifications } =
      await import("@/lib/services/notifications");
    const count = await deleteInAppNotifications(user);
    return `${BACK}?deleted=${count}`;
  });
}

/** Abre um aviso: marca como lido e vai para a tela dele (sem link, volta à lista). */
export async function openNotificationAction(form: FormData) {
  const user = await requireUser();
  await run(BACK, async () => {
    const id = ID.parse(str(form, "id"));
    const { openNotification } =
      await import("@/lib/services/notifications");
    return (await openNotification(user, id)) ?? BACK;
  });
}
