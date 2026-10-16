import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Pedido cancelado fora do pedido: não gera pendência (pós-venda "Avalie a
 * compra" nem item de revisão, inclusive nos cancelados antes de o
 * cancelamento encerrar esses itens) e não conta como compra no histórico
 * comercial (nem vira o "último pedido" de Comprar de novo / Nova proposta).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const c = await import("@/lib/services/order-cancel");
const tasks = await import("@/lib/services/tasks");
const h = await import("@/lib/services/history");
type User = import("@/lib/db").User;
type HistoryRow = import("@/lib/services/history").HistoryRow;
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
    description: "Teste pedido cancelado fora do pedido",
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

/** Pós-venda e item de revisão abertos, como um pedido entregue com divergência. */
async function openRows(order: Order, problem: string) {
  const store = getStore();
  await store.create("review_items", {
    orderId: order.id,
    entity: "order",
    entityId: order.id,
    rule: "inspection.weight",
    problem,
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
  await store.create("after_sales", {
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

const input = {
  reason: "other" as const,
  note: null,
  settlement: null,
};

async function jarraRow(user: User) {
  const rows = await h.loadCommercialHistory(user, {
    customerId: "cliente-joao",
  });
  return rows.find(
    (x) => x.customerId === "cliente-joao" && x.productId === "prod-jarra",
  );
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("pendências de pedido cancelado", () => {
  it("cancelado antes da regra: pós-venda e revisão abertos não viram pendência", async () => {
    const active = await newOrder();
    await openRows(active, "Peso divergente (ativo)");
    const old = await newOrder();
    await openRows(old, "Peso divergente (cancelado)");
    // Cancelamento antigo: só o status mudou, as linhas ficaram abertas.
    await getStore().update("orders", old.id, { status: "CANCELLED" });

    const wellmix = await tasks.pendingTasksFor(admin);
    const reviewTitles = wellmix
      .filter((t) => t.kind === "review")
      .map((t) => t.title);
    expect(reviewTitles).toContain("Peso divergente (ativo)");
    expect(reviewTitles).not.toContain("Peso divergente (cancelado)");

    const customer = await tasks.pendingTasksFor(joao);
    const afterSales = customer
      .filter((t) => t.kind === "after_sales")
      .map((t) => t.orderNumber);
    expect(afterSales).toContain(active.number);
    expect(afterSales).not.toContain(old.number);
  });

  it("cancelado agora: nada fica nas pendências", async () => {
    const order = await newOrder();
    await openRows(order, "Peso divergente (cancelado agora)");
    await c.cancelOrder(admin, order.id, input);
    const wellmix = await tasks.pendingTasksFor(admin);
    expect(wellmix.map((t) => t.title)).not.toContain(
      "Peso divergente (cancelado agora)",
    );
    const customer = await tasks.pendingTasksFor(joao);
    expect(customer.some((t) => t.orderNumber === order.number)).toBe(false);
  });
});

describe("histórico comercial", () => {
  it("pedido cancelado não conta como compra nem vira o último pedido", async () => {
    const active = await newOrder();
    const before = new Map<User, HistoryRow>();
    for (const user of [admin, joao]) {
      const row = (await jarraRow(user))!;
      expect(row.lastOrderId).toBe(active.id);
      before.set(user, row);
    }

    const cancelled = await newOrder();
    await c.cancelOrder(admin, cancelled.id, input);

    for (const [user, row] of before) {
      const after = (await jarraRow(user))!;
      expect(after.purchases).toBe(row.purchases);
      expect(after.totalQuantity).toBe(row.totalQuantity);
      expect(after.lastOrderId).toBe(active.id);
      expect(after.lastOrderNumber).toBe(active.number);
      expect(after.lastAt).toBe(row.lastAt);
    }
  });
});
