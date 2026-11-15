import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { towerScenario } from "./helpers/tower-fixture";

/*
 * Aba "Todos no passo" paginada (dono, 15/11/2026: a tela do passo Pedidos
 * não abria com o histórico do Sankhya). Pelos resumos, lida só a página,
 * a lista é a mesma da leitura de todos os pedidos; `load: false` só conta;
 * o histórico em espera vem depois dos pedidos em andamento.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const summary = await import("@/lib/services/order-summary");
const flow = await import("@/lib/services/flow");
const { FLOW_STEPS, stepId } = await import("@/lib/flow");
type User = import("@/lib/db").User;

const NOW = new Date();
let admin: User;

beforeAll(async () => {
  admin = (await towerScenario(NOW)).admin;
  // Fase 5e: os passos leem os marcos gravados; a sincronização pedida
  // pelas gravações do cenário roda antes (na tela, depois da resposta).
  const { flushMilestoneSync } =
    await import("@/lib/services/order-milestones");
  await flushMilestoneSync();
  await summary.rebuildOrderSummaries(NOW);
});

const progressSteps = FLOW_STEPS.filter(
  (s) => !s.badgeOnly && ["order", "production", "delivery"].includes(s.block),
);

describe("aba Todos no passo, paginada", () => {
  it("pelos resumos, os mesmos pedidos da leitura de todos", async () => {
    const all = await flow.flowAllFor(admin);
    let seen = 0;
    for (const step of progressSteps) {
      const expected = (all.get(stepId(step)) ?? []).map((e) => e.order.id);
      const got = await flow.flowStepEntities(admin, step);
      expect(got.total, stepId(step)).toBe(expected.length);
      expect(got.entities.map((e) => e.order.id).sort(), stepId(step)).toEqual(
        [...expected].sort(),
      );
      seen += expected.length;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("só contar não lê os pedidos", async () => {
    const step = progressSteps.find((s) => s.key === "orders")!;
    const counted = await flow.flowStepEntities(admin, step, { load: false });
    const loaded = await flow.flowStepEntities(admin, step);
    expect(counted.entities).toEqual([]);
    expect(counted.total).toBe(loaded.total);
  });

  it("o histórico em espera vem depois dos pedidos em andamento", async () => {
    const all = await flow.flowAllFor(admin);
    const step = progressSteps.find(
      (s) => (all.get(stepId(s)) ?? []).length >= 2,
    )!;
    expect(step).toBeTruthy();
    const [first] = all.get(stepId(step))!;
    const store = getStore();
    await store.update("orders", first.order.id, { held: true });
    await summary.rebuildOrderSummaries(NOW);
    const got = await flow.flowStepEntities(admin, step);
    expect(got.entities.at(-1)?.order.id).toBe(first.order.id);
    await store.update("orders", first.order.id, { held: false });
    await summary.rebuildOrderSummaries(NOW);
  });

  it("fora da Wellmix, nada", async () => {
    const got = await flow.flowStepEntities(
      { ...admin, role: "supplier" },
      progressSteps[0],
    );
    expect(got.total).toBe(0);
  });
});
