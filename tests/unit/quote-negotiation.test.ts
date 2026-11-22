import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { sheetFor } from "./quote-sheet-fixture";

/*
 * Negociação dentro da cotação de compra (dono, 22/11/2026;
 * docs/QUOTATION.md): cada resposta fica no histórico, a Wellmix devolve com
 * contraproposta a um ou a vários fornecedores de uma vez (só a quem
 * respondeu, com a cotação aberta), o fornecedor ganha prazo para corrigir e
 * vê só a própria linha, e a conversa é do par fornecedor × produto.
 */
withTempStore();

const { approveQuoteSample } = await import("./helpers/sampling");

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
const negotiation = await import("@/lib/services/quote-negotiation");
const rules = await import("@/lib/quote-negotiation");
type User = import("@/lib/db").User;

let buyer: User;
let director: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let supplierC: User;

const T0 = new Date("2026-11-16T09:00:00-03:00");
const plus = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);
const PRODUCT = "prod-jarra";

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  buyer = by("operador@wellmix.com");
  director = by("diretoria@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
  supplierC = by("supplier.c@china.com");
  await quotes.setSupplierLines(
    users.find((u) => u.email === "admin@wellmix.com")!,
    supplierC.partyId!,
    ["linha-utilidades"],
  );
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
  const quote = (await getStore().get("purchase_quotes", fresh.quoteId!))!;
  for (const r of await responsesOf(quote.id))
    await getStore().update("purchase_quote_responses", r.id, {
      invitedAt: T0.toISOString(),
      dueAt: plus(quote.hours).toISOString(),
    });
  return quote;
}

const responsesOf = (quoteId: string) =>
  getStore().list("purchase_quote_responses", { filter: { quoteId } });
const responseOf = async (quoteId: string, user: User) =>
  (await responsesOf(quoteId)).find((r) => r.supplierId === user.partyId)!;

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

const counter = (responseIds: string[], price: number | null = 1.8) => ({
  responseIds,
  productId: PRODUCT,
  price,
  currency: "USD",
  moq: null,
  leadTimeDays: null,
  incoterm: null,
  text: "Conseguem chegar neste preço?",
});

describe("contraproposta em massa na cotação", () => {
  it("vai a todos os marcados, só a quem respondeu, e cada um ganha prazo para corrigir", async () => {
    const quote = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2.4), plus(1));
    await quotes.answerQuote(supplierC, quote.id, answer(2.1), plus(2));
    const a = await responseOf(quote.id, supplierA);
    const c = await responseOf(quote.id, supplierC);

    // Cada resposta enviada fica no histórico do par.
    expect(rules.quoteProductHistory(a, PRODUCT)).toMatchObject([
      { kind: "answer", side: "supplier", price: 2.4, currency: "USD" },
    ]);

    // Fornecedor não devolve contraproposta; sem comentário, recusa.
    await expect(
      negotiation.proposeQuoteCounter(supplierA, quote.id, counter([a.id])),
    ).rejects.toThrow("forbidden");
    await expect(
      negotiation.proposeQuoteCounter(buyer, quote.id, {
        ...counter([a.id]),
        text: " ",
      }),
    ).rejects.toThrow("supplier_request_comment_required");
    await expect(
      negotiation.proposeQuoteCounter(buyer, quote.id, counter([])),
    ).rejects.toThrow("quote_counter_none");

    // Aos dois de uma vez, perto do fim do prazo: o prazo de cada um renasce.
    const at = plus(23);
    const sent = await negotiation.proposeQuoteCounter(
      buyer,
      quote.id,
      counter([a.id, c.id]),
      at,
    );
    expect(sent).toHaveLength(2);
    for (const r of sent) {
      expect(r.status).toBe("answered");
      expect(r.dueAt).toBe(plus(23 + quote.hours).toISOString());
      expect(rules.pendingQuoteProposals(r)).toMatchObject([
        { kind: "proposal", productId: PRODUCT, price: 1.8 },
      ]);
    }
    // Respondida continua respondida: a escolha da vencedora não trava.
    expect(quotes.quoteClosed(await responsesOf(quote.id), plus(25))).toBe(
      true,
    );

    // O fornecedor corrige a resposta dentro do prazo novo: a contraproposta
    // deixa de esperar e a sequência fica no histórico, na ordem.
    await quotes.answerQuote(supplierA, quote.id, answer(1.9), plus(30));
    const after = await responseOf(quote.id, supplierA);
    expect(rules.pendingQuoteProposals(after)).toEqual([]);
    expect(
      rules.quoteProductHistory(after, PRODUCT).map((e) => [e.kind, e.price]),
    ).toEqual([
      ["answer", 2.4],
      ["proposal", 1.8],
      ["answer", 1.9],
    ]);
    // O outro fornecedor segue com a contraproposta esperando.
    expect(
      rules.pendingQuoteProposals(await responseOf(quote.id, supplierC)),
    ).toHaveLength(1);
  });

  it("quem não respondeu não recebe; cotação com vencedora escolhida não aceita", async () => {
    const quote = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2.4), plus(1));
    const a = await responseOf(quote.id, supplierA);
    const c = await responseOf(quote.id, supplierC);
    await expect(
      negotiation.proposeQuoteCounter(buyer, quote.id, counter([a.id, c.id])),
    ).rejects.toThrow("quote_counter_not_answered");
    // Nada foi gravado em nenhum dos dois.
    expect(
      rules.pendingQuoteProposals(await responseOf(quote.id, supplierA)),
    ).toEqual([]);
    // Só vence quem tem a amostra aprovada (dono, 22/11/2026).
    await approveQuoteSample(quote.id, a.id);
    await quotes.chooseWinner(buyer, quote.id, a.id, null, plus(25));
    await expect(
      negotiation.proposeQuoteCounter(buyer, quote.id, counter([a.id])),
    ).rejects.toThrow("quote_closed");
  });
});

