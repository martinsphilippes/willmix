import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Preços WD e Wellmix do card "Venda ao cliente" pela cotação V2 (dono,
 * 24/11/2026; docs/ORDER_SALE.md, "Preços pela API"): WD com VIP 5; Wellmix
 * com o VIP do nível do pedido e, sem nível, o padrão do Sankhya (VIP nulo);
 * a cotação do dia guardada no item; a venda gravada pelo formato escolhido,
 * recalculada no servidor; caixas, cubagem e containers.
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const q = await import("@/lib/order-sale-quote");
const svc = await import("@/lib/services/order-sale-quote");
const r = await import("@/lib/services/requests");
const { orderFromRequest } = await import("./helpers/order");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Adapter = import("@/lib/integrations/price-forecast").PriceForecastAdapter;
type Query = import("@/lib/integrations/price-forecast").PriceForecastQuery;
type Answer = import("@/lib/integrations/price-forecast").PriceForecastAnswer;

const CUSTOMER = "cliente-joao";
const PRODUCT = "prod-boneca";
const DAY1 = new Date("2026-11-24T15:00:00.000Z");
const DAY2 = new Date("2026-11-25T15:00:00.000Z");
let admin: User;
let operator: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  operator = (
    await getStore().list("users", {
      filter: { email: "operador@wellmix.com" },
    })
  )[0];
  // Caixa master de 24 peças e 0,05 m³ (contas fáceis de conferir).
  await getStore().update("products", PRODUCT, {
    masterBoxQty: 24,
    cbm: 0.05,
  });
});

const forecast = (extra: Partial<Answer & { kind: "forecast" }>): Answer =>
  ({
    mode: "api",
    kind: "forecast",
    salePrice: null,
    tablePrice: null,
    wholesalePrice: null,
    retailPrice: null,
    targetPrice: null,
    cost: null,
    profitPercent: null,
    goalPercent: null,
    status: "PRONTA",
    ...extra,
  }) as Answer;

/**
 * Cotação falsa: o preço depende do VIP enviado (WD com VIP 5 → 9,90;
 * Wellmix sem VIP → 7,50; Mega, VIP 2 → 8,25). Guarda as consultas.
 */
function fakeAdapter(
  answer?: (query: Query) => Answer,
): Adapter & { calls: Query[] } {
  const calls: Query[] = [];
  return {
    mode: "api",
    calls,
    async forecast(query: Query) {
      calls.push(query);
      if (answer) return answer(query);
      return forecast({
        withFreight: query.vip === 2 ? 8.25 : 7.5,
        wdWithFreight: query.vip === 5 ? 9.9 : 1,
      });
    },
    async solve() {
      return { mode: "manual" };
    },
  };
}

/** Pedido do cliente com a boneca em peças (acima do pedido mínimo dela). */
async function newOrder(
  quantity = 2000,
): Promise<{ order: Order; itemId: string }> {
  const request = await r.createRequest(joao, {
    customerId: CUSTOMER,
    productId: PRODUCT,
    productName: "Boneca articulada 30 cm",
    description: "Boneca",
    quantity,
    unit: "un",
  });
  const order = await orderFromRequest(admin, request, {
    price: 2,
    sellPrice: null,
    sellCurrency: null,
  });
  const [item] = await getStore().list("order_items", {
    filter: { orderId: order.id },
  });
  return { order, itemId: item.id };
}

