import type { DictionaryKey } from "@/i18n/dictionaries";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen, menuScreensFor, type Screen } from "@/lib/auth/screens";
import type { User } from "@/lib/db/schema";
import {
  FLOW_OVERVIEW_BLOCKS,
  overviewHref,
  stepHref,
  stepId,
  stepLabelKey,
  stepsOf,
  type FlowBlock,
} from "@/lib/flow";

/*
 * Menu lateral do portal. O que cada login vê vem de uma regra só
 * (src/lib/auth/screens.ts, docs/ACCESS.md): o menu mostra as telas que o
 * login abre. No alto, Control Tower e Pendências (Mensagens e Notificações
 * ficam só no cabeçalho, dono, 14/11/2026). Depois os blocos na ordem do
 * mapa do processo (docs/FLOW_MENU.md): Produto novo, Pedido, Produção,
 * Entrega, Vendas, Financeiro, Painéis e Cadastros; cada passo com o
 * contador do que espera ação do login (src/lib/flow.ts). Configurações,
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
  | "box"
  | "factory"
  | "tag";

export interface NavLink {
  href: string;
  key: DictionaryKey;
  /** Contador ao lado do item: o total das Pendências, preenchido pelo layout. */
  badge?: "tasks";
  /** Passo do fluxo (`bloco/passo`, src/lib/flow.ts): o contador do que espera ação ali. */
  step?: string;
  icon?: NavIcon;
}

export interface NavGroup {
  key: DictionaryKey;
  icon: NavIcon;
  items: NavLink[];
  /**
   * Tela do próprio grupo (item pai, ex.: Produção): o nome abre a tela e a
   * seta abre e fecha os subitens.
   */
  href?: string;
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
 * Overview e passos de um bloco do fluxo (src/lib/flow.ts), na ordem do
 * mapa: cada passo com a tela que já existia ou a tela própria, e o contador.
 */
function flowEntries(block: FlowBlock): Entry[] {
  const steps = stepsOf(block).filter((x) => !x.badgeOnly);
  const overview: Entry[] = FLOW_OVERVIEW_BLOCKS.includes(block)
    ? [
        [
          steps[0]?.screen ?? "tasks",
          { href: overviewHref(block), key: "flow.overview" },
        ],
      ]
    : [];
  return [
    ...overview,
    ...steps.map(
      (step): Entry => [
        step.screen,
        {
          href: stepHref(step),
          key: stepLabelKey(step),
          step: stepId(step),
        },
      ],
    ),
  ];
}

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
        [
          "tasks",
          { href: "/app/tasks", key: "nav.tasks", icon: "tasks", badge: "tasks" },
        ],
      ]),
      // Blocos na ordem do mapa do processo (docs/FLOW_MENU.md): cada passo
      // com o contador do que espera ação do login.
      // Produto novo: do book à negociação com o fornecedor. O Superplan foi
      // para Configurações (dono, 14/11/2026).
      ...group(
        "nav.group.newProduct",
        "cart",
        pick(has, [
          ...flowEntries("new-product"),
          // Fora do menu (MENU_HIDDEN): Sourcing.
          ["sourcing", { href: "/app/sourcing", key: "nav.sourcing" }],
        ]),
      ),
      // Pedido: do pedido de compra ao contrato assinado.
      ...group("nav.group.order", "box", pick(has, flowEntries("order"))),
      // Produção: da pré-produção ao embarque.
      ...group(
        "nav.production",
        "factory",
        pick(has, flowEntries("production")),
      ),
      // Entrega: da LPCO à armazenagem; Containers, Fretes e Tarifário
      // seguem no fim do bloco (telas que já existiam).
      ...group(
        "nav.group.arrival",
        "ship",
        pick(has, [
          ...flowEntries("delivery"),
          ["containers", { href: "/app/containers", key: "nav.containers" }],
          ["freight", { href: "/app/freight", key: "nav.freight" }],
          [
            "freightTariff",
            { href: "/app/freight/tariff", key: "nav.freightTariff" },
          ],
        ]),
      ),
      // Vendas: estoque, amostras, ofertas e venda.
      ...group(
        "nav.group.sales",
        "tag",
        pick(has, [
          ...flowEntries("sales"),
          // Fora do menu (MENU_HIDDEN): Solicitações do cliente e Pós-venda.
          ["requests", { href: "/app/requests", key: "nav.requests" }],
          ["afterSales", { href: "/app/after-sales", key: "nav.afterSales" }],
        ]),
      ),
      ...group(
        "nav.group.finance",
        "money",
        pick(has, [
          [
            "finance",
            { href: "/app/finance", key: "nav.finance", step: "finance/finance" },
          ],
          ["payables", { href: "/app/payables", key: "nav.payables" }],
          // Fluxo de caixa: saiu de Painéis (dono, 14/11/2026).
          [
            "finance",
            { href: "/app/dashboards/cashflow", key: "nav.cashflow" },
          ],
          ["finance", { href: "/app/commissions", key: "nav.commissions" }],
          ["penalties", { href: "/app/penalties", key: "nav.penalties" }],
        ]),
      ),
      // Painéis: só leitura, sem contador.
      ...group(
        "nav.group.panels",
        "chart",
        pick(has, [
          ["finance", { href: "/app/dashboards/owner", key: "nav.owner" }],
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
          // NCM a classificar e fichas incompletas contam aqui.
          [
            "products",
            {
              href: "/app/products",
              key: "nav.products",
              step: "registry/products",
            },
          ],
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
        [
          "tasks",
          { href: "/app/tasks", key: "nav.tasks", icon: "tasks", badge: "tasks" },
        ],
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
          ? { href: "/app", key: "nav.tasks", icon: "tasks", badge: "tasks" }
          : { href: "/app", key: "nav.home", icon: "home" },
      ],
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

/** Todos os links, na ordem, sem os grupos (celular e testes); o item pai vem antes dos subitens. */
export function flattenNav(entries: NavEntry[]): NavLink[] {
  return entries.flatMap((e) =>
    isNavGroup(e)
      ? [
          ...(e.href ? [{ href: e.href, key: e.key, icon: e.icon }] : []),
          ...e.items,
        ]
      : [e],
  );
}

/** Subpáginas que têm link próprio no menu (o link "pai" não acende nelas). */
const OWN_LINK_SUBPAGES = [
  "/app/booking/selection",
  "/app/freight/tariff",
  "/app/supplier-requests/invites",
];

/** O link vale para a tela atual? "/app" só na própria página; os demais também nas subpáginas. */
export function isActiveHref(href: string, pathname: string): boolean {
  if (href === "/app") return pathname === "/app";
  // Overview do bloco (/app/flow/<bloco>): só na própria tela, não nos passos.
  if (/^\/app\/flow\/[^/]+$/.test(href)) return pathname === href;
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !OWN_LINK_SUBPAGES.some(
    (own) =>
      own !== href &&
      own.startsWith(`${href}/`) &&
      (pathname === own || pathname.startsWith(`${own}/`)),
  );
}
