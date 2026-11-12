import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Lembrete de prazo (job diário): etapa vencida com item obrigatório
 * pendente avisa o responsável e marca o envio; no mesmo dia não repete.
 * Pedidos e itens das etapas são lidos em lote (docs/RESUMOS.md, etapa 3).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { runReminders } = await import("@/lib/services/reminders");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

async function overdueOrder(name: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: "Lembrete",
    specification: null,
    quantity: 10,
    unit: "un",
    deadline: null,
    notes: null,
  });
  const order = await orderFromRequest(admin, request);
  const store = getStore();
  const [stage] = await store.list("stages", {
    filter: { orderId: order.id, status: ["active", "blocked"] },
    limit: 1,
  });
  await store.update("stages", stage.id, {
    dueAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    reminderSentAt: null,
  });
  const reqs = await store.list("requirements", {
    filter: { stageId: stage.id },
  });
  return { order, stage, pending: reqs.filter((x) => x.required) };
}

describe("lembretes de prazo", () => {
  it("avisa a etapa vencida com pendência obrigatória, uma vez por dia", async () => {
    const a = await overdueOrder("Lembrete A");
    const b = await overdueOrder("Lembrete B");
    const store = getStore();
    // B sem pendência obrigatória: não avisa.
    for (const req of b.pending)
      await store.update("requirements", req.id, { status: "done" });
    const before = (await store.list("notifications")).length;
    const first = await runReminders();
    const sentA = (await store.get("stages", a.stage.id))!.reminderSentAt;
    const sentB = (await store.get("stages", b.stage.id))!.reminderSentAt;
    expect(a.pending.length).toBeGreaterThan(0);
    expect(sentA).not.toBeNull();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect((await store.list("notifications")).length).toBeGreaterThan(before);
    expect(sentB ?? null).toBeNull();
    const again = await runReminders();
    expect(again.sent).toBe(0);
  });
});
