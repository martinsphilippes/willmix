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
const { getSheetForUser, saveSheet, addSheetPhotos } =
  await import("@/lib/services/purchase-sheet");
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
    expect(missing).toEqual(["scalePhoto", "rulerPhoto"]);
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
    const sheetReq = await req(prep.id, "purchase_sheet");
    expect(sheetReq.status).toBe("done");
    expect(sheetReq.value).toContain("7200 pcs");
    expect((await getStore().get("stages", prep.id))!.status).toBe("done");

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
