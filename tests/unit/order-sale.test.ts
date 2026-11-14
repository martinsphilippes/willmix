import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Venda ao cliente por pedido e por produto (dono, 14/11/2026;
 * docs/ORDER_SALE.md): preço por produto no item, total do pedido = soma
 * (só com todos os produtos com preço), a ação "Gravar a venda ao cliente"
 * (padrão: só o administrador), auditoria, quantidade nova pela ficha e o
 * preço por produto no histórico de compras e no Histórico comercial.
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const sale = await import("@/lib/services/order-sale");
const ph = await import("@/lib/services/purchase-history");
const ps = await import("@/lib/services/purchase-sheet");
const r = await import("@/lib/services/requests");
const fa = await import("@/lib/auth/function-access");
const { orderFromRequest } = await import("./helpers/order");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const CUSTOMER = "cliente-joao";
let admin: User;
let operator: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = (
    await getStore().list("users", {
      filter: { email: "operador@wellmix.com" },
    })
  )[0];
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

/** Pedido do cliente com um ou dois produtos e, se quiser, o total antigo. */
async function order(
  sellPrice: number | null = null,
  quantities: number[] = [100, 40],
): Promise<{ order: Order; itemIds: string[] }> {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: CUSTOMER,
    productName: "Jarra de vidro",
    description: "Jarra 1,5 L",
    quantity: quantities[0],
    unit: "un",
  });
  const created = await orderFromRequest(admin, request, {
    price: 2,
    sellPrice,
    sellCurrency: sellPrice === null ? null : "BRL",
  });
  for (const q of quantities.slice(1))
    await store.create("order_items", {
      orderId: created.id,
      productId: null,
      name: "Tampa de bambu",
      quantity: q,
      unit: "un",
      unitPrice: 1,
    } as never);
  const items = await store.list("order_items", {
    filter: { orderId: created.id },
  });
  return {
    order: created,
    itemIds: items.map((i) => i.id),
  };
}
const fresh = async (id: string) => (await getStore().get("orders", id))!;

describe("quem grava", () => {
  it("só o administrador por padrão; a ação é configurável", () => {
    expect(fa.can(admin, "sale.record")).toBe(true);
    expect(fa.can(operator, "sale.record")).toBe(false);
    for (const fn of [
      "finance",
      "buyer",
      "planner",
      "product_manager",
    ] as const)
      expect(fa.defaultActionsFor(fn)).not.toContain("sale.record");
    expect(fa.ACTION_KEYS).toContain("sale.record");
  });

  it("operador sem a ação: recusa e nada muda", async () => {
    const { order: o, itemIds } = await order();
    await expect(
      sale.recordOrderSale(operator, o.id, {
        currency: "BRL",
        prices: { [itemIds[0]]: 5 },
      }),
    ).rejects.toThrow("sale_forbidden");
    const [first] = await getStore().list("order_items", {
      filter: { orderId: o.id },
    });
    expect(first.sellUnitPrice ?? null).toBeNull();
  });
});

