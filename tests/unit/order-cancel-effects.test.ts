import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cancelar o pedido encerra o que ficaria "em andamento" fora dele: itens de
 * revisão abertos, pós-venda aberto, programação de compra ligada e o cliente
 * do container (quando o pedido era o último dele lá). E a solicitação passa a
 * aparecer como "Pedido cancelado" (sem mudar o status dela, que continua
 * ORDERED: CANCELLED na solicitação quer dizer excluída).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const c = await import("@/lib/services/order-cancel");
const os = await import("@/lib/services/order-status");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;
let supplierA: User;

async function newOrder(): Promise<Order> {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste efeitos do cancelamento",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  return r.confirmDownPayment(admin, request.id);
}

const input = {
  reason: "other" as const,
  note: null,
  settlement: null,
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("efeitos do cancelamento", () => {
  it("encerra revisões, pós-venda, programação e libera o container", async () => {
    const store = getStore();
    const order = await newOrder();
    const review = await store.create("review_items", {
      orderId: order.id,
      entity: "order",
      entityId: order.id,
      rule: "inspection.weight",
      problem: "Peso divergente",
      expected: "3",
      found: "30",
      responsibleRole: "operator",
      action: null,
      link: null,
      status: "open",
      resolvedByUserId: null,
      resolvedAt: null,
      resolutionNote: null,
    });
    const afterSale = await store.create("after_sales", {
      orderId: order.id,
      customerId: order.customerId,
      status: "open",
      rating: null,
      experience: null,
      problems: null,
      perceivedCosts: null,
      suggestions: null,
      repurchaseInterest: null,
      answeredAt: null,
      answeredByUserId: null,
      closedAt: null,
      notes: null,
    });
    const schedule = await store.create("purchase_schedules", {
      productId: "prod-jarra",
      sourcingItemId: null,
      customerId: order.customerId,
      supplierId: order.supplierId,
      requestId: order.requestId,
      orderId: order.id,
      sequence: 1,
      quantity: 100,
      unit: "un",
      scheduledFor: null,
      periodLabel: null,
      price: null,
      currency: null,
      status: "ordered",
      notes: null,
      createdByUserId: admin.id,
    });
    const container = await store.create("containers", {
      code: "CT-TESTE",
      type: "40HC",
      capacityCbm: 68,
      maxWeightKg: null,
      customerId: order.customerId,
      status: "planning",
      etd: null,
      eta: null,
      notes: null,
      createdByUserId: admin.id,
    });
    await store.create("container_items", {
      containerId: container.id,
      orderId: order.id,
      orderItemId: null,
      productId: "prod-jarra",
      name: "Jarra",
      quantity: 100,
      unit: "un",
      unitsPerBox: 10,
      boxCount: 10,
      cbmPerBox: 0.1,
      weightPerBoxKg: null,
    });

    await c.cancelOrder(admin, order.id, input);

    expect((await store.get("review_items", review.id))?.status).toBe(
      "dismissed",
    );
    const sale = await store.get("after_sales", afterSale.id);
    expect(sale?.status).toBe("closed");
    expect(sale?.closedAt).toBeTruthy();
    const ps = await store.get("purchase_schedules", schedule.id);
    expect(ps?.status).toBe("cancelled");
    expect(ps?.orderId).toBe(order.id); // o vínculo fica
    expect((await store.get("containers", container.id))?.customerId).toBe(
      null,
    );
  });

  it("container com pedido de outro: o cliente continua", async () => {
    const store = getStore();
    const first = await newOrder();
    const second = await newOrder();
    const container = await store.create("containers", {
      code: "CT-DOIS",
      type: "40HC",
      capacityCbm: 68,
      maxWeightKg: null,
      customerId: first.customerId,
      status: "planning",
      etd: null,
      eta: null,
      notes: null,
      createdByUserId: admin.id,
    });
    for (const o of [first, second])
      await store.create("container_items", {
        containerId: container.id,
        orderId: o.id,
        orderItemId: null,
        productId: "prod-jarra",
        name: "Jarra",
        quantity: 10,
        unit: "un",
        unitsPerBox: 10,
        boxCount: 1,
        cbmPerBox: 0.1,
        weightPerBoxKg: null,
      });
    await c.cancelOrder(admin, first.id, input);
    expect((await store.get("containers", container.id))?.customerId).toBe(
      first.customerId,
    );
  });

  it("a solicitação continua ORDERED e aparece como Pedido cancelado", async () => {
    const store = getStore();
    const active = await newOrder();
    const order = await newOrder();
    await c.cancelOrder(admin, order.id, input);
    const request = (await store.get("requests", order.requestId))!;
    expect(request.status).toBe("ORDERED");
    const cancelled = await os.cancelledOrderIds([
      order.id,
      active.id,
      null,
      undefined,
    ]);
    expect([...cancelled]).toEqual([order.id]);
    expect(os.requestDisplayStatus(request, cancelled)).toBe("ORDER_CANCELLED");
    expect(os.requestStatusTone("ORDER_CANCELLED")).toBe("danger");
    const other = (await store.get("requests", active.requestId))!;
    expect(os.requestDisplayStatus(other, cancelled)).toBe("ORDERED");
    expect((await os.cancelledOrderIds([])).size).toBe(0);
  });
});
