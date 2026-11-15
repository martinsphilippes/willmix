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

  it("NF do financeiro, expedição com baixa no estoque e entrega com comprovante", async () => {
    const store = getStore();
    const { stockInBrazil } = await import("@/lib/services/stock");
    const before = (await stockInBrazil("prod-panela")).quantity;
    const order = await so.openSalesOrder(admin, customerId);
    await so.updateSalesOrder(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 20, unitPrice: 25 }],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: "2099-02-10",
      deliveryWindow: null,
      note: null,
      purchaseOrderId: null,
    });
    const confirmed = await so.confirmSalesOrder(admin, order.id);
    const reservationId = confirmed.lines[0].reservationId!;
    const ship = (carrierId: string | null, customerPickup: boolean) =>
      so.shipSalesOrder(admin, order.id, {
        carrierId,
        customerPickup,
        freightValue: 150,
        shippedOn: "2099-02-09",
      });
    // Sem a NF de venda não expede; só o financeiro (ou o admin) registra.
    await expect(ship(null, true)).rejects.toThrow("invoice_required");
    await expect(
      so.registerSalesInvoice(supplier, order.id, {
        number: "1",
        documentId: null,
      }),
    ).rejects.toThrow();
    await so.registerSalesInvoice(admin, order.id, {
      number: "NF-5501",
      documentId: null,
    });
    await expect(ship("nao-existe", false)).rejects.toThrow("carrier_required");
    const shipped = await ship(null, true);
    expect(shipped).toMatchObject({
      status: "shipped",
      customerPickup: true,
      freightValue: 150,
    });
    // A reserva virou baixa por venda ligada à ordem.
    expect((await store.get("stock_reservations", reservationId))!.status).toBe(
      "used",
    );
    const moves = await store.list("stock_movements", {
      filter: { salesOrderId: order.id },
    });
    expect(moves).toEqual([
      expect.objectContaining({ kind: "sale_out", quantity: -20 }),
    ]);
    expect((await stockInBrazil("prod-panela")).quantity).toBe(before - 20);
    await expect(so.cancelSalesOrder(admin, order.id)).rejects.toThrow(
      "sales_order_shipped",
    );
    // Entrega: quem recebeu e o comprovante.
    await expect(
      so.deliverSalesOrder(admin, order.id, {
        deliveredOn: null,
        receivedBy: "Maria",
        proofDocumentId: null,
      }),
    ).rejects.toThrow("proof_required");
    await so.deliverSalesOrder(admin, order.id, {
      deliveredOn: "2099-02-10",
      receivedBy: "Maria",
      proofDocumentId: "doc-canhoto",
    });
    expect((await store.get("sales_orders", order.id))!).toMatchObject({
      status: "delivered",
      receivedBy: "Maria",
    });
  });

  it("linha na chegada só expede com estoque livre no Brasil", async () => {
    const order = await so.openSalesOrder(admin, customerId);
    await so.updateSalesOrder(admin, order.id, {
      lines: [{ productId: "prod-jarra", quantity: 10, unitPrice: 30 }],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: "2099-03-01",
      deliveryWindow: null,
      note: null,
      purchaseOrderId: null,
    });
    await so.confirmSalesOrder(admin, order.id);
    await so.registerSalesInvoice(admin, order.id, {
      number: "NF-5502",
      documentId: null,
    });
    await expect(
      so.shipSalesOrder(admin, order.id, {
        carrierId: null,
        customerPickup: true,
        freightValue: null,
        shippedOn: null,
      }),
    ).rejects.toThrow("stock_insufficient");
    expect((await getStore().get("sales_orders", order.id))!.status).toBe(
      "confirmed",
    );
  });
});
