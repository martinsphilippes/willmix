import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 4c (docs/MILESTONES.md, "Avisos, lembretes e SLA"): o marco que
 * conclui avisa os informados uma vez, pela sincronização dos marcos (fase
 * 5d; antes, o recálculo do resumo por evento);
 * a reconstrução não avisa e o pedido do histórico em espera também não. O
 * lembrete nomeia o marco; o SLA agrupa pelo marco.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const summary = await import("@/lib/services/order-summary");
const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
const { syncMilestones } = await import("@/lib/services/order-milestones");
const { MILESTONE_INFORMED_ACTION } =
  await import("@/lib/services/milestone-notify");
const { MILESTONES, MILESTONE_KEYS, milestoneOfItems, newlyDoneMilestones } =
  await import("@/lib/milestones");
const { groupByMilestone } = await import("@/lib/services/sla-panel");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type CompactMilestone = import("@/lib/milestones").CompactMilestone;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  await summary.rebuildOrderSummaries();
});

async function placeOrder(name: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: "Aviso de marco",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  const order = await orderFromRequest(admin, request);
  await flushSummaryChanges();
  return order;
}

/** O resumo guardado volta a dizer que nada estava concluído. */
async function forgetDone(order: Order) {
  const store = getStore();
  const row = (await store.get("order_summaries", order.id))!;
  const facts = row.facts as { m?: CompactMilestone[] };
  await store.update("order_summaries", order.id, {
    facts: {
      ...facts,
      m: facts.m!.map((x) => ({ ...x, s: "active" as const, d: 0 })),
    },
  });
}

/** Conclui todos os itens do pedido (gravação que marca o resumo). */
async function finishRequirements(order: Order) {
  const store = getStore();
  for (const req of await store.list("requirements", {
    filter: { orderId: order.id },
  }))
    await store.update("requirements", req.id, { status: "done" });
}

const milestoneNotes = async (order: Order) =>
  (await getStore().list("notifications", { filter: { channel: "inapp" } }))
    .filter((n) => n.link === `/app/orders/${order.id}#order-stages`)
    .map((n) => n.subject);

const informedAudits = async (order: Order) =>
  getStore().list("audit_log", {
    filter: {
      entity: "order",
      entityId: order.id,
      action: MILESTONE_INFORMED_ACTION,
    },
  });

describe("marcos: quem é informado", () => {
  it("todo marco tem a lista de informados da tabela do mapa", () => {
    expect(MILESTONES.map((d) => d.key)).toEqual([...MILESTONE_KEYS]);
    const of = (k: string) => MILESTONES.find((d) => d.key === k)!.informed;
    expect(of("new-order")).toEqual(["sales", "finance", "supplier"]);
    expect(of("samples")).toContain("customer");
    expect(of("delivery")).toEqual(["customer"]);
    // Desembaraço: o Dono só no canal cinza ou vermelho (aviso próprio).
    expect(of("customs")).toEqual([]);
    // Cliente só onde a tabela diz.
    expect(
      MILESTONES.filter((d) => d.informed.includes("customer")).map(
        (d) => d.key,
      ),
    ).toEqual(["samples", "invoice-transport", "delivery"]);
  });

  it("concluído agora: só o que estava aberto e fechou com tudo feito", () => {
    const prev: CompactMilestone[] = [
      { k: "new-order", s: "active", d: 1, t: 2 },
      { k: "certification", s: "done", d: 1, t: 1 },
      { k: "art", s: "waiting", d: 0, t: 1 },
      { k: "contract", s: "active", d: 0, t: 3 },
    ];
    const next: CompactMilestone[] = [
      { k: "new-order", s: "done", d: 2, t: 2 },
      { k: "certification", s: "done", d: 1, t: 1 },
      { k: "art", s: "done", d: 1, t: 1 },
      // Encerrado: concluído pela situação, sem as subtarefas feitas.
      { k: "contract", s: "done", d: 1, t: 3 },
    ];
    expect(newlyDoneMilestones(prev, next)).toEqual(["new-order", "art"]);
    expect(newlyDoneMilestones(null, next)).toEqual([]);
    expect(newlyDoneMilestones([], next)).toEqual([]);
  });
});

