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
  it("produto do catálogo: a cotação não mexe no cadastro; o pedido atualiza", async () => {
    const store = getStore();
    const masterBefore = await pm.getProductSheet("prod-jarra");
    const { request, qa, qb } = await rfq("prod-jarra", "Jarra");
    await qs.saveQuoteSheet(supplierA, qa.id, {
      price: 2.5,
      currency: "USD",
      masterCartonQty: 24,
      netWeightPcKg: 0.4,
      packageType: "COLOR BOX",
    });
    // Isolamento entre fornecedores: a cotação de A não vai para a ficha mestre,
    // que preenche a cotação de B na mesma RFQ.
    expect((await pm.getProductSheet("prod-jarra"))?.packageType ?? null).toBe(
      masterBefore?.packageType ?? null,
    );
    const sheetB = await qs.getQuoteSheetForUser(supplierB, qb.id);
    expect(sheetB?.sheet.packageType ?? null).not.toBe("COLOR BOX");

    // Pedido fechado: a ficha da compra atualiza o cadastro (produto sem
    // fornecedor principal: a compra de verdade vale).
    await r.answerQuote(supplierA, qa.id, {
      price: 2.5,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qa.id, { sellPrice: 6000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    const master = (await pm.getProductSheet("prod-jarra"))!;
    expect(master.packageType).toBe("COLOR BOX");
    expect(master.netWeightPcKg).toBe(0.4);
    expect((await store.get("products", "prod-jarra"))!.masterBoxQty).toBe(24);
    // Preço é do fornecedor (não é o principal): não vai para a ficha mestre.
    expect(master.price ?? null).toBe(masterBefore?.price ?? null);

    // A Wellmix ajusta a ficha da compra: o cadastro acompanha.
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

  it("ficha mestre nasce com o que o produto já tem; a próxima cotação vem completa", async () => {
    expect(await pm.getProductSheet("prod-boneca")).toBeNull();
    const { request, qb } = await rfq("prod-boneca", "Boneca");
    await qs.saveQuoteSheet(supplierB, qb.id, {
      price: 3.3,
      currency: "USD",
      packageType: "COLOR BOX",
    });
    await r.answerQuote(supplierB, qb.id, {
      price: 3.3,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qb.id, { sellPrice: 9000, sellCurrency: "BRL" });
    await r.confirmDownPayment(admin, request.id);
    // A ficha da compra trouxe só a embalagem nova: o resto do cadastro fica.
    expect(await pm.getProductSheet("prod-boneca")).toMatchObject({
      packageType: "COLOR BOX",
      masterCartonQty: 48,
      material: "PVC atóxico",
      netWeightPcKg: 0.28,
    });
    const next = await rfq("prod-boneca", "Boneca");
    const view = (await qs.getQuoteSheetForUser(supplierA, next.qa.id))!;
    expect(view.sheet).toMatchObject({
      packageType: "COLOR BOX",
      masterCartonQty: 48,
      material: "PVC atóxico",
    });
    // Preço do fornecedor principal (B) não vai para a cotação de A.
    expect(view.sheet.price ?? null).not.toBe(3.3);
  });

  it("salvar um campo na ficha de um pedido antigo não desfaz o cadastro mais novo", async () => {
    const store = getStore();
    const { request, qa } = await rfq("prod-panela", "Panela");
    await qs.saveQuoteSheet(supplierA, qa.id, { price: 9.1, currency: "USD" });
    await r.answerQuote(supplierA, qa.id, {
      price: 9.1,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qa.id, { sellPrice: 9000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    expect((await store.get("products", "prod-panela"))!.price).toBe(9.1);
    // A Wellmix atualiza o cadastro depois da compra…
    await pm.saveProductSheet(admin, "prod-panela", { price: 8.2, moq: 2000 });
    const [entry] = await store.list("audit_log", {
      filter: { entity: "product", entityId: "prod-panela" },
      orderBy: "createdAt",
      direction: "desc",
      limit: 1,
    });
    expect(entry.before).toMatchObject({ price: 9.1, moq: 500 });
    expect(entry.after).toMatchObject({ price: 8.2, moq: 2000 });
    // …e depois salva só o NCM na ficha do pedido antigo.
    await ps.saveSheet(admin, order.id, { ncm: "7323.99.00" });
    const product = (await store.get("products", "prod-panela"))!;
    expect(product).toMatchObject({ price: 8.2, moq: 2000, ncm: "7323.99.00" });
  });

  it("RFQ decidida: quem perdeu não vê na própria cotação os dados do vencedor", async () => {
    const { request, qa, qb } = await rfq("prod-jarra", "Jarra");
    await qs.saveQuoteSheet(supplierA, qa.id, {
      price: 2.4,
      currency: "USD",
      packageType: "SECRET BOX A",
      material: "VIDRO A",
      heightCm: 33,
    });
    await r.answerQuote(supplierA, qa.id, {
      price: 2.4,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.answerQuote(supplierB, qb.id, {
      price: 2.6,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qa.id, { sellPrice: 6000, sellCurrency: "BRL" });
    await r.confirmDownPayment(admin, request.id);
    // O cadastro aprendeu com a compra…
    expect((await pm.getProductSheet("prod-jarra"))!.packageType).toBe(
      "SECRET BOX A",
    );
    // …mas a cotação recusada de B, sem ficha salva, não mostra nada disso.
    const view = (await qs.getQuoteSheetForUser(supplierB, qb.id))!;
    expect(view.sheet.packageType ?? null).not.toBe("SECRET BOX A");
    expect(view.sheet.material ?? null).not.toBe("VIDRO A");
    expect(view.sheet.heightCm ?? null).not.toBe(33);
    expect(view.sheet.price).toBe(2.6);
  });

  it("cadastrar pela ficha duas vezes ao mesmo tempo não duplica o produto", async () => {
    const store = getStore();
    const { request, qa } = await rfq(null, "Copo duplo");
    await qs.saveQuoteSheet(supplierA, qa.id, { price: 1.1, currency: "USD" });
    await r.answerQuote(supplierA, qa.id, {
      price: 1.1,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, qa.id, { sellPrice: 3000, sellCurrency: "BRL" });
    const order = await r.confirmDownPayment(admin, request.id);
    const [a, b] = await Promise.all([
      pm.registerProductFromOrderSheet(admin, order.id, "linha-utilidades"),
      pm.registerProductFromOrderSheet(admin, order.id, "linha-utilidades"),
    ]);
    expect(a).toBe(b);
    const named = (await store.list("products")).filter(
      (p) => p.name === "Copo duplo",
    );
    expect(named).toHaveLength(1);
  });

  it("NCM da ficha só vai para o produto com 8 dígitos", async () => {
    const store = getStore();
    await pm.saveProductSheet(admin, "prod-piscina", { ncm: "95066900" });
    expect((await store.get("products", "prod-piscina"))!.ncm).toBe(
      "9506.69.00",
    );
    await pm.saveProductSheet(admin, "prod-piscina", { ncm: "9506.69.0012" });
    expect((await store.get("products", "prod-piscina"))!.ncm).toBe(
      "9506.69.00",
    );
  });

  it("tirar as cores Pantone da ficha mestre tira do produto (não voltam)", async () => {
    const store = getStore();
    const color = { code: "PANTONE 185 C", hex: "#E4002B" };
    await pm.saveProductSheet(admin, "prod-piscina", {
      colorPantones: [color],
    });
    expect(
      (await store.get("products", "prod-piscina"))!.colorPantones,
    ).toEqual([color]);
    await pm.saveProductSheet(admin, "prod-piscina", { colorPantones: [] });
    expect(
      (await store.get("products", "prod-piscina"))!.colorPantones ?? null,
    ).toBeNull();
    const input = await pm.masterSheetInput("prod-piscina");
    expect(input?.colorPantones ?? []).toEqual([]);
  });
});
