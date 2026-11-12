import {
  ROLE_SCREENS,
  SCREENS,
  isScreen,
  type Screen,
} from "@/lib/auth/screens";
import { PARTNER_LOGIN_ROLE } from "@/lib/partner-types";

/*
 * Gestão de telas dos logins externos (docs/PARTNER_ACCESS.md): que telas
 * cada perfil abre e quais aparecem no menu. Regras puras, usadas pela tela,
 * pelo serviço, pela sessão e pelos testes.
 *
 * Perfil = "role:<papel>" (cliente, fornecedor e os parceiros de sempre) ou
 * "type:<tipo>" (Trading, Factory, Supplier, GP e os criados no painel).
 * Sem nada gravado, vale o padrão: o do papel, ou o do Fornecedor nos tipos
 * novos. O que o administrador muda fica gravado por perfil, independente.
 */

export type ExternalRole = keyof typeof ROLE_SCREENS;
export const EXTERNAL_ROLES = Object.keys(ROLE_SCREENS) as ExternalRole[];

/**
 * Telas que um login externo pode receber: as que já são de algum papel
 * externo (cliente, fornecedor, parceiros), feitas para mostrar a cada um só
 * os próprios registros. As telas internas da Wellmix aparecem no catálogo,
 * bloqueadas: liberá-las a um externo mostraria dados de todos.
 */
export const GRANTABLE_SCREENS: readonly Screen[] = SCREENS.filter((s) =>
  EXTERNAL_ROLES.some((r) => ROLE_SCREENS[r].includes(s)),
);
export const isGrantable = (screen: Screen) =>
  GRANTABLE_SCREENS.includes(screen);

/** Papel de login por trás do perfil: o próprio papel; nos tipos novos, o do Fornecedor. */
export function baseRoleOf(profileKey: string): ExternalRole {
  const [kind, name] = profileKey.split(":");
  return (kind === "role" ? name : PARTNER_LOGIN_ROLE) as ExternalRole;
}

/**
 * Telas que mostram a qualquer login os dados da empresa dele (início,
 * pendências, notificações, mensagens, pedidos e multas): funcionam inteiras
 * para qualquer perfil.
 */
const OWN_DATA_SCREENS: readonly Screen[] = [
  "home",
  "tasks",
  "notifications",
  "messages",
  "orders",
  "penalties",
];

/*
 * Qualquer tela de login externo pode ir para qualquer perfil (conferência
 * de 11/11/2026: aberta por outro papel, cada uma mostra só os dados da
 * empresa de quem abre, vem vazia ou recusa; nenhuma mostra dados de outra
 * empresa). As internas da Wellmix continuam fora (`isGrantable`).
 */

/**
 * A tela foi feita para outro papel e o conteúdo dela ainda é só dos
 * registros daquele papel (ex.: a vitrine é do cliente; as solicitações ao
 * fornecedor, do fornecedor): liberada a este perfil, abre vazia ou volta ao
 * início, até ser adaptada para os dados dele.
 */
export const isLimitedFor = (screen: Screen, profileKey: string) =>
  isGrantable(screen) &&
  !OWN_DATA_SCREENS.includes(screen) &&
  !(ROLE_SCREENS[baseRoleOf(profileKey)] ?? []).includes(screen);

/** Papéis externos que têm a tela de fábrica (o "tipo de origem" no catálogo). */
export const originRoles = (screen: Screen): ExternalRole[] =>
  EXTERNAL_ROLES.filter((r) => ROLE_SCREENS[r].includes(screen));

/** Sempre aberta (o início): sem ela o login não entra em lugar nenhum. */
export const ALWAYS_OPEN: readonly Screen[] = ["home"];

/** De onde veio a configuração de uma tela no perfil. */
export type ScreenSource = "default" | "manual" | `copy:${string}`;

export interface StoredProfile {
  screens: string[];
  /** Abre, mas não aparece no menu (chega-se por link). */
  menuHidden: string[];
  sources: Record<string, string>;
}
export type PartnerAccessConfig = Record<string, StoredProfile>;

export interface ProfileAccess {
  screens: Screen[];
  menuHidden: Screen[];
  sources: Partial<Record<Screen, ScreenSource>>;
  /** O administrador já mudou este perfil (senão é o padrão de fábrica). */
  custom: boolean;
}

export const isProfileKey = (key: string) =>
  /^(role|type):[a-z0-9_]{1,80}$/.test(key);

/** Padrão de fábrica: o do papel; nos tipos novos, o do Fornecedor. */
export function defaultScreens(profileKey: string): Screen[] {
  return [...(ROLE_SCREENS[baseRoleOf(profileKey)] ?? [])];
}

const valid = (list: unknown): Screen[] =>
  Array.isArray(list)
    ? [...new Set(list.filter(isScreen))].filter(isGrantable)
    : [];

