import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Painel de Pedidos: todos os pedidos com a etapa, e as solicitações para a Wellmix. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { cancelOrder } = await import("@/lib/services/order-cancel");
const { pipelineFor } = await import("@/lib/services/pipeline");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

async function request(name: string) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

async function order(name: string) {
  const req = await request(name);
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  return r.confirmDownPayment(admin, req.id);
}

describe("painel de pedidos", () => {
  it("todos os pedidos com a etapa; cancelado mostra onde parou; solicitações para a Wellmix", async () => {
    const active = await order("Jarra ativa");
    const cancelled = await order("Jarra cancelada");
    await cancelOrder(admin, cancelled.id, {
      reason: "other",
      note: null,
      settlement: null,
    });
    const quoting = await request("Copo em cotação");
    await r.openRfq(admin, quoting.id, ["fornecedor-b"]);

    const rows = await pipelineFor(admin);
    const row = (key: string) => rows.find((x) => x.key === key);
    expect(row(`order:${active.id}`)).toMatchObject({
      kind: "order",
      phase: { kind: "stage", key: active.status },
      state: "active",
      customer: expect.any(String),
      supplier: "Shenzhen Supplier A",
    });
    const stopped = row(`order:${cancelled.id}`)!;
    expect(stopped.state).toBe("cancelled");
    expect(stopped.phase).toEqual({ kind: "stage", key: cancelled.status });
    expect(row(`request:${quoting.id}`)).toMatchObject({
      kind: "request",
      phase: { kind: "request", key: "RFQ_OPEN" },
      state: "active",
    });
    // Solicitação que virou pedido aparece pelo pedido, não duas vezes.
    expect(rows.some((x) => x.key === `request:${active.requestId}`)).toBe(
      false,
    );
    // Em andamento antes dos cancelados.
    const states = rows.map((x) => x.state);
    expect(states.indexOf("active")).toBeLessThan(
      states.lastIndexOf("cancelled"),
    );
  });

  it("cliente e fornecedor veem só os pedidos deles, sem solicitações nem nomes que não são deles", async () => {
    const forCustomer = await pipelineFor(joao);
    expect(forCustomer.length).toBeGreaterThan(0);
    expect(forCustomer.every((x) => x.kind === "order")).toBe(true);
    expect(forCustomer.every((x) => x.customer === null)).toBe(true);
    const forA = await pipelineFor(supplierA);
    expect(forA.every((x) => x.kind === "order" && x.supplier === null)).toBe(
      true,
    );
    expect(await pipelineFor(supplierB)).toEqual([]);
  });

  it("itens e grupo: cada produto com seus itens; o lote compartilha a chave da solicitação", async () => {
    const placed = await order("Prato com itens");
    const first = await request("Caneca do lote");
    const second = await request("Tigela do lote");
    for (const id of [first.id, second.id])
      await getStore().update("requests", id, { groupId: "lote-teste" });

    const rows = await pipelineFor(admin);
    const orderRow = rows.find((x) => x.key === `order:${placed.id}`)!;
    expect(orderRow.items).toEqual([
      expect.objectContaining({
        name: "Prato com itens",
        quantity: 1000,
        unit: "un",
        unitPrice: 2,
        currency: "USD",
      }),
    ]);
    // Pedido sem lote: o grupo é ele mesmo.
    expect(orderRow.groupKey).toBe(`order:${placed.id}`);
    const a = rows.find((x) => x.key === `request:${first.id}`)!;
    const b = rows.find((x) => x.key === `request:${second.id}`)!;
    expect(a.groupKey).toBe("group:lote-teste");
    expect(b.groupKey).toBe("group:lote-teste");
    expect(a.groupHref).toBe("/app/requests/batch/lote-teste");
    expect(a.items.map((i) => i.name)).toEqual(["Caneca do lote"]);

    // Fornecedor não vê preço (nem página do lote).
    const forA = await pipelineFor(supplierA);
    const mine = forA.find((x) => x.key === `order:${placed.id}`)!;
    expect(mine.items[0].unitPrice).toBeNull();
    expect(mine.groupHref).toBeNull();
  });
});
