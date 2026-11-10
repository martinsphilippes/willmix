import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPENSES,
  DEFAULT_SUPERPLAN,
  businessTypeOf,
  computeSuperplan,
  superplanParams,
  type SuperplanInput,
} from "@/lib/superplan";
import {
  EMPTY_SUPERPLAN_PREFILL,
  defaultSuperplanForm,
  defaultSuperplanInput,
  superplanInputSchema,
  type SuperplanContext,
  type SuperplanPrefill,
} from "@/lib/superplan-defaults";
import { estimatedGrossKg } from "@/lib/weights";

/*
 * Superplan e os três "pesos" (docs/SUPERPLAN.md):
 * - peso bruto informado: é o que limita o container, como sempre;
 * - só o peso líquido: a conta usa o bruto ESTIMADO (líquido + folga da
 *   embalagem, 8% por padrão), diz que é estimado e não grava nada;
 * - nenhum dos dois: só o volume conta;
 * - a "média" do despachante é só informação: não existe na conta.
 */

const UD = businessTypeOf(DEFAULT_SUPERPLAN, "WELLMIX - UD - CHINA - MERCADO");

function example(patch: Partial<SuperplanInput> = {}): SuperplanInput {
  return {
    unitPrice: 24.9,
    currency: "RMB",
    pcsPerCarton: 12,
    netWeightPcKg: null,
    grossWeightPcKg: null,
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
    grossEstimatePct: 8,
    priceFactors: DEFAULT_SUPERPLAN.priceFactors,
    saleTaxes: DEFAULT_SUPERPLAN.saleTaxes,
    salePrice: null,
    ...patch,
  };
}

const ctx: SuperplanContext = {
  params: DEFAULT_SUPERPLAN,
  containers: [
    { code: "20GP", capacityCbm: 28, maxWeightKg: 21700 },
    { code: "40HC", capacityCbm: 68, maxWeightKg: 26500 },
  ],
  defaultContainer: "40HC",
  official: 5.15,
  rmbPerUsd: 6.75,
  fxDate: "2026-11-10",
  fxStatus: "today",
  insurancePct: 0,
  pisImportPct: 2.1,
  cofinsImportPct: 9.65,
  icmsImportPct: null,
};

const frame: SuperplanPrefill = {
  ...EMPTY_SUPERPLAN_PREFILL,
  productId: "p1",
  productName: "Porta-retrato",
  unitPrice: 4,
  pcsPerCarton: 12,
  netWeightPcKg: 0.225,
  cbmPerCarton: 0.0183,
};

describe("Superplan: peso bruto informado", () => {
  it("o bruto da ficha é o usado, mesmo com o líquido preenchido", () => {
    const r = computeSuperplan(
      example({ netWeightPcKg: 1, grossWeightPcKg: 1.13 }),
    );
    expect(r.container).toMatchObject({
      cartons: 978,
      limitedBy: "volume",
      weightUnknown: false,
      weightEstimated: false,
    });
    // 978 caixas × 12 peças × 1,13 kg (o líquido não entra).
    expect(r.container!.usedKg).toBeCloseTo(978 * 12 * 1.13, 6);
    // Igual a não ter líquido nenhum: o líquido nunca muda a conta do bruto.
    expect(r).toEqual(
      computeSuperplan(example({ netWeightPcKg: null, grossWeightPcKg: 1.13 })),
    );
  });

  it("produto pesado: limitado pelo peso bruto informado", () => {
    const r = computeSuperplan(
      example({ netWeightPcKg: 4, grossWeightPcKg: 5 }),
    );
    // 28.000 kg ÷ (12 × 5 kg) = 466,7 → 466 caixas (o líquido daria 583).
    expect(r.container).toMatchObject({
      cartons: 466,
      limitedBy: "weight",
      weightEstimated: false,
    });
  });
});

describe("Superplan: só o peso líquido (bruto estimado)", () => {
  it("bruto vazio e líquido informado: líquido × 1,08, marcado como estimado", () => {
    expect(estimatedGrossKg(0.225, null, 8)).toEqual({
      kg: 0.243,
      estimated: true,
    });
    const r = computeSuperplan(example({ netWeightPcKg: 0.225 }));
    expect(r.container).toMatchObject({
      cartons: 978,
      limitedBy: "volume",
      weightUnknown: false,
      weightEstimated: true,
    });
    expect(r.container!.usedKg).toBeCloseTo(978 * 12 * 0.243, 6);
    // O peso só limita o container: com folga, custo e preço não mudam.
    const noWeight = computeSuperplan(example());
    expect(r.cost).toEqual(noWeight.cost);
    expect(r.prices).toEqual(noWeight.prices);
  });

  it("o container pode passar a ser limitado pelo peso estimado", () => {
    const r = computeSuperplan(example({ netWeightPcKg: 5 }));
    // 5 kg × 1,08 = 5,4 kg; 28.000 ÷ (12 × 5,4) = 432,1 → 432 caixas.
    expect(r.container).toMatchObject({
      cartons: 432,
      pieces: 5184,
      limitedBy: "weight",
      weightUnknown: false,
      weightEstimated: true,
    });
    expect(r.container!.usedKg).toBeCloseTo(432 * 12 * 5.4, 6);
    // Sem peso nenhum caberiam as 978 caixas do volume: a estimativa conta.
    expect(computeSuperplan(example()).container!.cartons).toBe(978);
    // Com o bruto de verdade (5,2 kg), vale o de verdade: 448 caixas.
    const real = computeSuperplan(
      example({ netWeightPcKg: 5, grossWeightPcKg: 5.2 }),
    );
    expect(real.container).toMatchObject({
      cartons: 448,
      limitedBy: "weight",
      weightEstimated: false,
    });
  });

  it("a folga vem do parâmetro; zero estima o próprio líquido (ainda estimado)", () => {
    const loose = computeSuperplan(
      example({ netWeightPcKg: 5, grossEstimatePct: 20 }),
    );
    // 5 × 1,20 = 6 kg; 28.000 ÷ 72 = 388,9 → 388 caixas.
    expect(loose.container).toMatchObject({
      cartons: 388,
      weightEstimated: true,
    });
    const none = computeSuperplan(
      example({ netWeightPcKg: 5, grossEstimatePct: 0 }),
    );
    expect(none.container).toMatchObject({
      cartons: 466,
      weightEstimated: true,
    });
  });

  it("bruto zero ou negativo vale como vazio (não é um peso)", () => {
    for (const gross of [0, -2]) {
      const r = computeSuperplan(
        example({ netWeightPcKg: 5, grossWeightPcKg: gross }),
      );
      expect(r.container).toMatchObject({
        cartons: 432,
        weightEstimated: true,
      });
    }
  });

  it("a estimativa nunca entra no campo do peso bruto", () => {
    const form = defaultSuperplanForm(frame, ctx, {}, ",");
    expect(form.fields.netWeightPcKg).toBe("0,225");
    expect(form.fields.grossWeightPcKg).toBe("");
    const { input } = defaultSuperplanInput(frame, ctx);
    expect(input.netWeightPcKg).toBe(0.225);
    expect(input.grossWeightPcKg).toBeNull();
    expect(input.grossEstimatePct).toBe(8);
    expect(computeSuperplan(input).container).toMatchObject({
      weightUnknown: false,
      weightEstimated: true,
    });
  });
});

