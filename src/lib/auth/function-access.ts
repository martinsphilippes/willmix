import {
  FUNCTION_SCREENS,
  SCREENS,
  canOpen,
  type Screen,
} from "@/lib/auth/screens";
import { accessOf, type ResolvedAccess } from "@/lib/auth/access-cache";
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
    ],
  },
  {
    key: "order",
    actions: ["art.validate", "art.design", "contract.sign", "order.cancel"],
  },
  {
    key: "logistics",
    actions: ["numerario.manage", "receiving.follow"],
  },
  {
    key: "money",
    actions: ["values.view"],
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
    case "receiving.follow":
      return ["buyer"];
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
    // Assinar o contrato pela Wellmix: só as diretorias (decisão do dono,
    // 13/11/2026; mapa do processo, P11: a Diretoria de compras aprova). O
    // administrador muda em Equipe → Funções e acessos.
    case "contract.sign":
      return ["purchasing_director", "executive_director"];
    case "art.validate":
      return withScreen("orders");
    // Só o administrador, como antes.
    case "order.cancel":
    case "values.view":
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
    archived?: boolean;
  }>;
}

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
          ? validScreens(s.screens)
          : [...FUNCTION_SCREENS[key]],
      actions:
        s?.actions !== undefined
          ? validActions(s.actions)
          : defaultActionsFor(key),
      archived: false,
    };
  });
  const custom = list
    .filter((f) => isCustomFunctionKey(f.key))
    .map((f): FunctionDef => ({
      key: f.key,
      name: typeof f.name === "string" && f.name.trim() ? f.name.trim() : f.key,
      builtin: false,
      screens: validScreens(f.screens),
      actions: validActions(f.actions),
      archived: !!f.archived,
    }));
  return [...builtins, ...custom];
}

/** Telas e ações que as funções marcadas liberam (desativadas e desconhecidas não contam). */
export function accessFromFunctions(
  functions: readonly string[] | null | undefined,
  defs: FunctionDef[],
): ResolvedAccess {
  const screens = new Set<string>();
  const actions = new Set<string>();
  for (const key of functions ?? []) {
    const def = defs.find((d) => d.key === key && !d.archived);
    if (!def) continue;
    def.screens.forEach((s) => screens.add(s));
    def.actions.forEach((a) => actions.add(a));
  }
  return { screens: [...screens], actions: [...actions] };
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
 * Control Tower: quem abre Financeiro ou tem a permissão "Ver valores e
 * margem". Registrar e confirmar pagamentos continua sendo da tela Financeiro.
 */
export function canSeeMoney(user: Who & { screens?: unknown }): boolean {
  return (
    canOpen(user as Parameters<typeof canOpen>[0], "finance") ||
    can(user, "values.view")
  );
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
