import {
  FUNCTION_SCREENS,
  SCREEN_PARENT,
  SCREENS,
  WELLMIX_BASE,
  type Screen,
} from "@/lib/auth/screens";
import { accessOf, type ResolvedAccess } from "@/lib/auth/access-cache";
import { combineFunctionScreens } from "@/lib/auth/screen-picker";
import { WELLMIX_FUNCTIONS, type WellmixFunction } from "@/lib/db/schema";
import { ForbiddenError } from "@/lib/auth/permissions";

/*
 * Funções da equipe e o que cada uma libera (docs/ACCESS.md, "Funções e
 * acessos"). Duas coisas por função:
 *
 * - Telas: o que o login abre (o que não abre nem aparece no menu; a página e
 *   as Server Actions recusam).
 * - Ações: o que pode fazer dentro das telas (aprovar um nível do pré-custo,
 *   liberar dumping, gerar pedido de compra, assinar o contrato...). Sem a
 *   ação, o botão some e o servidor recusa.
 *
 * O padrão de cada função vem do código (FUNCTION_SCREENS e o padrão das
 * ações abaixo, iguais ao comportamento de antes). O administrador muda em
 * Equipe → Funções e acessos; a configuração fica na tabela `settings`
 * (chave `teamFunctions`) e vale para as funções de fábrica e para as que ele
 * criar. O administrador faz tudo, sempre.
 */

/** Ações que dependem de função, agrupadas pela área em que aparecem. */
export const ACTION_GROUPS = [
  {
    key: "purchase",
    actions: [
      "supplierRequest.decide",
      "sampling.validate",
      "dumping.release",
      "approval.planner",
      "approval.purchasing_director",
      "approval.executive_director",
      "purchaseOrder.generate",
      "purchaseOrder.salesNotice",
      // Compra por demanda (dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
      // lançar a encomenda em nome do cliente (B14) e abrir a reposição (B10).
      "demand.createForCustomer",
      "replenishment.open",
      // Estratégia de compra (mapa B10?): o Comprador escolhe, a Diretoria
      // de compras aprova.
      "purchaseStrategy.choose",
      "purchaseStrategy.approve",
      // Cotação de compra (mapa B13): o Comprador escolhe a vencedora, a
      // Diretoria de compras aprova.
      "purchaseQuote.choose",
      "purchaseQuote.approve",
    ],
  },
  {
    key: "order",
    actions: [
      "art.validate",
      "art.design",
      "contract.sign",
      "order.cancel",
      "realMedia.approve",
      // Aprovações do mapa no fim dos marcos (dono, 14/11/2026;
      // docs/MILESTONES.md).
      "approve.productManager",
      "approve.buyer",
      "approve.planner",
      "approve.purchasingDirector",
    ],
  },
  {
    key: "logistics",
    actions: [
      "numerario.manage",
      "receiving.follow",
      "container.tracking",
      "receiving.quality",
    ],
  },
  {
    key: "money",
    // Gravar a venda ao cliente por pedido e por produto (dono, 14/11/2026;
    // docs/ORDER_SALE.md). Ver o preço de compra (dono, 15/11/2026;
    // docs/LINHA_DE_VISAO.md, seção 7).
    actions: ["purchasePrice.view", "values.view", "sale.record"],
  },
] as const;

export type ActionKey = (typeof ACTION_GROUPS)[number]["actions"][number];
export const ACTION_KEYS: readonly ActionKey[] = ACTION_GROUPS.flatMap(
  (g) => g.actions as readonly ActionKey[],
);

export const isActionKey = (v: unknown): v is ActionKey =>
  typeof v === "string" && (ACTION_KEYS as readonly string[]).includes(v);

/** Funções de fábrica que têm a tela (para o padrão das ações = quem já fazia). */
const withScreen = (...screens: Screen[]): WellmixFunction[] =>
  WELLMIX_FUNCTIONS.filter((f) =>
    screens.every((s) => FUNCTION_SCREENS[f].includes(s)),
  );

/**
 * Quem faz cada ação por padrão: o mesmo de antes desta configuração.
 * Calculado na hora (e não no topo do módulo) para não depender da ordem de
 * carga entre screens.ts e este arquivo.
 */
