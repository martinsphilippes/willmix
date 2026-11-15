import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 4d (docs/MILESTONES.md, "Sankhya, regras e painéis"): eventos de marco
 * nas regras de processo (uma vez por pedido, só no recálculo por evento),
 * editor de regras com os marcos antes das etapas antigas, marco da TOP do
 * Sankhya, coluna "Marco" na exportação e visões da Control Tower pelos
 * marcos com o mesmo total.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const summary = await import("@/lib/services/order-summary");
const { flushSummaryChanges } = await import("@/lib/db/summary-dirty");
const { syncMilestones } = await import("@/lib/services/order-milestones");
const rules = await import("@/lib/process-rules");
const labels = await import("@/lib/process-event-labels");
const { saveProcessRules, getProcessRules } =
  await import("@/lib/services/process-engine");
const { MILESTONE_EVENT_ACTION, milestoneTransitionEvents } =
  await import("@/lib/services/milestone-events");
const ms = await import("@/lib/milestones");
const { topMilestone, TOP_STAGES } =
  await import("@/lib/integrations/sankhya-mapping");
const { exportMilestoneCell, orderMilestonesOf } =
  await import("@/lib/services/request-export");
const tower = await import("@/lib/tower-milestones");
const { buildControlTower, buildTowerTotals } =
  await import("@/lib/services/control-tower");
const { translator } = await import("@/i18n");
const { dictionaries } = await import("@/i18n/dictionaries");

type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type CompactMilestone = import("@/lib/milestones").CompactMilestone;
type ProcessRule = import("@/lib/process-rules").ProcessRule;
type BoardOrder = import("@/lib/services/tower-board").BoardOrder;

const t = translator("pt");
let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  // Uma regra ativa em cada evento de marco (Sankhya desligado: "simulado").
  const milestoneRules: ProcessRule[] = rules.PROCESS_EVENTS.filter(
    rules.isMilestoneEvent,
  ).map((event) => ({
    event,
    active: true,
    stock: "none",
    sankhya: "advance",
    top: 1101,
    note: null,
  }));
  await saveProcessRules(admin, milestoneRules);
  await summary.rebuildOrderSummaries();
});

