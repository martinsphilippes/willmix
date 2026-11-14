import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Venda (docs/SALES_ORDERS.md; dono, 14/11/2026): vendas registra a decisão
 * do cliente na oferta (V3); "fechou" abre a ordem de venda (V7), que ao ser
 * confirmada reserva o que há no Brasil (o resto na chegada), fica "a lançar"
 * no Sankhya sem a TOP de venda e agenda a entrega com data e janela (V8).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const c = await import("@/lib/services/containers");
const so = await import("@/lib/services/sales-orders");
type User = import("@/lib/db").User;

let admin: User;
let supplier: User;
let customerId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  customerId = users.find((u) => u.email === "joao@lojista.com")!.partyId!;
  const container = await c.createContainer(admin, {
    code: "SO-1",
    type: "40HC",
    capacityCbm: 68,
  });
  await c.addContainerItem(admin, container.id, {
    productId: "prod-panela",
    quantity: 100,
  });
  await getStore().update("containers", container.id, { status: "arrived" });
});

describe("venda", () => {
  it("não fechou pede o motivo; fechou abre a ordem de venda com o produto", async () => {
    const store = getStore();
    const offer = async () =>
      store.create("sales_offers", {
        kind: "product",
        orderId: null,
        productId: "prod-panela",
        offeredTo: "Loja Exemplo",
        customerId: null,
        note: null,
        offeredByUserId: admin.id,
        offeredAt: new Date().toISOString(),
      });
    const declined = await offer();
    await expect(
      so.decideOffer(admin, declined.id, {
        decision: "declined",
        note: null,
        customerId: null,
        quantity: null,
      }),
    ).rejects.toThrow("decision_note_required");
    await so.decideOffer(admin, declined.id, {
      decision: "declined",
      note: "Preço alto",
      customerId: null,
      quantity: null,
    });
    expect((await store.get("sales_offers", declined.id))!.decision).toBe(
      "declined",
    );
    const closed = await offer();
    await expect(
      so.decideOffer(supplier, closed.id, {
        decision: "closed",
        note: null,
        customerId,
        quantity: 30,
      }),
    ).rejects.toThrow();
    await expect(
      so.decideOffer(admin, closed.id, {
        decision: "closed",
        note: null,
        customerId: null,
        quantity: 30,
      }),
    ).rejects.toThrow("customer_required");
    const order = (await so.decideOffer(admin, closed.id, {
      decision: "closed",
      note: null,
      customerId,
      quantity: 30,
    }))!;
    expect(order).toMatchObject({ status: "draft", customerId });
    expect(order.lines).toEqual([
      expect.objectContaining({ productId: "prod-panela", quantity: 30 }),
    ]);
    expect((await store.get("sales_offers", closed.id))!.salesOrderId).toBe(
      order.id,
    );
  });

  it("confirmar exige preço e entrega; reserva no estoque e o resto na chegada; Sankhya a lançar", async () => {
    const store = getStore();
    const order = await so.openSalesOrder(admin, customerId);
    await so.updateSalesOrder(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 40, unitPrice: null }],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: null,
      deliveryWindow: null,
      note: null,
      purchaseOrderId: null,
    });
    await expect(so.confirmSalesOrder(admin, order.id)).rejects.toThrow(
      "price_required",
    );
    await so.updateSalesOrder(admin, order.id, {
      lines: [
        { productId: "prod-panela", quantity: 40, unitPrice: 25 },
        { productId: "prod-jarra", quantity: 10, unitPrice: 30 },
      ],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: null,
      deliveryWindow: null,
      note: null,
      purchaseOrderId: null,
    });
    await expect(so.confirmSalesOrder(admin, order.id)).rejects.toThrow(
      "delivery_date_required",
    );
    await so.updateSalesOrder(admin, order.id, {
      lines: [
        { productId: "prod-panela", quantity: 40, unitPrice: 25 },
        { productId: "prod-jarra", quantity: 10, unitPrice: 30 },
      ],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: "2099-01-20",
      deliveryWindow: "Manhã",
      note: null,
      purchaseOrderId: null,
    });
    const done = await so.confirmSalesOrder(admin, order.id);
    expect(done.status).toBe("confirmed");
    const [panela, jarra] = done.lines;
    expect(panela.reservationId).toBeTruthy();
    expect(jarra).toMatchObject({ reservationId: null, onArrival: true });
    expect(done.erpStatus).toBe("pending");
    await expect(
      so.updateSalesOrder(admin, order.id, {
        lines: [],
        paymentConditionId: null,
        currency: "BRL",
        deliveryDate: null,
        deliveryWindow: null,
        note: null,
        purchaseOrderId: null,
      }),
    ).rejects.toThrow("sales_order_closed");
    await so.setSalesOrderErpNumber(admin, order.id, "88001");
    expect((await store.get("sales_orders", order.id))!).toMatchObject({
      erpStatus: "synced",
      erpNumber: "88001",
    });
    const agenda = so.salesAgenda(await so.listSalesOrders(admin));
    expect(agenda.map((o) => o.id)).toContain(order.id);
    // Cancelar devolve a reserva.
    await so.cancelSalesOrder(admin, order.id);
    const r = await store.get("stock_reservations", panela.reservationId!);
    expect(r!.status).toBe("cancelled");
  });
});