function defaultHolders(action: ActionKey): readonly WellmixFunction[] {
  switch (action) {
    case "approval.planner":
      return ["planner"];
    case "approval.purchasing_director":
      return ["purchasing_director"];
    case "approval.executive_director":
      return ["executive_director"];
    case "dumping.release":
      return ["product_manager", "buyer"];
    case "numerario.manage":
      return ["finance"];
    case "art.design":
      return ["designer"];
    // Fotos e vídeos reais da agência na China: o marketing aprova, troca
    // as fotos do catálogo e ativa a venda (mapa R5/R16; dono, 14/11/2026).
    case "realMedia.approve":
      return ["designer"];
    // Conferência da qualidade no CD (mapa E19; dono, 14/11/2026).
    case "receiving.quality":
      return ["quality"];
    case "receiving.follow":
      return ["buyer"];
    // Rastreio diário do container (mapa R19; dono, 13/11/2026).
    case "container.tracking":
      return ["comex_internal"];
    // Vendas fica sabendo do que vem (mapa, P2 → V1): quem cuida do pós-venda
    // e da recompra. O administrador muda em Equipe → Funções e acessos.
    case "purchaseOrder.salesNotice":
      return withScreen("afterSales");
    // Quem abria a tela fazia: o padrão não tira nada de ninguém.
    case "supplierRequest.decide":
    case "sampling.validate":
      return withScreen("quotes");
    case "purchaseOrder.generate":
      return withScreen("quotes", "orders");
    // Encomenda em nome do cliente (mapa B14): Vendas e quem já abria a tela
    // de solicitações (o padrão não tira nada de ninguém).
    case "demand.createForCustomer":
      return ["sales", ...withScreen("requests").filter((f) => f !== "sales")];
    // Reposição aberta à mão (mapa B10): o Planner.
    case "replenishment.open":
      return ["planner"];
    case "purchaseStrategy.choose":
      return ["buyer"];
    case "purchaseStrategy.approve":
      return ["purchasing_director"];
    case "purchaseQuote.choose":
      return ["buyer"];
    case "purchaseQuote.approve":
      return ["purchasing_director"];
    // Assinar o contrato pela Wellmix: só as diretorias (decisão do dono,
    // 13/11/2026; mapa do processo, P11: a Diretoria de compras aprova). O
    // administrador muda em Equipe → Funções e acessos.
    case "contract.sign":
      return ["purchasing_director", "executive_director"];
    // Validar a arte: no mapa (P5?) quem aprova é o Marketing (dono,
    // 14/11/2026). Em produção as funções já têm as ações gravadas (Equipe →
    // Funções e acessos), e a troca é feita lá; o padrão do código fica o
    // de antes (quem abre Pedidos).
    case "art.validate":
      return withScreen("orders");
    // Aprovações do mapa no fim dos marcos (dono, 14/11/2026).
    case "approve.productManager":
      return ["product_manager"];
    case "approve.buyer":
      return ["buyer"];
    case "approve.planner":
      return ["planner"];
    case "approve.purchasingDirector":
      return ["purchasing_director"];
    // Preço de compra (dono, 15/11/2026; docs/LINHA_DE_VISAO.md): quem
    // compra e negocia, o Planejamento (decide a solicitação ao fornecedor e
    // gera o pedido de compra; dono, 15/11/2026), as diretorias e o
    // Financeiro (paga o fornecedor e confere a invoice). O administrador
    // muda em Funções e acessos.
    case "purchasePrice.view":
      return [
        "buyer",
        "product_manager",
        "planner",
        "purchasing_director",
        "executive_director",
        "finance",
      ];
    // Só o administrador, como antes. A venda ao cliente (dono, 14/11/2026):
    // só o administrador por padrão; ele libera em Funções e acessos.
    case "order.cancel":
    case "values.view":
    case "sale.record":
      return [];
  }
}

export function defaultActionsFor(fn: WellmixFunction): ActionKey[] {
  return ACTION_KEYS.filter((a) => defaultHolders(a).includes(fn));
}

