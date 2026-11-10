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

const { translator } = await import("@/i18n");
const booking = await import("@/lib/services/booking");
const { ensureBookingForProduct } =
  await import("@/lib/services/booking-intake");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
const { PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { offerRoundOf, suggestedReturnPrice } = await import("@/lib/quote-flow");

describe("preço desejado: a solicitação que nasce do Booking", () => {
  let seq = 0;

  /** Produto do fornecedor A no Booking, já virado solicitação com a RFQ aberta. */
  async function fromBooking(suppliers = ["fornecedor-a"]) {
    seq++;
    const store = getStore();
    const [line] = await store.list("product_lines", { limit: 1 });
    const product = await store.create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      lineId: line.id,
      name: `Moldura do Booking ${seq}`,
      sku: null,
      specification: null,
      active: true,
      source: "import",
      supplierId: "fornecedor-a",
    } as never);
    await saveProductSheet(admin, product.id, {
      price: 4,
      currency: "RMB",
      moq: 120,
      masterCartonQty: 12,
    });
    const { booking: row } = await ensureBookingForProduct(admin, {
      productId: product.id,
      importBatchId: "lote-oferta",
      sourceFileName: "feira.xls",
      sourceRows: String(seq),
      sourceOrder: seq,
    });
    const [req] = await booking.generateRequestFromBooking(
      admin,
      { ids: [row.id], customer: "cliente-joao" },
      translator("pt"),
    );
    await r.openRfq(admin, req.id, suppliers);
    const quotes = await store.list("quotes", {
      filter: { requestId: req.id },
    });
    const quote = quotes.find((q) => q.supplierId === "fornecedor-a")!;
    return { product, req, quote, quotes };
  }

  it("só o fornecedor do produto recebe o preço da ficha; os outros convidados e a solicitação comum, não", async () => {
    const { req, quote, quotes } = await fromBooking([
      "fornecedor-a",
      "fornecedor-b",
    ]);
    expect(await flow.quoteOfferFor(quote, req)).toEqual({
      price: 4,
      currency: "CNY",
      leadTimeDays: null,
    });
    const other = quotes.find((q) => q.supplierId === "fornecedor-b");
    if (other) expect(await flow.quoteOfferFor(other, req)).toBeNull();
    // Solicitação que não veio do Booking: cotação como sempre.
    const plain = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: req.productId,
      productName: "Fora do Booking",
      description: "x",
      specification: null,
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, plain.id, ["fornecedor-a"]);
    const [plainQuote] = await getStore().list("quotes", {
      filter: { requestId: plain.id },
    });
    expect(await flow.quoteOfferFor(plainQuote, plain)).toBeNull();
    await expect(
      flow.replyQuoteOffer(supplierA, plainQuote.id, {
        decision: "confirm",
        price: null,
        leadTimeDays: 30,
        comment: null,
      }),
    ).rejects.toThrow("offer_none");
  });

  it("o preço mudado na tabela do Booking é o que o fornecedor recebe", async () => {
    const { product, req, quote } = await fromBooking();
    await saveProductSheet(admin, product.id, { price: 3.5 });
    expect((await flow.quoteOfferFor(quote, req))?.price).toBe(3.5);
  });

  it("confirmar: a cotação fica respondida com o preço desejado, sem a ficha inteira, e a escolha segue", async () => {
    const { req, quote } = await fromBooking();
    // Só o fornecedor da cotação (ou a Wellmix por ele); prazo obrigatório.
    await expect(
      flow.replyQuoteOffer(supplierB, quote.id, {
        decision: "confirm",
        price: null,
        leadTimeDays: 30,
        comment: null,
      }),
    ).rejects.toThrow();
    await expect(
      flow.replyQuoteOffer(supplierA, quote.id, {
        decision: "confirm",
        price: null,
        leadTimeDays: 0,
        comment: null,
      }),
    ).rejects.toThrow("offer_lead_time_required");
    expect((await quoteOf(quote.id)).status).toBe("invited");

    await flow.replyQuoteOffer(supplierA, quote.id, {
      decision: "confirm",
      price: null,
      leadTimeDays: 35,
      comment: null,
    });
    const answered = await quoteOf(quote.id);
    expect([
      answered.status,
      answered.price,
      answered.currency,
      answered.leadTimeDays,
    ]).toEqual(["answered", 4, "CNY", 35]);
    expect(answered.negotiation?.map((n) => n.kind)).toEqual([
      "offer",
      "confirm",
    ]);
    expect(offerRoundOf(answered.negotiation)?.targetPrice).toBe(4);
    expect((await getStore().get("requests", req.id))!.status).toBe(
      "QUOTATION_RECEIVED",
    );
    // Respondida: o preço desejado não espera mais resposta.
    expect(await flow.quoteOfferFor(answered, req)).toBeNull();
    await expect(
      flow.replyQuoteOffer(supplierA, quote.id, {
        decision: "confirm",
        price: null,
        leadTimeDays: 35,
        comment: null,
      }),
    ).rejects.toThrow("offer_none");
    // Nada em aberto: a Wellmix escolhe.
    await r.selectQuote(admin, quote.id, sell);
    expect((await quoteOf(quote.id)).status).toBe("selected");
  });

  it("outro preço: a cotação fica com o preço do fornecedor, a Wellmix é avisada e devolve já com o preço desejado", async () => {
    const { req, quote } = await fromBooking();
    await expect(
      flow.replyQuoteOffer(supplierA, quote.id, {
        decision: "counter",
        price: null,
        leadTimeDays: 30,
        comment: null,
      }),
    ).rejects.toThrow("offer_price_required");
    await flow.replyQuoteOffer(supplierA, quote.id, {
      decision: "counter",
      price: 4.6,
      leadTimeDays: 30,
      comment: "O material subiu.",
    });
    const countered = await quoteOf(quote.id);
    expect([countered.status, countered.price, countered.conditions]).toEqual([
      "answered",
      4.6,
      "O material subiu.",
    ]);
    expect(countered.negotiation?.map((n) => n.kind)).toEqual([
      "offer",
      "counter",
    ]);
    expect(countered.negotiation?.[1]).toMatchObject({
      side: "supplier",
      previousPrice: 4,
      price: 4.6,
    });
    const alerts = await getStore().list("notifications", {
      filter: { link: `/app/quotes/${quote.id}#negotiation` },
    });
    expect(
      alerts.some((n) => n.subject.includes("Preço diferente do desejado")),
    ).toBe(true);
    // A devolução já sugere o preço desejado (e não os 10% a menos).
    expect(
      suggestedReturnPrice(countered.price, countered.negotiation),
    ).toEqual({ price: 4, fromOffer: true });
    // A negociação de sempre continua daqui: devolver e responder.
    await flow.returnQuote(admin, quote.id, {
      comment: "Precisamos chegar no preço combinado na feira.",
      targetPrice: 4,
    });
    await expect(r.selectQuote(admin, quote.id, sell)).rejects.toThrow(
      "negotiation_pending",
    );
    await flow.replyNegotiation(supplierA, quote.id, {
      decision: "accept",
      price: null,
      comment: null,
    });
    expect((await quoteOf(quote.id)).price).toBe(4);
    expect((await getStore().get("requests", req.id))!.status).toBe(
      "QUOTATION_RECEIVED",
    );
  });

  it("outro preço igual ao desejado é uma confirmação; a Wellmix pode registrar a resposta pelo fornecedor", async () => {
    const { quote } = await fromBooking();
    await flow.replyQuoteOffer(admin, quote.id, {
      decision: "counter",
      price: 4,
      leadTimeDays: 28,
      comment: null,
    });
    const answered = await quoteOf(quote.id);
    expect(answered.negotiation?.map((n) => n.kind)).toEqual([
      "offer",
      "confirm",
    ]);
    expect(answered.price).toBe(4);
  });

  /** Foto que veio com o produto (a da ficha técnica), no cadastro. */
  async function catalogPhoto(productId: string, kind = "supplier") {
    const store = getStore();
    const doc = await store.create("documents", {
      orderId: null,
      requestId: null,
      productId,
      type: "photo",
      name: "ficha.png",
      mimeType: "image/png",
      size: 10,
      storageKey: `teste-${productId}-${kind}`,
      visibility: "all",
      uploadedByUserId: admin.id,
    } as never);
    return store.create("product_photos", {
      productId,
      sourcingItemId: null,
      orderId: null,
      documentId: doc.id,
      kind,
      caption: null,
      takenAt: new Date().toISOString(),
      takenByUserId: admin.id,
      derivedFromPhotoId: null,
      isPrimary: true,
    } as never);
  }
  const PHOTO_FIELDS = [
    "scalePhoto",
    "rulerPhoto",
    "sidePhoto",
    "anglePhoto",
    "originalPhoto",
  ];
  const photoGaps = (missing: readonly string[]) =>
    missing.filter((m) => PHOTO_FIELDS.includes(m));

  it("as fotos que vieram com o produto no Booking já contam na cotação do fornecedor dele; sem foto, ou outro fornecedor, tudo como antes", async () => {
    const { product, req, quote, quotes } = await fromBooking([
      "fornecedor-a",
      "fornecedor-b",
    ]);
    // Produto sem foto: as cinco fotos continuam faltando.
    const before = (await qs.getQuoteSheetForUser(admin, quote.id))!;
    expect(photoGaps(before.missing)).toHaveLength(5);
    expect([before.bookingPhotos, before.waivedPhotoKinds]).toEqual([[], []]);

    const photo = await catalogPhoto(product.id);
    const view = (await qs.getQuoteSheetForUser(admin, quote.id))!;
    expect(photoGaps(view.missing)).toEqual([]);
    expect(view.bookingPhotos.map((p) => p.id)).toEqual([photo.id]);
    expect([...view.waivedPhotoKinds].sort()).toEqual([
      "angle",
      "dimension_scale",
      "dimension_side",
      "original",
      "weight_scale",
    ]);
    // O fornecedor do produto vê o mesmo (a foto é dele e é pública).
    const own = (await qs.getQuoteSheetForUser(supplierA, quote.id))!;
    expect(photoGaps(own.missing)).toEqual([]);
    expect(own.bookingPhotos).toHaveLength(1);
    // Salvar a ficha devolve a mesma conta do que falta.
    const saved = await qs.saveQuoteSheet(supplierA, quote.id, {
      material: "PS",
    });
    expect(photoGaps(saved.missing)).toEqual([]);

    // Outro fornecedor convidado: as cinco fotos dele continuam exigidas e
    // ele não recebe a foto do concorrente.
    const other = quotes.find((q) => q.supplierId === "fornecedor-b");
    if (other) {
      const theirs = (await qs.getQuoteSheetForUser(admin, other.id))!;
      expect(photoGaps(theirs.missing)).toHaveLength(5);
      expect([theirs.bookingPhotos, theirs.waivedPhotoKinds]).toEqual([[], []]);
    }
    // Solicitação comum do mesmo produto: como sempre.
    const plain = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: req.productId,
      productName: "Fora do Booking, com foto",
      description: "x",
      specification: null,
      quantity: 500,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, plain.id, ["fornecedor-a"]);
    const [plainQuote] = await getStore().list("quotes", {
      filter: { requestId: plain.id },
    });
    const usual = (await qs.getQuoteSheetForUser(admin, plainQuote.id))!;
    expect(photoGaps(usual.missing)).toHaveLength(5);
    expect(usual.waivedPhotoKinds).toEqual([]);
  });

  it("foto do Booking que quem vê não pode abrir não vira miniatura (o acesso ao arquivo não muda)", async () => {
    const { product, quote } = await fromBooking();
    const photo = await catalogPhoto(product.id);
    await getStore().update("documents", photo.documentId, {
      visibility: "internal",
    });
    const own = (await qs.getQuoteSheetForUser(supplierA, quote.id))!;
    expect(own.bookingPhotos).toEqual([]);
    // A dispensa continua (a foto existe); a Wellmix vê a miniatura.
    expect(photoGaps(own.missing)).toEqual([]);
    const wellmix = (await qs.getQuoteSheetForUser(admin, quote.id))!;
    expect(wellmix.bookingPhotos).toHaveLength(1);
  });

  it("sem desconto sugerido quando não houve preço desejado; textos nas três línguas", async () => {
    expect(suggestedReturnPrice(4, null)).toEqual({
      price: 3.6,
      fromOffer: false,
    });
    for (const lang of ["pt", "en", "zh"] as const) {
      const tr = translator(lang);
      for (const key of [
        "quoteFlow.offer.title",
        "quoteFlow.offer.confirm",
        "quoteFlow.offer.counter",
        "quoteFlow.neg.round.offer",
        "quoteFlow.neg.round.confirm",
        "quoteFlow.neg.differs",
        "purchaseFlow.error.offer_none",
        "purchaseFlow.error.offer_lead_time_required",
        "purchaseFlow.error.offer_price_required",
      ] as const)
        expect(tr(key)).not.toBe(key);
    }
  });
});
