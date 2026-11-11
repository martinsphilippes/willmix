import "server-only";

import {
  getStore,
  type Product,
  type StockCountItem,
  type Tables,
  type User,
} from "@/lib/db";
import type { ListOptions } from "@/lib/db/store";
import { ForbiddenError, assertWellmix, isAdmin } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { audit } from "./audit";
import { notify } from "./notifications";
import { loadInventory } from "./inventory";
import { isSchemaMissing } from "@/lib/db/errors";
import { STOCK_PARTY_ID } from "./stock-party";
import {
  RESERVATION_MAX_DAYS,
  freeStock,
  isReservationLive,
} from "./reservation-rules";
import { addDays, brazilDay } from "@/lib/supplier-terms";

/*
 * Estoque no Brasil: baixa por venda e inventário às cegas (docs/INVENTORY.md).
 *
 * Inventário: o admin abre; o sistema guarda, para cada produto com estoque no
 * Brasil, a quantidade esperada (quem conta nunca vê). Quem conta grava a
 * quantidade; se não bate, tem mais uma chance. Errou as duas, o item vai para
 * o admin aprovar a quantidade final; a diferença vira perda (ou sobra) no
 * registro de movimentações, ligado ao inventário. Toda tentativa fica gravada
 * no item e na auditoria.
 */

export class StockError extends Error {}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export type CountOutcome = "ok" | "retry" | "review";

/** Resultado de uma tentativa (função pura): bate, tenta de novo ou vai ao admin. */
export function countOutcome(
  expected: number,
  qty: number,
  attempt: 1 | 2,
): CountOutcome {
  if (same(expected, qty)) return "ok";
  return attempt === 1 ? "retry" : "review";
}

function assertStockUser(user: User) {
  assertWellmix(user);
  assertScreen(user, "products");
}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

/** Quanto do produto está no Brasil agora e quanto disso está reservado. */
export async function stockInBrazil(productId: string) {
  const row = (await loadInventory()).find((r) => r.productId === productId);
  return {
    quantity: row?.brazil ?? 0,
    reserved: row?.reserved ?? 0,
    unit: row?.unit ?? "un",
  };
}

