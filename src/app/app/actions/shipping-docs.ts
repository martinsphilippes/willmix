"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import type { ShippingDocLine } from "@/lib/db/schema";
import { files, requireUser, run, str } from "./helpers";

/*
 * Documentos do embarque do pedido de compra (docs/SHIPPING_DOCS.md): check
 * list de carga, packing list, invoice e BL. Aqui só o formato; o serviço
 * confere quem faz, a ordem e a conferência linha a linha.
 */

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const backOf = (orderId: string) =>
  ID.test(orderId) ? `/app/orders/${orderId}/shipping-docs` : "/app";

const count = z.coerce.number().int().min(0).max(1_000_000);
const kg = z.coerce.number().min(0).max(1e9);

/** Número digitado (vírgula ou ponto); vazio = nulo. */
function numberOf(form: FormData, key: string, schema: z.ZodType<number>) {
  const raw = str(form, key).replace(",", ".");
  return raw === "" ? null : schema.parse(raw);
}

/** Itens do formulário: os campos vêm como <campo>_<itemId>. */
function itemIds(form: FormData) {
  return z
    .array(z.string().regex(ID))
    .max(500)
    .parse(form.getAll("itemId").map(String));
}

function linesOf(form: FormData): ShippingDocLine[] {
  return itemIds(form).map((id) => ({
    itemId: id,
    name: "",
    cartons: numberOf(form, `cartons_${id}`, count) ?? 0,
    pieces: numberOf(form, `pieces_${id}`, count) ?? 0,
    netKg: numberOf(form, `netKg_${id}`, kg),
    grossKg: numberOf(form, `grossKg_${id}`, kg),
    ...(form.has(`unitPrice_${id}`)
      ? { unitPrice: numberOf(form, `unitPrice_${id}`, kg) }
      : {}),
  }));
}

async function fileOf(form: FormData, orderId: string, bl: boolean) {
  const [file] = files(form, "file");
  if (!file) return null;
  const { uploadDocument } = await import("@/lib/services/documents");
  return (
    await uploadDocument(await requireUser(), file, {
      orderId,
      type: bl ? "bl" : "attachment",
      visibility: "supplier",
    })
  ).id;
}

/** Só sobe o arquivo de quem pode fazer o documento agora. */
async function assertCan(
  orderId: string,
  kind: "packing_list" | "invoice" | "bl",
) {
  const user = await requireUser();
  const { shippingDocsView } = await import("@/lib/services/shipping-docs");
  const view = await shippingDocsView(user, orderId);
  if (!view) throw new Error("forbidden");
  if (!view.can[kind]) throw new Error("shipping_doc_closed");
}

export async function addLoadAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    z.string().regex(ID).parse(orderId);
    const rows = itemIds(form).map((id) => ({
      itemId: id,
      cartons: numberOf(form, `add_${id}`, count) ?? 0,
    }));
    const { addLoad } = await import("@/lib/services/shipping-docs");
    await addLoad(user, orderId, rows);
    return `${backOf(orderId)}?done=load#load`;
  });
}

export async function submitPackingListAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    z.string().regex(ID).parse(orderId);
    await assertCan(orderId, "packing_list");
    const lines = linesOf(form);
    const documentId = await fileOf(form, orderId, false);
    const { submitPackingList } = await import("@/lib/services/shipping-docs");
    await submitPackingList(user, orderId, { lines, documentId });
    return `${backOf(orderId)}?done=packing_list#packing_list`;
  });
}

export async function submitInvoiceAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    z.string().regex(ID).parse(orderId);
    const number = z.string().max(80).parse(str(form, "number"));
    const currency = str(form, "currency")
      ? z
          .string()
          .regex(/^[A-Z]{3}$/)
          .parse(str(form, "currency"))
      : null;
    await assertCan(orderId, "invoice");
    const lines = linesOf(form);
    const documentId = await fileOf(form, orderId, false);
    const { submitInvoice } = await import("@/lib/services/shipping-docs");
    await submitInvoice(user, orderId, { number, lines, documentId, currency });
    return `${backOf(orderId)}?done=invoice#invoice`;
  });
}

export async function submitBlAction(form: FormData) {
  const user = await requireUser();
  const orderId = str(form, "orderId");
  await run(backOf(orderId), async () => {
    assertScreen(user, "orders");
    z.string().regex(ID).parse(orderId);
    const number = z.string().max(80).parse(str(form, "number"));
    const containerNumber = z
      .string()
      .max(20)
      .parse(str(form, "containerNumber"));
    await assertCan(orderId, "bl");
    const lines = linesOf(form);
    const documentId = await fileOf(form, orderId, true);
    const { submitBl } = await import("@/lib/services/shipping-docs");
    await submitBl(user, orderId, {
      number,
      containerNumber,
      lines,
      documentId,
    });
    return `${backOf(orderId)}?done=bl#bl`;
  });
}