describe("aviso do marco concluído", () => {
  it("avisa uma vez pela sincronização dos marcos (fase 5d), com link para os marcos", async () => {
    const order = await placeOrder("Garrafa marco");
    await finishRequirements(order);
    // O recálculo do resumo não avisa mais (fase 5d): só a sincronização.
    await flushSummaryChanges();
    expect(await informedAudits(order)).toEqual([]);
    await syncMilestones(order.id);
    const notes = await milestoneNotes(order);
    const audits = await informedAudits(order);
    expect(audits.length).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]).toMatch(
      new RegExp(`^Pedido #${order.number}: marco \\d+\\. .+ concluído$`),
    );
    const keys = audits.map(
      (a) => (a.after as { milestone: string }).milestone,
    );
    expect(new Set(keys).size).toBe(keys.length);

    // De novo (as linhas dos marcos somem e o mesmo marco "conclui" outra
    // vez): não repete.
    for (const row of await getStore().list("order_milestones", {
      filter: { orderId: order.id },
    }))
      await getStore().remove("order_milestones", row.id);
    await syncMilestones(order.id);
    expect(await milestoneNotes(order)).toHaveLength(notes.length);
    expect(await informedAudits(order)).toHaveLength(audits.length);
  });

  it("a reconstrução não avisa", async () => {
    const order = await placeOrder("Caneca reconstrução");
    await forgetDone(order);
    // Conclui direto no banco, sem passar pelo recálculo por evento.
    await finishRequirements(order);
    const { pendingSummaryChanges } = await import("@/lib/db/summary-dirty");
    expect(pendingSummaryChanges().orders).toContain(order.id);
    await summary.rebuildOrderSummaries();
    expect(await milestoneNotes(order)).toEqual([]);
    expect(await informedAudits(order)).toEqual([]);
    // As marcas que ficaram: o resumo já está igual, nada novo concluiu.
    await flushSummaryChanges();
    expect(await milestoneNotes(order)).toEqual([]);
  });

  it("pedido do histórico em espera não avisa", async () => {
    const order = await placeOrder("Prato histórico");
    await getStore().update("orders", order.id, { held: true } as never);
    await flushSummaryChanges();
    await forgetDone(order);
    await finishRequirements(order);
    await syncMilestones(order.id);
    await flushSummaryChanges();
    expect(await milestoneNotes(order)).toEqual([]);
    expect(await informedAudits(order)).toEqual([]);
  });
});

describe("lembretes e SLA pelo marco", () => {
  it("o marco dos itens: o primeiro na ordem dos 16; sem item, o da etapa", () => {
    expect(milestoneOfItems("INSPECTION", [])).toBe("inspection");
    expect(milestoneOfItems("CUSTOMS", ["nao_existe"])).toBe("customs");
    expect(milestoneOfItems("UNKNOWN", [])).toBeNull();
  });

  it("agrupa pendências e etapas concluídas por marco, na ordem dos 16", () => {
    const rows = groupByMilestone(
      [
        { milestone: "shipment", source: "task", due: "overdue" },
        { milestone: "new-order", source: "task", due: "week" },
        { milestone: "shipment", source: "partner", due: "overdue" },
        { milestone: null, source: "task", due: "overdue" },
      ],
      [
        { milestone: "new-order", onTime: true },
        { milestone: "new-order", onTime: false },
      ],
    );
    expect(rows.map((x) => x.milestone)).toEqual([
      "new-order",
      "shipment",
      null,
    ]);
    expect(rows[0].counts.week).toBe(1);
    expect(rows[0].onTime).toEqual({ done: 1, total: 2 });
    expect(rows[1].counts).toMatchObject({ overdue: 1, partnerLate: 1 });
    expect(rows[2].counts.overdue).toBe(1);
  });
});
