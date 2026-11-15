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
      // O cliente retira: sem frete (dono, 15/11/2026).
      freightValue: null,
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

  it("devolução parcial: NF do financeiro, qualidade confere, o bom volta ao estoque; frete vira conta a pagar", async () => {
    const store = getStore();
    const { stockInBrazil } = await import("@/lib/services/stock");
    const sr = await import("@/lib/services/sales-returns");
    const carrier = await store.create("parties", {
      type: "carrier",
      name: "Transportes Teste",
      active: true,
    } as never);
    const order = await so.openSalesOrder(admin, customerId);
    await so.updateSalesOrder(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 10, unitPrice: 25 }],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: "2099-04-10",
      deliveryWindow: null,
      note: null,
      purchaseOrderId: null,
    });
    await so.confirmSalesOrder(admin, order.id);
    await so.registerSalesInvoice(admin, order.id, {
      number: "NF-6001",
      documentId: null,
    });
    // Ainda não expedida: não devolve.
    await expect(
      sr.openSalesReturn(admin, order.id, {
        lines: [{ productId: "prod-panela", quantity: 1 }],
        reason: "Avaria",
      }),
    ).rejects.toThrow("sales_order_not_shipped");
    await so.shipSalesOrder(admin, order.id, {
      carrierId: carrier.id,
      customerPickup: false,
      freightValue: 300,
      shippedOn: "2099-04-09",
      freightDays: 15,
    });
    // Frete: conta a pagar com vencimento na saída + 15 dias.
    const freight = (await so.listFreightPayables(admin)).find(
      (f) => f.id === order.id,
    )!;
    expect(freight).toMatchObject({
      value: 300,
      dueDate: "2099-04-24",
      paidAt: null,
      carrierName: "Transportes Teste",
    });
    await expect(
      so.payFreight(admin, order.id, { proofDocumentId: null }),
    ).rejects.toThrow("proof_required");
    await so.payFreight(admin, order.id, { proofDocumentId: "doc-frete" });
    expect(
      (await store.get("sales_orders", order.id))!.freightPaidAt,
    ).toBeTruthy();
    await expect(
      so.payFreight(admin, order.id, { proofDocumentId: "doc-frete" }),
    ).rejects.toThrow("freight_paid");

    const before = (await stockInBrazil("prod-panela")).quantity;
    await expect(
      sr.openSalesReturn(admin, order.id, {
        lines: [{ productId: "prod-panela", quantity: 11 }],
        reason: "Avaria",
      }),
    ).rejects.toThrow("return_too_much");
    await expect(
      sr.openSalesReturn(admin, order.id, {
        lines: [{ productId: "prod-panela", quantity: 4 }],
        reason: " ",
      }),
    ).rejects.toThrow("return_reason_required");
    const ret = await sr.openSalesReturn(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 4 }],
      reason: "Caixa amassada",
    });
    // Sem a NF de devolução a qualidade não fecha.
    await expect(
      sr.checkSalesReturn(admin, ret.id, {
        lines: [{ productId: "prod-panela", goodQty: 3 }],
        lossNote: "Uma quebrada",
      }),
    ).rejects.toThrow("invoice_required");
    await expect(
      sr.registerReturnInvoice(supplier, ret.id, {
        number: "1",
        documentId: null,
      }),
    ).rejects.toThrow();
    await sr.registerReturnInvoice(admin, ret.id, {
      number: "NFD-77",
      documentId: null,
    });
    await expect(
      sr.checkSalesReturn(admin, ret.id, {
        lines: [{ productId: "prod-panela", goodQty: 3 }],
        lossNote: null,
      }),
    ).rejects.toThrow("loss_note_required");
    await sr.checkSalesReturn(admin, ret.id, {
      lines: [{ productId: "prod-panela", goodQty: 3 }],
      lossNote: "Uma quebrada",
    });
    const closed = (await store.get("sales_returns", ret.id))!;
    expect(closed.status).toBe("closed");
    expect(closed.lines[0]).toMatchObject({ goodQty: 3, lossQty: 1 });
    expect((await stockInBrazil("prod-panela")).quantity).toBe(before + 3);
    const moves = await store.list("stock_movements", {
      filter: { salesOrderId: order.id, kind: "return_in" },
    });
    expect(moves).toEqual([expect.objectContaining({ quantity: 3 })]);
    // O que resta para devolver: 10 − 4 = 6.
    await expect(
      sr.openSalesReturn(admin, order.id, {
        lines: [{ productId: "prod-panela", quantity: 7 }],
        reason: "Mais avaria",
      }),
    ).rejects.toThrow("return_too_much");
    await sr.openSalesReturn(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 6 }],
      reason: "Cliente desistiu",
    });
  });

  it("frete a pagar entra no fluxo de caixa como saída no vencimento; pago, sai", async () => {
    const store = getStore();
    const { freightOutflows, buildCashflow } =
      await import("@/lib/services/cashflow");
    const carrier = await store.create("parties", {
      type: "carrier",
      name: "Transportes Caixa",
      active: true,
    } as never);
    const order = await so.openSalesOrder(admin, customerId);
    await so.updateSalesOrder(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 2, unitPrice: 25 }],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: "2099-05-10",
      deliveryWindow: null,
      note: null,
      purchaseOrderId: null,
    });
    await so.confirmSalesOrder(admin, order.id);
    await so.registerSalesInvoice(admin, order.id, {
      number: "NF-7001",
      documentId: null,
    });
    await so.shipSalesOrder(admin, order.id, {
      carrierId: carrier.id,
      customerPickup: false,
      freightValue: 180,
      shippedOn: "2099-05-09",
      freightDays: 10,
    });
    const mine = (await freightOutflows()).filter((f) =>
      f.label.includes("Transportes Caixa"),
    );
    expect(mine).toEqual([
      expect.objectContaining({
        type: "freight",
        day: "2099-05-19",
        amount: 180,
        currency: "BRL",
        href: "/app/payables",
      }),
    ]);
    // Entra nas saídas da semana do vencimento.
    const { buckets } = buildCashflow({
      today: "2099-05-11",
      weeks: 4,
      rate: () => 1,
      inflows: [],
      outflows: mine,
    });
    const week = buckets.find((b) => b.outflow.get("BRL") === 180)!;
    expect(week.start).toBe("2099-05-18");
    await so.payFreight(admin, order.id, { proofDocumentId: "doc-frete-2" });
    expect(
      (await freightOutflows()).filter((f) =>
        f.label.includes("Transportes Caixa"),
      ),
    ).toEqual([]);
  });

  it("frete da venda entra no custo e na margem do pedido de compra ligado, desde a expedição", async () => {
    const store = getStore();
    const { loadOrderFinance, computeOrderFinance } =
      await import("@/lib/services/finance");
    const { orderFromRequest } = await import("./helpers/order");
    const r = await import("@/lib/services/requests");
    const joao = (await store.list("users")).find(
      (u) => u.email === "joao@lojista.com",
    )!;
    const req = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Panela margem",
      description: "Panela margem",
      specification: null,
      quantity: 10,
      unit: "un",
      deadline: null,
      notes: null,
    });
    const seeded = await orderFromRequest(admin, req);
    const po = await store.update("orders", seeded.id, {
      status: "DELIVERED",
      fobTotal: 1000,
      fobCurrency: "BRL",
      sellPrice: 3000,
      sellCurrency: "BRL",
    });
    const before = await loadOrderFinance(po, { estimate: false });
    const carrier = await store.create("parties", {
      type: "carrier",
      name: "Transportes Margem",
      active: true,
    } as never);
    const order = await so.openSalesOrder(admin, customerId);
    await so.updateSalesOrder(admin, order.id, {
      lines: [{ productId: "prod-panela", quantity: 1, unitPrice: 25 }],
      paymentConditionId: null,
      currency: "BRL",
      deliveryDate: "2099-06-10",
      deliveryWindow: null,
      note: null,
      purchaseOrderId: po.id,
    });
    await so.confirmSalesOrder(admin, order.id);
    // Confirmada, ainda sem expedir: o frete não conta.
    expect((await loadOrderFinance(po, { estimate: false })).cost).toBe(
      before.cost,
    );
    await so.registerSalesInvoice(admin, order.id, {
      number: "NF-8001",
      documentId: null,
    });
    await so.shipSalesOrder(admin, order.id, {
      carrierId: carrier.id,
      customerPickup: false,
      freightValue: 120,
      shippedOn: "2099-06-09",
      freightDays: 0,
    });
    // Expedida (ainda não paga): o frete já é custo do pedido de compra.
    const after = await loadOrderFinance(po, { estimate: false });
    expect(after.salesFreight).toBe(120);
    expect(after.cost).toBe((before.cost ?? 0) + 120);
    expect(after.margin).toBe((before.margin ?? 0) - 120);
    // Venda em outra moeda sem câmbio do dia: o custo fica pendente.
    const usd = computeOrderFinance(
      { ...po, sellCurrency: "USD", fobCurrency: "USD" },
      [],
      { customer: "c", supplier: "s", product: "p" },
      { salesFreights: [{ amount: 120, currency: "BRL" }] },
    );
    expect([usd.cost, usd.salesFreight]).toEqual([null, null]);
  });
});
