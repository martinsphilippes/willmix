import { matchesQuery } from "./table-tools";

/*
 * Equipe Interna (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa 5): a
 * equipe da Wellmix em linhas (Nome | Cargo | Área | Função | Responde a |
 * Telas), um filtro em cada coluna (texto no Nome; opções tiradas dos dados
 * no Cargo, na Área, na Função e no Responde a) e a busca em toda a tabela.
 * Os painéis abrem por parâmetro no endereço (?panel=…&id=…), e fechar volta
 * à lista como estava. Regras puras, sem banco: a página monta as linhas e
 * chama daqui.
 */

/** Filtros de coluna, na ordem das colunas (o nome é o parâmetro no endereço). */
export const TEAM_FILTERS = [
  "name",
  "position",
  "area",
  "function",
  "manager",
] as const;
export type TeamFilterKey = (typeof TEAM_FILTERS)[number];

export type TeamFilters = Record<TeamFilterKey, string> & {
  /** Busca em toda a tabela (as colunas e o login). */
  q: string;
  /** Só os logins "a conferir" (?review=1, da importação da planilha). */
  review: boolean;
};

/** Valor dos filtros de lista para o campo vazio (sem cargo, área, função ou gestor). */
export const TEAM_NONE = "-";

export interface TeamRow {
  id: string;
  name: string;
  /** Login como a tela mostra (e-mail ou usuário). */
  login: string;
  positionId: string | null;
  /** Nome do cargo ("" sem cargo). */
  positionName: string;
  areaId: string | null;
  /** Nome da área ("" sem área). */
  areaName: string;
  /** Funções ativas da pessoa, no idioma do login. */
  functions: { key: string; label: string }[];
  managerId: string | null;
  /** Nome de quem a pessoa responde ("" sem gestor ou gestor fora da equipe). */
  managerName: string;
  /** Telas que abre; null = todas (administrador). */
  screens: number | null;
  /** "A conferir" (o motivo), da importação da planilha. */
  review: string | null;
}

const MAX = 120;

/** Painéis da lista (?panel=…). */
export const TEAM_PANELS = [
  "person",
  "position",
  "area",
  "function",
  "manager",
  "screens",
  // Quem saiu da equipe, para reativar (D8 e R7).
  "former",
] as const;
export type TeamPanel = (typeof TEAM_PANELS)[number];

export const isTeamPanel = (value: unknown): value is TeamPanel =>
  typeof value === "string" &&
  (TEAM_PANELS as readonly string[]).includes(value);

/** Filtros do endereço, limpos (texto com no máximo 120 caracteres). */
export function parseTeamFilters(
  sp: Record<string, string | string[] | undefined>,
): TeamFilters {
  const one = (key: string) => {
    const value = sp[key];
    return typeof value === "string" ? value.trim().slice(0, MAX) : "";
  };
  return {
    q: one("q"),
    name: one("name"),
    position: one("position"),
    area: one("area"),
    function: one("function"),
    manager: one("manager"),
    review: one("review") === "1",
  };
}

/** Quantos filtros de coluna, de busca e o "a conferir" estão em uso. */
export function activeTeamFilterCount(filters: TeamFilters): number {
  return (
    TEAM_FILTERS.filter((key) => filters[key] !== "").length +
    (filters.q ? 1 : 0) +
    (filters.review ? 1 : 0)
  );
}

/** Igual ao valor do filtro (ou vazio, com o filtro "—"). */
const matchesId = (value: string | null, filter: string) =>
  filter === TEAM_NONE ? !value : value === filter;

/** Aplica os filtros de coluna (a busca em toda a tabela fica com a serverTable). */
export function applyTeamFilters(
  rows: readonly TeamRow[],
  filters: TeamFilters,
): TeamRow[] {
  return rows.filter((row) => {
    if (filters.name && !matchesQuery(`${row.name} ${row.login}`, filters.name))
      return false;
    if (filters.position && !matchesId(row.positionId, filters.position))
      return false;
    if (filters.area && !matchesId(row.areaId, filters.area)) return false;
    if (filters.function) {
      if (filters.function === TEAM_NONE) {
        if (row.functions.length) return false;
      } else if (!row.functions.some((f) => f.key === filters.function))
        return false;
    }
    if (filters.manager && !matchesId(row.managerId, filters.manager))
      return false;
    if (filters.review && !row.review) return false;
    return true;
  });
}