/** Uma função: de fábrica (as 8 do código) ou criada pelo administrador. */
export interface FunctionDef {
  key: string;
  /** Nome dado pelo administrador; nulo = o nome de fábrica (traduzido). */
  name: string | null;
  builtin: boolean;
  screens: Screen[];
  actions: ActionKey[];
  /**
   * Telas do Início (WELLMIX_BASE) que o administrador desmarcou nesta
   * função. Vazio (o padrão) = a função abre todas, como antes.
   */
  baseOff: Screen[];
  /** Desativada: some das listas e não libera nada (só as criadas). */
  archived: boolean;
}

/** O que fica gravado em `settings.teamFunctions`. */
export interface StoredFunctions {
  functions: Array<{
    key: string;
    name?: string | null;
    screens?: unknown;
    actions?: unknown;
    /**
     * Ações que existiam quando a função foi gravada. Ação nova depois disso
     * vale pelo padrão do código até o administrador salvar a função de novo
     * (sem a lista: as ações de antes de 15/11/2026, `LEGACY_ACTIONS`).
     */
    knownActions?: unknown;
    /**
     * Telas que existiam quando a função foi gravada. Tela nova depois disso
     * vale pelo padrão do código (FUNCTION_SCREENS) até o administrador salvar
     * a função de novo (sem a lista: as telas de antes de 16/11/2026,
     * `LEGACY_SCREENS`).
     */
    knownScreens?: unknown;
    baseOff?: unknown;
    archived?: boolean;
  }>;
}

/**
 * Telas que existiam antes da lista `knownScreens` (16/11/2026). As funções
 * gravadas antes dela recebem as telas novas pelo padrão do código: TS -
 * Trading Sales e Venda - Encomenda (docs/REQUEST_SCREENS.md) chegam ao
 * Comprador, ao Gerente de produto e às diretorias sem mexer no que o
 * administrador já marcou.
 */
export const LEGACY_SCREENS: readonly string[] = [
  "home",
  "tasks",
  "sla",
  "notifications",
  "messages",
  "booking",
  "requests",
  "quotes",
  "orders",
  "production",
  "sourcing",
  "reviews",
  "freight",
  "freightTariff",
  "containers",
  "superplan",
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
];

/**
 * Ações que existiam antes da lista `knownActions` (15/11/2026). Funções
 * gravadas antes dela recebem as ações novas pelo padrão do código.
 */
export const LEGACY_ACTIONS: readonly string[] = [
  "supplierRequest.decide",
  "sampling.validate",
  "dumping.release",
  "approval.planner",
  "approval.purchasing_director",
  "approval.executive_director",
  "purchaseOrder.generate",
  "purchaseOrder.salesNotice",
  "art.validate",
  "art.design",
  "contract.sign",
  "order.cancel",
  "realMedia.approve",
  "approve.productManager",
  "approve.buyer",
  "approve.planner",
  "approve.purchasingDirector",
  "numerario.manage",
  "receiving.follow",
  "container.tracking",
  "receiving.quality",
  "values.view",
  "sale.record",
];

/** Ações gravadas mais as novas (que a função ainda não conhecia) pelo padrão. */
function storedActions(
  key: WellmixFunction,
  actions: unknown,
  known: unknown,
): ActionKey[] {
  const knownList = Array.isArray(known)
    ? (known as unknown[]).filter((a): a is string => typeof a === "string")
    : LEGACY_ACTIONS;
  const saved = validActions(actions);
  const fresh = defaultActionsFor(key).filter(
    (a) => !knownList.includes(a) && !saved.includes(a),
  );
  return ACTION_KEYS.filter((a) => saved.includes(a) || fresh.includes(a));
}

/** Telas gravadas mais as novas (que a função ainda não conhecia) pelo padrão. */
function storedScreens(
  key: WellmixFunction,
  screens: unknown,
  known: unknown,
): Screen[] {
  const knownList = Array.isArray(known)
    ? (known as unknown[]).filter((s): s is string => typeof s === "string")
    : LEGACY_SCREENS;
  const saved = validScreens(screens);
  const fresh = FUNCTION_SCREENS[key].filter(
    (s) => !knownList.includes(s) && !saved.includes(s),
  );
  return inheritUnknown(
    SCREENS.filter((s) => saved.includes(s) || fresh.includes(s)),
    knownList,
  );
}

/**
 * Tela nova que segue outra (SCREEN_PARENT, ex.: a Estratégia de Compra
 * segue as cotações): enquanto a função não sabe dela, vale o que a função
 * tem na tela de origem, e não o padrão do código. Assim ninguém ganha nem
 * perde acesso quando uma página passa a ter tela própria.
 */
