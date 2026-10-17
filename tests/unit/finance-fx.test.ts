import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Margem com câmbio: o que foi pago ao fornecedor usa o câmbio real do
 * pagamento; o que falta pagar (ou tudo, antes do primeiro pagamento) é
 * estimado pelo câmbio do dia ("~", com o câmbio à vista); com o câmbio da
 * venda gravado na proposta, mostra quanto o câmbio mexeu na margem.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const f = await import("@/lib/services/finance");
const { brazilDay } = await import("@/lib/services/fx");
const { translator } = await import("@/i18n");
const text = await import("@/components/finance-fx-text");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Payment = import("@/lib/db").Payment;
type PricingRecord = import("@/lib/services/quote-pricing").PricingRecord;

const names = { customer: "", supplier: "", product: "" };
const order = (patch: Partial<Order> = {}) =>
  ({
    status: "PRODUCTION",
    sellPrice: 10000,
    sellCurrency: "BRL",
    fobTotal: 1000,
    fobCurrency: "USD",
    ...patch,
  }) as unknown as Order;
const out = (amount: number, fxRate: number | null) =>
  ({
    amount,
    direction: "supplier_out",
    status: "confirmed",
    fxRate,
  }) as Payment;
const today = (
  usd: number,
  status: "today" | "stale" | "manual" = "today",
) => ({
  rates: { USD: usd, RMB: 0.75, EUR: 6 },
  status,
  day: "2026-10-17",
});

describe("custo e margem pelo câmbio", () => {
  it("nada pago: tudo estimado pelo câmbio do dia", () => {
    const x = f.computeOrderFinance(order(), [], names, { today: today(5.4) });
    expect(x.fxBasis).toBe("estimate");
    expect(x.estimated).toBe(true);
    expect(x.cost).toBeCloseTo(5400, 6);
    expect(x.margin).toBeCloseTo(4600, 6);
    expect(x.estimateRate).toBe(5.4);
    expect(x.estimateFrom).toBe("today");
    expect(x.estimateDay).toBe("2026-10-17");
  });

  it("pago em parte: o pago no câmbio real, o saldo no do dia", () => {
    const x = f.computeOrderFinance(order(), [out(300, 5.1)], names, {
      today: today(5.4),
    });
    expect(x.fxBasis).toBe("partial");
    expect(x.estimated).toBe(true);
    expect(x.avgFx).toBeCloseTo(5.1, 6);
    // 300 × 5,1 + 700 × 5,4
    expect(x.cost).toBeCloseTo(1530 + 3780, 6);
  });

  it("pago sem câmbio informado continua estimado", () => {
    const x = f.computeOrderFinance(order(), [out(1000, null)], names, {
      today: today(5.4),
    });
    expect(x.fxBasis).toBe("estimate");
    expect(x.cost).toBeCloseTo(5400, 6);
  });

  it("tudo pago com câmbio: custo real, sem estimativa", () => {
    const x = f.computeOrderFinance(
      order(),
      [out(400, 5), out(600, 5.2)],
      names,
      { today: today(5.4) },
    );
    expect(x.fxBasis).toBe("paid");
    expect(x.estimated).toBe(false);
    expect(x.cost).toBeCloseTo(2000 + 3120, 6);
    expect(x.estimateRate).toBeNull();
    expect(x.estimateDay).toBeNull();
  });

  it("sem câmbio do dia: saldo pela média paga; sem nada: câmbio pendente", () => {
    const avg = f.computeOrderFinance(order(), [out(500, 5)], names);
    expect(avg.fxBasis).toBe("partial");
    expect(avg.estimateFrom).toBe("paid");
    expect(avg.cost).toBeCloseTo(5000, 6);
    const none = f.computeOrderFinance(order(), [], names);
    expect(none.cost).toBeNull();
    expect(none.fxBasis).toBeNull();
    expect(none.margin).toBeNull();
  });

  it("mesma moeda: custo é o FOB", () => {
    const x = f.computeOrderFinance(
      order({ fobCurrency: "BRL", fobTotal: 7000 }),
      [],
      names,
      { today: today(5.4), saleFx: 5 },
    );
    expect(x.fxBasis).toBe("same");
    expect(x.cost).toBe(7000);
    expect(x.estimated).toBe(false);
    expect(x.saleFx).toBeNull();
    expect(x.fxEffect).toBeNull();
  });

  it("câmbio cruzado (RMB → USD) e de onde veio a cotação", () => {
    expect(f.crossRate({ USD: 5.4, RMB: 0.75 }, "RMB", "USD")).toBeCloseTo(
      0.75 / 5.4,
      10,
    );
    expect(f.crossRate({ USD: 5.4 }, "RMB", "BRL")).toBeNull();
    expect(f.crossRate({ USD: 5.4 }, "USD", "BRL")).toBe(5.4);
    const x = f.computeOrderFinance(
      order({ fobCurrency: "RMB", sellCurrency: "USD", sellPrice: 2000 }),
      [],
      names,
      { today: today(5.4, "stale") },
    );
    expect(x.cost).toBeCloseTo((1000 * 0.75) / 5.4, 6);
    expect(x.estimateFrom).toBe("stale");
  });

  it("FOB zerado (preço não informado): sem margem estimada", () => {
    const x = f.computeOrderFinance(order({ fobTotal: 0 }), [], names, {
      today: today(5.4),
    });
    expect(x.cost).toBeNull();
  });
});

