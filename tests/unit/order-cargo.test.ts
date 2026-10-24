import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * "Carga e entrega" do transportador: mercadoria, caixas/CBM/peso da ficha de
 * compra (como na cotação de frete), embarque e chegada, liberação aduaneira
 * e o endereço do cliente. Só quem pode abrir o pedido.
 */
withTempStore();

const { getStore, ORDER_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createStagesForOrder } = await import("@/lib/workflow/engine");
const { cargoViewForOrder } = await import("@/lib/services/order-cargo");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let carrier: User;
let otherCarrierUser: User;
let supplier: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  carrier = users.find((u) => u.email === "transportadora@rodo.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  const store = getStore();
  const other = await store.create("parties", {
    type: "carrier",
    name: "Outra Transportadora",
    active: true,
  } as never);
  otherCarrierUser = (await store.create("users", {
    email: "outra@rodo.com",
    name: "Outra",
    role: "carrier",
    partyId: other.id,
    active: true,
  } as never)) as User;
});

describe("carga e entrega do transportador", () => {
  it("carga da ficha, datas do embarque, liberação e endereço do cliente", async () => {
    const store = getStore();
    const order = (await store.create("orders", {
      ...ORDER_EXTRA_DEFAULTS,
      number: 9201,
      // Sem solicitação: a quantidade vem do item do pedido.
      requestId: "req-x",
      customerId: "cliente-joao",
      supplierId: "fornecedor-a",
      lineId: null,
      status: "ORDER_CREATED",
      currentStageId: null,
      fobTotal: 1000,
      fobCurrency: "USD",
      sellPrice: null,
      sellCurrency: null,
      erpSyncStatus: "pending",
      erpNumber: null,
      agencyId: null,
      brokerId: "despachante",
      shippingLineId: "armador",
      carrierId: "transportador",
      closedAt: null,
      notes: null,
    } as never)) as Order;
    await createStagesForOrder(order);
    await store.create("order_items", {
      orderId: order.id,
      productId: null,
      name: "Jarra de vidro",
      quantity: 2400,
      unit: "pcs",
      unitPrice: 1,
      currency: "USD",
    } as never);
    await store.create("purchase_sheets", {
      orderId: order.id,
      quoteId: null,
      supplierId: "fornecedor-a",
      masterCartonQty: 24,
      cbmPerCarton: 0.062,
      grossWeightPcKg: 0.45,
      lots: null,
    } as never);
    await store.update("parties", "cliente-joao", {
      address: "Rua das Lojas, 120",
      city: "Joinville - SC",
      phone: "(47) 99999-0000",
      contactName: "João",
    });
    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const reqs = await store.list("requirements", {
      filter: { orderId: order.id },
    });
    const done = async (stageKey: string, key: string, value: string) => {
      const stage = stages.find((s) => s.key === stageKey)!;
      const r = reqs.find((x) => x.stageId === stage.id && x.key === key)!;
      await store.update("requirements", r.id, {
        status: "done",
        value,
        submittedAt: "2026-10-20T15:00:00.000Z",
        submittedByUserId: carrier.id,
      });
    };
    await done("SHIPPING", "ship_date", "2026-10-10");
    await done("SHIPPING", "eta", "2026-10-28");
    await done("SHIPPING", "vessel", "MSC AURORA");
    await done("CUSTOMS", "actual_costs", "15000");

    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    const load = async (user: User) =>
      cargoViewForOrder(user, order, {
        items,
        stages,
        requirements: await store.list("requirements", {
          filter: { orderId: order.id },
        }),
        parties: await store.list("parties"),
      });
    const view = await load(carrier);
    expect(view.items).toEqual([
      { name: "Jarra de vidro", quantity: 2400, unit: "pcs" },
    ]);
    // 2400 peças / 24 por caixa = 100 caixas; 100 × 0,062 m³; 2400 × 0,45 kg.
    expect(view.cartons).toBe(100);
    expect(view.totalCbm).toBe(6.2);
    expect(view.grossWeightKg).toBe(1080);
    expect(view).toMatchObject({
      shipDate: "2026-10-10",
      eta: "2026-10-28",
      vessel: "MSC AURORA",
      releasedAt: null,
      deliverTo: {
        name: "Loja do João Ltda",
        address: "Rua das Lojas, 120",
        city: "Joinville - SC",
        phone: "(47) 99999-0000",
        contactName: "João",
      },
    });
    // Nada de valores: os custos do despachante não entram na carga.
    expect(JSON.stringify(view)).not.toContain("15000");
    // Liberação confirmada: a data.
    await done("CUSTOMS", "release", "confirmed");
    expect((await load(carrier)).releasedAt).toBe("2026-10-20T15:00:00.000Z");
    // Só quem pode abrir o pedido.
    await expect(load(otherCarrierUser)).rejects.toThrow();
    // O fornecedor pode abrir o pedido, mas a tela não lhe mostra a carga; o serviço não impede.
    expect((await load(supplier)).cartons).toBe(100);
  });
});
