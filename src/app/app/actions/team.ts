"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { DIVISIONS, JOB_LEVELS } from "@/lib/db/schema";
import { ACTION_KEYS } from "@/lib/auth/function-access";
import { revalidatePath } from "next/cache";
import { SCREENS } from "@/lib/auth/screens";
import { LOCALES } from "@/lib/db/schema";
import { loginLabel } from "@/lib/auth/login-id";
import { getT } from "@/i18n/server";
import { errorTextFor } from "@/i18n/error-text";
import { errorCode, requireUser, run, str } from "./helpers";

/*
 * Equipe e divisões (painel de SLA): cargo, chefe e divisão de cada login da
 * Wellmix e a divisão de cada linha de produto (a solicitação cai sozinha no
 * analista da divisão). Só o administrador; o serviço confere de novo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const optionalId = z.union([z.literal(""), ID]).transform((v) => v || null);
const level = z
  .union([z.literal(""), z.enum(JOB_LEVELS)])
  .transform((v) => v || null);
const division = z
  .union([z.literal(""), z.enum(DIVISIONS)])
  .transform((v) => v || null);

const screenList = (form: FormData, key: string) =>
  z
    .array(z.enum(SCREENS))
    .max(SCREENS.length)
    .parse(form.getAll(key).filter((v): v is string => typeof v === "string"));

/**
 * Card "Telas que o login abre": "default" volta ao padrão das funções;
 * "custom" grava as exceções (dono, 14/11/2026): `exAdded` são as telas
 * marcadas à mão e `exRemoved` as desmarcadas, por cima das funções,
 * inclusive as do Início. Formulário antigo (sem o marcador
 * `screens.__exceptions`): a lista das caixas marcadas, como antes.
 */
function screensFromForm(form: FormData): {
  screens?: string[] | null;
  screenExceptions?: { added: string[]; removed: string[] } | null;
} {
  const mode = z
    .enum(["default", "custom"])
    .parse(str(form, "screensMode") || "default");
  if (mode === "default") return { screens: null };
  if (form.has("screens.__exceptions"))
    return {
      screenExceptions: {
        added: screenList(form, "exAdded"),
        removed: screenList(form, "exRemoved"),
      },
    };
  return { screens: screenList(form, "screens") };
}

/** Os campos de Editar acessos (página e painel lateral). */
function teamMemberInput(form: FormData) {
  return {
    jobLevel: level.parse(str(form, "jobLevel")),
    managerUserId: optionalId.parse(str(form, "managerUserId")),
    division: division.parse(str(form, "division")),
    // Área (o campo novo; formulário de antes, sem ele, não muda a área).
    ...(form.has("areaId")
      ? { areaId: optionalId.parse(str(form, "areaId")) }
      : {}),
    // Cargo (com área, a área vem dele; formulário sem o campo não muda).
    ...(form.has("positionId")
      ? { positionId: optionalId.parse(str(form, "positionId")) }
      : {}),
    // "A conferir": marcado como conferido, a marcação sai.
    ...(form.getAll("reviewDone").includes("on") ? { reviewNote: null } : {}),
    // Funções marcadas (o formulário sempre manda o marcador).
    ...(form.has("functions.__form")
      ? {
          functions: z
            .array(z.string().regex(/^[a-z0-9_]{1,48}$/))
            .max(60)
            .parse(
              form
                .getAll("functions")
                .filter((v): v is string => typeof v === "string"),
            ),
        }
      : {}),
    ...(form.has("screens.__form") ? screensFromForm(form) : {}),
  };
}

export async function saveTeamMemberAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team", async () => {
    assertRole(user, ["admin"]);
    const targetId = ID.parse(str(form, "userId"));
    const { setTeamMember } = await import("@/lib/services/team");
    await setTeamMember(user, targetId, teamMemberInput(form));
    return `/app/team?saved=member#u-${targetId}`;
  });
}

