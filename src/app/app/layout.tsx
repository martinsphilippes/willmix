import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_NAMES } from "@/i18n";
import { LOCALES, type Role } from "@/lib/db/schema";
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
    <div className="flex min-h-full flex-col">
      <header className="bg-zinc-900 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/app" className="text-lg font-semibold tracking-tight">
            {t("app.name")}
          </Link>
          <nav className="order-last flex w-full gap-1 overflow-x-auto pb-1 text-sm sm:order-none sm:w-auto sm:flex-1 sm:pb-0">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <form action={setLocaleAction} className="flex gap-1">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  name="locale"
                  value={l}
                  type="submit"
                  aria-label={LOCALE_NAMES[l]}
                  className={`rounded px-1.5 py-0.5 text-xs ${l === locale ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </form>
            <span
              className="hidden text-zinc-300 sm:inline"
              title={t(`role.${user.role}`)}
            >
              {user.name}
              {isWellmix(user) ? "" : ` · ${t(`role.${user.role}`)}`}
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
            <LogoutButton label={t("nav.logout")} />
          </div>
        </div>
      </header>
      {dataMode() === "memory" && process.env.NODE_ENV === "production" ? (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          Modo demonstração: dados em memória, não persistentes. Configure o
          Appwrite para produção.
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
