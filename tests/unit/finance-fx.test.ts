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
const out = (amount: number, fxRate: number | null, currency = "USD") =>
  ({
    amount,
    currency,
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
    // Pago em parte: diz o que é real e o que foi estimado.
    expect(text.costEstimateNote(pt, partial)).toBe(
      "pago no câmbio real; o resto estimado a 5,4000 (câmbio de 17/10)",
    );
    expect(
      text.costEstimateNote(
        pt,
        f.computeOrderFinance(order(), [], names, { today: today(5.4) }),
      ),
    ).toBe("estimado a 5,4000 (câmbio de 17/10)");
    const effect = text.fxEffectText(pt, partial)!;
    expect(effect.negative).toBe(true);
    expect(effect.text).toContain("câmbio desde a venda:");
    expect(effect.title).toContain("5,0000");
    // Câmbio médio do custo: 300 a 5,1 + 700 a 5,4.
    expect(effect.title).toContain("~5,3100");

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

describe("achados da revisão", () => {
  const pt = translator("pt");

  it("pagamento a mais ou FOB reduzido depois de pago não vira perda de câmbio", () => {
    // Comprou 1000 e pagou a 5; a quantidade caiu 10% depois (FOB 900, venda 9000).
    const cut = f.computeOrderFinance(
      order({ fobTotal: 900, sellPrice: 9000 }),
      [out(1000, 5)],
      names,
      { today: today(5), saleFx: 5 },
    );
    expect(cut.cost).toBeCloseTo(5000, 6);
    expect(cut.fxEffect).toBe(0);
    expect(text.fxEffectText(pt, cut)).toBeNull();
    // Taxa do banco: pagou 1020 ao câmbio da venda.
    const fee = f.computeOrderFinance(order(), [out(1020, 5)], names, {
      today: today(5),
      saleFx: 5,
    });
    expect(fee.fxEffect).toBe(0);
    // FOB ainda zerado, 500 pagos ao câmbio da venda.
    const zero = f.computeOrderFinance(
      order({ fobTotal: 0 }),
      [out(500, 5)],
      names,
      { today: today(5), saleFx: 5 },
    );
    expect(zero.cost).toBeCloseTo(2500, 6);
    expect(zero.fxEffect).toBe(0);
    // Câmbio mudou de verdade: o efeito é só a diferença de câmbio.
    const moved = f.computeOrderFinance(
      order({ fobTotal: 900, sellPrice: 9000 }),
      [out(1000, 5.2)],
      names,
      { today: today(5.4), saleFx: 5 },
    );
    expect(moved.fxEffect).toBe(-200);
  });

  it("pagamento em outra moeda: em reais pelo câmbio dele, abatendo o FOB pelo câmbio do dia", () => {
    // FOB US$ 1000; pagou ¥ 3600 a R$ 0,75 (≈ US$ 500 hoje).
    const x = f.computeOrderFinance(order(), [out(3600, 0.75, "CNY")], names, {
      today: today(5.4),
      saleFx: 5.4,
    });
    expect(x.paid).toBe(0); // "Pago" na moeda do FOB, como a conta corrente
    expect(x.paidOther).toEqual({ CNY: 3600 });
    expect(x.payable).toBe(1000);
    expect(x.crossConverted).toBe(true);
    expect(x.estimated).toBe(true);
    expect(x.fxBasis).toBe("partial");
    expect(x.unpaid).toBeCloseTo(500, 6);
    // 2.700 reais pagos + US$ 500 a 5,4
    expect(x.cost).toBeCloseTo(5400, 6);
    expect(x.fxEffect).toBe(0);
    const crossLines = text.fxRateLines(pt, x)!;
    expect(crossLines.notes).toContain(
      "pagamento em outra moeda convertido pelo câmbio do dia",
    );
    // Nada pago na moeda do FOB com câmbio: o número principal é estimado,
    // sem "real (pagamentos)" (depende do câmbio do dia).
    expect(x.avgFx).toBeNull();
    expect(crossLines.main.startsWith("~")).toBe(true);
    expect(crossLines.notes).not.toContain("real (pagamentos)");
    // Misto: o real é só o pago em dólar com câmbio (5,2), não o do dia.
    const mixed = f.computeOrderFinance(
      order(),
      [out(500, 5.2), out(2700, null, "BRL")],
      names,
      { today: today(5.4) },
    );
    expect(mixed.avgFx).toBeCloseTo(5.2, 6);
    expect(text.fxRateLines(pt, mixed)!.main).toBe("5,2000");
    // FOB em yuan pago em dólar (R$ 5,40 por US$).
    const rmb = f.computeOrderFinance(
      order({ fobCurrency: "RMB", fobTotal: 7200 }),
      [out(1000, 5.4, "USD")],
      names,
      { today: today(5.4) },
    );
    expect(rmb.cost).toBeCloseTo(5400, 6);
    expect(rmb.unpaid).toBeCloseTo(0, 6);
    // Sem câmbio do dia não dá para saber quanto do FOB foi pago: pendente.
    const none = f.computeOrderFinance(
      order(),
      [out(3600, 0.75, "CNY")],
      names,
    );
    expect(none.cost).toBeNull();
    // Pagamento em reais: custo real, sem câmbio informado.
    const brl = f.computeOrderFinance(
      order(),
      [out(5400, null, "BRL")],
      names,
      {
        today: today(5.4),
      },
    );
    expect(brl.cost).toBeCloseTo(5400, 6);
    expect(brl.unpaid).toBeCloseTo(0, 6);
  });

  it("cancelado na mesma moeda: custo é só o que foi pago", () => {
    const same = order({
      status: "CANCELLED",
      fobCurrency: "BRL",
      fobTotal: 7000,
    });
    expect(f.computeOrderFinance(same, [], names).cost).toBeNull();
    expect(
      f.computeOrderFinance(same, [out(2000, null, "BRL")], names).cost,
    ).toBe(2000);
  });

  it("cancelado só conta o que foi pago", () => {
    const nothing = f.computeOrderFinance(
      order({ status: "CANCELLED" }),
      [],
      names,
      { today: today(5.4), saleFx: 5 },
    );
    expect(nothing.cost).toBeNull();
    expect(nothing.fxBasis).toBeNull();
    expect(nothing.fxEffect).toBeNull();
    const some = f.computeOrderFinance(
      order({ status: "CANCELLED" }),
      [out(300, 5)],
      names,
      { today: today(5.4), saleFx: 5 },
    );
    expect(some.cost).toBeCloseTo(1500, 6);
    expect(some.fxBasis).toBe("paid");
    expect(some.estimated).toBe(false);
    expect(some.fxEffect).toBeNull();
  });

  it("pago sem câmbio aparece como tal, pedindo o câmbio", () => {
    const x = f.computeOrderFinance(
      order(),
      [out(300, 5), out(700, null)],
      names,
      { today: today(5.4) },
    );
    expect(x.fxBasis).toBe("partial");
    expect(x.paidNoFx).toBe(700);
    expect(x.unpaid).toBe(0);
    const lines = text.fxRateLines(pt, x)!;
    // (Intl separa moeda e valor com espaço não separável.)
    expect(lines.notes.map((n) => n.replace(/\s/g, " "))).toEqual([
      "real (pagamentos)",
      "pago sem câmbio: US$ 700,00 a ~5,4000 — informe o câmbio no pagamento",
    ]);
    expect(lines.notes.join(" ")).not.toContain("saldo");
  });

  it("efeito estimado leva ~; zero não aparece; -0 vira 0", () => {
    const est = f.computeOrderFinance(order(), [], names, {
      today: today(5.4),
      saleFx: 5.2,
    });
    expect(text.fxEffectText(pt, est)!.text).toMatch(
      /^câmbio desde a venda: ~ -R\$\s?200,00$/,
    );
    // Câmbio médio do custo no título, não o do dia.
    const partial = f.computeOrderFinance(order(), [out(500, 5)], names, {
      today: today(5.4),
      saleFx: 5.2,
    });
    expect(partial.fxEffect).toBe(0);
    expect(text.fxEffectText(pt, partial)).toBeNull();
    const half = f.computeOrderFinance(order(), [out(500, 5)], names, {
      today: today(5.6),
      saleFx: 5.2,
    });
    expect(text.fxEffectText(pt, half)!.title).toContain("~5,3000");
    // Resto de ponto flutuante não vira "-R$ 0,00".
    const fp = f.computeOrderFinance(
      order({ fobTotal: 12345.67 }),
      [out(3703.7, 5.3871)],
      names,
      { today: today(5.3871), saleFx: 5.3871 },
    );
    expect(Object.is(fp.fxEffect, -0)).toBe(false);
    expect(text.fxEffectText(pt, fp)).toBeNull();
  });

  it("negativo estimado: '~ -R$' (legível)", () => {
    expect(text.approx("-R$ 5,00", true)).toBe("~ -R$ 5,00");
    expect(text.approx("R$ 5,00", true)).toBe("~R$ 5,00");
    expect(text.approx("R$ 5,00", false)).toBe("R$ 5,00");
  });

  it("último câmbio sem parênteses dentro de parênteses; zh com os de lá", () => {
    const x = f.computeOrderFinance(order(), [out(500, 5)], names, {
      today: today(5.4, "stale"),
    });
    expect(text.fxRateLines(pt, x)!.notes).toContain(
      "saldo a ~5,4000 (último câmbio, 17/10)",
    );
    const zh = text.fxRateLines(translator("zh"), x)!.notes.join(" ");
    expect(zh).toContain("（");
    expect(zh).not.toMatch(/ \(/);
    expect(
      text.fxRateLines(
        pt,
        f.computeOrderFinance(order(), [out(500, 5)], names),
      )!.notes,
    ).toContain("saldo a ~5,0000 (média do câmbio pago)");
  });

  it("venda em outra moeda: custo em reais levado à moeda da venda, estimado", () => {
    const x = f.computeOrderFinance(
      order({
        sellCurrency: "USD",
        sellPrice: 1500,
        fobCurrency: "RMB",
        fobTotal: 7200,
      }),
      [out(3600, 0.75, "RMB")],
      names,
      { today: today(5.4) },
    );
    // 3600 × 0,75 (real) + 3600 × 0,75 (dia) = R$ 5.400 → US$ 1.000
    expect(x.cost).toBeCloseTo(1000, 6);
    expect(x.estimated).toBe(true);
    expect(x.sellRate).toBe(5.4);
    expect(text.fxRateLines(pt, x)!.notes).toContain("reais → USD a ~5,4000");
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

    expect(all.summary.fxEffectEstimated).toBe(true);
    // Para o cliente a tela do pedido não busca câmbio nem lê a auditoria.
    const forCustomer = await f.loadOrderFinance(placed, { estimate: false });
    expect(forCustomer.fxBasis).toBeNull();
    expect(forCustomer.saleFx).toBeNull();
    expect(forCustomer.receivable).toBe(finance.receivable);

    // A Control Tower não busca câmbio (só totais): sem estimativa.
    const tower = await f.loadFinance({ estimate: false });
    expect(
      tower.rows.find((x) => x.order.id === placed.id)!.fxBasis,
    ).toBeNull();
  });
});