async function placeOrder(name: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: "Evento de marco",
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

/** O resumo guardado volta a dizer que os marcos estavam noutra situação. */
async function rewind(order: Order, s: CompactMilestone["s"]) {
  const store = getStore();
  const row = (await store.get("order_summaries", order.id))!;
  const facts = row.facts as { m?: CompactMilestone[] };
  await store.update("order_summaries", order.id, {
    facts: { ...facts, m: facts.m!.map((x) => ({ ...x, s, d: 0 })) },
  });
}

async function finishRequirements(order: Order) {
  const store = getStore();
  for (const req of await store.list("requirements", {
    filter: { orderId: order.id },
  }))
    await store.update("requirements", req.id, { status: "done" });
}

/** Uma gravação qualquer no pedido (marca o resumo para o recálculo). */
async function touch(order: Order) {
  const [req] = await getStore().list("requirements", {
    filter: { orderId: order.id },
    limit: 1,
  });
  await getStore().update("requirements", req.id, { note: "toque" });
}

const milestoneLog = async (order: Order) =>
  (
    await getStore().list("process_events", { filter: { orderId: order.id } })
  ).filter((e) => rules.isMilestoneEvent(e.event));

const firedAudits = async (order: Order) =>
  getStore().list("audit_log", {
    filter: {
      entity: "order",
      entityId: order.id,
      action: MILESTONE_EVENT_ACTION,
    },
  });

describe("eventos de marco nas regras de processo", () => {
  it("começa: o marco que passa a em andamento", () => {
    const prev: CompactMilestone[] = [
      { k: "new-order", s: "waiting", d: 0, t: 2 },
      { k: "art", s: "active", d: 0, t: 1 },
      { k: "contract", s: "done", d: 3, t: 3 },
    ];
    const next: CompactMilestone[] = [
      { k: "new-order", s: "active", d: 0, t: 2 },
      { k: "art", s: "active", d: 1, t: 1 },
      { k: "contract", s: "active", d: 2, t: 3 },
    ];
    expect(ms.newlyStartedMilestones(prev, next)).toEqual([
      "new-order",
      "contract",
    ]);
    expect(ms.newlyStartedMilestones(null, next)).toEqual([]);
    expect(milestoneTransitionEvents(["art"], ["new-order"])).toEqual([
      "milestone:art:start",
      "milestone:new-order:done",
    ]);
  });

  it("conclui e começa disparam uma vez por pedido, pela sincronização dos marcos (fase 5d)", async () => {
    const order = await placeOrder("Garrafa regra");
    // Começa: os marcos que nascem liberados disparam na criação do pedido.
    const started = (await milestoneLog(order)).filter((e) =>
      e.event.endsWith(":start"),
    );
    expect(started.map((e) => e.event)).toContain("milestone:new-order:start");
    expect(started.every((e) => e.status === "simulated")).toBe(true);
    // Nenhum evento de etapa antiga (o motor não dispara mais `stage:*`).
    const all = await getStore().list("process_events", {
      filter: { orderId: order.id },
    });
    expect(all.some((e) => rules.isStageEvent(e.event))).toBe(false);

    // Conclui: tudo feito; a sincronização (o motor) dispara.
    await finishRequirements(order);
    await syncMilestones(order.id);
    const done = (await milestoneLog(order)).filter((e) =>
      e.event.endsWith(":done"),
    );
    expect(done.map((e) => e.event)).toContain("milestone:new-order:done");
    const log = await milestoneLog(order);
    const events = log.map((e) => e.event);
    expect(new Set(events).size).toBe(events.length);
    const audits = await firedAudits(order);
    expect(
      audits.map((a) => (a.after as { event: string }).event).sort(),
    ).toEqual([...events].sort());

    // De novo (as linhas dos marcos somem e voltam): o que já disparou não
    // repete.
    for (const row of await getStore().list("order_milestones", {
      filter: { orderId: order.id },
    }))
      await getStore().remove("order_milestones", row.id);
    await syncMilestones(order.id);
    await touch(order);
    await flushSummaryChanges();
    const again = (await milestoneLog(order)).map((e) => e.event);
    expect(new Set(again).size).toBe(again.length);
    expect(again.sort()).toEqual([...events].sort());
    expect(await firedAudits(order)).toHaveLength(again.length);
  });

  it("a reconstrução e o recálculo do resumo não disparam", async () => {
    const order = await placeOrder("Caneca regra");
    const before = (await milestoneLog(order)).length;
    await rewind(order, "waiting");
    await finishRequirements(order);
    await summary.rebuildOrderSummaries();
    await touch(order);
    await flushSummaryChanges();
    expect(await milestoneLog(order)).toHaveLength(before);
    expect(await firedAudits(order)).toHaveLength(before);
  });

  it("pedido do histórico em espera não dispara", async () => {
    const order = await placeOrder("Prato regra");
    const before = (await milestoneLog(order)).length;
    await getStore().update("orders", order.id, { held: true } as never);
    await finishRequirements(order);
    await syncMilestones(order.id);
    expect(await milestoneLog(order)).toHaveLength(before);
  });

  it("sem regra ativa no evento: nada é disparado nem auditado", async () => {
    await saveProcessRules(admin, []);
    const order = await placeOrder("Copo sem regra");
    await finishRequirements(order);
    await syncMilestones(order.id);
    await flushSummaryChanges();
    expect(await milestoneLog(order)).toEqual([]);
    expect(await firedAudits(order)).toEqual([]);
  });
});

describe("editor de regras: marcos antes das etapas antigas", () => {
  it("os 16 marcos por bloco, começa e conclui, antes das etapas", () => {
    const groups = rules.PROCESS_EVENT_GROUPS;
    const firstMilestone = groups.findIndex((g) => g.kind === "milestone");
    const stage = groups.findIndex((g) => g.kind === "stage");
    expect(firstMilestone).toBeGreaterThan(-1);
    expect(firstMilestone).toBeLessThan(stage);
    expect(
      groups.filter((g) => g.kind === "milestone").map((g) => g.block),
    ).toEqual(["order", "production", "delivery"]);
    const milestoneEvents = rules.PROCESS_EVENTS.filter(rules.isMilestoneEvent);
    expect(milestoneEvents).toHaveLength(32);
    for (const key of ms.MILESTONE_KEYS) {
      expect(milestoneEvents).toContain(`milestone:${key}:start`);
      expect(milestoneEvents).toContain(`milestone:${key}:done`);
    }
    // As etapas antigas continuam no editor (as regras gravadas valem).
    expect(rules.PROCESS_EVENTS).toContain("stage:INSPECTION:done");
    expect(rules.PROCESS_EVENTS).toContain("order:signed");
    expect(new Set(rules.PROCESS_EVENTS).size).toBe(
      rules.PROCESS_EVENTS.length,
    );
  });

  it("regra gravada numa etapa antiga continua valendo", async () => {
    const stored: ProcessRule = {
      event: "stage:SHIPPING:start",
      active: true,
      stock: "exit",
      sankhya: "none",
      top: null,
      note: "regra antiga",
    };
    await saveProcessRules(admin, [stored]);
    const merged = await getProcessRules();
    expect(merged.find((x) => x.event === stored.event)).toMatchObject(stored);
    expect(merged.map((x) => x.event)).toEqual(rules.PROCESS_EVENTS);
  });

  it("rótulos: 'N. Marco — começa/conclui' e '(etapa antiga)'", () => {
    expect(labels.eventLabel(t, "milestone:inspection:done")).toBe(
      "8. Inspeção — conclui",
    );
    expect(labels.eventLabel(t, "milestone:new-order:start")).toBe(
      "1. Pedido novo — começa",
    );
    expect(labels.eventLabel(t, "stage:SHIPPING:start")).toMatch(
      /\(etapa antiga\)$/,
    );
    const order = rules.PROCESS_EVENT_GROUPS.find(
      (g) => g.kind === "milestone",
    )!;
    expect(labels.groupLabel(t, order).title).toBe("Marcos · Pedido");
    expect(labels.groupAtEvent("milestone:new-order:start")).toBe(order);
    expect(labels.groupAtEvent("milestone:new-order:done")).toBeUndefined();
  });
});

describe("Sankhya: marco de cada TOP", () => {
  it("TOP → etapa → marco", () => {
    expect(topMilestone(1101)).toBe("new-order");
    expect(topMilestone(1104)).toBe("down-payment");
    expect(topMilestone(1102)).toBe("contract");
    expect(topMilestone(1105)).toBe("inspection");
    expect(topMilestone(1107)).toBe("customs");
    expect(topMilestone(1201)).toBe("invoice-transport");
    expect(topMilestone(1403)).toBe("delivery");
    expect(topMilestone(9999)).toBeNull();
    for (const top of Object.keys(TOP_STAGES))
      expect(topMilestone(Number(top))).not.toBeNull();
  });
});

describe("exportação das solicitações: coluna Marco", () => {
  it("o cabeçalho ganha Marco no fim e mantém a Etapa do pedido", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const cols = dictionaries[locale]["reqList.csv.header"].split(";");
      expect(cols).toHaveLength(14);
    }
    const pt = dictionaries.pt["reqList.csv.header"].split(";");
    expect(pt[12]).toBe("Etapa do pedido");
    expect(pt[13]).toBe("Marco");
  });

  it("a célula: pelo resumo, senão pela situação; cancelado pelo nome", async () => {
    expect(exportMilestoneCell(t, "INSPECTION")).toBe("8. Inspeção");
    expect(
      exportMilestoneCell(t, "PREPARATION", [
        { k: "new-order", s: "done", d: 1, t: 1 },
        { k: "art", s: "active", d: 0, t: 1 },
      ]),
    ).toBe("4. Arte");
    expect(exportMilestoneCell(t, "CANCELLED")).toBe(t("stage.CANCELLED"));
    const order = await placeOrder("Exportação marco");
    const m = await orderMilestonesOf([order.id]);
    expect(m.get(order.id)?.length).toBe(16);
  });
});

