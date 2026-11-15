"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { parseNumberInput } from "@/lib/number-input";
import {
  field,
  files,
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

const DAY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const dayOf = (form: FormData, key: string) =>
  DAY.parse(str(form, key) || null);

/** Arquivo do formulário (NF ou comprovante), interno da Wellmix. */
async function uploadOf(form: FormData, key: string) {
  const [file] = files(form, key);
  if (!file) return null;
  const { uploadDocument } = await import("@/lib/services/documents");
  return (
    await uploadDocument(await requireUser(), file, {
      type: "attachment",
      visibility: "internal",
    })
  ).id;
}

/** O financeiro registra a NF de venda emitida no Sankhya (número e arquivo). */
export async function registerSalesInvoiceAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    ID.parse(id);
    const { canInvoice, registerSalesInvoice } =
      await import("@/lib/services/sales-orders");
    if (!canInvoice(user)) throw new Error("forbidden");
    const number = z
      .string()
      .trim()
      .min(1)
      .max(40)
      .parse(str(form, "invoiceNumber"));
    const documentId = await uploadOf(form, "invoiceFile");
    await registerSalesInvoice(user, id, { number, documentId });
    return `${backOf(id)}?invoiced=1`;
  });
}

/** Expedição: transportadora (ou o cliente retira), data e frete; baixa no estoque. */
export async function shipSalesOrderAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const pickup = str(form, "carrierId") === "pickup";
    const carrierId =
      !pickup && str(form, "carrierId")
        ? ID.parse(str(form, "carrierId"))
        : null;
    const freightRaw = str(form, "freightValue");
    const freightValue = freightRaw ? parseNumberInput(freightRaw) : null;
    const daysRaw = str(form, "freightDays");
    const freightDays = daysRaw
      ? z.coerce.number().int().min(0).max(365).parse(daysRaw)
      : 0;
    const { shipSalesOrder } = await import("@/lib/services/sales-orders");
    await shipSalesOrder(user, id, {
      carrierId,
      customerPickup: pickup,
      freightValue: freightValue ?? null,
      shippedOn: dayOf(form, "shippedOn"),
      freightDays,
    });
    return `${backOf(id)}?shipped=1`;
  });
}

/** Entrega ao cliente: data, quem recebeu e o comprovante. */
export async function deliverSalesOrderAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const receivedBy = z
      .string()
      .trim()
      .min(1)
      .max(120)
      .parse(str(form, "receivedBy"));
    const deliveredOn = dayOf(form, "deliveredOn");
    const { getStore } = await import("@/lib/db");
    const order = await getStore().get("sales_orders", id);
    if (!order || order.status !== "shipped")
      throw new Error("sales_order_not_shipped");
    const proofDocumentId = await uploadOf(form, "proofFile");
    if (!proofDocumentId) throw new Error("proof_required");
    const { deliverSalesOrder } = await import("@/lib/services/sales-orders");
    await deliverSalesOrder(user, id, {
      deliveredOn,
      receivedBy,
      proofDocumentId,
    });
    return `${backOf(id)}?delivered=1`;
  });
}

/* ---- Devolução de venda e frete no Financeiro (dono, 15/11/2026) -------- */

const NUMBER = z.string().trim().min(1).max(40);

/** Vendas registra a devolução: quantidade por produto e o motivo. */
export async function openSalesReturnAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    assertScreen(user, "products");
    ID.parse(id);
    const lines = form.getAll("productId").map((v, i) => ({
      productId: ID.parse(String(v)),
      quantity: parseNumberInput(str(form, `returnQty_${i}`)) ?? 0,
    }));
    const reason = z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .parse(str(form, "reason"));
    const { openSalesReturn } = await import("@/lib/services/sales-returns");
    await openSalesReturn(user, id, { lines, reason });
    return `${backOf(id)}?returned=1`;
  });
}

/** O financeiro registra a NF de devolução (número e arquivo). */
export async function registerReturnInvoiceAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    ID.parse(id);
    const returnId = ID.parse(str(form, "returnId"));
    const { canInvoice } = await import("@/lib/services/sales-orders");
    if (!canInvoice(user)) throw new Error("forbidden");
    const number = NUMBER.parse(str(form, "invoiceNumber"));
    const documentId = await uploadOf(form, "invoiceFile");
    const { registerReturnInvoice } =
      await import("@/lib/services/sales-returns");
    await registerReturnInvoice(user, returnId, { number, documentId });
    return `${backOf(id)}?returnInvoiced=1`;
  });
}

/** A qualidade confere: quanto está bom de cada produto; o resto é perda. */
export async function checkSalesReturnAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    ID.parse(id);
    const returnId = ID.parse(str(form, "returnId"));
    const lines = form.getAll("productId").map((v, i) => ({
      productId: ID.parse(String(v)),
      goodQty: parseNumberInput(str(form, `goodQty_${i}`)) ?? -1,
    }));
    const lossNote =
      field(form, "lossNote", z.string().trim().max(1000)) || null;
    const { checkSalesReturn } = await import("@/lib/services/sales-returns");
    await checkSalesReturn(user, returnId, { lines, lossNote });
    return `${backOf(id)}?returnChecked=1`;
  });
}

export async function cancelSalesReturnAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  await run(backOf(id), async () => {
    ID.parse(id);
    const returnId = ID.parse(str(form, "returnId"));
    const { cancelSalesReturn } = await import("@/lib/services/sales-returns");
    await cancelSalesReturn(user, returnId);
    return `${backOf(id)}?returnCancelled=1`;
  });
}

/** Contas a pagar: o financeiro baixa o frete da venda com o comprovante. */
export async function payFreightAction(form: FormData) {
  const user = await requireUser();
  const back = "/app/payables";
  await run(back, async () => {
    const id = ID.parse(str(form, "id"));
    const { canPayFreight, payFreight } =
      await import("@/lib/services/sales-orders");
    if (!canPayFreight(user)) throw new Error("forbidden");
    const proofDocumentId = await uploadOf(form, "proofFile");
    if (!proofDocumentId) throw new Error("proof_required");
    await payFreight(user, id, { proofDocumentId });
    return withQuery(back, "freightPaid", "1");
  });
}
