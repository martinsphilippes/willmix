import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUSINESS_TYPES,
  DEFAULT_EXPENSES,
  DEFAULT_SUPERPLAN,
  businessTypeOf,
  computeSuperplan,
  superplanParams,
  type SuperplanInput,
} from "@/lib/superplan";

/*
 * Superplan (docs/SUPERPLAN.md): o exemplo da planilha SuperPlan (jarra a
 * 24,90 RMB, 12 peças por caixa, 0,069 m³, container de 67,5 m³) com as
 * correções decididas pelo dono: impostos sobre o valor real, cada despesa
 * uma vez só, só caixas inteiras e o tipo de negócio preenchendo markup,
 * comissão, despesas e meta. Os números esperados foram conferidos à mão.
 */

const UD = businessTypeOf(DEFAULT_SUPERPLAN, "WELLMIX - UD - CHINA - MERCADO");

function example(patch: Partial<SuperplanInput> = {}): SuperplanInput {
  return {
    unitPrice: 24.9,
    currency: "RMB",
    pcsPerCarton: 12,
    netWeightPcKg: null,
    grossWeightPcKg: 1.13,
    cbmPerCarton: 0.069,
    containerCbm: 67.5,
    containerMaxKg: 28000,
    iiPct: 20,
    ipiPct: 5,
    freightUsd: 3492,
    roadFreightBrl: 1500,
    deliveryFreightBrl: 0,
    officialRate: 5.15,
    futureRate: 5.4,
    rmbPerUsd: 6.75,
    tradingCommissionPct: 0,
    chinaChargesRmb: 0,
    expenses: DEFAULT_EXPENSES,
    markup: UD.markup,
    commissionPct: UD.commissionPct,
    adminExpensesPct: UD.adminExpensesPct,
    targetProfitPct: UD.targetProfitPct,
    wdPct: UD.wdPct,
    insurancePct: 0,
    pisImportPct: 2.1,
    cofinsImportPct: 9.65,
    icmsImportPct: 0,
    freightFxPct: DEFAULT_SUPERPLAN.freightFxPct,
    afrmmPct: DEFAULT_SUPERPLAN.afrmmPct,
    afrmmFixedBrl: DEFAULT_SUPERPLAN.afrmmFixedBrl,
    grossEstimatePct: DEFAULT_SUPERPLAN.grossEstimatePct,
    priceFactors: DEFAULT_SUPERPLAN.priceFactors,
    saleTaxes: DEFAULT_SUPERPLAN.saleTaxes,
    salePrice: null,
    ...patch,
  };
}

const cents = (n: number | null | undefined) =>
  Math.round((n ?? NaN) * 100) / 100;

