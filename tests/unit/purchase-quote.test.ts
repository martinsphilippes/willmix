import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { sheetFor } from "./quote-sheet-fixture";

/*
 * Cotação de compra (mapa B13; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * fornecedores pela linha, prazo de 24 h por fornecedor (datas com hora e
 * fuso explícitos), cotação sem resposta, isolamento entre fornecedores no
 * servidor e a vencedora aprovada virando a Solicitação ao fornecedor.
 */
withTempStore();

const { approveQuoteSample } = await import("./helpers/sampling");

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
type User = import("@/lib/db").User;

let buyer: User;
let director: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let supplierC: User;

// 16/11/2026 09:00 em Brasília (12:00 UTC).
const T0 = new Date("2026-11-16T09:00:00-03:00");
const plus = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);

beforeAll(async () => {
  const { users } = await seedDemo();
  // A encomenda não vira cotação sozinha aqui (dono, 22/11/2026): estes
  // testes exercitam a Estratégia manual ou outro assunto.
  await (await import("@/lib/settings")).setSetting(
    "autoQuoteOrders",
    false,
  );
  const by = (email: string) => users.find((u) => u.email === email)!;
  buyer = by("operador@wellmix.com");
  director = by("diretoria@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
  supplierC = by("supplier.c@china.com");
  // Linha de utilidades: o fornecedor C passa a atender também (cadastro).
  await quotes.setSupplierLines(
    users.find((u) => u.email === "admin@wellmix.com")!,
    supplierC.partyId!,
    ["linha-utilidades"],
  );
});

/** Encomenda da jarra, estratégia "cotar" aprovada: a cotação abre sozinha. */
async function openQuote(now = T0) {
  const d = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Encomenda",
    quantity: 1000,
    unit: "un",
  });
  // Encomendas → "Enviar para cotação" (dono, 18/11/2026).
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
  expect(fresh.quoteId).toBeTruthy();
  const quote = (await getStore().get("purchase_quotes", fresh.quoteId!))!;
  // Prazo recalculado a partir do instante fixo do teste.
  const responses = await getStore().list("purchase_quote_responses", {
    filter: { quoteId: quote.id },
  });
  for (const r of responses)
    await getStore().update("purchase_quote_responses", r.id, {
      invitedAt: now.toISOString(),
      dueAt: new Date(now.getTime() + quote.hours * 3_600_000).toISOString(),
    });
  return { demand: d, quote };
}

const answer = (unitPrice: number) => ({
  decline: false,
  prices: [{ productId: "prod-jarra", unitPrice }],
  currency: "USD",
  incoterm: "FOB",
  leadTimeDays: 40,
  port: "Ningbo",
  moq: 500,
  note: null,
  sheets: [sheetFor("prod-jarra")],
});

describe("fornecedores pela linha", () => {
  it("o vínculo cadastrado e o fornecedor principal dos produtos da linha, só ativos", async () => {
    const ids = await quotes.supplierIdsForLines(["linha-utilidades"]);
    // A (principal da panela) e C (cadastrado na linha); B é de brinquedos.
    expect(ids).toContain(supplierA.partyId);
    expect(ids).toContain(supplierC.partyId);
    expect(ids).not.toContain(supplierB.partyId);
    await getStore().update("parties", supplierC.partyId!, { active: false });
    expect(
      await quotes.supplierIdsForLines(["linha-utilidades"]),
    ).not.toContain(supplierC.partyId);
    await getStore().update("parties", supplierC.partyId!, { active: true });
  });
});

describe("prazo de 24 h", () => {
  it("aberta pelo sistema, com 24 h por fornecedor; vence na hora exata", async () => {
    const { quote, demand } = await openQuote();
    expect(quote.hours).toBe(24);
    expect((await getStore().get("requests", demand.id))!.status).toBe(
      "RFQ_OPEN",
    );
    const [r] = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    expect(r.dueAt).toBe("2026-11-17T12:00:00.000Z");
    expect(quotes.responseState(r, plus(23.99))).toBe("open");
    expect(quotes.responseState(r, plus(24))).toBe("expired");
    // Depois do prazo, não aceita resposta.
    await expect(
      quotes.answerQuote(supplierA, quote.id, answer(2), plus(24.01)),
    ).rejects.toThrow("quote_expired");
  });
});