describe("total do pedido = soma dos produtos", () => {
  it("todos os produtos com preço: total, moeda e auditoria", async () => {
    const { order: o, itemIds } = await order();
    const result = await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[0]]: 5, [itemIds[1]]: 2.5 },
    });
    expect(result).toEqual({ total: 600, complete: true, changed: true });
    const saved = await fresh(o.id);
    expect(saved.sellPrice).toBe(600); // 5 × 100 + 2,5 × 40
    expect(saved.sellCurrency).toBe("BRL");
    const items = await getStore().list("order_items", {
      filter: { orderId: o.id },
    });
    expect(items.map((i) => i.sellUnitPrice).sort()).toEqual([2.5, 5]);
    const [log] = await getStore().list("audit_log", {
      filter: { entityId: o.id, action: "order.sale_recorded" },
    });
    expect(log.after).toMatchObject({ currency: "BRL", total: 600 });
    expect(log.summary).toContain("600");
    // Gravar de novo o mesmo: nada muda, sem outra linha na auditoria.
    const again = await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[0]]: 5, [itemIds[1]]: 2.5 },
    });
    expect(again.changed).toBe(false);
    expect(
      await getStore().list("audit_log", {
        filter: { entityId: o.id, action: "order.sale_recorded" },
      }),
    ).toHaveLength(1);
  });

  it("parcial: o total antigo (sem preço por produto) fica até completar", async () => {
    const { order: o, itemIds } = await order(1000);
    await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[0]]: 5 },
    });
    expect((await fresh(o.id)).sellPrice).toBe(1000);
    const items = await getStore().list("order_items", {
      filter: { orderId: o.id },
    });
    const view = sale.orderSaleView(await fresh(o.id), items);
    expect(view).toMatchObject({
      priced: 1,
      missing: 1,
      sum: 500,
      complete: false,
      recordedTotal: 1000,
    });
    // Completou: o total passa a ser a soma.
    await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[1]]: 10 },
    });
    expect((await fresh(o.id)).sellPrice).toBe(900);
  });

  it("apagar um preço de um total que era a soma: o total fica vazio", async () => {
    const { order: o, itemIds } = await order();
    await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[0]]: 5, [itemIds[1]]: 2.5 },
    });
    await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[1]]: null },
    });
    expect((await fresh(o.id)).sellPrice).toBeNull();
  });

  it("trocar a moeda vale para o pedido todo", async () => {
    const { order: o, itemIds } = await order(1000);
    await sale.recordOrderSale(admin, o.id, {
      currency: "USD",
      prices: { [itemIds[0]]: 1 },
    });
    const saved = await fresh(o.id);
    expect(saved.sellCurrency).toBe("USD");
    // O total antigo era em reais: parcial em dólar não o aproveita.
    expect(saved.sellPrice).toBeNull();
  });

  it("pedido cancelado, rodada da programação e item de outro pedido: recusa", async () => {
    const store = getStore();
    const { order: cancelled, itemIds: c } = await order();
    await store.update("orders", cancelled.id, { status: "CANCELLED" });
    await expect(
      sale.recordOrderSale(admin, cancelled.id, {
        currency: "BRL",
        prices: { [c[0]]: 1 },
      }),
    ).rejects.toThrow("sale_cancelled");

    const { order: parent } = await order();
    const { order: child, itemIds: k } = await order();
    await store.update("orders", child.id, {
      parentOrderId: parent.id,
      roundIndex: 1,
    } as never);
    await expect(
      sale.recordOrderSale(admin, child.id, {
        currency: "BRL",
        prices: { [k[0]]: 1 },
      }),
    ).rejects.toThrow("sale_on_parent");

    const { order: other, itemIds: mine } = await order();
    await expect(
      sale.recordOrderSale(admin, other.id, {
        currency: "BRL",
        prices: { [c[0]]: 1, [mine[0]]: 1 },
      }),
    ).rejects.toThrow("sale_unknown_item");
    await expect(
      sale.recordOrderSale(admin, other.id, {
        currency: "BRL",
        prices: { [mine[0]]: -1 },
      }),
    ).rejects.toThrow("invalid_input");
  });

  it("regra pura: soma, completo e o total depois da mudança", () => {
    const items = [
      { quantity: 3, sellUnitPrice: 1.1 },
      { quantity: 2, sellUnitPrice: null },
    ];
    expect(sale.itemsSale(items)).toEqual({
      sum: 3.3,
      priced: 1,
      complete: false,
    });
    expect(
      sale.nextOrderTotal({
        before: items,
        after: [items[0], { quantity: 2, sellUnitPrice: 2 }],
        recordedTotal: 50,
        currencyChanged: false,
      }),
    ).toBe(7.3);
    expect(
      sale.nextOrderTotal({
        before: items,
        after: items,
        recordedTotal: 50,
        currencyChanged: false,
      }),
    ).toBe(50);
  });
});

describe("quantidade nova pela ficha de compra", () => {
  it("com o preço por produto, o total segue preço × quantidade nova", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: CUSTOMER,
      productName: "Boneca",
      description: "Boneca de vinil",
      quantity: 2750,
      unit: "un",
    });
    const o = await orderFromRequest(admin, request, {
      price: 2,
      sellPrice: null,
      sellCurrency: null,
    });
    const [item] = await store.list("order_items", {
      filter: { orderId: o.id },
    });
    await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [item.id]: 9.5 },
    });
    expect((await fresh(o.id)).sellPrice).toBe(26125); // 9,5 × 2.750
    // 20 + 20 + 14 caixas de 50 peças = 2.700 peças.
    await ps.saveSheet(admin, o.id, {
      price: 2,
      currency: "USD",
      masterCartonQty: 50,
      cbmPerCarton: 0.05,
      lots: [20, 20, 14].map((c) => ({
        departureIntervalDays: 45,
        masterCartons: c,
      })),
    });
    const [after] = await store.list("order_items", {
      filter: { orderId: o.id },
    });
    expect(after.quantity).toBe(2700);
    expect(after.sellUnitPrice).toBe(9.5);
    expect((await fresh(o.id)).sellPrice).toBe(25650); // 9,5 × 2.700
  });
});

describe("preço por produto nos históricos", () => {
  it("histórico de compras do cliente: unitário e subtotal gravados no item", async () => {
    const { order: o, itemIds } = await order();
    await sale.recordOrderSale(admin, o.id, {
      currency: "BRL",
      prices: { [itemIds[0]]: 5, [itemIds[1]]: 2.5 },
    });
    let found = null as
      | Awaited<ReturnType<typeof ph.loadPurchaseHistory>>["purchases"][number]
      | null;
    let before: number | null = null;
    do {
      const p = await ph.loadPurchaseHistory(admin, CUSTOMER, before);
      found ??= p.purchases.find((x) => x.orderId === o.id) ?? null;
      before = p.next;
    } while (before !== null && !found);
    expect(found?.total).toEqual({ amount: 600, currency: "BRL" });
    const byName = new Map(found!.items.map((i) => [i.name, i]));
    expect(byName.get("Tampa de bambu")).toMatchObject({
      unitSale: { amount: 2.5, currency: "BRL" },
      subtotalSale: { amount: 100, currency: "BRL" },
    });
    // O login do cliente vê a venda dele; o operador sem "Ver valores", não.
    const mine = await ph.loadPurchaseHistory(joao, CUSTOMER);
    expect(
      mine.purchases.find((x) => x.orderId === o.id)?.items[0].unitSale,
    ).not.toBeNull();
    const theirs = await ph.loadPurchaseHistory(operator, CUSTOMER);
    for (const p of theirs.purchases)
      for (const i of p.items) expect(i.unitSale).toBeNull();
  });
});
