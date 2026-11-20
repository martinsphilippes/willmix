import { cache } from "react";
import { getStore, type Party, type User } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { loginLabel, loginToEmail } from "@/lib/auth/login-id";
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
  user: Pick<User, "active" | "partyId" | "loginSuspended">,
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

/**
 * Alterar o e-mail do login de cliente ou parceiro (dono, 20/11/2026;
 * docs/EQUIPE_ACESSOS.md, "Alterar e-mail do login"): só o administrador. O
 * login continua o mesmo (cadastro, papel, telas e senha); muda só o e-mail
 * ou o nome de usuário com que ele entra, e o antigo deixa de entrar. No
 * Supabase, a conta do Auth troca junto (a senha continua); se a linha do
 * portal não gravar, a conta volta ao e-mail antigo.
 */
export async function changeLoginEmail(
  user: User,
  userId: string,
  login: string,
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
  const email = loginToEmail(login);
  if (!email) throw new AccessStateError("user_login_invalid");
  const before = (target.email ?? "").trim().toLowerCase();
  if (email === before) throw new AccessStateError("login_email_same");
  const taken = await store.list("users", { filter: { email }, limit: 1 });
  if (taken.some((u) => u.id !== target.id))
    throw new AccessStateError("user_email_taken");
  // O Appwrite está parado desde 11/11/2026 (docs/SUPABASE.md).
  if (store.mode === "appwrite")
    throw new AccessStateError("login_email_unsupported");
  let authChanged = false;
  if (store.mode === "supabase") {
    const auth = await import("@/lib/auth/supabase-auth");
    if ((await auth.supabaseChangeEmail(before, email)) === "ok")
      authChanged = true;
    // Sem conta com o e-mail antigo (nunca definiu a senha): a conta nasce
    // com o novo, e a senha se define pelo "Esqueci minha senha".
    else await auth.supabaseEnsureUser(email, target.name);
  }
  let updated: User;
  try {
    updated = await store.update("users", target.id, { email });
  } catch (error) {
    if (authChanged) {
      const { supabaseChangeEmail } = await import("@/lib/auth/supabase-auth");
      await supabaseChangeEmail(email, before).catch((undo) =>
        console.error(
          "[login-email] conta do Auth com o e-mail novo",
          target.id,
          undo,
        ),
      );
    }
    throw error;
  }
  await audit(
    user,
    "user.email",
    "user",
    target.id,
    `E-mail do login alterado: ${target.name} (${loginLabel(before)} → ${loginLabel(email)})`,
    { email: before },
    { email },
  );
  return updated;
}

/**
 * Login da equipe da Wellmix (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, D8 e
 * R7): suspender e reativar o login sem tirar a pessoa da equipe (ela segue
 * na árvore do "Responde a", no Painel de SLA e na distribuição). Só o
 * administrador; o próprio login não (para ninguém se trancar fora).
 */
export async function setTeamLoginActive(
  user: User,
  userId: string,
  active: boolean,
): Promise<User> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const target = await store.get("users", userId);
  if (
    !target ||
    !target.active ||
    (target.role !== "admin" && target.role !== "operator")
  )
    throw new AccessStateError("not_found");
  if (target.id === user.id) throw new AccessStateError("self");
  const suspended = !active;
  if ((target.loginSuspended === true) === suspended) return target;
  const updated = await store.update("users", target.id, {
    loginSuspended: suspended,
  });
  if (suspended) {
    const { forgetUserSessions } = await import("@/lib/auth/session");
    forgetUserSessions(target.id);
  }
  await audit(
    user,
    active ? "team.login_on" : "team.login_off",
    "user",
    target.id,
    `${active ? "Login reativado" : "Login suspenso"} (segue na equipe): ${target.name} (${loginLabel(target.email)})`,
    { loginSuspended: target.loginSuspended === true },
    { loginSuspended: suspended },
  );
  return updated;
}

/**
 * Volta para a equipe quem saiu ("Excluir acesso"; D8 e R7): o cadastro fica
 * ativo de novo, com as funções e as telas de antes; o gestor de antes só
 * volta se ainda está na equipe (senão, sem gestor). Só o administrador.
 */
export async function reactivateTeamMember(
  user: User,
  userId: string,
): Promise<User> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const target = await store.get("users", userId);
  if (
    !target ||
    target.active ||
    (target.role !== "admin" && target.role !== "operator")
  )
    throw new AccessStateError("not_found");
  const manager = target.managerUserId
    ? await store.get("users", target.managerUserId)
    : null;
  const managerUserId = manager?.active ? manager.id : null;
  const updated = await store.update("users", target.id, {
    active: true,
    managerUserId,
  });
  await audit(
    user,
    "team.member.reactivate",
    "user",
    target.id,
    `Acesso reativado: ${target.name} (${loginLabel(target.email)})`,
    { active: false, managerUserId: target.managerUserId ?? null },
    { active: true, managerUserId },
  );
  return updated;
}

/** Quem saiu da equipe (Excluir acesso), por nome: a lista para reativar. */
export async function formerTeamMembers(): Promise<User[]> {
  return getStore().list("users", {
    filter: { role: ["admin", "operator"], active: false },
    orderBy: "name",
  });
}
