import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { towerScenario } from "./helpers/tower-fixture";
import type { User } from "@/lib/db";

/*
 * Fase 5a/5b (docs/MILESTONES.md, "Fase 5: plano e andamento"): passo e marco
 * gravados nos itens, marcos do pedido em sombra, migração em fatias e
 * conferência.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { requirementFlowFields, milestoneDueDaysFromStages, currentMilestone } =
  await import("@/lib/milestones");
const { DEFAULT_SETTINGS, milestoneDueDaysOf, setSetting } =
  await import("@/lib/settings");
const om = await import("@/lib/services/order-milestones");
const { milestonesOf } = await import("@/lib/services/milestones");

const scenario = await towerScenario(new Date());
const store = getStore();
const admin = (
  await store.list("users", {
    filter: { email: "admin@wellmix.com" },
  })
)[0] as User;

async function counts() {
  const [notifications, events, audits] = await Promise.all([
    store.list("notifications"),
    store.list("process_events"),
    store.list("audit_log"),
  ]);
  return {
    notifications: notifications.length,
    events: events.length,
    audits: audits.length,
  };
}

async function runAll<T>(
  step: (o: {
    budgetMs: number;
    start?: boolean;
    chunk?: number;
  }) => Promise<
    | { state: "idle" }
    | { state: "running"; busy: boolean }
    | { state: "done"; marker: T }
  >,
): Promise<T> {
  let start = true;
  for (let i = 0; i < 100; i++) {
    const r = await step({ budgetMs: 0, start, chunk: 2 });
    start = false;
    if (r.state === "done") return r.marker;
    if (r.state === "idle") throw new Error("idle");
  }
  throw new Error("não terminou");
}

describe("prazo por marco", () => {
  it("sai do prazo das etapas enquanto não há prazo gravado", () => {
    const days = milestoneDueDaysFromStages(DEFAULT_SETTINGS.stageDueDays);
    expect(days["new-order"]).toBe(1 + 15);
    expect(days["contract"]).toBe(7);
    expect(days["down-payment"]).toBe(5);
    expect(days["delivery"]).toBe(3 + 0);
    expect(days["certification"]).toBeNull();
    expect(milestoneDueDaysOf(DEFAULT_SETTINGS)).toEqual(days);
    const stored = milestoneDueDaysOf({
      ...DEFAULT_SETTINGS,
      milestoneDueDays: { certification: 10, contract: 2 },
    });
    expect(stored.certification).toBe(10);
    expect(stored.contract).toBe(2);
    expect(stored["new-order"]).toBe(16);
  });
});

describe("itens novos com passo e marco", () => {
  it("o pedido criado pelo fluxo grava step e milestoneKey em cada item", async () => {
    const order = scenario.orders.a;
    const [requirements, stages] = await Promise.all([
      store.list("requirements", { filter: { orderId: order.id } }),
      store.list("stages", { filter: { orderId: order.id } }),
    ]);
    const stageKey = new Map(stages.map((s) => [s.id, s.key]));
    expect(requirements.length).toBeGreaterThan(5);
    for (const r of requirements) {
      const want = requirementFlowFields(stageKey.get(r.stageId)!, r.key);
      expect({
        step: r.step ?? null,
        milestoneKey: r.milestoneKey ?? null,
      }).toEqual(want);
    }
    expect(requirements.some((r) => r.milestoneKey)).toBe(true);
  });
});

describe("syncMilestones em sombra", () => {
  it("grava os marcos abertos e o marco atual, sem aviso nem evento", async () => {
    const order = scenario.orders.b;
    for (const row of await store.list("order_milestones", {
      filter: { orderId: order.id },
    }))
      await store.remove("order_milestones", row.id);
    const before = await counts();
    const result = await om.syncMilestones(order.id, { shadow: true });
    expect(await counts()).toEqual(before);
    const views = await milestonesOf(order);
    const rows = await store.list("order_milestones", {
      filter: { orderId: order.id },
    });
    const active = views.filter((v) => v.state === "active");
    expect(active.length).toBeGreaterThan(0);
    for (const v of active) {
      const row = rows.find((r) => r.key === v.key)!;
      expect(row.status === "active" || row.status === "blocked").toBe(true);
      expect(row.startedAt).toBeTruthy();
      expect(row.id).toBe(om.orderMilestoneId(order.id, v.key));
    }
    const newOrder = rows.find((r) => r.key === "new-order");
    if (newOrder?.status === "active")
      expect(
        Date.parse(newOrder.dueAt!) - Date.parse(newOrder.startedAt!),
      ).toBe(16 * 86_400_000);
    const fresh = (await store.get("orders", order.id))!;
    expect(result!.milestoneKey).toBe(currentMilestone(views, fresh.status));
    expect(fresh.milestoneKey).toBe(result!.milestoneKey);
    // De novo: nada muda.
    const again = await om.syncMilestones(order.id, { shadow: true });
    expect(again!.rows).toBe(0);
  });

  it("prazo pelo milestoneDueDays gravado", async () => {
    const order = scenario.orders.c;
    await setSetting("milestoneDueDays", { "new-order": 2, certification: 4 });
    for (const row of await store.list("order_milestones", {
      filter: { orderId: order.id },
    }))
      await store.remove("order_milestones", row.id);
    await om.syncMilestones(order.id, { shadow: true });
    const rows = await store.list("order_milestones", {
      filter: { orderId: order.id },
    });
    for (const row of rows.filter((r) => r.status === "active"))
      if (row.key === "new-order" || row.key === "certification")
        expect(Date.parse(row.dueAt!) - Date.parse(row.startedAt!)).toBe(
          (row.key === "new-order" ? 2 : 4) * 86_400_000,
        );
    await setSetting("milestoneDueDays", null);
  });

  it("o motor só põe o pedido na fila (fora de uma requisição, sem gravar)", async () => {
    expect(om.queuedMilestoneSyncs().length).toBeGreaterThan(0);
    const before = await counts();
    await om.flushMilestoneSync();
    expect(om.queuedMilestoneSyncs()).toEqual([]);
    expect(await counts()).toEqual(before);
    const order = (await store.get("orders", scenario.orders.a.id))!;
    expect(order.milestoneKey).toBeTruthy();
  });
});

describe("cancelamento", () => {
  it("grava o marco em que o pedido estava e esvazia o marco atual", async () => {
    const { cancelOrder } = await import("@/lib/services/order-cancel");
    const order = scenario.orders.c;
    const was = currentMilestone(await milestonesOf(order), order.status);
    expect(was).toBeTruthy();
    await cancelOrder(admin, order.id, {
      reason: "other",
      note: "teste dos marcos",
      settlement: null,
    });
    let fresh = (await store.get("orders", order.id))!;
    expect(fresh.cancelMilestoneKey).toBe(was);
    expect(fresh.cancelStageKey).toBeTruthy();
    await om.flushMilestoneSync();
    fresh = (await store.get("orders", order.id))!;
    expect(fresh.milestoneKey ?? null).toBeNull();
  });
});

describe("migração e conferência", () => {
  it("preenche só o vazio, mantém a espera e roda de novo sem mudar nada", async () => {
    const held = scenario.orders.a;
    await store.update("orders", held.id, { held: true });
    const heldReqs = await store.list("requirements", {
      filter: { orderId: held.id },
    });
    for (const r of heldReqs.slice(0, 3))
      await store.update("requirements", r.id, { held: true });
    // Como em produção: itens antigos sem passo nem marco, sem marcos do pedido.
    const all = await store.list("requirements");
    for (const r of all)
      await store.update("requirements", r.id, {
        step: null,
        milestoneKey: null,
      });
    for (const row of await store.list("order_milestones", {
      filter: { orderId: (await store.list("orders")).map((o) => o.id) },
    }))
      await store.remove("order_milestones", row.id);
    for (const o of await store.list("orders"))
      await store.update("orders", o.id, { milestoneKey: null });

    const parityBefore = await runAll(om.milestoneParityStep);
    expect(parityBefore.stats.differences).toBeGreaterThan(0);

    const before = await counts();
    const first = await runAll(om.migrateMilestonesStep);
    const migrated = await store.list("requirements");
    expect(first.stats.requirements).toBe(
      migrated.filter((r) => r.step != null || r.milestoneKey != null).length,
    );
    expect(first.stats.requirements).toBeGreaterThan(all.length / 2);
    expect(first.stats.milestones).toBeGreaterThan(0);
    expect(first.stats.orders).toBeGreaterThan(0);
    // Sem aviso nem evento (só a gravação do andamento em settings).
    const after = await counts();
    expect(after.notifications).toBe(before.notifications);
    expect(after.events).toBe(before.events);

    // Espera preservada: itens e pedido como estavam; linhas novas em espera.
    const heldRows = await store.list("order_milestones", {
      filter: { orderId: held.id },
    });
    expect(heldRows.length).toBeGreaterThan(0);
    expect(heldRows.every((r) => r.held === true)).toBe(true);
    const reqsAfter = await store.list("requirements", {
      filter: { orderId: held.id },
    });
    for (const r of heldReqs.slice(0, 3))
      expect(reqsAfter.find((x) => x.id === r.id)!.held).toBe(true);
    expect((await store.get("orders", held.id))!.held).toBe(true);
    // Item com valor gravado diferente não é sobrescrito (só o vazio).
    const keep = reqsAfter.find((r) => r.milestoneKey)!;
    await store.update("requirements", keep.id, { step: "x/y" });

    const second = await runAll(om.migrateMilestonesStep);
    expect(second.stats).toEqual({ requirements: 0, milestones: 0, orders: 0 });
    expect((await store.get("requirements", keep.id))!.step).toBe("x/y");
    // Conferência aponta o item mexido; voltando, zero diferença.
    const odd = await runAll(om.milestoneParityStep);
    expect(odd.stats.requirements).toBe(1);
    const fields = requirementFlowFields(
      (await store.get("stages", keep.stageId))!.key,
      keep.key,
    );
    await store.update("requirements", keep.id, { step: fields.step });
    const parity = await runAll(om.milestoneParityStep);
    expect(parity.stats).toEqual({
      differences: 0,
      views: 0,
      requirements: 0,
      current: 0,
      rows: 0,
      sample: [],
    });
    expect(parity.orders).toBe((await store.list("orders")).length);
    const status = await om.milestoneMigrationStatus();
    expect(status.migrated?.orders).toBe(parity.orders);
    expect(status.migration).toBeNull();
    expect(status.checked?.stats.differences).toBe(0);
  });
});
