import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* RFQ respondida pela ficha de compra; a ficha escolhida vira a do pedido. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

const complete = {
  supplierName: "Shenzhen Supplier A",
  incoterm: "FOB" as const,
  currency: "USD" as const,
  price: 2.5,
  moq: 500,
  masterCartonQty: 24,
  netWeightPcKg: 0.4,
  grossWeightPcKg: 0.5,
  cbmPerCarton: 0.06,
  heightCm: 30,
  widthCm: 40,
  lengthCm: 50,
  packageType: "COLOR BOX",
  colorAssortment: "WHITE",
  material: "GLASS",
  productionStartAt: "2026-11-01T00:00:00.000Z",
};

describe("ficha de compra na cotação", () => {
  it("fornecedor preenche, responde e a ficha vai para o pedido", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Jarra",
      description: "Jarra com tampa",
      specification: null,
      quantity: 1000,
      unit: "un",
      deadline: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-a" },
    });

    // Rascunho parcial: salva e lista o que falta.
    const partial = await qs.saveQuoteSheet(supplierA, quote.id, {
      price: 2.5,
      currency: "USD",
    });
    expect(partial.missing).toContain("incoterm");
    expect(partial.missing).not.toContain("price");

    // Outro fornecedor e o cliente não acessam a ficha.
    await expect(
      qs.saveQuoteSheet(supplierB, quote.id, { price: 1 }),
    ).rejects.toThrow();
    expect(await qs.getQuoteSheetForUser(joao, quote.id)).toBeNull();
    // Fornecedor não mexe nos impostos; a Wellmix sim.
    await qs.saveQuoteSheet(supplierA, quote.id, {
      ...complete,
      importTaxPercent: 99,
    });
    await qs.saveQuoteSheet(admin, quote.id, {
      importTaxPercent: 18,
      ipiPercent: 10,
    });
    const view = (await qs.getQuoteSheetForUser(supplierA, quote.id))!;
    // Campos completos; faltam a programação e as fotos (exigidas já na cotação).
    expect(view.missing).toEqual(["lot1", "scalePhoto", "rulerPhoto"]);
    expect(view.sheet.importTaxPercent).toBe(18);
    await qs.saveQuoteSheet(supplierA, quote.id, {
      lots: [{ departureIntervalDays: 30, masterCartons: 42 }],
    });
    const png = () =>
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "foto.png", {
        type: "image/png",
      });
    await qs.addQuoteSheetPhotos(supplierA, quote.id, "weight_scale", [png()]);
    await qs.addQuoteSheetPhotos(supplierA, quote.id, "dimension_scale", [
      png(),
    ]);
    // Outro fornecedor não envia foto nesta cotação.
    await expect(
      qs.addQuoteSheetPhotos(supplierB, quote.id, "angle", [png()]),
    ).rejects.toThrow();
    const done = (await qs.getQuoteSheetForUser(supplierA, quote.id))!;
    expect(done.missing).toEqual([]);
    expect(done.photos).toHaveLength(2);
    // A foto da cotação não abre para outro fornecedor nem para o cliente.
    const { canAccessDocument } = await import("@/lib/services/documents");
    const photoDoc = (await store.get("documents", done.photos[0].documentId))!;
    expect(await canAccessDocument(supplierB, photoDoc)).toBe(false);
    expect(await canAccessDocument(joao, photoDoc)).toBe(false);

    await r.answerQuote(supplierA, quote.id, {
      price: 2.5,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, quote.id, {
      sellPrice: 25000,
      sellCurrency: "BRL",
    });
    const order = await r.confirmDownPayment(admin, request.id);
    const [orderSheet] = await store.list("purchase_sheets", {
      filter: { orderId: order.id },
    });
    expect(orderSheet.price).toBe(2.5);
    expect(orderSheet.material).toBe("GLASS");
    expect(orderSheet.ipiPercent).toBe(10);
    // Fotos da cotação passam para o pedido.
    const { getSheetPhotos } = await import("@/lib/services/purchase-sheet");
    const orderPhotos = await getSheetPhotos(order.id);
    expect(orderPhotos.map((p) => p.kind).sort()).toEqual([
      "dimension_scale",
      "weight_scale",
    ]);
    expect(
      (await store.get("documents", orderPhotos[0].documentId))?.orderId,
    ).toBe(order.id);
    // Wellmix libera o pedido: a Preparação se conclui sozinha (ficha completa).
    const { submitRequirement } = await import("@/lib/workflow/engine");
    const [created] = await store.list("stages", {
      filter: { orderId: order.id, key: "ORDER_CREATED" },
    });
    const [confirm] = await store.list("requirements", {
      filter: { stageId: created.id, key: "order_confirmed" },
    });
    await submitRequirement(admin, confirm.id, {});
    const [prep] = await store.list("stages", {
      filter: { orderId: order.id, key: "PREPARATION" },
    });
    expect(prep.status).toBe("done");
    expect((await store.get("orders", order.id))?.status).toBe(
      "SUPPLIER_PAYMENT",
    );
    // A ficha da cotação continua guardada.
    expect((await qs.getQuoteSheet(quote.id))?.id).not.toBe(orderSheet.id);
    // Cotação fechada: ninguém edita mais a ficha da cotação.
    await expect(
      qs.saveQuoteSheet(supplierA, quote.id, { price: 3 }),
    ).rejects.toThrow();
  });
});
