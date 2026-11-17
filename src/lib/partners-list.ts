import { matchesQuery } from "./table-tools";

/*
 * Equipe Externa (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md): a lista de
 * parceiros com um filtro em cada coluna (Nome | Tipo | Situação | Login de
 * Acesso | País | E-mail) e a busca em toda a tabela. Os filtros e a busca
 * valem antes da paginação, no servidor, para a lista inteira (milhares de
 * fornecedores). Regras puras, sem banco: a página monta as linhas e chama
 * daqui.
 */

/** Filtros de coluna, na ordem das colunas (o nome é o parâmetro no endereço). */
export const PARTNER_FILTERS = [
  "name",
  "type",
  "status",
  "logins",
  "country",
  "email",
] as const;
export type PartnerFilterKey = (typeof PARTNER_FILTERS)[number];

export type PartnerFilters = Record<PartnerFilterKey, string> & {
  /** Busca em toda a tabela (as seis colunas e, para o administrador, os logins). */
  q: string;
};

/** Valor do filtro de País para o cadastro sem país. */
export const NO_COUNTRY = "-";

/** Situação do cadastro: o filtro aceita só estes valores. */
export const PARTNER_STATUSES = ["active", "inactive"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface PartnerRow<P = unknown> {
  party: P;
  id: string;
  name: string;
  /** Tipo como o filtro guarda (supplier, trading, partner:chave…). */
  typeValue: string;
  /** Tipo como a tela mostra, no idioma do login. */
  typeLabel: string;
  active: boolean;
  /** Logins ativos ligados ao cadastro. */
  logins: number;
  /** Logins desativados ligados ao cadastro. */
  inactiveLogins: number;
  /** País como está no cadastro ("" sem país). */
  country: string;
  /** E-mail do cadastro ("" sem e-mail). */
  email: string;
  /** Identificadores dos logins (e-mail ou usuário): só a busca do administrador. */
  loginIds: string[];
}

const MAX = 120;

/** Filtros do endereço, limpos (texto com no máximo 120 caracteres). */
export function parsePartnerFilters(
  sp: Record<string, string | string[] | undefined>,
): PartnerFilters {
  const one = (key: string) => {
    const value = sp[key];
    return typeof value === "string" ? value.trim().slice(0, MAX) : "";
  };
  const status = one("status");
  const logins = one("logins");
  return {
    q: one("q"),
    name: one("name"),
    type: one("type"),
    status: (PARTNER_STATUSES as readonly string[]).includes(status)
      ? status
      : "",
    // Quantidade de logins ativos: "0" (sem login), "1", "2"...
    logins: /^\d{1,4}$/.test(logins) ? String(Number(logins)) : "",
    country: one("country"),
    email: one("email"),
  };
}

/** Quantos filtros de coluna e de busca estão em uso. */
export function activeFilterCount(filters: PartnerFilters): number {
  return (
    PARTNER_FILTERS.filter((key) => filters[key] !== "").length +
    (filters.q ? 1 : 0)
  );
}

/** Aplica os filtros de coluna (a busca em toda a tabela fica com a serverTable). */
export function applyPartnerFilters<P>(
  rows: readonly PartnerRow<P>[],
  filters: PartnerFilters,
): PartnerRow<P>[] {
  return rows.filter((row) => {
    if (filters.name && !matchesQuery(row.name, filters.name)) return false;
    if (filters.type && row.typeValue !== filters.type) return false;
    if (filters.status === "active" && !row.active) return false;
    if (filters.status === "inactive" && row.active) return false;
    if (filters.logins && String(row.logins) !== filters.logins) return false;
    if (filters.country) {
      if (filters.country === NO_COUNTRY) {
        if (row.country) return false;
      } else if (row.country !== filters.country) return false;
    }
    if (filters.email && !matchesQuery(row.email, filters.email)) return false;
    return true;
  });
}

/**
 * Opções dos filtros de lista, tiradas dos dados (o que existe na lista, não
 * um catálogo fixo): situações, quantidades de logins e países.
 */
export function partnerFilterOptions<P>(rows: readonly PartnerRow<P>[]): {
  statuses: PartnerStatus[];
  logins: number[];
  countries: string[];
  /** Há cadastro sem país (opção "—"). */
  noCountry: boolean;
} {
  const statuses = new Set<PartnerStatus>();
  const logins = new Set<number>();
  const countries = new Set<string>();
  let noCountry = false;
  for (const row of rows) {
    statuses.add(row.active ? "active" : "inactive");
    logins.add(row.logins);
    if (row.country) countries.add(row.country);
    else noCountry = true;
  }
  return {
    statuses: PARTNER_STATUSES.filter((s) => statuses.has(s)),
    logins: [...logins].sort((a, b) => a - b),
    countries: [...countries].sort((a, b) =>
      a.localeCompare(b, "pt", { sensitivity: "base" }),
    ),
    noCountry,
  };
}

/**
 * Endereço da lista com os filtros de agora e o que mudar (ordem, página,
 * painel aberto). Valor vazio ou nulo sai do endereço.
 */
export function partnerListHref(
  filters: PartnerFilters,
  patch: Partial<
    Record<"sort" | "page" | "panel" | "party", string | null>
  > = {},
  base = "/app/parties",
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of PARTNER_FILTERS)
    if (filters[key]) params.set(key, filters[key]);
  for (const [key, value] of Object.entries(patch))
    if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