/** Resultado de "Salvar" no painel Editar acessos e em Funções e acessos. */
export interface TeamSaveState {
  ok: boolean;
  /** Código da recusa; nulo quando deu certo (ou antes de enviar). */
  error: string | null;
  /** Texto da recusa, no idioma de quem salvou. */
  message: string | null;
  /** Quando o servidor terminou de gravar (ISO). */
  savedAt: string | null;
}

async function refused(back: string, error: unknown): Promise<TeamSaveState> {
  const code = errorCode(back, error);
  const t = await getT();
  return {
    ok: false,
    error: code,
    message: errorTextFor(t, code, ["team.error"]),
    savedAt: null,
  };
}

/**
 * Editar acessos (painel lateral da lista e página da pessoa; dono,
 * 14/11/2026): grava cargo, divisão, chefe, funções e telas e fica na mesma
 * tela. A lista e o menu são atualizados no lugar (revalidatePath).
 */
export async function saveTeamAccessAction(
  _prev: TeamSaveState,
  form: FormData,
): Promise<TeamSaveState> {
  const user = await requireUser();
  try {
    assertRole(user, ["admin"]);
    const targetId = ID.parse(str(form, "userId"));
    const { setTeamMember } = await import("@/lib/services/team");
    await setTeamMember(user, targetId, teamMemberInput(form));
  } catch (error) {
    return refused("/app/team", error);
  }
  revalidatePath("/app", "layout");
  return {
    ok: true,
    error: null,
    message: null,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Exclui o acesso de um login da equipe (só o administrador; o serviço
 * confere de novo, inclusive o próprio acesso e o último administrador).
 * Opções da confirmação: passar quem respondia a ela para o chefe dela e
 * redistribuir as pendências dela pela divisão. Feito, volta à lista com
 * "Acesso excluído com sucesso" e o resumo; com erro, volta à pessoa com o
 * motivo (a lista lê do banco, nada fica pela metade).
 */
export async function removeTeamMemberAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "userId");
  const valid = ID.safeParse(raw).success;
  await run(valid ? `/app/team/${raw}` : "/app/team", async () => {
    assertRole(user, ["admin"]);
    const targetId = ID.parse(raw);
    const { removeTeamMember } = await import("@/lib/services/team");
    const done = await removeTeamMember(user, targetId, {
      moveReports: form.getAll("moveReports").includes("on"),
      redistribute: form.getAll("redistribute").includes("on"),
    });
    // Resumo na lista: quantos passaram (e para quem) e o que ficou sem dono.
    const summary = new URLSearchParams({ saved: "deleted" });
    if (done.moved && done.movedTo) {
      summary.set("reports", String(done.moved));
      summary.set("to", done.movedTo.id);
    }
    if (done.redistributed) summary.set("work", String(done.redistributed));
    if (done.unassigned) summary.set("left", String(done.unassigned));
    return `/app/team?${summary.toString()}`;
  });
}

/**
 * Novo login da equipe Wellmix (só o administrador): nome, login (e-mail ou
 * nome de usuário), senha e o lugar na hierarquia (cargo, divisão, a quem
 * responde, funções). Depois de criar, abre "Editar acessos" da pessoa, para
 * conferir as funções e marcar as telas uma a uma, se precisar.
 */
