import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Troca do fornecedor principal (botão, cadastro do produto e ficha mestre):
 * nenhum fornecedor herda código, preço, moeda ou MOQ de outro; o que o
 * usuário digitou no mesmo envio fica; tabela ausente vira schema_outdated.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const ps = await import("@/lib/services/product-suppliers");
const pss = await import("@/lib/services/product-sheet");
const catalog = await import("@/app/app/actions/catalog");
const sheetActions = await import("@/app/app/actions/purchase-sheet");
const { errorCode } = await import("@/app/app/actions/helpers");
type User = import("@/lib/db").User;
type Product = import("@/lib/db").Product;

let admin: User;
let joao: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  h.current = admin;
});

/** Formulário do cadastro do produto com os valores atuais (como a tela envia). */
function productForm(p: Product, change: Record<string, string> = {}) {
  const f = new FormData();
  const v = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  const fields: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    lineId: p.lineId,
    sku: p.sku,
    category: p.category,
    specification: p.specification,
    supplierId: p.supplierId,
    supplierSku: p.supplierSku,
    price: p.price,
    currency: p.currency,
    moq: p.moq,
    material: p.material,
    color: p.color,
    pantone: p.pantone,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    netWeightKg: p.netWeightKg,
    grossWeightKg: p.grossWeightKg,
    masterBoxQty: p.masterBoxQty,
    innerBoxQty: p.innerBoxQty,
    boxLengthCm: p.boxLengthCm,
    boxWidthCm: p.boxWidthCm,
    boxHeightCm: p.boxHeightCm,
    cbm: p.cbm,
    notes: p.notes,
  };
  for (const [k, x] of Object.entries({ ...fields, ...change })) f.set(k, v(x));
  f.append("active", "off");
  f.append("active", "on");
  return f;
}