export interface TeamOption {
  value: string;
  label: string;
}

const byLabel = (a: TeamOption, b: TeamOption) =>
  a.label.localeCompare(b.label, "pt", { sensitivity: "base" });

/**
 * Opções dos filtros de lista, tiradas dos dados (o que existe na lista):
 * cargos, áreas, funções e gestores, e se há linha sem cada um (opção "—").
 */
export function teamFilterOptions(rows: readonly TeamRow[]): {
  positions: TeamOption[];
  noPosition: boolean;
  areas: TeamOption[];
  noArea: boolean;
  functions: TeamOption[];
  noFunction: boolean;
  managers: TeamOption[];
  noManager: boolean;
} {
  const positions = new Map<string, string>();
  const areas = new Map<string, string>();
  const functions = new Map<string, string>();
  const managers = new Map<string, string>();
  let noPosition = false;
  let noArea = false;
  let noFunction = false;
  let noManager = false;
  for (const row of rows) {
    if (row.positionId)
      positions.set(row.positionId, row.positionName || row.positionId);
    else noPosition = true;
    if (row.areaId) areas.set(row.areaId, row.areaName || row.areaId);
    else noArea = true;
    if (row.functions.length)
      row.functions.forEach((f) => functions.set(f.key, f.label));
    else noFunction = true;
    if (row.managerId)
      managers.set(row.managerId, row.managerName || row.managerId);
    else noManager = true;
  }
  const list = (map: Map<string, string>) =>
    [...map].map(([value, label]) => ({ value, label })).sort(byLabel);
  return {
    positions: list(positions),
    noPosition,
    areas: list(areas),
    noArea,
    functions: list(functions),
    noFunction,
    managers: list(managers),
    noManager,
  };
}

/** Parâmetros que um endereço da lista pode mudar (ordem e o painel aberto). */
export type TeamHrefPatch = Partial<
  Record<
    "sort" | "page" | "panel" | "id" | "of" | "mode" | "scope" | "screen",
    string | null
  >
>;

/**
 * Endereço da lista com os filtros de agora e o que mudar (ordem, painel
 * aberto e o registro dele). Valor vazio ou nulo sai do endereço.
 */
export function teamListHref(
  filters: TeamFilters,
  patch: TeamHrefPatch = {},
  base = "/app/team",
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of TEAM_FILTERS)
    if (filters[key]) params.set(key, filters[key]);
  if (filters.review) params.set("review", "1");
  for (const [key, value] of Object.entries(patch))
    if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Endereços antigos com "#" (o servidor não vê o "#"; o navegador converte ao
 * chegar): `#u-<id>` era a linha da pessoa e vira o painel dela (depois de
 * salvar, só rola até a linha); `#distribute`
 * era a distribuição, que fica em Linhas e divisões. Os demais (`#a-`, `#p-`,
 * `#l-`) continuam rolando até a linha na aba deles. Nulo = nada a converter.
 */
export function legacyTeamHash(hash: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") ?? "team";
  const person = /^#u-([A-Za-z0-9][A-Za-z0-9_.-]{0,63})$/.exec(hash);
  // Depois de salvar na página da pessoa (?saved=member#u-…), o "#" só rola
  // até a linha salva, com o aviso; não reabre o painel.
  if (person && tab === "team" && !params.has("saved")) {
    params.set("panel", "person");
    params.set("id", person[1]);
    return `/app/team?${params.toString()}`;
  }
  if (hash === "#distribute" && tab !== "lines") {
    params.set("tab", "lines");
    return `/app/team?${params.toString()}#distribute`;
  }
  return null;
}
