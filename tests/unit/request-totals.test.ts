import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Totais de Encomendas (dono, 18/11/2026; docs/ORDER_LEVEL_LISTS.md, seção
 * 5): a embalagem de cada produto numa regra só (a da ficha completa, com
 * caixas e inner por programação), o agregador da encomenda (peças, caixas,
 * inner, CBM, pedido mínimo uma vez por produto, "Total parcial" e "—") e a
 * previsão de venda gravada no envio (cotação V2 refeita pelo servidor).
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PRODUCT_EXTRA_DEFAULTS, REQUEST_EXTRA_DEFAULTS } =
  await import("@/lib/db/schema");
const packingMod = await import("@/lib/services/request-packing");
const { encomendaTotals, totalSortText } = await import("@/lib/request-totals");
const forecastMod = await import("@/lib/services/request-price-forecast");
type Request = import("@/lib/db").Request;
type Product = import("@/lib/db").Product;
type TotalsLine = import("@/lib/request-totals").TotalsLine;
type PriceForecastAdapter =
  import("@/lib/integrations/price-forecast").PriceForecastAdapter;
type PriceForecastQuery =
  import("@/lib/integrations/price-forecast").PriceForecastQuery;
type OrderTerms = import("@/lib/order-terms").OrderTerms;

const CUSTOMER = "cliente-joao";
let adminId = "";

async function product(over: Partial<Product> = {}): Promise<Product> {
  return getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId: "linha-brinquedos",
    name: "Produto de teste",
    sku: `T-${Math.random().toString(36).slice(2, 8)}`,
    specification: null,
    active: true,
    ...over,
  } as never);
}

const schedule = (...quantities: number[]) => ({
  firstDate: "2027-01-10",
  intervalDays: 30,
  items: quantities.map((quantity, i) => ({
    index: i + 1,
    quantity,
    expectedAt: `2027-0${i + 1}-10`,
  })),
});

async function request(
  productId: string | null,
  over: Partial<Request> = {},
): Promise<Request> {
  return getStore().create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: CUSTOMER,
    createdByUserId: adminId,
    productId,
    productName: "Produto de teste",
    description: "Produto de teste",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    status: "REQUESTED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    ...over,
  } as never);
}

const pack = (
  request: Request,
  p: Product | null,
  extra: Partial<import("@/lib/services/request-packing").PackingInputs> = {},
  technical = true,
) =>
  packingMod.resolvePacking(
    {
      request,
      product: p,
      master: null,
      orderSheet: null,
      negotiation: null,
      book: null,
      ...extra,
    },
    technical,
  );

beforeAll(async () => {
  const { users } = await seedDemo();
  adminId = users.find((u) => u.email === "admin@wellmix.com")!.id;
});

