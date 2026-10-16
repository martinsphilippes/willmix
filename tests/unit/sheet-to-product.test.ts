import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * O cadastro do produto acompanha a ficha: a cotação completa o que falta, o
 * pedido (a compra de verdade) atualiza, e produto fora do catálogo vira
 * cadastro com um clique, para a próxima venda já vir preenchida.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const ps = await import("@/lib/services/purchase-sheet");
const pm = await import("@/lib/services/product-sheet");
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

async function rfq(productId: string | null, name: string) {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: `${name} para revenda`,
    quantity: 240,
    unit: "un",
  });
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const quotes = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  const quoteOf = (s: string) => quotes.find((q) => q.supplierId === s)!;
  return { request, qa: quoteOf("fornecedor-a"), qb: quoteOf("fornecedor-b") };
}

describe("cadastro do produto acompanha a ficha", () => {
  it("produto do catálogo: a cotação completa o que falta, sem trocar o que existe", async () => {
    const store = getStore();
    const before = (await store.get("products", "prod-jarra"))!;
    const { request, qa, qb } = await rfq("prod-jarra", "Jarra");
    await qs.saveQuoteSheet(supplierA, qa.id, {
      price: 2.5,
      currency: "USD",
      masterCartonQty: 24,
      netWeightPcKg: 0.4,
      grossWeightPcKg: 0.5,
      packageType: "COLOR BOX",
      material: before.material ? undefined : "GLASS",
    });
    const master = (await pm.getProductSheet("prod-jarra"))!;
    expect(master.netWeightPcKg).toBe(before.netWeightKg ?? 0.4);
    expect(master.packageType).toBe("COLOR BOX");
    // Preço é do fornecedor (não é o principal): não vai para a ficha mestre.
    expect(master.price ?? null).toBe(before.price ?? null);
    const product = (await store.get("products", "prod-jarra"))!;
    expect(product.masterBoxQty).toBe(before.masterBoxQty ?? 24);

    // Outro fornecedor com outro dado: a cotação só completa, não troca.
    await qs.saveQuoteSheet(supplierB, qb.id, { packageType: "BROWN BOX" });
    expect((await pm.getProductSheet("prod-jarra"))!.packageType).toBe(
      "COLOR BOX",
    );

    // Pedido fechado e a Wellmix ajusta a ficha da compra: o cadastro atualiza
    // (produto sem fornecedor principal: a compra de verdade vale).
    await r.answerQuote(supplierA, qa.id, {
      price: 2.5,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qa.id, { sellPrice: 6000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    await ps.saveSheet(admin, order.id, { packageType: "GIFT BOX" });
    expect((await pm.getProductSheet("prod-jarra"))!.packageType).toBe(
      "GIFT BOX",
    );
    // O fornecedor, na ficha do pedido, só completa o que falta.
    await ps.saveSheet(supplierA, order.id, { packageType: "PLAIN BOX" });
    expect((await pm.getProductSheet("prod-jarra"))!.packageType).toBe(
      "GIFT BOX",
    );
  });

  it("produto com fornecedor principal: compra com outro fornecedor não troca os dados do principal", async () => {
    const store = getStore();
    const panelaBefore = (await pm.getProductSheet("prod-panela")) ?? null;
    const { request, qb } = await rfq("prod-panela", "Panela");
    await qs.saveQuoteSheet(supplierB, qb.id, {
      price: 9,
      currency: "USD",
      material: "AÇO INOX",
    });
    await r.answerQuote(supplierB, qb.id, {
      price: 9,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qb.id, { sellPrice: 9000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    await ps.saveSheet(admin, order.id, { material: "AÇO INOX 304" });
    const product = (await store.get("products", "prod-panela"))!;
    // O principal (fornecedor A) tinha material: continua o dele.
    expect(product.material).toBe("Alumínio com revestimento antiaderente");
    expect(product.price ?? null).not.toBe(9);
    void panelaBefore;
  });

  it("produto fora do catálogo: cadastra com a ficha do pedido e passa a ser o produto da solicitação", async () => {
    const store = getStore();
    const { request, qa } = await rfq(null, "Copo térmico");
    await qs.saveQuoteSheet(supplierA, qa.id, {
      price: 1.2,
      currency: "USD",
      masterCartonQty: 60,
      netWeightPcKg: 0.2,
      material: "AÇO INOX",
    });
    await r.answerQuote(supplierA, qa.id, {
      price: 1.2,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qa.id, { sellPrice: 3000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    await expect(
      pm.registerProductFromOrderSheet(joao, order.id, "linha-utilidades"),
    ).rejects.toThrow();
    await expect(
      pm.registerProductFromOrderSheet(admin, order.id, "nao-existe"),
    ).rejects.toThrow("invalid_line");

    const productId = await pm.registerProductFromOrderSheet(
      admin,
      order.id,
      "linha-utilidades",
    );
    const product = (await store.get("products", productId))!;
    expect(product).toMatchObject({
      name: "Copo térmico",
      lineId: "linha-utilidades",
      supplierId: "fornecedor-a",
      material: "AÇO INOX",
      masterBoxQty: 60,
    });
    expect((await store.get("requests", request.id))!.productId).toBe(
      productId,
    );
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(item.productId).toBe(productId);
    // Fornecedor do pedido é o principal: preço também vai para a ficha mestre.
    expect((await pm.getProductSheet(productId))!.price).toBe(1.2);
    // De novo: o mesmo produto, sem duplicar.
    expect(
      await pm.registerProductFromOrderSheet(
        admin,
        order.id,
        "linha-utilidades",
      ),
    ).toBe(productId);
  });
});
