import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { sheetFor } from "./quote-sheet-fixture";

/*
 * Amostragem dentro da cotação de compra (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Amostragem desde a cotação"): todo fornecedor
 * que respondeu envia a amostra desde o convite; o conhecido do produto (já
 * vendeu à Wellmix) é dispensado; só vence quem tem a amostra aprovada ou é
 * conhecido; e a solicitação da vencedora já nasce com a amostra resolvida.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
const sampling = await import("@/lib/services/quote-sampling");
const rules = await import("@/lib/quote-sampling");
const { samplingApproved } = await import("@/lib/supplier-request-sampling");
type User = import("@/lib/db").User;

let admin: User;
let buyer: User;
let director: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let supplierC: User;

const T0 = new Date();
const plus = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);
const PRODUCT = "prod-jarra";
const photo = () =>
  new File([new Uint8Array([137, 80, 78, 71, 1])], "amostra.png", {
    type: "image/png",
  });

beforeAll(async () => {
  const { users } = await seedDemo();
  // A encomenda não vira cotação sozinha aqui (dono, 22/11/2026): estes
  // testes exercitam a Estratégia manual ou outro assunto.
  await (await import("@/lib/settings")).setSetting(
    "autoQuoteOrders",
    false,
  );
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  buyer = by("operador@wellmix.com");
  director = by("diretoria@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
  supplierC = by("supplier.c@china.com");
  await quotes.setSupplierLines(admin, supplierC.partyId!, [
    "linha-utilidades",
  ]);
});

async function openQuote() {
  const d = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId: PRODUCT,
    productName: "Jarra",
    description: "Encomenda",
    quantity: 1000,
    unit: "un",
  });
  await strategy.sendToStrategy(buyer, [d.id]);
  const decision = await strategy.chooseStrategy(buyer, {
    demandIds: [d.id],
    choice: "quote",
    note: null,
  });
  await strategy.decideStrategy(director, decision.id, {
    approve: true,
    note: null,
  });
  const fresh = (await getStore().get("purchase_decisions", decision.id))!;
  return (await getStore().get("purchase_quotes", fresh.quoteId!))!;
}

const responseOf = async (quoteId: string, user: User) =>
  (
    await getStore().list("purchase_quote_responses", {
      filter: { quoteId, supplierId: user.partyId! },
    })
  )[0];

const answer = (unitPrice: number) => ({
  decline: false,
  prices: [{ productId: PRODUCT, unitPrice }],
  currency: "USD",
  incoterm: "FOB",
  leadTimeDays: 40,
  port: "Ningbo",
  moq: 500,
  note: null,
  sheets: [sheetFor(PRODUCT)],
});

describe("amostragem na cotação de compra", () => {
  it("quem respondeu envia desde o convite; a Wellmix reprova e aprova; só vence com a amostra aprovada", async () => {
    const quote = await openQuote();
    // Desde o convite, antes de responder, ele já pode subir a amostra.
    await sampling.addQuoteSamplingFile(supplierC, quote.id, PRODUCT, {
      file: photo(),
      uploadedFileId: null,
    });
    await quotes.answerQuote(supplierA, quote.id, answer(2.4));
    await quotes.answerQuote(supplierC, quote.id, answer(2.1));
    const a = await responseOf(quote.id, supplierA);
    let c = await responseOf(quote.id, supplierC);

    // Só o fornecedor envia; a Wellmix não envia por ele; quem não foi
    // convidado não tem amostragem ali.
    await expect(
      sampling.addQuoteSamplingFile(admin, quote.id, PRODUCT, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("not_found");
    await expect(
      sampling.addQuoteSamplingFile(supplierB, quote.id, PRODUCT, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("not_found");

    // Sem a amostra aprovada, nenhum dos dois pode ser a vencedora.
    await expect(
      quotes.chooseWinner(buyer, quote.id, c.id, null, plus(25)),
    ).rejects.toThrow("quote_winner_sampling");

    await sampling.submitQuoteSampling(supplierC, quote.id, PRODUCT, "Foto 1");
    // Reprovar pede o motivo; reprovada, abre outra rodada.
    await expect(
      sampling.reviewQuoteSampling(
        admin,
        quote.id,
        PRODUCT,
        c.id,
        "reject",
        null,
      ),
    ).rejects.toThrow("sampling_reason_required");
    c = await sampling.reviewQuoteSampling(
      admin,
      quote.id,
      PRODUCT,
      c.id,
      "reject",
      "Falta a tampa",
    );
    expect(c.sampling![PRODUCT]).toMatchObject({
      status: "rejected",
      round: 2,
    });
    await expect(
      quotes.chooseWinner(buyer, quote.id, c.id, null, plus(25)),
    ).rejects.toThrow("quote_winner_sampling");
    await sampling.addQuoteSamplingFile(supplierC, quote.id, PRODUCT, {
      file: photo(),
      uploadedFileId: null,
    });
    await sampling.submitQuoteSampling(supplierC, quote.id, PRODUCT, null);
    c = await sampling.reviewQuoteSampling(
      admin,
      quote.id,
      PRODUCT,
      c.id,
      "approve",
      null,
    );
    expect(c.sampling![PRODUCT].status).toBe("approved");
    // A amostra de um não vale para o outro.
    expect(
      rules.quoteSamplingReady(
        (await responseOf(quote.id, supplierA))!,
        [PRODUCT],
        new Set(),
      ),
    ).toBe(false);
    void a;

    // Com a amostra aprovada, vence; a solicitação nasce com a amostra
    // aprovada (não pede de novo) e o produto e o pedido ficam liberados.
    await quotes.chooseWinner(buyer, quote.id, c.id, null, plus(25));
    const approved = await quotes.decideWinner(director, quote.id, {
      approve: true,
      note: null,
    });
    const [born] = await getStore().list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    expect(born.sampling).toMatchObject({ status: "approved" });
    expect(born.sampling!.files.length).toBeGreaterThan(0);
    const { decideSupplierRequest } =
      await import("@/lib/services/supplier-requests");
    const decided = await decideSupplierRequest(
      admin,
      born.id,
      "approved",
      null,
    );
    expect(samplingApproved(decided)).toBe(true);
  });

  it("fornecedor conhecido do produto pula a amostragem e pode vencer", async () => {
    const quote = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2.4));
    const a = (await responseOf(quote.id, supplierA))!;
    // Passa a ser conhecido: o vínculo do Sankhya com a última compra.
    const store = getStore();
    const [link] = await store.list("product_suppliers", {
      filter: { supplierId: supplierA.partyId!, productId: PRODUCT },
    });
    if (link)
      await store.update("product_suppliers", link.id, {
        sankhyaLastPurchaseAt: "2026-01-10T00:00:00.000Z",
      });
    else
      await store.create("product_suppliers", {
        supplierId: supplierA.partyId!,
        productId: PRODUCT,
        sankhyaLastPurchaseAt: "2026-01-10T00:00:00.000Z",
      } as never);
    const known = await sampling.knownQuoteProducts(quote, supplierA.partyId!);
    expect(known.has(PRODUCT)).toBe(true);
    expect(rules.quoteSamplingState(a, PRODUCT, true)).toBe("skipped");
    await expect(
      sampling.addQuoteSamplingFile(supplierA, quote.id, PRODUCT, {
        file: photo(),
        uploadedFileId: null,
      }),
    ).rejects.toThrow("sampling_not_open");
    await quotes.chooseWinner(buyer, quote.id, a.id, null, plus(25));
    const approved = await quotes.decideWinner(director, quote.id, {
      approve: true,
      note: null,
    });
    const [born] = await store.list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    // Dispensada: a solicitação nasce com a amostra resolvida, sem arquivos.
    expect(born.sampling).toMatchObject({
      status: "approved",
      skipped: true,
      files: [],
    });
  });
});