describe("embalagem de um produto (a regra da ficha completa)", () => {
  it("caixas e inner arredondados em cada programação; CBM pelas caixas", async () => {
    // 1.000 peças em 2 × 500, 48 por caixa e 6 por inner: 11 + 11 caixas
    // (pelo total seriam 21) e 84 + 84 inner.
    const p = await product({ masterBoxQty: 48, innerBoxQty: 6, cbm: 0.1202 });
    const r = await request(p.id, { schedule: schedule(500, 500) });
    const k = pack(r, p);
    expect(k.pieces).toEqual({ value: 1000, kind: "schedule" });
    expect(k.roundPieces).toEqual([500, 500]);
    expect(k.boxes).toMatchObject({
      value: 22,
      perRound: [11, 11],
      exact: false,
    });
    expect(k.innerBoxes).toEqual({ value: 168, perRound: [84, 84] });
    expect(k.cbmTotal).toBe(2.6444); // 22 × 0,1202
    expect(k.countable).toBe(true);
  });

  it("sem programação: do total, para cima", async () => {
    const p = await product({ masterBoxQty: 240, cbm: 0.1476375 });
    const r = await request(p.id, { quantity: 48000 });
    const k = pack(r, p);
    expect(k.boxes).toMatchObject({ value: 200, perRound: null, exact: true });
    expect(k.cbmTotal).toBe(29.5275);
    // Sem peças por inner: nada de caixas inner (não é zero).
    expect(k.inner).toBeNull();
    expect(k.innerBoxes).toBeNull();
  });

  it("quantidade em caixas: peças = caixas × peças por caixa", async () => {
    const p = await product({ masterBoxQty: 24, innerBoxQty: 4, cbm: 0.05 });
    const r = await request(p.id, { quantity: 10, unit: "CX" });
    const k = pack(r, p);
    expect(k.pieces).toEqual({ value: 240, kind: "calculated" });
    expect(k.boxes?.value).toBe(10);
    expect(k.innerBoxes?.value).toBe(60);
    expect(k.cbmTotal).toBe(0.5);
  });

  it("origem: texto da solicitação → variação → negociação → Book → cadastro", async () => {
    const p = await product({ masterBoxQty: 60, cbm: 0.08, innerBoxQty: 12 });
    const book = {
      masterCartonQty: 36,
      cbmPerCarton: 0.077,
      innerQty: 6,
    } as never;
    const r = await request(p.id, { quantity: 720 });
    // O Book vem antes do cadastro (a ficha faz igual).
    const viaBook = pack(r, p, { book });
    expect(viaBook.perBox).toEqual({ value: 36, kind: "book" });
    expect(viaBook.cbmPerBox).toMatchObject({ value: 0.077, kind: "book" });
    expect(viaBook.inner).toEqual({ value: 6, kind: "book" });
    expect(viaBook.boxes?.value).toBe(20);
    // A variação pedida vem antes do Book.
    const withVariant = await request(p.id, {
      quantity: 720,
      variant: {
        masterBoxQty: 24,
        cbm: 0.04,
        innerBoxQty: 12,
        moq: 300,
      } as never,
    });
    const viaVariant = pack(withVariant, p, { book });
    expect(viaVariant.perBox).toEqual({ value: 24, kind: "variant" });
    expect(viaVariant.boxes?.value).toBe(30);
    expect(viaVariant.moq).toEqual({ value: 300, kind: "variant" });
    // O texto gravado na solicitação vem antes de tudo.
    const withSpec = await request(p.id, {
      quantity: 720,
      specification: "Unidades por caixa master: 72",
    });
    expect(pack(withSpec, p, { book }).perBox).toEqual({
      value: 72,
      kind: "request",
    });
  });

  it("CBM das medidas da caixa do cadastro quando não há CBM gravado", async () => {
    const p = await product({
      masterBoxQty: 4,
      cbm: null,
      boxLengthCm: 62,
      boxWidthCm: 32,
      boxHeightCm: 42,
    });
    const k = pack(await request(p.id, { quantity: 40 }), p);
    expect(k.cbmPerBox).toMatchObject({
      value: 0.0833,
      kind: "calculated",
      from: "current",
      calculated: true,
    });
    expect(k.cbmTotal).toBe(0.833);
  });

  it("pedido mínimo: variação → ficha mestre → cadastro; o cliente não vê", async () => {
    const p = await product({ moq: 500, masterBoxQty: 10 });
    const r = await request(p.id);
    expect(pack(r, p).moq).toEqual({ value: 500, kind: "current" });
    const master = { moq: 800 } as never;
    expect(pack(r, p, { master }).moq).toEqual({ value: 800, kind: "current" });
    expect(pack(r, p, {}, false).moq).toBeNull();
    // Sem a ficha técnica (cliente na ficha): só o que a solicitação gravou.
    expect(pack(r, p, {}, false).perBox).toBeNull();
  });

  it("outra unidade (kg) não soma peças nem caixas inner", async () => {
    const p = await product({ masterBoxQty: 10, innerBoxQty: 2 });
    const k = pack(await request(p.id, { quantity: 50, unit: "kg" }), p);
    expect(k.countable).toBe(false);
    expect(k.roundPieces).toBeNull();
    expect(k.innerBoxes).toBeNull();
  });

  it("CBM só da caixa contada: o de outra caixa fica de fora (dono, 19/11/2026)", async () => {
    // Cadastro com caixa de 60 e 0,08 m³; a variação pedida é de 24 por
    // caixa, sem CBM: a conta das caixas é de 24, então o 0,08 não vale.
    const p = await product({ masterBoxQty: 60, cbm: 0.08 });
    const small = await request(p.id, {
      quantity: 720,
      variant: { masterBoxQty: 24 } as never,
    });
    const k = pack(small, p);
    expect(k.perBox).toEqual({ value: 24, kind: "variant" });
    expect(k.boxes?.value).toBe(30);
    expect(k.cbmPerBox).toBeNull();
    expect(k.cbmTotal).toBeNull();
    expect(k.cbmOtherBox).toEqual({ boxQty: 60, kind: "current" });
    // Com o CBM da própria variação (caixa de 24), ele vale.
    const own = await request(p.id, {
      quantity: 720,
      variant: { masterBoxQty: 24, cbm: 0.04 } as never,
    });
    expect(pack(own, p).cbmPerBox).toMatchObject({
      value: 0.04,
      kind: "variant",
    });
    expect(pack(own, p).cbmOtherBox).toBeNull();
    // A fonte que não diz de quantas peças é a caixa continua valendo: o
    // texto "Caixa master: 0,05 m³" (sem as peças da caixa).
    const text = await request(p.id, {
      quantity: 720,
      variant: { masterBoxQty: 24 } as never,
      specification: "Caixa master: 0,05 m³",
    });
    const fromText = pack(text, p);
    expect(fromText.spec).toMatchObject({ cbmPerBox: 0.05, perBox: null });
    expect(fromText.cbmPerBox).toMatchObject({ value: 0.05, kind: "request" });
    expect(fromText.cbmOtherBox).toBeNull();
    expect(fromText.cbmTotal).toBe(1.5); // 30 caixas × 0,05
  });

  it("cbmForBox: a mesma caixa, a fonte que não diz e a outra caixa", () => {
    const c = (value: number, boxQty: number | null) => ({
      value,
      kind: "current" as const,
      calc: false,
      boxQty,
    });
    expect(packingMod.cbmForBox([c(0.1, 60), c(0.2, 24)], 24)).toEqual({
      hit: c(0.2, 24),
      otherBox: null,
    });
    expect(packingMod.cbmForBox([c(0.1, null)], 24).hit).toEqual(c(0.1, null));
    expect(packingMod.cbmForBox([c(0.1, 60)], 24)).toEqual({
      hit: null,
      otherBox: c(0.1, 60),
    });
    // Sem peças por caixa na conta, qualquer CBM vale (não há caixa contada).
    expect(packingMod.cbmForBox([c(0.1, 60)], null).hit).toEqual(c(0.1, 60));
  });

  it("o carregador lê cadastro, ficha mestre, negociação e Book como a ficha", async () => {
    const p = await product({ masterBoxQty: 48, innerBoxQty: 6, cbm: 0.12 });
    await getStore().create("purchase_sheets", {
      orderId: p.id,
      moq: 2000,
    } as never);
    const r = await request(p.id, { schedule: schedule(960, 480) });
    const loaded = await packingMod.loadRequestPacking([r]);
    const k = loaded.get(r.id)!;
    expect(k.boxes).toMatchObject({ value: 30, perRound: [20, 10] });
    expect(k.innerBoxes?.value).toBe(240);
    expect(k.cbmTotal).toBe(3.6);
    expect(k.moq).toEqual({ value: 2000, kind: "current" });
  });
});

