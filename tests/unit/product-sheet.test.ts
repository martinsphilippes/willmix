import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Ficha de compra mestre no cadastro do produto: salvar/espelhar, pré-preencher pedido e cotação, fotos, adotar. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const ps = await import("@/lib/services/product-sheet");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const sheets = await import("@/lib/services/purchase-sheet");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

const master = {
  incoterm: "FOB" as const,
  currency: "USD" as const,
  price: 2.5,
  moq: 1000,
  masterCartonQty: 24,
  innerQty: 6,
  cbmPerCarton: 0.06,
  heightCm: 30,
  widthCm: 40,
  lengthCm: 50,
  netWeightPcKg: 0.4,
  grossWeightPcKg: 0.5,
  packageType: "COLOR BOX",
  colorAssortment: "WHITE / RED",
  colorPantones: [{ code: "185 C", hex: "#e4002b" }],
  material: "GLASS",
  powerSource: null,
  location: "YIWU",
  supplierStore: "A 154678",
  ecommerceDescription: "Jarra de vidro com tampa de bambu",
  ncm: "7013.37.00",
};

describe("ficha mestre do produto", () => {
  it("só a Wellmix salva; espelha preço, caixa, medidas, cor e material no produto", async () => {
    const store = getStore();
    await expect(
      ps.saveProductSheet(joao, "prod-jarra", { price: 1 }),
    ).rejects.toThrow("forbidden");
    await expect(
      ps.saveProductSheet(supplierA, "prod-jarra", { price: 1 }),
    ).rejects.toThrow("forbidden");
    const { sheet, missing } = await ps.saveProductSheet(
      admin,
      "prod-jarra",
      master,
    );
    expect(sheet.orderId).toBe("prod-jarra");
    expect(sheet.productId).toBe("prod-jarra");
    expect(sheet.price).toBe(2.5);
    expect(sheet.colorPantones).toEqual([{ code: "185 C", hex: "#e4002b" }]);
    // Campos obrigatórios da ficha preenchidos: falta só o fornecedor (lote e fotos à parte).
    expect(missing).toEqual(["supplierName"]);
    const product = (await store.get("products", "prod-jarra"))!;
    expect(product.price).toBe(2.5);
    expect(product.currency).toBe("USD");
    expect(product.moq).toBe(1000);
    expect(product.masterBoxQty).toBe(24);
    expect(product.innerBoxQty).toBe(6);
    expect(product.cbm).toBe(0.06);
    expect(product.boxHeightCm).toBe(30);
    expect(product.boxLengthCm).toBe(50);
    expect(product.color).toBe("WHITE / RED");
    expect(product.pantone).toBe("185 C");
    expect(product.material).toBe("GLASS");
    expect(product.netWeightKg).toBe(0.4);
    expect(product.ncm).toBe("7013.37.00");
    expect(await ps.getProductSheet("prod-jarra")).toMatchObject({
      id: sheet.id,
    });
    // Salvar de novo atualiza o mesmo registro.
    const again = await ps.saveProductSheet(admin, "prod-jarra", {
      price: 2.75,
      currency: "RMB",
      colorPantones: null,
      material: "M".repeat(200),
    });
    expect(again.sheet.id).toBe(sheet.id);
    const mirrored = (await store.get("products", "prod-jarra"))!;
    expect(mirrored.currency).toBe("CNY");
    // Sem cores escolhidas o texto "pantone" fica como estava; textos longos cabem na coluna.
    expect(mirrored.pantone).toBe("185 C");
    expect(mirrored.material?.length).toBe(120);
  });

  it("produto salvo pelo formulário espelha na ficha mestre", async () => {
    const store = getStore();
    await store.update("products", "prod-jarra", {
      price: 3,
      moq: 500,
      masterBoxQty: 12,
      color: "BLUE",
    });
    await ps.syncMasterFromProduct("prod-jarra");
    const m = (await ps.getProductSheet("prod-jarra"))!;
    expect(m.price).toBe(3);
    expect(m.moq).toBe(500);
    expect(m.masterCartonQty).toBe(12);
    expect(m.colorAssortment).toBe("BLUE");
    // O que só existe na ficha continua lá.
    expect(m.packageType).toBe("COLOR BOX");
    expect(m.incoterm).toBe("FOB");
    // Produto sem ficha mestre: nada acontece.
    await ps.syncMasterFromProduct("prod-panela");
    expect(await ps.getProductSheet("prod-panela")).toBeNull();
  });

  it("cotação e pedido do produto nascem com a ficha mestre e com as fotos do cadastro", async () => {
    const store = getStore();
    await ps.saveProductSheet(admin, "prod-jarra", master);
    // Fotos do cadastro: 5 tipos da ficha.
    const doc = await store.create("documents", {
      fileKey: "k",
      fileName: "f.png",
      mimeType: "image/png",
      size: 1,
      type: "photo",
      visibility: "internal",
      uploadedByUserId: admin.id,
      orderId: null,
      requestId: null,
      requirementId: null,
      stageId: null,
      version: 1,
    } as never);
    for (const kind of sheets.SHEET_PHOTO_KINDS)
      await store.create("product_photos", {
        productId: "prod-jarra",
        sourcingItemId: null,
        orderId: null,
        documentId: doc.id,
        kind,
        caption: null,
        takenAt: null,
        takenByUserId: admin.id,
        derivedFromPhotoId: null,
        isPrimary: false,
      });
    expect(await ps.productSheetMissing("prod-jarra", master)).toEqual([
      "supplierName",
    ]);
    expect((await ps.catalogPhotoKinds("prod-jarra")).length).toBe(5);
    expect(await ps.catalogPhotoKinds(null)).toEqual([]);

    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Teste ficha mestre",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    const view = (await qs.getQuoteSheetForUser(supplierA, quote.id))!;
    expect(view.saved).toBe(false);
    // Dados do produto vêm da ficha mestre…
    expect(view.sheet.packageType).toBe("COLOR BOX");
    expect(view.sheet.colorPantones).toEqual([
      { code: "185 C", hex: "#e4002b" },
    ]);
    expect(view.sheet.ecommerceDescription).toBe(
      "Jarra de vidro com tampa de bambu",
    );
    expect(view.sheet.masterCartonQty).toBe(24);
    // …mas nada comercial do fornecedor de referência (isolamento entre fornecedores).
    expect(view.sheet.incoterm ?? null).toBeNull();
    expect(view.sheet.price ?? null).toBeNull();
    expect(view.sheet.moq ?? null).toBeNull();
    expect(view.sheet.location ?? null).toBeNull();
    expect(view.sheet.supplierStore ?? null).toBeNull();
    expect(view.sheet.supplierName).toBe("Shenzhen Supplier A");
    // Fotos do cadastro contam como enviadas, sem copiar documentos para a cotação.
    expect(view.photos).toEqual([]);
    expect(view.catalogPhotoKinds.sort()).toEqual(
      [...sheets.SHEET_PHOTO_KINDS].sort(),
    );
    expect(view.missing).not.toContain("scalePhoto");
    expect(view.missing).not.toContain("originalPhoto");
    expect(
      await store.list("product_photos", { filter: { orderId: quote.id } }),
    ).toEqual([]);

    // Pedido: a ficha da Preparação também nasce da mestre quando não há ficha de cotação.
    await r.answerQuote(supplierA, quote.id, {
      price: 2,
      currency: "USD",
      leadTimeDays: 10,
      conditions: null,
    });
    await r.selectQuote(admin, quote.id, {
      sellPrice: 1000,
      sellCurrency: "BRL",
      downPaymentAmount: 300,
    });
    const order = await r.confirmDownPayment(admin, request.id);
    const sheetView = (await sheets.getSheetForUser(admin, order.id))!;
    expect(sheetView.sheet.packageType).toBe("COLOR BOX");
    expect(sheetView.sheet.incoterm ?? null).toBeNull();
    expect(sheetView.photos).toEqual([]);
    expect(sheetView.catalogPhotoKinds.length).toBe(
      sheets.SHEET_PHOTO_KINDS.length,
    );
    expect(sheetView.missing).not.toContain("scalePhoto");
  });

  it("adotar a ficha de um pedido atualiza a ficha mestre e as fotos que faltam", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-panela",
      productName: "Panela",
      description: "Adotar ficha",
      specification: null,
      quantity: 10,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    await qs.saveQuoteSheet(supplierA, quote.id, {
      supplierName: "Panela Factory",
      incoterm: "EXW",
      currency: "RMB",
      price: 30,
      moq: 200,
      masterCartonQty: 4,
      cbmPerCarton: 0.1,
      packageType: "BROWN BOX",
      colorAssortment: "BLACK",
      material: "ALUMINUM",
      productionStartAt: "2026-11-02T00:00:00.000Z",
      lots: [{ departureIntervalDays: 30, masterCartons: 10 }],
    });
    await expect(ps.adoptSheetIntoProduct(joao, quote.id)).rejects.toThrow(
      "forbidden",
    );
    const { productId, copiedPhotos } = await ps.adoptSheetIntoProduct(
      admin,
      quote.id,
    );
    expect(productId).toBe("prod-panela");
    expect(copiedPhotos).toBe(0);
    const m = (await ps.getProductSheet("prod-panela"))!;
    expect(m.supplierName).toBe("Panela Factory");
    expect(m.packageType).toBe("BROWN BOX");
    expect(m.incoterm).toBe("EXW");
    // Datas e lotes são de cada compra: não vão para a mestre.
    expect(m.productionStartAt ?? null).toBeNull();
    expect(m.lots?.every((l) => l.masterCartons === null)).toBe(true);
    const product = (await store.get("products", "prod-panela"))!;
    expect(product.price).toBe(30);
    expect(product.currency).toBe("CNY");
    expect(product.material).toBe("ALUMINUM");
    // Ficha sem produto do catálogo: recusa.
    const loose = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Desconhecido",
      description: "Sem catálogo",
      specification: null,
      quantity: 1,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, loose.id, ["fornecedor-a"]);
    const [q2] = await store.list("quotes", {
      filter: { requestId: loose.id },
    });
    await qs.saveQuoteSheet(supplierA, q2.id, { supplierName: "X" });
    await expect(ps.adoptSheetIntoProduct(admin, q2.id)).rejects.toThrow(
      "no_product",
    );
  });
});
