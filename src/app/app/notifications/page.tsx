import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
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
              <Card className={n.readAt ? "opacity-70" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{n.subject}</p>
                    <p className="text-sm text-zinc-600">{n.body}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!n.readAt ? <Badge tone="info">•</Badge> : null}
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="text-sm font-medium underline"
                      >
                        {t("tasks.open")}
                      </Link>
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
