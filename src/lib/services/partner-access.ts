import "server-only";
import { cache } from "react";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { getStore, type Party, type User } from "@/lib/db";
import { FEATURED_PARTY_TYPES } from "@/lib/party-types";
import {
  EXTERNAL_ROLES,
  copyScreens,
  diffProfiles,
  isProfileKey,
  resetProfile,
  resolveProfile,
  setProfileScreens,
  type PartnerAccessConfig,
  type ProfileAccess,
  type ScreenChange,
  ANY_PROFILE_EXTRAS,
  hasProfileExtras,
} from "@/lib/partner-access";
import {
  PARTNER_LOGIN_ROLE,
  partnerTypeCatalog,
  type PartnerTypeEntry,
} from "@/lib/partner-types";
import { audit } from "./audit";
import { listPartnerTypeRows } from "./partner-types";

/*
 * Gestão de telas dos logins externos (docs/PARTNER_ACCESS.md). A
 * configuração fica em `settings` (chave `partnerAccess`), um perfil por
 * chave. Só o administrador muda; cada mudança vai para a auditoria com
 * antes, depois, origem e destino. A sessão lê a cada requisição: o que foi
 * revogado deixa de abrir na operação seguinte.
 */

export const PARTNER_ACCESS_KEY = "partnerAccess";

async function readConfig(): Promise<{
  id: string | null;
  config: PartnerAccessConfig;
}> {
  const [row] = await getStore().list("settings", {
    filter: { key: PARTNER_ACCESS_KEY },
    limit: 1,
  });
  const value = row?.value;
  return {
    id: row?.id ?? null,
    config:
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as PartnerAccessConfig)
        : {},
  };
}

/** A configuração em uso (uma leitura por requisição). */
export const loadPartnerAccess = cache(
  async (): Promise<PartnerAccessConfig> => (await readConfig()).config,
);

/** Perfil de telas do parceiro: o do tipo (novos) ou nulo (vale o do papel). */
async function partyProfileKey(party: Party | null): Promise<string | null> {
  if (!party) return null;
  if (FEATURED_PARTY_TYPES.includes(party.type)) return `type:${party.type}`;
  if (party.type !== "partner" || !party.partnerTypeId) return null;
  const entry = partnerTypeCatalog(await listPartnerTypeRows()).find(
    (e) => e.rowId === party.partnerTypeId,
  );
  return entry?.profileKey ?? null;
}

/** Perfil de um login externo (para a sessão e para a visão por usuário). */
export async function profileKeyOfUser(
  user: Pick<User, "role" | "partyId">,
): Promise<string> {
  const party = user.partyId
    ? await getStore().get("parties", user.partyId)
    : null;
  return (await partyProfileKey(party)) ?? `role:${user.role}`;
}

/**
 * Telas do login externo pela Gestão de telas. Nulo = nada foi mudado para o
 * perfil dele: vale o padrão de fábrica do papel. Sem nada gravado, só o
 * login que entra como o Fornecedor custa uma leitura a mais (o cadastro
 * dele, para saber se é de um tipo com tela extra de fábrica).
 */
export async function externalAccessFor(
  user: Pick<User, "role" | "partyId">,
): Promise<{ screens: string[]; menuHidden: string[] } | null> {
  const config = await loadPartnerAccess();
  // Tipos novos (Trading...) entram como o Fornecedor e podem ter tela de
  // fábrica além das do papel (o Booking do Trading): aí o tipo conta mesmo
  // sem nada gravado.
  const mayHaveExtras = ANY_PROFILE_EXTRAS && user.role === PARTNER_LOGIN_ROLE;
  if (!Object.keys(config).length && !mayHaveExtras) return null;
  const key = await profileKeyOfUser(user);
  if (!config[key] && !hasProfileExtras(key)) return null;
  const access = resolveProfile(config, key);
  return { screens: access.screens, menuHidden: access.menuHidden };
}

export interface AccessProfileInfo {
  key: string;
  kind: "role" | "type";
  /** Papel (para o nome traduzido) ou a entrada do catálogo de tipos. */
  role: string | null;
  type: PartnerTypeEntry | null;
  access: ProfileAccess;
  /** Logins ativos que usam o perfil (quem a mudança afeta). */
  users: number;
}

