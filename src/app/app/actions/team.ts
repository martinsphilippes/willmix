"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { DIVISIONS, JOB_LEVELS } from "@/lib/db/schema";
import { ACTION_KEYS } from "@/lib/auth/function-access";
import { SCREENS } from "@/lib/auth/screens";
import { LOCALES } from "@/lib/db/schema";
import { loginLabel } from "@/lib/auth/login-id";
import { requireUser, run, str } from "./helpers";

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

export async function saveTeamMemberAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team", async () => {
    assertRole(user, ["admin"]);
    const targetId = ID.parse(str(form, "userId"));
    const { setTeamMember } = await import("@/lib/services/team");
    await setTeamMember(user, targetId, {
      jobLevel: level.parse(str(form, "jobLevel")),
      managerUserId: optionalId.parse(str(form, "managerUserId")),
      division: division.parse(str(form, "division")),
      // Caixas de marcação das funções (o formulário sempre manda o marcador).
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
      // Telas: "default" volta ao padrão das funções; "custom" grava as caixas marcadas.
      ...(form.has("screens.__form")
        ? {
            screens:
              z
                .enum(["default", "custom"])
                .parse(str(form, "screensMode") || "default") === "default"
                ? null
                : z
                    .array(z.enum(SCREENS))
                    .max(SCREENS.length)
                    .parse(
                      form
                        .getAll("screens")
                        .filter((v): v is string => typeof v === "string"),
                    ),
          }
        : {}),
    });
    return `/app/team?saved=member#u-${targetId}`;
  });
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
