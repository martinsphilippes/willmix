"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth/permissions";
import { requireUser, run, str } from "./helpers";

/**
 * Limpar dados de teste (vendas): só o administrador, com a palavra de
 * confirmação digitada. O serviço confere de novo papel e palavra.
 */
export async function resetSalesDataAction(form: FormData) {
  const user = await requireUser();
  await run("/app/settings/reset", async () => {
    assertRole(user, ["admin"]);
    const confirm = z.string().max(20).parse(str(form, "confirm"));
    const { resetSalesData } = await import("@/lib/services/data-reset");
    await resetSalesData(user, confirm);
    return "/app/settings/reset?done=1";
  });
}
