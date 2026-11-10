import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Superplan no servidor (docs/SUPERPLAN.md): os dados de cada produto para a
 * simulação (ficha mestre + cadastro), a simulação padrão (a mesma que a tela
 * mostra ao abrir o produto) e a análise de vários produtos de uma vez, usada
 * pelo Booking. Também: o retrato da conta e a conferência de uma conta que
 * vem do navegador.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { getSettings, setSetting } = await import("@/lib/settings");
const { brazilDay } = await import("@/lib/services/fx");
const { saveProductSheet } = await import("@/lib/services/product-sheet");
const { DEFAULT_SUPERPLAN, DEFAULT_EXPENSES, computeSuperplan } =
  await import("@/lib/superplan");
const {
  defaultSuperplanForm,
  defaultSuperplanInput,
  snapshotOf,
  superplanInputOf,
  superplanInputSchema,
  SUPERPLAN_MAX_EXPENSES,
} = await import("@/lib/superplan-defaults");
const {
  analyzeProductsWithDefaults,
  loadSuperplanContext,
  superplanPrefillsFor,
} = await import("@/lib/services/superplan-analysis");
type User = import("@/lib/db").User;
type Product = import("@/lib/db").Product;
type SuperplanInput = import("@/lib/superplan").SuperplanInput;
type SheetInput = Parameters<typeof saveProductSheet>[2];

let admin: User;
let lineId: string;
let seq = 0;
const today = brazilDay();

/** Produto só com as colunas do cadastro (sem ficha mestre). */
async function bare(patch: Partial<Product> = {}): Promise<Product> {
  seq++;
  return getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name: `Porta-retrato ${seq}`,
    sku: `PR-${seq}`,
    specification: null,
    active: true,
    source: "import",
    ...patch,
  } as never);
}

/** Produto com ficha mestre (como a importação da ficha técnica deixa). */
async function withSheet(sheet: SheetInput, patch: Partial<Product> = {}) {
  const product = await bare(patch);
  await saveProductSheet(admin, product.id, sheet);
  return (await getStore().get("products", product.id))!;
}

/** Ficha mestre da jarra do exemplo da planilha. */
const JAR: SheetInput = {
  price: 24.9,
  currency: "RMB",
  masterCartonQty: 12,
  netWeightPcKg: 1,
  grossWeightPcKg: 1.13,
  cbmPerCarton: 0.069,
  ncm: "7013.37.00",
};

const cents = (n: number) => Number(n.toFixed(2));

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  lineId = (await getStore().list("product_lines", { limit: 1 }))[0].id;
  // Câmbio do dia já gravado (os testes não usam a internet): dólar a
  // R$ 5,00 e RMB a R$ 0,80, ou seja, 6,25 RMB por dólar.
  await setSetting("fxPtax", {
    day: today,
    fetchedAt: `${today}T12:00:00.000Z`,
    rates: { USD: 5, RMB: 0.8, EUR: 6 },
    quotedAt: { USD: `${today} 13:05:00.000` },
    source: "ptax",
  });
  // Tabela fiscal com dois NCMs: um com II e IPI, outro com IPI "NT".
  const file = await getStore().putFile(
    new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        rows: {
          "70133700": { ii: 18, ipi: 9.75, d: "Copos de vidro" },
          "39241000": { ii: 16, nt: true, d: "Serviços de mesa" },
        },
      }),
    ),
    "tabela-fiscal.json",
    "application/json",
  );
  const part = {
    updatedAt: new Date().toISOString(),
    count: 2,
    fileName: "teste.csv",
    source: "upload" as const,
  };
  await setSetting("fiscalTable", { fileKey: file.key, tec: part, tipi: part });
});

