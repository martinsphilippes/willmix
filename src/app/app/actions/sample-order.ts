"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * Pedido de amostras do pedido de compra (docs/SAMPLE_ORDER.md): a Wellmix
 * gera ou marca "sem amostras"; o fornecedor aceita. Aqui só o formato; o
 * serviço confere papel, etapa e versão.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const backOf = (orderId: string) =>
  ID.test(orderId) ? `/app/orders/${orderId}/samples` : "/app";

export async function decideSampleOrderAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    const input = z
      .object({
        orderId: z.string().regex(ID),
        status: z.enum(["ordered", "none"]),
        note: z.string().max(500).nullable(),
      })
      .parse({
        orderId,
        status: str(form, "status"),
        note: str(form, "note") || null,
      });
    const { decideSampleOrder } = await import("@/lib/services/sample-order");
    await decideSampleOrder(user, input.orderId, {
      status: input.status,
      note: input.note,
    });
    return `${backOf(input.orderId)}?decided=${input.status}`;
  });
}

export async function acceptSampleOrderAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    const input = z
      .object({
        orderId: z.string().regex(ID),
        name: z.string().max(200),
        hash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse({ orderId, name: str(form, "name"), hash: str(form, "hash") });
    const { acceptSampleOrder } = await import("@/lib/services/sample-order");
    await acceptSampleOrder(user, input.orderId, {
      name: input.name,
      agree: form.get("agree") === "on",
      hash: input.hash,
    });
    return `${backOf(input.orderId)}?accepted=1`;
  });
}
