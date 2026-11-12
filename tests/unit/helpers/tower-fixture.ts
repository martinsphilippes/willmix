/*
 * Cenário da Control Tower para os testes do resumo e dos indicadores
 * (docs/RESUMOS.md): pedidos do fluxo clássico, um pedido de compra vencido,
 * um com embarque, produção, recebimento, arte, multa, pagamento e item
 * recusado, um encerrado e um cancelado no mês.
 *
 * Importe depois de `withTempStore()`.
 */
import type { Order, User } from "@/lib/db";

export const DAY_MS = 86_400_000;

export async function towerScenario(now: Date) {
  const { getStore } = await import("@/lib/db");
  const { seedDemo } = await import("@/lib/seed");
  const { orderFromRequest } = await import("./order");
  const r = await import("@/lib/services/requests");
  const day = (offset: number) =>
    new Date(now.getTime() + offset * DAY_MS).toISOString();
  const { users } = await seedDemo();
  const admin = users.find((u) => u.email === "admin@wellmix.com") as User;
  const joao = users.find((u) => u.email === "joao@lojista.com") as User;
  async function placeOrder(name: string, sellPrice = 1000) {
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: name,
      description: "Indicadores",
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

  const a = await placeOrder("Jarra A");
  const b = await placeOrder("Copo B", 2500);
  const c = await placeOrder("Prato C");
  const store = getStore();
  await enrich(b);
  await store.update("orders", a.id, { flow: "supplier_request" });
  const [stage] = await store.list("stages", {
    filter: { orderId: a.id, status: ["active", "blocked"] },
    limit: 1,
  });
  if (stage) await store.update("stages", stage.id, { dueAt: day(-3) });
  const closed = await placeOrder("Tigela D");
  await store.update("orders", closed.id, {
    status: "CLOSED",
    closedAt: now.toISOString(),
  });
  const cancelled = await placeOrder("Pote E");
  await store.update("orders", cancelled.id, {
    status: "CANCELLED",
    cancelledAt: now.toISOString(),
    cancelStageKey: "PREPARATION",
  });
  return {
    admin,
    joao,
    placeOrder,
    day,
    orders: { a, b, c, closed, cancelled },
  };
}