export async function createTeamLoginAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team?tab=team&new=1", async () => {
    assertRole(user, ["admin"]);
    const { PORTAL_MIN_PASSWORD, createPortalLogin } =
      await import("@/lib/services/portal-access");
    // Senha curta: recusa com o motivo certo (não "confira os campos").
    if (str(form, "password").length < PORTAL_MIN_PASSWORD)
      throw new Error("user_password_short");
    const parsed = z
      .object({
        name: z.string().min(2).max(120),
        // Nome de usuário ou e-mail: o formato é conferido no serviço.
        email: z.string().min(3).max(254),
        password: z.string().min(PORTAL_MIN_PASSWORD).max(128),
        role: z.enum(["operator", "admin"]),
        locale: z.enum(LOCALES),
      })
      .parse({
        name: str(form, "name"),
        email: str(form, "login").toLowerCase(),
        password: str(form, "password"),
        role: str(form, "role") || "operator",
        locale: str(form, "locale") || "pt",
      });
    const place = {
      jobLevel: level.parse(str(form, "jobLevel")),
      managerUserId: optionalId.parse(str(form, "managerUserId")),
      division: division.parse(str(form, "division")),
      areaId: optionalId.parse(str(form, "areaId")),
      positionId: optionalId.parse(str(form, "positionId")),
      functions: z
        .array(z.string().regex(/^[a-z0-9_]{1,48}$/))
        .max(60)
        .parse(
          form
            .getAll("functions")
            .filter((v): v is string => typeof v === "string"),
        ),
    };
    const created = await createPortalLogin(user, {
      ...parsed,
      partyId: null,
      mustChangePassword: form.getAll("mustChange").includes("on"),
    });
    const { setTeamMember } = await import("@/lib/services/team");
    await setTeamMember(user, created.id, place);
    // O login (não a senha) volta na confirmação, para conferir o que passar.
    const login = encodeURIComponent(loginLabel(created.email));
    return `/app/team/${created.id}?created=${login}`;
  });
}

export async function setLineDivisionAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team?tab=lines#lines", async () => {
    assertRole(user, ["admin"]);
    const lineId = ID.parse(str(form, "lineId"));
    const { setLineDivision } = await import("@/lib/services/team");
    await setLineDivision(user, lineId, division.parse(str(form, "division")));
    return `/app/team?tab=lines&saved=line#l-${lineId}`;
  });
}

/** Distribui as pendências sem responsável pela divisão da linha. */
export async function distributeUnassignedAction() {
  const user = await requireUser();
  await run("/app/team?tab=lines", async () => {
    assertRole(user, ["admin"]);
    const { distributeUnassigned } = await import("@/lib/services/team");
    const done = await distributeUnassigned(user);
    return `/app/team?tab=lines&distributed=${done.requests + done.orders}`;
  });
}

/* ---- Áreas (Equipe Acessos e Parceiros → Áreas; só o administrador) ---- */

const AREAS = "/app/team?tab=areas";
const areaBack = (id: string, saved: string) =>
  `${AREAS}&saved=${saved}#a-${id}`;

/** Uma área nova. */
export async function createTeamAreaAction(form: FormData) {
  const user = await requireUser();
  await run(`${AREAS}#area-new`, async () => {
    assertRole(user, ["admin"]);
    const { createTeamArea } = await import("@/lib/services/team-areas");
    const area = await createTeamArea(
      user,
      z.string().max(500).parse(str(form, "name")),
    );
    return areaBack(area.id, "area_created");
  });
}

/** Muda o nome de uma área. */
export async function renameTeamAreaAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "areaId");
  const valid = ID.safeParse(raw).success;
  await run(valid ? `${AREAS}#a-${raw}` : AREAS, async () => {
    assertRole(user, ["admin"]);
    const areaId = ID.parse(raw);
    const { renameTeamArea } = await import("@/lib/services/team-areas");
    await renameTeamArea(
      user,
      areaId,
      z.string().max(500).parse(str(form, "name")),
    );
    return areaBack(areaId, "area_renamed");
  });
}

/** Desativa (sai das escolhas, fica em quem já está nela) ou reativa. */
export async function setTeamAreaActiveAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "areaId");
  const valid = ID.safeParse(raw).success;
  await run(valid ? `${AREAS}#a-${raw}` : AREAS, async () => {
    assertRole(user, ["admin"]);
    const areaId = ID.parse(raw);
    const active = z.enum(["0", "1"]).parse(str(form, "active")) === "1";
    const { setTeamAreaActive } = await import("@/lib/services/team-areas");
    await setTeamAreaActive(user, areaId, active);
    return areaBack(areaId, active ? "area_activated" : "area_deactivated");
  });
}

/** Um grupo do resumo do cadastro em massa, já no idioma de quem enviou. */
export interface TeamBulkGroup {
  kind: string;
  title: string;
  items: string[];
}

