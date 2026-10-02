import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Valor ao cliente calculado na seleção e atualização da proposta pelo câmbio do dia. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const qp = await import("@/lib/services/quote-pricing");
const { brazilDay } = await import("@/lib/services/fx");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  await setSetting("marginPercent", 20);
  await setSetting("marginByCustomer", { "cliente-joao": 25 });
  await setSetting("freightPerCbm", 100);
});

const fxFor = (day: string, usd: number) => ({
  day,
  fetchedAt: `${day}T12:00:00.000Z`,
  rates: { USD: usd, RMB: 0.7, EUR: 6 },
  quotedAt: {},
});

describe("valor ao cliente e câmbio", () => {
  it("calcula na seleção, avisa a variação e atualiza a proposta", async () => {
    const store = getStore();
    const today = brazilDay();
    const yesterday = "2000-01-01";
    // Câmbio "de ontem" na seleção.
    await setSetting("fxPtax", fxFor(yesterday, 5));
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Jarra",
      description: "Teste",
      specification: null,
      quantity: 240,
      unit: "un",
      deadline: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    await qs.saveQuoteSheet(supplierA, quote.id, {
      price: 10,
      currency: "USD",
      masterCartonQty: 24,
      cbmPerCarton: 0.1,
    });
    await qs.saveQuoteSheet(admin, quote.id, {
      importTaxPercent: 20,
      ipiPercent: 10,
    });
    await r.answerQuote(supplierA, quote.id, {
      price: 10,
      currency: "USD",
      leadTimeDays: 20,
    });
    const fxYesterday = {
      rates: { USD: 5, RMB: 0.7, EUR: 6 },
      status: "today" as const,
      day: yesterday,
      quotedAt: {},
      source: "ptax" as const,
      lastError: null,
    };
    const ctx = await qp.quotePricing(request, [quote], { fx: fxYesterday });
    const p = ctx.quotes[0];
    // FOB 10×240×5 = 12.000; frete 10 caixas × 0,1 × 100 × 5 = 500; CIF 12.500
    // II 2.500; IPI 1.500; custo 16.500; margem do cliente 25% → 20.625
    expect(p.result.sellBrl).toBe(20625);
    expect(p.marginSource).toBe("customer");
    await r.selectQuote(admin, quote.id, {
      sellPrice: 20625,
      sellCurrency: "BRL",
      pricing: {
        quoteId: quote.id,
        input: p.input,
        result: p.result,
        marginSource: p.marginSource,
        fxStatus: "today",
        fxDay: yesterday,
        sellPrice: 20625,
        sellCurrency: "BRL",
      },
    });
    const record = (await qp.latestPricingRecord(request.id))!;
    expect(record.result.sellBrl).toBe(20625);

    // Hoje o dólar subiu 10%: aviso de variação.
    const fxToday = {
      rates: { USD: 5.5, RMB: 0.7, EUR: 6 },
      status: "today" as const,
      day: today,
      quotedAt: {},
      source: "ptax" as const,
      lastError: null,
    };
    const variance = qp.fxVariance(record, fxToday)!;
    expect(variance.pct).toBeCloseTo(10, 6);

    // Atualiza a proposta com o câmbio de hoje (sinal acompanha).
    await setSetting("fxPtax", fxFor(today, 5.5));
    const updated = await qp.refreshProposal(admin, request.id);
    expect(updated.sellPrice).toBe(22687.5); // 20.625 × 1,1
    const fresh = (await store.get("requests", request.id))!;
    expect(fresh.sellPrice).toBe(22687.5);
    expect(fresh.downPaymentAmount).toBeCloseTo(22687.5 * 0.3, 2);

    // Com comprovante enviado, não muda mais.
    const [payment] = await store.list("payments", {
      filter: { requestId: request.id, direction: "customer_in" },
    });
    await store.update("payments", payment.id, { proofDocumentId: "doc-x" });
    await expect(qp.refreshProposal(admin, request.id)).rejects.toThrow(
      "proof_already_sent",
    );
    // Cliente não atualiza proposta.
    await expect(qp.refreshProposal(joao, request.id)).rejects.toThrow();
  });
});
