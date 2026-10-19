import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Limpar dados de teste (só vendas): apaga solicitações, cotações, pedidos,
 * pagamentos, documentos de venda (com o arquivo), notificações, sugestões da
 * IA e o histórico delas; mantém catálogo, sourcing, programações e cadastros
 * (só desliga o que apontava para uma venda) e recomeça a numeração do #1.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const { uploadDocument } = await import("@/lib/services/documents");
const { saveProductSheet, getProductSheet } =
  await import("@/lib/services/product-sheet");
const { requestProductSuggestion } =
  await import("@/lib/services/ai-suggestions");
const { registerSupplierPayment } =
  await import("@/lib/services/supplier-payment");
const reset = await import("@/lib/services/data-reset");
const { SHEET_PHOTO_KINDS } = await import("@/lib/services/purchase-sheet");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.role === "operator")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

/** Venda completa: solicitação → cotação → pedido, pagamento e documento. */
async function sale() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste da limpeza",
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
  return { request, quote, order };
}

describe("limpar dados de teste (vendas)", () => {
  it("só o admin, com a palavra certa; senão nada muda", async () => {
    await expect(reset.planSalesReset(operator)).rejects.toThrow("forbidden");
    await expect(reset.resetSalesData(operator, "APAGAR")).rejects.toThrow(
      "forbidden",
    );
    await sale();
    const before = (await getStore().list("requests")).length;
    await expect(reset.resetSalesData(admin, "apaga")).rejects.toThrow(
      "reset_confirm",
    );
    expect((await getStore().list("requests")).length).toBe(before);
  });

  it("apaga as vendas, mantém o catálogo e desliga o que apontava para elas", async () => {
    const store = getStore();
    await setSetting("aiMode", "MOCK");
    const { request, order } = await sale();

    // Catálogo: ficha mestre, foto do produto tirada no pedido e foto só do pedido.
    await saveProductSheet(admin, "prod-jarra", { material: "Vidro" });
    const catalogDoc = await uploadDocument(
      admin,
      new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" }),
      { orderId: order.id, productId: "prod-jarra", type: "photo" } as never,
    );
    const catalogPhoto = await store.create("product_photos", {
      productId: "prod-jarra",
      sourcingItemId: null,
      orderId: order.id,
      documentId: catalogDoc.id,
      kind: "original",
      caption: null,
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      primary: false,
    } as never);
    const orderDoc = await uploadDocument(
      admin,
      new File([new Uint8Array([4, 5, 6])], "bl.pdf", {
        type: "application/pdf",
      }),
      { orderId: order.id, type: "bl" } as never,
    );
    const orderPhoto = await store.create("product_photos", {
      productId: null,
      sourcingItemId: null,
      orderId: order.id,
      documentId: orderDoc.id,
      kind: "original",
      caption: null,
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      primary: false,
    } as never);
    // Sourcing pedido pela solicitação e programação que virou pedido.
    await store.update("sourcing_items", "sourcing-boia", {
      requestId: request.id,
    });
    const schedule = await store.create("purchase_schedules", {
      productId: "prod-jarra",
      sourcingItemId: null,
      customerId: "cliente-joao",
      supplierId: null,
      requestId: request.id,
      orderId: order.id,
      sequence: 1,
      quantity: 100,
      unit: "un",
      scheduledFor: null,
      periodLabel: null,
      price: null,
      currency: null,
      status: "ordered",
      notes: null,
      createdByUserId: admin.id,
    } as never);
    // Programação cancelada à mão (ligada só à solicitação): continua cancelada.
    const handCancelled = await store.create("purchase_schedules", {
      productId: "prod-jarra",
      sourcingItemId: null,
      customerId: "cliente-joao",
      supplierId: null,
      requestId: request.id,
      orderId: null,
      sequence: 2,
      quantity: 50,
      unit: "un",
      scheduledFor: null,
      periodLabel: null,
      price: null,
      currency: null,
      status: "cancelled",
      notes: null,
      createdByUserId: admin.id,
    } as never);
    await registerSupplierPayment(admin, order.id, {
      method: "transfer_copied",
    });
    await requestProductSuggestion(admin, "product", "prod-jarra");
    // Foto que o fornecedor mandou na cotação (documento sem pedido).
    const [quoteOfSale] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    // (Mesmo formato que addQuoteSheetPhotos grava: documento sem pedido,
    // foto ligada à cotação.)
    const quoteFile = await uploadDocument(
      supplierA,
      new File([new Uint8Array([7, 8, 9])], "q.png", { type: "image/png" }),
      { type: "photo", visibility: "internal" } as never,
    );
    const quotePhoto = await store.create("product_photos", {
      productId: null,
      sourcingItemId: null,
      orderId: quoteOfSale.id,
      documentId: quoteFile.id,
      kind: SHEET_PHOTO_KINDS[0],
      caption: null,
      takenByUserId: supplierA.id,
      derivedFromPhotoId: null,
      isPrimary: false,
    } as never);
    const quoteDoc = (await store.get("documents", quotePhoto.documentId))!;
    // Sourcing sob demanda criado pela solicitação de teste.
    const demand = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Boia nova",
      description: "Fora do catálogo",
      specification: null,
      quantity: 50,
      unit: "un",
      deadline: null,
      notes: null,
      origin: "sourcing_demand",
    });
    const [demandItem] = await store.list("sourcing_items", {
      filter: { requestId: demand.id },
    });
    expect(demandItem).toBeTruthy();
    // Arte de kit (tem o produto, mas é da venda do kit).
    const kitDoc = await uploadDocument(
      admin,
      new File([new Uint8Array([1])], "arte.png", { type: "image/png" }),
      { kitId: "kit-x", productId: "prod-jarra", type: "photo" } as never,
    );
    // Ficha de cotação que sobrou de uma rodada que parou no meio.
    const leftover = await store.create("purchase_sheets", {
      orderId: "cotacao-apagada",
      productId: "prod-jarra",
    } as never);

    const plan = await reset.planSalesReset(admin);
    expect(plan.remove.sourcing).toBe(1);
    expect(plan.remove.requests).toBeGreaterThanOrEqual(2);
    expect(plan.remove.orders).toBeGreaterThanOrEqual(2);
    expect(plan.remove.payments).toBeGreaterThanOrEqual(1);
    expect(plan.remove.aiSuggestions).toBe(1);
    expect(plan.remove.documents).toBeGreaterThanOrEqual(1);
    expect(plan.unlink).toBeGreaterThan(0);
    const productsBefore = (await store.list("products")).length;
    const partiesBefore = (await store.list("parties")).length;
    const usersBefore = (await store.list("users")).length;

    const done = await reset.resetSalesData(admin, " apagar ");
    expect(done.total).toBe(plan.total);

    // Vendas: nada sobra.
    for (const table of [
      "requests",
      "quotes",
      "orders",
      "order_items",
      "stages",
      "requirements",
      "payments",
      "notifications",
      "ai_suggestions",
    ] as const)
      expect(await store.list(table), table).toHaveLength(0);
    expect(
      await store.list("purchase_sheets", { filter: { orderId: order.id } }),
    ).toHaveLength(0);
    // Documento do pedido saiu com o arquivo; a foto só do pedido também.
    expect(await store.get("documents", orderDoc.id)).toBeNull();
    expect(await store.statFile(orderDoc.storageKey)).toBeNull();
    expect(await store.get("product_photos", orderPhoto.id)).toBeNull();
    // Foto da cotação, item de sourcing sob demanda, arte do kit e ficha que
    // sobrou: também saem.
    expect(await store.get("documents", quoteDoc.id)).toBeNull();
    expect(await store.statFile(quoteDoc.storageKey)).toBeNull();
    expect(await store.get("sourcing_items", demandItem.id)).toBeNull();
    expect(await store.get("documents", kitDoc.id)).toBeNull();
    expect(await store.get("purchase_sheets", leftover.id)).toBeNull();

    // Catálogo e cadastros ficam.
    expect((await store.list("products")).length).toBe(productsBefore);
    expect((await store.list("parties")).length).toBe(partiesBefore);
    expect((await store.list("users")).length).toBe(usersBefore);
    expect((await getProductSheet("prod-jarra"))?.material).toBe("Vidro");
    const keptPhoto = await store.get("product_photos", catalogPhoto.id);
    expect(keptPhoto?.orderId).toBeNull();
    const keptDoc = await store.get("documents", catalogDoc.id);
    expect(keptDoc?.orderId).toBeNull();
    expect(await store.statFile(catalogDoc.storageKey)).not.toBeNull();

    // O que fica perde só a ligação com a venda.
    expect(
      (await store.get("sourcing_items", "sourcing-boia"))?.requestId,
    ).toBe(null);
    const keptSchedule = await store.get("purchase_schedules", schedule.id);
    expect(keptSchedule).toMatchObject({
      requestId: null,
      orderId: null,
      status: "planned",
    });
    expect(
      await store.get("purchase_schedules", handCancelled.id),
    ).toMatchObject({ requestId: null, status: "cancelled" });
    const links = await store.list("product_suppliers", {
      filter: { productId: "prod-jarra" },
    });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.lastQuoteId ?? null).toBeNull();
      expect(link.quoteCount).toBe(0);
    }

    // Histórico: sai o das vendas; a limpeza fica registrada.
    const history = await store.list("audit_log");
    expect(history.some((a) => a.entityId === order.id)).toBe(false);
    expect(history.some((a) => a.entity === "request")).toBe(false);
    expect(history.some((a) => a.action === "data.reset")).toBe(true);

    // Numeração recomeça do #1.
    const { request: next, order: nextOrder } = await sale();
    expect(next.number).toBe(1);
    expect(nextOrder.number).toBe(1);
  });

  it("rodar de novo só apaga o que sobrou (continua se parou no meio)", async () => {
    await reset.resetSalesData(admin, "APAGAR");
    const plan = await reset.planSalesReset(admin);
    expect(plan.total).toBe(0);
    await expect(reset.resetSalesData(admin, "APAGAR")).resolves.toMatchObject({
      total: 0,
    });
  });
});
