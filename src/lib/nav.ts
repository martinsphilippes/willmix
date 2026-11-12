import type { DictionaryKey } from "@/i18n/dictionaries";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen, menuScreensFor, type Screen } from "@/lib/auth/screens";
import type { User } from "@/lib/db/schema";

/*
 * Menu lateral do portal (decisão do dono, 12/11/2026). O que cada login vê
 * vem de uma regra só (src/lib/auth/screens.ts, docs/ACCESS.md): o menu mostra
 * as telas que o login abre. No alto, links soltos do dia a dia (Control
 * Tower, Pendências, Mensagens, Notificações); depois os grupos, cada um na
 * ordem do fluxo (Compras: Booking → Seleção → Convites → Solicitações ao
 * fornecedor; Pedidos e entrega: Pedidos de compra → Revisão → Containers →
 * Fretes → Tarifário → Estoque; Financeiro; Painéis; Cadastros). Configurações,
 * Equipe e acessos e Auditoria ficam fixos embaixo (navFooterFor). Grupo com
 * uma tela só vira link direto; grupo vazio some. Telas fora do fluxo de hoje
 * ficam fora do menu de todos (MENU_HIDDEN), mas continuam abrindo pelo
 * endereço.
 */

/** Ícone do item no menu lateral (desenhado em src/components/app-nav.tsx). */
export type NavIcon =
  | "tower"
  | "tasks"
  | "messages"
  | "bell"
  | "cart"
  | "ship"
  | "money"
  | "chart"
  | "folder"
  | "settings"
  | "team"
  | "shield"
  | "home"
  | "box";

export interface NavLink {
  href: string;
  key: DictionaryKey;
  /** Contador ao lado do item (mensagens ou notificações não lidas), preenchido pelo layout. */
  badge?: "messages" | "notifications";
  icon?: NavIcon;
}

/** Mensagens (chat com a Wellmix / com as empresas): todo papel que entra no portal. */
const MESSAGES: NavLink = {
  href: "/app/messages",
  key: "nav.messages",
  badge: "messages",
  icon: "messages",
};
const NOTIFICATIONS: NavLink = {
  href: "/app/notifications",
  key: "nav.notifications",
  badge: "notifications",
  icon: "bell",
};

