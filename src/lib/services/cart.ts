import "server-only";

import type { Translate } from "@/i18n";
import { getStore, type Request, type User } from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/permissions";
import { audit } from "./audit";
import type { CatalogEstimate } from "./catalog-price-calc";
import { estimateForQuantities, specificationLines } from "./catalog-explore";
import { catalogShowcasePhotos } from "./documents";
import { createRequestBatch } from "./requests";

/*
 * Carrinho da vitrine: um item por produto, por login do cliente. Só o
 * cliente mexe no próprio carrinho (a Wellmix vê a vitrine, mas não compra
 * por ele aqui). Enviar o carrinho cria uma solicitação de orçamento por
 * produto, todas no mesmo lote, pelo mesmo caminho da tela de solicitação;
 * os itens enviados saem do carrinho.
 */

/** Teto de unidades por item (evita número absurdo digitado por engano). */
export const CART_MAX_QUANTITY = 10_000_000;
/** Teto de itens no carrinho (um lote grande demais vira várias solicitações). */
export const CART_MAX_ITEMS = 50;

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  category: string | null;
  photo: string | null;
  quantity: number;
  notes: string | null;
  moq: number | null;
  /** Abaixo do pedido mínimo: a Wellmix confirma se dá (não bloqueia). */
  belowMoq: boolean;
  /** Preço estimado por unidade para esta quantidade. */
  estimate: CatalogEstimate;
  /** Quantidade × preço estimado (null sem preço). */
  subtotal: number | null;
  /** Produto saiu do catálogo depois de entrar no carrinho. */
  unavailable: boolean;
}

export interface CartView {
  lines: CartLine[];
  /** Soma dos subtotais com preço. */
  estimatedTotal: number;
  /** Todos os itens têm preço estimado (o total vale para o carrinho todo). */
  complete: boolean;
}

function assertCustomer(user: User): string {
  if (user.role !== "customer" || !user.partyId) throw new ForbiddenError();
  return user.partyId;
}

function validQuantity(quantity: number): number {
  const q = Math.round(quantity);
  if (!Number.isFinite(q) || q < 1 || q > CART_MAX_QUANTITY)
    throw new Error("cart_quantity_invalid");
  return q;
}

const cleanNotes = (notes: string | null | undefined) => {
  const v = (notes ?? "").trim().slice(0, 500);
  return v || null;
};

async function ownLines(user: User) {
  return getStore().list("cart_items", {
    filter: { userId: user.id },
    orderBy: "createdAt",
  });
}

/** Itens no carrinho (para o ícone no topo). Fora do cliente, zero. */
export async function cartCount(user: User): Promise<number> {
  if (user.role !== "customer") return 0;
  return (await ownLines(user)).length;
}

export async function addToCart(
  user: User,
  productId: string,
  quantity: number,
  notes?: string | null,
): Promise<void> {
  const customerId = assertCustomer(user);
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product?.active) throw new Error("cart_product_unavailable");
  const q = validQuantity(quantity);
  const lines = await ownLines(user);
  const existing = lines.find((l) => l.productId === productId);
  if (existing) {
    // Adicionar de novo soma (como nas lojas); a observação nova substitui.
    const total = validQuantity(
      Math.min(existing.quantity + q, CART_MAX_QUANTITY),
    );
    await store.update("cart_items", existing.id, {
      quantity: total,
      ...(cleanNotes(notes) ? { notes: cleanNotes(notes) } : {}),
    });
    return;
  }
  if (lines.length >= CART_MAX_ITEMS) throw new Error("cart_full");
  await store.create("cart_items", {
    userId: user.id,
    customerId,
    productId,
    quantity: q,
    notes: cleanNotes(notes),
  });
}

async function ownLine(user: User, itemId: string) {
  assertCustomer(user);
  const line = await getStore().get("cart_items", itemId);
  // Item de outro login: como se não existisse.
  if (!line || line.userId !== user.id) throw new Error("cart_item_not_found");
  return line;
}