describe("Superplan: o exemplo da planilha, com as correções", () => {
  it("container, custo por peça, preço mínimo e lucro do tipo UD-China-Mercado", () => {
    const r = computeSuperplan(example());
    expect(r.missing).toEqual([]);
    // 67,5 ÷ 0,069 = 978,26 caixas pelo volume (o peso deixaria 2.064):
    // 978 caixas inteiras, 11.736 peças.
    expect(r.container).toMatchObject({
      cartons: 978,
      pieces: 11736,
      limitedBy: "volume",
      weightUnknown: false,
    });
    expect(Math.round(r.cost!.totalBrl)).toBe(359940);
    expect(cents(r.cost!.perPiece)).toBe(30.67);
    // Preço mínimo = custo × 1,8; lucro de 16%, abaixo da meta de 22%.
    expect(cents(r.prices!.minimum)).toBe(55.21);
    expect(r.sale!.profitPct.toFixed(1)).toBe("16.0");
    expect(r.verdict).toBe("below");
    // Para lucrar 22%: R$ 62,88 (markup 2,05).
    expect(cents(r.target!.price)).toBe(62.88);
    expect(r.target!.markup!.toFixed(2)).toBe("2.05");
    // Preços sugeridos saem do mínimo.
    expect(cents(r.prices!.table)).toBe(cents(r.prices!.minimum * 1.25));
    expect(cents(r.prices!.wd)).toBe(cents(r.prices!.minimum * 1.12));
  });

  it("com os números digitados na planilha (markup 1,25, comissão 2%, despesas 5%) o lucro é de 4,4%", () => {
    const r = computeSuperplan(
      example({ markup: 1.25, commissionPct: 2, adminExpensesPct: 5 }),
    );
    expect(cents(r.prices!.minimum)).toBe(38.34);
    expect(r.sale!.profitPct.toFixed(1)).toBe("4.4");
    expect(Math.round(r.sale!.profitPerContainer)).toBe(19786);
    expect(cents(r.target!.price)).toBe(51.04);
  });

  it("impostos da importação sobre o valor real da compra (valor aduaneiro)", () => {
    const r = computeSuperplan(example());
    const c = r.cost!;
    // FOB = 24,90 ÷ 6,75 × 11.736 peças, em dólar.
    expect(c.fobUsd).toBeCloseTo((24.9 / 6.75) * 11736, 6);
    // Valor aduaneiro = (FOB + frete) × dólar oficial + THC + taxa do CE.
    expect(c.customsValueBrl).toBeCloseTo(
      (c.fobUsd + 3492) * 5.15 + 1010 + 1000,
      6,
    );
    expect(c.iiBrl).toBeCloseTo(c.customsValueBrl * 0.2, 6);
    expect(c.ipiBrl).toBeCloseTo((c.customsValueBrl + c.iiBrl) * 0.05, 6);
    expect(c.pisBrl).toBeCloseTo(c.customsValueBrl * 0.021, 6);
    expect(c.cofinsBrl).toBeCloseTo(c.customsValueBrl * 0.0965, 6);
    // A compra é paga ao fornecedor no dólar futuro.
    expect(c.goodsBrl).toBeCloseTo(c.fobUsd * 5.4, 6);
    // Preço dobrado: os impostos crescem junto (nada de valor por kg).
    const doubled = computeSuperplan(example({ unitPrice: 49.8 })).cost!;
    expect(doubled.iiBrl).toBeGreaterThan(c.iiBrl * 1.8);
  });

  it("cada despesa entra uma vez só no custo (AFRMM, THC, CE e frete rodoviário)", () => {
    const c = computeSuperplan(example()).cost!;
    expect(c.expensesBrl).toBe(12236);
    expect(c.roadFreightBrl).toBe(1500);
    // AFRMM = frete em R$ × 8% + R$ 700, uma vez.
    expect(c.afrmmBrl).toBeCloseTo(c.freightBrl * 0.08 + 700, 6);
    expect(c.freightBrl).toBeCloseTo(3492 * 5.15 * 1.0302, 6);
    const parts =
      c.goodsBrl +
      c.freightBrl +
      c.insuranceBrl +
      c.iiBrl +
      c.ipiBrl +
      c.pisBrl +
      c.cofinsBrl +
      c.afrmmBrl +
      c.icmsBrl +
      c.expensesBrl +
      c.roadFreightBrl +
      c.chinaBrl;
    expect(c.totalBrl).toBeCloseTo(parts, 6);
    // O valor aduaneiro é só a base dos impostos: não entra na soma.
    expect(c.totalBrl).toBeLessThan(parts + c.customsValueBrl);
  });

  it("impostos da venda sobre o preço cheio, com crédito do que foi pago na importação", () => {
    const r = computeSuperplan(example({ salePrice: 60 }));
    const s = r.sale!;
    const pieces = r.container!.pieces;
    const base = 60 * 0.95;
    expect(s.ipi).toBeCloseTo(base * 0.05 - r.cost!.ipiBrl / pieces, 6);
    expect(s.icms).toBeCloseTo(base * 0.015, 6);
    const net = base - base * 0.015 - s.ipi;
    expect(s.pis).toBeCloseTo(net * 0.0165 - r.cost!.pisBrl / pieces, 6);
    expect(s.cofins).toBeCloseTo(net * 0.076 - r.cost!.cofinsBrl / pieces, 6);
    expect(s.ir).toBeCloseTo(base * 0.026, 6);
    expect(s.csll).toBeCloseTo(base * 0.0108, 6);
    expect(s.commission).toBeCloseTo(60 * 0.05, 6);
    expect(s.adminExpenses).toBeCloseTo(60 * 0.12, 6);
    expect(s.profit).toBeCloseTo(60 - r.cost!.perPiece - s.deductions, 6);
  });

  it("ICMS da importação por dentro, quando configurado, e crédito dele na venda", () => {
    const without = computeSuperplan(example());
    const r = computeSuperplan(example({ icmsImportPct: 4 }));
    const c = r.cost!;
    expect(c.icmsBrl).toBeCloseTo(
      ((c.customsValueBrl +
        c.iiBrl +
        c.ipiBrl +
        c.pisBrl +
        c.cofinsBrl +
        c.afrmmBrl) /
        0.96) *
        0.04,
      6,
    );
    expect(c.perPiece).toBeGreaterThan(without.cost!.perPiece);
    expect(r.sale!.icms).toBeCloseTo(
      r.sale!.price * 0.95 * 0.015 - c.icmsBrl / r.container!.pieces,
      6,
    );
  });
});

