import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Resumo por pedido (docs/RESUMOS.md). A Control Tower lida do resumo tem de
 * ser igual à lida das tabelas: quadros (com e sem Finanças), visões gerais,
 * exceções e totais. Depois de gravações, o resumo é recalculado por evento
 * e continua igual ao caminho antigo. Reconstruir de novo sem mudança não
 * grava nada; resumo de outro formato volta ao caminho antigo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { loadTowerBoard } = await import("@/lib/services/tower-board");
const { loadControlTower, loadTowerTotals } =
  await import("@/lib/services/control-tower");
const summary = await import("@/lib/services/order-summary");
const { loadFinance } = await import("@/lib/services/finance");
const { listPayables } = await import("@/lib/services/supplier-terms");
const { loadCashflow } = await import("@/lib/services/cashflow");
const { loadOwnerPanel } = await import("@/lib/services/owner-panel");
const { pipelineFor } = await import("@/lib/services/pipeline");
const { customerAccounts, customerDetail } =
  await import("@/lib/services/customer-accounts");
const { pendingSummaryChanges } = await import("@/lib/db/summary-dirty");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;
const NOW = new Date();
const day = (offset: number) =>
  new Date(NOW.getTime() + offset * 86_400_000).toISOString();

async function placeOrder(name: string, sellPrice = 1000) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: "Resumo do pedido",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  return orderFromRequest(admin, request, {
    downPaymentAmount: 300,
    sellPrice,
  });
}

/** Tudo o que a Control Tower mostra (o "agora" fixo nos quadros). */
async function tower() {
  const [withMoney, withoutMoney, data, totals] = await Promise.all([
    loadTowerBoard({ finance: true, now: NOW }),
    loadTowerBoard({ finance: false, now: NOW }),
    loadControlTower(),
    loadTowerTotals(),
  ]);
  // As outras telas que leem o resumo (etapa 1 e 2 de docs/RESUMOS.md).
  const supplier = (await getStore().list("users")).find(
    (u) => u.email === "supplier.a@china.com",
  )!;
  const [
    finance,
    financeEstimate,
    payables,
    supplierPayables,
    cashflow,
    owner,
    pipeline,
    supplierPipeline,
    customers,
    suppliers,
    joaoDetail,
  ] = await Promise.all([
    loadFinance({ estimate: false }),
    loadFinance(),
    listPayables(),
    listPayables({ supplierId: "fornecedor-a" }),
    loadCashflow(12, NOW),
    loadOwnerPanel(NOW),
    pipelineFor(admin),
    pipelineFor(supplier),
    customerAccounts({ status: "all" }),
    customerAccounts({ status: "all" }, "supplier"),
    customerDetail("cliente-joao"),
  ]);
  return {
    withMoney,
    withoutMoney,
    data,
    totals,
    finance,
    financeEstimate,
    payables,
    supplierPayables,
    cashflow,
    owner,
    pipeline,
    supplierPipeline,
    customers,
    suppliers,
    joaoDetail,
  };
}

/** A mesma tela pelo caminho antigo (sem o marcador da reconstrução). */
async function towerDirect() {
  const store = getStore();
  const [marker] = await store.list("settings", {
    filter: { key: summary.SUMMARY_SETTING_KEY },
  });
  if (marker) await store.remove("settings", marker.id);
  try {
    return await tower();
  } finally {
    if (marker)
      await store.create("settings", {
        id: marker.id,
        key: marker.key,
        value: marker.value,
      });
  }
}