describe("Overview dos blocos: selo pelo marco", () => {
  it("o marco atual pelo resumo; sem ele, pela situação", async () => {
    const { entitiesFromFlows } = await import("@/lib/services/flow-kpis");
    const f = {
      n: 7,
      st: "PREPARATION",
      sup: null,
      s: { "order/art": null },
      p: [0, 0, 0],
      o: 0,
      d: [null, null, null],
      b: [null, null, null],
    };
    const [withM] = entitiesFromFlows(
      [
        {
          id: "x",
          f,
          m: [
            { k: "new-order", s: "done", d: 1, t: 1 },
            { k: "art", s: "active", d: 0, t: 1 },
          ],
        },
      ],
      "order",
      new Date(),
    );
    expect(withM.milestone).toBe("art");
    expect(withM.statusKey).toBe("stage.PREPARATION");
    const [plain] = entitiesFromFlows([{ id: "y", f }], "order", new Date());
    expect(plain.milestone).toBe("new-order");
  });
});

describe("Control Tower pelos marcos", () => {
  it("as visões gerais cobrem os 16 marcos, cada um uma vez", () => {
    const all = tower.TOWER_MILESTONE_BUCKETS.flatMap(
      (b) => tower.TOWER_BUCKET_MILESTONES[b],
    );
    expect([...all].sort()).toEqual([...ms.MILESTONE_KEYS].sort());
    expect(tower.milestoneRange(["new-order", "art"])).toBe("1–4");
    expect(tower.milestoneRange(["customs"])).toBe("14");
  });

  it("re-agrupa pelo marco com o mesmo total", () => {
    const order = (n: number, status: Order["status"]): BoardOrder =>
      ({
        id: `o${n}`,
        number: n,
        status,
        flow: "supplier_request",
        customerId: "c",
        supplierId: "s",
        closedAt: null,
        cancelledAt: null,
        cancelStageKey: null,
        erpSyncStatus: null,
        cancelRequestStatus: null,
      }) as unknown as BoardOrder;
    const orders = [
      order(1, "PREPARATION"),
      order(2, "PACKAGING"),
      order(3, "INSPECTION"),
      order(4, "SHIPPING"),
      order(5, "CUSTOMS"),
      order(6, "TRANSPORT"),
      order(7, "DELIVERED"),
      order(8, "CLOSED"),
      order(9, "CANCELLED"),
      // Pelo resumo: a etapa é Preparação, o marco atual é Booking (11).
      order(10, "PREPARATION"),
    ];
    const m10: CompactMilestone[] = ms.MILESTONE_KEYS.map((k) => ({
      k,
      s:
        ms.milestoneNumber(k) < 11
          ? ("done" as const)
          : k === "booking"
            ? ("active" as const)
            : ("waiting" as const),
      d: 0,
      t: 1,
    }));
    const data = buildControlTower({
      now: Date.now(),
      orders,
      partyName: () => "Cliente",
      productOf: () => "Produto",
      responsibleOf: () => null,
      milestonesOf: (id) => (id === "o10" ? m10 : undefined),
      requests: [],
      penalties: [],
      rejected: [],
      products: [],
      certifications: [],
      reviews: [],
    });
    const b = data.buckets;
    const ids = (rows: { id: string }[]) => rows.map((x) => x.id);
    expect(ids(b.preparation)).toEqual(["o1", "o2"]);
    expect(ids(b.inspection)).toEqual(["o3"]);
    expect(ids(b.shipping)).toEqual(["o4", "o10"]);
    expect(ids(b.customs)).toEqual(["o5"]);
    expect(ids(b.transport)).toEqual(["o6", "o7"]);
    const sum =
      b.preparation.length +
      b.inspection.length +
      b.shipping.length +
      b.customs.length +
      b.transport.length;
    expect(sum).toBe(b.active.length);
    const counts = tower.countByMilestone(b.active.map((x) => x.milestone));
    expect(Object.values(counts).reduce((n, c) => n + c, 0)).toBe(
      b.active.length,
    );
    expect(counts.booking).toBe(1);
    expect(counts.none).toBe(0);
  });

  it("faixa da operação: as mesmas contas das etapas, pelos marcos", () => {
    const row = (status: Order["status"]) => ({
      order: { id: status, status },
      fob: 0,
      sell: 10,
      sellCurrency: "BRL",
    });
    const rows = (
      [
        "ORDER_CREATED",
        "PREPARATION",
        "SUPPLIER_PAYMENT",
        "PACKAGING",
        "INSPECTION",
        "SHIPPING",
        "CUSTOMS",
        "TRANSPORT",
        "DELIVERED",
        "CLOSED",
        "CANCELLED",
      ] as Order["status"][]
    ).map(row);
    const totals = buildTowerTotals(
      rows as never,
      {
        currency: "BRL",
        sell: 0,
        received: 0,
        receivable: 0,
        paidByCurrency: {},
        payableByCurrency: {},
      } as never,
      [],
      {
        containers: { total: 0, open: 0, avgOccupancyPercent: null },
        commercial: [],
      },
    );
    expect(
      Object.fromEntries(totals.pipeline.map((p) => [p.key, p.count])),
    ).toEqual({
      production: 4,
      ready: 1,
      shipped: 1,
      customs: 1,
      transport: 1,
      delivered: 2,
    });
  });
});
