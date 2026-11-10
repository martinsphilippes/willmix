import { beforeAll, describe, expect, it } from "vitest";
import { reachSignature, signOrderAs, withTempStore } from "./setup";

/*
 * Folha do pedido no modelo da Wellmix (docs/ORDER_SIGNATURE.md): cabeçalho,
 * cada item em duas faixas, totais e procedimentos. Os valores vêm da ficha
 * do pedido e do cadastro; o que o portal não tem fica em branco, nunca
 * inventado. A versão que as partes assinam não muda com a folha.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const sig = await import("@/lib/services/order-signature");
const { buildOrderSheet } = await import("@/lib/services/order-sheet");
const layout = await import("@/lib/order-sheet-layout");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  const { setSetting } = await import("@/lib/settings");
  await setSetting("approvalsEnabled", false);
});

async function newOrder(productId: string | null, quantity = 1850) {
  const store = getStore();
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Cesto de bambu",
    description: "Cesto organizador quadrado em bambu",
    specification: null,
    quantity,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 22.96,
    currency: "CNY",
    leadTimeDays: 45,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 100_000,
    sellCurrency: "BRL",
    downPaymentAmount: 30_000,
  });
  return r.confirmDownPayment(admin, req.id);
}

/** Ficha do pedido com os dados que a folha usa. */
async function fillSheet(orderId: string, productId: string | null) {
  const store = getStore();
  const values = {
    masterCartonQty: 5,
    innerQty: null,
    netWeightPcKg: 0.115,
    grossWeightPcKg: 0.12,
    cbmPerCarton: 0.0296,
    lengthCm: 37,
    widthCm: 27,
    heightCm: 62,
    packageType: "KRAFT WINDOW BOX",
    colorAssortment: "GRAY AND WHITE",
    ncm: "44219100",
    incoterm: "FOB",
    factoryItemCode: "BLB-4030",
    powerSource: "none",
    notes: "Carton with 5 baskets.",
  };
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId },
  });
  if (sheet) await store.update("purchase_sheets", sheet.id, values as never);
  else
    await store.create("purchase_sheets", {
      orderId,
      productId,
      ...values,
    } as never);
}