describe("o que a simulação recebe do sistema", () => {
  it("parâmetros, containers (padrão 40HC), câmbio do dia e tributos da importação", async () => {
    const ctx = await loadSuperplanContext();
    expect(ctx.params).toEqual(DEFAULT_SUPERPLAN);
    expect(ctx.containers.map((c) => c.code)).toEqual(["20GP", "40GP", "40HC"]);
    expect(ctx.defaultContainer).toBe("40HC");
    expect(ctx.official).toBe(5);
    expect(ctx.rmbPerUsd).toBeCloseTo(6.25, 9);
    expect(ctx.fxStatus).toBe("today");
    expect(ctx.fxDate).toBe(today);
    expect(ctx.insurancePct).toBe(0);
    expect(ctx.pisImportPct).toBe(2.1);
    expect(ctx.cofinsImportPct).toBe(9.65);
    // ICMS da importação não configurado: fica nulo (a tela avisa; conta 0%).
    expect(ctx.icmsImportPct).toBeNull();
    // A tela troca o dia pelo texto no idioma dela.
    const shown = await loadSuperplanContext({
      formatDay: (day) => `dia ${day}`,
    });
    expect(shown.fxDate).toBe(`dia ${today}`);
  });

  it("sem 40HC cadastrado, o padrão é o maior container", async () => {
    const before = (await getSettings()).containerTypes;
    await setSetting("containerTypes", [
      { code: "20GP", capacityCbm: 28, maxWeightKg: 21700 },
      { code: "40GP", capacityCbm: 58, maxWeightKg: 26500 },
      { code: "", capacityCbm: 90, maxWeightKg: 1 },
      { code: "ZERO", capacityCbm: 0, maxWeightKg: 1 },
    ]);
    const ctx = await loadSuperplanContext();
    expect(ctx.containers.map((c) => c.code)).toEqual(["20GP", "40GP"]);
    expect(ctx.defaultContainer).toBe("40GP");
    await setSetting("containerTypes", before);
  });
});

describe("dados do produto para a simulação", () => {
  it("ficha mestre: preço, caixa, os pesos, volume, NCM e a média (só informação)", async () => {
    const p = await withSheet({
      ...JAR,
      averagePrice: 3.2,
      averageWeightPcKg: 1.05,
    });
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    expect(prefill).toEqual({
      productId: p.id,
      productName: `${p.sku} · ${p.name}`,
      unitPrice: 24.9,
      currency: "RMB",
      otherCurrency: null,
      pcsPerCarton: 12,
      netWeightPcKg: 1,
      grossWeightPcKg: 1.13,
      cbmPerCarton: 0.069,
      ncm: "7013.37.00",
      // Da tabela fiscal, pelo NCM.
      iiPct: 18,
      ipiPct: 9.75,
      ncmFound: true,
      averageUsd: 3.2,
      // Peso médio: mostrado na tela, fora da conta.
      averageWeightKg: 1.05,
    });
  });

  it("II e IPI: o que está na ficha mestre vale antes da tabela fiscal; IPI 'NT' é 0%", async () => {
    const typed = await withSheet({
      ...JAR,
      importTaxPercent: 20,
      ipiPercent: 0,
    });
    const nt = await withSheet({ ...JAR, ncm: "3924.10.00" });
    const half = await withSheet({ ...JAR, ipiPercent: 5 });
    const map = await superplanPrefillsFor([typed.id, nt.id, half.id]);
    expect(map.get(typed.id)).toMatchObject({ iiPct: 20, ipiPct: 0 });
    expect(map.get(nt.id)).toMatchObject({
      iiPct: 16,
      ipiPct: 0,
      ncmFound: true,
    });
    // Só o IPI digitado: o II vem da tabela.
    expect(map.get(half.id)).toMatchObject({ iiPct: 18, ipiPct: 5 });
  });

  it("só o cadastro (sem ficha mestre): como sempre foi, com a moeda CNY lida como RMB", async () => {
    const cny = await bare({
      price: 10,
      currency: "CNY",
      masterBoxQty: 24,
      grossWeightKg: 0.5,
      boxLengthCm: 50,
      boxWidthCm: 40,
      boxHeightCm: 30,
      ncm: "7013.37.00",
    });
    const usd = await bare({ price: 2.5, currency: "usd", cbm: 0.05 });
    const eur = await bare({ price: 3, currency: "EUR" });
    const map = await superplanPrefillsFor([cny.id, usd.id, eur.id]);
    expect(map.get(cny.id)).toMatchObject({
      unitPrice: 10,
      currency: "RMB",
      otherCurrency: null,
      pcsPerCarton: 24,
      netWeightPcKg: null,
      grossWeightPcKg: 0.5,
      // Das medidas da caixa: 50 × 40 × 30 cm.
      cbmPerCarton: 0.06,
      averageUsd: null,
    });
    expect(map.get(usd.id)).toMatchObject({
      unitPrice: 2.5,
      currency: "USD",
      cbmPerCarton: 0.05,
    });
    // Preço em moeda que o Superplan não usa: fica vazio, com o aviso.
    expect(map.get(eur.id)).toMatchObject({
      unitPrice: null,
      otherCurrency: "EUR",
    });
  });

  it("coluna do cadastro vazia: preço, moeda, caixa, volume, pesos e NCM vêm da ficha mestre", async () => {
    const p = await withSheet({
      ...JAR,
      currency: "USD",
      price: 3.69,
      grossWeightPcKg: null,
    });
    // Cadastro antigo sem as colunas (a ficha mestre continua com os dados).
    await getStore().update("products", p.id, {
      price: null,
      currency: null,
      masterBoxQty: null,
      netWeightKg: null,
      grossWeightKg: null,
      cbm: null,
      ncm: null,
    });
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    expect(prefill).toMatchObject({
      unitPrice: 3.69,
      currency: "USD",
      otherCurrency: null,
      pcsPerCarton: 12,
      netWeightPcKg: 1,
      // O bruto não veio: fica vazio (o líquido não entra no lugar).
      grossWeightPcKg: null,
      cbmPerCarton: 0.069,
      ncm: "7013.37.00",
      iiPct: 18,
      ipiPct: 9.75,
      ncmFound: true,
    });
  });

  it("produto desativado ou que não existe fica fora (a tela ainda abre o desativado)", async () => {
    const on = await withSheet(JAR);
    const off = await withSheet(JAR, { active: false });
    const map = await superplanPrefillsFor([
      on.id,
      off.id,
      "nao-existe",
      on.id,
      "",
    ]);
    expect([...map.keys()]).toEqual([on.id]);
    expect((await superplanPrefillsFor([])).size).toBe(0);
    const forScreen = await superplanPrefillsFor([off.id, "nao-existe"], {
      includeInactive: true,
    });
    expect([...forScreen.keys()]).toEqual([off.id]);
    expect(
      (await analyzeProductsWithDefaults([off.id, "nao-existe"])).size,
    ).toBe(0);
  });
});

