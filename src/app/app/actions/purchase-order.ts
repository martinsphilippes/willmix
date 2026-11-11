"use server";

import { z } from "zod";
import { parseNumberInput } from "@/lib/number-input";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Pedido de compra (docs/PURCHASE_ORDER.md): a Wellmix junta num pedido os
 * produtos aprovados de um fornecedor. O serviço confere papel, tela,
 * solicitações e moeda de novo.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const BACK = "/app/supplier-requests#pedido-de-compra";

export async function createPurchaseOrderAction(form: FormData) {
  const user = await requireUser();
  await run(BACK, async () => {
    const ids = z
      .array(ID)
      .max(60)
      .parse(
        form
          .getAll("requestIds")
          .filter((v): v is string => typeof v === "string"),
      );
    if (!ids.length) throw new Error("purchase_order_choose_items");
    const lines = ids.map((requestId) => {
      const raw = str(form, `qty_${requestId}`);
      const n = raw ? parseNumberInput(raw, { int: true }) : null;
      if (raw && (n === null || !Number.isFinite(n) || n <= 0 || n > 1e9))
        throw new Error("purchase_order_qty_invalid");
      return { requestId, quantity: n };
    });
    const { createPurchaseOrder } =
      await import("@/lib/services/purchase-order");
    const order = await createPurchaseOrder(user, lines);
    return withQuery(`/app/orders/${order.id}`, "purchase", "created");
  });
}
