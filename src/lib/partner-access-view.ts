/*
 * Endereço da aba Acessos externos (Cadastros → Parceiros; dono,
 * 14/11/2026): a visão (por tipo ou perfil, por tela), os filtros e o painel
 * lateral aberto (comparar ou copiar) vivem no endereço. Fechar um painel
 * volta ao mesmo endereço sem ele: a visão e os filtros continuam. Os
 * endereços antigos da Gestão de telas (?view=copy, ?view=compare) abrem o
 * painel correspondente. Regras puras, usadas pela página e pelos testes.
 */

export const ACCESS_BASE = "/app/parties/access";

export type AccessView = "profile" | "screen";
export type AccessPanel = "compare" | "copy";
export const ACCESS_STATES = ["open", "hidden", "blocked", "internal"] as const;
export type AccessStateFilter = (typeof ACCESS_STATES)[number];

export interface AccessUrlState {
  view: AccessView;
  panel: AccessPanel | null;
  /** Perfil da visão por tipo ou perfil ("type:trading", "role:supplier"). */
  profile: string;
  /** Busca por nome ou endereço da tela. */
  q: string;
  state: AccessStateFilter | "";
  /** Tela em destaque (vinda da visão por tela, para editar). */
  focus: string;
  /** Tela da visão por tela. */
  screen: string;
  /** Comparar: os dois perfis e se mostra só as diferenças. */
  a: string;
  b: string;
  all: boolean;
  /** Copiar: origem, destino, telas, modo e se já pediu a prévia. */
  from: string;
  to: string;
  screens: string[];
  mode: "add" | "replace";
  preview: boolean;
}

type Params = Record<string, string | string[] | undefined>;

const PROFILE = /^(role|type):[a-z0-9_]{1,80}$/;
const SCREEN = /^[A-Za-z]{1,40}$/;

const one = (sp: Params, key: string) => {
  const v = sp[key];
  return typeof v === "string" ? v : "";
};
const many = (sp: Params, key: string) => {
  const v = sp[key];
  return (Array.isArray(v) ? v : v ? [v] : []).filter(
    (x): x is string => typeof x === "string",
  );
};
const profileOr = (v: string) => (PROFILE.test(v) ? v : "");
const screenOr = (v: string) => (SCREEN.test(v) ? v : "");

export function parseAccessUrl(sp: Params): AccessUrlState {
  const rawView = one(sp, "view");
  const rawPanel = one(sp, "panel");
  // Endereço antigo: ?view=copy e ?view=compare viraram painéis laterais
  // sobre a visão por tipo ou perfil.
  const legacy =
    rawView === "copy" || rawView === "compare"
      ? (rawView as AccessPanel)
      : null;
  const panel: AccessPanel | null =
    rawPanel === "copy" || rawPanel === "compare" ? rawPanel : legacy;
  const view: AccessView = rawView === "screen" ? "screen" : "profile";
  const state = one(sp, "state");
  return {
    view,
    panel,
    profile: profileOr(one(sp, "profile")),
    q: one(sp, "q").trim().slice(0, 120),
    state: (ACCESS_STATES as readonly string[]).includes(state)
      ? (state as AccessStateFilter)
      : "",
    focus: screenOr(one(sp, "focus")),
    screen: screenOr(one(sp, "screen")),
    a: profileOr(one(sp, "a")),
    b: profileOr(one(sp, "b")),
    all: one(sp, "all") === "1",
    from: profileOr(one(sp, "from")),
    to: profileOr(one(sp, "to")),
    screens: [...new Set(many(sp, "screens").filter((s) => SCREEN.test(s)))],
    mode: one(sp, "mode") === "replace" ? "replace" : "add",
    preview: one(sp, "preview") === "1",
  };
}

/**
 * Os parâmetros da página por baixo dos painéis: a visão e os filtros. Ao
 * fechar um painel, é para cá que se volta.
 */
export function baseParams(
  s: Pick<AccessUrlState, "view" | "profile" | "q" | "state" | "screen">,
): URLSearchParams {
  const p = new URLSearchParams();
  if (s.view === "screen") {
    p.set("view", "screen");
    if (s.screen) p.set("screen", s.screen);
  }
  if (s.profile) p.set("profile", s.profile);
  if (s.q) p.set("q", s.q);
  if (s.state) p.set("state", s.state);
  return p;
}

const href = (p: URLSearchParams) => {
  const query = p.toString();
  return query ? `${ACCESS_BASE}?${query}` : ACCESS_BASE;
};

/** A página sem painel (fechar o painel). */
export const closePanelHref = (s: AccessUrlState) => href(baseParams(s));

/** Abre um painel sobre a página como está. */
export function panelHref(
  s: AccessUrlState,
  panel: AccessPanel,
  extra: Record<string, string> = {},
): string {
  const p = baseParams(s);
  p.set("panel", panel);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return href(p);
}

/** Troca entre as duas visões, mantendo o perfil, a tela e os filtros. */
export function viewHref(s: AccessUrlState, view: AccessView): string {
  return href(baseParams({ ...s, view }));
}

/** Edição de um perfil com uma tela em destaque (vinda da visão por tela). */
export function editHref(profile: string, screen: string): string {
  const p = new URLSearchParams({ profile, focus: screen });
  return `${ACCESS_BASE}?${p.toString()}#access-${screen}`;
}

/*
 * Ligação entre as abas Tipos de parceiro e Acessos externos (dono,
 * 16/11/2026): "Configurar telas" (do tipo para o perfil de telas) e
 * "Editar tipo" (do perfil para o tipo), e o aviso quando o endereço pede um
 * perfil que não está na lista.
 */

/** A aba Tipos de parceiro. */
export const PARTNER_TYPES_BASE = "/app/parties/types";

/** Acessos externos já no perfil (o link "Configurar telas"). */
export const profileHref = (profileKey: string) =>
  `${ACCESS_BASE}?${new URLSearchParams({ profile: profileKey }).toString()}`;

/** Tipos de parceiro com o painel "Editar" do tipo aberto (o link "Editar tipo"). */
export const typeEditHref = (value: string) =>
  `${PARTNER_TYPES_BASE}?${new URLSearchParams({ panel: "edit", type: value }).toString()}`;

/**
 * O endereço pediu um perfil que não está na lista (o tipo deixou de
 * permitir login, foi trocado ou o link é antigo). Devolve o que foi pedido,
 * para o aviso; nulo quando nada foi pedido ou o perfil existe. A página
 * continua mostrando o primeiro perfil, agora com o aviso.
 */
export function missingProfile(
  requested: string | string[] | undefined,
  known: readonly string[],
): string | null {
  const raw = typeof requested === "string" ? requested.trim() : "";
  if (!raw) return null;
  return known.includes(raw) ? null : raw.slice(0, 80);
}
