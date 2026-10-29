import "server-only";

import { getStore, type JobLevel, type Party, type User } from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Equipe da Wellmix e carteira de clientes (painel de SLA, docs/SLA_PANEL.md).
 * Cada login da Wellmix tem um cargo e a quem responde (chefe); cada cliente
 * tem um operador responsável. Quem vê o painel de quem sai daqui:
 * o administrador vê todos; os demais, o próprio e de toda a equipe abaixo.
 * Só o administrador muda cargo, chefe e carteira.
 */

export class TeamError extends Error {}

/** Logins ativos da Wellmix (admin e operadores), por nome. */
export async function wellmixTeam(): Promise<User[]> {
  const users = await getStore().list("users", {
    filter: { role: ["admin", "operator"], active: true },
    orderBy: "name",
  });
  return users;
}

/**
 * Ids de quem está abaixo do login na árvore (subordinados diretos e os
 * deles), sem ele. Resistente a ciclo (cadastro antigo ou corrompido).
 */
export function descendantsOf(userId: string, team: User[]): Set<string> {
  const below = new Set<string>();
  const queue = [userId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const u of team)
      if (u.managerUserId === current && u.id !== userId && !below.has(u.id)) {
        below.add(u.id);
        queue.push(u.id);
      }
  }
  return below;
}

/** Quem o login vê no painel: admin, todos; os demais, ele e quem está abaixo. */
export function visibleTeamIds(viewer: User, team: User[]): Set<string> {
  if (isAdmin(viewer)) return new Set(team.map((u) => u.id));
  return new Set([viewer.id, ...descendantsOf(viewer.id, team)]);
}

/** Muda cargo e chefe de um login da Wellmix (só admin; sem ciclo). */
export async function setTeamMember(
  user: User,
  targetId: string,
  input: { jobLevel: JobLevel | null; managerUserId: string | null },
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const team = await wellmixTeam();
  const target = team.find((u) => u.id === targetId);
  if (!target) throw new TeamError("not_found");
  if (input.managerUserId) {
    if (input.managerUserId === target.id) throw new TeamError("manager_self");
    if (!team.some((u) => u.id === input.managerUserId))
      throw new TeamError("manager_invalid");
    // O chefe não pode estar abaixo do próprio subordinado.
    if (descendantsOf(target.id, team).has(input.managerUserId))
      throw new TeamError("manager_cycle");
  }
  const before = {
    jobLevel: target.jobLevel ?? null,
    managerUserId: target.managerUserId ?? null,
  };
  await store.update("users", target.id, {
    jobLevel: input.jobLevel,
    managerUserId: input.managerUserId,
  });
  await audit(
    user,
    "team.member",
    "user",
    target.id,
    `Equipe: ${target.name} (cargo e chefe)`,
    before,
    input,
  );
}

/** Define (ou tira) o operador responsável pela carteira do cliente (só admin). */
export async function setCustomerOwner(
  user: User,
  partyId: string,
  ownerUserId: string | null,
): Promise<void> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const party = await store.get("parties", partyId);
  if (!party || party.type !== "customer") throw new TeamError("not_found");
  if (ownerUserId) {
    const owner = await store.get("users", ownerUserId);
    if (!owner || !owner.active || !isWellmix(owner))
      throw new TeamError("owner_invalid");
  }
  await store.update("parties", party.id, { ownerUserId });
  await audit(
    user,
    "team.portfolio",
    "party",
    party.id,
    `Carteira: ${party.name}`,
    { ownerUserId: party.ownerUserId ?? null },
    { ownerUserId },
  );
}

/** Responsável válido do cliente (login ativo da Wellmix) ou nulo. */
export function ownerOf(
  party: Pick<Party, "ownerUserId"> | undefined,
  team: User[],
): string | null {
  const id = party?.ownerUserId ?? null;
  return id && team.some((u) => u.id === id) ? id : null;
}
