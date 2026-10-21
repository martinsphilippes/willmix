"use server";

import { z } from "zod";
import { getT } from "@/i18n/server";
import { num, requireUser, run, str } from "./helpers";

/*
 * Carrinho da vitrine (Explorar). O serviço confere o papel (só o cliente, no
 * próprio carrinho) e o produto (ativo no catálogo); aqui, formato e limites.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const quantitySchema = z.number().int().min(1).max(10_000_000);
const notesSchema = z.string().max(500).nullable();
const deadlineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

/** Volta só para telas da vitrine (o formulário diz de onde veio). */
function exploreBack(form: FormData, fallback: string) {
  const back = str(form, "back");
  return /^\/app\/explore(\/[A-Za-z0-9_-]{1,64}|\/cart)?(\?[A-Za-z0-9_=&%.-]{0,200})?$/.test(
    back,
  )
    ? back
    : fallback;
}

const withParam = (path: string, param: string) =>
  `${path}${path.includes("?") ? "&" : "?"}${param}`;

const optionalText = (form: FormData, key: string) => {
  const v = str(form, key);
  return v ? v : null;
};

export async function addToCartAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId").slice(0, 64);
  const back = exploreBack(form, "/app/explore");
  await run(back, async () => {
    const id = ID.parse(productId);
    const quantity = quantitySchema.parse(num(form, "quantity"));
    const notes = notesSchema.parse(optionalText(form, "notes"));
    const { addToCart } = await import("@/lib/services/cart");
    await addToCart(user, id, quantity, notes);
    // "Solicitar agora": vai direto ao carrinho para enviar.
    if (str(form, "intent") === "buy") return "/app/explore/cart";
    return withParam(back.split("#")[0], `added=${encodeURIComponent(id)}`);
  });
}

export async function updateCartItemAction(form: FormData) {
  const user = await requireUser();
  await run("/app/explore/cart", async () => {
    const itemId = ID.parse(str(form, "itemId"));
    const quantity = quantitySchema.parse(num(form, "quantity"));
    const notes = notesSchema.parse(optionalText(form, "notes"));
    const { updateCartItem } = await import("@/lib/services/cart");
    await updateCartItem(user, itemId, quantity, notes);
    return "/app/explore/cart?updated=1";
  });
}

export async function removeCartItemAction(form: FormData) {
  const user = await requireUser();
  await run("/app/explore/cart", async () => {
    const itemId = ID.parse(str(form, "itemId"));
    const { removeCartItem } = await import("@/lib/services/cart");
    await removeCartItem(user, itemId);
    return "/app/explore/cart?removed=1";
  });
}

export async function checkoutCartAction(form: FormData) {
  const user = await requireUser();
  await run("/app/explore/cart", async () => {
    const deadline = deadlineSchema.parse(optionalText(form, "deadline"));
    const notes = z
      .string()
      .max(2000)
      .nullable()
      .parse(optionalText(form, "notes"));
    const t = await getT();
    const { checkoutCart } = await import("@/lib/services/cart");
    const created = await checkoutCart(user, { deadline, notes }, t);
    const first = created[0];
    return created.length === 1
      ? `/app/requests/${encodeURIComponent(first.id)}?fromCart=1`
      : `/app/requests/batch/${encodeURIComponent(first.groupId ?? "")}?created=${created.length}&fromCart=1`;
  });
}
