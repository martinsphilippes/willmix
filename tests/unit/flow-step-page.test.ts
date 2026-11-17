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

  it("a busca acha o pedido em todo o passo, não só na página", async () => {
    // Dono, 17/11/2026: a busca da aba olha todos os pedidos do passo (nº,
    // fornecedor, cliente e produto), antes de dividir em páginas.
    const all = await flow.flowAllFor(admin);
    const step = progressSteps.find(
      (s) => (all.get(stepId(s)) ?? []).length >= 2,
    )!;
    const list = all.get(stepId(step))!;
    const target = list.at(-1)!.order;
    const total = (await flow.flowStepEntities(admin, step)).total;

    const byNumber = await flow.flowStepEntities(admin, step, {
      q: `#${target.number}`,
    });
    expect(byNumber.total).toBe(total);
    expect(byNumber.matched).toBe(byNumber.entities.length);
    expect(byNumber.entities.map((e) => e.order.id)).toContain(target.id);
    expect(
      byNumber.entities.every((e) =>
        String(e.order.number).includes(String(target.number)),
      ),
    ).toBe(true);

    const supplier = await getStore().get("parties", target.supplierId);
    expect(supplier).toBeTruthy();
    const bySupplier = await flow.flowStepEntities(admin, step, {
      q: supplier!.name.toUpperCase(),
    });
    expect(bySupplier.entities.map((e) => e.order.id)).toContain(target.id);

    const none = await flow.flowStepEntities(admin, step, {
      q: "zz-nenhum-pedido-zz",
    });
    expect(none).toMatchObject({ entities: [], matched: 0, total, pages: 1 });
  });

  it("sem os resumos, a busca usa o número e o cadastro", async () => {
    const all = await flow.flowAllFor(admin);
    const step = progressSteps.find(
      (s) => (all.get(stepId(s)) ?? []).length >= 2,
    )!;
    const target = all.get(stepId(step))!.at(-1)!.order;
    const store = getStore();
    const [marker] = await store.list("settings", {
      filter: { key: summary.SUMMARY_SETTING_KEY },
      limit: 1,
    });
    expect(marker).toBeTruthy();
    // Resumos "fora do ar": a aba lê os pedidos das tabelas.
    await store.update("settings", marker.id, { value: {} });
    try {
      expect(await summary.summariesReady()).toBe(false);
      const supplier = await store.get("parties", target.supplierId);
      const found = await flow.flowStepEntities(admin, step, {
        q: `${target.number} ${supplier!.name}`,
      });
      expect(found.entities.map((e) => e.order.id)).toContain(target.id);
      expect(found.matched).toBeLessThanOrEqual(found.total);
    } finally {
      await store.update("settings", marker.id, { value: marker.value });
    }
    expect(await summary.summariesReady()).toBe(true);
  });

  it("texto da busca: número, fornecedor, cliente e produto", () => {
    expect(
      flow.flowSearchText({
        number: 1234,
        supplier: "Ningbo Toys",
        customer: null,
        product: "Boneca",
      }),
    ).toBe("#1234 Ningbo Toys Boneca");
  });

  it("fora da Wellmix, nada", async () => {
    const got = await flow.flowStepEntities(
      { ...admin, role: "supplier" },
      progressSteps[0],
    );
    expect(got.total).toBe(0);
  });
});