describe("simulação padrão", () => {
  it("é a conta que a tela mostra ao abrir o produto, sem editar nada", async () => {
    const p = await withSheet(JAR);
    const ctx = await loadSuperplanContext();
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    const result = defaultSuperplanInput(prefill, ctx);
    const type = DEFAULT_SUPERPLAN.businessTypes.find(
      (t) => t.name === DEFAULT_SUPERPLAN.defaultBusinessType,
    )!;
    expect(result.businessType).toBe(type.name);
    expect(result.container).toBe("40HC");
    // O que a página passa à conta: produto, container e frete padrão, câmbio
    // do dia (futuro = oficial + R$ 0,25), despesas e fatores dos parâmetros.
    const expected: SuperplanInput = {
      unitPrice: 24.9,
      currency: "RMB",
      pcsPerCarton: 12,
      netWeightPcKg: 1,
      grossWeightPcKg: 1.13,
      cbmPerCarton: 0.069,
      containerCbm: 68,
      containerMaxKg: 26500,
      iiPct: 18,
      ipiPct: 9.75,
      freightUsd: 3492,
      roadFreightBrl: 1500,
      deliveryFreightBrl: 0,
      officialRate: 5,
      futureRate: 5.25,
      rmbPerUsd: 6.25,
      tradingCommissionPct: 0,
      chinaChargesRmb: 0,
      expenses: DEFAULT_EXPENSES,
      markup: type.markup,
      commissionPct: type.commissionPct,
      adminExpensesPct: type.adminExpensesPct,
      targetProfitPct: type.targetProfitPct,
      wdPct: type.wdPct,
      insurancePct: 0,
      pisImportPct: 2.1,
      cofinsImportPct: 9.65,
      icmsImportPct: 0,
      freightFxPct: 3.02,
      afrmmPct: 8,
      afrmmFixedBrl: 700,
      grossEstimatePct: 8,
      priceFactors: DEFAULT_SUPERPLAN.priceFactors,
      saleTaxes: DEFAULT_SUPERPLAN.saleTaxes,
      salePrice: null,
    };
    expect(result.input).toEqual(expected);
    // A tela monta os campos (texto, com a vírgula do idioma) e lê de volta:
    // em português, inglês ou chinês, a conta é a mesma.
    for (const decimal of [",", "."]) {
      const form = defaultSuperplanForm(prefill, ctx, {}, decimal);
      expect(superplanInputOf(form, ctx)).toEqual(result.input);
    }
    const pt = defaultSuperplanForm(prefill, ctx, {}, ",").fields;
    expect(pt.unitPrice).toBe("24,9");
    expect(pt.futureRate).toBe("5,25");
    expect(pt.containerMaxKg).toBe("26500");
    expect(pt.salePrice).toBe("");
  });

  it("números com muitas casas: a conta usa o que a tela mostra (arredondado)", async () => {
    const ctx = {
      ...(await loadSuperplanContext()),
      official: 5.123456,
      rmbPerUsd: 7.1234567,
    };
    const prefill = {
      ...(await superplanPrefillsFor([(await withSheet(JAR)).id]))
        .values()
        .next().value!,
      unitPrice: 1.234567,
      cbmPerCarton: 0.012345678,
      netWeightPcKg: 0.33333333,
    };
    const { input } = defaultSuperplanInput(prefill, ctx);
    expect(input).toMatchObject({
      unitPrice: 1.2346,
      cbmPerCarton: 0.0123,
      netWeightPcKg: 0.3333,
      officialRate: 5.1235,
      // Oficial (sem arredondar) + R$ 0,25, com 4 casas.
      futureRate: 5.3735,
      rmbPerUsd: 7.1235,
    });
    for (const decimal of [",", "."])
      expect(
        superplanInputOf(defaultSuperplanForm(prefill, ctx, {}, decimal), ctx),
      ).toEqual(input);
  });

  it("tipo de negócio e preço de venda podem ser trocados; tipo desconhecido cai no padrão", async () => {
    const p = await withSheet(JAR);
    const ctx = await loadSuperplanContext();
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    const kids = defaultSuperplanInput(prefill, ctx, {
      businessType: "WELLKIDS - BRINQUEDOS - CHINA - MERCADO",
      salePrice: 59.9,
    });
    expect(kids.businessType).toBe("WELLKIDS - BRINQUEDOS - CHINA - MERCADO");
    expect(kids.input).toMatchObject({
      markup: 1.9,
      targetProfitPct: 25,
      salePrice: 59.9,
    });
    const unknown = defaultSuperplanInput(prefill, ctx, {
      businessType: "não existe",
      salePrice: null,
    });
    expect(unknown).toEqual(defaultSuperplanInput(prefill, ctx));
  });
});

