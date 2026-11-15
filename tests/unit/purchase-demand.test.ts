import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { demandChannel, demandKind, splitCart } from "@/lib/purchase-demand";

/*
 * Compra por demanda (mapa B10 e B14; dono, 15/11/2026;
 * docs/PURCHASE_DEMAND.md): a encomenda pelas quatro portas, a reposição
 * aberta à mão pelo Planner e a divisão do carrinho entre pronta entrega e
 * encomenda.
 */
describe("regras puras", () => {
  it("encomenda ou reposição, pela origem", () => {
    expect(demandKind({ origin: "replenishment" })).toBe("replenishment");
    expect(demandKind({ origin: "manual" })).toBe("order");
    expect(demandKind({ origin: "cart" })).toBe("order");
    expect(demandKind({ origin: null })).toBe("order");
    expect(demandKind({ origin: "supplier_request" })).toBeNull();
  });

  it("porta de entrada: vitrine, cliente, vendedor ou operador", () => {
    const customer = { role: "customer" as const };
    const seller = { role: "operator" as const, functions: ["sales"] };
    const operator = { role: "operator" as const, functions: ["buyer"] };
    const admin = { role: "admin" as const };
    expect(demandChannel(customer, { origin: "cart", cart: true })).toBe(
      "vitrine",
    );
    expect(demandChannel(customer, { origin: "manual" })).toBe("cliente");
    expect(demandChannel(seller as never, { origin: "manual" })).toBe(
      "vendedor",
    );
    expect(demandChannel(operator as never, { origin: "manual" })).toBe(
      "operador",
    );
    expect(demandChannel(admin, { origin: "manual" })).toBe("operador");
    // Reposição e compra para estoque não têm porta.
    expect(demandChannel(admin, { origin: "replenishment" })).toBeNull();
    expect(
      demandChannel(operator as never, { origin: "manual", stock: true }),
    ).toBeNull();
  });

  it("carrinho: o que o saldo atende por inteiro é pronta entrega; o resto, encomenda", () => {
    const lines = [
      { id: "a", productId: "p1", quantity: 100 },
      { id: "b", productId: "p2", quantity: 50 },
      { id: "c", productId: "p1", quantity: 30 },
      { id: "d", productId: "p3", quantity: 10 },
    ];
    const { ready, order } = splitCart(
      lines,
      new Map([
        ["p1", 120],
        ["p2", 40],
      ]),
    );
    // p1: 100 cabe; os 30 seguintes não (sobram 20). p2: 50 > 40. p3: sem saldo.
    expect(ready.map((l) => l.id)).toEqual(["a"]);
    expect(order.map((l) => l.id)).toEqual(["b", "c", "d"]);
  });

  it("sem saldo conhecido (o portal ainda não controla o estoque), tudo é encomenda", () => {
    const { ready, order } = splitCart(
      [{ id: "a", productId: "p1", quantity: 1 }],
      new Map(),
    );
    expect(ready).toEqual([]);
    expect(order).toHaveLength(1);
  });
});

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const demand = await import("@/lib/services/purchase-demand");
const { canViewRequest } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let seller: User;
let joao: User;
let supplier: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  seller = by("vendas@wellmix.com");
  joao = by("joao@lojista.com");
  supplier = by("supplier.a@china.com");
});

const base = {
  customerId: "cliente-joao",
  productId: null,
  productName: "Copo térmico",
  description: "Encomenda",
  quantity: 500,
  unit: "un",
};