/**
 * Resultado do cadastro em massa de áreas e de cargos: fica na tela, com o
 * resumo (o que entrou, o que já existia e o que ficou de fora).
 */
export interface TeamBulkState {
  ok: boolean;
  error: string | null;
  message: string | null;
  /** "Pronto: N criada(s)..." */
  done: string | null;
  /** Quantos entraram e quantos já existiam. */
  created: number;
  existing: number;
  groups: TeamBulkGroup[];
  /** O texto colado, de volta quando a gravação foi recusada. */
  text: string;
  /** Quando o servidor terminou (ISO); muda a cada envio. */
  doneAt: string | null;
}

const group = (kind: string, title: string, items: string[]) =>
  items.length ? [{ kind, title, items }] : [];

async function bulkRefused(
  back: string,
  error: unknown,
  form: FormData,
): Promise<TeamBulkState> {
  const code = errorCode(back, error);
  const t = await getT();
  return {
    ok: false,
    error: code,
    message: errorTextFor(t, code, ["team.error"]),
    done: null,
    created: 0,
    existing: 0,
    groups: [],
    text: str(form, "names").slice(0, 20_000),
    doneAt: new Date().toISOString(),
  };
}

/**
 * Cadastro em massa de áreas: uma por linha. Cria só as que faltam; as que
 * já existem ficam como estão e voltam no resumo (src/lib/team-areas.ts).
 */
export async function bulkTeamAreasAction(
  _prev: TeamBulkState,
  form: FormData,
): Promise<TeamBulkState> {
  const user = await requireUser();
  try {
    assertRole(user, ["admin"]);
    const text = z.string().max(20_000).parse(str(form, "names"));
    const { bulkCreateTeamAreas } = await import("@/lib/services/team-areas");
    const done = await bulkCreateTeamAreas(user, text);
    revalidatePath("/app", "layout");
    const t = await getT();
    return {
      ok: true,
      error: null,
      message: null,
      done: t("area.bulk.done", {
        created: done.created.length,
        existing: done.existing.length,
      }),
      created: done.created.length,
      existing: done.existing.length,
      groups: [
        ...group(
          "created",
          t("area.bulk.created", { n: done.created.length }),
          done.created.map((c) => c.name),
        ),
        ...group(
          "existing",
          t("area.bulk.existing", { n: done.existing.length }),
          done.existing.map((e) =>
            [
              e.asked,
              e.name !== e.asked
                ? `(${t("area.bulk.as", { name: e.name })})`
                : null,
              e.active ? null : t("area.inactiveSuffix"),
            ]
              .filter(Boolean)
              .join(" "),
          ),
        ),
        ...group(
          "repeated",
          t("area.bulk.repeated", { n: done.repeated.length }),
          done.repeated,
        ),
        ...group(
          "invalid",
          t("area.bulk.invalid", { n: done.invalid.length }),
          done.invalid,
        ),
        ...group(
          "header",
          t("area.bulk.header"),
          done.header ? [done.header.replace(/\s+/g, " ")] : [],
        ),
      ],
      text: "",
      doneAt: new Date().toISOString(),
    };
  } catch (error) {
    return bulkRefused(AREAS, error, form);
  }
}

/* ---- Cargos (Equipe Acessos e Parceiros → Cargos; só o administrador) ---- */

const POSITIONS = "/app/team?tab=positions";
const positionBack = (id: string, saved: string) =>
  `${POSITIONS}&saved=${saved}#p-${id}`;

/** Um cargo novo, com a área. */
export async function createTeamPositionAction(form: FormData) {
  const user = await requireUser();
  await run(`${POSITIONS}#position-new`, async () => {
    assertRole(user, ["admin"]);
    const { createTeamPosition } =
      await import("@/lib/services/team-positions");
    const position = await createTeamPosition(
      user,
      z.string().max(500).parse(str(form, "name")),
      optionalId.parse(str(form, "areaId")),
    );
    return positionBack(position.id, "position_created");
  });
}

