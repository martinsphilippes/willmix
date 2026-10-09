import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_NAMES, type Translate } from "@/i18n";
import { LOCALES, type Locale } from "@/lib/db/schema";
import { isNavGroup, navFor } from "@/lib/nav";
import { AppNav, MobileNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { WellmixLogo } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { DemoSwitcher } from "@/components/demo-switcher";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/seed";
import { setLocaleAction } from "./actions";
import { dataMode } from "@/lib/env";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { SelectOnFocus } from "@/components/select-on-focus";

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

function demoAccounts(t: Translate) {
  return DEMO_USERS.map((u) => ({
    email: u.email,
    label: `${t(`role.${u.role}`)} · ${u.name}`,
  }));
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const t = await getT();
  const locale = await getLocale();
  const entries = navFor(user.role, isAdmin(user)).map((entry) =>
    isNavGroup(entry)
      ? {
          label: t(entry.key),
          items: entry.items.map((i) => ({ href: i.href, label: t(i.key) })),
        }
      : { href: entry.href, label: t(entry.key) },
  );
  const showDemo =
    dataMode() === "memory" ||
    process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1";
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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={null}>
        <NavigationProgress />
        <SelectOnFocus />
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
                  accounts={demoAccounts(t)}
                  current={user.email}
                  password={DEMO_PASSWORD}
                  label={t("nav.demo")}
                />
              </div>
            ) : null}
            {bell}
            <div className="hidden md:block">
              <UserMenu
                name={user.name}
                role={roleLabel}
                email={user.email}
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
                          accounts={demoAccounts(t)}
                          current={user.email}
                          password={DEMO_PASSWORD}
                          label={t("nav.demo")}
                          variant="light"
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
      {dataMode() === "memory" && process.env.NODE_ENV === "production" ? (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          {t("app.demoBanner")}
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
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