describe("encomenda pelas portas", () => {
  it("cliente cria para si; vendedor e operador em nome do cliente, com a porta gravada", async () => {
    const own = await requests.createRequest(joao, base);
    expect(own).toMatchObject({ origin: "manual", channel: "cliente" });
    const bySeller = await requests.createRequest(seller, {
      ...base,
      desiredAt: "2026-12-10T12:00:00.000Z",
    });
    expect(bySeller).toMatchObject({
      channel: "vendedor",
      desiredAt: "2026-12-10T12:00:00.000Z",
    });
    const byOperator = await requests.createRequest(operator, base);
    expect(byOperator.channel).toBe("operador");
    // Cliente não cria para outro cliente.
    await expect(
      requests.createRequest(joao, { ...base, customerId: "outro-cliente" }),
    ).rejects.toThrow();
  });

  it("operador sem a ação 'Lançar encomenda em nome do cliente' não lança", async () => {
    const noAction = { ...operator, functions: ["catalog"] } as User;
    await expect(requests.createRequest(noAction, base)).rejects.toThrow();
    // O administrador sempre pode.
    const byAdmin = await requests.createRequest(admin, base);
    expect(byAdmin.channel).toBe("operador");
  });

  it("o cliente só abre a própria encomenda", async () => {
    const mine = await requests.createRequest(joao, base);
    expect(canViewRequest(joao, mine)).toBe(true);
    const other = { ...joao, id: "outro-login", partyId: "outra-empresa" };
    expect(canViewRequest(other as User, mine)).toBe(false);
    expect(canViewRequest(supplier, mine)).toBe(false);
  });
});

describe("reposição aberta pelo Planner", () => {
  it("o Planner abre (produto, quantidade, data); vai para a compra da Wellmix e para a fila", async () => {
    const product = (await getStore().list("products", { limit: 1 }))[0];
    const created = await demand.openReplenishment(operator, {
      productId: product.id,
      quantity: 2400,
      desiredAt: "2027-01-15T12:00:00.000Z",
      notes: "Giro alto no Natal",
    });
    expect(created).toMatchObject({
      origin: "replenishment",
      status: "REQUESTED",
      quantity: 2400,
      desiredAt: "2027-01-15T12:00:00.000Z",
    });
    expect(created.customerId).toBe("wellmix-estoque");
    expect(created.channel ?? null).toBeNull();
    const queue = await demand.listDemands("replenishment");
    expect(queue.map((r) => r.id)).toContain(created.id);
  });

  it("sem a ação 'Abrir reposição' (vendedor, cliente), recusa", async () => {
    const product = (await getStore().list("products", { limit: 1 }))[0];
    const input = {
      productId: product.id,
      quantity: 10,
      desiredAt: null,
      notes: null,
    };
    await expect(demand.openReplenishment(seller, input)).rejects.toThrow();
    await expect(demand.openReplenishment(joao, input)).rejects.toThrow();
  });
});

describe("carrinho da vitrine: pronta entrega e encomenda", () => {
  it("item com saldo vira ordem de venda; item sem saldo vira encomenda pela vitrine", async () => {
    const store = getStore();
    const cart = await import("@/lib/services/cart");
    const { translator } = await import("@/i18n");
    const t = translator("pt");
    // Saldo: um container chegado com bonecas sem pedido (estoque livre).
    const container = await store.create("containers", {
      code: "CT-VITRINE",
      type: "40HC",
      capacityCbm: 68,
      maxWeightKg: null,
      customerId: null,
      status: "arrived",
      etd: null,
      eta: null,
      notes: null,
      createdByUserId: admin.id,
    } as never);
    await store.create("container_items", {
      containerId: container.id,
      orderId: null,
      orderItemId: null,
      productId: "prod-boneca",
      name: "Boneca",
      quantity: 5000,
      unit: "un",
      unitsPerBox: 10,
      boxCount: 500,
      cbmPerBox: 0.1,
      weightPerBoxKg: null,
    });
    await cart.addToCart(joao, "prod-boneca", 2000);
    await cart.addToCart(joao, "prod-panela", 700);
    // A prévia mostra o que cada item vira antes de confirmar.
    const view = await cart.cartView(joao);
    const preview = await cart.cartFulfilment(view.lines);
    expect(
      Object.fromEntries(
        view.lines.map((l) => [l.productId, preview.get(l.id)]),
      ),
    ).toEqual({ "prod-boneca": "ready", "prod-panela": "order" });
    const { requests: created, salesOrder } = await cart.checkoutCart(
      joao,
      { deadline: "2026-12-20", notes: null },
      t,
    );
    expect(salesOrder).toMatchObject({
      customerId: "cliente-joao",
      status: "draft",
      lines: [
        expect.objectContaining({ productId: "prod-boneca", quantity: 2000 }),
      ],
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      productId: "prod-panela",
      origin: "cart",
      channel: "vitrine",
      desiredAt: "2026-12-20T12:00:00.000Z",
    });
    expect((await cart.cartView(joao)).lines).toEqual([]);
  });
});