function inheritUnknown(list: Screen[], known: readonly string[]): Screen[] {
  return SCREENS.filter((s) => {
    const parent = SCREEN_PARENT[s];
    if (parent && !known.includes(s)) return list.includes(parent);
    return list.includes(s);
  });
}

const knownOf = (known: unknown): readonly string[] =>
  Array.isArray(known)
    ? (known as unknown[]).filter((s): s is string => typeof s === "string")
    : LEGACY_SCREENS;

/** Chave de função criada: "fn_" e o nome sem acento, em minúsculas. */
export const CUSTOM_PREFIX = "fn_";
export const isCustomFunctionKey = (key: string) =>
  key.startsWith(CUSTOM_PREFIX) && /^fn_[a-z0-9_]{1,40}$/.test(key);

export function customFunctionKey(name: string, taken: string[]): string {
  const slug =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "funcao";
  let key = `${CUSTOM_PREFIX}${slug}`;
  for (let n = 2; taken.includes(key); n++)
    key = `${CUSTOM_PREFIX}${slug}_${n}`;
  return key;
}

const validScreens = (v: unknown): Screen[] =>
  Array.isArray(v) ? SCREENS.filter((s) => (v as unknown[]).includes(s)) : [];
/** Só telas do Início (o resto da lista gravada é ignorado). */
const validBaseOff = (v: unknown): Screen[] =>
  validScreens(v).filter((s) => WELLMIX_BASE.includes(s));
const validActions = (v: unknown): ActionKey[] =>
  Array.isArray(v)
    ? ACTION_KEYS.filter((a) => (v as unknown[]).includes(a))
    : [];

/**
 * As funções em uso: as 8 de fábrica (com o que o administrador mudou, ou o
 * padrão do código) e as criadas, nessa ordem. Valor gravado inválido vira o
 * padrão (nunca derruba a tela).
 */
export function resolveFunctions(stored: unknown): FunctionDef[] {
  const list =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredFunctions).functions)
      ? (stored as StoredFunctions).functions.filter(
          (f) => f && typeof f.key === "string",
        )
      : [];
  const saved = new Map(list.map((f) => [f.key, f]));
  const builtins = WELLMIX_FUNCTIONS.map((key): FunctionDef => {
    const s = saved.get(key);
    return {
      key,
      name: typeof s?.name === "string" && s.name.trim() ? s.name.trim() : null,
      builtin: true,
      screens:
        s?.screens !== undefined
          ? storedScreens(key, s.screens, s.knownScreens)
          : [...FUNCTION_SCREENS[key]],
      actions:
        s?.actions !== undefined
          ? storedActions(key, s.actions, s.knownActions)
          : defaultActionsFor(key),
      baseOff: validBaseOff(s?.baseOff),
      archived: false,
    };
  });
  const custom = list
    .filter((f) => isCustomFunctionKey(f.key))
    .map((f): FunctionDef => ({
      key: f.key,
      name: typeof f.name === "string" && f.name.trim() ? f.name.trim() : f.key,
      builtin: false,
      screens: inheritUnknown(validScreens(f.screens), knownOf(f.knownScreens)),
      actions: validActions(f.actions),
      baseOff: validBaseOff(f.baseOff),
      archived: !!f.archived,
    }));
  return [...builtins, ...custom];
}

/**
 * Telas e ações que as funções marcadas liberam (desativadas e desconhecidas
 * não contam). Telas do Início (`base`): a união das que cada função deixa
 * marcadas; sem nenhuma função ativa, todas (o acesso de sempre).
 */
export function accessFromFunctions(
  functions: readonly string[] | null | undefined,
  defs: FunctionDef[],
): ResolvedAccess {
  const active = defs.filter((d) => !d.archived);
  // Telas e Início: a mesma regra que o card de Editar acessos usa na hora.
  const { screens, base } = combineFunctionScreens(
    functions,
    active,
    WELLMIX_BASE,
  );
  const actions = new Set<string>();
  for (const key of functions ?? [])
    active.find((d) => d.key === key)?.actions.forEach((a) => actions.add(a));
  return { screens, actions: [...actions], base };
}