/** Pedido com o que os quadros "em paralelo" e os problemas leem. */
async function enrich(order: Order) {
  const store = getStore();
  const create = (table: string, row: Record<string, unknown>) =>
    store.create(table as never, row as never);
  await create("import_steps", {
    orderId: order.id,
    key: "numerario",
    status: "submitted",
    value: null,
    amount: 1000,
    currency: "BRL",
    documentId: null,
    submittedByUserId: null,
    submittedAt: day(-1),
    validatedByUserId: null,
    validatedAt: null,
    rejectReason: null,
  });
  await create("import_steps", {
    orderId: order.id,
    key: "bl",
    status: "rejected",
    value: "BL-1",
    amount: null,
    currency: null,
    documentId: null,
    submittedByUserId: null,
    submittedAt: day(-2),
    validatedByUserId: null,
    validatedAt: null,
    rejectReason: "ilegível",
  });
  await create("production_tracks", {
    orderId: order.id,
    mode: null,
    factoryName: null,
    factoryAddress: null,
    productionStartAt: day(-20),
    etd: day(-1),
    etdOriginal: day(-5),
    etdHistory: [],
    followups: [],
    inspectionScheduledAt: null,
    inspectionNote: null,
    updatedByUserId: null,
  });
  await create("receivings", {
    orderId: order.id,
    sealNumber: "S-1",
    sealIntact: "yes",
    sealPhotoDocumentId: null,
    containerPhotoDocumentIds: [],
    checklist: [],
    items: [
      {
        orderItemId: "x",
        expected: 10,
        received: 9,
        damaged: 0,
        note: null,
      },
    ],
    ricNumber: null,
    ricDocumentId: null,
    containerReturnedAt: null,
    containerReturnDocumentId: null,
    closedAt: null,
    closedByUserId: null,
    closingNote: null,
    updatedByUserId: null,
  });
  await create("art_issues", {
    orderId: order.id,
    orderItemId: null,
    status: "open",
    reason: "cor",
  });
  await create("penalties", {
    orderId: order.id,
    reason: "atraso",
    amount: 100,
    currency: "USD",
    status: "open",
  });
  await create("payments", {
    orderId: order.id,
    direction: "supplier_out",
    amount: 500,
    currency: "USD",
    status: "pending",
    note: null,
  });
  const [req] = await store.list("requirements", {
    filter: { orderId: order.id },
    limit: 1,
  });
  if (req) await store.update("requirements", req.id, { status: "rejected" });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  const a = await placeOrder("Jarra A");
  const b = await placeOrder("Copo B", 2500);
  await placeOrder("Prato C");
  const store = getStore();
  await enrich(b);
  // Pedido de compra (fluxo do portal), um vencido e outros encerrados/cancelados.
  await store.update("orders", a.id, { flow: "supplier_request" });
  const [stage] = await store.list("stages", {
    filter: { orderId: a.id, status: ["active", "blocked"] },
    limit: 1,
  });
  if (stage) await store.update("stages", stage.id, { dueAt: day(-3) });
  const closed = await placeOrder("Tigela D");
  await store.update("orders", closed.id, {
    status: "CLOSED",
    closedAt: NOW.toISOString(),
  });
  const cancelled = await placeOrder("Pote E");
  await store.update("orders", cancelled.id, {
    status: "CANCELLED",
    cancelledAt: NOW.toISOString(),
    cancelStageKey: "PREPARATION",
  });
});