describe("Superplan: sem peso nenhum", () => {
  it("bruto e líquido vazios: só o volume conta (e avisa)", () => {
    const r = computeSuperplan(example());
    expect(r.container).toMatchObject({
      cartons: 978,
      limitedBy: "volume",
      weightUnknown: true,
      weightEstimated: false,
      usedKg: null,
    });
  });
});

describe("Superplan: parâmetro da folga da embalagem no peso", () => {
  it("padrão de 8%; parâmetros gravados antes de a folga existir ganham o padrão", () => {
    expect(DEFAULT_SUPERPLAN.grossEstimatePct).toBe(8);
    expect(superplanParams(null).grossEstimatePct).toBe(8);
    const old: Record<string, unknown> = { ...DEFAULT_SUPERPLAN };
    delete old.grossEstimatePct;
    old.freightUsd = 4000;
    const p = superplanParams(old);
    expect(p.grossEstimatePct).toBe(8);
    // O resto do que estava gravado fica como estava.
    expect(p.freightUsd).toBe(4000);
    expect(p.businessTypes).toHaveLength(30);
  });

  it("de 0 a 100; fora da faixa ou sem ser número, o padrão", () => {
    const of = (value: unknown) =>
      superplanParams({ grossEstimatePct: value }).grossEstimatePct;
    expect(of(0)).toBe(0);
    expect(of(12.5)).toBe(12.5);
    expect(of(100)).toBe(100);
    expect(of(-1)).toBe(8);
    expect(of(100.01)).toBe(8);
    expect(of("10")).toBe(8);
    expect(of(NaN)).toBe(8);
    expect(of(Infinity)).toBe(8);
    expect(of(null)).toBe(8);
  });
});

describe("Superplan: a média do despachante é só informação", () => {
  it("a conta não tem campo de média", () => {
    const { input } = defaultSuperplanInput(frame, ctx);
    const keys = [
      ...Object.keys(input),
      ...Object.keys(superplanInputSchema.shape),
      ...Object.keys(EMPTY_SUPERPLAN_PREFILL),
    ];
    expect(keys.filter((k) => /m[eé]dia|average|declared/i.test(k))).toEqual(
      [],
    );
    // Na conta, uma propriedade de média nem compila.
    const withAverage: SuperplanInput = {
      ...example(),
      // @ts-expect-error a média não faz parte da conta do Superplan
      averagePrice: 3.2,
    };
    expect(withAverage.unitPrice).toBe(24.9);
  });

  it("duas contas iguais, uma delas com uma média 'a mais', dão o mesmo resultado", () => {
    const base = example({ netWeightPcKg: 0.9, grossWeightPcKg: 1.13 });
    const extra = {
      ...base,
      averagePrice: 3.2,
      averageUsd: 3.2,
      media: 3.2,
      declaredValueUsd: 0.9 * 3.2,
    } as SuperplanInput;
    expect(computeSuperplan(extra)).toEqual(computeSuperplan(base));
    // Os impostos da importação continuam sobre o valor real da compra.
    const c = computeSuperplan(extra).cost!;
    expect(c.fobUsd).toBeCloseTo((24.9 / 6.75) * 11736, 6);
    expect(c.customsValueBrl).toBeCloseTo(
      (c.fobUsd + 3492) * 5.15 + 1010 + 1000,
      6,
    );
    expect(c.iiBrl).toBeCloseTo(c.customsValueBrl * 0.2, 6);
  });

  it("a simulação padrão é a mesma com ou sem média nos dados do produto", () => {
    const plain = defaultSuperplanInput(frame, ctx);
    for (const averageUsd of [null, 0.5, 3.2, 999]) {
      const withAverage = { ...frame, averageUsd } as SuperplanPrefill;
      expect(defaultSuperplanInput(withAverage, ctx)).toEqual(plain);
    }
  });

  it("uma conta vinda do navegador com média: a média é descartada", () => {
    const { input } = defaultSuperplanInput(frame, ctx);
    const parsed = superplanInputSchema.parse({ ...input, averageUsd: 3.2 });
    expect(parsed).toEqual(input);
    expect("averageUsd" in parsed).toBe(false);
  });
});