/** Baixa por venda: tira do estoque no Brasil, nunca mais do que há. */
export async function recordSaleOut(
  user: User,
  input: {
    productId: string;
    quantity: number;
    orderId: string | null;
    note: string | null;
  },
) {
  assertStockUser(user);
  if (!(input.quantity > 0)) throw new StockError("quantity_required");
  const store = getStore();
  const product = await store.get("products", input.productId);
  if (!product) throw new StockError("product_not_found");
  if (input.orderId) {
    const order = await store.get("orders", input.orderId);
    if (!order || order.status === "CANCELLED")
      throw new StockError("order_not_found");
  }
  const {
    quantity: available,
    reserved,
    unit,
  } = await stockInBrazil(product.id);
  if (input.quantity > available + 1e-6)
    throw new StockError("stock_insufficient");
  // O reservado para clientes só sai pela reserva ("Usar" na tela Reservas).
  if (input.quantity > freeStock(available, reserved) + 1e-6)
    throw new StockError("stock_reserved");
  await warnIfBelowLimit(product, available, available - input.quantity);
  const movement = await store.create("stock_movements", {
    productId: product.id,
    kind: "sale_out",
    quantity: -input.quantity,
    unit,
    orderId: input.orderId,
    countId: null,
    countItemId: null,
    note: input.note,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "stock.sale_out",
    "product",
    product.id,
    `Baixa por venda: ${input.quantity} ${unit} de ${product.name}`,
  );
  return movement;
}

/** Inventário aberto (só um por vez). */
export async function openStockCount() {
  const [open] = await getStore().list("stock_counts", {
    filter: { status: "open" },
  });
  return open ?? null;
}

/** Abre um inventário com o que o sistema tem no Brasil (só o admin). */
export async function startStockCount(user: User, note: string | null) {
  assertAdmin(user);
  if (await openStockCount()) throw new StockError("count_already_open");
  const store = getStore();
  const rows = (await loadInventory()).filter((r) => r.brazil > 0);
  if (!rows.length) throw new StockError("count_nothing");
  const all = await store.list("stock_counts");
  const count = await store.create("stock_counts", {
    number: all.reduce((m, c) => Math.max(m, c.number), 0) + 1,
    status: "open",
    note,
    startedByUserId: user.id,
    closedByUserId: null,
    closedAt: null,
  });
  for (const r of rows)
    await store.create("stock_count_items", {
      countId: count.id,
      productId: r.productId,
      expected: r.brazil,
      unit: r.unit,
      status: "pending",
      attempt1Qty: null,
      attempt1ByUserId: null,
      attempt1At: null,
      attempt2Qty: null,
      attempt2ByUserId: null,
      attempt2At: null,
      finalQty: null,
      difference: null,
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
    });
  await audit(
    user,
    "stock.count_started",
    "stock_count",
    count.id,
    `Inventário #${count.number} aberto com ${rows.length} produto(s)`,
  );
  return count;
}

/** Grava uma contagem; devolve se bateu, se tem mais uma chance ou se foi ao admin. */
export async function submitStockCount(
  user: User,
  itemId: string,
  qty: number,
): Promise<{ outcome: CountOutcome; item: StockCountItem }> {
  assertStockUser(user);
  if (!(qty >= 0) || !Number.isFinite(qty))
    throw new StockError("quantity_required");
  const store = getStore();
  const item = await store.get("stock_count_items", itemId);
  if (!item) throw new StockError("count_item_not_found");
  const count = await store.get("stock_counts", item.countId);
  if (!count || count.status !== "open") throw new StockError("count_closed");
  if (item.status !== "pending" && item.status !== "retry")
    throw new StockError("count_item_done");
  const attempt = item.status === "pending" ? 1 : 2;
  const outcome = countOutcome(item.expected, qty, attempt);
  const now = new Date().toISOString();
  const patch: Partial<StockCountItem> =
    attempt === 1
      ? { attempt1Qty: qty, attempt1ByUserId: user.id, attempt1At: now }
      : { attempt2Qty: qty, attempt2ByUserId: user.id, attempt2At: now };
  if (outcome === "ok") {
    patch.status = "ok";
    patch.finalQty = qty;
    patch.difference = 0;
  } else patch.status = outcome;
  const updated = await store.update("stock_count_items", item.id, patch);
  const product = await store.get("products", item.productId);
  await audit(
    user,
    "stock.count_attempt",
    "stock_count",
    count.id,
    `Inventário #${count.number}, ${product?.name ?? item.productId}: ${attempt}ª contagem ${qty} (${outcome === "ok" ? "confere" : "não confere"})`,
  );
  if (outcome === "review")
    await notify(
      { role: "admin" },
      {
        kind: "action",
        link: `/app/inventory/counts/${count.id}#item-${item.id}`,
        text: (t) => ({
          subject: t("stockCount.notify.subject", {
            n: count.number,
            product: product?.name ?? "",
          }),
          body: t("stockCount.notify.body", {
            product: product?.name ?? "",
          }),
        }),
      },
    );
  return { outcome, item: updated };
}

/** O admin aprova a quantidade final; a diferença vira perda ou sobra. */
export async function approveStockCountItem(
  user: User,
  itemId: string,
  finalQty: number,
  note: string | null,
) {
  assertAdmin(user);
  if (!(finalQty >= 0) || !Number.isFinite(finalQty))
    throw new StockError("quantity_required");
  const store = getStore();
  const item = await store.get("stock_count_items", itemId);
  if (!item) throw new StockError("count_item_not_found");
  if (item.status !== "review") throw new StockError("count_item_done");
  const count = await store.get("stock_counts", item.countId);
  if (!count || count.status !== "open") throw new StockError("count_closed");
  const difference = Math.round((finalQty - item.expected) * 1e6) / 1e6;
  const updated = await store.update("stock_count_items", item.id, {
    status: "approved",
    finalQty,
    difference,
    approvedByUserId: user.id,
    approvedAt: new Date().toISOString(),
    approvalNote: note,
  });
  if (difference !== 0) {
    const product = await store.get("products", item.productId);
    if (product) {
      const { quantity: before } = await stockInBrazil(product.id);
      await warnIfBelowLimit(product, before, before + difference);
    }
  }
  if (difference !== 0)
    await store.create("stock_movements", {
      productId: item.productId,
      kind: difference < 0 ? "count_loss" : "count_gain",
      quantity: difference,
      unit: item.unit,
      orderId: null,
      countId: count.id,
      countItemId: item.id,
      note,
      createdByUserId: user.id,
    });
  const product = await store.get("products", item.productId);
  await audit(
    user,
    "stock.count_approved",
    "stock_count",
    count.id,
    `Inventário #${count.number}, ${product?.name ?? item.productId}: aprovado ${finalQty} (esperado ${item.expected}, diferença ${difference})`,
  );
  return updated;
}

/** Fecha o inventário quando todos os itens foram resolvidos (só o admin). */
export async function closeStockCount(user: User, countId: string) {
  assertAdmin(user);
  const store = getStore();
  const count = await store.get("stock_counts", countId);
  if (!count || count.status !== "open") throw new StockError("count_closed");
  const items = await store.list("stock_count_items", {
    filter: { countId },
  });
  if (items.some((i) => i.status !== "ok" && i.status !== "approved"))
    throw new StockError("count_unfinished");
  await store.update("stock_counts", countId, {
    status: "closed",
    closedByUserId: user.id,
    closedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "stock.count_closed",
    "stock_count",
    countId,
    `Inventário #${count.number} fechado`,
  );
}

/** Lista que devolve vazio enquanto a tabela nova não foi publicada no Appwrite. */
export async function safeList<T extends "stock_counts" | "stock_count_items">(
  table: T,
  options?: ListOptions<Tables[T]>,
): Promise<Tables[T][]> {
  try {
    return await getStore().list(table, options);
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/**
 * Avisa o admin quando o estoque no Brasil cruza o limite para baixo (estava
 * no limite ou acima e fica abaixo). Sem limite, nada.
 */
async function warnIfBelowLimit(
  product: Pick<Product, "id" | "name" | "minStock">,
  before: number,
  after: number,
) {
  const min = product.minStock ?? 0;
  if (!(min > 0) || !(before >= min) || !(after < min)) return;
  await notify(
    { role: "admin" },
    {
      kind: "alert",
      link: "/app/inventory?situ=below",
      text: (t) => ({
        subject: t("inv.limit.notify.subject", { product: product.name }),
        body: t("inv.limit.notify.body", {
          product: product.name,
          qty: Math.max(0, after),
          min,
        }),
      }),
    },
  );
}

/** Define o limite (estoque mínimo) do produto; vazio tira o limite. */
export async function setMinStock(
  user: User,
  productId: string,
  minStock: number | null,
) {
  assertStockUser(user);
  if (minStock !== null && !(minStock >= 0))
    throw new StockError("quantity_required");
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product) throw new StockError("product_not_found");
  await store.update("products", productId, {
    minStock: minStock && minStock > 0 ? minStock : null,
  });
  await audit(
    user,
    "stock.min_stock",
    "product",
    productId,
    `Limite de estoque de ${product.name}: ${minStock ?? "sem limite"}`,
  );
}

/* ------------------------------------------------------------------------ */
/* Reserva de estoque para cliente                                            */
/* ------------------------------------------------------------------------ */

const todayBr = () => brazilDay(new Date().toISOString()) as string;

/**
 * Reserva parte do estoque livre no Brasil para um cliente, por `days` dias.
 * A quantidade some do livre (vitrine e baixa para outros) até ser usada,
 * cancelada ou vencer.
 */
export async function createReservation(
  user: User,
  input: {
    productId: string;
    customerId: string;
    quantity: number;
    days: number;
    note: string | null;
  },
) {
  assertStockUser(user);
  if (!(input.quantity > 0)) throw new StockError("quantity_required");
  if (!(input.days >= 1 && input.days <= RESERVATION_MAX_DAYS))
    throw new StockError("reservation_days");
  const store = getStore();
  const product = await store.get("products", input.productId);
  if (!product) throw new StockError("product_not_found");
  const customer = await store.get("parties", input.customerId);
  if (
    !customer ||
    customer.type !== "customer" ||
    customer.id === STOCK_PARTY_ID
  )
    throw new StockError("customer_not_found");
  const { quantity, reserved, unit } = await stockInBrazil(product.id);
  if (input.quantity > freeStock(quantity, reserved) + 1e-6)
    throw new StockError("stock_insufficient");
  const expires = addDays(todayBr(), input.days);
  const reservation = await store.create("stock_reservations", {
    productId: product.id,
    customerId: customer.id,
    quantity: input.quantity,
    unit,
    status: "active",
    // Meio-dia no Brasil: o dia (AAAA-MM-DD) é o mesmo em UTC; vale até o fim dele.
    expiresAt: `${expires}T15:00:00.000Z`,
    note: input.note,
    createdByUserId: user.id,
    movementId: null,
    closedByUserId: null,
    closedAt: null,
  });
  await audit(
    user,
    "stock.reserve",
    "product",
    product.id,
    `Reserva: ${input.quantity} ${unit} de ${product.name} para ${customer.name} até ${expires}`,
  );
  return reservation;
}

async function liveReservation(user: User, id: string) {
  assertStockUser(user);
  const r = await getStore().get("stock_reservations", id);
  if (!r) throw new StockError("reservation_not_found");
  if (!isReservationLive(r, todayBr()))
    throw new StockError("reservation_closed");
  return r;
}

/** Cancela a reserva: a quantidade volta a ficar livre. */
export async function cancelReservation(user: User, id: string) {
  const r = await liveReservation(user, id);
  const store = getStore();
  await store.update("stock_reservations", r.id, {
    status: "cancelled",
    closedByUserId: user.id,
    closedAt: new Date().toISOString(),
  });
  const product = await store.get("products", r.productId);
  await audit(
    user,
    "stock.reserve_cancel",
    "product",
    r.productId,
    `Reserva cancelada: ${r.quantity} ${r.unit ?? ""} de ${product?.name ?? ""}`,
  );
}

/** Usa a reserva: vira baixa por venda da quantidade reservada. */
export async function consumeReservation(
  user: User,
  id: string,
  orderId: string | null,
) {
  const r = await liveReservation(user, id);
  const store = getStore();
  const product = await store.get("products", r.productId);
  if (!product) throw new StockError("product_not_found");
  if (orderId) {
    const order = await store.get("orders", orderId);
    if (!order || order.status === "CANCELLED")
      throw new StockError("order_not_found");
  }
  const { quantity: available, unit } = await stockInBrazil(product.id);
  if (r.quantity > available + 1e-6) throw new StockError("stock_insufficient");
  await warnIfBelowLimit(product, available, available - r.quantity);
  const customer = await store.get("parties", r.customerId);
  const movement = await store.create("stock_movements", {
    productId: product.id,
    kind: "sale_out",
    quantity: -r.quantity,
    unit: r.unit ?? unit,
    orderId,
    countId: null,
    countItemId: null,
    note: [customer?.name, r.note].filter(Boolean).join(" · ") || null,
    createdByUserId: user.id,
  });
  await store.update("stock_reservations", r.id, {
    status: "used",
    movementId: movement.id,
    closedByUserId: user.id,
    closedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "stock.reserve_use",
    "product",
    product.id,
    `Reserva usada (baixa por venda): ${r.quantity} ${r.unit ?? unit} de ${product.name} para ${customer?.name ?? ""}`,
  );
  return movement;
}