describe("análise de vários produtos com os valores padrão", () => {
  it("produto completo: retrato com custo, preço mínimo, lucro e sinal", async () => {
    const p = await withSheet({ ...JAR, averagePrice: 3.2 });
    const snapshot = (await analyzeProductsWithDefaults([p.id])).get(p.id)!;
    // A mesma conta, feita à mão com as funções da tela.
    const ctx = await loadSuperplanContext();
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    const { input } = defaultSuperplanInput(prefill, ctx);
    const r = computeSuperplan(input);
    expect(r.missing).toEqual([]);
    expect(snapshot).toEqual({
      businessType: DEFAULT_SUPERPLAN.defaultBusinessType,
      salePriceBrl: cents(r.prices!.minimum),
      usesMinimum: true,
      costBrl: cents(r.cost!.perPiece),
      minimumBrl: cents(r.prices!.minimum),
      profitPct: cents(r.sale!.profitPct),
      targetPct: 22,
      verdict: r.verdict,
      targetPriceBrl: Math.ceil(r.target!.price! * 100 - 1e-6) / 100,
      missing: [],
      inputs: {
        unitPrice: 24.9,
        currency: "RMB",
        pcsPerCarton: 12,
        cbmPerCarton: 0.069,
        officialRate: 5,
        futureRate: 5.25,
        rmbPerUsd: 6.25,
        iiPct: 18,
        ipiPct: 9.75,
        ncmFound: true,
        container: "40HC",
        freightUsd: 3492,
        grossEstimated: false,
      },
    });
    expect(snapshot.costBrl).toBeGreaterThan(0);
    expect(snapshot.minimumBrl).toBeGreaterThan(snapshot.costBrl!);
    expect(["viable", "below", "loss"]).toContain(snapshot.verdict);

    // A média do despachante é só informação: trocá-la não muda o retrato.
    await saveProductSheet(admin, p.id, { averagePrice: 99 });
    expect((await superplanPrefillsFor([p.id])).get(p.id)!.averageUsd).toBe(99);
    expect((await analyzeProductsWithDefaults([p.id])).get(p.id)).toEqual(
      snapshot,
    );
  });

  it("só o peso líquido na ficha: a conta usa o bruto estimado, diz isso e não grava nada", async () => {
    const p = await withSheet({
      price: 4,
      currency: "RMB",
      masterCartonQty: 12,
      netWeightPcKg: 0.225,
      cbmPerCarton: 0.0183,
    });
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    expect(prefill.netWeightPcKg).toBe(0.225);
    expect(prefill.grossWeightPcKg).toBeNull();
    const snapshot = (await analyzeProductsWithDefaults([p.id])).get(p.id)!;
    expect(snapshot.inputs?.grossEstimated).toBe(true);
    expect(snapshot.verdict).not.toBeNull();
    // A estimativa não vira peso bruto do produto nem da ficha mestre.
    const after = (await getStore().get("products", p.id))!;
    expect(after.grossWeightKg ?? null).toBeNull();
    expect(after.netWeightKg).toBe(0.225);
    const [sheet] = await getStore().list("purchase_sheets", {
      filter: { orderId: p.id },
    });
    expect(sheet.grossWeightPcKg ?? null).toBeNull();
    // Com o bruto de verdade na ficha, deixa de ser estimado.
    await saveProductSheet(admin, p.id, { grossWeightPcKg: 0.26 });
    const real = (await analyzeProductsWithDefaults([p.id])).get(p.id)!;
    expect(real.inputs?.grossEstimated).toBe(false);
  });

  it("falta preço, caixa ou volume: o retrato diz o que falta e fica sem sinal", async () => {
    const p = await bare({ netWeightKg: 0.3 });
    const snapshot = (await analyzeProductsWithDefaults([p.id])).get(p.id)!;
    expect(snapshot.missing).toEqual(["price", "carton", "cbm"]);
    expect(snapshot).toMatchObject({
      verdict: null,
      costBrl: null,
      minimumBrl: null,
      salePriceBrl: null,
      profitPct: null,
      targetPriceBrl: null,
      usesMinimum: true,
      targetPct: 22,
      businessType: DEFAULT_SUPERPLAN.defaultBusinessType,
    });
    // Os pressupostos ficam no retrato mesmo sem conta.
    expect(snapshot.inputs).toMatchObject({
      officialRate: 5,
      container: "40HC",
      freightUsd: 3492,
      grossEstimated: true,
    });
  });

  it("produto sem NCM: II e IPI contam 0 e o retrato marca que o NCM não foi achado", async () => {
    const none = await withSheet({ ...JAR, ncm: null });
    const unknown = await withSheet({ ...JAR, ncm: "9999.99.99" });
    const map = await analyzeProductsWithDefaults([none.id, unknown.id]);
    for (const id of [none.id, unknown.id]) {
      const snapshot = map.get(id)!;
      expect(snapshot.inputs).toMatchObject({
        ncmFound: false,
        iiPct: 0,
        ipiPct: 0,
      });
      // A conta sai (otimista, sem II e IPI).
      expect(snapshot.verdict).not.toBeNull();
      expect(snapshot.missing).toEqual([]);
    }
    const prefills = await superplanPrefillsFor([none.id, unknown.id]);
    expect(prefills.get(none.id)).toMatchObject({
      ncm: null,
      iiPct: null,
      ipiPct: null,
      ncmFound: false,
    });
    expect(prefills.get(unknown.id)).toMatchObject({
      ncm: "9999.99.99",
      ncmFound: false,
    });
    // Com II e IPI, o custo é maior: o sinal sem NCM é o mais otimista.
    const full = await withSheet(JAR);
    const withTaxes = (await analyzeProductsWithDefaults([full.id])).get(
      full.id,
    )!;
    expect(withTaxes.costBrl!).toBeGreaterThan(map.get(none.id)!.costBrl!);
  });

  it("vários produtos de uma vez: um retrato por produto", async () => {
    const a = await withSheet(JAR);
    const b = await withSheet({ ...JAR, price: 49.8 });
    const c = await bare();
    const map = await analyzeProductsWithDefaults([a.id, b.id, c.id, a.id]);
    expect([...map.keys()].sort()).toEqual([a.id, b.id, c.id].sort());
    expect(map.get(b.id)!.costBrl!).toBeGreaterThan(map.get(a.id)!.costBrl!);
    expect(map.get(c.id)!.verdict).toBeNull();
  });
});

