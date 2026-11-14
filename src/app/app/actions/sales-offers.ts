"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";

import { getStore } from "@/lib/db";
import {
  field,
  flowReturnTo,
  requireUser,
  run,
  str,
  withQuery,
} from "./helpers";

/*
 * Vendas (dono, 14/11/2026; docs/FLOW_MENU.md): registra a quem a amostra
 * que chegou ao Brasil (Vendas → Amostras) ou o produto com a venda ativada
 * (Vendas → Ofertas) foi oferecido. Só a Wellmix, com a tela Produtos.
 */
const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function recordSalesOfferAction(form: FormData) {
  const user = await requireUser();
  const back = flowReturnTo(form) ?? "/app/flow/sales/samples";
  await run(back, async () => {
    if (!isWellmix(user)) throw new ForbiddenError();
    assertScreen(user, "products");
    const kind = z.enum(["sample", "product"]).parse(str(form, "kind"));
    const orderId = str(form, "orderId")
      ? ID.parse(str(form, "orderId"))
      : null;
    const productId = str(form, "productId")
      ? ID.parse(str(form, "productId"))
      : null;
    if (kind === "sample" && !orderId) throw new Error("invalid_input");
    if (kind === "product" && !productId) throw new Error("invalid_input");
    const offeredTo = z
      .string()
      .trim()
      .min(2)
      .max(200)
      .parse(str(form, "offeredTo"));
    const note = field(form, "note", z.string().trim().max(1000)) || null;
    const store = getStore();
    if (orderId && !(await store.get("orders", orderId)))
      throw new Error("not_found");
    if (productId && !(await store.get("products", productId)))
      throw new Error("not_found");
    await store.create("sales_offers", {
      kind,
      orderId,
      productId,
      offeredTo,
      customerId: null,
      note,
      offeredByUserId: user.id,
      offeredAt: new Date().toISOString(),
    });
    return withQuery(back, "saved", "1");
  });
}