/** Muda o nome de um cargo. */
export async function renameTeamPositionAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "positionId");
  const valid = ID.safeParse(raw).success;
  await run(valid ? `${POSITIONS}#p-${raw}` : POSITIONS, async () => {
    assertRole(user, ["admin"]);
    const positionId = ID.parse(raw);
    const { renameTeamPosition } =
      await import("@/lib/services/team-positions");
    await renameTeamPosition(
      user,
      positionId,
      z.string().max(500).parse(str(form, "name")),
    );
    return positionBack(positionId, "position_renamed");
  });
}

/** Muda a área do cargo (quem tem o cargo vai junto). */
export async function setTeamPositionAreaAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "positionId");
  const valid = ID.safeParse(raw).success;
  await run(valid ? `${POSITIONS}#p-${raw}` : POSITIONS, async () => {
    assertRole(user, ["admin"]);
    const positionId = ID.parse(raw);
    const { setTeamPositionArea } =
      await import("@/lib/services/team-positions");
    const done = await setTeamPositionArea(
      user,
      positionId,
      optionalId.parse(str(form, "areaId")),
    );
    return `${POSITIONS}&saved=position_area&moved=${done.moved}#p-${positionId}`;
  });
}

/** Desativa (sai das escolhas, fica em quem já está nele) ou reativa. */
export async function setTeamPositionActiveAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "positionId");
  const valid = ID.safeParse(raw).success;
  await run(valid ? `${POSITIONS}#p-${raw}` : POSITIONS, async () => {
    assertRole(user, ["admin"]);
    const positionId = ID.parse(raw);
    const active = z.enum(["0", "1"]).parse(str(form, "active")) === "1";
    const { setTeamPositionActive } =
      await import("@/lib/services/team-positions");
    await setTeamPositionActive(user, positionId, active);
    return positionBack(
      positionId,
      active ? "position_activated" : "position_deactivated",
    );
  });
}

/**
 * Cadastro em massa de cargos: um por linha, com a área na mesma linha
 * (tabulação ou ";") ou a área escolhida para a lista. Cria só os que
 * faltam (src/lib/team-positions.ts).
 */
export async function bulkTeamPositionsAction(
  _prev: TeamBulkState,
  form: FormData,
): Promise<TeamBulkState> {
  const user = await requireUser();
  try {
    assertRole(user, ["admin"]);
    const text = z.string().max(20_000).parse(str(form, "names"));
    const { bulkCreateTeamPositions } =
      await import("@/lib/services/team-positions");
    const done = await bulkCreateTeamPositions(
      user,
      text,
      optionalId.parse(str(form, "areaId")),
    );
    revalidatePath("/app", "layout");
    const t = await getT();
    const { listTeamAreas } = await import("@/lib/services/team-areas");
    const areas = await listTeamAreas();
    const areaName = (id: string | null) =>
      (id && areas.find((a) => a.id === id)?.name) || t("position.noArea");
    return {
      ok: true,
      error: null,
      message: null,
      done: t("position.bulk.done", {
        created: done.created.length,
        existing: done.existing.length,
      }),
      created: done.created.length,
      existing: done.existing.length,
      groups: [
        ...group(
          "created",
          t("position.bulk.created", { n: done.created.length }),
          done.created.map(
            (c) => `${c.name} → ${c.areaName ?? t("position.noArea")}`,
          ),
        ),
        ...group(
          "existing",
          t("position.bulk.existing", { n: done.existing.length }),
          done.existing.map((e) =>
            [
              e.asked,
              e.name !== e.asked
                ? `(${t("position.bulk.as", { name: e.name })})`
                : null,
              `→ ${areaName(e.areaId)}`,
              e.active ? null : t("position.inactiveSuffix"),
            ]
              .filter(Boolean)
              .join(" "),
          ),
        ),
        ...group(
          "unknownArea",
          t("position.bulk.unknownArea", { n: done.unknownArea.length }),
          done.unknownArea.map((u) =>
            t("position.bulk.unknownAreaItem", { name: u.name, area: u.area }),
          ),
        ),
        ...group(
          "repeated",
          t("position.bulk.repeated", { n: done.repeated.length }),
          done.repeated,
        ),
        ...group(
          "invalid",
          t("position.bulk.invalid", { n: done.invalid.length }),
          done.invalid,
        ),
        ...group(
          "header",
          t("area.bulk.header"),
          done.header ? [done.header.replace(/\s+/g, " ")] : [],
        ),
      ],
      text: "",
      doneAt: new Date().toISOString(),
    };
  } catch (error) {
    return bulkRefused(POSITIONS, error, form);
  }
}