describe("retrato de uma conta", () => {
  /** O exemplo da planilha (docs/SUPERPLAN.md, seção 5). */
  const example = (patch: Partial<SuperplanInput> = {}): SuperplanInput => ({
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
    markup: 1.8,
    commissionPct: 5,
    adminExpensesPct: 12,
    targetProfitPct: 22,
    wdPct: 12,
    insurancePct: 0,
    pisImportPct: 2.1,
    cofinsImportPct: 9.65,
    icmsImportPct: 0,
    freightFxPct: 3.02,
    afrmmPct: 8,
    afrmmFixedBrl: 700,
    grossEstimatePct: 8,
    priceFactors: DEFAULT_SUPERPLAN.priceFactors,
    saleTaxes: DEFAULT_SUPERPLAN.saleTaxes,
    salePrice: null,
    ...patch,
  });
  const meta = {
    businessType: "WELLMIX - UD - CHINA - MERCADO",
    container: "40HC",
    ncmFound: true,
  };

  it("dinheiro em centavos, percentuais com 2 casas e o preço da meta arredondado para cima", () => {
    const input = example();
    const snapshot = snapshotOf(input, computeSuperplan(input), meta);
    expect(snapshot).toMatchObject({
      businessType: meta.businessType,
      costBrl: 30.67,
      minimumBrl: 55.21,
      salePriceBrl: 55.21,
      usesMinimum: true,
      targetPct: 22,
      verdict: "below",
      // R$ 62,88 e uma fração: vendendo a R$ 62,89 a meta é batida.
      targetPriceBrl: 62.89,
      missing: [],
    });
    expect(snapshot.profitPct!.toFixed(1)).toBe("16.0");
    expect(Number(snapshot.profitPct!.toFixed(2))).toBe(snapshot.profitPct);
    expect(snapshot.inputs).toEqual({
      unitPrice: input.unitPrice,
      currency: input.currency,
      pcsPerCarton: input.pcsPerCarton,
      cbmPerCarton: input.cbmPerCarton,
      officialRate: 5.15,
      futureRate: 5.4,
      rmbPerUsd: 6.75,
      iiPct: 20,
      ipiPct: 5,
      ncmFound: true,
      container: "40HC",
      freightUsd: 3492,
      grossEstimated: false,
    });
  });

  it("preço testado: guarda o preço digitado e que não é o mínimo", () => {
    const input = example({ salePrice: 70 });
    const snapshot = snapshotOf(input, computeSuperplan(input), meta);
    expect(snapshot).toMatchObject({
      salePriceBrl: 70,
      usesMinimum: false,
      minimumBrl: 55.21,
      verdict: "viable",
    });
    // Vendendo ao preço da meta do retrato, a meta é batida (verde).
    const atTarget = example({ salePrice: snapshot.targetPriceBrl });
    expect(computeSuperplan(atTarget).verdict).toBe("viable");
  });

  it("meta impossível ou dado faltando: sem preço da meta; o que faltou fica no retrato", () => {
    const impossible = example({ targetProfitPct: 80 });
    expect(
      snapshotOf(impossible, computeSuperplan(impossible), meta),
    ).toMatchObject({ targetPct: 80, targetPriceBrl: null, verdict: "below" });
    const noFx = example({
      officialRate: null,
      salePrice: 60,
      netWeightPcKg: 1,
      grossWeightPcKg: null,
    });
    const snapshot = snapshotOf(noFx, computeSuperplan(noFx), {
      ...meta,
      container: null,
      ncmFound: false,
    });
    expect(snapshot).toMatchObject({
      verdict: null,
      missing: ["fx"],
      costBrl: null,
      minimumBrl: null,
      profitPct: null,
      // O preço digitado fica guardado, mesmo sem conta.
      salePriceBrl: 60,
      usesMinimum: false,
    });
    expect(snapshot.inputs).toMatchObject({
      officialRate: null,
      futureRate: 5.4,
      ncmFound: false,
      container: null,
      grossEstimated: true,
    });
  });

  it("sem câmbio gravado: a análise em lote diz que falta o câmbio", async () => {
    const before = (await getSettings()).fxPtax;
    await setSetting("fxPtax", null);
    try {
      const p = await withSheet({ ...JAR, grossWeightPcKg: null });
      const snapshot = (await analyzeProductsWithDefaults([p.id])).get(p.id)!;
      expect(snapshot.verdict).toBeNull();
      expect(snapshot.missing).toEqual(["fx", "rmb"]);
      expect(snapshot.inputs).toMatchObject({
        officialRate: null,
        futureRate: null,
        rmbPerUsd: null,
        grossEstimated: true,
      });
    } finally {
      await setSetting("fxPtax", before);
      await setSetting("fxPtaxFailedAt", null);
    }
  });
});

