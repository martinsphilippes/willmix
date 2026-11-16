import "server-only";

import { getStore, type TeamArea, type User } from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import {
  AREA_BULK_MAX,
  bulkAreaLines,
  cleanAreaName,
  findAreaByName,
  planBulkAreas,
  sortAreas,
  validAreaName,
  type BulkAreaPlan,
} from "@/lib/team-areas";
import { audit } from "./audit";

/*
 * Áreas da equipe (Equipe Acessos e Parceiros → Áreas; dono, 16/11/2026;
 * docs/ACCESS.md, "Áreas"): Marketing, Financeiro, Comex... Quem lê: a tela
 * Equipe (o administrador). Quem cria, renomeia, desativa e cadastra em
 * massa: o administrador. Nada se apaga (desativada, sai das escolhas e
 * continua em quem já está nela) e tudo fica na Auditoria. As regras de nome
 * e de "já existe" estão em src/lib/team-areas.ts.
 */

export class TeamAreaError extends Error {}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

/** As áreas pelo nome; antes de o esquema ser publicado, nenhuma. */
export async function listTeamAreas(): Promise<TeamArea[]> {
  try {
    return sortAreas(await getStore().list("team_areas"));
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

async function insertArea(user: User, name: string, bulk: boolean) {
  const row = await getStore().create("team_areas", {
    name,
    active: true,
    createdByUserId: user.id,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "team.area_create",
    "team_area",
    row.id,
    `Área criada: ${name}${bulk ? " (cadastro em massa)" : ""}`,
    null,
    { name, active: true },
  );
  return row;
}

function checkedName(raw: string): string {
  const name = cleanAreaName(raw);
  if (!validAreaName(name)) throw new TeamAreaError("area_name");
  return name;
}

/** Cria uma área (recusa a que já existe, mesmo com outra grafia). */
export async function createTeamArea(
  user: User,
  rawName: string,
): Promise<TeamArea> {
  assertAdmin(user);
  const name = checkedName(rawName);
  if (findAreaByName(name, await listTeamAreas()))
    throw new TeamAreaError("area_exists");
  return insertArea(user, name, false);
}

export interface BulkAreaResult {
  /** As criadas agora, na ordem da lista. */
  created: { id: string; name: string }[];
  existing: BulkAreaPlan["existing"];
  repeated: string[];
  invalid: string[];
  /** Título da coluna colado na primeira linha (ignorado). */
  header: string | null;
}

/**
 * Cadastro em massa: uma área por linha. Cria só as que faltam; as que já
 * existem ficam como estão (com a grafia cadastrada, ativas ou não) e voltam
 * no resumo como já cadastradas. Não mexe em logins, funções nem permissões.
 */
export async function bulkCreateTeamAreas(
  user: User,
  text: string,
): Promise<BulkAreaResult> {
  assertAdmin(user);
  const lines = bulkAreaLines(text);
  if (!lines.length) throw new TeamAreaError("area_bulk_empty");
  if (lines.length > AREA_BULK_MAX)
    throw new TeamAreaError("area_bulk_too_many");
  const plan = planBulkAreas(text, await listTeamAreas());
  const created: BulkAreaResult["created"] = [];
  for (const name of plan.create) {
    const row = await insertArea(user, name, true);
    created.push({ id: row.id, name: row.name });
  }
  await audit(
    user,
    "team.area_bulk",
    "team_area",
    "bulk",
    `Cadastro em massa de áreas: ${created.length} criada(s), ${plan.existing.length} já existia(m)`,
    null,
    {
      created: created.map((c) => c.name),
      existing: plan.existing.map((e) => ({ asked: e.asked, name: e.name })),
      repeated: plan.repeated,
      invalid: plan.invalid,
      header: plan.header,
    },
  );
  return {
    created,
    existing: plan.existing,
    repeated: plan.repeated,
    invalid: plan.invalid,
    header: plan.header,
  };
}

async function areaOrFail(id: string): Promise<TeamArea> {
  const area = (await listTeamAreas()).find((a) => a.id === id);
  if (!area) throw new TeamAreaError("not_found");
  return area;
}

/** Muda o nome (sem repetir o de outra área). */
export async function renameTeamArea(
  user: User,
  id: string,
  rawName: string,
): Promise<TeamArea> {
  assertAdmin(user);
  const area = await areaOrFail(id);
  const name = checkedName(rawName);
  if (findAreaByName(name, await listTeamAreas(), area.id))
    throw new TeamAreaError("area_exists");
  if (name === area.name) return area;
  const row = await getStore().update("team_areas", area.id, {
    name,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "team.area_rename",
    "team_area",
    area.id,
    `Área renomeada: ${area.name} → ${name}`,
    { name: area.name },
    { name },
  );
  return row;
}

/** Desativa (sai das escolhas, fica em quem já está nela) ou reativa. */
export async function setTeamAreaActive(
  user: User,
  id: string,
  active: boolean,
): Promise<TeamArea> {
  assertAdmin(user);
  const area = await areaOrFail(id);
  if (area.active === active) return area;
  const row = await getStore().update("team_areas", area.id, {
    active,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    active ? "team.area_activate" : "team.area_deactivate",
    "team_area",
    area.id,
    `Área ${active ? "reativada" : "desativada"}: ${area.name}`,
    { active: area.active },
    { active },
  );
  return row;
}

/**
 * A área que um login pode receber: nenhuma, uma ativa, ou a que ele já tem
 * (mesmo desativada, para salvar o resto sem perdê-la).
 */
export async function checkMemberArea(
  areaId: string | null,
  currentAreaId: string | null,
): Promise<string | null> {
  if (!areaId) return null;
  const area = (await listTeamAreas()).find((a) => a.id === areaId);
  if (!area) throw new TeamAreaError("area_invalid");
  if (!area.active && area.id !== currentAreaId)
    throw new TeamAreaError("area_inactive");
  return area.id;
}
