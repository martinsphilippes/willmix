import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Produto com pedido cancelado: no "Ciclo do produto" a solicitação do pedido
 * cancelado aparece como "Pedido cancelado" (sem mudar o status dela) e o
 * pós-venda encerrado pelo cancelamento não conta como respondido. Pedido
 * cancelado antes de o cancelamento encerrar pós-venda e programação (dados
 * antigos): o pós-venda aberto aparece encerrado e a programação ligada é
 * reconhecida como de pedido cancelado (a página a mostra "Cancelada").
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const c = await import("@/lib/services/order-cancel");
const os = await import("@/lib/services/order-status");
const pc = await import("@/lib/services/product-cycle");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const PRODUCT = "prod-panela";

let admin: User;
let joao: User;
let supplierA: User;

function newRequest(description: string) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: PRODUCT,
    productName: "Panela",
    description,
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

/** Solicitação até virar pedido (sinal confirmado). */
async function newOrder(): Promise<Order> {
  const store = getStore();
  const request = await newRequest("Teste produto com pedido cancelado");
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

function openAfterSale(order: Order) {
  return getStore().create("after_sales", {
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
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("produto com pedido cancelado", () => {
  it("ciclo: solicitação aparece como Pedido cancelado e o pós-venda encerrado não conta", async () => {
    const order = await newOrder();
    const pending = await newRequest("Outra solicitação, sem pedido");
    await openAfterSale(order);
    const before = (await pc.loadProductCycle(PRODUCT))!;

    await c.cancelOrder(admin, order.id, {
      reason: "other",
      note: null,
      settlement: null,
    });

    const cycle = (await pc.loadProductCycle(PRODUCT))!;
    const row = cycle.requests.find((x) => x.id === order.requestId)!;
    expect(row.status).toBe("ORDER_CANCELLED");
    // A solicitação segue no histórico e não vira "excluída".
    const request = (await getStore().get("requests", order.requestId))!;
    expect(request.status).toBe("ORDERED");
    // As outras solicitações seguem com a situação delas.
    expect(cycle.requests.find((x) => x.id === pending.id)!.status).toBe(
      pending.status,
    );
    const orderRow = cycle.orders.find((o) => o.id === order.id)!;
    expect(orderRow.status).toBe("CANCELLED");
    expect(orderRow.afterSalesStatus).toBe("closed");
    expect(cycle.counts.afterSalesAnswered).toBe(
      before.counts.afterSalesAnswered,
    );
  });

  it("pós-venda respondido e depois encerrado continua contando mesmo com o pedido cancelado", async () => {
    const order = await newOrder();
    const sale = await openAfterSale(order);
    const before = (await pc.loadProductCycle(PRODUCT))!;
    // Respondido pelo cliente e encerrado pela Wellmix, antes do cancelamento.
    await getStore().update("after_sales", sale.id, {
      status: "closed",
      rating: 5,
      answeredAt: new Date().toISOString(),
      answeredByUserId: joao.id,
      closedAt: new Date().toISOString(),
    });
    const answered = (await pc.loadProductCycle(PRODUCT))!;
    expect(answered.counts.afterSalesAnswered).toBe(
      before.counts.afterSalesAnswered + 1,
    );
    await c.cancelOrder(admin, order.id, {
      reason: "other",
      note: null,
      settlement: null,
    });
    const after = (await pc.loadProductCycle(PRODUCT))!;
    expect(after.counts.afterSalesAnswered).toBe(
      answered.counts.afterSalesAnswered,
    );
  });

  it("pedido cancelado antes da regra: pós-venda aberto aparece encerrado e a programação é de pedido cancelado", async () => {
    const store = getStore();
    const order = await newOrder();
    await openAfterSale(order);
    const schedule = await store.create("purchase_schedules", {
      productId: PRODUCT,
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
    const before = (await pc.loadProductCycle(PRODUCT))!;
    // Cancelamento antigo: só o pedido mudou; pós-venda e programação abertos.
    await store.update("orders", order.id, { status: "CANCELLED" });

    const cycle = (await pc.loadProductCycle(PRODUCT))!;
    expect(cycle.requests.find((x) => x.id === order.requestId)!.status).toBe(
      "ORDER_CANCELLED",
    );
    const orderRow = cycle.orders.find((o) => o.id === order.id)!;
    expect(orderRow.afterSalesStatus).toBe("closed");
    expect(cycle.counts.afterSalesAnswered).toBe(
      before.counts.afterSalesAnswered,
    );

    // Mesma leitura da página do produto (Programação de compra).
    const schedules = await store.list("purchase_schedules", {
      filter: { productId: PRODUCT },
    });
    const cancelled = await os.cancelledOrderIds(
      schedules.map((s) => s.orderId),
    );
    expect(cancelled.has(order.id)).toBe(true);
    expect((await store.get("purchase_schedules", schedule.id))!.status).toBe(
      "ordered",
    );
  });
});
