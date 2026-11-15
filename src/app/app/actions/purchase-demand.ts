"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import { field, requireUser, run, str } from "./helpers";

/*
 * Compra por demanda (mapa B10 e B14; docs/PURCHASE_DEMAND.md). Aqui só o
 * formato; o serviço confere quem pode (ação "Abrir reposição").
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00.000Z`)));

/** Reposição aberta à mão pelo Planner: produto, quantidade e data desejada. */
export async function openReplenishmentAction(form: FormData) {
  const user = await requireUser();
  await run("/app/replenishment", async () => {
    assertScreen(user, "requests");
    const productId = ID.parse(str(form, "productId"));
    const quantity = z
      .number()
      .positive()
      .max(10_000_000)
      .parse(parseNumberInput(str(form, "quantity")));
    const day = str(form, "desiredAt");
    const desiredAt = day ? `${DAY.parse(day)}T12:00:00.000Z` : null;
    const notes = field(form, "notes", z.string().trim().max(2000)) || null;
    const { openReplenishment } = await import(
      "@/lib/services/purchase-demand"
    );
    const request = await openReplenishment(user, {
      productId,
      quantity,
      desiredAt,
      notes,
    });
    return `/app/replenishment?opened=${encodeURIComponent(request.id)}`;
  });
}