/* ---- Importar equipe (Equipe → "Importar da planilha"; só o administrador) ---- */

/** Uma linha da prévia, pronta para a tela. */
export interface TeamImportViewRow {
  line: number;
  name: string;
  email: string;
  position: string;
  positionKnown: boolean;
  area: string | null;
  functions: string[];
  level: string;
  review: string[];
  status: string;
}

/** Resultado de "Conferir" e de "Criar os logins" (fica na tela). */
export interface TeamImportState {
  ok: boolean;
  error: string | null;
  message: string | null;
  intent: "preview" | "run" | null;
  header: string | null;
  rows: TeamImportViewRow[];
  invalid: { line: number; text: string; reason: string }[];
  repeated: { line: number; email: string }[];
  /** Sem e-mail: ficam "Aguardando e-mail" ao criar os logins. */
  pending: {
    line: number;
    name: string;
    position: string;
    area: string | null;
    already: boolean;
  }[];
  result: {
    created: { name: string; email: string; review: boolean }[];
    linked: { name: string; email: string }[];
    skipped: { name: string; email: string; reason: string }[];
    failed: { name: string; email: string; error: string; message: string }[];
    remaining: number;
    pending: string[];
  } | null;
  doneAt: string | null;
}

/**
 * "Conferir" mostra o que cada linha vira (sem gravar); "Criar os logins"
 * cria em lotes, com a senha provisória igual para todos e a troca no
 * primeiro acesso (src/lib/services/team-import.ts).
 */
export async function teamImportAction(
  _prev: TeamImportState,
  form: FormData,
): Promise<TeamImportState> {
  const user = await requireUser();
  const intent = str(form, "intent") === "run" ? "run" : "preview";
  const empty: TeamImportState = {
    ok: false,
    error: null,
    message: null,
    intent,
    header: null,
    rows: [],
    invalid: [],
    repeated: [],
    pending: [],
    result: null,
    doneAt: new Date().toISOString(),
  };
  try {
    assertRole(user, ["admin"]);
    const text = z.string().max(100_000).parse(str(form, "rows"));
    const service = await import("@/lib/services/team-import");
    let result: TeamImportState["result"] = null;
    if (intent === "run") {
      const password = z
        .string()
        .max(128)
        .parse(form.get("password") ?? "");
      const done = await service.runTeamImport(user, text, password);
      const t = await getT();
      result = {
        ...done,
        failed: done.failed.map((f) => ({
          ...f,
          message: errorTextFor(t, f.error, ["team.error"]),
        })),
      };
      revalidatePath("/app", "layout");
    }
    // A prévia depois de criar mostra a situação nova de cada linha.
    const preview = await service.previewTeamImport(user, text);
    return {
      ...empty,
      ok: true,
      header: preview.header,
      invalid: preview.invalid,
      repeated: preview.repeated,
      pending: preview.pending.map((p) => ({
        line: p.line,
        name: p.name,
        position: p.positionName,
        area: p.areaName,
        already: p.already,
      })),
      rows: preview.rows.map((r) => ({
        line: r.line,
        name: r.name,
        email: r.email,
        position: r.positionName,
        positionKnown: !!r.positionId,
        area: r.areaName,
        functions: r.functions,
        level: r.level,
        review: r.review,
        status: r.status,
      })),
      result,
    };
  } catch (error) {
    const code = errorCode("/app/team/import", error);
    const t = await getT();
    return {
      ...empty,
      error: code,
      message: errorTextFor(t, code, ["team.error"]),
    };
  }
}

