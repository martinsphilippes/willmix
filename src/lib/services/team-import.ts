import "server-only";

import { getStore, type User } from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";
import {
  areaNameKey,
  parseTeamImport,
  proposeTeamImport,
  reviewNoteOf,
  type TeamImportProposal,
} from "@/lib/team-import";
import { audit } from "./audit";
import { createPortalLogin, PORTAL_MIN_PASSWORD } from "./portal-access";
import { setTeamMember } from "./team";
import { listTeamAreas } from "./team-areas";
import { listTeamPositions } from "./team-positions";
import { addTeamPending, listTeamPending } from "./team-pending";

/*
 * Importar equipe (Equipe → "Importar da planilha"; dono, 16/11/2026;
 * docs/ACCESS.md, "Importar equipe"): a planilha Nome, Cargo, Área, Email
 * vira logins da equipe Wellmix com o cargo, a área, as funções e o nível
 * sugeridos (src/lib/team-import.ts) e, quando há dúvida, o "a conferir"
 * com o motivo. Só o administrador. "Conferir" não grava nada; "Criar os
 * logins" cria em lotes (a próxima rodada continua de onde parou: quem já
 * tem login não é criado de novo).
 */

export class TeamImportError extends Error {}

/** Linhas por colagem (a planilha inteira da equipe cabe com folga). */
export const TEAM_IMPORT_MAX_ROWS = 400;
/** Logins criados por clique (cada um abre a conta de acesso). */
export const TEAM_IMPORT_BATCH = 25;

export type TeamImportStatus =
  /** Login novo. */
  | "new"
  /** Já tem login da equipe: liga cargo e área se estiverem vazios. */
  | "existing"
  /** O e-mail é de um login de parceiro, cliente ou fornecedor: fica de fora. */
  | "partner"
  /** O e-mail é de um login excluído (inativo): fica de fora. */
  | "inactive";

export interface TeamImportRow extends TeamImportProposal {
  status: TeamImportStatus;
  existingUserId: string | null;
  /** Cargo e área que o login que já existe tem hoje. */
  existingPositionId: string | null;
  existingAreaId: string | null;
}

export interface TeamImportPreview {
  rows: TeamImportRow[];
  header: string | null;
  invalid: { line: number; text: string; reason: "name" | "email" }[];
  repeated: { line: number; email: string }[];
  /**
   * Sem e-mail na planilha: ficam "Aguardando e-mail" ao criar os logins
   * (`already` = já estava na lista).
   */
  pending: (TeamImportProposal & { already: boolean })[];
}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

/** A prévia: o que cada linha vira, sem gravar nada. */
export async function previewTeamImport(
  user: User,
  text: string,
): Promise<TeamImportPreview> {
  assertAdmin(user);
  const parsed = parseTeamImport(text);
  if (!parsed.rows.length && !parsed.invalid.length && !parsed.noEmail.length)
    throw new TeamImportError("import_empty");
  if (
    parsed.rows.length + parsed.invalid.length + parsed.noEmail.length >
    TEAM_IMPORT_MAX_ROWS
  )
    throw new TeamImportError("import_too_many");
  const [positions, areas, waiting] = await Promise.all([
    listTeamPositions(),
    listTeamAreas(),
    listTeamPending(),
  ]);
  const waitingKeys = new Set(waiting.map((w) => areaNameKey(w.name)));
  const proposals = proposeTeamImport(parsed.rows, positions, areas);
  const emails = proposals.map((p) => p.email);
  const users = emails.length
    ? await getStore().list("users", { filter: { email: emails } })
    : [];
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  return {
    header: parsed.header,
    invalid: parsed.invalid,
    repeated: parsed.repeated,
    pending: proposeTeamImport(parsed.noEmail, positions, areas).map((p) => ({
      ...p,
      already: waitingKeys.has(areaNameKey(p.name)),
    })),
    rows: proposals.map((p) => {
      const found = byEmail.get(p.email) ?? null;
      const status: TeamImportStatus = !found
        ? "new"
        : !found.active
          ? "inactive"
          : found.role === "admin" || found.role === "operator"
            ? "existing"
            : "partner";
      return {
        ...p,
        status,
        existingUserId: found?.id ?? null,
        existingPositionId: found?.positionId ?? null,
        existingAreaId: found?.areaId ?? null,
      };
    }),
  };
}