describe("folha do pedido no modelo da Wellmix", () => {
  it("cada item traz identificação, medidas em metros, caixas, pesos e valores; os totais somam", async () => {
    const store = getStore();
    const [product] = await store.list("products", { limit: 1 });
    const order = await newOrder(product.id);
    await fillSheet(order.id, product.id);
    // Ordem nova: a Wellmix assina depois da arte, do selo e do envio.
    // A Wellmix faz a programação de compra (370 caixas de 5 = 1.850 peças).
    const ps = await import("@/lib/services/purchase-sheet");
    await ps.saveSheet(admin, order.id, {
      lots: [{ departureIntervalDays: 30, masterCartons: 370 }],
    } as never);
    await reachSignature(admin, order.id);
    await signOrderAs(admin, order.id);
    const view = (await sig.getOrderSignatureView(admin, order.id))!;
    const sheet = await buildOrderSheet(order, view.document, view.wellmix);

    expect(sheet.header).toMatchObject({
      wellmixNumber: order.number,
      partner: view.document.supplierName,
      incoterm: "FOB",
      purchaseOrder: null,
      etd: null,
    });
    expect(sheet.header.lot).toBe(
      `${order.number}-${order.createdAt.slice(0, 4)}`,
    );
    // Enviado ao fornecedor = quando a Wellmix assinou.
    expect(sheet.header.sentToPartnerAt).toBe(view.wellmix!.at);
    expect(sheet.currency).toBe("CNY");
    expect(sheet.items).toHaveLength(1);
    expect(sheet.items[0]).toMatchObject({
      n: 1,
      description: "Cesto de bambu",
      descriptionPt: "Cesto organizador quadrado em bambu",
      wellmixCode: product.sku,
      factoryCode: "BLB-4030",
      pantone: "GRAY AND WHITE",
      batteries: "NO",
      ncm: "44219100",
      packing: "KRAFT WINDOW BOX",
      lengthM: 0.37,
      widthM: 0.27,
      heightM: 0.62,
      cbmCarton: 0.0296,
      piecesPerMaster: 5,
      masterCartons: 370,
      totalCbm: 10.952,
      netKg: 0.115,
      totalNetKg: 212.75,
      grossKg: 0.12,
      totalGrossKg: 222,
      quantity: 1850,
      pieces: true,
      price: 22.96,
      total: 42476,
    });
    expect(sheet.totals).toEqual({
      cbm: 10.952,
      netKg: 212.75,
      grossKg: 222,
      value: 42476,
    });
    expect(sheet.leadTimeDays).toBe(45);

    // As células saem na ordem das colunas do modelo, com os números em pt-BR.
    const a = layout.orderSheetValuesA(sheet.items[0]);
    const b = layout.orderSheetValuesB(sheet.items[0]);
    expect(a).toHaveLength(layout.ORDER_SHEET_BAND_A.length);
    expect(b).toHaveLength(layout.orderSheetBandB("¥").length);
    expect(b.slice(0, 4)).toEqual([
      "KRAFT WINDOW BOX",
      "0,370",
      "0,270",
      "0,620",
    ]);
    expect(b.slice(-4)).toEqual(["370", "1.850", "22,9600", "42.476,0000"]);
    // O que o portal não tem fica em branco: foto, trading, EAN, DUN e LI.
    const blank = (label: string) =>
      a[layout.ORDER_SHEET_BAND_A.findIndex(([l]) => l === label)];
    for (const label of [
      "Picture",
      "Trading Code",
      "EAN Code",
      "Dun Code Master Carton",
      "Dun Code Inner Box",
      "Import authorization before shipment - LI",
    ])
      expect(blank(label)).toBe("");
    expect(layout.orderSheetValueTotals(sheet)).toEqual([
      ["Total Value - ¥", "42.476,0000"],
      ["Commission Value:", ""],
      ["Total Value + Commission Value - ¥", ""],
    ]);
  });

  it("sem ficha e sem cadastro: as colunas ficam em branco e os totais de carga não são inventados", async () => {
    const order = await newOrder(null, 1000);
    const view = (await sig.getOrderSignatureView(admin, order.id))!;
    const sheet = await buildOrderSheet(order, view.document, view.wellmix);
    expect(sheet.items[0]).toMatchObject({
      wellmixCode: null,
      ncm: null,
      lengthM: null,
      cbmCarton: null,
      masterCartons: null,
      totalCbm: null,
      totalNetKg: null,
      quantity: 1000,
      price: 22.96,
      total: 22960,
    });
    expect(sheet.totals).toEqual({
      cbm: null,
      netKg: null,
      grossKg: null,
      value: 22960,
    });
    expect(sheet.header.sentToPartnerAt).toBeNull();
    const b = layout.orderSheetValuesB(sheet.items[0]);
    expect(b.slice(0, 16).every((v) => v === "")).toBe(true);
    expect(b.slice(-3)).toEqual(["1.000", "22,9600", "22.960,0000"]);
  });

  it("a folha é só apresentação: preencher a ficha não muda a versão assinada", async () => {
    const store = getStore();
    const [product] = await store.list("products", { limit: 1 });
    const order = await newOrder(product.id);
    const before = (await sig.getOrderSignatureView(admin, order.id))!.hash;
    await reachSignature(admin, order.id);
    await signOrderAs(admin, order.id);
    const [sheetRow] = await store.list("purchase_sheets", {
      filter: { orderId: order.id },
    });
    const patch = { grossWeightPcKg: 0.5, packageType: "COLOR BOX" } as never;
    if (sheetRow) await store.update("purchase_sheets", sheetRow.id, patch);
    else
      await store.create("purchase_sheets", {
        orderId: order.id,
        productId: product.id,
        ...(patch as object),
      } as never);
    const after = (await sig.getOrderSignatureView(admin, order.id))!;
    expect(after.hash).toBe(before);
    const sheet = await buildOrderSheet(order, after.document, after.wellmix);
    expect(sheet.items[0].packing).toBe("COLOR BOX");
  });

  it("os procedimentos e as colunas do modelo estão completos", async () => {
    const { ORDER_PROCEDURES } = await import("@/lib/order-procedures");
    expect(ORDER_PROCEDURES.map((s) => s.title)).toEqual([
      "Quotation, Reorders and New Product Orders",
      "Shipping status:",
      "Marketing:",
      "New Items:",
      "Shipments:",
    ]);
    expect(ORDER_PROCEDURES.flatMap((s) => s.lines)).toHaveLength(19);
    expect(layout.ORDER_SHEET_BAND_A).toHaveLength(16);
    expect(layout.orderSheetBandB("¥")).toHaveLength(19);
    expect(layout.orderSheetCurrencySign("RMB")).toBe("¥");
    expect(layout.orderSheetCurrencySign("USD")).toBe("US$");
  });
});