export async function updateCartItem(
  user: User,
  itemId: string,
  quantity: number,
  notes: string | null,
): Promise<void> {
  const line = await ownLine(user, itemId);
  await getStore().update("cart_items", line.id, {
    quantity: validQuantity(quantity),
    notes: cleanNotes(notes),
  });
}

export async function removeCartItem(
  user: User,
  itemId: string,
): Promise<void> {
  const line = await ownLine(user, itemId);
  await getStore().remove("cart_items", line.id);
}

export async function cartView(user: User): Promise<CartView> {
  if (user.role !== "customer")
    return { lines: [], estimatedTotal: 0, complete: false };
  const store = getStore();
  const items = await ownLines(user);
  if (!items.length) return { lines: [], estimatedTotal: 0, complete: true };
  const ids = [...new Set(items.map((i) => i.productId))];
  const [products, photos, estimates] = await Promise.all([
    store.list("products", { filter: { id: ids } }),
    catalogShowcasePhotos(ids),
    estimateForQuantities(
      user,
      items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    ),
  ]);
  const lines: CartLine[] = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const unavailable = !product?.active;
    const estimate: CatalogEstimate = unavailable
      ? { ok: false, missing: [] }
      : (estimates.get(item.productId) ?? { ok: false, missing: [] });
    const moq = product?.moq ?? null;
    return {
      id: item.id,
      productId: item.productId,
      name: product?.name ?? "—",
      category: product?.category ?? null,
      photo: unavailable
        ? null
        : (photos.get(item.productId)?.[0]?.documentId ?? null),
      quantity: item.quantity,
      notes: item.notes,
      moq,
      belowMoq: moq !== null && moq > 0 && item.quantity < moq,
      estimate,
      subtotal: estimate.ok
        ? Math.round(estimate.unitBrl * item.quantity * 100) / 100
        : null,
      unavailable,
    };
  });
  const estimatedTotal =
    Math.round(lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0) * 100) /
    100;
  return {
    lines,
    estimatedTotal,
    complete: lines.every((l) => l.subtotal !== null),
  };
}

/**
 * Envia o carrinho: cada produto vira uma solicitação de orçamento (lote com
 * 2 ou mais), com a quantidade e a personalização do item. Produtos que
 * saíram do catálogo ficam de fora (e continuam no carrinho, avisados).
 */
export async function checkoutCart(
  user: User,
  input: { deadline: string | null; notes: string | null },
  t: Translate,
): Promise<Request[]> {
  const customerId = assertCustomer(user);
  const store = getStore();
  const items = await ownLines(user);
  if (!items.length) throw new Error("cart_empty");
  const products = await store.list("products", {
    filter: { id: [...new Set(items.map((i) => i.productId))] },
  });
  const sendable = items.filter(
    (i) => products.find((p) => p.id === i.productId)?.active,
  );
  if (!sendable.length) throw new Error("cart_product_unavailable");
  const created = await createRequestBatch(
    user,
    {
      customerId,
      deadline: input.deadline,
      notes: cleanNotes(input.notes),
      requestedForUserId: null,
    },
    sendable.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const description = [
        `${product.name}${product.category ? ` — ${product.category}` : ""}`,
        item.notes ? `${t("explore.cart.notesLabel")}: ${item.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const spec = [
        product.category
          ? `${t("catalog.category")}: ${product.category}`
          : null,
        ...specificationLines(product, t),
      ].filter(Boolean);
      return {
        productId: product.id,
        productName: product.name.slice(0, 160),
        description,
        specification: spec.length ? spec.join("\n") : null,
        quantity: item.quantity,
        unit: "un",
        sourcingDemand: false,
      };
    }),
  );
  // Só depois de tudo criado: o que foi enviado sai do carrinho.
  for (const item of sendable) await store.remove("cart_items", item.id);
  await audit(
    user,
    "cart.checkout",
    "request",
    created[0].id,
    `Carrinho enviado: ${created.length} produto(s) para orçamento`,
    null,
    { requests: created.map((r) => r.id) },
  );
  return created;
}