const line = (over: Partial<TotalsLine>): TotalsLine => ({
  name: "Produto",
  productKey: null,
  countable: true,
  pieces: null,
  boxes: null,
  innerBoxes: null,
  cbm: null,
  moq: null,
  sale: null,
  ...over,
});

describe("totais da encomenda", () => {
  it("encomenda nº 6 de produção: dois produtos, duas programações", () => {
    const totals = encomendaTotals([
      line({
        name: "BARCO A VELA",
        productKey: "barco|",
        pieces: 112128,
        boxes: 2336,
        cbm: 271.9384,
      }),
      line({
        name: "LOUSA MAGICA",
        productKey: "lousa|",
        pieces: 526320,
        boxes: 4386,
        cbm: 135.966,
      }),
    ]);
    expect(totals.pieces).toEqual({ value: 638448, missing: [] });
    expect(totals.boxes).toEqual({ value: 6722, missing: [] });
    expect(totals.cbm).toEqual({ value: 407.9044, missing: [] });
    // Sem inner, MOQ e previsão em nenhum: "—" (nulo), não zero.
    expect(totals.inner.value).toBeNull();
    expect(totals.moq.value).toBeNull();
    expect(totals.sale.amounts).toEqual([]);
    expect(totals.sale.missing).toEqual(["BARCO A VELA", "LOUSA MAGICA"]);
  });

  it("total parcial: soma o que existe e diz quem faltou", () => {
    const totals = encomendaTotals([
      line({
        name: "A",
        productKey: "a|",
        pieces: 100,
        boxes: 5,
        innerBoxes: 20,
        cbm: 1,
        moq: 50,
      }),
      line({
        name: "B",
        productKey: "b|",
        pieces: 200,
        boxes: null,
        innerBoxes: null,
        cbm: null,
      }),
    ]);
    expect(totals.pieces).toEqual({ value: 300, missing: [] });
    expect(totals.boxes).toEqual({ value: 5, missing: ["B"] });
    expect(totals.inner).toEqual({ value: 20, missing: ["B"] });
    expect(totals.cbm).toEqual({ value: 1, missing: ["B"] });
    expect(totals.moq).toEqual({ value: 50, missing: ["B"] });
  });

  it("pedido mínimo uma vez por produto; fora do catálogo não tem mínimo", () => {
    const totals = encomendaTotals([
      line({ name: "Boneca", productKey: "boneca|", moq: 2000, pieces: 1000 }),
      line({ name: "Boneca", productKey: "boneca|", moq: 2000, pieces: 1500 }),
      line({
        name: "Boneca azul",
        productKey: "boneca|azul",
        moq: 600,
        pieces: 600,
      }),
      line({ name: "Copo (fora do catálogo)", productKey: null, pieces: 200 }),
    ]);
    expect(totals.moq).toEqual({
      value: 2600,
      missing: ["Copo (fora do catálogo)"],
    });
    // As quantidades contam todas (são linhas diferentes da encomenda).
    expect(totals.pieces.value).toBe(3300);
  });

  it("zero é zero; sem dado é nulo", () => {
    const zero = encomendaTotals([line({ name: "A", pieces: 0, boxes: 0 })]);
    expect(zero.pieces).toEqual({ value: 0, missing: [] });
    expect(zero.boxes).toEqual({ value: 0, missing: [] });
    expect(encomendaTotals([line({ name: "A" })]).pieces).toEqual({
      value: null,
      missing: ["A"],
    });
  });

  it("outra unidade fica de fora das somas em peças", () => {
    const totals = encomendaTotals([
      line({ name: "Fio", countable: false, pieces: 50, boxes: 5 }),
      line({ name: "Copo", pieces: 10, boxes: 1 }),
    ]);
    expect(totals.pieces).toEqual({ value: 10, missing: ["Fio"] });
    expect(totals.boxes).toEqual({ value: 1, missing: ["Fio"] });
  });

  it("preço por moeda (R$ primeiro) e itens do pedido fora das linhas", () => {
    const totals = encomendaTotals(
      [
        line({ name: "A", sale: { amount: 1000.1, currency: "BRL" } }),
        line({ name: "B", sale: { amount: 10, currency: "USD" } }),
        line({ name: "C", sale: { amount: 0.2, currency: "brl" } }),
      ],
      ["Item do pedido"],
    );
    expect(totals.sale.amounts).toEqual([
      { currency: "BRL", amount: 1000.3 },
      { currency: "USD", amount: 10 },
    ]);
    expect(totals.sale.missing).toEqual(["Item do pedido"]);
    expect(totals.pieces.missing).toEqual(["A", "B", "C", "Item do pedido"]);
  });

  it("texto de ordenação: número com ponto e 6 casas; vazio sem valor", () => {
    expect(totalSortText(29.5275)).toBe("29.527500");
    expect(totalSortText(1168)).toBe("1168.000000");
    expect(totalSortText(null)).toBe("");
  });
});

