import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 5c (docs/MILESTONES.md): a tela do pedido de cliente, fornecedor e
 * parceiros agrupa os itens pelos marcos (`requirements.milestoneKey`) e a
 * leitura do parceiro sai de PARTNER_READ_MILESTONES. As permissões não
 * mudam: cada papel vê exatamente os mesmos itens que via pela regra das
 * etapas (`stageVisibleTo`), em pedidos do fluxo clássico e de compra, em
 * várias alturas do fluxo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const view = await import("@/lib/order-view");
const { ORDER_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const { isOffFlowStage } = await import("@/lib/workflow/stages");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Stage = import("@/lib/db").Stage;

const ROLES = [
  "customer",
  "supplier",
  "agency",
  "broker",
  "shipping_line",
  "carrier",
  "comex",
  "logistics",
  "ocp",
  "marketing_agency",
] as const;

let admin: User;
let joao: User;
const orders: Order[] = [];

async function classicOrder(name: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: name,
    description: name,
    specification: null,
    quantity: 10,
    unit: "un",
    deadline: null,
    notes: null,
  });
  return orderFromRequest(admin, request);
}

/** Pedido de compra (raias por produto) direto pelo motor. */
async function purchaseOrder() {
  const store = getStore();
  const order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    requestedByUserId: joao.id,
    number: await store.nextNumber("order_number"),
    requestId: null,
    customerId: "cliente-joao",
    supplierId: "fornecedor-a",
    lineId: "linha-utilidades",
    flow: "supplier_request",
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal: 100,
    fobCurrency: "USD",
    sellPrice: 1000,
    sellCurrency: "BRL",
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
  } as never);
  await store.create("order_items", {
    orderId: order.id,
    productId: "prod-jarra",
    name: "Jarra",
    quantity: 100,
    unit: "un",
    unitPrice: 1,
  } as never);
  await r.assignDefaultPartners(order);
  const { createStagesForOrder } = await import("@/lib/workflow/engine");
  await createStagesForOrder((await store.get("orders", order.id))!);
  return (await store.get("orders", order.id))!;
}

/** Leva o pedido até a etapa dada (as de antes concluídas, ela em andamento). */
async function moveTo(order: Order, key: string, status = "active") {
  const store = getStore();
  const stages = (await store.list("stages", { filter: { orderId: order.id } }))
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const at = stages.findIndex((s) => s.key === key);
  for (const [i, s] of stages.entries())
    await store.update("stages", s.id, {
      status: i < at ? "done" : i === at ? (status as never) : "pending",
    });
  await store.update("orders", order.id, { status: key as never });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  orders.push(await classicOrder("Novo"));
  for (const [key, status] of [
    ["PREPARATION", "active"],
    ["PACKAGING", "active"],
    ["INSPECTION", "blocked"],
    ["SHIPPING", "active"],
    ["CUSTOMS", "active"],
    ["TRANSPORT", "active"],
    ["DELIVERED", "active"],
  ]) {
    const o = await classicOrder(`Em ${key}`);
    await moveTo(o, key, status);
    orders.push(o);
  }
  const cancelled = await classicOrder("Cancelado");
  await moveTo(cancelled, "SHIPPING");
  for (const s of await getStore().list("stages", {
    filter: { orderId: cancelled.id },
  }))
    if (s.status !== "done")
      await getStore().update("stages", s.id, { status: "cancelled" });
  orders.push(cancelled);
  for (const key of [null, "PREPARATION", "PACKAGING", "SHIPPING"]) {
    const o = await purchaseOrder();
    if (key) await moveTo(o, key);
    orders.push(o);
  }
});

/** Os itens que o papel via pela regra das etapas (cartões das etapas visíveis). */
function before(
  role: string,
  stages: Stage[],
  reqs: { id: string; stageId: string }[],
) {
  const user = { role } as never;
  return stages
    .filter((s) =>
      view.stageVisibleTo(
        user,
        s,
        reqs.filter((x) => x.stageId === s.id) as never,
      ),
    )
    .flatMap((s) => reqs.filter((x) => x.stageId === s.id));
}

describe("tela do pedido pelos marcos: os mesmos itens por papel", () => {
  it("cada papel vê exatamente os mesmos itens de antes", async () => {
    const store = getStore();
    let compared = 0;
    for (const order of orders) {
      const stages = (
        await store.list("stages", { filter: { orderId: order.id } })
      )
        .filter((s) => !isOffFlowStage(s.key))
        .sort((a, b) => a.sequence - b.sequence);
      const reqs = await store.list("requirements", {
        filter: { orderId: order.id },
      });
      expect(reqs.every((x) => !!x.milestoneKey)).toBe(true);
      for (const role of ROLES) {
        const old = before(role, stages, reqs)
          .map((x) => x.id)
          .sort();
        const now = [
          ...view
            .requirementsByMilestone({ role } as never, stages, reqs)
            .values(),
        ]
          .flat()
          .map((x) => x.r.id)
          .sort();
        expect(now, `${role} no pedido #${order.number}`).toEqual(old);
        compared += old.length;
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it("agrupa pelo marco gravado, na ordem dos 16", async () => {
    const store = getStore();
    const fresh = await store.list("orders", {
      filter: { id: orders.map((o) => o.id) },
    });
    const order = fresh.find((o) => o.status === "SHIPPING" && !o.flow)!;
    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const reqs = await store.list("requirements", {
      filter: { orderId: order.id },
    });
    const broker = view.requirementsByMilestone(
      { role: "broker" } as never,
      stages,
      reqs,
    );
    // O despachante lê o embarque (já começou) e tem o desembaraço.
    expect([...broker.keys()]).toEqual(["shipment", "customs"]);
    for (const [key, list] of broker)
      for (const { r } of list) expect(r.milestoneKey).toBe(key);
    // Antes de o embarque começar, só o desembaraço dele.
    const early = orders[0];
    const earlyBroker = view.requirementsByMilestone(
      { role: "broker" } as never,
      await store.list("stages", { filter: { orderId: early.id } }),
      await store.list("requirements", { filter: { orderId: early.id } }),
    );
    expect([...earlyBroker.keys()]).toEqual(["customs"]);
  });
});
