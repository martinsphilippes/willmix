"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { field, requireUser, run, str } from "./helpers";

/*
 * Ficha técnica do fornecedor (dono, 20/11/2026; docs/PURCHASE_DEMAND.md,
 * "Ficha técnica na cotação"): o Cadastro aceita ou recusa a correção. Aqui
 * só o formato; o serviço confere a ação "Revisar a ficha técnica do
 * fornecedor". Não muda o cadastro do produto nem o Sankhya.
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);

export async function reviewSupplierSheetAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "sheetId");
  const back = ID.safeParse(raw).success
    ? `/app/supplier-sheets/${raw}`
    : "/app/supplier-sheets";
  await run(back, async () => {
    assertScreen(user, "products");
    const sheetId = ID.parse(raw);
    const decision = z.enum(["accept", "reject"]).parse(str(form, "decision"));
    const note = field(form, "note", z.string().trim().max(2000)) || null;
    const { reviewSupplierSheet } =
      await import("@/lib/services/supplier-sheets");
    await reviewSupplierSheet(user, sheetId, {
      accept: decision === "accept",
      note,
    });
    return `/app/supplier-sheets/${sheetId}?reviewed=${decision === "accept" ? "accepted" : "rejected"}`;
  });
}
