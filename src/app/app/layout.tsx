import { loginLabel } from "@/lib/auth/login-id";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getLocale, getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import {
  flattenNav,
  isNavGroup,
  navFooterFor,
  navFor,
  sidebarNav,
  type NavLink,
} from "@/lib/nav";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { partnerTypeLabelOf } from "@/lib/services/partner-access";
import {
  topicLabel,
  unreadCountFor,
  unreadDigest,
  type UnreadDigest,
} from "@/lib/services/messages";
import { UnreadMessagesBar } from "@/components/unread-messages-bar";
import { AppSidebar, MobileNav } from "@/components/app-nav";
import { WellmixLogo } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { PasswordChangeCard } from "@/components/password-change-card";
import { DemoSwitcher } from "@/components/demo-switcher";
import { DEMO_PASSWORD, DEMO_USERS, existingDemoAccounts } from "@/lib/seed";
import { demoAccountsEnabled } from "@/lib/demo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { dataMode } from "@/lib/env";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { ChatDrawer } from "@/components/chat-drawer";
import { ChatAccess } from "@/components/chat-access";
import {
  chatReplyLabels,
  chatUploadLabels,
} from "@/components/chat-upload-labels";
import { SelectOnFocus } from "@/components/select-on-focus";
import { SubmitTracker } from "@/components/field-errors";
import { MissingLive } from "@/components/missing-live";
import { BackButton } from "@/components/back-button";

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
  current: { email: string; name: string },
  /** O rótulo de quem está logado (o papel ou o tipo do parceiro). */
  currentLabel: string,
) {
  const list = DEMO_USERS.filter((u) => existing.has(u.email)).map((u) => ({
    email: u.email,
    label: `${t(`role.${u.role}`)} · ${u.name}`,
  }));
  if (!list.some((a) => a.email === current.email))
    list.unshift({
      email: current.email,
      label: `${currentLabel} · ${current.name}`,
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
  // Sem a tela Mensagens no perfil (Gestão de telas), o cabeçalho não traz
  // mensagens: nem a faixa da mais recente, nem os ícones e o painel de chat.
  const seesMessages = canOpen(user, "messages");
  const digest =
    isWellmix(user) || !seesMessages
      ? null
      : await unreadDigest(user, locale).catch((error: unknown) => {
          console.error("unreadDigest failed", error);
          return null;
        });
  const unreadMessages = digest
    ? digest.total
    : !seesMessages
      ? 0
      : await unreadCountFor(user).catch((error: unknown) => {
          console.error("unreadCountFor failed", error);
          return 0;
        });
  // Não lidas no sino (até 100: o que a caixa de entrada mostra). Sem a tela
  // Notificações no perfil, o sino não aparece (ele levaria a uma tela negada).
  const seesNotifications = canOpen(user, "notifications");
  const unread = seesNotifications
    ? (
        await getStore().list("notifications", {
          filter: { userId: user.id, channel: "inapp" },
          orderBy: "createdAt",
          direction: "desc",
          limit: 100,
        })
      ).filter((n) => !n.readAt).length
    : 0;
  const badgeOf = (l: NavLink) =>
    l.badge === "messages" && unreadMessages > 0
      ? {
          badge: unreadMessages,
          badgeLabel: t("messages.unread", { n: unreadMessages }),
        }
      : l.badge === "notifications" && unread > 0
        ? {
            badge: unread,
            badgeLabel: t("nav.notifications.unread", { n: String(unread) }),
          }
        : {};
  const link = (l: NavLink) => ({
    href: l.href,
    label: t(l.key),
    ...(l.icon ? { icon: l.icon } : {}),
    ...badgeOf(l),
  });
  const nav = navFor(user);
  // Barra lateral e menu do celular sem Mensagens e Notificações (só nos
  // ícones do cabeçalho; dono, 14/11/2026). O cabeçalho e o "Voltar" seguem
  // a lista inteira (nav).
  const entries = sidebarNav(nav).map((entry) =>
    isNavGroup(entry)
      ? {
          id: entry.key,
          label: t(entry.key),
          icon: entry.icon,
          items: entry.items.map(link),
          // Item pai (ex.: Produção): o nome abre a tela; a seta, os subitens.
          ...(entry.href
            ? {
                href: entry.href,
                toggle: {
                  show: t("nav.group.show", { name: t(entry.key) }),
                  hide: t("nav.group.hide", { name: t(entry.key) }),
                },
              }
            : {}),
        }
      : link(entry),
  );
  const footerNav = navFooterFor(user);
  const footerLinks = footerNav.map(link);
  const menuHrefs = [...flattenNav(nav), ...footerNav].map((l) => l.href);
  const showDemo = demoAccountsEnabled();
  // Embaixo do nome: o papel; nos logins de Trading, Factory, Supplier, GP e
  // tipos criados no painel (que entram como o Fornecedor), o nome do tipo.
  const roleLabel =
    (await partnerTypeLabelOf(user, t.locale).catch((error: unknown) => {
      console.error("partnerTypeLabelOf failed", error);
      return null;
    })) ?? t(`role.${user.role}`);
  // Falha aqui não derruba o portal: o seletor só fica sem as contas.
  const demoList = showDemo
    ? demoAccounts(
        t,
        await existingDemoAccounts().catch((error: unknown) => {
          console.error("existingDemoAccounts failed", error);
          return new Set<string>();
        }),
        user,
        roleLabel,
      )
    : [];
  const bell = seesNotifications ? (
    <NotificationsBell
      unread={unread}
      label={t("nav.notifications")}
      unreadLabel={t("nav.notifications.unread", { n: String(unread) })}
    />
  ) : null;
  const hasMessages = flattenNav(nav).some((l) => l.href === "/app/messages");

  // Cartão da conta no pé da barra lateral: senha e Sair.
  const account = (
    <>
      <Link
        href="/app/password"
        className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        data-password-link
      >
        {t("password.menu")}
      </Link>
      <LogoutButton label={t("nav.logout")} variant="light" />
    </>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={null}>
        <NavigationProgress />
        <SelectOnFocus />
        <SubmitTracker />
        <MissingLive />
      </Suspense>
      {/* Cabeçalho numa faixa só (marca, idioma, demo, mensagens e sino),
          fixo no alto em todas as telas; o menu fica na barra lateral (no
          celular, no painel aberto pelo botão). A altura fica em --wm-header
          (globals.css), usada pela barra lateral, pelos painéis laterais
          fixos e pelos saltos para uma seção. */}
      <header
        className="sticky top-0 z-40 bg-brand-700 text-white shadow-md shadow-brand-900/20 print:static"
        data-app-header
      >
        <div className="flex h-14 w-full items-center gap-3 px-4">
          <div className="md:hidden">
            <MobileNav
              entries={entries}
              footer={footerLinks}
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
                  <Link
                    href="/app/password"
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                    data-password-link
                  >
                    {t("password.menu")}
                  </Link>
                  <LogoutButton label={t("nav.logout")} variant="light" />
                </>
              }
            />
          </div>
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
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <AppSidebar
          entries={entries}
          footer={footerLinks}
          labels={{
            main: t("nav.main"),
            collapse: t("nav.sidebar.collapse"),
            expand: t("nav.sidebar.expand"),
          }}
          account={{
            name: user.name,
            role: roleLabel,
            email: loginLabel(user.email),
            label: t("nav.user"),
            menu: account,
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {unreadBar(t, digest)}
          {dataMode() === "memory" && process.env.NODE_ENV === "production" ? (
            <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
              {t("app.demoBanner")}
            </div>
          ) : null}
          <main className="mx-auto w-full portal-wide flex-1 px-4 py-6 sm:py-8 lg:px-6">
            {/* "Voltar" em todas as telas: para a tela anterior desta aba. */}
            <Suspense fallback={null}>
              <BackButton label={t("common.back")} menu={menuHrefs} />
            </Suspense>
            {/* Senha provisória: antes da troca, nenhuma tela abre. */}
            {user.mustChangePassword ? (
              <PasswordChangeCard t={t} firstAccess />
            ) : (
              <ChatAccess enabled={seesMessages}>{children}</ChatAccess>
            )}
          </main>
          <footer className="border-t border-zinc-200 bg-white">
            <div className="mx-auto flex w-full portal-wide flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-zinc-500">
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
      </div>
      {/* Painel lateral de chat: abre de qualquer linha com o ícone de conversa. */}
      {seesMessages ? (
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
      ) : null}
    </div>
  );
}
