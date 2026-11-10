import { loginLabel } from "@/lib/auth/login-id";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore, type User } from "@/lib/db";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_NAMES, type Translate } from "@/i18n";
import { LOCALES, type Locale } from "@/lib/db/schema";
import { flattenNav, isNavGroup, navFor, type NavLink } from "@/lib/nav";
import { isWellmix } from "@/lib/auth/permissions";
import {
  topicLabel,
  unreadCountFor,
  unreadDigest,
  type UnreadDigest,
} from "@/lib/services/messages";
import { UnreadMessagesBar } from "@/components/unread-messages-bar";
import { AppNav, MobileNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { WellmixLogo } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { DemoSwitcher } from "@/components/demo-switcher";
import { DEMO_PASSWORD, DEMO_USERS, existingDemoAccounts } from "@/lib/seed";
import { demoAccountsEnabled } from "@/lib/demo";
import { setLocaleAction } from "./actions";
import { dataMode } from "@/lib/env";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { ChatDrawer } from "@/components/chat-drawer";
import {
  chatReplyLabels,
  chatUploadLabels,
} from "@/components/chat-upload-labels";
import { SelectOnFocus } from "@/components/select-on-focus";
import { SubmitTracker } from "@/components/field-errors";
import { MissingLive } from "@/components/missing-live";
import { BackButton } from "@/components/back-button";

/** PT / EN / ZH: um toque troca o idioma (Server Action). `dark` para o cabeçalho, claro no painel do celular. */
function LocaleSwitcher({
  locale,
  dark,
  label,
}: {
  locale: Locale;
  dark: boolean;
  label: string;
}) {
  return (
    <form
      action={setLocaleAction}
      aria-label={label}
      className={`inline-flex rounded-lg p-0.5 ${dark ? "bg-black/15" : "bg-zinc-100"}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          type="submit"
          aria-label={LOCALE_NAMES[l]}
          aria-pressed={l === locale}
          className={`rounded-md font-semibold transition ${
            dark
              ? `px-2 py-0.5 text-xs focus-visible:outline-white ${
                  l === locale
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`
              : `px-3 py-1.5 text-sm ${
                  l === locale
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}

/** Sino com as notificações não lidas (link para a caixa de entrada). */
function NotificationsBell({
  unread,
  label,
  unreadLabel,
}: {
  unread: number;
  label: string;
  unreadLabel: string;
}) {
  return (
    <Link
      href="/app/notifications"
      aria-label={unread > 0 ? `${label}: ${unreadLabel}` : label}
      title={label}
      data-notifications-bell={unread}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus-visible:outline-white"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-5 w-5"
      >
        <path d="M6 9a6 6 0 1 1 12 0v4.5l1.6 2.4a.6.6 0 0 1-.5.9H4.9a.6.6 0 0 1-.5-.9L6 13.5V9Z" />
        <path d="M10 19.5a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-none text-brand-700 ring-2 ring-brand-700"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Mensagens no cabeçalho, ao lado do sino: o balão com o número de mensagens
 * não lidas leva direto à conversa (o assunto com novidade abre sozinho).
 */
function MessagesLink({
  unread,
  label,
  unreadLabel,
}: {
  unread: number;
  label: string;
  unreadLabel: string;
}) {
  return (
    <Link
      href="/app/messages"
      aria-label={unread > 0 ? `${label}: ${unreadLabel}` : label}
      title={unread > 0 ? `${label}: ${unreadLabel}` : label}
      data-messages-link={unread}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus-visible:outline-white"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-5 w-5"
      >
        <path d="M4 5h16v11H9l-5 4V5Z" />
      </svg>
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-bold leading-none text-zinc-900 ring-2 ring-brand-700"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/** "09/11 11:29" no idioma da tela (mesmo fuso das outras telas). */
function shortWhen(value: string, intl: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(intl, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
}

/** Faixa de mensagem nova de quem é de fora (null = nada a mostrar). */
function unreadBar(t: Translate, digest: UnreadDigest | null) {
  const latest = digest?.latest;
  if (!digest || !latest || digest.total <= 0) return null;
  const title =
    digest.total > 1
      ? t("messages.bar.many", { n: digest.total })
      : latest.authorSide === "wellmix"
        ? t("messages.notify.fromWellmix")
        : t("messages.bar.new");
  const meta = [
    latest.authorName,
    topicLabel(t, latest.topic),
    shortWhen(latest.createdAt, t.intl),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <UnreadMessagesBar
      count={digest.total}
      title={title}
      meta={meta}
      text={latest.text}
      href={latest.href}
      openLabel={t("messages.bar.open")}
      allLabel={digest.topics > 1 ? t("messages.bar.all") : null}
    />
  );
}

/**
 * Só as contas que existem no banco (um papel novo só entra depois de criado
 * em Configurações). Quem está logado aparece sempre, mesmo sem ser conta de
 * demonstração: o seletor mostra quem é, em vez de "escolher" a primeira.
 */
function demoAccounts(
  t: Translate,
  existing: Set<string>,
  current: { email: string; name: string; role: User["role"] },
) {
  const list = DEMO_USERS.filter((u) => existing.has(u.email)).map((u) => ({
    email: u.email,
    label: `${t(`role.${u.role}`)} · ${u.name}`,
  }));
  if (!list.some((a) => a.email === current.email))
    list.unshift({
      email: current.email,
      label: `${t(`role.${current.role}`)} · ${current.name}`,
    });
  return list;
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const t = await getT();
  const locale = await getLocale();
  // Mensagens não lidas (selo do item "Mensagens" e do balão do cabeçalho);
  // quem é de fora também ganha a faixa com a mais recente. Falha aqui não
  // derruba o portal.
  const digest = isWellmix(user)
    ? null
    : await unreadDigest(user, locale).catch((error: unknown) => {
        console.error("unreadDigest failed", error);
        return null;
      });
  const unreadMessages = digest
    ? digest.total
    : await unreadCountFor(user).catch((error: unknown) => {
        console.error("unreadCountFor failed", error);
        return 0;
      });
  const link = (l: NavLink) => ({
    href: l.href,
    label: t(l.key),
    ...(l.badge === "messages" && unreadMessages > 0
      ? {
          badge: unreadMessages,
          badgeLabel: t("messages.unread", { n: unreadMessages }),
        }
      : {}),
  });
  const nav = navFor(user);
  const entries = nav.map((entry) =>
    isNavGroup(entry)
      ? { label: t(entry.key), items: entry.items.map(link) }
      : link(entry),
  );
  const showDemo = demoAccountsEnabled();
  // Falha aqui não derruba o portal: o seletor só fica sem as contas.
  const demoList = showDemo
    ? demoAccounts(
        t,
        await existingDemoAccounts().catch((error: unknown) => {
          console.error("existingDemoAccounts failed", error);
          return new Set<string>();
        }),
        user,
      )
    : [];
  const roleLabel = t(`role.${user.role}`);
  // Não lidas no sino (até 100: o que a caixa de entrada mostra).
  const unread = (
    await getStore().list("notifications", {
      filter: { userId: user.id, channel: "inapp" },
      orderBy: "createdAt",
      direction: "desc",
      limit: 100,
    })
  ).filter((n) => !n.readAt).length;
  const bell = (
    <NotificationsBell
      unread={unread}
      label={t("nav.notifications")}
      unreadLabel={t("nav.notifications.unread", { n: String(unread) })}
    />
  );
  const hasMessages = flattenNav(nav).some((l) => l.href === "/app/messages");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={null}>
        <NavigationProgress />
        <SelectOnFocus />
        <SubmitTracker />
        <MissingLive />
      </Suspense>
      {/* Cabeçalho em duas faixas: marca e conta em cima; menu embaixo (no
          celular o menu vira um painel aberto pelo botão). */}
      <header className="bg-brand-700 text-white shadow-md shadow-brand-900/20">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
          <Link
            href="/app"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-white"
            aria-label={t("app.name")}
          >
            <WellmixLogo variant="white" className="h-7" />
            <span className="hidden border-l border-white/25 pl-2.5 text-sm font-medium text-white/85 sm:block">
              Portal
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <LocaleSwitcher locale={locale} dark label={t("nav.language")} />
            </div>
            {showDemo ? (
              <div className="hidden md:block">
                <DemoSwitcher
                  accounts={demoList}
                  current={user.email}
                  password={DEMO_PASSWORD}
                  label={t("nav.demo")}
                  errors={{
                    missing: t("demo.switch.missing"),
                    failed: t("demo.switch.failed"),
                  }}
                />
              </div>
            ) : null}
            {hasMessages ? (
              <MessagesLink
                unread={unreadMessages}
                label={t("nav.messages")}
                unreadLabel={t("messages.unread", { n: unreadMessages })}
              />
            ) : null}
            {bell}
            <div className="hidden md:block">
              <UserMenu
                name={user.name}
                role={roleLabel}
                email={loginLabel(user.email)}
                label={t("nav.user")}
              >
                <LogoutButton label={t("nav.logout")} variant="light" />
              </UserMenu>
            </div>
            <div className="md:hidden">
              <MobileNav
                entries={entries}
                labels={{
                  open: t("nav.menu"),
                  close: t("nav.menu.close"),
                  main: t("nav.main"),
                }}
                extras={
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
                      >
                        {user.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-sm font-semibold">
                          {user.name}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {roleLabel}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <LocaleSwitcher
                        locale={locale}
                        dark={false}
                        label={t("nav.language")}
                      />
                      {showDemo ? (
                        <DemoSwitcher
                          accounts={demoList}
                          current={user.email}
                          password={DEMO_PASSWORD}
                          label={t("nav.demo")}
                          variant="light"
                          errors={{
                            missing: t("demo.switch.missing"),
                            failed: t("demo.switch.failed"),
                          }}
                        />
                      ) : null}
                    </div>
                    <LogoutButton label={t("nav.logout")} variant="light" />
                  </>
                }
              />
            </div>
          </div>
        </div>
        <div className="hidden border-t border-white/10 bg-black/10 md:block">
          <div className="mx-auto w-full max-w-7xl px-2">
            <AppNav entries={entries} label={t("nav.main")} />
          </div>
        </div>
      </header>
      {unreadBar(t, digest)}
      {dataMode() === "memory" && process.env.NODE_ENV === "production" ? (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          {t("app.demoBanner")}
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        {/* "Voltar" em todas as telas: para a tela anterior desta aba. */}
        <Suspense fallback={null}>
          <BackButton
            label={t("common.back")}
            menu={flattenNav(nav).map((l) => l.href)}
          />
        </Suspense>
        {children}
      </main>
      {/* Painel lateral de chat: abre de qualquer linha com o ícone de conversa. */}
      <ChatDrawer
        labels={{
          title: t("chat.title"),
          with: t("chat.with"),
          about: t("chat.about"),
          wholeOrder: t("chat.whole.order"),
          wholeRequest: t("chat.whole.request"),
          openFull: t("chat.openFull"),
          close: t("chat.close"),
          loading: t("chat.loading"),
          noParticipants: t("chat.noParticipants"),
          error: t("chat.error"),
          attachHint: t("chat.attachHint"),
          send: t("messages.send"),
          sending: t("messages.sending"),
          placeholder: t("messages.body.placeholder"),
          you: t("messages.you"),
          wellmix: t("messages.side.wellmix"),
          empty: t("messages.empty.thread"),
          intl: t.intl,
          attach: chatUploadLabels(t),
          reply: chatReplyLabels(t),
          videoDownload: t("messages.video.download"),
        }}
      />
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <WellmixLogo className="h-5" />
            <span>
              {t("app.name")} · {t("app.tagline")}
            </span>
          </div>
          <span>© Wellmix</span>
        </div>
      </footer>
    </div>
  );
}
