"use server";

import { z } from "zod";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Programação de compra (docs/PURCHASE_SCHEDULE.md): "Gerar as rodadas do
 * dia" no pedido pai. O job diário faz o mesmo sozinho; o serviço confere
 * papel, tela e se o pedido é pai.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function spawnRoundsAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "orderId");
  const back = ID.safeParse(raw).success ? `/app/orders/${raw}` : "/app/orders";
  await run(back, async () => {
    const orderId = ID.parse(raw);
    const { spawnRoundsNow } = await import("@/lib/services/purchase-rounds");
    const created = await spawnRoundsNow(user, orderId);
    return withQuery(back, "rounds", String(created.length));
  });
}