export interface NavGroup {
  key: DictionaryKey;
  icon: NavIcon;
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/**
 * Fora do menu de todos por enquanto (decisão do dono, 12/11/2026): telas de
 * fora do fluxo de hoje (Booking → pedido de compra). A vitrine ainda não
 * abriu, então as telas do cliente final esperam. A tela continua abrindo
 * pelo endereço; para voltar ao menu, basta tirar daqui.
 */
export const MENU_HIDDEN: readonly string[] = [
  "/app/requests",
  "/app/explore",
  "/app/sourcing",
  "/app/marketing",
  "/app/after-sales",
  "/app/history",
];

/** Grupo do menu; com uma tela só, vira o próprio link (com o ícone do grupo); vazio, some. */
function group(
  key: DictionaryKey,
  icon: NavIcon,
  items: NavLink[],
): NavEntry[] {
  if (items.length === 0) return [];
  return items.length === 1
    ? [{ ...items[0], icon: items[0].icon ?? icon }]
    : [{ key, icon, items }];
}

type Entry = [Screen, NavLink];

/**
 * Só os links das telas que o login abre, na ordem dada, sem os ocultos. A
 * tela liberada a um perfil na Gestão de telas (granted) aparece mesmo oculta:
 * foi o administrador que escolheu dar a tela.
 */
function pick(has: Set<Screen>, entries: Entry[], granted: Entry[] = []) {
  const extra = new Set(granted.map(([, link]) => link));
  return [...entries, ...granted]
    .filter(
      ([screen, link]) =>
        has.has(screen) &&
        (extra.has(link) || !MENU_HIDDEN.includes(link.href)),
    )
    .map(([, link]) => link);
}

/*
 * Gestão de telas (docs/PARTNER_ACCESS.md): um perfil pode receber telas que
 * nasceram para outro. O menu de quem recebe ganha o link no fim do grupo;
 * quem não recebeu não vê nada novo.
 */
const GRANTED_FROM_CUSTOMER: Entry[] = [
  ["explore", { href: "/app/explore", key: "nav.explore" }],
  ["requests", { href: "/app/requests", key: "nav.myQuotes" }],
  ["history", { href: "/app/history", key: "nav.history" }],
  ["marketing", { href: "/app/marketing", key: "nav.marketing" }],
];
const GRANTED_FROM_PARTNERS: Entry[] = [
  // Booking adaptado ao login externo: os bookings da empresa de quem abre.
  ["booking", { href: "/app/booking", key: "nav.booking" }],
  [
    "quotes",
    { href: "/app/supplier-requests/invites", key: "nav.bookingInvites" },
  ],
  ["quotes", { href: "/app/supplier-requests", key: "nav.supplierRequests" }],
  ["freight", { href: "/app/freight", key: "nav.freight" }],
  [
    "freightTariff",
    { href: "/app/freight/tariff", key: "nav.myFreightTariff" },
  ],
  ["account", { href: "/app/account", key: "nav.account" }],
  ["penalties", { href: "/app/penalties", key: "nav.penalties" }],
];

export function navFor(
  user: Pick<User, "role"> & Partial<Pick<User, "functions">>,
): NavEntry[] {
  const has = menuScreensFor(user);
  if (isWellmix(user)) {
    return [
      ...pick(has, [
        ["home", { href: "/app", key: "nav.controlTower", icon: "tower" }],
        ["tasks", { href: "/app/tasks", key: "nav.tasks", icon: "tasks" }],
        ["messages", MESSAGES],
        ["notifications", NOTIFICATIONS],
      ]),
      // Do booking ao pedido gerado.
      ...group(
        "nav.group.purchasing",
        "cart",
        pick(has, [
          // Bookings: as planilhas de fornecedor (docs/BOOKING.md).
          ["booking", { href: "/app/booking", key: "nav.booking" }],
          // Itens dos bookings comparados e a solicitação ao fornecedor do escolhido.
          [
            "booking",
            { href: "/app/booking/selection", key: "nav.bookingSelection" },
          ],
          [
            "quotes",
            {
              href: "/app/supplier-requests/invites",
              key: "nav.bookingInvites",
            },
          ],
          [
            "quotes",
            { href: "/app/supplier-requests", key: "nav.supplierRequests" },
          ],
          // Fora do menu (MENU_HIDDEN): Solicitações do cliente e Sourcing.
          ["requests", { href: "/app/requests", key: "nav.requests" }],
          ["sourcing", { href: "/app/sourcing", key: "nav.sourcing" }],
        ]),
      ),
      // Do pedido de compra ao estoque.
      ...group(
        "nav.group.delivery",
        "ship",
        pick(has, [
          ["orders", { href: "/app/orders", key: "nav.purchaseOrders" }],
          ["reviews", { href: "/app/reviews", key: "nav.reviews" }],
          ["containers", { href: "/app/containers", key: "nav.containers" }],
          ["freight", { href: "/app/freight", key: "nav.freight" }],
          [
            "freightTariff",
            { href: "/app/freight/tariff", key: "nav.freightTariff" },
          ],
          // Estoque: em produção, em trânsito e no Brasil.
          ["products", { href: "/app/inventory", key: "nav.inventory" }],
          // Fora do menu (MENU_HIDDEN): Pós-venda.
          ["afterSales", { href: "/app/after-sales", key: "nav.afterSales" }],
        ]),
      ),
      ...group(
        "nav.group.finance",
        "money",
        pick(has, [
          ["finance", { href: "/app/finance", key: "nav.finance" }],
          ["payables", { href: "/app/payables", key: "nav.payables" }],
          ["finance", { href: "/app/commissions", key: "nav.commissions" }],
          ["penalties", { href: "/app/penalties", key: "nav.penalties" }],
        ]),
      ),
      ...group(
        "nav.group.panels",
        "chart",
        pick(has, [
          // Painel do dono e fluxo de caixa: números de Finanças.
          ["finance", { href: "/app/dashboards/owner", key: "nav.owner" }],
          [
            "finance",
            { href: "/app/dashboards/cashflow", key: "nav.cashflow" },
          ],
          // Viabilidade de um produto (só o administrador).
          ["superplan", { href: "/app/superplan", key: "nav.superplan" }],
          ["dashboards", { href: "/app/dashboards", key: "nav.dashboards" }],
          // O que cada operador deve, pelo prazo, na carteira dele.
          ["sla", { href: "/app/sla", key: "nav.sla" }],
          // Fora do menu (MENU_HIDDEN): Histórico comercial e Marketing.
          ["history", { href: "/app/history", key: "nav.history" }],
          ["marketing", { href: "/app/marketing", key: "nav.marketing" }],
        ]),
      ),
      ...group(
        "nav.group.registry",
        "folder",
        pick(has, [
          // Clientes, fornecedores e demais parceiros numa tela só, com filtro
          // por tipo (as listas de Clientes e Fornecedores seguem pelo endereço).
          ["parties", { href: "/app/parties", key: "nav.parties" }],
          ["products", { href: "/app/products", key: "nav.products" }],
          ["lines", { href: "/app/lines", key: "nav.lines" }],
          // Fora do menu (MENU_HIDDEN): a vitrine como o cliente vê.
          ["explore", { href: "/app/explore", key: "nav.explorePreview" }],
        ]),
      ),
    ];
  }
  if (user.role === "customer")
    // A vitrine ainda não abriu (Explorar, Orçamentos, Histórico e Marketing
    // fora do menu): o cliente fica com os pedidos e o dia a dia.
    return [
      ...pick(has, [
        ["tasks", { href: "/app/tasks", key: "nav.tasks", icon: "tasks" }],
        ["messages", MESSAGES],
        ["notifications", NOTIFICATIONS],
      ]),
      ...group(
        "nav.group.myOrders",
        "box",
        pick(
          has,
          [
            ["explore", { href: "/app/explore", key: "nav.explore" }],
            ["requests", { href: "/app/requests", key: "nav.myQuotes" }],
            ["orders", { href: "/app/orders", key: "nav.orders" }],
            ["history", { href: "/app/history", key: "nav.history" }],
            ["marketing", { href: "/app/marketing", key: "nav.marketing" }],
          ],
          // Telas de outros perfis liberadas na Gestão de telas.
          GRANTED_FROM_PARTNERS,
        ),
      ),
    ];
  // Fornecedores e parceiros: início nas Pendências; num grupo, a tela própria
  // do papel (bookings, fretes, multas, conta corrente).
  const own = pick(
    has,
    [
      // Trading (e quem mais recebe a tela): os bookings da empresa dele.
      ["booking", { href: "/app/booking", key: "nav.booking" }],
      // Convite para subir um booking concorrente de um item.
      [
        "quotes",
        { href: "/app/supplier-requests/invites", key: "nav.bookingInvites" },
      ],
      // O que a Wellmix pergunta sobre um item do booking dele.
      [
        "quotes",
        { href: "/app/supplier-requests", key: "nav.supplierRequests" },
      ],
      ["orders", { href: "/app/orders", key: "nav.orders" }],
      ["freight", { href: "/app/freight", key: "nav.freight" }],
      // A companhia envia a própria tabela de fretes (só vê as dela).
      [
        "freightTariff",
        { href: "/app/freight/tariff", key: "nav.myFreightTariff" },
      ],
      // Despachante: NCM dos itens de booking sem produto parecido.
      ...(user.role === "broker"
        ? ([
            ["tasks", { href: "/app/ncm-items", key: "nav.ncmItems" }],
          ] as Entry[])
        : []),
      ["account", { href: "/app/account", key: "nav.account" }],
      ["penalties", { href: "/app/penalties", key: "nav.penalties" }],
    ],
    // Telas do cliente liberadas na Gestão de telas.
    GRANTED_FROM_CUSTOMER,
  );
  const bookings = own.some(
    (l) =>
      l.href === "/app/booking" || l.href.startsWith("/app/supplier-requests"),
  );
  return [
    ...pick(has, [
      // O início são as Pendências; sem elas no perfil, é só "Início".
      [
        "home",
        canOpen(user, "tasks")
          ? { href: "/app", key: "nav.tasks", icon: "tasks" }
          : { href: "/app", key: "nav.home", icon: "home" },
      ],
      ["messages", MESSAGES],
      ["notifications", NOTIFICATIONS],
    ]),
    ...group(
      bookings ? "nav.group.myBookings" : "nav.group.orders",
      bookings ? "cart" : "box",
      own,
    ),
  ];
}

/** Itens fixos embaixo do menu lateral: Configurações, Equipe e acessos, Auditoria. */
export function navFooterFor(
  user: Pick<User, "role"> & Partial<Pick<User, "functions">>,
): NavLink[] {
  if (!isWellmix(user)) return [];
  return pick(menuScreensFor(user), [
    [
      "settings",
      { href: "/app/settings", key: "nav.settings", icon: "settings" },
    ],
    // Cargo, chefe, funções e carteira de clientes (Painel de SLA).
    ["team", { href: "/app/team", key: "nav.teamAccess", icon: "team" }],
    // Trilha de auditoria (quem fez o quê e quando).
    ["audit", { href: "/app/audit", key: "nav.audit", icon: "shield" }],
  ]);
}

/** Todos os links, na ordem, sem os grupos (celular e testes). */
export function flattenNav(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((e) => (isNavGroup(e) ? e.items : [e]));
}

/** Subpáginas que têm link próprio no menu (o link "pai" não acende nelas). */
const OWN_LINK_SUBPAGES = [
  "/app/freight/tariff",
  "/app/supplier-requests/invites",
];

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
