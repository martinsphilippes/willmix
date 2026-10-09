import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Vários fornecedores por produto: quem responde a cotação entra na lista do
 * produto com o código, preço e MOQ dele; cada fornecedor só recebe, na
 * própria ficha, os próprios dados (isolamento entre fornecedores); a
 * Wellmix inclui, retira e troca o principal.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const ps = await import("@/lib/services/product-suppliers");
const pss = await import("@/lib/services/product-sheet");
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

async function rfqFor(productId: string) {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Produto",
    description: "Teste",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const quotes = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  return {
    request,
    quoteA: quotes.find((q) => q.supplierId === "fornecedor-a")!,
    quoteB: quotes.find((q) => q.supplierId === "fornecedor-b")!,
  };
}

describe("vários fornecedores por produto", () => {
  it("quem responde a cotação entra na lista do produto, sem duplicar", async () => {
    const { quoteB } = await rfqFor("prod-panela");
    await qs.saveQuoteSheet(supplierB, quoteB.id, {
      supplierName: "Guangzhou Supplier B",
      factoryItemCode: "GZB-PAN",
      moq: 800,
    });
    await r.answerQuote(supplierB, quoteB.id, {
      price: 8.75,
      currency: "USD",
      leadTimeDays: 40,
    });
    let link = (await ps.productSupplierLink("prod-panela", "fornecedor-b"))!;
    expect(link.source).toBe("quote");
    expect(link.supplierSku).toBe("GZB-PAN");
    expect(link.price).toBe(8.75);
    expect(link.moq).toBe(800);
    expect(link.leadTimeDays).toBe(40);
    expect(link.quoteCount).toBe(1);
    // Responder de novo a mesma cotação atualiza, não conta outra.
    await r.answerQuote(supplierB, quoteB.id, {
      price: 8.5,
      currency: "USD",
      leadTimeDays: 35,
    });
    link = (await ps.productSupplierLink("prod-panela", "fornecedor-b"))!;
    expect(link.price).toBe(8.5);
    expect(link.quoteCount).toBe(1);
    const rows = await getStore().list("product_suppliers", {
      filter: { productId: "prod-panela", supplierId: "fornecedor-b" },
    });
    expect(rows).toHaveLength(1);
    // A lista mostra o principal primeiro e o B depois.
    const product = (await getStore().get("products", "prod-panela"))!;
    const view = await ps.productSuppliersView(product);
    expect(view.map((v) => [v.supplier.id, v.main])).toEqual([
      ["fornecedor-a", true],
      ["fornecedor-b", false],
    ]);
    expect(view[0].supplierSku).toBe("SZA-PAN5");
    expect(view[1].supplierSku).toBe("GZB-PAN");
  });

  it("cada fornecedor só recebe os próprios dados na ficha (isolamento)", async () => {
    const { quoteA, quoteB } = await rfqFor("prod-panela");
    // B (vinculado pela cotação anterior): código, preço e MOQ dele.
    const b = (await qs.getQuoteSheetForUser(supplierB, quoteB.id))!;
    expect(b.sheet.factoryItemCode).toBe("GZB-PAN");
    expect(b.sheet.price).toBe(8.5);
    expect(b.sheet.moq).toBe(800);
    expect(b.records.productApplies).toBe(true);
    // A (principal): código e preço do produto; nunca os de B.
    const a = (await qs.getQuoteSheetForUser(supplierA, quoteA.id))!;
    expect(a.sheet.factoryItemCode).toBe("SZA-PAN5");
    expect(a.sheet.price).toBe(9.5);
    expect(a.sheet.moq).toBe(500);
  });

  it("fornecedor sem vínculo não recebe preço nem MOQ do principal", async () => {
    const store = getStore();
    await store.update("parties", "fornecedor-c", { type: "supplier" });
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-panela",
      productName: "Panela",
      description: "Teste",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-c"]);
    const [quoteC] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    const c = (await qs.getQuoteSheetForUser(admin, quoteC.id))!;
    expect(c.sheet.price ?? null).toBeNull();
    expect(c.sheet.moq ?? null).toBeNull();
    expect(c.sheet.factoryItemCode ?? null).toBeNull();
  });

  it("escolher a cotação conta no histórico do fornecedor", async () => {
    const { quoteB } = await rfqFor("prod-panela");
    await r.answerQuote(supplierB, quoteB.id, {
      price: 8.4,
      currency: "USD",
      leadTimeDays: 30,
    });
    await r.selectQuote(admin, quoteB.id, {
      sellPrice: 20000,
      sellCurrency: "BRL",
    });
    const link = (await ps.productSupplierLink("prod-panela", "fornecedor-b"))!;
    expect(link.quoteCount).toBe(2);
    expect(link.selectedCount).toBe(1);
    expect(link.lastSelectedAt).toBeTruthy();
  });

  it("Wellmix inclui, troca o principal e retira; o código de cada um fica com ele", async () => {
    const store = getStore();
    await expect(
      ps.addProductSupplier(supplierA, "prod-jarra", "fornecedor-b", null),
    ).rejects.toThrow();
    await ps.addProductSupplier(admin, "prod-jarra", "fornecedor-a", "A-JAR");
    await ps.addProductSupplier(admin, "prod-jarra", "fornecedor-b", "B-JAR");
    await expect(
      ps.addProductSupplier(admin, "prod-jarra", "cliente-joao", null),
    ).rejects.toThrow("supplier_not_found");
    // Ficha mestre da jarra (sem fornecedor) e troca do principal para A.
    await pss.saveProductSheet(admin, "prod-jarra", { material: "GLASS" });
    await ps.setMainSupplier(admin, "prod-jarra", "fornecedor-a");
    let product = (await store.get("products", "prod-jarra"))!;
    expect(product.supplierId).toBe("fornecedor-a");
    expect(product.supplierSku).toBe("A-JAR");
    let master = (await pss.getProductSheet("prod-jarra"))!;
    expect(master.supplierName).toBe("Shenzhen Supplier A");
    expect(master.location).toBe("Shenzhen");
    expect(master.factoryItemCode).toBe("A-JAR");
    // Agora B: o código de A fica no vínculo de A; produto e mestre com o de B.
    await ps.setMainSupplier(admin, "prod-jarra", "fornecedor-b");
    product = (await store.get("products", "prod-jarra"))!;
    expect(product.supplierSku).toBe("B-JAR");
    master = (await pss.getProductSheet("prod-jarra"))!;
    expect(master.factoryItemCode).toBe("B-JAR");
    expect(
      (await ps.productSupplierLink("prod-jarra", "fornecedor-a"))!.supplierSku,
    ).toBe("A-JAR");
    // O principal não sai; outro sai.
    await expect(
      ps.removeProductSupplier(admin, "prod-jarra", "fornecedor-b"),
    ).rejects.toThrow("main_supplier");
    await ps.removeProductSupplier(admin, "prod-jarra", "fornecedor-a");
    expect(
      await ps.productSupplierLink("prod-jarra", "fornecedor-a"),
    ).toBeNull();
    await expect(
      ps.removeProductSupplier(supplierB, "prod-jarra", "fornecedor-b"),
    ).rejects.toThrow();
  });

  it("código salvo na lista vale para o principal também no produto e na mestre", async () => {
    await ps.setProductSupplierCode(
      admin,
      "prod-jarra",
      "fornecedor-b",
      "B-NEW",
    );
    const product = (await getStore().get("products", "prod-jarra"))!;
    expect(product.supplierSku).toBe("B-NEW");
    expect((await pss.getProductSheet("prod-jarra"))!.factoryItemCode).toBe(
      "B-NEW",
    );
    await expect(
      ps.setProductSupplierCode(supplierB, "prod-jarra", "fornecedor-b", "X"),
    ).rejects.toThrow();
  });

  it("ficha de outro fornecedor do produto completa o código no vínculo dele", async () => {
    const store = getStore();
    await ps.addProductSupplier(admin, "prod-jarra", "fornecedor-a", null);
    const { quoteA } = await rfqFor("prod-jarra");
    await qs.saveQuoteSheet(supplierA, quoteA.id, {
      supplierName: "Shenzhen Supplier A",
      factoryItemCode: "A-FROM-SHEET",
    });
    expect(
      (await ps.productSupplierLink("prod-jarra", "fornecedor-a"))!.supplierSku,
    ).toBe("A-FROM-SHEET");
    // O código de A não vai para o produto (o principal é B).
    expect((await store.get("products", "prod-jarra"))!.supplierSku).toBe(
      "B-NEW",
    );
  });
});
