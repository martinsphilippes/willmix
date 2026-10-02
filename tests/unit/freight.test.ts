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
    expect(await fr.inviteFreightForQuote(supplierA, quote.id)).toBe(1);
    // Reenvio sem mudança na carga não duplica.
    expect(await fr.inviteFreightForQuote(supplierA, quote.id)).toBe(0);
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
    await setSetting("fxManualRates", { USD: 5, RMB: null, EUR: null });
    await setSetting("fxPtax", null);
    await setSetting("freightPerCbm", 100);
    await setSetting("freightCurrency", "USD");
    const { request, quote } = await answeredQuote();
    await fr.inviteFreightForQuote(supplierA, quote.id);
    const [fq] = await getStore().list("freight_quotes", {
      filter: { quoteId: quote.id },
    });

    const before = await quotePricing(request, [quote]);
    expect(before.quotes[0].shippingFreight.status).toBe("waiting");
    expect(before.quotes[0].result.freightSource).toBe("cbm");

    await fr.answerFreight(carrier, fq.id, {
      amount: 800,
      currency: "USD",
      transitDays: 35,
      validUntil: null,
      notes: null,
    });
    const after = await quotePricing(request, [quote]);
    const p = after.quotes[0];
    expect(p.shippingFreight).toMatchObject({
      status: "answered",
      carrierName: "Marítima SA",
      brl: 4000,
    });
    expect(p.result.freightSource).toBe("carrier");
    expect(p.result.freightBrl).toBe(4000);
    // Valor digitado pelo operador prevalece.
    const typed = await quotePricing(request, [quote], { carrierBrl: 3000 });
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
});