/** Todos os perfis administráveis: os papéis externos e os tipos com login. */
export async function listAccessProfiles(): Promise<AccessProfileInfo[]> {
  const store = getStore();
  const [config, rows, users, parties] = await Promise.all([
    loadPartnerAccess(),
    listPartnerTypeRows(),
    store.list("users"),
    store.list("parties"),
  ]);
  const catalog = partnerTypeCatalog(rows);
  const typed = catalog.filter((e) => e.profileKey?.startsWith("type:"));
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  const keyOfParty = (p: Party | undefined) => {
    if (!p) return null;
    if (FEATURED_PARTY_TYPES.includes(p.type)) return `type:${p.type}`;
    if (p.type === "partner")
      return typed.find((e) => e.rowId === p.partnerTypeId)?.profileKey ?? null;
    return null;
  };
  const count = new Map<string, number>();
  for (const u of users) {
    if (!u.active || u.role === "admin" || u.role === "operator") continue;
    const key =
      keyOfParty(u.partyId ? partyOf.get(u.partyId) : undefined) ??
      `role:${u.role}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const info = (
    key: string,
    kind: "role" | "type",
    role: string | null,
    type: PartnerTypeEntry | null,
  ): AccessProfileInfo => ({
    key,
    kind,
    role,
    type,
    access: resolveProfile(config, key),
    users: count.get(key) ?? 0,
  });
  return [
    ...typed.map((e) => info(e.profileKey as string, "type", null, e)),
    ...EXTERNAL_ROLES.map((r) => info(`role:${r}`, "role", r, null)),
  ];
}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

async function knownProfile(key: string) {
  if (!isProfileKey(key)) throw new Error("partner_access_profile");
  const profiles = await listAccessProfiles();
  const found = profiles.find((p) => p.key === key);
  if (!found) throw new Error("partner_access_profile");
  return found;
}

async function write(
  user: User,
  action: string,
  summary: string,
  next: PartnerAccessConfig,
  detail: { profile: string; from?: string; changes: ScreenChange[] },
  before: ProfileAccess,
) {
  const store = getStore();
  const { id } = await readConfig();
  if (id) await store.update("settings", id, { value: next });
  else await store.create("settings", { key: PARTNER_ACCESS_KEY, value: next });
  await audit(
    user,
    action,
    "partner_access",
    detail.profile,
    summary,
    { screens: before.screens, menuHidden: before.menuHidden },
    {
      ...(detail.from ? { from: detail.from } : {}),
      to: detail.profile,
      screens: resolveProfile(next, detail.profile).screens,
      menuHidden: resolveProfile(next, detail.profile).menuHidden,
      changes: detail.changes,
    },
  );
}

const summarize = (changes: ScreenChange[]) =>
  changes.map((c) => `${c.change}:${c.screen}`).join(", ") || "sem mudança";

/** Conceder pelo catálogo: as telas que o perfil abre e as fora do menu. */
export async function saveProfileScreens(
  user: User,
  profileKey: string,
  input: { screens: string[]; menuHidden: string[] },
): Promise<ScreenChange[]> {
  assertAdmin(user);
  await knownProfile(profileKey);
  const { config } = await readConfig();
  const before = resolveProfile(config, profileKey);
  const next = setProfileScreens(config, profileKey, input);
  const changes = diffProfiles(before, resolveProfile(next, profileKey));
  await write(
    user,
    "partner_access.set",
    `Gestão de telas: ${profileKey} (${summarize(changes)})`,
    next,
    { profile: profileKey, changes },
    before,
  );
  return changes;
}

/** Prévia da cópia: o que entra, sai ou muda no destino, sem gravar. */
export async function previewCopy(
  from: string,
  to: string,
  screens: string[],
  mode: "add" | "replace",
): Promise<ScreenChange[]> {
  const { config } = await readConfig();
  const next = copyScreens(config, from, to, screens, mode);
  return diffProfiles(resolveProfile(config, to), resolveProfile(next, to));
}

/** Copiar acesso à tela, de um perfil para outro (em qualquer direção). */
export async function copyProfileScreens(
  user: User,
  from: string,
  to: string,
  screens: string[],
  mode: "add" | "replace",
): Promise<ScreenChange[]> {
  assertAdmin(user);
  await knownProfile(from);
  await knownProfile(to);
  const { config } = await readConfig();
  const before = resolveProfile(config, to);
  const next = copyScreens(config, from, to, screens, mode);
  const changes = diffProfiles(before, resolveProfile(next, to));
  await write(
    user,
    "partner_access.copy",
    `Gestão de telas: cópia ${from} → ${to} (${summarize(changes)})`,
    next,
    { profile: to, from, changes },
    before,
  );
  return changes;
}

/** Volta o perfil ao padrão de fábrica. */
export async function resetProfileScreens(user: User, profileKey: string) {
  assertAdmin(user);
  await knownProfile(profileKey);
  const { config } = await readConfig();
  const before = resolveProfile(config, profileKey);
  const next = resetProfile(config, profileKey);
  const changes = diffProfiles(before, resolveProfile(next, profileKey));
  await write(
    user,
    "partner_access.reset",
    `Gestão de telas: ${profileKey} voltou ao padrão (${summarize(changes)})`,
    next,
    { profile: profileKey, changes },
    before,
  );
  return changes;
}
