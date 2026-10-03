import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { withTempStore } from "./setup";

/* Ficha de compra (planilha COMPRAS) da Preparação. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { submitRequirement } = await import("@/lib/workflow/engine");
const { planSheet, missingForCompletion } =
  await import("@/lib/services/purchase-sheet-calc");
const {
  getSheetForUser,
  saveSheet,
  addSheetPhotos,
  removeSheetPhoto,
  sheetProgress,
  syncPreparationFromSheet,
} = await import("@/lib/services/purchase-sheet");
const { canAccessDocument, catalogShowcasePhotos } =
  await import("@/lib/services/documents");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let broker: User;

const png = async () =>
  new File(
    [
      new Uint8Array(
        await sharp({
          create: { width: 40, height: 40, channels: 3, background: "#c33" },
        })
          .png()
          .toBuffer(),
      ),
    ],
    "balanca.png",
    { type: "image/png" },
  );

/** Pedido do João com fornecedor A, já na Preparação. */
async function orderInPreparation() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste da ficha",
    specification: null,
    quantity: 7200,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 8.5,
    currency: "USD",
    leadTimeDays: 30,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  const order = await r.confirmDownPayment(admin, request.id);
  await store.update("orders", order.id, { brokerId: "despachante" });
  const [created] = await store.list("stages", {
    filter: { orderId: order.id, key: "ORDER_CREATED" },
  });
  for (const req of await store.list("requirements", {
    filter: { stageId: created.id, status: "pending" },
  })) {
    const stage = await store.get("stages", created.id);
    if (stage?.status !== "active") break;
    await submitRequirement(admin, req.id, { value: "OK-1" });
  }
  const [prep] = await store.list("stages", {
    filter: { orderId: order.id, key: "PREPARATION" },
  });
  expect(prep.status).toBe("active");
  return { order: (await store.get("orders", order.id))!, prep };
}

const req = async (stageId: string, key: string) =>
  (await getStore().list("requirements", { filter: { stageId, key } }))[0];

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  broker = users.find((u) => u.email === "despachante@comex.com")!;
});

describe("contas da planilha", () => {
  it("peças, CBM, containers e datas de saída batem com a planilha COMPRAS", () => {
    const plan = planSheet(
      {
        masterCartonQty: 24,
        cbmPerCarton: 0.045,
        productionStartAt: "2026-11-10T00:00:00.000Z",
        heightCm: 25,
        widthCm: 34,
        lengthCm: 50,
        lots: [
          { departureIntervalDays: 30, masterCartons: 100 },
          { departureIntervalDays: 45, masterCartons: 100 },
          { departureIntervalDays: 45, masterCartons: 100 },
        ],
      },
      68,
    );
    expect(plan.lots.map((l) => l.pieces)).toEqual([2400, 2400, 2400]);
    expect(plan.lots.map((l) => l.cbm)).toEqual([4.5, 4.5, 4.5]);
    expect(plan.lots.map((l) => l.departureAt)).toEqual([
      "2026-12-10",
      "2027-01-24",
      "2027-03-10",
    ]);
    expect(plan.totalPieces).toBe(7200);
    expect(plan.totalCbm).toBe(13.5);
    expect(plan.containers).toBe(0.1985);
    expect(plan.cbmFromSize).toBe(0.0425);
  });

  it("lista o que falta para concluir", () => {
    expect(missingForCompletion(null, [])).toEqual(
      expect.arrayContaining([
        "supplierName",
        "price",
        "lot1",
        "scalePhoto",
        "rulerPhoto",
      ]),
    );
  });
});

