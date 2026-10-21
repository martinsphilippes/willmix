import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cartão do fabricante: fica no produto (vários por produto), e a cada
 * negociação o fornecedor confirma qual vale. Só a Wellmix e o próprio
 * fornecedor veem; o cliente e outro fornecedor nunca.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const cards = await import("@/lib/services/manufacturer-cards");
const { canAccessDocument } = await import("@/lib/services/documents");
const reset = await import("@/lib/services/data-reset");
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

const cardPhoto = () =>
  new File([new Uint8Array([137, 80, 78, 71, 9])], "cartao.png", {
    type: "image/png",
  });

async function rfq(productId: string | null, suppliers: string[]) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Porta-retrato",
    description: "Teste do cartão",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
  });
  await r.openRfq(admin, request.id, suppliers);
  const quotes = await getStore().list("quotes", {
    filter: { requestId: request.id },
  });
  const of = (s: string) => quotes.find((q) => q.supplierId === s)!;
  return { request, of };
}

describe("cartão do fabricante", () => {
  it("fornecedor envia: fica no produto e confirmado nesta cotação; isolamento", async () => {
    await setSetting("aiMode", "MOCK");
    const { of } = await rfq("prod-jarra", ["fornecedor-a", "fornecedor-b"]);
    const quoteA = of("fornecedor-a");
    const quoteB = of("fornecedor-b");

    // Outro fornecedor e o cliente não enviam cartão nesta cotação.
    await expect(
      cards.addCardToQuote(supplierB, quoteA.id, cardPhoto()),
    ).rejects.toThrow("forbidden");
    await expect(
      cards.addCardToQuote(joao, quoteA.id, cardPhoto()),
    ).rejects.toThrow("forbidden");

    const card = await cards.addCardToQuote(supplierA, quoteA.id, cardPhoto());
    expect(card).toMatchObject({
      productId: "prod-jarra",
      supplierId: "fornecedor-a",
      isFactory: true,
      source: "mock",
    });
    const quote = (await getStore().get("quotes", quoteA.id))!;
    expect(quote.manufacturerCardId).toBe(card.id);
    expect(quote.manufacturerCardConfirmedAt).toBeTruthy();

    // A foto do cartão: fornecedor A e Wellmix; B e o cliente nunca.
    const doc = (await getStore().get("documents", card.documentId))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);

    // B não vê nem usa o cartão de A.
    const viewB = (await cards.quoteCardsView(supplierB, quoteB.id))!;
    expect(viewB.cards).toHaveLength(0);
    await expect(
      cards.confirmCardForQuote(supplierB, quoteB.id, card.id),
    ).rejects.toThrow("forbidden");
    expect(await cards.quoteCardsView(joao, quoteA.id)).toBeNull();
    await expect(
      cards.updateCardInfo(supplierB, card.id, {
        companyName: "x",
        contactName: null,
        phone: null,
        email: null,
        storeAddress: null,
        factoryAddress: null,
        isFactory: null,
      }),
    ).rejects.toThrow("forbidden");
    await expect(cards.productCards(supplierA, "prod-jarra")).rejects.toThrow(
      "forbidden",
    );
  });

  it("na negociação seguinte do mesmo produto, o fornecedor confirma o cartão que já enviou", async () => {
    const { of } = await rfq("prod-jarra", ["fornecedor-a"]);
    const quote = of("fornecedor-a");
    const view = (await cards.quoteCardsView(supplierA, quote.id))!;
    expect(view.selectedId).toBeNull();
    expect(view.cards).toHaveLength(1);
    await cards.confirmCardForQuote(supplierA, quote.id, view.cards[0].id);
    expect((await getStore().get("quotes", quote.id))!.manufacturerCardId).toBe(
      view.cards[0].id,
    );
    // O fornecedor corrige o que foi lido.
    await cards.updateCardInfo(supplierA, view.cards[0].id, {
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
    expect(rows[0].quoteIds).toHaveLength(2);
  });

  it("IA desligada: o cartão fica guardado sem os dados; sem produto, vale só para a cotação", async () => {
    await setSetting("aiMode", "MANUAL");
    const { of } = await rfq(null, ["fornecedor-a"]);
    const quote = of("fornecedor-a");
    const card = await cards.addCardToQuote(supplierA, quote.id, cardPhoto());
    expect(card).toMatchObject({
      productId: null,
      quoteId: quote.id,
      source: null,
      companyName: null,
    });
    // Outra cotação sem produto não mostra este cartão.
    const other = (await rfq(null, ["fornecedor-a"])).of("fornecedor-a");
    expect(
      (await cards.quoteCardsView(supplierA, other.id))!.cards,
    ).toHaveLength(0);
  });

  it("limpeza de testes: o cartão do produto fica; o da cotação sem produto sai com a foto", async () => {
    const store = getStore();
    const all = await store.list("manufacturer_cards");
    const productCard = all.find((c) => c.productId)!;
    const quoteCard = all.find((c) => !c.productId)!;
    const quoteDoc = (await store.get("documents", quoteCard.documentId))!;
    await reset.resetSalesData(admin, "APAGAR");
    expect(await store.get("manufacturer_cards", productCard.id)).toMatchObject(
      { quoteId: null },
    );
    expect(await store.get("documents", productCard.documentId)).not.toBeNull();
    expect(await store.get("manufacturer_cards", quoteCard.id)).toBeNull();
    expect(await store.get("documents", quoteDoc.id)).toBeNull();
    expect(await store.statFile(quoteDoc.storageKey)).toBeNull();
  });
});
