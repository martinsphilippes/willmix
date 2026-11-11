import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { PNG_1X1, xlsxBytes } from "./xlsx-fixture";

/*
 * Cartão do fabricante que vem na planilha da ficha técnica (coluna do cartão,
 * guardada no produto como foto "business_card"): entra sozinho na cotação
 * do fornecedor do produto, já confirmado. Nunca na de outro fornecedor.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const cards = await import("@/lib/services/manufacturer-cards");
const { addPhotos } = await import("@/lib/services/sourcing");
const { canAccessDocument } = await import("@/lib/services/documents");
const sheetImport = await import("@/lib/services/product-sheet-import");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

// prod-panela é do fornecedor-a no cadastro de demonstração.
const PRODUCT = "prod-panela";

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

const image = (name: string) =>
  new File([new Uint8Array([137, 80, 78, 71, 7])], name, {
    type: "image/png",
  });

async function request(productId: string) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Jogo de panelas",
    description: "Cartão da planilha",
    specification: null,
    quantity: 5000,
    unit: "un",
    deadline: null,
  });
}

const quotesOf = async (requestId: string) => {
  const quotes = await getStore().list("quotes", { filter: { requestId } });
  return (s: string) => quotes.find((q) => q.supplierId === s)!;
};

describe("cartão do fabricante da planilha da ficha técnica", () => {
  it("cotação aberta antes de o produto ter o cartão: nada entra; ao abrir a cotação depois, entra", async () => {
    const req = await request(PRODUCT);
    await r.openRfq(admin, req.id, ["fornecedor-a"]);
    const quote = (await quotesOf(req.id))("fornecedor-a");
    expect(quote.manufacturerCardId ?? null).toBeNull();

    // A importação guarda o cartão da planilha como foto do produto.
    const [photo] = await addPhotos(
      admin,
      { productId: PRODUCT },
      [image("cartao.png")],
      "business_card",
    );
    // Outro fornecedor e o cliente não trazem nada para a cotação de A.
    expect(await cards.bringCardToQuote(supplierB, quote, PRODUCT)).toBeNull();
    expect(await cards.bringCardToQuote(joao, quote, PRODUCT)).toBeNull();

    const card = (await cards.bringCardToQuote(supplierA, quote, PRODUCT))!;
    expect(card).toMatchObject({
      productId: PRODUCT,
      supplierId: "fornecedor-a",
      documentId: photo.documentId,
      source: "sheet",
    });
    const saved = (await getStore().get("quotes", quote.id))!;
    expect(saved.manufacturerCardId).toBe(card.id);
    expect(saved.manufacturerCardConfirmedAt).toBeTruthy();
    expect(cards.hasConfirmedCard(saved)).toBe(true);

    // O arquivo: a Wellmix e o fornecedor dono; outro fornecedor e o cliente nunca.
    const doc = (await getStore().get("documents", card.documentId))!;
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);
  });

  it("ao mandar ao fornecedor (RFQ), o cartão já entra confirmado; o concorrente não recebe", async () => {
    const req = await request(PRODUCT);
    await r.openRfq(admin, req.id, ["fornecedor-a", "fornecedor-b"]);
    const of = await quotesOf(req.id);
    const all = await getStore().list("manufacturer_cards", {
      filter: { productId: PRODUCT },
    });
    // Não repete: a mesma foto da planilha é um cartão só.
    expect(all).toHaveLength(1);
    expect(of("fornecedor-a").manufacturerCardId).toBe(all[0].id);
    expect(of("fornecedor-b").manufacturerCardId ?? null).toBeNull();
    // O concorrente não vê o cartão do fornecedor do produto.
    const viewB = (await cards.quoteCardsView(
      supplierB,
      of("fornecedor-b").id,
    ))!;
    expect(viewB.cards).toHaveLength(0);
    expect(viewB.selectedId).toBeNull();
    const viewA = (await cards.quoteCardsView(
      supplierA,
      of("fornecedor-a").id,
    ))!;
    expect(viewA.selectedId).toBe(all[0].id);
  });

  it("o fornecedor continua podendo trocar; cotação respondida não muda", async () => {
    const req = await request(PRODUCT);
    await r.openRfq(admin, req.id, ["fornecedor-a"]);
    const quote = (await quotesOf(req.id))("fornecedor-a");
    const before = quote.manufacturerCardId;
    expect(before).toBeTruthy();
    const other = await cards.addCardToQuote(
      supplierA,
      quote.id,
      image("novo.png"),
    );
    const now = (await getStore().get("quotes", quote.id))!;
    expect(now.manufacturerCardId).toBe(other.id);
    expect(other.id).not.toBe(before);
    // Já com cartão ou já respondida: nada é trazido por cima.
    expect(await cards.bringCardToQuote(admin, now, PRODUCT)).toBeNull();
    expect(
      await cards.bringCardToQuote(
        admin,
        { ...now, manufacturerCardId: null, status: "answered" },
        PRODUCT,
      ),
    ).toBeNull();
  });

  it("produto sem fornecedor no cadastro ou sem cartão na planilha: continua pedindo o envio", async () => {
    const req = await request("prod-jarra");
    await r.openRfq(admin, req.id, ["fornecedor-a"]);
    const quote = (await quotesOf(req.id))("fornecedor-a");
    expect(quote.manufacturerCardId ?? null).toBeNull();
    expect(
      await cards.bringCardToQuote(supplierA, quote, "prod-jarra"),
    ).toBeNull();
    expect(await cards.bringCardToQuote(supplierA, quote, null)).toBeNull();
  });
  it("caminho inteiro: planilha com a coluna do cartão → solicitação → cotação do fornecedor já com o cartão", async () => {
    const store = getStore();
    const lineId = (await store.list("product_lines", { orderBy: "name" }))[0]
      .id;
    const file = new File(
      [
        xlsxBytes(
          [
            {
              name: "SUPPLIER INFO",
              cells: [
                [
                  "SKU",
                  "SUPPLIER NAME",
                  "SUPPLIER STORE NO",
                  "DESCRIPTION",
                  "PRICE USD",
                  "QTY/BOX",
                  "N.W PC",
                  "CBM",
                  "COLOR",
                  "MOQ",
                  "SUPPLIER BUSINESS CARD",
                ],
                [
                  "CARD-1",
                  "Min Yan Frames",
                  "E4-9558",
                  "PHOTO FRAME",
                  "4",
                  "12",
                  "0.225",
                  "0.0183",
                  "White",
                  "1200",
                  "",
                ],
              ],
            },
          ],
          // A imagem do cartão ancorada na coluna do cartão, na linha do produto.
          {
            images: [{ sheet: 0, col: 10, row: 1, bytes: PNG_1X1, ext: "png" }],
          },
        ),
      ],
      "ficha.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    const result = await sheetImport.importProductSheet(admin, file, {
      lineId,
      mode: "products",
      supplierId: "fornecedor-a",
    });
    expect(result.summary).toMatchObject({ created: 1, errors: 0 });
    const productId = result.results[0].productId!;
    const created = await request(productId);
    await r.openRfq(admin, created.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: created.id },
    });
    expect(quote.supplierId).toBe("fornecedor-a");
    expect(quote.manufacturerCardId).toBeTruthy();
    const card = (await store.get(
      "manufacturer_cards",
      quote.manufacturerCardId!,
    ))!;
    expect(card).toMatchObject({
      productId,
      supplierId: "fornecedor-a",
      source: "sheet",
      // Os dados vêm das colunas da planilha.
      companyName: "Min Yan Frames",
      storeAddress: "E4-9558",
    });
    // O fornecedor abre a cotação e já vê o cartão confirmado.
    const view = (await cards.quoteCardsView(supplierA, quote.id))!;
    expect(view.selectedId).toBe(card.id);
    const doc = (await store.get("documents", card.documentId))!;
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
  });
});