/** Telas do perfil: o gravado pelo administrador ou o padrão. */
export function resolveProfile(
  config: PartnerAccessConfig | null | undefined,
  profileKey: string,
): ProfileAccess {
  const stored = config?.[profileKey];
  if (!stored) {
    const screens = defaultScreens(profileKey);
    return {
      screens,
      menuHidden: [],
      sources: Object.fromEntries(screens.map((s) => [s, "default"])),
      custom: false,
    };
  }
  // O gravado nunca vale mais que as telas de login externo (as internas da
  // Wellmix saem, mesmo que estejam gravadas).
  const screens = [
    ...new Set([...ALWAYS_OPEN, ...valid(stored.screens)]),
  ].filter(isGrantable);
  const sources: ProfileAccess["sources"] = {};
  for (const s of screens)
    sources[s] = (stored.sources?.[s] as ScreenSource) ?? "default";
  return {
    screens,
    menuHidden: valid(stored.menuHidden).filter(
      (s) => screens.includes(s) && !ALWAYS_OPEN.includes(s),
    ),
    sources,
    custom: true,
  };
}

const store = (access: ProfileAccess): StoredProfile => ({
  screens: access.screens,
  menuHidden: access.menuHidden,
  sources: access.sources as Record<string, string>,
});

/** O que muda numa tela entre duas configurações do mesmo perfil. */
export interface ScreenChange {
  screen: Screen;
  change: "added" | "removed" | "menu_shown" | "menu_hidden";
}

export function diffProfiles(
  before: ProfileAccess,
  after: ProfileAccess,
): ScreenChange[] {
  const out: ScreenChange[] = [];
  for (const screen of SCREENS) {
    const was = before.screens.includes(screen);
    const is = after.screens.includes(screen);
    if (!was && is) out.push({ screen, change: "added" });
    else if (was && !is) out.push({ screen, change: "removed" });
    else if (was && is) {
      const hidWas = before.menuHidden.includes(screen);
      const hidIs = after.menuHidden.includes(screen);
      if (hidWas && !hidIs) out.push({ screen, change: "menu_shown" });
      if (!hidWas && hidIs) out.push({ screen, change: "menu_hidden" });
    }
  }
  return out;
}

/**
 * Conceder pelo catálogo: grava as telas abertas e as escondidas do menu de
 * um perfil. Tela interna ou desconhecida recusa; o início fica sempre.
 */
export function setProfileScreens(
  config: PartnerAccessConfig,
  profileKey: string,
  input: { screens: string[]; menuHidden: string[] },
): PartnerAccessConfig {
  if (!isProfileKey(profileKey)) throw new Error("partner_access_profile");
  for (const s of input.screens)
    if (!isScreen(s) || !isGrantable(s as Screen))
      throw new Error("partner_access_internal_screen");
  const before = resolveProfile(config, profileKey);
  const screens = [...new Set([...ALWAYS_OPEN, ...valid(input.screens)])];
  const sources: ProfileAccess["sources"] = {};
  for (const s of screens)
    // Já estava: mantém a origem; entrou agora: liberada à mão.
    sources[s] = before.screens.includes(s)
      ? (before.sources[s] ?? "default")
      : "manual";
  const after: ProfileAccess = {
    screens,
    menuHidden: valid(input.menuHidden).filter(
      (s) => screens.includes(s) && !ALWAYS_OPEN.includes(s),
    ),
    sources,
    custom: true,
  };
  return { ...config, [profileKey]: store(after) };
}

/**
 * Copiar acesso à tela: leva do perfil de origem para o de destino o estado
 * das telas escolhidas (abre ou não, aparece no menu ou não). "add" só
 * acrescenta; "replace" deixa cada tela escolhida igual à da origem (pode
 * tirar). A origem não muda; a cópia fica editável no destino.
 */
export function copyScreens(
  config: PartnerAccessConfig,
  from: string,
  to: string,
  screens: string[],
  mode: "add" | "replace",
): PartnerAccessConfig {
  if (!isProfileKey(from) || !isProfileKey(to) || from === to)
    throw new Error("partner_access_profile");
  const picked = valid(screens);
  if (!picked.length) throw new Error("partner_access_pick");
  const source = resolveProfile(config, from);
  const before = resolveProfile(config, to);
  const open = new Set(before.screens);
  const hidden = new Set(before.menuHidden);
  const sources = { ...before.sources };
  for (const screen of picked) {
    const has = source.screens.includes(screen);
    if (has) {
      const changed =
        !open.has(screen) ||
        (mode === "replace" &&
          hidden.has(screen) !== source.menuHidden.includes(screen));
      open.add(screen);
      if (mode === "replace" || !before.screens.includes(screen)) {
        if (source.menuHidden.includes(screen)) hidden.add(screen);
        else hidden.delete(screen);
      }
      if (changed) sources[screen] = `copy:${from}`;
    } else if (mode === "replace" && !ALWAYS_OPEN.includes(screen)) {
      open.delete(screen);
      hidden.delete(screen);
      delete sources[screen];
    }
  }
  const after: ProfileAccess = {
    screens: SCREENS.filter((s) => open.has(s)),
    menuHidden: SCREENS.filter((s) => hidden.has(s) && open.has(s)),
    sources,
    custom: true,
  };
  return { ...config, [to]: store(after) };
}

/** Volta o perfil ao padrão de fábrica. */
export function resetProfile(
  config: PartnerAccessConfig,
  profileKey: string,
): PartnerAccessConfig {
  const next = { ...config };
  delete next[profileKey];
  return next;
}

/** Perfil de um login externo: o do tipo do parceiro (se tiver) ou o do papel. */
export function profileKeyOf(
  role: string,
  partyProfileKey: string | null | undefined,
): string {
  return partyProfileKey ?? `role:${role}`;
}
