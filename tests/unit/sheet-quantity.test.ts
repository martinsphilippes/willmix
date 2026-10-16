import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Fechar o container para cima e para baixo, a qualquer momento, e a
 * quantidade do pedido acompanhando as caixas (caixas × peças por caixa).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const calc = await import("@/lib/services/purchase-sheet-calc");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const ps = await import("@/lib/services/purchase-sheet");
const { quotePricing } = await import("@/lib/services/quote-pricing");
type User = import("@/lib/db").User;

const plan = (cartons: number[], cbmPerCarton: number, capacity: number) =>
  calc.planSheet(
    {
      lots: cartons.map((c) => ({
        departureIntervalDays: 45,
        masterCartons: c,
      })),
      masterCartonQty: 50,
      cbmPerCarton,
      productionStartAt: null,
      heightCm: null,
      widthCm: null,
      lengthCm: null,
    },
    capacity,
  );

describe("fechar o container: sempre para cima e para baixo", () => {
  it("40,44 containers com caixa maior que a sobra: sobe para 42 e desce para 40", () => {
    // Tela do usuário: 20 + 20 + 15 caixas de 50 m³ (2.750 m³), 40HC de 68 m³.
    const p = plan([20, 20, 15], 50, 68);
    const s = calc.suggestContainerFill(p, 50, 50)!;
    expect(s.addCartons).toBe(0); // regra antiga: "não cabe mais nenhuma caixa"
    expect(s.up).toEqual({ containers: 42, cartons: 2, pieces: 100, cbm: 100 });
    expect(s.down).toEqual({ containers: 40, cartons: 1, pieces: 50, cbm: 50 });
  });

  it("caso comum: completa o próximo ou tira para o de baixo", () => {
    const p = plan([3128], 0.1, 68); // 312,8 m³ = 4,6 containers
    const s = calc.suggestContainerFill(p, 0.1, 50)!;
    expect(s.up).toMatchObject({ containers: 5, cartons: 272 });
    expect(s.down).toMatchObject({ containers: 4, cartons: 408 });
  });

  it("já fecha exato: ainda dá para subir um container ou descer um", () => {
    const two = calc.suggestContainerFill(plan([1360], 0.1, 68), 0.1, 50)!;
    expect(two.exact).toBe(true);
    expect(two.up).toMatchObject({ containers: 3, cartons: 680 });
    expect(two.down).toMatchObject({ containers: 1, cartons: 680 });
    // Um container só: para baixo zeraria a programação, então não há.
    const one = calc.suggestContainerFill(plan([680], 0.1, 68), 0.1, 50)!;
    expect(one.up).toMatchObject({ containers: 2, cartons: 680 });
    expect(one.down).toBeNull();
  });

  it("o ajuste se espalha pelas programações (tirar começa pela última)", () => {
    expect(calc.spreadCartons([20, 20, 15], -1)).toEqual([20, 20, 14]);
    expect(calc.spreadCartons([20, 20, 15], -20)).toEqual([20, 15, 0]);
    expect(calc.spreadCartons([20, 20, 15], 2)).toEqual([20, 20, 17]);
    expect(calc.spreadCartons([0, 0, 0], 5)).toEqual([5, 0, 0]);
    expect(calc.spreadCartons([3, 0, 0], -10)).toEqual([0, 0, 0]);
  });

  it("peças da programação = caixas × peças por caixa (sem caixas: nulo)", () => {
    expect(
      calc.sheetTotalPieces({
        lots: [
          { departureIntervalDays: 45, masterCartons: 20 },
          { departureIntervalDays: 45, masterCartons: 15 },
        ],
        masterCartonQty: 50,
      }),
    ).toBe(1750);
    expect(calc.sheetTotalPieces({ lots: [], masterCartonQty: 50 })).toBeNull();
    expect(
      calc.sheetTotalPieces({
        lots: [{ departureIntervalDays: 45, masterCartons: 20 }],
        masterCartonQty: null,
      }),
    ).toBeNull();
  });
});

describe("quantidade do pedido acompanha as caixas", () => {
  let admin: User;
  let joao: User;
  let supplierA: User;
  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    joao = users.find((u) => u.email === "joao@lojista.com")!;
    supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  });

  it("cotação → proposta → pedido → ficha do pedido: a quantidade segue a programação", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productName: "Boneca",
      description: "Boneca de vinil",
      quantity: 3000,
      unit: "un",
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    // Fornecedor programa 20 + 20 + 15 caixas de 50 peças = 2.750 peças.
    await qs.saveQuoteSheet(supplierA, quote.id, {
      price: 2,
      currency: "USD",
      masterCartonQty: 50,
      cbmPerCarton: 0.05,
      lots: [
        { departureIntervalDays: 45, masterCartons: 20 },
        { departureIntervalDays: 45, masterCartons: 20 },
        { departureIntervalDays: 45, masterCartons: 15 },
      ],
    });
    await r.answerQuote(supplierA, quote.id, {
      price: 2,
      currency: "USD",
      leadTimeDays: 30,
    });

    // A conta do valor ao cliente usa as 2.750 peças da programação.
    const fresh = (await store.get("requests", request.id))!;
    const ctx = await quotePricing(fresh, [
      (await store.get("quotes", quote.id))!,
    ]);
    expect(ctx.quotes[0].input.quantity).toBe(2750);

    // Ao escolher, a solicitação passa a valer 2.750 (e o pedido nasce assim).
    await r.selectQuote(admin, quote.id, {
      sellPrice: 27500,
      sellCurrency: "BRL",
    });
    expect((await store.get("requests", request.id))!.quantity).toBe(2750);
    const order = await r.confirmDownPayment(admin, request.id);
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(item.quantity).toBe(2750);
    expect(order.fobTotal).toBe(5500);

    // Fornecedor tira uma caixa na ficha do pedido: a Wellmix confirma ao salvar.
    const lots = [
      { departureIntervalDays: 45, masterCartons: 20 },
      { departureIntervalDays: 45, masterCartons: 20 },
      { departureIntervalDays: 45, masterCartons: 14 },
    ];
    await ps.saveSheet(supplierA, order.id, { lots });
    expect(
      (await store.list("order_items", { filter: { orderId: order.id } }))[0]
        .quantity,
    ).toBe(2750);

    const inboxBefore = (
      await store.list("notifications", {
        filter: { userId: joao.id, channel: "inapp" },
      })
    ).length;
    await ps.saveSheet(admin, order.id, { lots });
    const [after] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(after.quantity).toBe(2700); // −1 caixa × 50 peças
    const updated = (await store.get("orders", order.id))!;
    expect(updated.fobTotal).toBe(5400); // US$ 2 × 2.700
    expect(updated.sellPrice).toBe(27000); // R$ 10 por peça, igual
    const inbox = await store.list("notifications", {
      filter: { userId: joao.id, channel: "inapp" },
    });
    expect(inbox.length).toBe(inboxBefore + 1);
    const [log] = await store.list("audit_log", {
      filter: { entityId: order.id, action: "order.quantity_from_sheet" },
    });
    expect(log.before).toMatchObject({ quantity: 2750 });
    expect(log.after).toMatchObject({ quantity: 2700 });

    // Salvar de novo sem mudar as caixas não mexe em nada.
    await ps.saveSheet(admin, order.id, { lots });
    expect(
      await store.list("audit_log", {
        filter: { entityId: order.id, action: "order.quantity_from_sheet" },
      }),
    ).toHaveLength(1);
  });
});
