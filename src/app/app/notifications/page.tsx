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
  Empty,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  rowClass,
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
 * quem está). Cada bloco é uma tabela de linhas finas, como as outras telas:
 * tipo, aviso, com quem está o assunto, quando, e os botões Resolver/Abrir
 * (leva direto ao lugar e marca como lido) e Excluir. Aviso resolvido (lido)
 * sai da lista; "Mostrar as lidas" (?read=1) traz de volta.
 */

const KIND_BADGE: Record<NotificationKind, Tone> = {
  action: "brand",
  alert: "danger",
  info: "info",
  done: "success",
};

const GROUP_DOT: Record<NotificationGroup, string> = {
  action: "bg-brand-600",
  alert: "bg-red-600",
  news: "bg-sky-500",
};

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/app/notifications">) {
  const { deleted, error, read } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const showRead = read === "1";
  const items = await getStore().list("notifications", {
    filter: { userId: user.id, channel: "inapp" },
    orderBy: "createdAt",
    direction: "desc",
    limit: 100,
  });
  const unread = items.filter((n) => !n.readAt).length;
  const readCount = items.length - unread;
  // Resolvido (lido) sai da lista; a pedido, volta com ?read=1.
  const visible = showRead ? items : items.filter((n) => !n.readAt);
  const groups = new Map<NotificationGroup, Notification[]>();
  for (const n of visible) {
    const group = notificationGroup(notificationKind(n));
    groups.set(group, [...(groups.get(group) ?? []), n]);
  }
  const waiting = items.filter(
    (n) => !n.readAt && notificationGroup(notificationKind(n)) === "action",
  ).length;
  const readToggle =
    readCount > 0 ? (
      showRead ? (
        <TextLink href="/app/notifications" data-notifications-hide-read>
          {t("notif.hideRead")}
        </TextLink>
      ) : (
        <TextLink href="/app/notifications?read=1" data-notifications-show-read>
          {t("notif.showRead", { n: readCount })}
        </TextLink>
      )
    ) : null;

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
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>{t("notif.readHidden")}</span>
            {readToggle}
          </p>
          {visible.length === 0 ? (
            <Empty>
              <span data-notifications-only-read>
                {t("notif.onlyRead", { n: readCount })}
              </span>
            </Empty>
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
                        className={cx(
                          "h-2.5 w-2.5 rounded-full",
                          GROUP_DOT[group],
                        )}
                      />
                      {t(`notif.section.${group}`)}
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                        {list.length}
                      </span>
                    </h2>
                    <NotificationRows list={list} t={t} />
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Um bloco de avisos em linhas finas (mais recentes primeiro). */
function NotificationRows({ list, t }: { list: Notification[]; t: Translate }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("notif.col.kind")}</Th>
          <Th>{t("notif.col.subject")}</Th>
          <Th>{t("notif.col.with")}</Th>
          <Th>{t("notif.col.when")}</Th>
          <Th className="text-right">
            <span className="sr-only">{t("tasks.open")}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {list.map((n) => (
          <NotificationRow key={n.id} n={n} t={t} />
        ))}
      </tbody>
    </Table>
  );
}

function NotificationRow({ n, t }: { n: Notification; t: Translate }) {
  const kind = notificationKind(n);
  const actor = notificationActor(n);
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
  const subject = displaySubject(n, t);
  return (
    <tr
      className={cx(rowClass, read && "bg-zinc-50/70")}
      data-notification={n.id}
      data-notification-kind={kind}
      data-notification-actor={actor ?? ""}
      data-notification-read={read ? "1" : "0"}
    >
      <Td className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <Badge tone={read ? "neutral" : KIND_BADGE[kind]}>
            {t(`notif.kind.${kind}`)}
          </Badge>
          {!read ? (
            <span
              role="img"
              aria-label={t("notif.unread")}
              className="h-2 w-2 rounded-full bg-brand-600"
            />
          ) : null}
        </span>
      </Td>
      <Td className="min-w-56">
        <p
          className={cx(
            read ? "font-medium text-zinc-700" : "font-semibold text-zinc-900",
          )}
        >
          {subject}
        </p>
        {n.body ? (
          <p className="mt-0.5 whitespace-pre-line text-xs text-zinc-600">
            {n.body}
          </p>
        ) : null}
      </Td>
      <Td
        className={cx(
          "whitespace-nowrap text-xs font-semibold",
          mine && !read ? "text-brand-700" : "text-zinc-600",
        )}
      >
        {actorText ?? "—"}
      </Td>
      <Td className="whitespace-nowrap text-xs tabular-nums text-zinc-500">
        <time dateTime={n.createdAt}>
          {new Date(n.createdAt).toLocaleString(t.intl, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </time>
      </Td>
      <Td className="whitespace-nowrap text-right">
        <div className="inline-flex items-center justify-end gap-1">
          {n.link ? (
            <form action={openNotificationAction}>
              <input type="hidden" name="id" value={n.id} />
              <SubmitButton
                variant={mine && !read ? "primary" : "secondary"}
                className="min-h-8 px-3 py-1 text-xs"
                data-notification-open={n.id}
              >
                {mine ? t("notif.open.action") : t("tasks.open")}
                <span className="sr-only">: {subject}</span>
              </SubmitButton>
            </form>
          ) : null}
          <form action={deleteNotificationAction}>
            <input type="hidden" name="id" value={n.id} />
            <SubmitTextButton
              aria-label={`${t("notifications.deleteOne")}: ${subject}`}
              title={t("notifications.deleteOne")}
              data-notification-delete={n.id}
              className="px-2 py-1 text-xs text-zinc-500 no-underline hover:text-red-700"
            >
              {t("notifications.delete")}
            </SubmitTextButton>
          </form>
        </div>
      </Td>
    </tr>
  );
}
