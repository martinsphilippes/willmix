import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Painel de Pedidos: todos os pedidos com a etapa, e as solicitações para a Wellmix. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { cancelOrder } = await import("@/lib/services/order-cancel");
const { pipelineFor, loadPipelineItems } =
  await import("@/lib/services/pipeline");
const { rebuildOrderSummaries } = await import("@/lib/services/order-summary");
type User = import("@/lib/db").User;
type PipelineRow = import("@/lib/services/pipeline").PipelineRow;

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

async function request(
  name: string,
  extra: { productId?: string; specification?: string } = {},
) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: extra.productId ?? null,
    productName: name,
    description: name,
    specification: extra.specification ?? null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

async function order(
  name: string,
  extra: { productId?: string; specification?: string } = {},
) {
  const req = await request(name, extra);
  return orderFromRequest(admin, req, { downPaymentAmount: 300 });
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
    const open = await request("Copo aberto");

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
    expect(row(`request:${open.id}`)).toMatchObject({
      kind: "request",
      phase: { kind: "request", key: "REQUESTED" },
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
  it("produto, variação e especificação do item (foto, caixas, volume na tela) só para a Wellmix", async () => {
    const placed = await order("Panelas com tampa", {
      productId: "prod-panela",
      specification: "Com tampa de vidro",
    });
    const forAdmin = (await pipelineFor(admin)).find(
      (x) => x.key === `order:${placed.id}`,
    )!;
    expect(forAdmin.items[0]).toMatchObject({
      productId: "prod-panela",
      specification: "Com tampa de vidro",
    });
    // Fornecedor e cliente não recebem esses dados (nem o preço).
    for (const user of [supplierA, joao]) {
      const row = (await pipelineFor(user)).find(
        (x) => x.key === `order:${placed.id}`,
      )!;
      expect(row.items[0]).toMatchObject({
        productId: null,
        variantData: null,
        specification: null,
        unitPrice: null,
      });
    }
  });
  it("progresso pela viagem: o mesmo passo dos quadrados da Control Tower", async () => {
    const placed = await order("Prato da viagem");
    const fresh = await request("Garfo novo");
    const stopped = await order("Prato cancelado na viagem");
    await cancelOrder(admin, stopped.id, {
      reason: "other",
      note: null,
      settlement: null,
    });

    const rows = await pipelineFor(admin);
    const step = (key: string) => rows.find((x) => x.key === key)?.journey;
    expect(step(`order:${placed.id}`)).toBe("ordCreated");
    expect(step(`request:${fresh.id}`)).toBe("reqNew");
    // Cancelado: o passo em que parou (a etapa guardada no cancelamento).
    expect(step(`order:${stopped.id}`)).toBe("ordCreated");
    // O cliente vê o passo dos pedidos dele.
    const mine = await pipelineFor(joao);
    expect(mine.find((x) => x.key === `order:${placed.id}`)?.journey).toBe(
      "ordCreated",
    );
  });
});

/*
 * Auditoria de performance (14/11/2026): com o resumo por pedido em uso, a
 * tela Pedidos não lê mais os itens de todos os pedidos (184 mil em produção)
 * a cada abertura. O painel vem com o 1º produto e a quantidade de itens do
 * resumo, e a tela lê os itens só onde precisa: nome e variação de todos para
 * o filtro de produto, e o item inteiro só nas linhas da página. O resultado
 * é o mesmo do painel com todos os itens.
 */
describe("painel de pedidos sem ler todos os itens", () => {
  /** A linha sem os campos de controle da leitura adiada. */
  const plain = (row: PipelineRow) => {
    const { itemsPending: _pending, ...rest } = row;
    void _pending;
    return rest;
  };

  it("com o resumo em uso: 1º produto e quantos itens do resumo; os itens lidos depois são os mesmos", async () => {
    const one = await order("Bule lento");
    const two = await order("Xícara lenta");
    // Um pedido com dois itens e variação.
    await getStore().create("order_items", {
      orderId: two.id,
      productId: null,
      name: "Pires da xícara",
      variant: { name: "Azul" } as never,
      quantity: 500,
      unit: "un",
      unitPrice: 1.5,
    } as never);
    await rebuildOrderSummaries();
    for (const user of [admin, joao, supplierA]) {
      const full = await pipelineFor(user);
      const lazy = await pipelineFor(user, { lazyItems: true });
      expect(lazy.map((x) => x.key)).toEqual(full.map((x) => x.key));
      for (const id of [one.id, two.id]) {
        const f = full.find((x) => x.key === `order:${id}`);
        const l = lazy.find((x) => x.key === `order:${id}`);
        if (!f) {
          expect(l).toBeUndefined();
          continue;
        }
        expect(l!.itemsPending).toBe(true);
        expect(l!.items).toEqual([]);
        expect(l!.product).toBe(f.product);
        expect(l!.itemCount).toBe(f.items.length);
      }
      expect(full.find((x) => x.key === `order:${two.id}`)?.itemCount).toBe(
        full.find((x) => x.key === `order:${two.id}`) ? 2 : undefined,
      );
      // Filtro de produto: nome e variação de todos os itens.
      const names = await pipelineFor(user, { lazyItems: true });
      await loadPipelineItems(user, names, "names");
      expect(
        names.map((x) => x.items.map((i) => `${i.name}|${i.variant ?? ""}`)),
      ).toEqual(
        full.map((x) => x.items.map((i) => `${i.name}|${i.variant ?? ""}`)),
      );
      // Linhas da página: o item inteiro, igual ao painel com todos os itens.
      await loadPipelineItems(user, lazy, "full");
      expect(lazy.map(plain)).toEqual(full.map(plain));
    }
  });

  it("sem o resumo em uso, lê os itens como antes", async () => {
    const store = getStore();
    const placed = await order("Prato sem resumo");
    const [marker] = await store.list("settings", {
      filter: { key: "orderSummaries" },
    });
    await store.remove("settings", marker.id);
    try {
      const rows = await pipelineFor(admin, { lazyItems: true });
      const row = rows.find((x) => x.key === `order:${placed.id}`)!;
      expect(row.itemsPending).toBeUndefined();
      expect(row.items.map((i) => i.name)).toEqual(["Prato sem resumo"]);
      expect(row.itemCount).toBe(1);
    } finally {
      await store.create("settings", {
        id: marker.id,
        key: marker.key,
        value: marker.value,
      });
    }
  });
});
