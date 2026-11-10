import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Cotação de frete pela companhia marítima a partir da ficha da cotação. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const fr = await import("@/lib/services/freight");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { quotePricing } = await import("@/lib/services/quote-pricing");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let carrier: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  carrier = users.find((u) => u.email === "armador@maritima.com")!;
});

const sheet = {
  supplierName: "Shenzhen Supplier A",
  incoterm: "FOB" as const,
  currency: "USD" as const,
  price: 2,
  moq: 500,
  masterCartonQty: 24,
  netWeightPcKg: 0.4,
  grossWeightPcKg: 0.5,
  cbmPerCarton: 0.06,
  heightCm: 30,
  widthCm: 40,
  lengthCm: 50,
  packageType: "COLOR BOX",
  colorAssortment: "WHITE",
  material: "GLASS",
  productionStartAt: "2026-11-01T00:00:00.000Z",
};

async function answeredQuote() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra frete",
    description: "Jarra com tampa",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id, supplierId: "fornecedor-a" },
  });
  await qs.saveQuoteSheet(supplierA, quote.id, sheet);
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 30,
  });
  return { request, quote };
}

describe("frete pela companhia marítima", () => {
  it("cotação enviada: companhia recebe pendência com a carga e só ela vê", async () => {
    const { request, quote } = await answeredQuote();
    // A resposta da cotação já pediu o frete à companhia marítima; reenvio
    // sem mudança na carga não duplica.
    expect(await fr.inviteFreightForQuote(supplierA, quote.id)).toBe(0);
    expect(
      await getStore().list("freight_quotes", {
        filter: { quoteId: quote.id },
      }),
    ).toHaveLength(1);
    const [fq] = await getStore().list("freight_quotes", {
      filter: { quoteId: quote.id },
    });
    // 1000 peças / 24 por caixa = 42 caixas; 42 × 0,06 = 2,52 m³; 500 kg.
    expect(fq).toMatchObject({
      carrierId: "armador",
      status: "invited",
      cartons: 42,
      totalCbm: 2.52,
      grossWeightKg: 500,
    });
    const tasks = await pendingTasksFor(carrier);
    expect(tasks.some((t) => t.link === `/app/freight/${fq.id}`)).toBe(true);
    const notes = await getStore().list("notifications", {
      filter: { userId: carrier.id },
    });
    expect(notes.some((n) => n.link === `/app/freight/${fq.id}`)).toBe(true);

    // Isolamento: fornecedor, cliente e outra companhia não veem.
    expect(await fr.getFreightView(supplierA, fq.id)).toBeNull();
    expect(await fr.getFreightView(joao, fq.id)).toBeNull();
    expect(
      await fr.getFreightView({ ...carrier, partyId: "outra" }, fq.id),
    ).toBeNull();
    await expect(
      fr.answerFreight(supplierA, fq.id, {
        amount: 1,
        currency: "USD",
        transitDays: null,
        validUntil: null,
        notes: null,
      }),
    ).rejects.toThrow();
    const view = await fr.getFreightView(carrier, fq.id);
    expect(view?.canAnswer).toBe(true);
    expect(view?.request.id).toBe(request.id);
  });

  it("frete informado entra no valor ao cliente; escolha encerra os outros", async () => {
    // Câmbio fixo: sem depender da rede (no CI a busca real funcionaria).
    const fx = {
      rates: { USD: 5 },
      status: "manual" as const,
      day: null,
      quotedAt: {},
      source: null,
      lastError: null,
    };
    await setSetting("freightPerCbm", 100);
    await setSetting("freightCurrency", "USD");
    const { request, quote } = await answeredQuote();
    await fr.inviteFreightForQuote(supplierA, quote.id);
    const [fq] = await getStore().list("freight_quotes", {
      filter: { quoteId: quote.id },
    });

    const before = await quotePricing(request, [quote], { fx });
    expect(before.quotes[0].shippingFreight.status).toBe("waiting");
    expect(before.quotes[0].result.freightSource).toBe("cbm");

    await fr.answerFreight(carrier, fq.id, {
      amount: 800,
      currency: "USD",
      transitDays: 35,
      validUntil: null,
      notes: null,
    });
    const after = await quotePricing(request, [quote], { fx });
    const p = after.quotes[0];
    expect(p.shippingFreight).toMatchObject({
      status: "answered",
      carrierName: "Marítima SA",
      brl: 4000,
    });
    expect(p.result.freightSource).toBe("carrier");
    expect(p.result.freightBrl).toBe(4000);
    // Valor digitado pelo operador prevalece.
    const typed = await quotePricing(request, [quote], {
      carrierBrl: 3000,
      fx,
    });
    expect(typed.quotes[0].result.freightBrl).toBe(3000);

    // Pendência da companhia some depois de responder.
    const tasks = await pendingTasksFor(carrier);
    expect(tasks.some((t) => t.link === `/app/freight/${fq.id}`)).toBe(false);

    // Outro fornecedor escolhido: frete desta cotação é encerrado.
    const [other] = await getStore().list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-b" },
    });
    await r.answerQuote(
      (
        await getStore().list("users", {
          filter: { email: "supplier.b@china.com" },
        })
      )[0],
      other.id,
      { price: 3, currency: "USD", leadTimeDays: 20 },
    );
    await r.selectQuote(admin, other.id, {
      sellPrice: 20000,
      sellCurrency: "BRL",
    });
    expect((await getStore().get("freight_quotes", fq.id))?.status).toBe(
      "cancelled",
    );
    await expect(
      fr.answerFreight(carrier, fq.id, {
        amount: 900,
        currency: "USD",
        transitDays: null,
        validUntil: null,
        notes: null,
      }),
    ).rejects.toThrow("closed");
  });

  it("frete enviado: confirmação só para a companhia dele, com o próximo pedido", async () => {
    const first = await answeredQuote();
    const second = await answeredQuote();
    await fr.inviteFreightForQuote(supplierA, first.quote.id);
    await fr.inviteFreightForQuote(supplierA, second.quote.id);
    const [fq] = await getStore().list("freight_quotes", {
      filter: { quoteId: first.quote.id },
    });
    // Ainda sem valor: nada a confirmar.
    expect(await fr.sentFreightView(carrier, fq.id)).toBeNull();
    await fr.answerFreight(carrier, fq.id, {
      amount: 900,
      currency: "USD",
      transitDays: 30,
      validUntil: null,
      notes: null,
    });
    expect(await fr.sentFreightView(carrier, fq.id)).toMatchObject({
      id: fq.id,
      productName: "Jarra frete",
      amount: 900,
      currency: "USD",
      transitDays: 30,
    });
    // Fornecedor e cliente não veem; id estranho não derruba.
    expect(await fr.sentFreightView(supplierA, fq.id)).toBeNull();
    expect(await fr.sentFreightView(joao, fq.id)).toBeNull();
    expect(await fr.sentFreightView(carrier, "nao-existe")).toBeNull();
    // O outro pedido continua para informar.
    const open = (await fr.listFreightFor(carrier)).filter(
      (f) => f.status === "invited",
    );
    expect(open.some((f) => f.quoteId === second.quote.id)).toBe(true);
  });
  it("cotação sem a ficha (só o preço confirmado): a companhia recebe o pedido com a carga do cadastro; sem volume, só quando a ficha chegar", async () => {
    const store = getStore();
    const [product] = await store.list("products", { limit: 1 });
    await store.update("products", product.id, {
      masterBoxQty: 10,
      cbm: 0.05,
      grossWeightKg: 0.3,
    });
    const withCatalog = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: product.id,
      productName: product.name,
      description: "Produto do catálogo",
      specification: null,
      quantity: 1000,
      unit: "un",
      deadline: null,
    });
    const [q1] = await r.openRfq(admin, withCatalog.id, ["fornecedor-a"]);
    // Sem ficha: só o preço (como na oferta que nasce do Booking).
    await r.answerQuote(supplierA, q1.id, {
      price: 2,
      currency: "USD",
      leadTimeDays: 30,
    });
    const [fq] = await store.list("freight_quotes", {
      filter: { quoteId: q1.id },
    });
    // 1000 / 10 = 100 caixas × 0,05 = 5 m³; 1000 × 0,3 = 300 kg.
    expect(fq).toMatchObject({
      carrierId: "armador",
      status: "invited",
      cartons: 100,
      totalCbm: 5,
      grossWeightKg: 300,
    });

    // Produto fora do catálogo e sem ficha: não há carga para cotar.
    const noVolume = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Sem volume",
      description: "Sem volume",
      specification: null,
      quantity: 500,
      unit: "un",
      deadline: null,
    });
    const [q2] = await r.openRfq(admin, noVolume.id, ["fornecedor-a"]);
    await r.answerQuote(supplierA, q2.id, {
      price: 2,
      currency: "USD",
      leadTimeDays: 30,
    });
    expect(
      await store.list("freight_quotes", { filter: { quoteId: q2.id } }),
    ).toHaveLength(0);
    // A ficha trouxe a carga: o pedido de frete sai.
    await qs.saveQuoteSheet(supplierA, q2.id, sheet);
    const [late] = await store.list("freight_quotes", {
      filter: { quoteId: q2.id },
    });
    expect(late).toMatchObject({ status: "invited", cartons: 21 });
  });

  it("o valor informado pela companhia fica fixado na conta; sem resposta, vale o estimado", async () => {
    await setSetting("freightPerCbm", 100);
    await setSetting("freightCurrency", "BRL");
    const { request, quote } = await answeredQuote();
    const fresh = (await getStore().get("quotes", quote.id))!;
    const before = (await quotePricing(request, [fresh])).quotes[0];
    expect(before.shippingFreight.status).toBe("waiting");
    // Estimado por CBM: 2,52 m³ × R$ 100.
    expect(before.result.freightSource).toBe("cbm");
    expect(before.result.freightBrl).toBeCloseTo(252, 2);
    const [fq] = await getStore().list("freight_quotes", {
      filter: { quoteId: quote.id },
    });
    await fr.answerFreight(carrier, fq.id, {
      amount: 900,
      currency: "BRL",
      transitDays: 35,
      validUntil: null,
      notes: null,
    });
    const after = (await quotePricing(request, [fresh])).quotes[0];
    expect(after.shippingFreight).toMatchObject({
      status: "answered",
      brl: 900,
    });
    expect(after.result.freightSource).toBe("carrier");
    expect(after.result.freightBrl).toBe(900);
  });
});