describe("Superplan: sinal verde, amarelo e vermelho", () => {
  it("verde quando o lucro bate a meta; amarelo abaixo; vermelho com prejuízo", () => {
    expect(computeSuperplan(example({ salePrice: 70 })).verdict).toBe("viable");
    expect(computeSuperplan(example()).verdict).toBe("below");
    const loss = computeSuperplan(example({ salePrice: 31 }));
    expect(loss.verdict).toBe("loss");
    expect(loss.sale!.profit).toBeLessThan(0);
    // Exatamente no preço da meta: verde.
    const target = computeSuperplan(example()).target!.price!;
    expect(computeSuperplan(example({ salePrice: target })).verdict).toBe(
      "viable",
    );
  });

  it("meta impossível (impostos e despesas acima da margem): sem preço", () => {
    const r = computeSuperplan(example({ targetProfitPct: 80 }));
    expect(r.target).toEqual({ pct: 80, price: null, markup: null });
  });
});

describe("Superplan: container", () => {
  it("só caixas inteiras; produto pesado é limitado pelo peso", () => {
    const r = computeSuperplan(example({ grossWeightPcKg: 5 }));
    // 28.000 kg ÷ 60 kg por caixa = 466,7 → 466 caixas.
    expect(r.container).toMatchObject({
      cartons: 466,
      pieces: 5592,
      limitedBy: "weight",
    });
    expect(r.container!.usedKg).toBe(466 * 60);
  });

  it("sem peso por peça: conta só o volume (e avisa)", () => {
    const r = computeSuperplan(example({ grossWeightPcKg: null }));
    expect(r.container).toMatchObject({
      cartons: 978,
      limitedBy: "volume",
      weightUnknown: true,
      usedKg: null,
    });
  });
});

describe("Superplan: o que falta preencher", () => {
  it("diz o que falta, sem calcular pela metade", () => {
    const r = computeSuperplan(
      example({
        unitPrice: null,
        pcsPerCarton: 0,
        officialRate: null,
        freightUsd: null,
      }),
    );
    expect(r.missing).toEqual(["price", "carton", "freight", "fx"]);
    expect(r.cost).toBeNull();
    expect(r.verdict).toBeNull();
  });

  it("RMB por dólar só é pedido com preço em RMB ou despesas na China", () => {
    expect(
      computeSuperplan(
        example({ currency: "USD", unitPrice: 3.69, rmbPerUsd: null }),
      ).missing,
    ).toEqual([]);
    expect(computeSuperplan(example({ rmbPerUsd: null })).missing).toEqual([
      "rmb",
    ]);
    expect(
      computeSuperplan(
        example({
          currency: "USD",
          unitPrice: 3.69,
          rmbPerUsd: null,
          chinaChargesRmb: 500,
        }),
      ).missing,
    ).toEqual(["rmb"]);
  });

  it("frete zero vale (produto já posto); caixa maior que o container não", () => {
    expect(computeSuperplan(example({ freightUsd: 0 })).missing).toEqual([]);
    const r = computeSuperplan(example({ cbmPerCarton: 70 }));
    expect(r.missing).toEqual(["cbm"]);
    expect(r.container?.cartons).toBe(0);
  });

  it("despesas na China entram no custo, no dólar futuro", () => {
    const base = computeSuperplan(example()).cost!;
    const c = computeSuperplan(
      example({ tradingCommissionPct: 3, chinaChargesRmb: 675 }),
    ).cost!;
    expect(c.chinaBrl).toBeCloseTo((base.fobUsd * 0.03 + 675 / 6.75) * 5.4, 6);
    expect(c.totalBrl).toBeCloseTo(base.totalBrl + c.chinaBrl, 6);
  });
});

