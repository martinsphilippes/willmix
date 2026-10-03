import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ficha da Preparação já vem preenchida: da cotação escolhida ou, na
 * recompra, do último pedido do mesmo produto com o mesmo fornecedor. O
 * checklist diz só o que falta.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const ps = await import("@/lib/services/purchase-sheet");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

const sheet = {
  supplierName: "Guangzhou Supplier B",
  incoterm: "FOB" as const,
  currency: "USD" as const,
  price: 3.2,
  moq: 500,
  masterCartonQty: 24,
  netWeightPcKg: 0.3,
  grossWeightPcKg: 0.4,
  cbmPerCarton: 0.08,
  heightCm: 30,
  widthCm: 40,
  lengthCm: 50,
  packageType: "COLOR BOX",
  colorAssortment: "SORTIDO",
  material: "PVC",
  productionStartAt: "2026-11-01T00:00:00.000Z",
};

/** Solicitação → RFQ → ficha na cotação → seleção → sinal → pedido. */
async function orderWithQuoteSheet() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-boneca",
    productName: "Boneca articulada 30 cm",
    description: "Boneca",
    specification: null,
    quantity: 3000,
    unit: "un",
    deadline: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-b"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await qs.saveQuoteSheet(supplierB, quote.id, sheet);
  await r.answerQuote(supplierB, quote.id, {
    price: 3.2,
    currency: "USD",
    leadTimeDays: 30,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 50000,
    sellCurrency: "BRL",
  });
  return r.confirmDownPayment(admin, request.id);
}

describe("ficha da Preparação", () => {
  it("vem da cotação e o checklist diz só o que falta", async () => {
    const order = await orderWithQuoteSheet();
    const state = await ps.sheetProgress(order);
    expect(state.saved).toBe(true);
    // Cotação registrada sem fotos nem programação: o checklist diz o que falta.
    expect(state.missing).toEqual([
      "lot1",
      "scalePhoto",
      "rulerPhoto",
      "sidePhoto",
      "anglePhoto",
      "originalPhoto",
    ]);

    // Pedido sem a cópia (ex.: anterior à cópia automática): rascunho da cotação.
    const store = getStore();
    const [copy] = await store.list("purchase_sheets", {
      filter: { orderId: order.id },
    });
    await store.remove("purchase_sheets", copy.id);
    const view = (await ps.getSheetForUser(supplierB, order.id))!;
    expect(view.saved).toBe(false);
    expect(view.prefillSource).toBe("quote");
    expect(view.sheet).toMatchObject({ price: 3.2, material: "PVC" });
    expect((await ps.sheetProgress(order)).missing).toEqual([
      "lot1",
      "scalePhoto",
      "rulerPhoto",
      "sidePhoto",
      "anglePhoto",
      "originalPhoto",
    ]);
    // Salvar parte da ficha grava junto o que veio da cotação.
    const saved = await ps.saveSheet(supplierB, order.id, { notes: "ok" });
    expect(saved.sheet).toMatchObject({ price: 3.2, material: "PVC" });
  });

  it("recompra: sem ficha na cotação, usa a do último pedido do produto", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-boneca",
      productName: "Boneca articulada 30 cm",
      description: "Recompra",
      specification: null,
      quantity: 1000,
      unit: "un",
      deadline: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-b"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    // Respondida sem ficha (registrada pela Wellmix).
    await r.answerQuote(admin, quote.id, {
      price: 3.1,
      currency: "USD",
      leadTimeDays: 25,
    });
    await r.selectQuote(admin, quote.id, {
      sellPrice: 20000,
      sellCurrency: "BRL",
    });
    const order = await r.confirmDownPayment(admin, request.id);
    const view = (await ps.getSheetForUser(supplierB, order.id))!;
    expect(view.prefillSource).toBe("previous");
    expect(view.sheet).toMatchObject({ material: "PVC", masterCartonQty: 24 });
    // Data e programação são deste pedido.
    expect(view.sheet.productionStartAt ?? null).toBeNull();
  });
});
