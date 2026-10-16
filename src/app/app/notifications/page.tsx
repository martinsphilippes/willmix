import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  Empty,
  PageHeader,
  TextLink,
  cx,
} from "@/components/ui";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";
import { markNotificationsReadAction } from "../actions";
import {
  deleteAllNotificationsAction,
  deleteNotificationAction,
} from "../actions/notifications";

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/app/notifications">) {
  const { deleted, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const items = await getStore().list("notifications", {
    filter: { userId: user.id, channel: "inapp" },
    orderBy: "createdAt",
    direction: "desc",
    limit: 100,
  });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        help={{ body: "help.notifications.body" }}
        t={t}
        title={t("notifications.title")}
        actions={
          items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {unread > 0 ? (
                <form action={markNotificationsReadAction}>
                  <SubmitButton
                    variant="secondary"
                    title={t("notifications.markAllRead")}
                    aria-label={`${t("notifications.markAllRead")} (${unread})`}
                  >
                    ✓ {unread}
                  </SubmitButton>
                </form>
              ) : null}
              <form action={deleteAllNotificationsAction}>
                <SubmitButton
                  variant="secondary"
                  confirmText={t("notifications.deleteAllConfirm")}
                  data-notifications-delete-all
                  className="text-red-700"
                >
                  {t("notifications.deleteAll")}
                </SubmitButton>
              </form>
            </div>
          ) : null
        }
      />
      {typeof error === "string" && error ? (
        <div className="mb-3">
          <Alert tone="danger">{fallbackError(t, error)}</Alert>
        </div>
      ) : null}
      {typeof deleted === "string" && /^\d+$/.test(deleted) ? (
        <div className="mb-3">
          <Alert tone="success">
            {t("notifications.deleted", { n: deleted })}
          </Alert>
        </div>
      ) : null}
      {items.length === 0 ? (
        <Empty>{t("notifications.empty")}</Empty>
      ) : (
        /* Duas colunas em telas grandes (mais recentes primeiro, linha a linha). */
        <ul className="grid items-start gap-2 lg:grid-cols-2">
          {items.map((n) => (
            <li key={n.id} className="min-w-0">
              <Card
                className={cx(
                  "border-l-4 p-3 sm:p-3",
                  n.readAt
                    ? "border-l-zinc-200 bg-zinc-50"
                    : "border-l-brand-600",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        n.readAt
                          ? "font-medium text-zinc-700"
                          : "font-semibold text-zinc-900"
                      }
                    >
                      {n.subject}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-600">{n.body}</p>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {new Date(n.createdAt).toLocaleString(t.intl)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!n.readAt ? <Badge tone="brand">•</Badge> : null}
                    {n.link ? (
                      <TextLink href={n.link} className="text-sm">
                        {t("tasks.open")}
                      </TextLink>
                    ) : null}
                    <form action={deleteNotificationAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <SubmitTextButton
                        aria-label={t("notifications.deleteOne")}
                        title={t("notifications.deleteOne")}
                        data-notification-delete={n.id}
                        className="text-sm text-zinc-500 no-underline hover:text-red-700"
                      >
                        {t("notifications.delete")}
                      </SubmitTextButton>
                    </form>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
