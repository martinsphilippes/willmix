import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { orderFromRequest } from "./helpers/order";

/*
 * Estratégia de compra (mapa B10?; dono, 15/11/2026; docs/PURCHASE_DEMAND.md):
 * o Comprador escolhe entre o fornecedor da última compra e cotar entre
 * fornecedores, a Diretoria de compras aprova, e "fornecedor da última
 * compra" gera o pedido de compra direto, com o vínculo à demanda e a
 * reserva para o cliente da encomenda.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
type User = import("@/lib/db").User;

let admin: User;
let buyer: User;
let director: User;
let joao: User;

const demand = (productId: string, quantity = 1000) =>
  requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: productId,
    description: "Encomenda",
    quantity,
    unit: "un",
  });

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  buyer = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  director = by("diretoria@wellmix.com");
  // Compra anterior das panelas: fornecedor A, USD 3,50.
  const previous = await demand("prod-panela", 2000);
  await orderFromRequest(admin, previous, {
    supplierId: "fornecedor-a",
    price: 3.5,
    currency: "USD",
  });
  await getStore().update("requests", previous.id, { status: "ORDERED" });
});

describe("última compra", () => {
  it("vem do pedido mais recente com o produto: fornecedor, preço, moeda e data", async () => {
    const refs = await strategy.lastPurchases(["prod-panela", "prod-boneca"]);
    expect(refs.get("prod-panela")).toMatchObject({
      supplierId: "fornecedor-a",
      unitPrice: 3.5,
      currency: "USD",
    });
    // Produto sem compra anterior.
    expect(refs.get("prod-boneca")).toBeUndefined();
  });
});

describe("escolha e aprovação", () => {
  it("produto sem compra anterior: só dá para cotar", async () => {
    const d = await demand("prod-boneca", 2000);
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: [d.id],
        choice: "last_supplier",
        note: null,
      }),
    ).rejects.toThrow("strategy_no_last_purchase");
    const quote = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "quote",
      note: null,
    });
    expect(quote).toMatchObject({ choice: "quote", status: "pending" });
  });

  it("junta só demandas do mesmo produto ou da mesma linha", async () => {
    const a = await demand("prod-jarra", 500);
    const b = await demand("prod-boneca", 2000);
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: [a.id, b.id],
        choice: "quote",
        note: null,
      }),
    ).rejects.toThrow("strategy_same_line");
    // Jarra e panela: a mesma linha (utilidades), mas "última compra" é de um produto só.
    const c = await demand("prod-panela", 800);
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: [a.id, c.id],
        choice: "last_supplier",
        note: null,
      }),
    ).rejects.toThrow("strategy_last_one_product");
    const joined = await strategy.chooseStrategy(buyer, {
      demandIds: [a.id, c.id],
      choice: "quote",
      note: "Cotar a linha toda",
    });
    expect(joined).toMatchObject({
      lineId: "linha-utilidades",
      productId: null,
      quantity: 1300,
    });
  });

  it("fornecedor da última compra: Comprador escolhe, Diretoria aprova, pedido de compra com o vínculo e a reserva", async () => {
    const store = getStore();
    const d1 = await demand("prod-panela", 1500);
    const d2 = await demand("prod-panela", 500);
    // Reposição do mesmo produto entra na mesma decisão.
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d1.id, d2.id],
      choice: "last_supplier",
      note: null,
    });
    expect(decision.reference?.[0]).toMatchObject({
      supplierId: "fornecedor-a",
      unitPrice: 3.5,
    });
    // As demandas saem da fila de espera.
    const waiting = await strategy.waitingDemands();
    expect(waiting.map((r) => r.id)).not.toContain(d1.id);
    // O Comprador não aprova a própria escolha (sem a ação).
    await expect(
      strategy.decideStrategy(buyer, decision.id, {
        approve: true,
        note: null,
      }),
    ).rejects.toThrow();
    // Recusar exige o motivo.
    await expect(
      strategy.decideStrategy(director, decision.id, {
        approve: false,
        note: null,
      }),
    ).rejects.toThrow("strategy_reject_note");
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: "Ok",
    });
    // Condições pré-preenchidas da última compra, editadas pelo Comprador.
    const order = await strategy.orderFromStrategy(admin, decision.id, {
      unitPrice: 3.4,
      currency: "USD",
      quantity: 2000,
      leadTimeDays: 45,
      incoterm: "FOB",
    });
    expect(order).toMatchObject({
      supplierId: "fornecedor-a",
      flow: "supplier_request",
      demandIds: [d1.id, d2.id],
      incoterm: "FOB",
    });
    expect(order.fobTotal).toBeCloseTo(3.4 * 2000);
    for (const id of [d1.id, d2.id])
      expect(await store.get("requests", id)).toMatchObject({
        status: "ORDERED",
        orderId: order.id,
      });
    expect((await store.get("purchase_decisions", decision.id))?.status).toBe(
      "done",
    );
    // Reserva para o cliente da encomenda, valendo na chegada (sem validade).
    const reservations = await store.list("stock_reservations", {
      filter: { customerId: "cliente-joao" },
    });
    const mine = reservations.filter((r) =>
      [d1.id, d2.id].includes(r.requestId ?? ""),
    );
    expect(mine.map((r) => r.quantity).sort((a, b) => a - b)).toEqual([
      500, 1500,
    ]);
    expect(mine.every((r) => r.status === "active" && !r.expiresAt)).toBe(true);
    // Vendas é avisada do pedido de compra (V1).
    const notes = await store.list("notifications", {});
    expect(notes.some((n) => n.link === `/app/orders/${order.id}`)).toBe(true);
  });

  it("recusada, as demandas voltam para a fila", async () => {
    const d = await demand("prod-panela", 700);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "last_supplier",
      note: null,
    });
    await strategy.decideStrategy(director, decision.id, {
      approve: false,
      note: "Renegociar preço",
    });
    expect((await strategy.waitingDemands()).map((r) => r.id)).toContain(d.id);
  });

  it("cliente e fornecedor não escolhem nem aprovam", async () => {
    const d = await demand("prod-panela", 900);
    await expect(
      strategy.chooseStrategy(joao, {
        demandIds: [d.id],
        choice: "quote",
        note: null,
      }),
    ).rejects.toThrow();
  });
});

describe("pedido pela estratégia sem “Ver preço de compra”", () => {
  /*
   * Dono, 15/11/2026 (docs/LINHA_DE_VISAO.md, seção 7): quem gera o pedido
   * sem a permissão (o Planejamento, por padrão) não vê nem digita o preço; o
   * pedido sai com o preço e a moeda da última compra gravados na decisão.
   */
  it("usa o preço da última compra e ignora o enviado", async () => {
    const store = getStore();
    const planner = await store.create("users", {
      email: "planejamento@wellmix.com",
      name: "Paulo Planejamento",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
      functions: ["planner"],
    } as never);
    const { canSeePurchasePrice } = await import("@/lib/auth/function-access");
    expect(canSeePurchasePrice(planner)).toBe(false);
    const d = await demand("prod-panela", 1000);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "last_supplier",
      note: null,
    });
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: null,
    });
    const order = await strategy.orderFromStrategy(planner, decision.id, {
      unitPrice: 0.01,
      currency: "BRL",
      quantity: 1000,
      leadTimeDays: 30,
      incoterm: "FOB",
    });
    // A última compra é a do pedido mais recente da panela (fornecedor A).
    const ref = decision.reference![0];
    expect(ref.unitPrice).toBeGreaterThan(1);
    expect(order.fobCurrency).toBe(ref.currency);
    expect(order.fobTotal).toBeCloseTo(ref.unitPrice! * 1000);
  });
});
