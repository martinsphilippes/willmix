import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Vários fornecedores por produto: cada um na lista do produto com o código,
 * preço e MOQ dele; cada fornecedor só recebe, na própria ficha do pedido,
 * os próprios dados (isolamento entre fornecedores); a Wellmix inclui,
 * retira e troca o principal.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const sheets = await import("@/lib/services/purchase-sheet");
const { orderFromRequest } = await import("./helpers/order");
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

/** Pedido do produto com o fornecedor indicado. */
async function orderWith(productId: string, supplierId: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Produto",
    description: "Teste",
    specification: null,
    // Acima de qualquer pedido mínimo do seed (500, 2000, 300).
    quantity: 2000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  return orderFromRequest(admin, request, { supplierId });
}

describe("vários fornecedores por produto", () => {
  it("Wellmix inclui o fornecedor na lista do produto, sem duplicar", async () => {
    await ps.addProductSupplier(
      admin,
      "prod-panela",
      "fornecedor-b",
      "GZB-PAN",
    );
    let link = (await ps.productSupplierLink("prod-panela", "fornecedor-b"))!;
    await getStore().update("product_suppliers", link.id, {
      price: 8.5,
      currency: "USD",
      moq: 800,
    });
    // Incluir de novo não duplica nem apaga o código.
    await ps.addProductSupplier(admin, "prod-panela", "fornecedor-b", null);
    link = (await ps.productSupplierLink("prod-panela", "fornecedor-b"))!;
    expect(link.supplierSku).toBe("GZB-PAN");
    expect(link.price).toBe(8.5);
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
    const orderA = await orderWith("prod-panela", "fornecedor-a");
    const orderB = await orderWith("prod-panela", "fornecedor-b");
    // B (vinculado antes): código, preço e MOQ dele.
    const b = (await sheets.getSheetForUser(supplierB, orderB.id))!;
    expect(b.sheet.factoryItemCode).toBe("GZB-PAN");
    expect(b.sheet.price).toBe(8.5);
    expect(b.sheet.moq).toBe(800);
    expect(b.records.productApplies).toBe(true);
    // A (principal): código e preço do produto; nunca os de B.
    const a = (await sheets.getSheetForUser(supplierA, orderA.id))!;
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
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    const order = await orderFromRequest(admin, request, {
      supplierId: "fornecedor-c",
    });
    const c = (await sheets.getSheetForUser(admin, order.id))!;
    expect(c.sheet.price ?? null).toBeNull();
    expect(c.sheet.moq ?? null).toBeNull();
    expect(c.sheet.factoryItemCode ?? null).toBeNull();
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
    const orderA = await orderWith("prod-jarra", "fornecedor-a");
    await sheets.saveSheet(supplierA, orderA.id, {
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
