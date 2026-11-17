/*
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7): o cadastro (do parceiro) e o login têm estados próprios. A pessoa só
 * entra com o login ativo e, quando a regra "cadastro e login ativos" está
 * ligada, com o cadastro da empresa dela ativo também. A regra só passa a
 * valer quando o administrador a liga (decisão D9: antes, ele vê quem seria
 * bloqueado). Regras puras, sem banco.
 */

/** Chave da regra em `settings`. */
export const ACCESS_RULES_KEY = "accessRules";

export interface AccessRules {
  /** Ligada: login de parceiro com o cadastro inativo não entra. */
  requireActiveParty: boolean;
  /** Quando e quem mudou por último (mostrado ao administrador). */
  changedAt: string | null;
  changedBy: string | null;
}

export const DEFAULT_ACCESS_RULES: AccessRules = {
  requireActiveParty: false,
  changedAt: null,
  changedBy: null,
};

/** O que impede o acesso: o login, o cadastro ou os dois. */
export const ACCESS_BLOCKS = [
  "login_inactive",
  "party_inactive",
  "blocked_both",
] as const;
export type AccessBlock = (typeof ACCESS_BLOCKS)[number];

export const isAccessBlock = (value: unknown): value is AccessBlock =>
  typeof value === "string" &&
  (ACCESS_BLOCKS as readonly string[]).includes(value);

/** A regra gravada (valor de `settings`), com o padrão para o que faltar. */
export function parseAccessRules(value: unknown): AccessRules {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ...DEFAULT_ACCESS_RULES };
  const v = value as Record<string, unknown>;
  return {
    requireActiveParty: v.requireActiveParty === true,
    changedAt: typeof v.changedAt === "string" ? v.changedAt : null,
    changedBy: typeof v.changedBy === "string" ? v.changedBy : null,
  };
}

/**
 * Por que o login não entra (nulo: entra, se as permissões deixarem).
 * - login desativado: sempre bloqueia;
 * - cadastro inativo: bloqueia só com a regra ligada e só login de parceiro
 *   (com cadastro); cadastro que não foi achado não bloqueia (como antes).
 */
export function accessBlockOf(
  user: { active: boolean; partyId: string | null },
  party: { active: boolean } | null,
  rules: Pick<AccessRules, "requireActiveParty">,
): AccessBlock | null {
  const loginOff = !user.active;
  const partyOff =
    rules.requireActiveParty && !!user.partyId && !!party && !party.active;
  if (loginOff && partyOff) return "blocked_both";
  if (loginOff) return "login_inactive";
  if (partyOff) return "party_inactive";
  return null;
}
