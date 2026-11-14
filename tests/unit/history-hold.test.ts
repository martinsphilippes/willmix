import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Histórico do Sankhya em espera até o go-live (docs/SANKHYA.md): etapas e
 * pendências com `held` saem das listas gerais (Pendências, lembretes), mas
 * a leitura do próprio pedido continua vendo tudo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { runReminders } = await import("@/lib/services/reminders");
const { hidesHeld } = await import("@/lib/db/store");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

async function heldOrder() {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Histórico",
    description: "Pedido do histórico",
    specification: null,
    quantity: 10,
    unit: "un",
    deadline: null,
    notes: null,
  });
  const order = await orderFromRequest(admin, request);
  const store = getStore();
  const stages = await store.list("stages", { filter: { orderId: order.id } });
  const reqs = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  const overdue = new Date(Date.now() - 3 * 86_400_000).toISOString();
  for (const s of stages)
    await store.update("stages", s.id, {
      held: true,
      ...(s.status === "active" ? { dueAt: overdue, reminderSentAt: null } : {}),
    });
  for (const q of reqs) await store.update("requirements", q.id, { held: true });
  return { order, stages, reqs };
}

describe("histórico em espera", () => {
  it("só as listas gerais escondem; pedido, etapa e id veem tudo", () => {
    expect(hidesHeld("requirements", { filter: { status: "pending" } })).toBe(
      true,
    );
    expect(hidesHeld("stages", {})).toBe(true);
    for (const filter of [
      { orderId: "o" },
      { stageId: "s" },
      { id: ["x"] },
      { held: true },
    ])
      expect(hidesHeld("requirements", { filter })).toBe(false);
    expect(hidesHeld("payments", {})).toBe(false);
  });

  it("some das listas gerais e não gera lembrete; o pedido continua inteiro", async () => {
    const { order, stages, reqs } = await heldOrder();
    const store = getStore();
    const active = await store.list("stages", {
      filter: { status: ["active", "blocked"] },
    });
    expect(active.some((s) => s.orderId === order.id)).toBe(false);
    const pending = await store.list("requirements", {
      filter: { status: ["pending", "rejected"] },
    });
    expect(pending.some((q) => q.orderId === order.id)).toBe(false);
    // O pedido, por ele mesmo, segue igual.
    expect(
      await store.list("stages", { filter: { orderId: order.id } }),
    ).toHaveLength(stages.length);
    expect(
      await store.list("requirements", { filter: { orderId: order.id } }),
    ).toHaveLength(reqs.length);
    const before = await store.list("notifications", {});
    await runReminders();
    const after = await store.list("notifications", {});
    expect(
      after
        .filter((n) => !before.some((b) => b.id === n.id))
        .some((n) => n.link === `/app/orders/${order.id}`),
    ).toBe(false);
  });
});
