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
const { countryKey } = await import("@/lib/order-terms");
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

/**
 * Uma solicitação com vários produtos (lote), da China, utilidades, já
 * confirmada pelo cliente (esperando a estratégia).
 */
const lotOf = async (...items: Array<[string, number]>) => {
  const lot = await requests.createRequestBatch(
    joao,
    {
      customerId: "cliente-joao",
      orderTerms: {
        originCountry: countryKey("CN"),
        originCountryName: "China",
        productFamily: "fm:UTILIDADES_DOMESTICAS",
        productFamilyName: "UTILIDADES DOMESTICAS",
      } as never,
    },
    items.map(([productId, quantity]) => ({
      productId,
      productName: productId,
      description: "Encomenda",
      specification: null,
      quantity,
      unit: "un",
      sourcingDemand: false,
    })),
  );
  return Promise.all(
    lot.map((r) =>
      getStore().update("requests", r.id, { status: "REQUESTED" }),
    ),
  );
};

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

  it("a estratégia é da solicitação inteira, com todos os produtos dela", async () => {
    // Duas solicitações diferentes não se juntam.
    const a = await demand("prod-jarra", 500);
    const b = await demand("prod-panela", 800);
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: [a.id, b.id],
        choice: "quote",
        note: null,
      }),
    ).rejects.toThrow("strategy_same_request");
    // Uma solicitação com dois produtos (lote): vai inteira.
    const lot = await lotOf(["prod-jarra", 600], ["prod-panela", 800]);
    expect(new Set(lot.map((r) => r.groupId)).size).toBe(1);
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: [lot[0].id],
        choice: "quote",
        note: null,
      }),
    ).rejects.toThrow("strategy_whole_request");
    // A jarra não tem compra anterior: "última compra" não vale.
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: lot.map((r) => r.id),
        choice: "last_supplier",
        note: null,
      }),
    ).rejects.toThrow("strategy_no_last_purchase");
    const whole = await strategy.chooseStrategy(buyer, {
      demandIds: lot.map((r) => r.id),
      choice: "quote",
      note: "Cotar a solicitação toda",
    });
    expect(whole).toMatchObject({
      lineId: "linha-utilidades",
      productId: null,
      quantity: 1400,
    });
  });

  it("fornecedor da última compra com vários produtos: só quando todos tiveram o mesmo fornecedor", async () => {
    const store = getStore();
    // Boneca comprada antes do fornecedor B; jarra, do A (como a panela).
    const boneca = await demand("prod-boneca", 2000);
    await orderFromRequest(admin, boneca, {
      supplierId: "fornecedor-b",
      price: 2.2,
      currency: "USD",
    });
    await store.update("requests", boneca.id, { status: "ORDERED" });
    const jarra = await demand("prod-jarra", 1000);
    await orderFromRequest(admin, jarra, {
      supplierId: "fornecedor-a",
      price: 1.1,
      currency: "USD",
    });
    await store.update("requests", jarra.id, { status: "ORDERED" });
    // Panela (A) e boneca (B): fornecedores diferentes, só cotar.
    const mixed = await lotOf(["prod-panela", 800], ["prod-boneca", 2000]);
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: mixed.map((r) => r.id),
        choice: "last_supplier",
        note: null,
      }),
    ).rejects.toThrow("strategy_last_same_supplier");
    // Panela e jarra: as duas do A, a solicitação inteira vai para ele.
    const lot = await lotOf(["prod-panela", 800], ["prod-jarra", 600]);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: lot.map((r) => r.id),
      choice: "last_supplier",
      note: null,
    });
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: null,
    });
    const order = await strategy.orderFromStrategy(admin, decision.id, {
      currency: "USD",
      leadTimeDays: 40,
      incoterm: "FOB",
      lines: [
        { productId: "prod-panela", quantity: 800, unitPrice: 3.5 },
        { productId: "prod-jarra", quantity: 600, unitPrice: 1.1 },
      ],
    });
    expect(order).toMatchObject({ supplierId: "fornecedor-a" });
    expect(order.fobTotal).toBeCloseTo(3.5 * 800 + 1.1 * 600);
    for (const r of lot)
      expect(await store.get("requests", r.id)).toMatchObject({
        status: "ORDERED",
        orderId: order.id,
      });
  });

  it("cotar: os fornecedores do País × Família da solicitação, marcados na tela", async () => {
    const store = getStore();
    // B marcou a família de utilidades; um fornecedor do Brasil também
    // (fica fora pelo país); C não marcou (fica fora pela família).
    await store.create("party_families", {
      partyId: "fornecedor-b",
      familyCode: "20000000",
      createdByUserId: admin.id,
    });
    const br = await store.create("parties", {
      ...(await store.get("parties", "fornecedor-b"))!,
      id: "fornecedor-br-utilidades",
      name: "Fornecedor Brasil Utilidades",
      country: "BR",
    } as never);
    await store.create("party_families", {
      partyId: br.id,
      familyCode: "20000000",
      createdByUserId: admin.id,
    });
    const lot = await lotOf(["prod-jarra", 600], ["prod-panela", 800]);
    const origin = await strategy.strategySuppliers(lot);
    expect(origin.country).toBe(countryKey("CN"));
    expect(origin.familyName).toBe("UTILIDADES DOMESTICAS");
    const ids = origin.suppliers.map((s) => s.id);
    // A: fornecedor da panela; B: família no cadastro.
    expect(ids).toEqual(
      expect.arrayContaining(["fornecedor-a", "fornecedor-b"]),
    );
    expect(ids).not.toContain(br.id);
    expect(ids).not.toContain("fornecedor-c");
    expect(
      origin.suppliers.find((s) => s.id === "fornecedor-b")?.reasons,
    ).toEqual(["family"]);
    // Fora da lista não entra; ninguém marcado também não.
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: lot.map((r) => r.id),
        choice: "quote",
        note: null,
        supplierIds: ["fornecedor-c"],
      }),
    ).rejects.toThrow("strategy_supplier_invalid");
    await expect(
      strategy.chooseStrategy(buyer, {
        demandIds: lot.map((r) => r.id),
        choice: "quote",
        note: null,
        supplierIds: [],
      }),
    ).rejects.toThrow("strategy_suppliers_none");
    // O Comprador desmarcou o A: a cotação vai só para o B.
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: lot.map((r) => r.id),
      choice: "quote",
      note: null,
      supplierIds: ["fornecedor-b"],
    });
    expect(decision.supplierIds).toEqual(["fornecedor-b"]);
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: null,
    });
    const fresh = await store.get("purchase_decisions", decision.id);
    const responses = await store.list("purchase_quote_responses", {
      filter: { quoteId: fresh!.quoteId! },
    });
    expect(responses.map((r) => r.supplierId)).toEqual(["fornecedor-b"]);
  });

  it("fornecedor da última compra: Comprador escolhe, Diretoria aprova, pedido de compra com o vínculo e a reserva", async () => {
    const store = getStore();
    const d1 = await demand("prod-panela", 2000);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d1.id],
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
      demandIds: [d1.id],
      incoterm: "FOB",
    });
    expect(order.fobTotal).toBeCloseTo(3.4 * 2000);
    for (const id of [d1.id])
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
    const mine = reservations.filter((r) => r.requestId === d1.id);
    expect(mine.map((r) => r.quantity)).toEqual([2000]);
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
   * sem a permissão não vê nem digita o preço; o pedido sai com o preço e a
   * moeda da última compra gravados na decisão. Pelo padrão, todos os que
   * geram o pedido veem o preço; aqui, o Planejamento com "Ver preço de
   * compra" tirado pelo administrador (Funções e acessos).
   */
  it("usa o preço da última compra e ignora o enviado", async () => {
    const store = getStore();
    const noPrice = await store.create("users", {
      email: "planejamento.sem-preco@wellmix.com",
      name: "Paulo Planejamento",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
      functions: ["planner"],
    } as never);
    const fa = await import("@/lib/auth/function-access");
    const { attachAccess } = await import("@/lib/auth/access-cache");
    const defs = fa.resolveFunctions({
      functions: [
        {
          key: "planner",
          actions: fa
            .defaultActionsFor("planner")
            .filter((a) => a !== "purchasePrice.view"),
          knownActions: [...fa.ACTION_KEYS],
        },
      ],
    });
    attachAccess(noPrice, fa.accessFromFunctions(["planner"], defs));
    const { canSeePurchasePrice } = await import("@/lib/auth/function-access");
    expect(canSeePurchasePrice(noPrice)).toBe(false);
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
    const order = await strategy.orderFromStrategy(noPrice, decision.id, {
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