describe("efeito do câmbio desde a venda", () => {
  const record = (patch: Partial<PricingRecord> = {}) =>
    ({
      input: { currency: "USD" },
      result: { fxRate: 5 },
      sellCurrency: "BRL",
      ...patch,
    }) as unknown as PricingRecord;

  it("câmbio da venda vem da proposta e confere a moeda", () => {
    expect(f.saleFxFromRecord(record(), "USD", "BRL")).toBe(5);
    expect(f.saleFxFromRecord(record(), "RMB", "BRL")).toBeNull();
    expect(f.saleFxFromRecord(record(), "USD", "EUR")).toBeNull();
    expect(f.saleFxFromRecord(null, "USD", "BRL")).toBeNull();
    expect(
      f.saleFxFromRecord(
        record({ result: { fxRate: null } } as never),
        "USD",
        "BRL",
      ),
    ).toBeNull();
    // Venda em dólar: R$ 5 por USD (FOB) ÷ R$ 5 por USD (venda) = 1.
    expect(
      f.saleFxFromRecord(
        record({ sellCurrency: "USD", sellFxRate: 5 }),
        "USD",
        "USD",
      ),
    ).toBe(1);
    // Venda em euro sem o câmbio da proposta (registro antigo): sem efeito.
    expect(
      f.saleFxFromRecord(
        record({ input: { currency: "RMB" }, sellCurrency: "EUR" } as never),
        "RMB",
        "EUR",
      ),
    ).toBeNull();
  });

  it("dólar subiu: perda; caiu: ganho; cancelado: sem efeito", () => {
    const up = f.computeOrderFinance(order(), [], names, {
      today: today(5.4),
      saleFx: 5,
    });
    expect(up.saleFx).toBe(5);
    expect(up.marginAtSale).toBeCloseTo(5000, 6);
    expect(up.fxEffect).toBe(-400);
    const down = f.computeOrderFinance(order(), [out(1000, 4.8)], names, {
      today: today(5.4),
      saleFx: 5,
    });
    expect(down.fxBasis).toBe("paid");
    expect(down.fxEffect).toBe(200);
    const cancelled = f.computeOrderFinance(
      order({ status: "CANCELLED" }),
      [],
      names,
      { today: today(5.4), saleFx: 5 },
    );
    expect(cancelled.fxEffect).toBeNull();
  });
});

