import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Lembrete de prazo (job diário): marco vencido (order_milestones, fase 5c)
 * com item obrigatório pendente avisa o responsável e marca o envio no
 * marco; no mesmo dia não repete. Pedidos e itens são lidos em lote
 * (docs/RESUMOS.md, etapa 3).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { runReminders } = await import("@/lib/services/reminders");
const { flushMilestoneSync } = await import("@/lib/services/order-milestones");
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
  // Fase 5c: o prazo é o do marco gravado (order_milestones).
  await flushMilestoneSync();
  const [milestone] = await store.list("order_milestones", {
    filter: { orderId: order.id, status: ["active", "blocked"] },
    limit: 1,
  });
  await store.update("order_milestones", milestone.id, {
    dueAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    reminderSentAt: null,
  });
  const stages = (
    await store.list("stages", { filter: { orderId: order.id } })
  ).filter((st) => st.status !== "cancelled");
  const reqs = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  return {
    order,
    milestone,
    // Fase 5d: os itens do marco em andamento já podem ser feitos, em
    // qualquer etapa (o marco libera, não a etapa).
    pending: reqs.filter(
      (x) =>
        x.required &&
        x.milestoneKey === milestone.key &&
        stages.some((st) => st.id === x.stageId),
    ),
  };
}

describe("lembretes de prazo", () => {
  it("avisa o marco vencido com pendência obrigatória, uma vez por dia", async () => {
    const a = await overdueOrder("Lembrete A");
    const b = await overdueOrder("Lembrete B");
    const store = getStore();
    // B sem pendência obrigatória: não avisa.
    for (const req of b.pending)
      await store.update("requirements", req.id, { status: "done" });
    const before = (await store.list("notifications")).length;
    const first = await runReminders();
    const sentA = (await store.get("order_milestones", a.milestone.id))!
      .reminderSentAt;
    const sentB = (await store.get("order_milestones", b.milestone.id))!
      .reminderSentAt;
    expect(a.pending.length).toBeGreaterThan(0);
    expect(sentA).not.toBeNull();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect((await store.list("notifications")).length).toBeGreaterThan(before);
    expect(sentB ?? null).toBeNull();
    // O texto nomeia o marco gravado (fase 5c), não a etapa.
    const { milestoneTitle } = await import("@/lib/milestones");
    const { translator } = await import("@/i18n");
    const subjects = (await store.list("notifications"))
      .filter((n) => n.link === `/app/orders/${a.order.id}`)
      .map((n) => n.subject);
    expect(subjects).toContain(
      `Atrasado: pedido #${a.order.number}, ${milestoneTitle(translator("pt"), a.milestone.key as never)}`,
    );
    // O prazo da etapa não conta mais: só o do marco.
    const [stageA] = await store.list("stages", {
      filter: { orderId: a.order.id, status: "active" },
    });
    expect(stageA.reminderSentAt ?? null).toBeNull();
    const again = await runReminders();
    expect(again.sent).toBe(0);
  });

  it("pedido cancelado com a linha do marco aberta não recebe lembrete", async () => {
    const c = await overdueOrder("Lembrete C");
    const store = getStore();
    await store.update("orders", c.order.id, { status: "CANCELLED" });
    await runReminders();
    expect(
      (await store.get("order_milestones", c.milestone.id))!.reminderSentAt ??
        null,
    ).toBeNull();
  });
});