describe("previsão de venda gravada no envio", () => {
  const terms = (over: Partial<OrderTerms> = {}): OrderTerms =>
    ({
      operationType: "TS",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      carrier: null,
      carrierCaller: "wellmix",
      deliveryFreightBrl: null,
      originCountry: "CHINA",
      originCountryName: "CHINA",
      noReturnsNotice: true,
      ...over,
    }) as OrderTerms;

  function fakeAdapter(
    answer: (q: PriceForecastQuery) => unknown,
    seen: PriceForecastQuery[] = [],
  ): PriceForecastAdapter {
    return {
      mode: "api",
      forecast: async (q) => {
        seen.push(q);
        return answer(q) as never;
      },
      solve: async () => ({ mode: "manual" }),
    };
  }

  it("grava preço com frete × peças (formato Wellmix) com a consulta da tela", async () => {
    const p = await product({ masterBoxQty: 48, price: 3.2, currency: "USD" });
    const r = await request(p.id, {
      schedule: schedule(500, 700),
      quantity: 1200,
    });
    const seen: PriceForecastQuery[] = [];
    const adapter = fakeAdapter(
      () => ({
        mode: "api",
        kind: "forecast",
        withFreight: 12.5,
        wdWithFreight: 14,
        status: "PRONTA",
      }),
      seen,
    );
    const now = new Date("2026-11-18T15:00:00Z");
    const saved = await forecastMod.recordPriceForecasts([r], terms(), {
      adapter,
      now,
    });
    expect(saved).toBe(1);
    // A mesma consulta que a tela manda: VIP do nível, rota de quem chama,
    // frete padrão das Configurações, RCA do cliente e a data de Brasília.
    expect(seen[0]).toMatchObject({
      productId: p.id,
      quantity: 1200,
      customerId: CUSTOMER,
      vip: 2,
      route: "VIA_DEPOSITO",
      deliveryFreightBrl: 8000,
      sellerCode: 101,
      dataRef: "20261118",
    });
    const stored = (await getStore().get("requests", r.id))!.priceForecast;
    expect(stored).toEqual({
      unitPrice: 12.5,
      pieces: 1200,
      total: 15000,
      currency: "BRL",
      basis: "with_freight",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      carrierCaller: "wellmix",
      deliveryFreightBrl: 8000,
      status: "PRONTA",
      at: now.toISOString(),
      // Os preços Wellmix da mesma resposta, para a tabela padrão de itens
      // (docs/ORDER_TABLES.md): sem frete (aqui a resposta não trouxe) e
      // com frete.
      wellmixPrice: null,
      wellmixWithFreight: 12.5,
    });
  });

  it("formato WD: o preço WD com frete e o frete digitado", async () => {
    const p = await product();
    const r = await request(p.id, { quantity: 100 });
    const seen: PriceForecastQuery[] = [];
    const adapter = fakeAdapter(
      () => ({
        mode: "api",
        kind: "forecast",
        withFreight: 9,
        wdWithFreight: 11.3333,
      }),
      seen,
    );
    await forecastMod.recordPriceForecasts(
      [r],
      terms({
        saleFormat: "wd",
        wellmixTier: null,
        carrierCaller: "customer",
        deliveryFreightBrl: 1500,
      }),
      { adapter },
    );
    expect(seen[0]).toMatchObject({
      vip: 5,
      route: "PORTO_CLIENTE",
      deliveryFreightBrl: 1500,
    });
    const stored = (await getStore().get("requests", r.id))!.priceForecast!;
    expect(stored).toMatchObject({
      unitPrice: 11.3333,
      total: 1133.33,
      basis: "wd_with_freight",
      deliveryFreightBrl: 1500,
    });
  });

  it("sem Sankhya, com erro ou fora de peças: nada gravado (e os outros seguem)", async () => {
    const a = await product();
    const b = await product();
    const c = await product();
    const ra = await request(a.id, { quantity: 10 });
    const rb = await request(b.id, { quantity: 10 });
    const rc = await request(c.id, { quantity: 10, unit: "kg" });
    const adapter = fakeAdapter((q) => {
      if (q.productId === a.id) throw new Error("timeout");
      return { mode: "api", kind: "forecast", withFreight: 2 };
    });
    const saved = await forecastMod.recordPriceForecasts(
      [ra, rb, rc],
      terms(),
      {
        adapter,
      },
    );
    expect(saved).toBe(1);
    const get = async (id: string) =>
      (await getStore().get("requests", id))!.priceForecast ?? null;
    expect(await get(ra.id)).toBeNull();
    expect((await get(rb.id))?.total).toBe(20);
    expect(await get(rc.id)).toBeNull();
    // Modo manual (sem o Sankhya configurado): nenhum preço inventado.
    const rd = await request(a.id, { quantity: 10 });
    const manual = fakeAdapter(() => ({ mode: "manual" }));
    expect(
      await forecastMod.recordPriceForecasts([rd], terms(), {
        adapter: manual,
      }),
    ).toBe(0);
    expect(await get(rd.id)).toBeNull();
  });

  it("fora de uma requisição não agenda (testes e scripts)", async () => {
    const p = await product();
    const r = await request(p.id);
    expect(forecastMod.schedulePriceForecasts([r], terms())).toBe(false);
    expect(forecastMod.schedulePriceForecasts([r], null)).toBe(false);
  });
});
