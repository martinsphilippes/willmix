"use server";

import { z } from "zod";
import { requireUser, run, str } from "./helpers";

/*
 * Fluxo de compras, Fase B: liberar o dumping marcado pelo despachante na
 * ficha da cotação (gerente de produto, comprador ou admin; o serviço confere).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function releaseDumpingAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "quoteId");
  const quoteId = ID.safeParse(raw).success ? raw : "";
  await run(quoteId ? `/app/quotes/${quoteId}#dumping` : "/app", async () => {
    const id = ID.parse(quoteId);
    const { releaseDumping } = await import("@/lib/services/purchase-flow");
    await releaseDumping(user, id);
    return `/app/quotes/${id}?dumping=released#dumping`;
  });
}