describe("correção da resposta (dono, 21/11/2026, opção 1)", () => {
  it("corrige até o prazo dele, com a cotação aberta; a escolha da vencedora trava antes", () => {
    const r = { dueAt: "2026-11-17T12:00:00.000Z" };
    const at = (iso: string) => new Date(iso);
    expect(
      quotes.quoteEditable({ status: "open" }, r, at("2026-11-17T11:59:00Z")),
    ).toBe(true);
    expect(
      quotes.quoteEditable({ status: "open" }, r, at("2026-11-17T12:00:00Z")),
    ).toBe(false);
    expect(
      quotes.quoteEditable({ status: "chosen" }, r, at("2026-11-17T10:00:00Z")),
    ).toBe(false);
    expect(
      quotes.quoteEditable(
        { status: "cancelled" },
        r,
        at("2026-11-17T10:00:00Z"),
      ),
    ).toBe(false);
  });

  it("enviada, a resposta é trocada no prazo; depois do prazo, não", async () => {
    const { quote } = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2.4), plus(1));
    await quotes.answerQuote(supplierA, quote.id, answer(2.2), plus(2));
    const [r] = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id, supplierId: supplierA.partyId! },
    });
    expect(r.prices?.[0].unitPrice).toBe(2.2);
    expect(quotes.quoteEditable(quote, r, plus(23.9))).toBe(true);
    expect(quotes.quoteEditable(quote, r, plus(24))).toBe(false);
    await expect(
      quotes.answerQuote(supplierA, quote.id, answer(1.9), plus(24.01)),
    ).rejects.toThrow("quote_expired");
  });
});

describe("isolamento entre fornecedores (servidor)", () => {
  it("cada um lê só a própria resposta; o convidado não vê os outros nem o cliente", async () => {
    const { quote } = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2.1), plus(1));
    const viewC = await quotes.supplierQuoteView(supplierC, quote.id);
    expect(viewC).not.toBeNull();
    expect(viewC!.response.supplierId).toBe(supplierC.partyId);
    expect(viewC!.response.prices).toBeNull();
    // Nada das demandas nem do cliente na visão do fornecedor.
    const text = JSON.stringify(viewC);
    expect(text).not.toContain("cliente-joao");
    expect(text).not.toContain(supplierA.partyId!);
    // B não foi convidado: nada.
    expect(await quotes.supplierQuoteView(supplierB, quote.id)).toBeNull();
    await expect(
      quotes.answerQuote(supplierB, quote.id, answer(1), plus(1)),
    ).rejects.toThrow("not_found");
    // O cliente também não.
    expect(await quotes.supplierQuoteView(joao, quote.id)).toBeNull();
  });
});