/* ---- Aguardando e-mail (Equipe → "Aguardando e-mail"; só o administrador) ---- */

const PENDING_BACK = "/app/team?panel=pending";

/**
 * Cria o login de quem aguardava e-mail: o e-mail (ou nome de usuário) e a
 * senha provisória da tela; cargo, área, funções e o "a conferir" guardados.
 */
export async function createPendingLoginAction(form: FormData) {
  const user = await requireUser();
  await run(PENDING_BACK, async () => {
    assertRole(user, ["admin"]);
    const { PORTAL_MIN_PASSWORD } =
      await import("@/lib/services/portal-access");
    const password = z
      .string()
      .max(128)
      .parse(form.get("password") ?? "");
    if (password.length < PORTAL_MIN_PASSWORD)
      throw new Error("user_password_short");
    const { createLoginFromPending } =
      await import("@/lib/services/team-pending");
    const created = await createLoginFromPending(
      user,
      ID.parse(str(form, "pendingId")),
      z.string().min(3).max(254).parse(str(form, "login").toLowerCase()),
      password,
    );
    const done = new URLSearchParams({
      panel: "pending",
      saved: "pending_created",
      login: created.name.slice(0, 120),
    });
    return `/app/team?${done.toString()}`;
  });
}

/** Tira da lista quem não vai ter login (o registro fica). */
export async function removePendingAction(form: FormData) {
  const user = await requireUser();
  await run(PENDING_BACK, async () => {
    assertRole(user, ["admin"]);
    const { removeTeamPending } = await import("@/lib/services/team-pending");
    const row = await removeTeamPending(user, ID.parse(str(form, "pendingId")));
    const done = new URLSearchParams({
      panel: "pending",
      saved: "pending_removed",
      login: row.name.slice(0, 120),
    });
    return `/app/team?${done.toString()}`;
  });
}

/* ---- Funções e acessos (Equipe → Funções e acessos; só o administrador) ---- */

const FN_KEY = z.string().regex(/^[a-z0-9_]{1,48}$/);
const fnBack = (key: string, view = "screens") =>
  `/app/team?tab=functions&fn=${encodeURIComponent(key)}&view=${view}`;

export async function createFunctionAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team?tab=functions", async () => {
    assertRole(user, ["admin"]);
    const name = z.string().trim().min(2).max(60).parse(str(form, "name"));
    const { createFunction } = await import("@/lib/services/team-functions");
    const def = await createFunction(user, name);
    return `${fnBack(def.key)}&saved=created`;
  });
}

export async function renameFunctionAction(form: FormData) {
  const user = await requireUser();
  const key = str(form, "key");
  await run(fnBack(key), async () => {
    assertRole(user, ["admin"]);
    FN_KEY.parse(key);
    const name = z.string().trim().max(60).parse(str(form, "name"));
    const { renameFunction } = await import("@/lib/services/team-functions");
    await renameFunction(user, key, name);
    return `${fnBack(key)}&saved=renamed`;
  });
}

export async function saveFunctionScreensAction(form: FormData) {
  const user = await requireUser();
  const key = str(form, "key");
  await run(fnBack(key), async () => {
    assertRole(user, ["admin"]);
    FN_KEY.parse(key);
    const screens = z
      .array(z.enum(SCREENS))
      .max(SCREENS.length)
      .parse(
        form
          .getAll("screens")
          .filter((v): v is string => typeof v === "string"),
      );
    const { setFunctionScreens } =
      await import("@/lib/services/team-functions");
    await setFunctionScreens(user, key, screens);
    return `${fnBack(key)}&saved=screens`;
  });
}

