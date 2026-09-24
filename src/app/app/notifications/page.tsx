import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { Badge, Card, Empty, PageHeader, TextLink, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { markNotificationsReadAction } from "../actions";

export default async function NotificationsPage() {
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
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <SubmitButton variant="secondary">✓ {unread}</SubmitButton>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <Empty>{t("notifications.empty")}</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card
                className={cx(
                  "border-l-4",
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
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!n.readAt ? <Badge tone="brand">•</Badge> : null}
                    {n.link ? (
                      <TextLink href={n.link} className="text-sm">
                        {t("tasks.open")}
                      </TextLink>
                    ) : null}
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