describe("escolha, aprovação e a solicitação ao fornecedor", () => {
  it("dois respondem, um não; depois do prazo o Comprador escolhe, a Diretoria aprova e nasce a B7 com os valores", async () => {
    const { quote, demand } = await openQuote();
    // C responde e A responde; nenhum terceiro (só os dois foram convidados aqui).
    await quotes.answerQuote(supplierA, quote.id, answer(2.3), plus(2));
    // Antes de todos responderem e do prazo, a escolha não abre.
    const [rA] = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id, supplierId: supplierA.partyId! },
    });
    await expect(
      quotes.chooseWinner(buyer, quote.id, rA.id, null, plus(3)),
    ).rejects.toThrow("quote_still_open");
    await quotes.answerQuote(supplierC, quote.id, answer(1.95), plus(5));
    const [rC] = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id, supplierId: supplierC.partyId! },
    });
    // Todos responderam: a escolha abre antes do prazo.
    // Só vence quem tem a amostra aprovada (dono, 22/11/2026).
    await approveQuoteSample(quote.id, rC.id);
    await quotes.chooseWinner(buyer, quote.id, rC.id, "Melhor preço", plus(6));
    // O Comprador não aprova (sem a ação).
    await expect(
      quotes.decideWinner(buyer, quote.id, { approve: true, note: null }),
    ).rejects.toThrow();
    const approved = await quotes.decideWinner(director, quote.id, {
      approve: true,
      note: null,
    });
    expect(approved.status).toBe("approved");
    const [sr] = await getStore().list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    expect(sr).toMatchObject({
      status: "answered",
      supplierId: supplierC.partyId,
      productId: "prod-jarra",
      supplierPrice: 1.95,
      supplierCurrency: "USD",
      supplierIncoterm: "FOB",
      supplierLeadTimeDays: 40,
      supplierMoq: 500,
      quantity: 1000,
      quoteResponseId: rC.id,
      demandIds: [demand.id],
    });
    expect((await getStore().get("requests", demand.id))!.status).toBe(
      "SUPPLIER_SELECTED",
    );
    // Encomendas (dono, 24/11/2026): o Próximo passo "Decidir a resposta do
    // fornecedor" leva à solicitação ao fornecedor com a vez (o link).
    const { requestStepsFor } = await import("@/lib/services/request-turns");
    const selected = (await getStore().get("requests", demand.id))!;
    const steps = await requestStepsFor(director, [selected], []);
    expect(steps.get(demand.id)).toMatchObject({
      key: "supplier_decide",
      who: "wellmix",
      supplierRequestId: sr.id,
    });
  });

  it("um responde, outro não: só depois do prazo a escolha abre", async () => {
    const { quote } = await openQuote();
    await quotes.answerQuote(supplierA, quote.id, answer(2), plus(1));
    const [rA] = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id, supplierId: supplierA.partyId! },
    });
    await expect(
      quotes.chooseWinner(buyer, quote.id, rA.id, null, plus(10)),
    ).rejects.toThrow("quote_still_open");
    // Só vence quem tem a amostra aprovada (dono, 22/11/2026).
    await approveQuoteSample(quote.id, rA.id);
    const chosen = await quotes.chooseWinner(
      buyer,
      quote.id,
      rA.id,
      null,
      plus(24.5),
    );
    expect(chosen.status).toBe("chosen");
  });
});

describe("sem nenhuma resposta", () => {
  it("o Comprador é avisado e reabre por mais 24 h, convida outro ou volta à estratégia", async () => {
    const { quote, demand } = await openQuote();
    const responses = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    expect(quotes.quoteEmpty(responses, plus(25))).toBe(true);
    const swept = await quotes.sweepQuotes(plus(25));
    expect(swept.empty).toBeGreaterThanOrEqual(1);
    // Reabrir: novo prazo a partir de agora.
    const n = await quotes.reopenQuote(buyer, quote.id, plus(25));
    expect(n).toBe(responses.length);
    const reopened = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    expect(reopened.every((r) => r.dueAt === plus(49).toISOString())).toBe(
      true,
    );
    // Convidar outro fornecedor ativo (o B), com o prazo cheio.
    await quotes.inviteMore(buyer, quote.id, [supplierB.partyId!], plus(26));
    expect(await quotes.supplierQuoteView(supplierB, quote.id)).not.toBeNull();
    // Voltar para a estratégia: a demanda volta para a fila.
    await quotes.backToStrategy(buyer, quote.id);
    expect(await getStore().get("requests", demand.id)).toMatchObject({
      status: "REQUESTED",
      purchaseDecisionId: null,
    });
    expect((await strategy.waitingDemands()).map((r) => r.id)).toContain(
      demand.id,
    );
  });

  it("lembrete ao fornecedor antes de vencer, uma vez só", async () => {
    const { quote } = await openQuote();
    // 4 h antes (1/6 de 24 h): lembra; de novo, não.
    expect((await quotes.sweepQuotes(plus(20.5))).reminded).toBeGreaterThan(0);
    const again = await quotes.sweepQuotes(plus(21));
    const mine = await getStore().list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    expect(mine.every((r) => r.reminderSentAt)).toBe(true);
    expect(again.reminded).toBe(0);
  });
});
