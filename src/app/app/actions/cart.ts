"use server";

import { z } from "zod";
import { getT } from "@/i18n/server";
import { brazilDay } from "@/lib/supplier-terms";
import { num, requireUser, run, runInPlace, str } from "./helpers";

/*
 * Carrinho da vitrine (Explorar). O serviço confere o papel (só o cliente, no
 * próprio carrinho, com os pedidos pela vitrine ligados) e o produto (ativo
 * no catálogo); aqui, formato e limites.
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const quantitySchema = z.number().int().min(1).max(10_000_000);
const notesSchema = z.string().max(500).nullable();

/** Volta só para telas da vitrine (o formulário diz de onde veio). */
function exploreBack(form: FormData, fallback: string) {
  const back = str(form, "back");
  return /^\/app\/explore(\/[A-Za-z0-9_-]{1,64}|\/cart)?(\?[A-Za-z0-9_=&%.+~-]{0,300})?$/.test(
    back,
  )
    ? back
    : fallback;
}

/** Tira da volta os avisos da ação anterior (added, qty, error) e junta os novos. */
function withParams(path: string, params: Record<string, string>) {
  const [base, query = ""] = path.split("?");
  const next = new URLSearchParams(query);
  for (const key of ["added", "qty", "error", "fields", "at"]) next.delete(key);
  for (const [k, v] of Object.entries(params)) next.set(k, v);
  const s = next.toString();
  return s ? `${base}?${s}` : base;
}

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
    const target = withParams(back, { added: id, qty: String(quantity) });
    // Na grade, volta para o card (e não para o topo da lista).
    return back.startsWith("/app/explore?") || back === "/app/explore"
      ? `${target}#p-${id}`
      : target;
  });
}

/**
 * "Solicitar orçamento agora": só este produto, com a quantidade e a
 * personalização da tela; o carrinho fica como está.
 */
export async function requestNowAction(form: FormData) {
  const user = await requireUser();
  const productId = str(form, "productId").slice(0, 64);
  const back = exploreBack(form, "/app/explore");
  await run(back, async () => {
    const id = ID.parse(productId);
    const quantity = quantitySchema.parse(num(form, "quantity"));
    const notes = notesSchema.parse(optionalText(form, "notes"));
    const t = await getT();
    const { requestProductNow } = await import("@/lib/services/cart");
    const created = await requestProductNow(user, id, quantity, notes, t);
    return `/app/requests/${encodeURIComponent(created.id)}?fromCart=1`;
  });
}

/*
 * Atualizar e remover itens não mudam de tela: o que o cliente já digitou no
 * resumo (data e observações) continua lá, e os valores recalculam no lugar.
 */
export async function updateCartItemAction(form: FormData) {
  const user = await requireUser();
  await runInPlace("/app/explore/cart", async () => {
    const itemId = ID.parse(str(form, "itemId"));
    const quantity = quantitySchema.parse(num(form, "quantity"));
    const notes = notesSchema.parse(optionalText(form, "notes"));
    const { updateCartItem } = await import("@/lib/services/cart");
    await updateCartItem(user, itemId, quantity, notes);
  });
}

export async function removeCartItemAction(form: FormData) {
  const user = await requireUser();
  await runInPlace("/app/explore/cart", async () => {
    const itemId = ID.parse(str(form, "itemId"));
    const { removeCartItem } = await import("@/lib/services/cart");
    await removeCartItem(user, itemId);
  });
}

/** Data do "quando você precisa": dia válido, de hoje em diante. */
function needByDate(form: FormData): string | null {
  const v = optionalText(form, "deadline");
  if (!v) return null;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  if (!valid || v < (brazilDay(new Date()) ?? ""))
    throw new Error("cart_deadline_invalid");
  return v;
}

export async function checkoutCartAction(form: FormData) {
  const user = await requireUser();
  await run("/app/explore/cart", async () => {
    let deadline: string | null;
    try {
      deadline = needByDate(form);
    } catch {
      throw new Error("cart_deadline_invalid");
    }
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