describe("textos do câmbio", () => {
  it("deixa claro o real e o estimado, nas três línguas", () => {
    const partial = f.computeOrderFinance(order(), [out(300, 5.1)], names, {
      today: today(5.4),
      saleFx: 5,
    });
    const pt = translator("pt");
    const lines = text.fxRateLines(pt, partial)!;
    expect(lines.main).toBe("5,1000");
    expect(lines.notes).toEqual([
      "real (pagamentos)",
      "saldo a ~5,4000 (câmbio de 17/10)",
      "venda 5,0000",
    ]);
    expect(text.costEstimateNote(pt, partial)).toBe(
      "estimado a 5,4000 (câmbio de 17/10)",
    );
    const effect = text.fxEffectText(pt, partial)!;
    expect(effect.negative).toBe(true);
    expect(effect.text).toContain("câmbio desde a venda:");
    expect(effect.title).toContain("5,0000");
    expect(effect.title).toContain("5,4000");

    const estimate = f.computeOrderFinance(order(), [], names, {
      today: today(5.4, "manual"),
    });
    expect(text.fxRateLines(pt, estimate)).toEqual({
      main: "~5,4000",
      notes: ["~ câmbio manual"],
    });
    const paid = f.computeOrderFinance(order(), [out(1000, 5)], names);
    expect(text.costEstimateNote(pt, paid)).toBeNull();
    expect(text.fxRateLines(pt, paid)?.notes).toEqual(["real (pagamentos)"]);

    for (const locale of ["pt", "en", "zh"] as const) {
      const t = translator(locale);
      const all = [
        ...text.fxRateLines(t, partial)!.notes,
        text.costEstimateNote(t, partial)!,
        text.fxEffectText(t, partial)!.text,
        text.fxEffectText(t, partial)!.title,
        t("finance.fx.estimatedCount", { n: 2 }),
        t("finance.fx.estimateNote"),
      ];
      for (const s of all) {
        expect(s.startsWith("finance."), s).toBe(false);
        expect(s, s).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe("pedido de verdade", () => {
  let admin: User;
  let joao: User;
  let supplierA: User;

  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    joao = users.find((u) => u.email === "joao@lojista.com")!;
    supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  });

  it("câmbio da venda na proposta, câmbio de hoje no saldo", async () => {
    const store = getStore();
    const day = brazilDay();
    const fx = (usd: number) => ({
      day,
      fetchedAt: `${day}T12:00:00.000Z`,
      rates: { USD: usd, RMB: 0.75, EUR: 6 },
      quotedAt: {},
    });
    await setSetting("fxPtax", fx(5.3));
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Teste do câmbio na margem",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    await r.answerQuote(supplierA, quote.id, {
      price: 10,
      currency: "USD",
      leadTimeDays: 10,
      conditions: null,
    });
    await r.selectQuote(admin, quote.id, {
      sellPrice: 9000,
      sellCurrency: "BRL",
      downPaymentAmount: 2700,
      pricing: {
        quoteId: quote.id,
        input: { currency: "USD", unitPrice: 10, quantity: 100 },
        result: { fxRate: 5.3 },
        marginSource: "default",
        fxStatus: "today",
        fxDay: day,
        sellPrice: 9000,
        sellCurrency: "BRL",
      },
    });
    const placed = await r.confirmDownPayment(admin, request.id);
    expect(placed.fobTotal).toBe(1000);

    // O dólar subiu para 5,40 depois da venda.
    await setSetting("fxPtax", fx(5.4));
    const finance = await f.loadOrderFinance(placed);
    expect(finance.saleFx).toBeCloseTo(5.3, 6);
    expect(finance.fxBasis).toBe("estimate");
    expect(finance.estimateRate).toBe(5.4);
    expect(finance.estimateFrom).toBe("today");
    expect(finance.cost).toBeCloseTo(5400, 6);
    expect(finance.fxEffect).toBe(-100);

    const all = await f.loadFinance();
    const row = all.rows.find((x) => x.order.id === placed.id)!;
    expect(row.fxEffect).toBe(-100);
    expect(all.summary.estimated).toBeGreaterThanOrEqual(1);
    expect(all.summary.fxEffect).not.toBeNull();

    // A Control Tower não busca câmbio (só totais): sem estimativa.
    const tower = await f.loadFinance({ estimate: false });
    expect(
      tower.rows.find((x) => x.order.id === placed.id)!.fxBasis,
    ).toBeNull();
  });
});