export interface TeamImportResult {
  created: { name: string; email: string; review: boolean }[];
  /** Logins que já existiam e receberam o cargo e a área da planilha. */
  linked: { name: string; email: string }[];
  /** Ficaram como estavam (já tinham cargo ou área, parceiro, inativo). */
  skipped: {
    name: string;
    email: string;
    reason: TeamImportStatus | "has_place";
  }[];
  failed: { name: string; email: string; error: string }[];
  /** Logins novos que ficaram para a próxima rodada (limite por clique). */
  remaining: number;
  /** Sem e-mail: guardados em "Aguardando e-mail" nesta rodada. */
  pending: string[];
}

const codeOf = (error: unknown) =>
  error instanceof Error && /^[a-z][a-z0-9_]{1,59}$/.test(error.message)
    ? error.message
    : "unexpected";

/**
 * Cria os logins (senha provisória igual para todos, troca obrigatória no
 * primeiro acesso) com cargo, área, funções, nível e o "a conferir". Quem já
 * tem login da equipe só recebe o cargo e a área, se ainda não tinha; as
 * funções e as telas dele não mudam.
 */
export async function runTeamImport(
  user: User,
  text: string,
  password: string,
  batch = TEAM_IMPORT_BATCH,
): Promise<TeamImportResult> {
  assertAdmin(user);
  if (password.length < PORTAL_MIN_PASSWORD)
    throw new TeamImportError("user_password_short");
  const preview = await previewTeamImport(user, text);
  const result: TeamImportResult = {
    created: [],
    linked: [],
    skipped: [],
    failed: [],
    remaining: 0,
    pending: [],
  };
  // Sem e-mail: ficam "Aguardando e-mail" com o que foi sugerido.
  const fresh = preview.pending.filter((p) => !p.already);
  if (fresh.length) {
    const added = await addTeamPending(
      user,
      fresh.map((p) => ({
        name: p.name,
        positionId: p.positionId,
        areaId: p.areaId,
        jobLevel: p.level,
        functions: p.functions,
        reviewNote: reviewNoteOf(p.review),
        source: `Importação da planilha, linha ${p.line}`,
      })),
    );
    result.pending = added.added;
  }
  const store = getStore();
  for (const row of preview.rows) {
    const who = { name: row.name, email: row.email };
    if (row.status === "partner" || row.status === "inactive") {
      result.skipped.push({ ...who, reason: row.status });
      continue;
    }
    if (row.status === "existing") {
      if (row.existingPositionId || row.existingAreaId) {
        result.skipped.push({ ...who, reason: "has_place" });
        continue;
      }
      try {
        const current = (await store.get("users", row.existingUserId!))!;
        await setTeamMember(user, current.id, {
          jobLevel: current.jobLevel ?? null,
          managerUserId: current.managerUserId ?? null,
          division: current.division ?? null,
          positionId: row.positionId,
          areaId: row.areaId,
          reviewNote: reviewNoteOf([
            ...row.review,
            "Já tinha login: cargo e área vieram da planilha; funções e telas não mudaram",
          ]),
        });
        result.linked.push(who);
      } catch (error) {
        result.failed.push({ ...who, error: codeOf(error) });
      }
      continue;
    }
    if (result.created.length + result.failed.length >= batch) {
      result.remaining++;
      continue;
    }
    try {
      const created = await createPortalLogin(user, {
        partyId: null,
        email: row.email,
        name: row.name,
        role: "operator",
        locale: "pt",
        password,
        mustChangePassword: true,
      });
      const note = reviewNoteOf(row.review);
      await setTeamMember(user, created.id, {
        jobLevel: row.level,
        managerUserId: null,
        division: null,
        positionId: row.positionId,
        areaId: row.areaId,
        functions: row.functions,
        reviewNote: note,
      });
      result.created.push({ ...who, review: !!note });
    } catch (error) {
      result.failed.push({ ...who, error: codeOf(error) });
    }
  }
  await audit(
    user,
    "team.import",
    "user",
    user.id,
    `Importação da equipe: ${result.created.length} login(s) criado(s), ${result.linked.length} ligado(s), ${result.failed.length} com erro, ${result.remaining} para a próxima rodada${result.pending.length ? `, ${result.pending.length} aguardando e-mail` : ""}`,
    null,
    {
      created: result.created.map((c) => c.email),
      linked: result.linked.map((c) => c.email),
      skipped: result.skipped,
      failed: result.failed,
      remaining: result.remaining,
      pending: result.pending,
    },
  );
  return result;
}