describe("ficha no pedido", () => {
  it("acesso: fornecedor do pedido e despachante veem; cliente e outro fornecedor não", async () => {
    const { order } = await orderInPreparation();
    const view = await getSheetForUser(supplierA, order.id);
    expect(view?.access.editSupplier).toBe(true);
    expect(view?.saved).toBe(false);
    // Rascunho vem do cadastro e da cotação.
    expect(view?.sheet.price).toBe(8.5);
    expect(view?.sheet.currency).toBe("USD");
    expect(await getSheetForUser(joao, order.id)).toBeNull();
    expect(await getSheetForUser(supplierB, order.id)).toBeNull();
    const brokerView = await getSheetForUser(broker, order.id);
    expect(brokerView?.access).toMatchObject({
      editSupplier: false,
      editCustoms: true,
    });
    await expect(saveSheet(joao, order.id, { price: 1 })).rejects.toThrow(
      "forbidden",
    );
  });

  it("ficha completa + foto na balança concluem a Preparação; peso vem da ficha", async () => {
    const { order, prep } = await orderInPreparation();
    const { missing } = await saveSheet(supplierA, order.id, {
      supplierName: "YIWU WUJO INTL",
      supplierStore: "A 154678",
      incoterm: "EXW",
      currency: "USD",
      price: 8.5,
      moq: 6000,
      masterCartonQty: 24,
      innerQty: 6,
      netWeightPcKg: 0.14,
      grossWeightPcKg: 0.16,
      cbmPerCarton: 0.045,
      heightCm: 25,
      widthCm: 34,
      lengthCm: 50,
      capacityMl: 200,
      packageType: "COLOR BOX",
      colorAssortment: "WHITE / BLACK / RED",
      material: "PLASTIC / IRON",
      powerSource: "battery",
      powerDetail: "12V",
      productionStartAt: "2026-11-10T00:00:00.000Z",
      lots: [
        { departureIntervalDays: 30, masterCartons: 100 },
        { departureIntervalDays: 45, masterCartons: 100 },
        { departureIntervalDays: 45, masterCartons: 100 },
      ],
      // Fornecedor não edita a parte do despachante: ignorado.
      ncm: "9999.99.99",
    });
    expect(missing).toEqual([
      "scalePhoto",
      "rulerPhoto",
      "sidePhoto",
      "anglePhoto",
      "originalPhoto",
    ]);
    // Preparação tem só a ficha de compra.
    expect(
      (
        await getStore().list("requirements", { filter: { stageId: prep.id } })
      ).map((x) => x.key),
    ).toEqual(["purchase_sheet"]);
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");

    await addSheetPhotos(supplierA, order.id, "weight_scale", [await png()]);
    // Só a balança não basta: falta a régua (medida com escala).
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");
    await addSheetPhotos(supplierA, order.id, "dimension_scale", [await png()]);
    await addSheetPhotos(supplierA, order.id, "dimension_side", [
      await png(),
      await png(),
    ]);
    // As 5 fotos do produto são obrigatórias; referência e cartão não são do fornecedor.
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");
    await expect(
      addSheetPhotos(supplierA, order.id, "business_card" as never, [
        await png(),
      ]),
    ).rejects.toThrow("invalid_kind");
    await addSheetPhotos(supplierA, order.id, "angle", [await png()]);
    // Cartão de visita enviado à ficha antes da mudança: segue visível e
    // excluível, mas não é obrigatório nem conta como foto do produto: com 4
    // fotos do produto + o cartão, ainda falta a original.
    const { getSheetPhotos } = await import("@/lib/services/purchase-sheet");
    const legacy = await getStore().create("product_photos", {
      productId: null,
      sourcingItemId: null,
      orderId: order.id,
      documentId: "doc-antigo",
      kind: "business_card",
      caption: null,
      takenAt: null,
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      isPrimary: false,
    });
    expect((await getSheetPhotos(order.id)).map((p) => p.kind)).toContain(
      "business_card",
    );
    expect((await getSheetForUser(admin, order.id))!.missing).toEqual([
      "originalPhoto",
    ]);
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");
    await addSheetPhotos(supplierA, order.id, "original", [await png()]);
    const sheetReq = await req(prep.id, "purchase_sheet");
    expect(sheetReq.status).toBe("done");
    expect(sheetReq.value).toContain("7200 pcs");
    expect((await getStore().get("stages", prep.id))!.status).toBe("done");
    // Excluir a foto antiga não mexe no que já está concluído.
    await removeSheetPhoto(admin, order.id, legacy.id);
    expect((await getSheetPhotos(order.id)).map((p) => p.kind)).not.toContain(
      "business_card",
    );
    expect((await req(prep.id, "purchase_sheet")).status).toBe("done");

    // Despachante preenche só NCM/impostos.
    await saveSheet(broker, order.id, {
      ncm: "8516.79.90",
      importTaxPercent: 18,
      price: 1,
    });
    const view = (await getSheetForUser(admin, order.id))!;
    expect(view.sheet.ncm).toBe("8516.79.90");
    expect(view.sheet.importTaxPercent).toBe(18);
    expect(view.sheet.price).toBe(8.5);
    expect(view.missing).toEqual([]);
    expect(view.photos.filter((p) => p.kind === "dimension_side")).toHaveLength(
      2,
    );

    // Fotos da ficha: fornecedor abre; cliente não; não vão para o catálogo.
    const doc = (await getStore().get("documents", view.photos[0].documentId))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(joao, doc)).toBe(false);
    const showcase = await catalogShowcasePhotos(["prod-jarra"]);
    expect(
      (showcase.get("prod-jarra") ?? []).some((p) => p.documentId === doc.id),
    ).toBe(false);
  });
});

