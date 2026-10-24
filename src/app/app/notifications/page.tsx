import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore, type Notification, type NotificationKind } from "@/lib/db";
import {
  NOTIFICATION_GROUPS,
  displaySubject,
  notificationActor,
  notificationGroup,
  notificationKind,
  type NotificationGroup,
} from "@/lib/notification-view";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  Empty,
  PageHeader,
  cx,
  type Tone,
} from "@/components/ui";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";
import { markNotificationsReadAction } from "../actions";
import {
  deleteAllNotificationsAction,
  deleteNotificationAction,
  openNotificationAction,
} from "../actions/notifications";

/*
 * Caixa de avisos em três blocos: "Precisa de você" (sua vez de agir),
 * "Atenção" (atraso, problema, cancelamento) e "Novidades" (o que andou e com
 * quem está). Cada cartão diz o tipo, com quem está o assunto agora e tem o
 * botão que leva direto ao lugar (e marca o aviso como lido).
 */

/** Cor por tipo: borda do cartão (não lido / lido) e selo. */
const KIND_STYLE: Record<
  NotificationKind,
  { border: string; read: string; badge: Tone }
> = {
  action: {
    border: "border-l-brand-600",
    read: "border-l-brand-200",
    badge: "brand",
  },
  alert: { border: "border-l-red-600", read: "border-l-red-200", badge: "danger" },
  info: { border: "border-l-sky-500", read: "border-l-zinc-200", badge: "info" },
  done: {
    border: "border-l-emerald-500",
    read: "border-l-zinc-200",
    badge: "success",
  },
};

const GROUP_DOT: Record<NotificationGroup, string> = {
  action: "bg-brand-600",
  alert: "bg-red-600",
  news: "bg-sky-500",
};

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
  const groups = new Map<NotificationGroup, Notification[]>();
  for (const n of items) {
    const group = notificationGroup(notificationKind(n));
    groups.set(group, [...(groups.get(group) ?? []), n]);
  }
  const waiting = (groups.get("action") ?? []).filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        help={{ body: "help.notifications.body" }}
        t={t}
        title={t("notifications.title")}
        subtitle={
          items.length === 0
            ? undefined
            : waiting > 0
              ? t("notif.summary.action", { n: waiting })
              : t("notif.summary.clear")
        }
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
        <div className="space-y-6">
          {NOTIFICATION_GROUPS.map((group) => {
            const list = groups.get(group);
            if (!list?.length) return null;
            return (
              <section
                key={group}
                aria-labelledby={`notif-${group}`}
                data-notification-group={group}
              >
                <h2
                  id={`notif-${group}`}
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800"
                >
                  <span
                    aria-hidden
                    className={cx("h-2.5 w-2.5 rounded-full", GROUP_DOT[group])}
                  />
                  {t(`notif.section.${group}`)}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                    {list.length}
                  </span>
                </h2>
                {/* Duas colunas em telas grandes (mais recentes primeiro, linha a linha). */}
                <ul className="grid items-start gap-2 lg:grid-cols-2">
                  {list.map((n) => (
                    <NotificationItem key={n.id} n={n} t={t} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function NotificationItem({ n, t }: { n: Notification; t: Translate }) {
  const kind = notificationKind(n);
  const actor = notificationActor(n);
  const style = KIND_STYLE[kind];
  const read = !!n.readAt;
  // Está com quem lê: o botão diz "Resolver" (e fica em destaque até abrir).
  const mine = actor === "recipient";
  const actorText =
    actor === "recipient"
      ? t("notif.actor.you")
      : actor === "wellmix"
        ? t("notif.actor.wellmix")
        : actor
          ? t("notif.actor.role", {
              role: t(`role.${actor}` as DictionaryKey),
            })
          : null;
  return (
    <li
      className="min-w-0"
      data-notification={n.id}
      data-notification-kind={kind}
      data-notification-actor={actor ?? ""}
    >
      <Card
        className={cx(
          "border-l-4 p-3 sm:p-3",
          read ? cx(style.read, "bg-zinc-50") : style.border,
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={read ? "neutral" : style.badge}>
            {t(`notif.kind.${kind}`)}
          </Badge>
          {!read ? (
            <span
              role="img"
              aria-label={t("notif.unread")}
              className="h-2 w-2 rounded-full bg-brand-600"
            />
          ) : null}
          <time
            dateTime={n.createdAt}
            className="ml-auto text-xs text-zinc-500"
          >
            {new Date(n.createdAt).toLocaleString(t.intl, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
        </div>
        <p
          className={cx(
            "mt-1.5",
            read ? "font-medium text-zinc-700" : "font-semibold text-zinc-900",
          )}
        >
          {displaySubject(n, t)}
        </p>
        <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-600">
          {n.body}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {actorText ? (
            <p
              className={cx(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                actor === "recipient" && !read
                  ? "text-brand-700"
                  : "text-zinc-600",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
              {actorText}
            </p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            {n.link ? (
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <SubmitButton
                  variant={mine && !read ? "primary" : "secondary"}
                  className="px-3 py-1 text-xs"
                  data-notification-open={n.id}
                >
                  {mine ? t("notif.open.action") : t("tasks.open")}
                </SubmitButton>
              </form>
            ) : null}
            <form action={deleteNotificationAction}>
              <input type="hidden" name="id" value={n.id} />
              <SubmitTextButton
                aria-label={t("notifications.deleteOne")}
                title={t("notifications.deleteOne")}
                data-notification-delete={n.id}
                className="px-2 py-1 text-xs text-zinc-500 no-underline hover:text-red-700"
              >
                {t("notifications.delete")}
              </SubmitTextButton>
            </form>
          </div>
        </div>
      </Card>
    </li>
  );
}