describe("resumo por pedido", () => {
  it("sem reconstrução, a Control Tower usa o caminho antigo; as gravações não custam nada", async () => {
    expect(await summary.readOrderSummaries()).toBeNull();
    expect(
      await summary.applySummaryChanges({ orders: ["x"], parties: [] }),
    ).toBe(0);
  });

  it("reconstruída, a Control Tower lida do resumo é igual à lida das tabelas", async () => {
    const before = await towerDirect();
    const marker = await summary.rebuildOrderSummaries();
    const orders = await getStore().list("orders");
    expect(marker.orders).toBe(orders.length);
    expect(marker.written).toBe(orders.length);
    const view = await summary.readOrderSummaries();
    expect(view?.facts).toHaveLength(orders.length);
    const after = await tower();
    expect(after).toEqual(before);
    // Os quadros de verdade aparecem (o teste não compara telas vazias).
    const counts = Object.fromEntries(
      after.withMoney.cards.map((c) => [c.key, c.count]),
    );
    expect(counts.parProduction).toBeGreaterThan(0);
    expect(counts.parReceivingDiff).toBeGreaterThan(0);
    expect(counts.probPenalty).toBeGreaterThan(0);
    expect(counts.ordClosedMonth).toBeGreaterThan(0);
    expect(counts.ordCancelledMonth).toBeGreaterThan(0);
    expect(after.totals.sold).toBeGreaterThan(0);
  });

  it("com o resumo, as telas não leem pagamentos, etapas e requisitos por pedido", async () => {
    const store = getStore();
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const original = store.list.bind(store);
    const spy = vi.spyOn(store, "list").mockImplementation(((
      table: string,
      options?: { filter?: object },
    ) => {
      calls.push([table, options?.filter as Record<string, unknown>]);
      return original(table as never, options as never);
    }) as typeof store.list);
    try {
      const shown = await tower();
      expect(shown.finance.rows.length).toBeGreaterThan(0);
      expect(shown.pipeline.length).toBeGreaterThan(0);
      expect(shown.payables.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
    const read = (
      table: string,
      test: (f?: Record<string, unknown>) => boolean,
    ) => calls.filter(([t, f]) => t === table && test(f));
    expect(read("order_summaries", () => true).length).toBeGreaterThan(0);
    // Nada por pedido nem a tabela inteira de pagamentos, etapas e requisitos.
    expect(read("payments", (f) => !f || "orderId" in f)).toEqual([]);
    expect(read("stages", (f) => !f || "orderId" in f || "key" in f)).toEqual(
      [],
    );
    expect(read("requirements", (f) => !f || "orderId" in f)).toEqual([]);
    expect(read("import_steps", () => true)).toEqual([]);
  });

  it("reconstruir de novo sem mudança não grava nada", async () => {
    const again = await summary.rebuildOrderSummaries();
    expect(again.written).toBe(0);
    expect(again.removed).toBe(0);
  });

  it("gravações marcam o pedido e o resumo é recalculado antes da leitura", async () => {
    const store = getStore();
    const [order] = await store.list("orders", {
      filter: { status: "PREPARATION" },
      limit: 1,
    });
    const target =
      order ??
      (await store.list("orders")).find(
        (o) => o.status !== "CLOSED" && o.status !== "CANCELLED",
      )!;
    // Etapa vencida, pagamento do cliente, item apagado e cliente renomeado.
    const [stage] = await store.list("stages", {
      filter: { orderId: target.id, status: ["active", "blocked"] },
      limit: 1,
    });
    await store.update("stages", stage.id, {
      dueAt: day(-10),
      status: "blocked",
    });
    expect(pendingSummaryChanges().orders).toContain(target.id);
    await store.create("payments", {
      orderId: target.id,
      direction: "customer_in",
      amount: 200,
      currency: "BRL",
      status: "confirmed",
      note: null,
    } as never);
    const [item] = await store.list("order_items", {
      filter: { orderId: target.id },
      limit: 1,
    });
    if (item) await store.remove("order_items", item.id);
    await store.update("parties", "cliente-joao", { name: "Loja do João 2" });
    expect(pendingSummaryChanges().parties).toContain("cliente-joao");
    // Pedido novo e um apagado.
    const fresh = await placeOrder("Garrafa F");
    const gone = await placeOrder("Caneca G");
    await store.remove("orders", gone.id);

    const after = await tower();
    expect(pendingSummaryChanges()).toEqual({
      orders: [],
      parties: [],
      kpi: false,
      sla: false,
    });
    const direct = await towerDirect();
    expect(after).toEqual(direct);
    const ids = (await summary.readOrderSummaries())!.facts.map(
      (f) => f.order.id,
    );
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(gone.id);
    expect(
      after.data.buckets.active.find((x) => x.id === target.id)?.customer,
    ).toBe("Loja do João 2");
  });

  it("resumo de outro formato: volta ao caminho antigo até reconstruir", async () => {
    const store = getStore();
    const [row] = await store.list("order_summaries", { limit: 1 });
    await store.update("order_summaries", row.id, { version: 0 });
    expect(await summary.readOrderSummaries()).toBeNull();
    await summary.rebuildOrderSummaries();
    expect(await summary.readOrderSummaries()).not.toBeNull();
  });

  it("parcela: vencida, a vencer e agendada mudam com o dia; as outras não", () => {
    const at = (
      status: "scheduled" | "paid" | "waiting",
      dueDate: string | null,
    ) => summary.installmentStatusOn({ status, dueDate }, "2026-11-12");
    expect(at("scheduled", "2026-11-01")).toBe("overdue");
    expect(at("scheduled", "2026-11-15")).toBe("due_soon");
    expect(at("scheduled", "2026-12-30")).toBe("scheduled");
    expect(at("paid", "2026-11-01")).toBe("paid");
    expect(at("waiting", null)).toBe("waiting");
  });
});

describe("comparação do resumo", () => {
  it("a ordem das chaves (jsonb reordena) não conta como mudança", () => {
    expect(
      summary.stableJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } }),
    ).toBe(
      summary.stableJson({ a: { c: null, d: [2, { x: 2, y: 1 }] }, b: 1 }),
    );
    expect(summary.stableJson({ a: 1 })).not.toBe(summary.stableJson({ a: 2 }));
  });
});