describe("regras puras", () => {
  it("peças da cotação: em peças, a quantidade; em caixas, × a caixa master; outra unidade, nada", () => {
    expect(q.piecesOf({ quantity: 960, unit: "UN" }, 24)).toEqual({
      pieces: 960,
      perUnit: 1,
    });
    expect(q.piecesOf({ quantity: 10, unit: "CX" }, 24)).toEqual({
      pieces: 240,
      perUnit: 24,
    });
    expect(q.piecesOf({ quantity: 10, unit: "CX" }, null)).toBeNull();
    expect(q.piecesOf({ quantity: 10, unit: "kg" }, 24)).toBeNull();
    expect(q.piecesOf({ quantity: 0, unit: "UN" }, 24)).toBeNull();
  });

  it("preço da unidade, caixas, cubagem e containers", () => {
    expect(q.unitSalePrice(9.9, 1)).toBe(9.9);
    expect(q.unitSalePrice(9.9, 24)).toBe(237.6);
    expect(q.unitSalePrice(null, 1)).toBeNull();
    expect(q.quotePrice({ wd: 9.9, wellmix: null }, "wd")).toBe(9.9);
    expect(q.quotePrice({ wd: 9.9, wellmix: null }, "wellmix")).toBeNull();
    expect(
      q.itemCargo({
        quantity: 133_920,
        unit: "UN",
        perBox: 24,
        cbmPerBox: 0.0731,
      }),
    ).toEqual({ boxes: 5580, cbm: 407.898 });
    expect(
      q.itemCargo({ quantity: 10, unit: "CX", perBox: 24, cbmPerBox: 0.05 }),
    ).toEqual({ boxes: 10, cbm: 0.5 });
    expect(
      q.itemCargo({ quantity: 10, unit: "UN", perBox: null, cbmPerBox: 0.05 }),
    ).toEqual({ boxes: null, cbm: null });
    // 407,786 m³ em 40HC (68 m³): 6,00 containers (2 casas).
    expect(q.containersFor(407.786, 68)).toBe(6);
    expect(q.containersFor(100, 68)).toBe(1.47);
    expect(q.containersFor(null, 68)).toBeNull();
    expect(q.containersFor(10, null)).toBeNull();
  });

  it("a cotação guardada vale no dia e com as mesmas entradas", () => {
    const key = q.saleQuoteKey({
      pieces: 960,
      productCode: "123",
      customerId: CUSTOMER,
      sellerCode: null,
      tier: null,
      route: null,
      freight: 8000,
    });
    const quote = {
      day: "2026-11-24",
      at: DAY1.toISOString(),
      key,
      wd: 9.9,
      wellmix: 7.5,
      wellmixTier: null,
      wdStatus: null,
      wellmixStatus: null,
    };
    expect(q.isQuoteFresh(quote, "2026-11-24", key)).toBe(true);
    expect(q.isQuoteFresh(quote, "2026-11-25", key)).toBe(false);
    expect(
      q.isQuoteFresh(
        quote,
        "2026-11-24",
        q.saleQuoteKey({
          pieces: 961,
          productCode: "123",
          customerId: CUSTOMER,
          sellerCode: null,
          tier: null,
          route: null,
          freight: 8000,
        }),
      ),
    ).toBe(false);
    expect(q.isQuoteFresh(null, "2026-11-24", key)).toBe(false);
  });
});

