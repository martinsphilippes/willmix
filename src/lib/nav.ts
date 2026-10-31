import type { DictionaryKey } from "@/i18n/dictionaries";
import { isWellmix } from "@/lib/auth/permissions";
import { screensFor, type Screen } from "@/lib/auth/screens";
import type { User } from "@/lib/db/schema";

/*
 * Menu principal do portal. O que cada login vê vem de uma regra só
 * (src/lib/auth/screens.ts, docs/ACCESS.md): o menu mostra as telas que o
 * login abre, nos grupos de sempre. A Wellmix tem quatro grupos (Início,
 * Pedidos, Cadastros, Gestão): o admin vê tudo; o operador, o básico mais as
 * telas das suas funções. Cliente, fornecedores e parceiros veem dois grupos
 * (Início, Pedidos); o cliente vê a vitrine (Explorar) e "Meus pedidos". A
 * logo leva ao início de cada um. Grupo com uma tela só vira link direto;
 * grupo vazio some.
 */

export interface NavLink {
  href: string;
  key: DictionaryKey;
  /** Contador ao lado do item (ex.: mensagens não lidas), preenchido pelo layout. */
  badge?: "messages";
}

/** Mensagens (chat com a Wellmix / com as empresas): todo papel que entra no portal. */
const MESSAGES: NavLink = {
  href: "/app/messages",
  key: "nav.messages",
  badge: "messages",
};

export interface NavGroup {
  key: DictionaryKey;
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/** Grupo do menu; com uma tela só, vira o próprio link; vazio, some. */
function group(key: DictionaryKey, items: NavLink[]): NavEntry[] {
  if (items.length === 0) return [];
  return items.length === 1 ? [items[0]] : [{ key, items }];
}

type Entry = [Screen, NavLink];

/** Só os links das telas que o login abre, na ordem dada. */
function pick(has: Set<Screen>, entries: Entry[]): NavLink[] {
  return entries.filter(([screen]) => has.has(screen)).map(([, link]) => link);
}

export function navFor(
  user: Pick<User, "role"> & Partial<Pick<User, "functions">>,
): NavEntry[] {
  const has = screensFor(user);
  if (isWellmix(user)) {
    return [
      ...group(
        "nav.group.home",
        pick(has, [
          ["home", { href: "/app", key: "nav.controlTower" }],
          ["tasks", { href: "/app/tasks", key: "nav.tasks" }],
          // O que cada operador deve, pelo prazo, na carteira dele.
          ["sla", { href: "/app/sla", key: "nav.sla" }],
          [
            "notifications",
            { href: "/app/notifications", key: "nav.notifications" },
          ],
          ["messages", MESSAGES],
        ]),
      ),
      // Do pedido do cliente à entrega: comercial e operação juntos.
      ...group(
        "nav.group.orders",
        pick(has, [
          ["requests", { href: "/app/requests", key: "nav.requests" }],
          ["orders", { href: "/app/orders", key: "nav.orders" }],
          ["sourcing", { href: "/app/sourcing", key: "nav.sourcing" }],
          ["reviews", { href: "/app/reviews", key: "nav.reviews" }],
          ["freight", { href: "/app/freight", key: "nav.freight" }],
          [
            "freightTariff",
            { href: "/app/freight/tariff", key: "nav.freightTariff" },
          ],
          // Briefings de embalagem (faca e arte) abertos com a RFQ.
          ["packaging", { href: "/app/packaging", key: "nav.packaging" }],
          ["containers", { href: "/app/containers", key: "nav.containers" }],
        ]),
      ),
      ...group(
        "nav.group.registry",
        pick(has, [
          ["parties", { href: "/app/parties", key: "nav.parties" }],
          ["products", { href: "/app/products", key: "nav.products" }],
          ["lines", { href: "/app/lines", key: "nav.lines" }],
          // A vitrine como o cliente vê (preço estimado, o que falta no cadastro).
          ["explore", { href: "/app/explore", key: "nav.explorePreview" }],
        ]),
      ),
      ...group(
        "nav.group.management",
        pick(has, [
          // Painéis por área (compras, produção, embarque, recebimento...).
          ["dashboards", { href: "/app/dashboards", key: "nav.dashboards" }],
          ["finance", { href: "/app/finance", key: "nav.finance" }],
          ["payables", { href: "/app/payables", key: "nav.payables" }],
          ["penalties", { href: "/app/penalties", key: "nav.penalties" }],
          ["afterSales", { href: "/app/after-sales", key: "nav.afterSales" }],
          ["marketing", { href: "/app/marketing", key: "nav.marketing" }],
          ["history", { href: "/app/history", key: "nav.history" }],
          ["settings", { href: "/app/settings", key: "nav.settings" }],
          // Cargo, chefe, funções e carteira de clientes (Painel de SLA).
          ["team", { href: "/app/team", key: "nav.team" }],
          // Trilha de auditoria (quem fez o quê e quando).
          ["audit", { href: "/app/audit", key: "nav.audit" }],
        ]),
      ),
    ];
  }
  if (user.role === "customer")
    // Início do cliente é a vitrine (Explorar); o resto (orçamentos, pedidos,
    // pendências) fica num grupo só, "Meus pedidos".
    return [
      { href: "/app/explore", key: "nav.explore" },
      ...group(
        "nav.group.myOrders",
        pick(has, [
          ["requests", { href: "/app/requests", key: "nav.myQuotes" }],
          ["orders", { href: "/app/orders", key: "nav.orders" }],
          ["tasks", { href: "/app/tasks", key: "nav.tasks" }],
          [
            "notifications",
            { href: "/app/notifications", key: "nav.notifications" },
          ],
          ["messages", MESSAGES],
          ["history", { href: "/app/history", key: "nav.history" }],
          ["marketing", { href: "/app/marketing", key: "nav.marketing" }],
        ]),
      ),
    ];
  // Fornecedores e parceiros: início nas Pendências; no grupo Pedidos, a tela
  // própria do papel (cotações, fretes, embalagens, multas, conta corrente).
  return [
    ...group(
      "nav.group.home",
      pick(has, [
        ["home", { href: "/app", key: "nav.tasks" }],
        [
          "notifications",
          { href: "/app/notifications", key: "nav.notifications" },
        ],
        ["messages", MESSAGES],
      ]),
    ),
    ...group(
      "nav.group.orders",
      pick(has, [
        // Cotações primeiro: é por onde o fornecedor começa (e volta às enviadas).
        ["quotes", { href: "/app/quotes", key: "nav.quotes" }],
        ["freight", { href: "/app/freight", key: "nav.freight" }],
        // A companhia envia a própria tabela de fretes (só vê as dela).
        [
          "freightTariff",
          { href: "/app/freight/tariff", key: "nav.myFreightTariff" },
        ],
        // A agência começa pelos briefings de embalagem (faca e arte na RFQ).
        ["packaging", { href: "/app/packaging", key: "nav.packaging" }],
        ["orders", { href: "/app/orders", key: "nav.orders" }],
        ["penalties", { href: "/app/penalties", key: "nav.penalties" }],
        ["account", { href: "/app/account", key: "nav.account" }],
      ]),
    ),
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
