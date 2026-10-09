import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Role } from "@/lib/db/schema";

/*
 * Menu principal do portal. A Wellmix tem muitas telas: as quatro do dia a
 * dia ficam à vista e o resto entra em três grupos (Operação, Cadastros,
 * Gestão). Os outros papéis têm poucas telas e veem tudo em linha.
 */

export interface NavLink {
  href: string;
  key: DictionaryKey;
}

export interface NavGroup {
  key: DictionaryKey;
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

export function navFor(role: Role, admin: boolean): NavEntry[] {
  if (role === "admin" || role === "operator") {
    return [
      { href: "/app", key: "nav.controlTower" },
      { href: "/app/tasks", key: "nav.tasks" },
      { href: "/app/requests", key: "nav.requests" },
      { href: "/app/orders", key: "nav.orders" },
      {
        key: "nav.group.operations",
        items: [
          { href: "/app/reviews", key: "nav.reviews" },
          { href: "/app/sourcing", key: "nav.sourcing" },
          { href: "/app/freight", key: "nav.freight" },
          { href: "/app/containers", key: "nav.containers" },
          { href: "/app/notifications", key: "nav.notifications" },
        ],
      },
      {
        key: "nav.group.registry",
        items: [
          { href: "/app/parties", key: "nav.parties" },
          { href: "/app/products", key: "nav.products" },
          { href: "/app/lines", key: "nav.lines" },
        ],
      },
      {
        key: "nav.group.management",
        items: [
          { href: "/app/finance", key: "nav.finance" },
          { href: "/app/penalties", key: "nav.penalties" },
          { href: "/app/after-sales", key: "nav.afterSales" },
          { href: "/app/marketing", key: "nav.marketing" },
          { href: "/app/history", key: "nav.history" },
          ...(admin
            ? [{ href: "/app/settings", key: "nav.settings" as DictionaryKey }]
            : []),
        ],
      },
    ];
  }
  const base: NavLink[] = [
    { href: "/app", key: "nav.tasks" },
    { href: "/app/orders", key: "nav.orders" },
  ];
  if (role === "customer") {
    // Início do cliente é Solicitações; Pendências segue disponível em /app/tasks.
    base.splice(0, 1, { href: "/app/requests", key: "nav.requests" });
    base.splice(1, 0, { href: "/app/tasks", key: "nav.tasks" });
    base.push({ href: "/app/history", key: "nav.history" });
    base.push({ href: "/app/marketing", key: "nav.marketing" });
  }
  if (role === "supplier")
    base.push({ href: "/app/account", key: "nav.account" });
  if (role === "shipping_line")
    base.splice(1, 0, { href: "/app/freight", key: "nav.freight" });
  if (role === "legal")
    base.push({ href: "/app/penalties", key: "nav.penalties" });
  base.push({ href: "/app/notifications", key: "nav.notifications" });
  return base;
}

/** Todos os links, na ordem, sem os grupos (celular e testes). */
export function flattenNav(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((e) => (isNavGroup(e) ? e.items : [e]));
}

/** O link vale para a tela atual? "/app" só na própria página; os demais também nas subpáginas. */
export function isActiveHref(href: string, pathname: string): boolean {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}
