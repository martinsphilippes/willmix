import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Role } from "@/lib/db/schema";

/*
 * Menu principal do portal. A Wellmix tem muitas telas: tudo fica em quatro
 * grupos (Início, Pedidos, Cadastros, Gestão), sem links soltos na barra; a
 * logo continua levando ao Control Tower. Cliente, fornecedores e parceiros
 * também veem dois grupos (Início, Pedidos); o cliente vê a vitrine
 * (Explorar) e "Meus pedidos". A logo leva ao início de cada um. Grupo com
 * uma tela só vira link direto (sem lista de um item).
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

/** Grupo do menu; com uma tela só, vira o próprio link. */
function group(key: DictionaryKey, items: NavLink[]): NavEntry {
  return items.length === 1 ? items[0] : { key, items };
}

export function navFor(role: Role, admin: boolean): NavEntry[] {
  if (role === "admin" || role === "operator") {
    return [
      {
        key: "nav.group.home",
        items: [
          { href: "/app", key: "nav.controlTower" },
          { href: "/app/tasks", key: "nav.tasks" },
          { href: "/app/notifications", key: "nav.notifications" },
        ],
      },
      {
        // Do pedido do cliente à entrega: comercial e operação juntos.
        key: "nav.group.orders",
        items: [
          { href: "/app/requests", key: "nav.requests" },
          { href: "/app/orders", key: "nav.orders" },
          { href: "/app/sourcing", key: "nav.sourcing" },
          { href: "/app/reviews", key: "nav.reviews" },
          { href: "/app/freight", key: "nav.freight" },
          { href: "/app/freight/tariff", key: "nav.freightTariff" },
          { href: "/app/containers", key: "nav.containers" },
        ],
      },
      {
        key: "nav.group.registry",
        items: [
          { href: "/app/parties", key: "nav.parties" },
          { href: "/app/products", key: "nav.products" },
          { href: "/app/lines", key: "nav.lines" },
          // A vitrine como o cliente vê (preço estimado, o que falta no cadastro).
          { href: "/app/explore", key: "nav.explorePreview" },
        ],
      },
      {
        key: "nav.group.management",
        items: [
          { href: "/app/finance", key: "nav.finance" },
          { href: "/app/payables", key: "nav.payables" },
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
  if (role === "customer")
    // Início do cliente é a vitrine (Explorar); o resto (orçamentos, pedidos,
    // pendências) fica num grupo só, "Meus pedidos".
    return [
      { href: "/app/explore", key: "nav.explore" },
      {
        key: "nav.group.myOrders",
        items: [
          { href: "/app/requests", key: "nav.myQuotes" },
          { href: "/app/orders", key: "nav.orders" },
          { href: "/app/tasks", key: "nav.tasks" },
          { href: "/app/notifications", key: "nav.notifications" },
          { href: "/app/history", key: "nav.history" },
          { href: "/app/marketing", key: "nav.marketing" },
        ],
      },
    ];
  // Fornecedores e parceiros: início nas Pendências; no grupo Pedidos, a tela
  // própria do papel (conta corrente, fretes, multas), quando houver.
  const orders: NavLink[] = [{ href: "/app/orders", key: "nav.orders" }];
  if (role === "supplier") {
    // Cotações primeiro: é por onde o fornecedor começa (e volta às enviadas).
    orders.unshift({ href: "/app/quotes", key: "nav.quotes" });
    orders.push({ href: "/app/account", key: "nav.account" });
  }
  if (role === "shipping_line")
    orders.unshift({ href: "/app/freight", key: "nav.freight" });
  if (role === "legal")
    orders.push({ href: "/app/penalties", key: "nav.penalties" });
  return [
    group("nav.group.home", [
      { href: "/app", key: "nav.tasks" },
      { href: "/app/notifications", key: "nav.notifications" },
    ]),
    group("nav.group.orders", orders),
  ];
}

/** Todos os links, na ordem, sem os grupos (celular e testes). */
export function flattenNav(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((e) => (isNavGroup(e) ? e.items : [e]));
}

/** Subpáginas que têm link próprio no menu (o link "pai" não acende nelas). */
const OWN_LINK_SUBPAGES = ["/app/freight/tariff"];

/** O link vale para a tela atual? "/app" só na própria página; os demais também nas subpáginas. */
export function isActiveHref(href: string, pathname: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !OWN_LINK_SUBPAGES.some(
    (own) =>
      own !== href &&
      own.startsWith(`${href}/`) &&
      (pathname === own || pathname.startsWith(`${own}/`)),
  );
}
