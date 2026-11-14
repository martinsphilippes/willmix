import "server-only";
import { getStore, type Order, type OrderItem, type User } from "@/lib/db";
import { can } from "@/lib/auth/function-access";
import { ForbiddenError } from "@/lib/auth/permissions";
import type { Currency } from "@/lib/currencies";
import { formatAmount } from "@/lib/workflow/money";
import { audit } from "./audit";

/*
 * Venda ao cliente por pedido e por produto (dono, 14/11/2026;
 * docs/ORDER_SALE.md). O preço de venda é gravado por produto no detalhe do
 * pedido (`order_items.sellUnitPrice`, na moeda de venda do pedido) e o total
 * do pedido (`orders.sellPrice`) é a soma (preço × quantidade), recalculada a
 * cada gravação e quando a quantidade muda.
 *
 * Total só com todos os produtos com preço: enquanto falta algum, a tela
 * mostra a soma parcial e o Financeiro e as comissões não usam um total
 * incompleto. O total gravado antes no pedido inteiro (pedidos antigos, sem
 * preço por produto) fica como estava até a soma ficar completa; o total que
 * já era a soma vira vazio quando um preço é apagado, e a troca de moeda vale
 * para o pedido todo.
 *
 * Grava quem tem a ação "Gravar a venda ao cliente" (`sale.record`; padrão:
 * só o administrador). O pedido filho da programação não tem venda própria:
 * a compra é o pai (a mesma regra do histórico de compras).
 */

export class OrderSaleError extends Error {}

/** Centavos: a mesma conta do resto do portal. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Maior preço aceito por unidade (evita número digitado errado). */
export const MAX_UNIT_PRICE = 1_000_000_000;

export type SaleItem = Pick<
  OrderItem,
  "id" | "name" | "quantity" | "unit" | "sellUnitPrice"
>;

export interface SaleLine {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  subtotal: number | null;
}

export interface OrderSaleView {
  currency: string;
  lines: SaleLine[];
  /** Produtos com preço e sem preço. */
  priced: number;
  missing: number;
  /** Soma dos produtos com preço. */
  sum: number;
  /** Todos os produtos com preço: o total do pedido é a soma. */
  complete: boolean;
  /** Total gravado no pedido (`orders.sellPrice`). */
  recordedTotal: number | null;
}

const priceOf = (i: Pick<OrderItem, "sellUnitPrice">) =>
  typeof i.sellUnitPrice === "number" && Number.isFinite(i.sellUnitPrice)
    ? i.sellUnitPrice
    : null;

/** Soma dos produtos com preço e se todos têm preço. */
export function itemsSale(
  items: Pick<OrderItem, "quantity" | "sellUnitPrice">[],
) {
  let sum = 0;
  let priced = 0;
  for (const item of items) {
    const unit = priceOf(item);
    if (unit === null) continue;
    sum += unit * item.quantity;
    priced += 1;
  }
  return {
    sum: round2(sum),
    priced,
    complete: items.length > 0 && priced === items.length,
  };
}

/** O card "Venda ao cliente" do pedido: linhas, soma e o total gravado. */
export function orderSaleView(
  order: Pick<Order, "sellPrice" | "sellCurrency">,
  items: SaleItem[],
): OrderSaleView {
  const totals = itemsSale(items);
  return {
    currency: order.sellCurrency ?? "BRL",
    lines: items.map((item) => {
      const unitPrice = priceOf(item);
      return {
        itemId: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice,
        subtotal: unitPrice === null ? null : round2(unitPrice * item.quantity),
      };
    }),
    priced: totals.priced,
    missing: items.length - totals.priced,
    sum: totals.sum,
    complete: totals.complete,
    recordedTotal: order.sellPrice ?? null,
  };
}

/**
 * O total do pedido depois de uma mudança nos itens (preço, quantidade ou
 * moeda): a soma quando completa; senão, o total de antes, salvo quando ele
 * já era a soma (ficou incompleto) ou a moeda mudou.
 */
export function nextOrderTotal(input: {
  before: Pick<OrderItem, "quantity" | "sellUnitPrice">[];
  after: Pick<OrderItem, "quantity" | "sellUnitPrice">[];
  recordedTotal: number | null;
  currencyChanged: boolean;
}): number | null {
  const after = itemsSale(input.after);
  if (after.complete) return after.sum;
  const before = itemsSale(input.before);
  if (before.complete || input.currencyChanged) return null;
  return input.recordedTotal;
}

export async function recordOrderSale(
  user: User,
  orderId: string,
  input: { currency: Currency; prices: Record<string, number | null> },
): Promise<{ total: number | null; complete: boolean; changed: boolean }> {
  if (!can(user, "sale.record")) throw new ForbiddenError("sale_forbidden");
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order) throw new OrderSaleError("not_found");
  if (order.status === "CANCELLED") throw new OrderSaleError("sale_cancelled");
  if (order.parentOrderId) throw new OrderSaleError("sale_on_parent");
  const items = await store.list("order_items", { filter: { orderId } });
  if (!items.length) throw new OrderSaleError("sale_no_items");
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const [itemId, price] of Object.entries(input.prices)) {
    if (!byId.has(itemId)) throw new OrderSaleError("sale_unknown_item");
    if (
      price !== null &&
      !(Number.isFinite(price) && price >= 0 && price <= MAX_UNIT_PRICE)
    )
      throw new OrderSaleError("invalid_input");
  }
  const next = items.map((item) =>
    item.id in input.prices
      ? {
          ...item,
          sellUnitPrice:
            input.prices[item.id] === null
              ? null
              : Math.round(input.prices[item.id]! * 10_000) / 10_000,
        }
      : item,
  );
  const currencyChanged = (order.sellCurrency ?? null) !== input.currency;
  const total = nextOrderTotal({
    before: items,
    after: next,
    recordedTotal: order.sellPrice ?? null,
    currencyChanged,
  });
  const changedItems = next.filter(
    (item) => priceOf(item) !== priceOf(byId.get(item.id)!),
  );
  const changed =
    changedItems.length > 0 ||
    currencyChanged ||
    total !== (order.sellPrice ?? null);
  const complete = itemsSale(next).complete;
  if (!changed) return { total, complete, changed: false };

  for (const item of changedItems)
    await store.update("order_items", item.id, {
      sellUnitPrice: priceOf(item),
    });
  await store.update("orders", order.id, {
    sellPrice: total,
    sellCurrency: input.currency,
  });
  const snapshot = (
    list: Pick<OrderItem, "name" | "sellUnitPrice">[],
    currency: string | null,
    sellTotal: number | null,
  ) => ({
    currency,
    total: sellTotal,
    prices: Object.fromEntries(list.map((i) => [i.name, priceOf(i)])),
  });
  await audit(
    user,
    "order.sale_recorded",
    "order",
    order.id,
    `Venda ao cliente do pedido #${order.number}: ${
      total !== null
        ? formatAmount(total, input.currency, "pt-BR")
        : `${itemsSale(next).priced} de ${next.length} produtos com preço`
    }`,
    snapshot(items, order.sellCurrency ?? null, order.sellPrice ?? null),
    snapshot(next, input.currency, total),
  );
  return { total, complete, changed: true };
}
