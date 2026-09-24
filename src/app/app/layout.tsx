import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_NAMES } from "@/i18n";
import { LOCALES, type Role } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { WellmixLogo } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { DemoSwitcher } from "@/components/demo-switcher";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/seed";
import { setLocaleAction } from "./actions";
import { dataMode } from "@/lib/env";
import type { DictionaryKey } from "@/i18n/dictionaries";

interface NavItem {
  href: string;
  key: DictionaryKey;
}

function navFor(role: Role, admin: boolean): NavItem[] {
  if (role === "admin" || role === "operator") {
    return [
      { href: "/app", key: "nav.controlTower" },
      { href: "/app/tasks", key: "nav.tasks" },
      { href: "/app/requests", key: "nav.requests" },
      { href: "/app/orders", key: "nav.orders" },
      { href: "/app/parties", key: "nav.parties" },
      { href: "/app/products", key: "nav.products" },
      { href: "/app/lines", key: "nav.lines" },
      { href: "/app/finance", key: "nav.finance" },
      { href: "/app/penalties", key: "nav.penalties" },
      { href: "/app/notifications", key: "nav.notifications" },
      ...(admin
        ? [{ href: "/app/settings", key: "nav.settings" as DictionaryKey }]
        : []),
    ];
  }
  const base: NavItem[] = [
    { href: "/app", key: "nav.tasks" },
    { href: "/app/orders", key: "nav.orders" },
  ];
  if (role === "customer")
    base.splice(1, 0, { href: "/app/requests", key: "nav.requests" });
  if (role === "supplier")
    base.push({ href: "/app/account", key: "nav.account" });
  if (role === "legal")
    base.push({ href: "/app/penalties", key: "nav.penalties" });
  base.push({ href: "/app/notifications", key: "nav.notifications" });
  return base;
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const t = await getT();
  const locale = await getLocale();
  const nav = navFor(user.role, isAdmin(user));
  const showDemo =
    dataMode() === "memory" ||
    process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-600 text-white shadow-md shadow-brand-900/20">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
          <Link
            href="/app"
            className="flex items-center gap-3 rounded-md focus-visible:outline-white"
            aria-label={t("app.name")}
          >
            <WellmixLogo variant="white" className="h-7 sm:h-8" />
            <span className="hidden border-l border-white/30 pl-3 text-sm font-medium leading-tight text-white/90 sm:block">
              Portal
              <span className="block text-xs font-normal text-white/70">
                {t("app.tagline")}
              </span>
            </span>
          </Link>
          {/* Celular: logo e Sair na 1ª linha; idioma e conta demo na 2ª. */}
          <div className="order-last flex w-full items-center justify-between gap-2 text-sm sm:order-none sm:ml-auto sm:w-auto sm:justify-end sm:gap-3">
            <form
              action={setLocaleAction}
              className="flex rounded-lg bg-black/15 p-0.5"
            >
              {LOCALES.map((l) => (
                <button
                  key={l}
                  name="locale"
                  value={l}
                  type="submit"
                  aria-label={LOCALE_NAMES[l]}
                  aria-pressed={l === locale}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold transition focus-visible:outline-white ${l === locale ? "bg-white text-brand-700 shadow-sm" : "text-white/80 hover:text-white"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </form>
            <span
              className="hidden items-center gap-2 md:flex"
              title={t(`role.${user.role}`)}
            >
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-700"
              >
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="leading-tight">
                <span className="block font-medium">{user.name}</span>
                <span className="block text-xs text-white/70">
                  {t(`role.${user.role}`)}
                </span>
              </span>
            </span>
            {showDemo ? (
              <DemoSwitcher
                accounts={DEMO_USERS.map((u) => ({
                  email: u.email,
                  label: `${t(`role.${u.role}`)} · ${u.name}`,
                }))}
                current={user.email}
                password={DEMO_PASSWORD}
                label={t("help.login.demo")}
              />
            ) : null}
          </div>
          <div className="ml-auto sm:ml-0">
            <LogoutButton label={t("nav.logout")} />
          </div>
        </div>
        <div className="mx-auto mt-2 w-full max-w-7xl px-2 sm:px-3">
          <AppNav
            items={nav.map((item) => ({ href: item.href, label: t(item.key) }))}
          />
        </div>
      </header>
      {dataMode() === "memory" && process.env.NODE_ENV === "production" ? (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          Modo demonstração: dados em memória, não persistentes. Configure o
          Appwrite para produção.
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
