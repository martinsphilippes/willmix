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
const qs = await import("@/lib/services/quote-sheet");
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

async function rfqFor(productId: string) {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Panela",
    description: "Jogo de panelas",
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
    quoteA: quotes.find((q) => q.supplierId === "fornecedor-a")!,
    quoteB: quotes.find((q) => q.supplierId === "fornecedor-b")!,
  };
}

describe("ficha: bloco Fornecedor vem dos cadastros", () => {
  it("rascunho traz cidade, nº da loja, telefone e código do produto; o que falta é listado", async () => {
    const { quoteA, quoteB } = await rfqFor("prod-panela");
    const a = (await qs.getQuoteSheetForUser(supplierA, quoteA.id))!;
    expect(a.sheet.location).toBe("Shenzhen");
    expect(a.sheet.supplierStore).toBe("A 154678");
    expect(a.sheet.supplierPhone).toBe("+86 755 1234 5678");
    expect(a.sheet.factoryItemCode).toBe("SZA-PAN5");
    expect(a.records.missing).toEqual([]);
    expect(a.records.canEdit).toBe(false);
    // Fornecedor B: tem cidade, não tem loja nem telefone; o código na
    // fábrica é do fornecedor A e não vai para a ficha dele.
    const b = (await qs.getQuoteSheetForUser(supplierB, quoteB.id))!;
    expect(b.sheet.location).toBe("Guangzhou");
    expect(b.sheet.supplierStore ?? null).toBeNull();
    expect(b.sheet.factoryItemCode ?? null).toBeNull();
    expect(b.records.missing).toEqual(["supplierStore", "supplierPhone"]);
    const bAdmin = (await qs.getQuoteSheetForUser(admin, quoteB.id))!;
    expect(bAdmin.records.canEdit).toBe(true);
    expect(bAdmin.records.supplierId).toBe("fornecedor-b");
  });

  it("salvar a ficha completa o cadastro sem sobrescrever nem vazar", async () => {
    const store = getStore();
    const { quoteA, quoteB } = await rfqFor("prod-panela");
    await qs.saveQuoteSheet(supplierB, quoteB.id, {
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
    await qs.saveQuoteSheet(supplierA, quoteA.id, {
      supplierName: "Shenzhen Supplier A",
      factoryItemCode: "SZA-NEW",
    });
    expect((await store.get("products", "prod-panela"))!.supplierSku).toBe(
      "SZA-NEW",
    );
    const after = (await qs.getQuoteSheetForUser(supplierB, quoteB.id))!;
    expect(after.records.missing).toEqual([]);
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