describe("preços pela cotação V2", () => {
  it("WD com VIP 5 e Wellmix sem nível no padrão do Sankhya (VIP nulo), por peça, com a quantidade do item", async () => {
    const { order, itemId } = await newOrder();
    const adapter = fakeAdapter();
    const result = await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY1,
    });
    expect(result.mode).toBe("api");
    expect(result.prices).toEqual([
      expect.objectContaining({
        itemId,
        wd: 9.9,
        wellmix: 7.5,
        wdError: null,
        wellmixError: null,
        wellmixTier: null,
        pieces: 2000,
        perUnit: 1,
      }),
    ]);
    expect(adapter.calls.map((c) => c.vip).sort()).toEqual([5, null].sort());
    expect(adapter.calls.every((c) => c.quantity === 2000)).toBe(true);
    expect(adapter.calls.every((c) => c.dataRef === "20261124")).toBe(true);
  });

  it("guarda a cotação do dia no item: a próxima visita não chama o Sankhya; no outro dia, ou com outra quantidade, cota de novo", async () => {
    const { order, itemId } = await newOrder();
    const adapter = fakeAdapter();
    await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY1,
    });
    expect(adapter.calls).toHaveLength(2);
    const item = (await getStore().get("order_items", itemId))!;
    expect(item.saleQuote).toMatchObject({
      day: "2026-11-24",
      wd: 9.9,
      wellmix: 7.5,
      wellmixTier: null,
    });
    // Mesmo dia: da cotação guardada (sem chamada).
    await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY1,
    });
    expect(adapter.calls).toHaveLength(2);
    // A tela lê a guardada sem chamar o Sankhya.
    const ctx = await svc.saleQuoteContext(order, [item], DAY1);
    expect(svc.cachedItemPrices(ctx, item)).toMatchObject({
      wd: 9.9,
      wellmix: 7.5,
    });
    // Outro dia: cota de novo.
    await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY2,
    });
    expect(adapter.calls).toHaveLength(4);
    // Outra quantidade (ficha de compra): cota de novo.
    await getStore().update("order_items", itemId, { quantity: 2400 });
    await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY2,
    });
    expect(adapter.calls).toHaveLength(6);
    expect(adapter.calls.at(-1)!.quantity).toBe(2400);
  });

  it("o nível da Nova solicitação vale no Wellmix (Mega = VIP 2)", async () => {
    const { order, itemId } = await newOrder();
    await getStore().update("requests", order.requestId!, {
      orderTerms: { saleFormat: "wellmix", wellmixTier: "mega" } as never,
    });
    const adapter = fakeAdapter();
    const result = await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY1,
    });
    expect(result.prices[0]).toMatchObject({
      wd: 9.9,
      wellmix: 8.25,
      wellmixTier: "mega",
    });
    expect(adapter.calls.map((c) => c.vip).sort()).toEqual([2, 5]);
  });

  it("sem preço: a mensagem do Sankhya ou a situação da cotação; nada guardado sem nenhum preço", async () => {
    const { order, itemId } = await newOrder();
    const adapter = fakeAdapter((query) =>
      query.vip === 5
        ? { mode: "api", kind: "error", message: "sem custo" }
        : forecast({ status: "FRETE_PENDENTE", withFreight: null }),
    );
    const result = await svc.orderItemSalePrices(admin, order.id, [itemId], {
      adapter,
      now: DAY1,
    });
    expect(result.prices[0]).toMatchObject({
      wd: null,
      wellmix: null,
      wdError: "sem custo",
      wellmixError: "FRETE_PENDENTE",
    });
    expect(
      (await getStore().get("order_items", itemId))!.saleQuote ?? null,
    ).toBeNull();
  });

  it("sem o Sankhya ligado: modo manual (o card continua com o preço digitado)", async () => {
    const { order, itemId } = await newOrder();
    const manual: Adapter = {
      mode: "manual",
      forecast: async () => ({ mode: "manual" }),
      solve: async () => ({ mode: "manual" }),
    };
    expect(
      await svc.orderItemSalePrices(admin, order.id, [itemId], {
        adapter: manual,
        now: DAY1,
      }),
    ).toEqual({ mode: "manual", prices: [] });
  });

  it("só a Wellmix que vê valores ou grava; item de outro pedido é recusado", async () => {
    const { order, itemId } = await newOrder();
    const other = await newOrder();
    await expect(
      svc.orderItemSalePrices(supplierA, order.id, [itemId], {
        adapter: fakeAdapter(),
      }),
    ).rejects.toThrow();
    await expect(
      svc.orderItemSalePrices(admin, order.id, [other.itemId], {
        adapter: fakeAdapter(),
      }),
    ).rejects.toThrow("sale_unknown_item");
  });
});

