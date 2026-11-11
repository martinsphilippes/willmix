import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Bloco Fornecedor da ficha vem dos cadastros: local (cidade), nº da loja e
 * telefone do fornecedor; código na fábrica do produto. Ao salvar, o que o
 * cadastro não tinha é gravado nele, sem sobrescrever e sem vazar entre
 * fornecedores.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const ps = await import("@/lib/services/purchase-sheet");
const { orderFromRequest } = await import("./helpers/order");
const sr = await import("@/lib/services/sheet-records");
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

/** Um pedido por fornecedor (A e B) do mesmo produto. */
async function ordersFor(productId: string) {
  const order = async (supplierId: string) => {
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId,
      productName: "Panela",
      description: "Jogo de panelas",
      specification: null,
      // Pedido mínimo da panela (500).
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    return orderFromRequest(admin, request, { supplierId });
  };
  return {
    orderA: await order("fornecedor-a"),
    orderB: await order("fornecedor-b"),
  };
}

describe("ficha: bloco Fornecedor vem dos cadastros", () => {
  it("rascunho traz cidade, nº da loja, telefone e código do produto; o que falta é listado", async () => {
    const { orderA, orderB } = await ordersFor("prod-panela");
    const a = (await ps.getSheetForUser(supplierA, orderA.id))!;
    expect(a.sheet.location).toBe("Shenzhen");
    expect(a.sheet.supplierStore).toBe("A 154678");
    expect(a.sheet.supplierPhone).toBe("+86 755 1234 5678");
    expect(a.sheet.factoryItemCode).toBe("SZA-PAN5");
    expect(a.records.missing).toEqual([]);
    expect(a.records.canEdit).toBe(false);
    // Fornecedor B: tem cidade, não tem loja nem telefone; o código na
    // fábrica é do fornecedor A e não vai para a ficha dele.
    const b = (await ps.getSheetForUser(supplierB, orderB.id))!;
    expect(b.sheet.location).toBe("Guangzhou");
    expect(b.sheet.supplierStore ?? null).toBeNull();
    expect(b.sheet.factoryItemCode ?? null).toBeNull();
    expect(b.records.missing).toEqual(["supplierStore", "supplierPhone"]);
    const bAdmin = (await ps.getSheetForUser(admin, orderB.id))!;
    expect(bAdmin.records.canEdit).toBe(true);
    expect(bAdmin.records.supplierId).toBe("fornecedor-b");
  });

  it("salvar a ficha completa o cadastro sem sobrescrever nem vazar", async () => {
    const store = getStore();
    const { orderA, orderB } = await ordersFor("prod-panela");
    await ps.saveSheet(supplierB, orderB.id, {
      supplierName: "Guangzhou Supplier B",
      location: "YIWU",
      supplierStore: "B 777",
      supplierPhone: "+86 20 0000 0000",
      factoryItemCode: "B-CODE",
    });
    const b = (await store.get("parties", "fornecedor-b"))!;
    expect(b.city).toBe("Guangzhou"); // já tinha: não muda
    expect(b.storeNumber).toBe("B 777");
    expect(b.phone).toBe("+86 20 0000 0000");
    // Produto é do fornecedor A: o código de B não entra no cadastro.
    expect((await store.get("products", "prod-panela"))!.supplierSku).toBe(
      "SZA-PAN5",
    );
    // Produto sem código: o fornecedor dono preenche ao salvar a ficha.
    await store.update("products", "prod-panela", { supplierSku: null });
    await ps.saveSheet(supplierA, orderA.id, {
      supplierName: "Shenzhen Supplier A",
      factoryItemCode: "SZA-NEW",
    });
    expect((await store.get("products", "prod-panela"))!.supplierSku).toBe(
      "SZA-NEW",
    );
    // Nem a Wellmix grava na ficha de B o código no produto de A.
    await store.update("products", "prod-panela", { supplierSku: null });
    await ps.saveSheet(admin, orderB.id, { factoryItemCode: "ADMIN-B" });
    expect(
      (await store.get("products", "prod-panela"))!.supplierSku ?? null,
    ).toBeNull();
    const after = (await ps.getSheetForUser(supplierB, orderB.id))!;
    expect(after.records.missing).toEqual([]);
  });

  it("produto sem fornecedor: código não entra nem vaza entre fornecedores", async () => {
    const store = getStore();
    await store.update("products", "prod-panela", {
      supplierId: null,
      supplierSku: null,
    });
    const { orderA, orderB } = await ordersFor("prod-panela");
    const b0 = (await ps.getSheetForUser(supplierB, orderB.id))!;
    expect(b0.records.missing).not.toContain("factoryItemCode");
    expect(b0.records.productApplies).toBe(false);
    await ps.saveSheet(supplierA, orderA.id, {
      supplierName: "Shenzhen Supplier A",
      factoryItemCode: "A-SECRET-123",
    });
    expect(
      (await store.get("products", "prod-panela"))!.supplierSku ?? null,
    ).toBeNull();
    const b = (await ps.getSheetForUser(supplierB, orderB.id))!;
    // A ficha de B (pedido novo; pode reaproveitar a compra anterior de B) não traz o código de A.
    expect(b.sheet.factoryItemCode ?? null).not.toBe("A-SECRET-123");
    await store.update("products", "prod-panela", {
      supplierId: "fornecedor-a",
      supplierSku: "SZA-PAN5",
    });
  });

  it("ficha gravada com campo em branco mostra o valor do cadastro", async () => {
    const store = getStore();
    const { orderB } = await ordersFor("prod-panela");
    await ps.saveSheet(supplierB, orderB.id, {
      supplierName: "Guangzhou Supplier B",
      location: null,
    });
    await store.update("parties", "fornecedor-b", { city: "Yiwu" });
    const view = (await ps.getSheetForUser(supplierB, orderB.id))!;
    expect(view.saved).toBe(true);
    expect(view.sheet.location).toBe("Yiwu");
    await store.update("parties", "fornecedor-b", { city: "Guangzhou" });
  });

  it("cliente ou fornecedor de fora não grava no cadastro", async () => {
    expect(
      await sr.fillRecordsFromSheet(joao, "fornecedor-c", null, {
        location: "X",
      }),
    ).toEqual([]);
    expect(
      await sr.fillRecordsFromSheet(supplierB, "fornecedor-c", null, {
        location: "X",
      }),
    ).toEqual([]);
    expect((await getStore().get("parties", "fornecedor-c"))!.city).toBe(
      "Ningbo",
    );
  });
});
