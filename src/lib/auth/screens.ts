import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Role, User, WellmixFunction } from "@/lib/db/schema";
import { ForbiddenError, isAdmin, isWellmix } from "./permissions";

/*
 * Telas por papel e por função (docs/ACCESS.md). Uma lista só de telas e uma
 * regra só que diz quais telas cada login abre: o menu (src/lib/nav.ts), a
 * guarda de cada página (requireScreen), o Control Tower e as Server Actions
 * (assertScreen) leem daqui. Admin abre tudo; operador da Wellmix abre o
 * básico mais a união das telas das suas funções (Gestão → Equipe e
 * divisões); cliente, fornecedor e parceiros têm a lista fixa do papel.
 * Financeiro (Financeiro, Contas a pagar, conta corrente do fornecedor) é só
 * do administrador: nenhuma função o libera. O administrador pode, porém,
 * marcar as telas de um login uma a uma (users.screens), inclusive essas.
 */

export const SCREENS = [
  "home",
  "tasks",
  "sla",
  "notifications",
  "messages",
  "requests",
  "quotes",
  "orders",
  "sourcing",
  "reviews",
  "freight",
  "freightTariff",
  "packaging",
  "containers",
  "parties",
  "products",
  "lines",
  "explore",
  "import",
  "dashboards",
  "finance",
  "payables",
  "penalties",
  "afterSales",
  "marketing",
  "history",
  "account",
  "settings",
  "team",
  "audit",
] as const;
export type Screen = (typeof SCREENS)[number];

/** Rota (prefixo) de cada tela; a mais específica primeiro. */
export const SCREEN_ROUTES: ReadonlyArray<readonly [string, Screen]> = [
  ["/app/freight/tariff", "freightTariff"],
  ["/app/freight", "freight"],
  ["/app/products", "products"],
  ["/app/requests", "requests"],
  ["/app/quotes", "quotes"],
  ["/app/orders", "orders"],
  ["/app/sourcing", "sourcing"],
  ["/app/reviews", "reviews"],
  ["/app/packaging", "packaging"],
  ["/app/containers", "containers"],
  ["/app/parties", "parties"],
  ["/app/lines", "lines"],
  ["/app/explore", "explore"],
  ["/app/import", "import"],
  ["/app/dashboards", "dashboards"],
  ["/app/finance", "finance"],
  ["/app/payables", "payables"],
  ["/app/penalties", "penalties"],
  ["/app/after-sales", "afterSales"],
  ["/app/marketing", "marketing"],
  ["/app/history", "history"],
  ["/app/account", "account"],
  ["/app/settings", "settings"],
  ["/app/team", "team"],
  ["/app/audit", "audit"],
  ["/app/sla", "sla"],
  ["/app/tasks", "tasks"],
  ["/app/notifications", "notifications"],
  ["/app/messages", "messages"],
  ["/app", "home"],
];

/** Tela de uma rota (/app/orders/abc → orders); nulo fora do portal. */
export function screenOfPath(pathname: string): Screen | null {
  for (const [prefix, screen] of SCREEN_ROUTES)
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return screen;
  return null;
}

/** Nome da tela no menu (rótulo da Wellmix; o cliente vê "Orçamentos" etc. pelo nav). */
export const SCREEN_LABEL: Record<Screen, DictionaryKey> = {
  home: "nav.controlTower",
  tasks: "nav.tasks",
  sla: "nav.sla",
  notifications: "nav.notifications",
  messages: "nav.messages",
  requests: "nav.requests",
  quotes: "nav.quotes",
  orders: "nav.orders",
  sourcing: "nav.sourcing",
  reviews: "nav.reviews",
  freight: "nav.freight",
  freightTariff: "nav.freightTariff",
  packaging: "nav.packaging",
  containers: "nav.containers",
  parties: "nav.parties",
  products: "nav.products",
  lines: "nav.lines",
  explore: "nav.explorePreview",
  import: "nav.import",
  dashboards: "nav.dashboards",
  finance: "nav.finance",
  payables: "nav.payables",
  penalties: "nav.penalties",
  afterSales: "nav.afterSales",
  marketing: "nav.marketing",
  history: "nav.history",
  account: "nav.account",
  settings: "nav.settings",
  team: "nav.team",
  audit: "nav.audit",
};

/** Todo login da Wellmix, com ou sem função. */
export const WELLMIX_BASE: readonly Screen[] = [
  "home",
  "tasks",
  "sla",
  "notifications",
  "messages",
];

/** Só o administrador, seja qual for a função: financeiro, configurações e equipe. */
export const ADMIN_ONLY: readonly Screen[] = [
  "finance",
  "payables",
  "account",
  "settings",
  "team",
];

const PARTNER_BASE: readonly Screen[] = [
  "home",
  "tasks",
  "notifications",
  "messages",
  "orders",
];

/** Cliente, fornecedor e parceiros: a lista fixa do papel (as telas de sempre). */
export const ROLE_SCREENS: Record<
  Exclude<Role, "admin" | "operator">,
  readonly Screen[]
> = {
  customer: [
    "home",
    "explore",
    "requests",
    "orders",
    "tasks",
    "notifications",
    "messages",
    "history",
    "marketing",
  ],
  supplier: [...PARTNER_BASE, "quotes", "account"],
  agency: [...PARTNER_BASE, "packaging"],
  broker: PARTNER_BASE,
  shipping_line: [...PARTNER_BASE, "freight", "freightTariff"],
  carrier: PARTNER_BASE,
  legal: [...PARTNER_BASE, "penalties"],
  comex: PARTNER_BASE,
  logistics: PARTNER_BASE,
  ocp: PARTNER_BASE,
};

