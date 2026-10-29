"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { DIVISIONS, JOB_LEVELS, WELLMIX_FUNCTIONS } from "@/lib/db/schema";
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
              .array(z.enum(WELLMIX_FUNCTIONS))
              .max(WELLMIX_FUNCTIONS.length)
              .parse(
                form
                  .getAll("functions")
                  .filter((v): v is string => typeof v === "string"),
              ),
          }
        : {}),
    });
    return `/app/team?saved=member#u-${targetId}`;
  });
}

export async function setLineDivisionAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team#lines", async () => {
    assertRole(user, ["admin"]);
    const lineId = ID.parse(str(form, "lineId"));
    const { setLineDivision } = await import("@/lib/services/team");
    await setLineDivision(user, lineId, division.parse(str(form, "division")));
    return `/app/team?saved=line#l-${lineId}`;
  });
}

/** Distribui as pendências sem responsável pela divisão da linha. */
export async function distributeUnassignedAction() {
  const user = await requireUser();
  await run("/app/team", async () => {
    assertRole(user, ["admin"]);
    const { distributeUnassigned } = await import("@/lib/services/team");
    const done = await distributeUnassigned(user);
    return `/app/team?distributed=${done.requests + done.orders}`;
  });
}
