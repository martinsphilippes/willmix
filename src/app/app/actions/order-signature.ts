"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * Documento do pedido (docs/ORDER_SIGNATURE.md): assinar. Aqui só o formato;
 * o serviço confere quem pode ver o documento, de quem é a vez e a versão.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export async function signOrderDocumentAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  const back = ID.test(orderId)
    ? `/app/orders/${orderId}/purchase-order`
    : "/app";
  await run(back, async () => {
    assertScreen(user, "orders");
    const id = z.string().regex(ID).parse(orderId);
    const name = str(form, "name");
    if (name.length > 200) throw new Error("signature_name_required");
    const { signOrderDocument } =
      await import("@/lib/services/order-signature");
    await signOrderDocument(user, id, {
      name,
      agree: form.get("agree") === "on",
      hash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(str(form, "hash")),
      onBehalfOfSupplier: str(form, "onBehalf") === "1",
    });
    return `/app/orders/${id}/purchase-order?signed=1`;
  });
}