/** Diretorias: tudo o que não é só do administrador. */
const DIRECTOR: readonly Screen[] = SCREENS.filter(
  (s) => !ADMIN_ONLY.includes(s) && !WELLMIX_BASE.includes(s),
);

/**
 * Telas que cada função libera para o operador (além do básico). As telas
 * financeiras não entram em nenhuma: são só do administrador. A função
 * "financeiro" abre só o pedido, para validar e pagar o numerário
 * (docs/IMPORT_FLOW.md).
 */
export const FUNCTION_SCREENS: Record<WellmixFunction, readonly Screen[]> = {
  buyer: [
    "requests",
    "quotes",
    "orders",
    "sourcing",
    "reviews",
    "freight",
    "freightTariff",
    "packaging",
    "containers",
    "parties",
    "products",
    "history",
    "afterSales",
  ],
  product_manager: [
    "requests",
    "quotes",
    "orders",
    "sourcing",
    "reviews",
    "packaging",
    "products",
    "lines",
    "explore",
    "marketing",
    "afterSales",
    "history",
  ],
  planner: [
    "requests",
    "quotes",
    "orders",
    "containers",
    "freight",
    "freightTariff",
    "dashboards",
    "history",
  ],
  catalog: [
    "orders",
    "sourcing",
    "reviews",
    "products",
    "lines",
    "parties",
    "import",
    "explore",
  ],
  // Só o pedido: validar e pagar o numerário (docs/IMPORT_FLOW.md); o resto do financeiro é do admin.
  finance: ["orders"],
  purchasing_director: DIRECTOR,
  executive_director: DIRECTOR,
  designer: ["orders", "packaging", "products", "marketing", "explore"],
};

type Who = Pick<User, "role"> & Partial<Pick<User, "functions" | "screens">>;

/** Grupos do menu, com todas as telas (a tela de acessos mostra as caixas assim). */
export const SCREEN_GROUPS: ReadonlyArray<{
  key: DictionaryKey;
  screens: readonly Screen[];
}> = [
  {
    key: "nav.group.home",
    screens: ["home", "tasks", "sla", "notifications", "messages"],
  },
  {
    key: "nav.group.orders",
    screens: [
      "requests",
      "quotes",
      "orders",
      "sourcing",
      "reviews",
      "freight",
      "freightTariff",
      "packaging",
      "containers",
    ],
  },
  {
    key: "nav.group.registry",
    screens: ["parties", "products", "lines", "explore", "import"],
  },
  {
    key: "nav.group.management",
    screens: [
      "dashboards",
      "finance",
      "payables",
      "penalties",
      "afterSales",
      "marketing",
      "history",
      "account",
      "settings",
      "team",
      "audit",
    ],
  },
];

const isScreen = (value: unknown): value is Screen =>
  typeof value === "string" && (SCREENS as readonly string[]).includes(value);

/** Só chaves de tela válidas (o banco pode ter lixo ou chave antiga). */
export const validScreens = (list: unknown): Screen[] =>
  Array.isArray(list) ? list.filter(isScreen) : [];

/** Padrão das funções: o básico mais as telas de cada função marcada. */
export function functionScreensFor(user: Who): Set<Screen> {
  const set = new Set<Screen>(WELLMIX_BASE);
  for (const fn of user.functions ?? [])
    for (const screen of FUNCTION_SCREENS[fn] ?? []) set.add(screen);
  return set;
}

/** O administrador marcou as telas deste login uma a uma (em vez do padrão das funções)? */
export const hasCustomScreens = (user: Who) =>
  isWellmix(user) && !isAdmin(user) && Array.isArray(user.screens);

/**
 * Telas que o login abre (menu e guarda das páginas saem daqui). Admin: todas.
 * Operador: a lista marcada pelo administrador (mais o básico), se houver;
 * senão o padrão das funções. Cliente, fornecedor e parceiros: a lista do papel.
 */
export function screensFor(user: Who): Set<Screen> {
  if (isAdmin(user)) return new Set(SCREENS);
  if (isWellmix(user)) {
    if (Array.isArray(user.screens))
      return new Set<Screen>([...WELLMIX_BASE, ...validScreens(user.screens)]);
    return functionScreensFor(user);
  }
  return new Set(ROLE_SCREENS[user.role as keyof typeof ROLE_SCREENS] ?? []);
}

export const canOpen = (user: Who, screen: Screen) =>
  screensFor(user).has(screen);

/** Server Actions: recusa (forbidden) quem não abre a tela da ação. */
export function assertScreen(user: Who, screen: Screen) {
  if (!canOpen(user, screen)) throw new ForbiddenError();
}

/** Ação usada em mais de uma tela (ex.: briefing na solicitação e em Embalagem): basta abrir uma delas. */
export function assertAnyScreen(user: Who, screens: readonly Screen[]) {
  const has = screensFor(user);
  if (!screens.some((s) => has.has(s))) throw new ForbiddenError();
}

/** Login da Wellmix que abre só o básico (sem função e sem tela marcada): aviso no início. */
export const hasNoFunction = (user: Who) =>
  isWellmix(user) &&
  !isAdmin(user) &&
  [...screensFor(user)].every((s) => WELLMIX_BASE.includes(s));