describe("conta que vem do navegador", () => {
  let base: SuperplanInput;
  const ok = (value: unknown) => superplanInputSchema.safeParse(value).success;

  beforeAll(async () => {
    const p = await withSheet(JAR);
    const ctx = await loadSuperplanContext();
    const prefill = (await superplanPrefillsFor([p.id])).get(p.id)!;
    base = defaultSuperplanInput(prefill, ctx).input;
  });

  it("a conta da tela passa inteira, também depois de virar texto (JSON)", () => {
    expect(superplanInputSchema.parse(base)).toEqual(base);
    expect(
      superplanInputSchema.parse(JSON.parse(JSON.stringify(base))),
    ).toEqual(base);
    // Campos vazios (nulos) e preço testado valem.
    expect(
      ok({
        ...base,
        unitPrice: null,
        grossWeightPcKg: null,
        officialRate: null,
        salePrice: 59.9,
        currency: "USD",
      }),
    ).toBe(true);
  });

  it("recusa número que não é número, infinito, negativo ou grande demais", () => {
    expect(ok({ ...base, unitPrice: NaN })).toBe(false);
    expect(ok({ ...base, officialRate: Infinity })).toBe(false);
    // "1e999" em JSON vira infinito.
    expect(ok({ ...base, ...JSON.parse('{"freightUsd":1e999}') })).toBe(false);
    expect(ok({ ...base, unitPrice: -1 })).toBe(false);
    expect(ok({ ...base, netWeightPcKg: -0.2 })).toBe(false);
    expect(ok({ ...base, roadFreightBrl: -1500 })).toBe(false);
    expect(ok({ ...base, iiPct: -5 })).toBe(false);
    expect(ok({ ...base, unitPrice: 1e12 })).toBe(false);
    expect(ok({ ...base, pcsPerCarton: 1e9 })).toBe(false);
    expect(ok({ ...base, markup: 1000 })).toBe(false);
    expect(ok({ ...base, grossEstimatePct: 101 })).toBe(false);
    expect(
      ok({ ...base, saleTaxes: { ...base.saleTaxes, icmsPct: 150 } }),
    ).toBe(false);
    expect(
      ok({ ...base, priceFactors: { ...base.priceFactors, table: -1 } }),
    ).toBe(false);
  });

  it("recusa tipo errado, campo faltando, moeda desconhecida e listas ou textos grandes demais", () => {
    expect(ok(null)).toBe(false);
    expect(ok("{}")).toBe(false);
    expect(ok({ ...base, unitPrice: "24.9" })).toBe(false);
    expect(ok({ ...base, iiPct: null })).toBe(false);
    expect(ok({ ...base, currency: "EUR" })).toBe(false);
    const missing: Record<string, unknown> = { ...base };
    delete missing.grossEstimatePct;
    expect(ok(missing)).toBe(false);
    const expense = base.expenses[0];
    expect(
      ok({
        ...base,
        expenses: Array.from(
          { length: SUPERPLAN_MAX_EXPENSES + 1 },
          () => expense,
        ),
      }),
    ).toBe(false);
    expect(
      ok({
        ...base,
        expenses: Array.from({ length: SUPERPLAN_MAX_EXPENSES }, () => expense),
      }),
    ).toBe(true);
    expect(
      ok({ ...base, expenses: [{ ...expense, label: "x".repeat(121) }] }),
    ).toBe(false);
    expect(
      ok({ ...base, expenses: [{ ...expense, key: "k".repeat(41) }] }),
    ).toBe(false);
    expect(ok({ ...base, expenses: [{ ...expense, amountBrl: -1 }] })).toBe(
      false,
    );
    expect(ok({ ...base, expenses: [{ ...expense, customs: "on" }] })).toBe(
      false,
    );
  });

  it("campo desconhecido é descartado: só a conta chega ao cálculo", () => {
    const parsed = superplanInputSchema.parse({
      ...base,
      averageUsd: 3.2,
      verdict: "viable",
      expenses: base.expenses.map((e) => ({ ...e, extra: 1 })),
    });
    expect(parsed).toEqual(base);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(base).sort());
  });
});
