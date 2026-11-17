import "server-only";

import { getStore, type JobLevel, type TeamPending, type User } from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import { areaNameKey } from "@/lib/team-areas";
import { audit } from "./audit";
import { createPortalLogin } from "./portal-access";
import { setTeamMember } from "./team";
import { listTeamAreas } from "./team-areas";
import { listTeamPositions } from "./team-positions";

/*
 * Aguardando e-mail (Equipe → "Aguardando e-mail"; dono, 17/11/2026;
 * docs/ACCESS.md, "Importar equipe"): quem veio da planilha sem e-mail fica
 * guardado com o cargo, a área, as funções e o nível sugeridos; o
 * administrador põe o e-mail (ou um nome de usuário) e a senha provisória e o
 * login nasce como nasceria na importação. Só o administrador. Nada se apaga:
 * criado ou tirado da lista, o registro fica (situação "created"/"removed").
 */

export class TeamPendingError extends Error {}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

/** Quem está aguardando e-mail, pelo nome; antes do esquema, ninguém. */
export async function listTeamPending(): Promise<TeamPending[]> {
  try {
    const rows = await getStore().list("team_pending", {
      filter: { status: "waiting" },
    });
    return rows.sort((a, b) =>
      a.name.localeCompare(b.name, "pt", { sensitivity: "base" }),
    );
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

export interface TeamPendingInput {
  name: string;
  positionId: string | null;
  areaId: string | null;
  jobLevel: JobLevel | null;
  functions: string[];
  reviewNote: string | null;
  source: string | null;
}

/**
 * Guarda quem está sem e-mail. Quem já está aguardando (mesmo nome, sem
 * contar maiúsculas e acentos) não entra de novo.
 */
export async function addTeamPending(
  user: User,
  items: TeamPendingInput[],
): Promise<{ added: string[]; already: string[] }> {
  assertAdmin(user);
  const waiting = await listTeamPending();
  const keys = new Set(waiting.map((w) => areaNameKey(w.name)));
  const out = { added: [] as string[], already: [] as string[] };
  for (const item of items) {
    const key = areaNameKey(item.name);
    if (!key) continue;
    if (keys.has(key)) {
      out.already.push(item.name);
      continue;
    }
    keys.add(key);
    const row = await getStore().create("team_pending", {
      name: item.name.trim().slice(0, 120),
      status: "waiting",
      positionId: item.positionId,
      areaId: item.areaId,
      jobLevel: item.jobLevel,
      functions: item.functions,
      reviewNote: item.reviewNote?.slice(0, 500) ?? null,
      source: item.source?.slice(0, 200) ?? null,
      userId: null,
      createdByUserId: user.id,
      updatedByUserId: user.id,
    });
    await audit(
      user,
      "team.pending_add",
      "team_pending",
      row.id,
      `Aguardando e-mail: ${row.name}${row.source ? ` (${row.source})` : ""}`,
      null,
      {
        name: row.name,
        positionId: row.positionId,
        areaId: row.areaId,
        functions: row.functions,
      },
    );
    out.added.push(row.name);
  }
  return out;
}

async function waitingOrFail(id: string): Promise<TeamPending> {
  const row = await getStore().get("team_pending", id);
  if (!row || row.status !== "waiting")
    throw new TeamPendingError("pending_not_found");
  return row;
}

/**
 * Cria o login de quem estava aguardando: o e-mail (ou nome de usuário) e a
 * senha provisória vêm da tela; o cargo, a área, as funções, o nível e o "a
 * conferir" vêm do que ficou guardado. Cargo ou área desativados depois não
 * entram (vira "a conferir"). A troca de senha é pedida no primeiro acesso.
 */
export async function createLoginFromPending(
  user: User,
  id: string,
  login: string,
  password: string,
): Promise<User> {
  assertAdmin(user);
  const pending = await waitingOrFail(id);
  const [positions, areas] = await Promise.all([
    listTeamPositions(),
    listTeamAreas(),
  ]);
  const notes = pending.reviewNote ? [pending.reviewNote] : [];
  const position = pending.positionId
    ? (positions.find((p) => p.id === pending.positionId && p.active) ?? null)
    : null;
  if (pending.positionId && !position)
    notes.push("O cargo guardado foi desativado: escolher o cargo");
  const area = pending.areaId
    ? (areas.find((a) => a.id === pending.areaId && a.active) ?? null)
    : null;
  if (pending.areaId && !area)
    notes.push("A área guardada foi desativada: escolher a área");
  const created = await createPortalLogin(user, {
    partyId: null,
    email: login,
    name: pending.name,
    role: "operator",
    locale: "pt",
    password,
    mustChangePassword: true,
  });
  await setTeamMember(user, created.id, {
    jobLevel: pending.jobLevel,
    managerUserId: null,
    division: null,
    positionId: position?.id ?? null,
    areaId: position?.areaId ? null : (area?.id ?? null),
    functions: pending.functions ?? [],
    reviewNote: notes.join(". ").slice(0, 500) || null,
  });
  await getStore().update("team_pending", pending.id, {
    status: "created",
    userId: created.id,
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "team.pending_login",
    "team_pending",
    pending.id,
    `Login criado para quem aguardava e-mail: ${pending.name} (${created.email})`,
    { status: "waiting" },
    { status: "created", userId: created.id },
  );
  return created;
}

/** Tira da lista (quem não vai ter login); o registro fica. */
export async function removeTeamPending(
  user: User,
  id: string,
): Promise<TeamPending> {
  assertAdmin(user);
  const pending = await waitingOrFail(id);
  const row = await getStore().update("team_pending", pending.id, {
    status: "removed",
    updatedByUserId: user.id,
  });
  await audit(
    user,
    "team.pending_remove",
    "team_pending",
    pending.id,
    `Saiu da lista de quem aguarda e-mail: ${pending.name}`,
    { status: "waiting" },
    { status: "removed" },
  );
  return row;
}
