import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Pedido cancelado no financeiro e na Control Tower: não conta como venda,
 * custo, margem, "sem câmbio" nem "Comprado (FOB)"; o que foi recebido ou pago
 * continua somado (o dinheiro mexeu de verdade). Itens de revisão que ficaram
 * abertos em pedidos cancelados antes da regra não viram pendência.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const c = await import("@/lib/services/order-cancel");
const f = await import("@/lib/services/finance");
const ct = await import("@/lib/services/control-tower");
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
    description: "Teste financeiro do cancelamento",
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

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("pedido cancelado no financeiro", () => {
  it("sai de vendido, sem câmbio, comprado e revisões; recebido fica", async () => {
    const store = getStore();
    const order = await newOrder();
    const fob = order.fobTotal ?? 0;
    expect(fob).toBeGreaterThan(0);

    const before = await f.loadFinance();
    const totalsBefore = await ct.loadTowerTotals();
    const row = before.rows.find((x) => x.order.id === order.id)!;
    expect(row.cost).toBe(null); // USD × BRL sem câmbio: conta em "sem câmbio"

    await c.cancelOrder(admin, order.id, {
      reason: "other",
      note: null,
      settlement: null,
    });
    const reviewsMid = (await ct.loadTowerTotals()).reviewsOpen;
    // Item aberto como os de pedidos cancelados antes da regra (só entity "order").
    await store.create("review_items", {
      orderId: null,
      entity: "order",
      entityId: order.id,
      rule: "inspection.weight",
      problem: "Peso divergente (pedido cancelado)",
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

    const after = await f.loadFinance();
    // O pedido continua na lista (histórico).
    expect(after.rows.some((x) => x.order.id === order.id)).toBe(true);
    expect(after.summary.sell).toBeCloseTo(before.summary.sell - 1000);
    expect(after.summary.received).toBeCloseTo(before.summary.received);
    expect(after.summary.missingFx).toBe(before.summary.missingFx - 1);

    const totals = await ct.loadTowerTotals();
    expect(totals.sold).toBeCloseTo(totalsBefore.sold - 1000);
    expect(totals.received).toBeCloseTo(totalsBefore.received);
    expect(totals.purchasedByCurrency.USD ?? 0).toBeCloseTo(
      (totalsBefore.purchasedByCurrency.USD ?? 0) - fob,
    );
    expect(totals.reviewsOpen).toBe(reviewsMid);

    const tower = await ct.loadControlTower();
    expect(
      tower.exceptions.some(
        (e) =>
          e.kind === "review" &&
          e.detail.includes("Peso divergente (pedido cancelado)"),
      ),
    ).toBe(false);
  });
});
