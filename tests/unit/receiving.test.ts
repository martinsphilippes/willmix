import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Recebimento (Fase E): só a Wellmix; divergência por SKU avisa comprador e
 * fornecedor; encerrar exige tudo conferido; fechamento financeiro mostra o
 * que o cliente pagou e o que falta.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const rc = await import("@/lib/services/receiving");
const { setSetting } = await import("@/lib/settings");
const { RECEIVING_CHECKS } = await import("@/lib/db/schema");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;
let supplierA: User;
let order: Order;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  await setSetting("approvalsEnabled", false);
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra recebimento",
    description: "Jarra",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 10_000,
    sellCurrency: "BRL",
    downPaymentAmount: 3_000,
  });
  order = await r.confirmDownPayment(admin, req.id);
  order = await getStore().update("orders", order.id, { status: "TRANSPORT" });
});

describe("recebimento", () => {
  it("só a Wellmix registra", async () => {
    await expect(
      rc.saveUnloading(supplierA, order.id, {
        sealNumber: "X",
        sealIntact: "yes",
        checklist: [],
      }),
    ).rejects.toThrow();
    await expect(
      rc.saveUnloading(joao, order.id, {
        sealNumber: "X",
        sealIntact: "yes",
        checklist: [],
      }),
    ).rejects.toThrow();
  });

  it("divergência por SKU avisa o fornecedor; avariado não passa do recebido", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    await expect(
      rc.saveCounts(admin, order.id, [
        { orderItemId: item.id, received: 5, damaged: 6, note: null },
      ]),
    ).rejects.toThrow("invalid_count");
    const before = (
      await getStore().list("notifications", {
        filter: { userId: supplierA.id },
      })
    ).length;
    await rc.saveCounts(admin, order.id, [
      {
        orderItemId: item.id,
        received: item.quantity - 10,
        damaged: 3,
        note: "Caixas amassadas",
      },
    ]);
    const after = (
      await getStore().list("notifications", {
        filter: { userId: supplierA.id },
      })
    ).length;
    expect(after).toBeGreaterThan(before);
    const view = await rc.receivingView(order);
    expect(view.divergences).toBe(1);
  });

  it("encerrar exige lacre, fotos, checklist, RIC e devolução", async () => {
    await expect(rc.closeReceiving(admin, order.id, null)).rejects.toThrow(
      "incomplete",
    );
    await rc.saveUnloading(admin, order.id, {
      sealNumber: "SEAL123",
      sealIntact: "yes",
      sealPhotoDocumentId: "doc-seal",
      containerPhotoDocumentIds: ["doc-c1"],
      checklist: [...RECEIVING_CHECKS],
    });
    await rc.saveRic(admin, order.id, { ricNumber: "RIC-9" });
    let view = await rc.receivingView(order);
    expect(view.missing).toEqual(["containerReturn"]);
    await rc.saveReturn(admin, order.id, {
      returnedAt: "2026-11-20T12:00:00.000Z",
    });
    view = await rc.receivingView(order);
    expect(view.missing).toEqual([]);
    // Cliente pagou o sinal (3.000 de 10.000): faltam 7.000.
    expect(view.finance.customerPaid).toBe(3_000);
    expect(view.finance.customerDue).toBe(7_000);
    await rc.closeReceiving(admin, order.id, "Ok com ressalva");
    await expect(
      rc.saveRic(admin, order.id, { ricNumber: "outro" }),
    ).rejects.toThrow("closed");
  });
});
