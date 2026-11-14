"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { field, requireUser, run, str } from "./helpers";

/*
 * Entrega (docs/DELIVERY.md): retomar o pedido pausado pelo canal (só o
 * administrador) e o porto de chegada (Wellmix). O serviço confere o papel.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const backOf = (orderId: string) =>
  ID.test(orderId) ? `/app/orders/${orderId}` : "/app";

export async function resumeOrderAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    z.string().regex(ID).parse(orderId);
    const note = field(form, "note", z.string().trim().max(500)) || null;
    const { resumeOrder } = await import("@/lib/services/delivery");
    await resumeOrder(user, orderId, note);
    return `${backOf(orderId)}?resumed=1`;
  });
}

export async function setArrivalPortAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(`${backOf(orderId)}#delivery`, async () => {
    assertScreen(user, "orders");
    z.string().regex(ID).parse(orderId);
    const { ARRIVAL_PORTS, setArrivalPort } =
      await import("@/lib/services/delivery");
    const port = z.enum(ARRIVAL_PORTS).parse(str(form, "port"));
    await setArrivalPort(user, orderId, port);
    return `${backOf(orderId)}?port=saved#delivery`;
  });
}
