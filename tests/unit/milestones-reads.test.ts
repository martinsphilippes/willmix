import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 5c (docs/MILESTONES.md): as leituras saem dos marcos gravados. Os
 * itens entram no marco pelo passo gravado (`requirements.step`; sem ele,
 * pela etapa), o prazo do marco é o de `order_milestones.dueAt` (sem linha,
 * o da etapa), o resumo do pedido lê o mesmo e as gravações de passos do
 * embarque, produção e recebimento mantêm `order_milestones` em dia.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const svc = await import("@/lib/services/milestones");
const om = await import("@/lib/services/order-milestones");
const summary = await import("@/lib/services/order-summary");
const { flushSummaryChanges, pendingSummaryChanges } =
  await import("@/lib/db/summary-dirty");
const { isOrderOpen } = await import("@/lib/order-status");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;

async function placeOrder(name: string): Promise<Order> {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 10,
    unit: "un",
    deadline: null,
    notes: null,
  });
  const order = await orderFromRequest(admin, request);
  await om.flushMilestoneSync();
  return (await getStore().get("orders", order.id))!;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("subtarefas pelo passo gravado", () => {
  const order = { id: "o1", status: "ORDER_CREATED", flow: null } as never;
  const stage = {
    id: "s1",
    key: "ORDER_CREATED",
    status: "active",
    dueAt: "2026-12-01T00:00:00.000Z",
  } as never;
  const base = {
    order,
    stages: [stage],
    importSteps: [],
    track: null,
    receiving: null,
    lpco: false,
  };
  const req = (step: string | null) =>
    ({
      id: "r1",
      stageId: "s1",
      key: "order_confirmed",
      status: "pending",
      step,
      milestoneKey: null,
    }) as never;

  const stepsOf = (list: Array<{ key: string; step: string }>) =>
    list.filter((x) => x.key === "order_confirmed").map((x) => x.step);

  it("o passo gravado manda; vazio, a etapa; 'stages' ignora o gravado", () => {
    const stored = svc.orderSubtasks({
      ...base,
      requirements: [req("production/inspection")],
    });
    expect(stepsOf(stored)).toEqual(["production/inspection"]);
    const fallback = svc.orderSubtasks({
      ...base,
      requirements: [req(null)],
    });
    expect(stepsOf(fallback)).toEqual(["order/orders"]);
    const old = svc.orderSubtasks({
      ...base,
      requirements: [req("production/inspection")],
      source: "stages",
    });
    expect(stepsOf(old)).toEqual(["order/orders"]);
  });

  it("prazo do marco em andamento: o gravado; sem linha, o da etapa", () => {
    const views = svc.milestoneViews({
      ...base,
      requirements: [req(null)],
    });
    expect(views.find((v) => v.key === "new-order")!.dueAt).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    const stored = svc.milestoneViews({
      ...base,
      requirements: [req(null)],
      milestones: [{ key: "new-order", dueAt: "2026-11-20T10:00:00.000Z" }],
    });
    expect(stored.find((v) => v.key === "new-order")!.dueAt).toBe(
      "2026-11-20T10:00:00.000Z",
    );
  });
});

describe("leituras pelos marcos gravados", () => {
  it("a tela do pedido e o resumo (facts.m) leem o prazo de order_milestones", async () => {
    const store = getStore();
    const order = await placeOrder("Prazo gravado");
    const [row] = await store.list("order_milestones", {
      filter: { orderId: order.id, key: "new-order" },
    });
    const due = "2026-12-24T15:00:00.000Z";
    await store.update("order_milestones", row.id, { dueAt: due });
    const views = await svc.milestonesOf(order);
    expect(views.find((v) => v.key === "new-order")!.dueAt).toBe(due);
    await summary.rebuildOrderSummaries();
    const facts = await summary.factsForOrders([order], ["m"]);
    const m = facts!.get(order.id)!.m!;
    expect(m.find((x) => x.k === "new-order")!.due).toBe(due);
  });

  it("passo do embarque, produção e recebimento gravados sincronizam os marcos", async () => {
    const store = getStore();
    const order = await placeOrder("Passo gravado");
    for (const row of await store.list("order_milestones", {
      filter: { orderId: order.id },
    }))
      await store.remove("order_milestones", row.id);
    await store.create("import_steps", {
      orderId: order.id,
      key: "numerario",
      status: "submitted",
      value: null,
      amount: 10,
      currency: "BRL",
      documentId: null,
      submittedByUserId: null,
      submittedAt: new Date().toISOString(),
      validatedByUserId: null,
      validatedAt: null,
      rejectReason: null,
    } as never);
    expect(pendingSummaryChanges().milestones).toContain(order.id);
    await flushSummaryChanges();
    expect(pendingSummaryChanges().milestones).toEqual([]);
    const rows = await store.list("order_milestones", {
      filter: { orderId: order.id },
    });
    expect(rows.some((x) => x.key === "new-order")).toBe(true);
  });

  it("isOrderOpen: aberto até encerrar ou cancelar", () => {
    expect(isOrderOpen("ORDER_CREATED")).toBe(true);
    expect(isOrderOpen("DELIVERED")).toBe(true);
    expect(isOrderOpen("CLOSED")).toBe(false);
    expect(isOrderOpen("CANCELLED")).toBe(false);
    expect(isOrderOpen(null)).toBe(false);
  });
});
