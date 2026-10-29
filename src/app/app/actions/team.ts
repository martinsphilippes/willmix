"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { JOB_LEVELS } from "@/lib/db/schema";
import { requireUser, run, str } from "./helpers";

/*
 * Equipe e carteira (painel de SLA): cargo e chefe de cada login da Wellmix e
 * o operador responsável por cada cliente. Só o administrador; o serviço
 * confere de novo (papel, ciclo na equipe, operador válido).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const optionalId = z.union([z.literal(""), ID]).transform((v) => v || null);
const level = z
  .union([z.literal(""), z.enum(JOB_LEVELS)])
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
    });
    return `/app/team?saved=member#u-${targetId}`;
  });
}

export async function setCustomerOwnerAction(form: FormData) {
  const user = await requireUser();
  await run("/app/team#portfolio", async () => {
    assertRole(user, ["admin"]);
    const partyId = ID.parse(str(form, "partyId"));
    const { setCustomerOwner } = await import("@/lib/services/team");
    await setCustomerOwner(
      user,
      partyId,
      optionalId.parse(str(form, "ownerUserId")),
    );
    return `/app/team?saved=portfolio#c-${partyId}`;
  });
}
