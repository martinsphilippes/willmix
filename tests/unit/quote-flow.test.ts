import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { PNG_1X1 } from "./xlsx-fixture";

/*
 * Cotação (docs/QUOTE_FLOW.md): a Wellmix devolve com comentário e
 * contraproposta (10% menor sugerido), o fornecedor aceita, manda outro
 * preço ou mantém; a proposta de embalagem (imagem + prompt) espera o OK do
 * fornecedor. Enquanto houver devolução em aberto ou embalagem sem OK, a
 * escolha do fornecedor fica parada. A imagem só abre para a Wellmix e para
 * o fornecedor daquela cotação.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const ap = await import("@/lib/services/approvals");
const flow = await import("@/lib/services/quote-flow");
const { canAccessDocument } = await import("@/lib/services/documents");
const { suggestedTargetPrice, pendingReturn, packagingProposalState } =
  await import("@/lib/quote-flow");
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
  supplierB = {
    ...supplierA,
    id: "outro-fornecedor",
    email: "supplier.b@china.test",
    partyId: "fornecedor-b",
  };
  const { setSetting } = await import("@/lib/settings");
  await setSetting("approvalsEnabled", false);
});

async function quoted(name: string) {
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 4,
    currency: "USD",
    leadTimeDays: 30,
    conditions: null,
  });
  return { req, quote };
}

const quoteOf = async (id: string) => (await getStore().get("quotes", id))!;
const sell = { sellPrice: 10_000, sellCurrency: "BRL" };
const image = () => new File([PNG_1X1], "embalagem.png", { type: "image/png" });

describe("regra pura", () => {
  it("contraproposta sugerida: 10% menor, com até 4 casas", () => {
    expect(suggestedTargetPrice(4)).toBe(3.6);
    expect(suggestedTargetPrice(3.85)).toBe(3.465);
    expect(suggestedTargetPrice(4, 15)).toBe(3.4);
    expect(suggestedTargetPrice(null)).toBeNull();
    expect(suggestedTargetPrice(0)).toBeNull();
    expect(pendingReturn(null)).toBeNull();
    expect(packagingProposalState(null)).toBe("none");
  });
});

describe("devolver com comentário e a resposta do fornecedor", () => {
  it("devolve com motivo e contraproposta, avisa o fornecedor e segura a escolha", async () => {
    const { quote } = await quoted("Quadro negociado");
    // Só a Wellmix devolve; o motivo é obrigatório; o preço proposto é menor.
    await expect(
      flow.returnQuote(supplierA, quote.id, {
        comment: "caro",
        targetPrice: 3,
      }),
    ).rejects.toThrow();
    await expect(
      flow.returnQuote(admin, quote.id, { comment: " ", targetPrice: 3.6 }),
    ).rejects.toThrow("comment_required");
    await expect(
      flow.returnQuote(admin, quote.id, { comment: "caro", targetPrice: 4 }),
    ).rejects.toThrow("negotiation_target_invalid");

    await flow.returnQuote(admin, quote.id, {
      comment: "Acima do nosso custo-alvo.",
      targetPrice: 3.6,
    });
    const returned = await quoteOf(quote.id);
    expect(pendingReturn(returned.negotiation)).toMatchObject({
      kind: "return",
      side: "wellmix",
      comment: "Acima do nosso custo-alvo.",
      targetPrice: 3.6,
      previousPrice: 4,
    });
    // O preço da cotação não muda na devolução.
    expect(returned.price).toBe(4);
    const notes = await getStore().list("notifications", {
      filter: { userId: supplierA.id },
    });
    expect(
      notes.some((n) => n.link === `/app/quotes/${quote.id}#negotiation`),
    ).toBe(true);
    // Uma devolução por vez; e a escolha do fornecedor espera a resposta.
    await expect(
      flow.returnQuote(admin, quote.id, {
        comment: "de novo",
        targetPrice: null,
      }),
    ).rejects.toThrow("negotiation_pending");
    await expect(r.selectQuote(admin, quote.id, sell)).rejects.toThrow(
      "negotiation_pending",
    );
    await expect(ap.submitForApproval(admin, quote.id, sell)).rejects.toThrow(
      "negotiation_pending",
    );
  });

  it("o fornecedor aceita a contraproposta: o preço muda na cotação e na ficha, e a escolha segue", async () => {
    const { req, quote } = await quoted("Quadro aceito");
    await qs.saveQuoteSheet(admin, quote.id, { price: 4, currency: "USD" });
    await flow.returnQuote(admin, quote.id, {
      comment: "Precisamos de 10% a menos.",
      targetPrice: 3.6,
    });
    // Outro fornecedor não responde por este.
    await expect(
      flow.replyNegotiation(supplierB, quote.id, {
        decision: "accept",
        price: null,
        comment: null,
      }),
    ).rejects.toThrow();
    await flow.replyNegotiation(supplierA, quote.id, {
      decision: "accept",
      price: null,
      comment: null,
    });
    const after = await quoteOf(quote.id);
    expect(after.price).toBe(3.6);
    expect(pendingReturn(after.negotiation)).toBeNull();
    expect(after.negotiation!.map((n) => n.kind)).toEqual(["return", "accept"]);
    expect((await qs.getQuoteSheet(quote.id))!.price).toBe(3.6);
    await r.selectQuote(admin, quote.id, sell);
    expect((await getStore().get("requests", req.id))!.status).toBe(
      "WAITING_DOWN_PAYMENT",
    );
    // Cotação escolhida não volta para a negociação.
    await expect(
      flow.returnQuote(admin, quote.id, {
        comment: "tarde",
        targetPrice: null,
      }),
    ).rejects.toThrow("negotiation_not_answered");
  });

  it("tréplica com outro preço, manter (com motivo) e nova rodada", async () => {
    const { quote } = await quoted("Quadro tréplica");
    await flow.returnQuote(admin, quote.id, {
      comment: "Caro.",
      targetPrice: null,
    });
    // Sem preço proposto não há o que aceitar; outro preço precisa do número.
    await expect(
      flow.replyNegotiation(supplierA, quote.id, {
        decision: "accept",
        price: null,
        comment: null,
      }),
    ).rejects.toThrow("negotiation_no_target");
    await expect(
      flow.replyNegotiation(supplierA, quote.id, {
        decision: "counter",
        price: null,
        comment: null,
      }),
    ).rejects.toThrow("negotiation_price_invalid");
    await flow.replyNegotiation(supplierA, quote.id, {
      decision: "counter",
      price: 3.8,
      comment: "Com 5.000 peças.",
    });
    expect((await quoteOf(quote.id)).price).toBe(3.8);
    // Segunda rodada: a Wellmix devolve de novo e o fornecedor mantém.
    await flow.returnQuote(admin, quote.id, {
      comment: "Ainda alto.",
      targetPrice: 3.42,
    });
    await expect(
      flow.replyNegotiation(supplierA, quote.id, {
        decision: "keep",
        price: null,
        comment: null,
      }),
    ).rejects.toThrow("comment_required");
    // A Wellmix registra a resposta que o fornecedor deu por fora.
    await flow.replyNegotiation(admin, quote.id, {
      decision: "keep",
      price: null,
      comment: "Matéria-prima subiu.",
    });
    const after = await quoteOf(quote.id);
    expect(after.price).toBe(3.8);
    expect(after.negotiation!.map((n) => n.kind)).toEqual([
      "return",
      "counter",
      "return",
      "keep",
    ]);
    await expect(
      flow.replyNegotiation(supplierA, quote.id, {
        decision: "keep",
        price: null,
        comment: "de novo",
      }),
    ).rejects.toThrow("negotiation_none");
  });
});

describe("proposta de embalagem com o OK do fornecedor", () => {
  it("a Wellmix envia a imagem e o prompt; só o fornecedor da cotação abre; a escolha espera o OK", async () => {
    const { quote } = await quoted("Quadro embalagem");
    await expect(
      flow.sendPackagingProposal(supplierA, quote.id, {
        prompt: null,
        image: image(),
      }),
    ).rejects.toThrow();
    await expect(
      flow.sendPackagingProposal(admin, quote.id, {
        prompt: null,
        image: new File(["x"], "a.txt", { type: "text/plain" }),
      }),
    ).rejects.toThrow("proposal_image_required");
    await flow.sendPackagingProposal(admin, quote.id, {
      prompt: "Caixa kraft com janela, logo Wellmix à esquerda.",
      image: image(),
    });
    const sent = (await quoteOf(quote.id)).packagingProposal!;
    expect(sent).toMatchObject({
      version: 1,
      decision: null,
      prompt: "Caixa kraft com janela, logo Wellmix à esquerda.",
    });
    const doc = (await getStore().get("documents", sent.imageDocumentId!))!;
    expect(doc.quoteId).toBe(quote.id);
    // Isolamento: a Wellmix e o fornecedor da cotação; mais ninguém.
    expect(await canAccessDocument(admin, doc)).toBe(true);
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
    expect(await canAccessDocument(joao, doc)).toBe(false);

    await expect(r.selectQuote(admin, quote.id, sell)).rejects.toThrow(
      "packaging_ok_waiting",
    );
    // Dizer não pede o motivo; outro fornecedor não responde.
    await expect(
      flow.decidePackagingProposal(supplierB, quote.id, {
        decision: "ok",
        comment: null,
      }),
    ).rejects.toThrow();
    await expect(
      flow.decidePackagingProposal(supplierA, quote.id, {
        decision: "no",
        comment: null,
      }),
    ).rejects.toThrow("comment_required");
    await flow.decidePackagingProposal(supplierA, quote.id, {
      decision: "no",
      comment: "Não fazemos janela nesse tamanho.",
    });
    expect(
      packagingProposalState((await quoteOf(quote.id)).packagingProposal),
    ).toBe("no");
    // Recusada: a escolha continua parada e a Wellmix volta à seleção.
    await expect(r.selectQuote(admin, quote.id, sell)).rejects.toThrow(
      "packaging_ok_refused",
    );
    // Proposta nova: a anterior vai para o histórico e volta a esperar.
    await flow.sendPackagingProposal(admin, quote.id, {
      prompt: "Sem janela.",
      image: image(),
    });
    const second = (await quoteOf(quote.id)).packagingProposal!;
    expect([second.version, second.decision, second.history?.length]).toEqual([
      2,
      null,
      1,
    ]);
    expect(second.history![0]).toMatchObject({ version: 1, decision: "no" });
    await flow.decidePackagingProposal(supplierA, quote.id, {
      decision: "ok",
      comment: null,
    });
    await expect(
      flow.decidePackagingProposal(supplierA, quote.id, {
        decision: "no",
        comment: "mudei de ideia",
      }),
    ).rejects.toThrow("proposal_not_waiting");
    // Com o OK, a escolha segue.
    await r.selectQuote(admin, quote.id, sell);
    expect((await quoteOf(quote.id)).status).toBe("selected");
  });

  it("cotação sem negociação nem proposta segue como sempre", async () => {
    const { quote } = await quoted("Quadro simples");
    await r.selectQuote(admin, quote.id, sell);
    expect((await quoteOf(quote.id)).status).toBe("selected");
  });
});
