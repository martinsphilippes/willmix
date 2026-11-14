import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { towerScenario } from "./helpers/tower-fixture";

/*
 * Histórico do Sankhya em espera até o go-live (dono, 14/11/2026;
 * docs/SANKHYA.md): o pedido é trabalhado como os outros, sem avisos; as
 * pendências da atividade em aberto ficam à parte na tela Pendências, fora
 * da lista geral (bolinhas do menu e SLA).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { pendingTasksFor, heldTasksFor } = await import("@/lib/services/tasks");
const { notify } = await import("@/lib/services/notifications");

const NOW = new Date();
let scenario: Awaited<ReturnType<typeof towerScenario>>;

beforeAll(async () => {
  scenario = await towerScenario(NOW);
});

/** Marca o pedido, as etapas e os itens como a carga do histórico faz. */
async function hold(orderId: string) {
  const store = getStore();
  await store.update("orders", orderId, { held: true });
  for (const s of await store.list("stages", { filter: { orderId } }))
    await store.update("stages", s.id, { held: true });
  for (const r of await store.list("requirements", { filter: { orderId } }))
    await store.update("requirements", r.id, { held: true });
}

describe("pedido do histórico em espera", () => {
  it("pendências da atividade em aberto à parte, fora da lista geral", async () => {
    const { admin } = scenario;
    const { b } = scenario.orders;
    const before = (await pendingTasksFor(admin)).filter(
      (t) => t.orderId === b.id && t.kind === "requirement",
    );
    expect(before.length).toBeGreaterThan(0);
    await hold(b.id);
    const general = (await pendingTasksFor(admin)).filter(
      (t) => t.orderId === b.id,
    );
    expect(general).toEqual([]);
    const held = await heldTasksFor(admin, 1, NOW);
    expect(held.orders).toBe(1);
    const mine = held.tasks.filter((t) => t.orderId === b.id);
    // As mesmas pendências de etapa de antes, só na lista à parte.
    expect(mine.map((t) => t.stageKey).sort()).toEqual(
      before.map((t) => t.stageKey).sort(),
    );
  });

  it("não gera aviso", async () => {
    const store = getStore();
    const { admin } = scenario;
    const { b, c } = scenario.orders;
    const count = async () =>
      (await store.list("notifications", { filter: { userId: admin.id } }))
        .length;
    const start = await count();
    await notify(
      { userIds: [admin.id] },
      { subject: "Teste", body: "Histórico", link: `/app/orders/${b.id}` },
    );
    expect(await count()).toBe(start);
    await notify(
      { userIds: [admin.id] },
      { subject: "Teste", body: "Normal", link: `/app/orders/${c.id}` },
    );
    expect(await count()).toBeGreaterThan(start);
  });
});