describe("Superplan: parâmetros", () => {
  it("padrão: os 30 tipos de negócio da planilha", () => {
    expect(DEFAULT_BUSINESS_TYPES).toHaveLength(30);
    expect(new Set(DEFAULT_BUSINESS_TYPES.map((t) => t.name)).size).toBe(30);
    expect(UD).toMatchObject({
      markup: 1.8,
      commissionPct: 5,
      adminExpensesPct: 12,
      targetProfitPct: 22,
      wdPct: 12,
    });
    expect(
      businessTypeOf(
        DEFAULT_SUPERPLAN,
        "WELLKIDS - BRINQUEDOS - CHINA - MERCADO",
      ),
    ).toMatchObject({ markup: 1.9, targetProfitPct: 25 });
    // Tipo que não existe: o padrão da tela.
    expect(businessTypeOf(DEFAULT_SUPERPLAN, "não existe").name).toBe(
      DEFAULT_SUPERPLAN.defaultBusinessType,
    );
  });

  it("valor gravado estragado ou incompleto: completa com o padrão da planilha", () => {
    expect(superplanParams(null)).toEqual(DEFAULT_SUPERPLAN);
    expect(superplanParams("lixo")).toEqual(DEFAULT_SUPERPLAN);
    const p = superplanParams({
      businessTypes: [
        { name: " Meu tipo ", markup: 2, commissionPct: 3 },
        { name: "", markup: 9 },
        "lixo",
      ],
      defaultBusinessType: "sumiu",
      expenses: [{ label: "Taxa nova", amountBrl: 120, customs: true }],
      freightUsd: -5,
      saleTaxes: { icmsPct: 4 },
    });
    expect(p.businessTypes).toEqual([
      {
        name: "Meu tipo",
        markup: 2,
        commissionPct: 3,
        adminExpensesPct: 0,
        targetProfitPct: 0,
        wdPct: 0,
      },
    ]);
    expect(p.defaultBusinessType).toBe("Meu tipo");
    expect(p.expenses).toEqual([
      { key: "item1", label: "Taxa nova", amountBrl: 120, customs: true },
    ]);
    expect(p.freightUsd).toBe(DEFAULT_SUPERPLAN.freightUsd);
    expect(p.saleTaxes).toEqual({ ...DEFAULT_SUPERPLAN.saleTaxes, icmsPct: 4 });
    // Sem nenhum tipo válido: a tabela da planilha volta.
    expect(superplanParams({ businessTypes: [] }).businessTypes).toHaveLength(
      30,
    );
  });
});

describe("conta inversa (contraproposta com o Superplan)", () => {
  it("acha o preço por peça que leva ao mínimo desejado", async () => {
    const { priceForMinimum } = await import("@/lib/superplan-inverse");
    const base = example();
    const minimumAt = (p: number) =>
      computeSuperplan({ ...base, unitPrice: p }).prices!.minimum;
    const target = minimumAt(3);
    const price = priceForMinimum(base, base.currency, target)!;
    expect(price).toBeCloseTo(3, 3);
    // Arredondado para baixo: não passa do mínimo desejado.
    expect(minimumAt(price)).toBeLessThanOrEqual(target);
    // Abaixo do que só o frete e as despesas já custam: inalcançável.
    expect(priceForMinimum(base, base.currency, 0.01)).toBeNull();
  });
});
