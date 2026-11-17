import { cache } from "react";
import { getStore, type Party, type User } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { loginLabel } from "@/lib/auth/login-id";
import {
  ACCESS_RULES_KEY,
  accessBlockOf,
  parseAccessRules,
  type AccessBlock,
  type AccessRules,
} from "@/lib/access-state";
import { audit } from "./audit";

/*
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7). O login de parceiro é desativado e reativado aqui (só o
 * administrador, com a Auditoria); a regra "cadastro e login ativos" é ligada
 * e desligada aqui, depois de o administrador ver quem seria bloqueado. A
 * entrada e a sessão leem `accessBlockFor`.
 */

export class AccessStateError extends Error {}

/** A regra gravada (uma leitura por requisição). */
export const loadAccessRules = cache(async (): Promise<AccessRules> => {
  const [row] = await getStore().list("settings", {
    filter: { key: ACCESS_RULES_KEY },
    limit: 1,
  });
  return parseAccessRules(row?.value);
});

/** Por que este login não entra agora (nulo: entra, se as permissões deixarem). */
export async function accessBlockFor(
  user: Pick<User, "active" | "partyId">,
): Promise<AccessBlock | null> {
  const rules = await loadAccessRules();
  const party =
    rules.requireActiveParty && user.partyId
      ? await getStore().get("parties", user.partyId)
      : null;
  return accessBlockOf(user, party, rules);
}

export interface InactivePartyLogins {
  party: Party;
  logins: User[];
}

/**
 * Parceiros com o cadastro inativo e algum login ativo: hoje entram e, com a
 * regra ligada, deixam de entrar. É a lista que o administrador revê antes
 * de ligar a regra.
 */
export async function inactivePartyLogins(): Promise<InactivePartyLogins[]> {
  const store = getStore();
  const logins = (
    await store.list("users", { filter: { active: true } })
  ).filter((u) => !!u.partyId);
  const parties = await listByIds(store, "parties", [
    ...new Set(logins.map((u) => u.partyId as string)),
  ]);
  return parties
    .filter((p) => !p.active)
    .map((party) => ({
      party,
      logins: logins.filter((u) => u.partyId === party.id),
    }))
    .sort((a, b) => a.party.name.localeCompare(b.party.name, "pt"));
}

/**
 * Liga ou desliga a regra "cadastro e login ativos" (só o administrador).
 * Ao ligar, as sessões abertas dos logins afetados caem na próxima página
 * (a sessão relê o login e o cadastro a cada requisição).
 */
export async function setRequireActiveParty(
  user: User,
  on: boolean,
): Promise<{ blockedLogins: number }> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const [row] = await store.list("settings", {
    filter: { key: ACCESS_RULES_KEY },
    limit: 1,
  });
  const before = parseAccessRules(row?.value);
  const affected = on ? await inactivePartyLogins() : [];
  const value: AccessRules = {
    requireActiveParty: on,
    changedAt: new Date().toISOString(),
    changedBy: user.name,
  };
  if (row) await store.update("settings", row.id, { value });
  else await store.create("settings", { key: ACCESS_RULES_KEY, value });
  const blockedLogins = affected.reduce((n, a) => n + a.logins.length, 0);
  if (on) {
    const { forgetUserSessions } = await import("@/lib/auth/session");
    for (const a of affected)
      for (const l of a.logins) forgetUserSessions(l.id);
  }
  await audit(
    user,
    on ? "access.rule_on" : "access.rule_off",
    "settings",
    ACCESS_RULES_KEY,
    on
      ? `Regra "cadastro e login ativos" ligada: ${blockedLogins} login(s) de cadastro inativo deixam de entrar`
      : `Regra "cadastro e login ativos" desligada`,
    { requireActiveParty: before.requireActiveParty },
    {
      requireActiveParty: on,
      blocked: affected.map(
        (a) =>
          `${a.party.name}: ${a.logins.map((l) => loginLabel(l.email)).join(", ")}`,
      ),
    },
  );
  return { blockedLogins };
}

/**
 * Desativa ou reativa um login de parceiro ou de cliente (só o
 * administrador). O login da equipe Wellmix segue em Equipe Interna.
 * Desativado, não entra mais e a sessão aberta cai na próxima página; nada é
 * apagado (o histórico e a autoria continuam).
 */
export async function setPartnerLoginActive(
  user: User,
  userId: string,
  active: boolean,
): Promise<User> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const target = await store.get("users", userId);
  if (
    !target ||
    !target.partyId ||
    target.role === "admin" ||
    target.role === "operator"
  )
    throw new AccessStateError("not_found");
  if (target.active === active) return target;
  const updated = await store.update("users", target.id, { active });
  if (!active) {
    const { forgetUserSessions } = await import("@/lib/auth/session");
    forgetUserSessions(target.id);
  }
  await audit(
    user,
    active ? "user.activate" : "user.deactivate",
    "user",
    target.id,
    `${active ? "Login reativado" : "Login desativado"}: ${target.name} (${loginLabel(target.email)})`,
    { active: target.active },
    { active },
  );
  return updated;
}