async function quoteSheetFor(productId: string, supplierId: string) {
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
  await r.openRfq(admin, request.id, [supplierId]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  return quote;
}

describe("troca do fornecedor principal", () => {
  it("botão: o novo principal não herda preço, moeda nem MOQ do antigo", async () => {
    const store = getStore();
    await ps.addProductSupplier(
      admin,
      "prod-panela",
      "fornecedor-b",
      "GZB-OWN",
    );
    await ps.setMainSupplier(admin, "prod-panela", "fornecedor-b");
    const product = (await store.get("products", "prod-panela"))!;
    expect(product.supplierId).toBe("fornecedor-b");
    expect(product.supplierSku).toBe("GZB-OWN");
    expect(product.price).toBeNull();
    expect(product.moq).toBeNull();
    const a = (await ps.productSupplierLink("prod-panela", "fornecedor-a"))!;
    expect([a.supplierSku, a.price, a.currency, a.moq]).toEqual([
      "SZA-PAN5",
      9.5,
      "USD",
      500,
    ]);
    // A ficha da cotação de B não traz nada de A.
    const quote = await quoteSheetFor("prod-panela", "fornecedor-b");
    const b = (await qs.getQuoteSheetForUser(supplierB, quote.id))!;
    expect(b.sheet.price ?? null).toBeNull();
    expect(b.sheet.moq ?? null).toBeNull();
    expect(b.sheet.factoryItemCode).toBe("GZB-OWN");
    // De volta para A: os dados dele voltam do vínculo.
    await ps.setMainSupplier(admin, "prod-panela", "fornecedor-a");
    const back = (await store.get("products", "prod-panela"))!;
    expect([back.supplierSku, back.price, back.currency, back.moq]).toEqual([
      "SZA-PAN5",
      9.5,
      "USD",
      500,
    ]);
  });

  it("atualização vazia não vai ao banco (Appwrite recusa)", async () => {
    const store = getStore();
    const real = store.update.bind(store);
    const spy = vi
      .spyOn(store, "update")
      .mockImplementation(async (table, id, patch) => {
        if (table === "product_suppliers" && !Object.keys(patch).length)
          throw new Error("empty update");
        return real(table, id, patch);
      });
    try {
      await ps.setMainSupplier(admin, "prod-panela", "fornecedor-b");
      expect((await store.get("products", "prod-panela"))!.supplierSku).toBe(
        "GZB-OWN",
      );
      await ps.addProductSupplier(admin, "prod-panela", "fornecedor-a", null);
    } finally {
      spy.mockRestore();
      await ps.setMainSupplier(admin, "prod-panela", "fornecedor-a");
    }
  });

  it("cadastro do produto: trocar só o fornecedor não leva o código do antigo", async () => {
    const store = getStore();
    // Boneca: principal B (GZB-DOLL30); A também fornece, com o código dele.
    await ps.addProductSupplier(admin, "prod-boneca", "fornecedor-a", "A-DOLL");
    const before = (await store.get("products", "prod-boneca"))!;
    await catalog.updateProductSheetAction(
      productForm(before, { supplierId: "fornecedor-a" }),
    );
    const after = (await store.get("products", "prod-boneca"))!;
    expect(after.supplierId).toBe("fornecedor-a");
    expect(after.supplierSku).toBe("A-DOLL");
    expect(after.price).toBeNull();
    expect(after.moq).toBeNull();
    expect(
      (await ps.productSupplierLink("prod-boneca", "fornecedor-a"))!
        .supplierSku,
    ).toBe("A-DOLL");
    const b = (await ps.productSupplierLink("prod-boneca", "fornecedor-b"))!;
    expect([b.supplierSku, b.price, b.moq]).toEqual(["GZB-DOLL30", 3.2, 2000]);
  });

  it("cadastro do produto: preço digitado junto com a troca fica", async () => {
    const store = getStore();
    const before = (await store.get("products", "prod-boneca"))!;
    await catalog.updateProductSheetAction(
      productForm(before, {
        supplierId: "fornecedor-b",
        price: "4.1",
        supplierSku: "GZB-DOLL31",
      }),
    );
    const after = (await store.get("products", "prod-boneca"))!;
    expect(after.supplierId).toBe("fornecedor-b");
    expect(after.price).toBe(4.1);
    expect(after.moq).toBe(2000);
    expect(after.supplierSku).toBe("GZB-DOLL31");
  });

  it("ficha mestre: escolher outro fornecedor troca o bloco e não grava dado do antigo no cadastro dele", async () => {
    const store = getStore();
    await store.update("parties", "fornecedor-b", { phone: null });
    await pss.saveProductSheet(admin, "prod-panela", {
      supplierName: "Shenzhen Supplier A",
      location: "Shenzhen",
      supplierPhone: "+86 755 1234 5678",
      factoryItemCode: "SZA-PAN5",
      price: 9.5,
      currency: "USD",
      moq: 500,
    });
    const f = new FormData();
    f.set("productId", "prod-panela");
    f.set("supplierId", "fornecedor-b");
    // Formulário como a tela tinha (dados de A), só o seletor mudou.
    f.set("supplierName", "Shenzhen Supplier A");
    f.set("location", "Shenzhen");
    f.set("supplierPhone", "+86 755 1234 5678");
    f.set("factoryItemCode", "SZA-PAN5");
    f.set("price", "9.5");
    f.set("currency", "USD");
    f.set("moq", "500");
    await sheetActions.saveProductSheetAction(f);
    const master = (await pss.getProductSheet("prod-panela"))!;
    expect(master.supplierName).toBe("Guangzhou Supplier B");
    expect(master.location).toBe("Guangzhou");
    expect(master.supplierPhone ?? null).toBeNull();
    expect(master.factoryItemCode).toBe("GZB-OWN");
    expect(master.price ?? null).toBeNull();
    expect(master.moq ?? null).toBeNull();
    // O telefone de A não foi parar no cadastro de B.
    expect(
      (await store.get("parties", "fornecedor-b"))!.phone ?? null,
    ).toBeNull();
    const product = (await store.get("products", "prod-panela"))!;
    expect(product.supplierId).toBe("fornecedor-b");
    expect(product.price).toBeNull();
  });

  it("produto sem principal: escolher o fornecedor mantém preço, moeda, MOQ e código", async () => {
    const store = getStore();
    await store.update("products", "prod-jarra", {
      supplierId: null,
      supplierSku: "JAR-01",
      price: 5,
      currency: "USD",
      moq: 100,
    });
    await pss.saveProductSheet(admin, "prod-jarra", {
      price: 5,
      currency: "USD",
      moq: 100,
      factoryItemCode: "JAR-01",
    });
    // Pelo botão (serviço): nada some.
    await ps.setMainSupplier(admin, "prod-jarra", "fornecedor-c");
    let product = (await store.get("products", "prod-jarra"))!;
    expect([product.price, product.currency, product.moq]).toEqual([
      5,
      "USD",
      100,
    ]);
    expect(product.supplierSku).toBe("JAR-01");
    let master = (await pss.getProductSheet("prod-jarra"))!;
    expect([master.price, master.currency, master.moq]).toEqual([
      5,
      "USD",
      100,
    ]);
    // Pela ficha mestre (seletor), produto de novo sem principal.
    await store.update("products", "prod-jarra", { supplierId: null });
    const f = new FormData();
    f.set("productId", "prod-jarra");
    f.set("supplierId", "fornecedor-a");
    f.set("supplierName", "");
    f.set("price", "5");
    f.set("currency", "USD");
    f.set("moq", "100");
    f.set("factoryItemCode", "JAR-01");
    await sheetActions.saveProductSheetAction(f);
    product = (await store.get("products", "prod-jarra"))!;
    master = (await pss.getProductSheet("prod-jarra"))!;
    expect(product.supplierId).toBe("fornecedor-a");
    expect([product.price, product.currency, product.moq]).toEqual([
      5,
      "USD",
      100,
    ]);
    expect([master.price, master.currency, master.moq]).toEqual([
      5,
      "USD",
      100,
    ]);
    expect(master.supplierName).toBe("Shenzhen Supplier A");
    // Código digitado sem fornecedor fica (o vínculo de A não tem outro).
    expect(master.factoryItemCode).toBe("JAR-01");
    expect(product.supplierSku).toBe("JAR-01");
  });

  it("tabela ausente no Appwrite vira schema_outdated", () => {
    expect(
      errorCode(
        "/x",
        new Error(
          "Table with the requested ID 'product_suppliers' could not be found.",
        ),
      ),
    ).toBe("schema_outdated");
    const typed = Object.assign(new Error("Not found"), {
      type: "table_not_found",
    });
    expect(errorCode("/x", typed)).toBe("schema_outdated");
    expect(errorCode("/x", new Error("Something else broke."))).toBe(
      "unexpected",
    );
  });
});