export async function saveFunctionActionsAction(form: FormData) {
  const user = await requireUser();
  const key = str(form, "key");
  await run(fnBack(key, "actions"), async () => {
    assertRole(user, ["admin"]);
    FN_KEY.parse(key);
    const actions = z
      .array(z.enum(ACTION_KEYS as [string, ...string[]]))
      .max(ACTION_KEYS.length)
      .parse(
        form
          .getAll("actions")
          .filter((v): v is string => typeof v === "string"),
      );
    const { setFunctionActions } =
      await import("@/lib/services/team-functions");
    await setFunctionActions(
      user,
      key,
      actions as (typeof ACTION_KEYS)[number][],
    );
    return `${fnBack(key, "actions")}&saved=actions`;
  });
}

/**
 * "Salvar permissões" de Funções e acessos (dono, 14/11/2026): telas e ações
 * da função numa gravação só. Fica na mesma tela; o aviso de salvo aparece
 * depois que o servidor terminou.
 */
/**
 * Prévia de impacto antes de salvar uma função (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, R1 e etapa 5b): quem tem a função e o que cada
 * pessoa ganha ou perde em telas e ações com o rascunho. Só calcula, não
 * grava nada; só o administrador (quem grava acessos).
 */
export async function previewFunctionImpactAction(input: {
  key: string;
  screens: string[];
  actions: string[];
}): Promise<
  | { ok: true; impact: import("@/lib/access-impact").FunctionImpact }
  | { ok: false }
> {
  const user = await requireUser();
  try {
    assertRole(user, ["admin"]);
    const key = FN_KEY.parse(input.key);
    const screens = z
      .array(z.enum(SCREENS))
      .max(SCREENS.length)
      .parse(input.screens);
    const actions = z
      .array(z.enum(ACTION_KEYS as [string, ...string[]]))
      .max(ACTION_KEYS.length)
      .parse(input.actions);
    const [{ functionImpact }, { wellmixTeam }, { loadFunctionDefs }] =
      await Promise.all([
        import("@/lib/access-impact"),
        import("@/lib/services/team"),
        import("@/lib/services/team-functions"),
      ]);
    const [team, defs] = await Promise.all([wellmixTeam(), loadFunctionDefs()]);
    return {
      ok: true,
      impact: functionImpact(team, defs, key, { screens, actions }),
    };
  } catch {
    return { ok: false };
  }
}

export async function saveFunctionPermissionsAction(
  _prev: TeamSaveState,
  form: FormData,
): Promise<TeamSaveState> {
  const user = await requireUser();
  const key = str(form, "key");
  try {
    assertRole(user, ["admin"]);
    FN_KEY.parse(key);
    const actions = z
      .array(z.enum(ACTION_KEYS as [string, ...string[]]))
      .max(ACTION_KEYS.length)
      .parse(
        form
          .getAll("actions")
          .filter((v): v is string => typeof v === "string"),
      );
    const { setFunctionPermissions } =
      await import("@/lib/services/team-functions");
    await setFunctionPermissions(
      user,
      key,
      screenList(form, "screens"),
      actions as (typeof ACTION_KEYS)[number][],
    );
  } catch (error) {
    return refused(fnBack(key), error);
  }
  revalidatePath("/app", "layout");
  return {
    ok: true,
    error: null,
    message: null,
    savedAt: new Date().toISOString(),
  };
}

export async function resetFunctionAction(form: FormData) {
  const user = await requireUser();
  const key = str(form, "key");
  await run(fnBack(key), async () => {
    assertRole(user, ["admin"]);
    FN_KEY.parse(key);
    const { resetFunction } = await import("@/lib/services/team-functions");
    await resetFunction(user, key);
    return `${fnBack(key)}&saved=reset`;
  });
}

export async function archiveFunctionAction(form: FormData) {
  const user = await requireUser();
  const key = str(form, "key");
  await run(fnBack(key), async () => {
    assertRole(user, ["admin"]);
    FN_KEY.parse(key);
    const archived = str(form, "archived") === "1";
    const { setFunctionArchived } =
      await import("@/lib/services/team-functions");
    await setFunctionArchived(user, key, archived);
    return `${fnBack(key)}&saved=${archived ? "archived" : "restored"}`;
  });
}
