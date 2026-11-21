import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { sheetFor } from "./quote-sheet-fixture";

/*
 * Rascunho automático da resposta da cotação (dono, 20/11/2026;
 * docs/PURCHASE_DEMAND.md, "Rascunho automático da cotação"): a página
 * recarregou depois da foto na balança (versão nova do portal no ar) e o que
 * estava digitado sumiu. O que o fornecedor digita fica guardado por login e
 * volta; só o convidado, com a cotação aberta; enviar ou recusar apaga.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const quotes = await import("@/lib/services/purchase-quote");
const drafts = await import("@/lib/services/quote-draft");
type User = import("@/lib/db").User;

let buyer: User;
let director: User;
let joao: User;
let supplierA: User;
let supplierB: User;

// 20/11/2026 22:00 em Brasília.
const T0 = new Date("2026-11-20T22:00:00-03:00");
const plus = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  buyer = by("operador@wellmix.com");
  director = by("diretoria@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  supplierB = by("supplier.b@china.com");
});

/** Encomenda da jarra com a estratégia "cotar" aprovada: a cotação abre. */
async function openQuote() {
  const d = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
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
  const responses = await getStore().list("purchase_quote_responses", {
    filter: { quoteId: quote.id },
  });
  for (const r of responses)
    await getStore().update("purchase_quote_responses", r.id, {
      invitedAt: T0.toISOString(),
      dueAt: plus(quote.hours).toISOString(),
    });
  return quote;
}

/** O que estava na tela: preço, moeda, ficha e condições, pelo nome do campo. */
const typed = {
  currency: "RMB",
  incoterm: "FOB",
  leadTimeDays: "35",
  port: "Ningbo",
  moq: "",
  note: "",
  "price.prod-jarra": "2.10",
  "sheet.prod-jarra.masterBoxQty": "24",
  "sheet.prod-jarra.innerBoxQty": "12",
  "sheet.prod-jarra.noInner": "0",
  "sheet.prod-jarra.material": "Vidro",
  "sheet.prod-jarra.confirm": "1",
};

describe("rascunho automático da cotação", () => {
  it("guarda só os campos e os produtos desta cotação, no tamanho de cada um", () => {
    const clean = drafts.cleanQuoteDraft(
      {
        ...typed,
        "price.outro-produto": "9.99",
        "sheet.outro-produto.material": "Aço",
        "sheet.prod-jarra.inventado": "x",
        qualquer: "coisa",
        port: "N".repeat(500),
        "sheet.prod-jarra.material": "V".repeat(500),
        "sheet.prod-jarra.masterBoxQty": 24 as unknown as string,
      },
      ["prod-jarra"],
    );
    expect(clean["price.prod-jarra"]).toBe("2.10");
    expect(clean.currency).toBe("RMB");
    // Campo vazio entra: o que estava na tela, apagado de propósito.
    expect(clean.moq).toBe("");
    expect(clean["sheet.prod-jarra.noInner"]).toBe("0");
    expect(clean.port).toHaveLength(120);
    expect(clean["sheet.prod-jarra.material"]).toHaveLength(200);
    for (const key of [
      "price.outro-produto",
      "sheet.outro-produto.material",
      "sheet.prod-jarra.inventado",
      "qualquer",
      "sheet.prod-jarra.masterBoxQty",
    ])
      expect(clean).not.toHaveProperty(key);
  });

  it("o fornecedor convidado salva e recupera o que digitou; cada login só o próprio", async () => {
    const quote = await openQuote();
    expect(await drafts.loadQuoteDraft(supplierA, quote.id)).toBeNull();
    const savedAt = await drafts.saveQuoteDraft(
      supplierA,
      quote.id,
      { ...typed, "price.outro-produto": "9.99" },
      plus(1),
    );
    expect(savedAt).toBeTruthy();
    const back = await drafts.loadQuoteDraft(supplierA, quote.id);
    expect(back?.values).toEqual(typed);
    // Salvar de novo atualiza o mesmo rascunho (um por login e cotação).
    await drafts.saveQuoteDraft(
      supplierA,
      quote.id,
      { ...typed, "price.prod-jarra": "2.35" },
      plus(1),
    );
    expect(
      (await drafts.loadQuoteDraft(supplierA, quote.id))?.values[
        "price.prod-jarra"
      ],
    ).toBe("2.35");
    const rows = await getStore().list("form_drafts", {
      filter: { userId: supplierA.id },
    });
    expect(rows.filter((r) => r.form === `quote:${quote.id}`)).toHaveLength(1);
    // Quem não foi convidado (ou é da Wellmix) não salva nem lê.
    for (const other of [supplierB, buyer]) {
      expect(
        await code(() =>
          drafts.saveQuoteDraft(other, quote.id, typed, plus(1)),
        ),
      ).toBe("not_found");
      expect(await drafts.loadQuoteDraft(other, quote.id)).toBeNull();
    }
  });

  it("prazo vencido não salva; enviar a resposta apaga o rascunho", async () => {
    const quote = await openQuote();
    await drafts.saveQuoteDraft(supplierA, quote.id, typed, plus(1));
    expect(
      await code(() =>
        drafts.saveQuoteDraft(
          supplierA,
          quote.id,
          typed,
          plus(quote.hours + 1),
        ),
      ),
    ).toBe("quote_expired");
    await quotes.answerQuote(
      supplierA,
      quote.id,
      {
        decline: false,
        prices: [{ productId: "prod-jarra", unitPrice: 2.1 }],
        currency: "RMB",
        incoterm: "FOB",
        leadTimeDays: 35,
        port: "Ningbo",
        moq: 500,
        note: null,
        sheets: [sheetFor("prod-jarra")],
      },
      plus(2),
    );
    expect(await drafts.loadQuoteDraft(supplierA, quote.id)).toBeNull();
  });
});