describe("conversa do par fornecedor × produto", () => {
  it("a Wellmix escreve para uma resposta; o fornecedor, só na dele", async () => {
    const quote = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2.4), plus(1));
    const a = await responseOf(quote.id, supplierA);
    const c = await responseOf(quote.id, supplierC);
    await negotiation.postQuoteMessage(buyer, quote.id, {
      responseId: a.id,
      productId: PRODUCT,
      text: "A caixa é com 12?",
    });
    // O fornecedor responde sem dizer a resposta: vai para a dele, mesmo
    // que mande a de outro.
    await negotiation.postQuoteMessage(supplierA, quote.id, {
      responseId: c.id,
      productId: PRODUCT,
      text: "Sim, 12 por caixa.",
    });
    const mine = await responseOf(quote.id, supplierA);
    expect(
      rules.quoteProductMessages(mine, PRODUCT).map((e) => [e.side, e.text]),
    ).toEqual([
      ["wellmix", "A caixa é com 12?"],
      ["supplier", "Sim, 12 por caixa."],
    ]);
    expect(
      rules.quoteProductMessages(await responseOf(quote.id, supplierC), null),
    ).toEqual([]);
    // Quem não foi convidado não fala na cotação.
    await expect(
      negotiation.postQuoteMessage(supplierB, quote.id, {
        responseId: null,
        productId: null,
        text: "Oi",
      }),
    ).rejects.toThrow("not_found");
    await expect(
      negotiation.postQuoteMessage(buyer, quote.id, {
        responseId: a.id,
        productId: PRODUCT,
        text: "  ",
      }),
    ).rejects.toThrow("supplier_request_message_empty");
  });
});

describe("resposta de antes do histórico", () => {
  it("mostra a resposta de hoje uma vez", () => {
    const entries = rules.quoteProductHistory(
      {
        negotiation: null,
        status: "answered",
        prices: [{ productId: PRODUCT, unitPrice: 3 }],
        currency: "RMB",
        incoterm: "FOB",
        leadTimeDays: 30,
        moq: 100,
        port: "Ningbo",
        note: null,
        answeredAt: "2026-11-10T12:00:00.000Z",
        answeredByUserId: "u1",
      },
      PRODUCT,
    );
    expect(entries).toMatchObject([
      { id: "legacy", kind: "answer", price: 3, currency: "RMB" },
    ]);
  });
});
