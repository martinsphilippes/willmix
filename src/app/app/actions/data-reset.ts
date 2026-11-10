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
    const result = await resetSalesData(user, confirm);
    // partial: parou no limite de tempo (tocar de novo continua);
    // new: terminou, mas surgiram vendas durante a limpeza (numeração mantida).
    const done = !result.finished
      ? "partial"
      : result.countersReset
        ? "1"
        : "new";
    return `/app/settings/reset?done=${done}`;
  });
}

/**
 * Limpar os cadastros que vêm do Sankhya (parceiros, produtos, linhas,
 * condições de pagamento, locais), antes da migração. Só o administrador,
 * com a palavra; o serviço exige as vendas já apagadas.
 */
export async function resetCatalogDataAction(form: FormData) {
  const user = await requireUser();
  await run("/app/settings/reset", async () => {
    assertRole(user, ["admin"]);
    const confirm = z.string().max(20).parse(str(form, "confirm"));
    const { resetCatalogData } = await import("@/lib/services/catalog-reset");
    const result = await resetCatalogData(user, confirm);
    return `/app/settings/reset?catalog=${result.finished ? "1" : "partial"}#catalog`;
  });
}
