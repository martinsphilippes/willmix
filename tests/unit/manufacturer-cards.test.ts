import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cartão do fabricante: fica no produto (vários por produto). Só a Wellmix e
 * o próprio fornecedor veem; o cliente e outro fornecedor nunca. (O cartão
 * na cotação saiu com a RFQ em 11/11/2026.)
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const cards = await import("@/lib/services/manufacturer-cards");
const { canAccessDocument, uploadDocument } =
  await import("@/lib/services/documents");
const reset = await import("@/lib/services/data-reset");
type User = import("@/lib/db").User;
type ManufacturerCard = import("@/lib/db").ManufacturerCard;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let card: ManufacturerCard;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  // Cartão do fornecedor A no produto (como o da planilha do Booking).
  const doc = await uploadDocument(
    admin,
    new File([new Uint8Array([137, 80, 78, 71, 9])], "cartao.png", {
      type: "image/png",
    }),
    { productId: "prod-jarra", type: "photo", visibility: "internal" } as never,
  );
  card = await getStore().create("manufacturer_cards", {
    productId: "prod-jarra",
    supplierId: "fornecedor-a",
    documentId: doc.id,
    companyName: null,
    contactName: null,
    phone: null,
    email: null,
    storeAddress: null,
    factoryAddress: null,
    isFactory: null,
    notes: null,
    source: cards.SHEET_CARD_SOURCE,
    quoteId: null,
    createdByUserId: admin.id,
  } as never);
});

describe("cartão do fabricante", () => {
  it("a foto do cartão: fornecedor dono e Wellmix; outro fornecedor e o cliente nunca", async () => {
    const doc = (await getStore().get("documents", card.documentId))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);
  });

  it("o fornecedor dono corrige o que foi lido; outro fornecedor não; só a Wellmix lista", async () => {
    const info = {
      companyName: "x",
      contactName: null,
      phone: null,
      email: null,
      storeAddress: null,
      factoryAddress: null,
      isFactory: null,
    };
    await expect(
      cards.updateCardInfo(supplierB, card.id, info),
    ).rejects.toThrow("forbidden");
    await cards.updateCardInfo(supplierA, card.id, {
      companyName: "Min Yan Photo Frame",
      contactName: "Xu",
      phone: "13515898686",
      email: null,
      storeAddress: "Yiwu, District 1, E4-9558",
      factoryAddress: null,
      isFactory: false,
    });
    const rows = await cards.productCards(admin, "prod-jarra");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      supplierName: expect.any(String),
      card: { companyName: "Min Yan Photo Frame", isFactory: false },
    });
    await expect(cards.productCards(supplierA, "prod-jarra")).rejects.toThrow(
      "forbidden",
    );
  });

  it("limpeza de testes: o cartão do produto fica, com a foto", async () => {
    const store = getStore();
    await reset.resetSalesData(admin, "APAGAR");
    expect(await store.get("manufacturer_cards", card.id)).not.toBeNull();
    expect(await store.get("documents", card.documentId)).not.toBeNull();
  });
});
