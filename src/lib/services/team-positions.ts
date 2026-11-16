import "server-only";

import { getStore, type TeamPosition, type User } from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import {
  AREA_BULK_MAX,
  cleanAreaName,
  sortAreas,
  splitBulkText,
  validAreaName,
} from "@/lib/team-areas";
import {
  findPositionByName,
  planBulkPositions,
  type BulkPositionPlan,
} from "@/lib/team-positions";
import { audit } from "./audit";
import { listTeamAreas } from "./team-areas";

/*
 * Cargos da equipe (Equipe Acessos e Parceiros → Cargos; dono, 16/11/2026;
 * docs/ACCESS.md, "Áreas e cargos"): Designer Gráfico Sênior, Analista
 * Financeiro Jr... Cada cargo fica em uma área; a pessoa recebe o cargo em
 * Editar acessos e a área vem junto. Só o administrador cadastra. Nada se
 * apaga e tudo fica na Auditoria. Regras em src/lib/team-positions.ts.
 */

export class TeamPositionError extends Error {}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

/** Os cargos pelo nome; antes de o esquema ser publicado, nenhum. */
export async function listTeamPositions(): Promise<TeamPosition[]> {
  try {
    return sortAreas(await getStore().list("team_positions"));
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

function checkedName(raw: string): string {
  const name = cleanAreaName(raw);
  if (!validAreaName(name)) throw new TeamPositionError("position_name");
  return name;
}

/** A área de um cargo: nenhuma ou uma ativa (a que ele já tem, mesmo desativada). */
async function checkedArea(
  areaId: string | null,
  currentAreaId: string | null = null,
): Promise<{ id: string; name: string } | null> {
  if (!areaId) return null;
  const area = (await listTeamAreas()).find((a) => a.id === areaId);
  if (!area) throw new TeamPositionError("area_invalid");
  if (!area.active && area.id !== currentAreaId)
    throw new TeamPositionError("area_inactive");
  return { id: area.id, name: area.name };
}

async function insertPosition(
  user: User,
  name: string,
  area: { id: string; name: string } | null,
  bulk: boolean,
) {
  const row = await getStore().create("team_positions", {
    name,
    areaId: area?.id ?? null,
    active: true,
    createdByUserId: user.id,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "team.position_create",
    "team_position",
    row.id,
    `Cargo criado: ${name}${area ? ` (${area.name})` : " (sem área)"}${bulk ? " (cadastro em massa)" : ""}`,
    null,
    { name, areaId: area?.id ?? null, active: true },
  );
  return row;
}

/** Cria um cargo (recusa o que já existe, mesmo com outra grafia). */
export async function createTeamPosition(
  user: User,
  rawName: string,
  areaId: string | null,
): Promise<TeamPosition> {
  assertAdmin(user);
  const name = checkedName(rawName);
  if (findPositionByName(name, await listTeamPositions()))
    throw new TeamPositionError("position_exists");
  return insertPosition(user, name, await checkedArea(areaId), false);
}

export interface BulkPositionResult {
  created: { id: string; name: string; areaName: string | null }[];
  existing: BulkPositionPlan["existing"];
  repeated: string[];
  invalid: string[];
  unknownArea: BulkPositionPlan["unknownArea"];
  header: string | null;
}

/**
 * Cadastro em massa: um cargo por linha, com a área na mesma linha (depois
 * de uma tabulação ou de ";") ou a área escolhida para a lista. Cria só os
 * que faltam; os que já existem ficam como estão. Não mexe em logins,
 * funções nem permissões.
 */
export async function bulkCreateTeamPositions(
  user: User,
  text: string,
  defaultAreaId: string | null,
): Promise<BulkPositionResult> {
  assertAdmin(user);
  const { lines } = splitBulkText(text, /\r?\n/);
  if (!lines.length) throw new TeamPositionError("position_bulk_empty");
  if (lines.length > AREA_BULK_MAX)
    throw new TeamPositionError("position_bulk_too_many");
  const fallback = await checkedArea(defaultAreaId);
  const plan = planBulkPositions(
    text,
    await listTeamPositions(),
    await listTeamAreas(),
    fallback?.id ?? null,
  );
  const created: BulkPositionResult["created"] = [];
  for (const item of plan.create) {
    const area =
      item.areaId && item.areaName
        ? { id: item.areaId, name: item.areaName }
        : null;
    const row = await insertPosition(user, item.name, area, true);
    created.push({ id: row.id, name: row.name, areaName: area?.name ?? null });
  }
  await audit(
    user,
    "team.position_bulk",
    "team_position",
    "bulk",
    `Cadastro em massa de cargos: ${created.length} criado(s), ${plan.existing.length} já existia(m)`,
    null,
    {
      created: created.map((c) => ({ name: c.name, area: c.areaName })),
      existing: plan.existing.map((e) => ({ asked: e.asked, name: e.name })),
      repeated: plan.repeated,
      invalid: plan.invalid,
      unknownArea: plan.unknownArea,
      header: plan.header,
    },
  );
  return {
    created,
    existing: plan.existing,
    repeated: plan.repeated,
    invalid: plan.invalid,
    unknownArea: plan.unknownArea,
    header: plan.header,
  };
}

async function positionOrFail(id: string): Promise<TeamPosition> {
  const position = (await listTeamPositions()).find((p) => p.id === id);
  if (!position) throw new TeamPositionError("not_found");
  return position;
}

/** Muda o nome (sem repetir o de outro cargo). */
export async function renameTeamPosition(
  user: User,
  id: string,
  rawName: string,
): Promise<TeamPosition> {
  assertAdmin(user);
  const position = await positionOrFail(id);
  const name = checkedName(rawName);
  if (findPositionByName(name, await listTeamPositions(), position.id))
    throw new TeamPositionError("position_exists");
  if (name === position.name) return position;
  const row = await getStore().update("team_positions", position.id, {
    name,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "team.position_rename",
    "team_position",
    position.id,
    `Cargo renomeado: ${position.name} → ${name}`,
    { name: position.name },
    { name },
  );
  return row;
}

/**
 * Muda a área do cargo. Quem tem o cargo passa para a nova área (a área da
 * pessoa vem do cargo); sem área, as pessoas ficam na área que já tinham.
 */
export async function setTeamPositionArea(
  user: User,
  id: string,
  areaId: string | null,
): Promise<{ position: TeamPosition; moved: number }> {
  assertAdmin(user);
  const position = await positionOrFail(id);
  const area = await checkedArea(areaId, position.areaId);
  if ((area?.id ?? null) === position.areaId) return { position, moved: 0 };
  const store = getStore();
  const row = await store.update("team_positions", position.id, {
    areaId: area?.id ?? null,
    updatedByUserId: user.id,
  });
  let moved = 0;
  if (area) {
    const people = await store.list("users", {
      filter: { positionId: position.id },
    });
    for (const person of people)
      if (person.areaId !== area.id) {
        await store.update("users", person.id, { areaId: area.id });
        moved++;
      }
  }
  await audit(
    user,
    "team.position_area",
    "team_position",
    position.id,
    `Cargo ${position.name}: área ${area ? area.name : "nenhuma"}${moved ? ` (${moved} pessoa(s) passaram para ela)` : ""}`,
    { areaId: position.areaId },
    { areaId: area?.id ?? null, moved },
  );
  return { position: row, moved };
}

/** Desativa (sai das escolhas, fica em quem já está nele) ou reativa. */
export async function setTeamPositionActive(
  user: User,
  id: string,
  active: boolean,
): Promise<TeamPosition> {
  assertAdmin(user);
  const position = await positionOrFail(id);
  if (position.active === active) return position;
  const row = await getStore().update("team_positions", position.id, {
    active,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    active ? "team.position_activate" : "team.position_deactivate",
    "team_position",
    position.id,
    `Cargo ${active ? "reativado" : "desativado"}: ${position.name}`,
    { active: position.active },
    { active },
  );
  return row;
}

/**
 * O cargo que um login pode receber: nenhum, um ativo, ou o que ele já tem
 * (mesmo desativado, para salvar o resto sem perdê-lo).
 */
export async function checkMemberPosition(
  positionId: string | null,
  currentPositionId: string | null,
): Promise<TeamPosition | null> {
  if (!positionId) return null;
  const position = (await listTeamPositions()).find((p) => p.id === positionId);
  if (!position) throw new TeamPositionError("position_invalid");
  if (!position.active && position.id !== currentPositionId)
    throw new TeamPositionError("position_inactive");
  return position;
}