describe("gravar a venda pelo formato", () => {
  it("WD grava o preço WD de cada produto em R$, o total e o formato; trocar para Wellmix regrava", async () => {
    const { order, itemId } = await newOrder();
    const adapter = fakeAdapter();
    const wd = await svc.recordOrderSaleByFormat(admin, order.id, "wd", {
      adapter,
      now: DAY1,
    });
    expect(wd).toMatchObject({ total: 19800, complete: true, missing: 0 });
    let fresh = (await getStore().get("orders", order.id))!;
    expect(fresh).toMatchObject({
      sellPrice: 19800,
      sellCurrency: "BRL",
      saleFormat: "wd",
    });
    expect((await getStore().get("order_items", itemId))!.sellUnitPrice).toBe(
      9.9,
    );
    // Já cotado hoje: trocar o formato não chama o Sankhya de novo.
    const calls = adapter.calls.length;
    await svc.recordOrderSaleByFormat(admin, order.id, "wellmix", {
      adapter,
      now: DAY1,
    });
    expect(adapter.calls).toHaveLength(calls);
    fresh = (await getStore().get("orders", order.id))!;
    expect(fresh).toMatchObject({ sellPrice: 15000, saleFormat: "wellmix" });
    const logs = await getStore().list("audit_log", {
      filter: { entityId: order.id, action: "order.sale_recorded" },
    });
    expect(logs.length).toBe(2);
    expect(JSON.stringify(logs.map((l) => l.after))).toContain('"wellmix"');
  });

  it("item em caixas: preço por caixa (peça × caixa master); item fora do catálogo fica sem preço e o total, parcial", async () => {
    const { order, itemId } = await newOrder();
    const store = getStore();
    const box = await store.create("order_items", {
      orderId: order.id,
      productId: PRODUCT,
      name: "Boneca (caixas)",
      quantity: 10,
      unit: "CX",
      unitPrice: 48,
    } as never);
    const loose = await store.create("order_items", {
      orderId: order.id,
      productId: null,
      name: "Brinde",
      quantity: 5,
      unit: "un",
      unitPrice: 1,
    } as never);
    const adapter = fakeAdapter();
    const result = await svc.recordOrderSaleByFormat(admin, order.id, "wd", {
      adapter,
      now: DAY1,
    });
    expect(result).toMatchObject({ complete: false, missing: 1, total: null });
    expect((await store.get("order_items", itemId))!.sellUnitPrice).toBe(9.9);
    expect((await store.get("order_items", box.id))!.sellUnitPrice).toBe(237.6);
    expect(
      (await store.get("order_items", loose.id))!.sellUnitPrice ?? null,
    ).toBeNull();
    // A caixa foi cotada pelas peças (10 × 24 = 240).
    expect(adapter.calls.some((c) => c.quantity === 240)).toBe(true);
  });

  it("só quem grava a venda; pedido cancelado não muda", async () => {
    const { order } = await newOrder();
    await expect(
      svc.recordOrderSaleByFormat(operator, order.id, "wd", {
        adapter: fakeAdapter(),
      }),
    ).rejects.toThrow("sale_forbidden");
    await getStore().update("orders", order.id, { status: "CANCELLED" });
    await expect(
      svc.recordOrderSaleByFormat(admin, order.id, "wd", {
        adapter: fakeAdapter(),
      }),
    ).rejects.toThrow("sale_cancelled");
  });

  it("nenhum produto com o preço do formato: não grava e a venda de antes fica", async () => {
    const { order, itemId } = await newOrder();
    await svc.recordOrderSaleByFormat(admin, order.id, "wd", {
      adapter: fakeAdapter(),
      now: DAY1,
    });
    const broken = fakeAdapter(() => ({
      mode: "api",
      kind: "error",
      message: "HTTP 503",
    }));
    await expect(
      svc.recordOrderSaleByFormat(admin, order.id, "wellmix", {
        adapter: broken,
        now: DAY2,
      }),
    ).rejects.toThrow("sale_no_prices");
    expect((await getStore().get("order_items", itemId))!.sellUnitPrice).toBe(
      9.9,
    );
    expect((await getStore().get("orders", order.id))!).toMatchObject({
      sellPrice: 19800,
      saleFormat: "wd",
    });
  });

  it("sem o Sankhya ligado na hora de gravar: avisa em vez de gravar", async () => {
    const { order } = await newOrder();
    const manual: Adapter = {
      mode: "manual",
      forecast: async () => ({ mode: "manual" }),
      solve: async () => ({ mode: "manual" }),
    };
    await expect(
      svc.recordOrderSaleByFormat(admin, order.id, "wd", {
        adapter: manual,
        now: DAY1,
      }),
    ).rejects.toThrow("sale_api_unavailable");
  });
});