describe("excluir foto da ficha", () => {
  it("fornecedor do pedido exclui; cliente e outro fornecedor não; some da ficha e dos documentos", async () => {
    const { order } = await orderInPreparation();
    await addSheetPhotos(supplierA, order.id, "angle", [
      await png(),
      await png(),
    ]);
    let view = (await getSheetForUser(supplierA, order.id))!;
    const [first] = view.photos.filter((p) => p.kind === "angle");
    await expect(removeSheetPhoto(joao, order.id, first.id)).rejects.toThrow();
    await expect(
      removeSheetPhoto(supplierB, order.id, first.id),
    ).rejects.toThrow();
    // Foto de outro pedido não é removida por este.
    await expect(
      removeSheetPhoto(supplierA, "outro-pedido", first.id),
    ).rejects.toThrow("not_found");

    await removeSheetPhoto(supplierA, order.id, first.id);
    view = (await getSheetForUser(supplierA, order.id))!;
    expect(view.photos.filter((p) => p.kind === "angle")).toHaveLength(1);
    expect(await getStore().get("documents", first.documentId)).toBeNull();
    const audit = await getStore().list("audit_log", {
      filter: { action: "purchase_sheet.photo_remove" },
    });
    expect(audit.length).toBeGreaterThan(0);
  });
});

describe("ficha completa com a Preparação parada", () => {
  it("sincronizar conclui o requisito e a etapa; só para quem pode preenchê-lo", async () => {
    const { order, prep } = await orderInPreparation();
    const { missing } = await saveSheet(supplierA, order.id, {
      supplierName: "YIWU WUJO INTL",
      supplierStore: "A 154678",
      incoterm: "EXW",
      currency: "USD",
      price: 8.5,
      moq: 6000,
      masterCartonQty: 24,
      innerQty: 6,
      netWeightPcKg: 0.14,
      grossWeightPcKg: 0.16,
      cbmPerCarton: 0.045,
      heightCm: 25,
      widthCm: 34,
      lengthCm: 50,
      capacityMl: 200,
      packageType: "COLOR BOX",
      colorAssortment: "WHITE / BLACK / RED",
      material: "PLASTIC / IRON",
      powerSource: "battery",
      powerDetail: "12V",
      productionStartAt: "2026-11-10T00:00:00.000Z",
      lots: [{ departureIntervalDays: 30, masterCartons: 100 }],
    });
    expect(missing).toEqual([
      "scalePhoto",
      "rulerPhoto",
      "sidePhoto",
      "anglePhoto",
      "originalPhoto",
    ]);
    for (const kind of [
      "weight_scale",
      "dimension_scale",
      "dimension_side",
      "angle",
    ] as const)
      await addSheetPhotos(supplierA, order.id, kind, [await png()]);
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");
    // A última foto entra sem passar pela ficha (como quando a regra muda depois
    // de a ficha ser salva): a ficha fica completa, mas nada sincronizou.
    await getStore().create("product_photos", {
      productId: null,
      sourcingItemId: null,
      orderId: order.id,
      documentId: "doc-original",
      kind: "original",
      caption: null,
      takenAt: null,
      takenByUserId: supplierA.id,
      derivedFromPhotoId: null,
      isPrimary: false,
    });
    expect((await sheetProgress(order)).missing).toEqual([]);
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");
    // Cliente não preenche requisito do fornecedor: a sincronização não age.
    await syncPreparationFromSheet(joao, order.id);
    expect((await req(prep.id, "purchase_sheet")).status).toBe("pending");
    // Wellmix (ou o fornecedor) abre o pedido: a Preparação se conclui.
    await syncPreparationFromSheet(admin, order.id);
    expect((await req(prep.id, "purchase_sheet")).status).toBe("done");
    expect((await getStore().get("stages", prep.id))!.status).toBe("done");
  });
});
