"use server";

import { z } from "zod";
import {
  approveStockCountItem,
  cancelReservation,
  closeStockCount,
  createReservation,
  consumeReservation,
  recordSaleOut,
  setMinStock,
  startStockCount,
  submitStockCount,
} from "@/lib/services/stock";
import { requireUser, run, str } from "./helpers";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const QTY = z.coerce.number().finite().min(0).max(1e9);
const NOTE = z
  .string()
  .max(500)
  .transform((v) => v.trim() || null);

/** Baixa por venda no estoque no Brasil (Wellmix com a tela Produtos). */
export async function stockOutAction(form: FormData) {
  const user = await requireUser();
  await run("/app/inventory", async () => {
    const input = z
      .object({
        productId: ID,
        quantity: QTY.refine((n) => n > 0),
        orderId: z.union([ID, z.literal("")]),
        note: NOTE,
      })
      .parse({
        productId: str(form, "productId"),
        quantity: str(form, "quantity").replace(",", "."),
        orderId: str(form, "orderId"),
        note: str(form, "note"),
      });
    await recordSaleOut(user, { ...input, orderId: input.orderId || null });
    return "/app/inventory?stockOut=done";
  });
}

/** Abre um inventário (só o admin). */
export async function startStockCountAction(form: FormData) {
  const user = await requireUser();
  await run("/app/inventory/counts", async () => {
    const note = NOTE.parse(str(form, "note"));
    const count = await startStockCount(user, note);
    return `/app/inventory/counts/${count.id}?started=1`;
  });
}

/** Grava uma contagem às cegas e diz se conferiu, se tem mais uma chance ou se foi ao admin. */
export async function submitStockCountAction(form: FormData) {
  const user = await requireUser();
  const countId = ID.safeParse(str(form, "countId"));
  const back = countId.success
    ? `/app/inventory/counts/${countId.data}`
    : "/app/inventory/counts";
  await run(back, async () => {
    const { itemId, qty } = z.object({ itemId: ID, qty: QTY }).parse({
      itemId: str(form, "itemId"),
      qty: str(form, "qty").replace(",", "."),
    });
    const { outcome } = await submitStockCount(user, itemId, qty);
    return `${back}?result=${outcome}&item=${itemId}#item-${itemId}`;
  });
}

/** O admin aprova a quantidade final de um item que errou as duas contagens. */
export async function approveStockCountItemAction(form: FormData) {
  const user = await requireUser();
  const countId = ID.safeParse(str(form, "countId"));
  const back = countId.success
    ? `/app/inventory/counts/${countId.data}`
    : "/app/inventory/counts";
  await run(back, async () => {
    const { itemId, finalQty, note } = z
      .object({ itemId: ID, finalQty: QTY, note: NOTE })
      .parse({
        itemId: str(form, "itemId"),
        finalQty: str(form, "finalQty").replace(",", "."),
        note: str(form, "note"),
      });
    await approveStockCountItem(user, itemId, finalQty, note);
    return `${back}?approved=1#item-${itemId}`;
  });
}

/** Fecha o inventário (só o admin, com tudo resolvido). */
export async function closeStockCountAction(form: FormData) {
  const user = await requireUser();
  const countId = ID.parse(str(form, "countId"));
  const back = `/app/inventory/counts/${countId}`;
  await run(back, async () => {
    await closeStockCount(user, countId);
    return `${back}?closed=1`;
  });
}

/** Limite (estoque mínimo) de um produto, na linha da tela Estoque. */
export async function setMinStockAction(form: FormData) {
  const user = await requireUser();
  const raw = str(form, "back");
  const back = /^\/app\/inventory(\?[A-Za-z0-9_=&%.+-]{0,200})?$/.test(raw)
    ? raw
    : "/app/inventory";
  await run(back, async () => {
    const productId = ID.parse(str(form, "productId"));
    const value = str(form, "minStock").replace(",", ".");
    const minStock = value === "" ? null : QTY.parse(value);
    await setMinStock(user, productId, minStock);
    const url = new URL(back, "http://x");
    url.searchParams.set("limit", "saved");
    return url.pathname + url.search;
  });
}

const RES_BACK = "/app/inventory/reservations";

/** Reserva estoque livre no Brasil para um cliente. */
export async function createReservationAction(form: FormData) {
  const user = await requireUser();
  await run(RES_BACK, async () => {
    const input = z
      .object({
        productId: ID,
        customerId: ID,
        quantity: QTY.refine((n) => n > 0),
        days: z.coerce.number().int().min(1).max(120),
        note: NOTE,
      })
      .parse({
        productId: str(form, "productId"),
        customerId: str(form, "customerId"),
        quantity: str(form, "quantity").replace(",", "."),
        days: str(form, "days"),
        note: str(form, "note"),
      });
    await createReservation(user, input);
    return `${RES_BACK}?done=created`;
  });
}

/** Usa a reserva (vira baixa por venda). */
export async function consumeReservationAction(form: FormData) {
  const user = await requireUser();
  await run(RES_BACK, async () => {
    const { id, orderId } = z
      .object({ id: ID, orderId: z.union([ID, z.literal("")]) })
      .parse({ id: str(form, "id"), orderId: str(form, "orderId") });
    await consumeReservation(user, id, orderId || null);
    return `${RES_BACK}?done=used`;
  });
}

/** Cancela a reserva (a quantidade volta a ficar livre). */
export async function cancelReservationAction(form: FormData) {
  const user = await requireUser();
  await run(RES_BACK, async () => {
    const id = ID.parse(str(form, "id"));
    await cancelReservation(user, id);
    return `${RES_BACK}?done=cancelled`;
  });
}
