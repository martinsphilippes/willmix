"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import {
  field,
  flowReturnTo,
  requireUser,
  run,
  str,
  withQuery,
} from "./helpers";

/*
 * Venda (docs/SALES_ORDERS.md): decisão do cliente na oferta (V3), ordem de
 * venda (V7) e agendamento da entrega (V8). Aqui só o formato; o serviço
 * confere quem pode e a situação da ordem.
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const backOf = (id: string) =>
  ID.safeParse(id).success ? `/app/sales-orders/${id}` : "/app/sales-orders";

export async function decideOfferAction(form: FormData) {
  const user = await requireUser();
  const back = flowReturnTo(form) ?? "/app/flow/sales/offers";
  await run(back, async () => {
    assertScreen(user, "products");
    const offerId = ID.parse(str(form, "offerId"));
    const decision = z
      .enum(["closed", "declined"])
      .parse(str(form, "decision"));
    const customerId = str(form, "customerId")
      ? ID.parse(str(form, "customerId"))
      : null;
    const qtyRaw = str(form, "quantity");
    const quantity = qtyRaw ? parseNumberInput(qtyRaw) : null;
    const note =
      field(form, "decisionNote", z.string().trim().max(1000)) || null;
    const { decideOffer } = await import("@/lib/services/sales-orders");
    const order = await decideOffer(user, offerId, {
      decision,
      note,
      customerId,
      quantity: quantity && quantity > 0 ? quantity : null,
    });
    return order
      ? `/app/sales-orders/${order.id}?created=1`
      : withQuery(back, "decided", decision);
  });
}

export async function openSalesOrderAction(form: FormData) {
  const user = await requireUser();
  await run("/app/sales-orders", async () => {
    assertScreen(user, "products");
    const customerId = ID.parse(str(form, "customerId"));
    const { openSalesOrder } = await import("@/lib/services/sales-orders");
    const order = await openSalesOrder(user, customerId);
    return `/app/sales-orders/${order.id}?created=1`;
  });
}

export async function updateSalesOrderAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const products = form.getAll("productId").map((v) => ID.parse(String(v)));
    const lines = products.flatMap((productId, i) => {
      if (str(form, `remove_${i}`) === "on") return [];
      const q = parseNumberInput(str(form, `quantity_${i}`));
      const p = str(form, `unitPrice_${i}`);
      return [
        {
          productId,
          quantity: q ?? 0,
          unitPrice: p ? parseNumberInput(p) : null,
        },
      ];
    });
    const newProduct = str(form, "newProductId");
    if (newProduct)
      lines.push({
        productId: ID.parse(newProduct),
        quantity: parseNumberInput(str(form, "newQuantity")) ?? 1,
        unitPrice: str(form, "newUnitPrice")
          ? parseNumberInput(str(form, "newUnitPrice"))
          : null,
      });
    const date = str(form, "deliveryDate") || null;
    const { updateSalesOrder } = await import("@/lib/services/sales-orders");
    await updateSalesOrder(user, id, {
      lines,
      paymentConditionId: str(form, "paymentConditionId")
        ? ID.parse(str(form, "paymentConditionId"))
        : null,
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .parse(str(form, "currency") || "BRL"),
      deliveryDate: date,
      deliveryWindow:
        field(form, "deliveryWindow", z.string().trim().max(60)) || null,
      note: field(form, "note", z.string().trim().max(1000)) || null,
      purchaseOrderId: await purchaseOrderIdOf(
        str(form, "purchaseOrderNumber"),
      ),
    });
    return `${backOf(id)}?saved=1`;
  });
}

/** Nº do pedido de compra (como a tela mostra) → id; vazio, sem pedido. */
async function purchaseOrderIdOf(raw: string): Promise<string | null> {
  const text = raw.replace(/^#/, "").trim();
  if (!text) return null;
  const n = z.coerce.number().int().positive().parse(text);
  const { getStore } = await import("@/lib/db");
  const [order] = await getStore().list("orders", { filter: { number: n } });
  if (!order) throw new Error("purchase_order_not_found");
  return order.id;
}

export async function confirmSalesOrderAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const { confirmSalesOrder } = await import("@/lib/services/sales-orders");
    await confirmSalesOrder(user, id);
    return `${backOf(id)}?confirmed=1`;
  });
}

export async function setSalesOrderErpNumberAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const number = z
      .string()
      .trim()
      .min(1)
      .max(40)
      .parse(str(form, "erpNumber"));
    const { setSalesOrderErpNumber } =
      await import("@/lib/services/sales-orders");
    await setSalesOrderErpNumber(user, id, number);
    return `${backOf(id)}?erp=1`;
  });
}

export async function cancelSalesOrderAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const { cancelSalesOrder } = await import("@/lib/services/sales-orders");
    await cancelSalesOrder(user, id);
    return `${backOf(id)}?cancelled=1`;
  });
}
