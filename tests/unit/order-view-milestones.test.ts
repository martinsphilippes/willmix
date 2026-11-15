import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fase 5c (docs/MILESTONES.md): a tela do pedido de cliente, fornecedor e
 * parceiros agrupa os itens pelos marcos (`requirements.milestoneKey`) e a
 * leitura do parceiro sai de PARTNER_READ_MILESTONES. Fase 5g: sem etapas; a
 * conferência com a regra antiga das etapas (`stageVisibleTo`) saiu com
 * elas. Os itens andam junto pelo grupo deles (`itemGroupsOf`).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const view = await import("@/lib/order-view");
const { ORDER_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

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
  const { createOrderRequirements } = await import("@/lib/workflow/engine");
  await createOrderRequirements((await store.get("orders", order.id))!);
  return (await store.get("orders", order.id))!;
}

/** Os grupos de itens do pedido e os marcos dele (fase 5g). */
async function viewOf(order: Order) {
  const store = getStore();
  const { milestonesOf } = await import("@/lib/services/milestones");
  const { itemGroupsOf, itemGroupId } = await import("@/lib/order-groups");
  const fresh = (await store.get("orders", order.id))!;
  const reqs = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  const states = new Map(
    (await milestonesOf(fresh)).map((v) => [v.key, v.state]),
  );
  const groups = itemGroupsOf(fresh, reqs, states);
  return {
    reqs,
    states,
    groups,
    byMilestone: (role: string) =>
      view.requirementsByMilestone(
        { role } as never,
        groups,
        reqs,
        states,
        (r) => itemGroupId(r, fresh),
      ),
  };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  orders.push(await classicOrder("Novo"));
  orders.push(await purchaseOrder());
});

describe("tela do pedido pelos marcos (fase 5g: sem etapas)", () => {
  it("todo item tem passo e marco; a Wellmix vê todos, cada parceiro só o que é dele ou já começou", async () => {
    for (const order of orders) {
      const { reqs, byMilestone } = await viewOf(order);
      expect(reqs.every((x) => !!x.milestoneKey && !!x.step)).toBe(true);
      expect(reqs.every((x) => !x.stageId)).toBe(true);
      const all = (role: string) =>
        [...byMilestone(role).values()].flat().map((x) => x.r.id);
      expect(all("admin").sort()).toEqual(reqs.map((x) => x.id).sort());
      for (const role of ROLES)
        for (const id of all(role)) {
          const r = reqs.find((x) => x.id === id)!;
          expect(r, `${role} no pedido #${order.number}`).toBeTruthy();
        }
    }
  });

  it("fase 5d: com a situação dos marcos, o cliente vê o que o marco liberou", async () => {
    const { states, byMilestone } = await viewOf(orders[0]);
    // Pedido clássico novo: a arte libera desde a criação (marco Arte sem
    // dependência).
    expect(states.get("art")).toBe("active");
    const seen = [...byMilestone("customer").values()]
      .flat()
      .map((x) => x.r.key);
    expect(seen).toContain("art");
    // O contrato aguarda: não aparece para o cliente.
    expect(states.get("contract")).toBe("waiting");
    expect(seen).not.toContain("order_signed_supplier");
  });

  it("agrupa pelo marco gravado, na ordem dos 16; o despachante lê o embarque depois que ele começa", async () => {
    const order = await classicOrder("Embarque");
    const { completeMilestonesBefore } = await import("./helpers/milestones");
    const early = await viewOf(order);
    expect([...early.byMilestone("broker").keys()]).toEqual(["customs"]);
    await completeMilestonesBefore(order.id, "shipment");
    const later = await viewOf(order);
    expect(later.states.get("shipment")).toBe("active");
    const broker = later.byMilestone("broker");
    expect([...broker.keys()]).toEqual(["shipment", "customs"]);
    for (const [key, list] of broker)
      for (const { r } of list) expect(r.milestoneKey).toBe(key);
  });
});