type Who = {
  role: string;
  functions?: readonly string[] | null;
};

const isWellmixRole = (role: string) => role === "admin" || role === "operator";

/**
 * O login pode fazer a ação? Admin: sempre. Operador: alguma função dele a
 * libera (com a configuração passada; senão a guardada nesta requisição;
 * senão o padrão do código). Cliente, fornecedor e parceiros: não.
 */
export function can(
  user: Who,
  action: ActionKey,
  defs?: FunctionDef[],
): boolean {
  if (user.role === "admin") return true;
  if (!isWellmixRole(user.role)) return false;
  const access = defs
    ? accessFromFunctions(user.functions, defs)
    : (accessOf(user) ??
      accessFromFunctions(user.functions, resolveFunctions(null)));
  return access.actions.includes(action);
}

/**
 * Ver valores (venda, recebido, custo, margem) nas listas, exportações e na
 * Control Tower: quem tem a permissão "Ver valores e margem" (o
 * administrador sempre). Abrir a tela Financeiro não concede a ação (dono,
 * 14/11/2026: a tela controla a abertura; a ação, a execução). Registrar e
 * confirmar pagamentos continua sendo da tela Financeiro.
 */
export function canSeeMoney(user: Who): boolean {
  return can(user, "values.view");
}

/**
 * Ver o preço de compra (o que a Wellmix paga ao fornecedor: Book,
 * negociação, pedido, ficha de compra e cadastro do produto) na Wellmix: quem
 * tem "Ver preço de compra" ou "Ver valores e margem" (o administrador
 * sempre). Dono, 15/11/2026 (docs/LINHA_DE_VISAO.md, seção 7). Fora da
 * Wellmix, só pelo contexto (`canSeeOrderPurchasePrice`).
 */
export function canSeePurchasePrice(user: Who): boolean {
  return can(user, "purchasePrice.view") || can(user, "values.view");
}

/**
 * Preço de compra de um pedido: a Wellmix pela permissão; o fornecedor do
 * pedido (é o preço dele) e o despachante do pedido (declara o valor na
 * importação). A certificadora, o cliente e os outros parceiros nunca.
 */
export function canSeeOrderPurchasePrice(
  user: Who & { partyId?: string | null },
  order: { supplierId?: string | null; brokerId?: string | null },
): boolean {
  if (canSeePurchasePrice(user)) return true;
  if (!user.partyId) return false;
  if (user.role === "supplier") return order.supplierId === user.partyId;
  if (user.role === "broker") return order.brokerId === user.partyId;
  return false;
}

/** Server Actions e serviços: recusa (forbidden) quem não tem a ação. */
export function assertCan(user: Who, action: ActionKey) {
  if (!can(user, action)) throw new ForbiddenError();
}

/**
 * Logins da Wellmix cujas funções marcadas liberam a ação (o admin entra só
 * se tiver a função; quem chama usa os admins como reserva quando ninguém
 * tem). É a mesma regra de antes ("quem tem a função"), agora pela ação.
 */
export function holdersOf<U extends Who>(
  users: U[],
  action: ActionKey,
  defs: FunctionDef[],
): U[] {
  return users.filter(
    (u) =>
      isWellmixRole(u.role) &&
      accessFromFunctions(u.functions, defs).actions.includes(action),
  );
}

/**
 * Descrição de uma função de fábrica (o que ela faz no processo), traduzida.
 * Sem o texto no dicionário (função nova sem descrição), nada: a tela não
 * mostra a chave crua.
 */
export function functionDescription(
  key: string,
  translate: (key: string) => string,
): string | null {
  if (!(WELLMIX_FUNCTIONS as readonly string[]).includes(key)) return null;
  const text = translate(`function.desc.${key}`);
  return text && text !== `function.desc.${key}` ? text : null;
}

/** Nome da função para mostrar: o dado pelo administrador, ou o de fábrica traduzido. */
export function functionLabel(
  key: string,
  defs: FunctionDef[],
  translate: (key: string) => string,
): string {
  const def = defs.find((d) => d.key === key);
  if (def?.name) return def.name;
  if ((WELLMIX_FUNCTIONS as readonly string[]).includes(key))
    return translate(`function.${key}`);
  return key;
}
