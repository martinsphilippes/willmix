import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Visibilidade por login do cliente: cada login vê só as solicitações e os
 * pedidos que solicitou (ou que a Wellmix abriu em nome dele); outro login da
 * mesma empresa não vê nada deles.
 */
withTempStore();

const { getStore, USER_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const {
  createRequest,
  openRfq,
  answerQuote,
  selectQuote,
  confirmDownPayment,
  setRequester,
  getRequestForUser,
} = await import("@/lib/services/requests");
const { canViewOrder, canViewRequest } = await import("@/lib/auth/permissions");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { loadCommercialHistory } = await import("@/lib/services/history");
const { customerOrdersInProgress } =
  await import("@/lib/services/customer-home");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let maria: User;
let supplier: User;

async function fullOrder(creator: User, requestedForUserId?: string | null) {
  const store = getStore();
  const request = await createRequest(creator, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste de acesso",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
    requestedForUserId,
  });
  await openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await answerQuote(supplier, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  const order = await confirmDownPayment(admin, request.id);
  return {
    request: (await store.get("requests", request.id))!,
    order: (await store.get("orders", order.id))!,
  };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  // Segundo login da mesma empresa (Loja do João).
  maria = await getStore().create("users", {
    ...USER_EXTRA_DEFAULTS,
    email: "maria@lojista.com",
    name: "Maria (Loja do João)",
    role: "customer",
    partyId: "cliente-joao",
    locale: "pt",
    passwordHash: null,
    active: true,
  });
});

describe("cada login do cliente vê só os próprios pedidos", () => {
  it("pedido do João: João vê; Maria (mesma empresa) não vê", async () => {
    const { request, order } = await fullOrder(joao);
    expect(request.requestedForUserId).toBe(joao.id);
    expect(order.requestedByUserId).toBe(joao.id);
    expect(canViewOrder(joao, order)).toBe(true);
    expect(canViewRequest(joao, request)).toBe(true);
    expect(canViewOrder(maria, order)).toBe(false);
    expect(canViewRequest(maria, request)).toBe(false);
    expect(await getRequestForUser(maria, request.id)).toBeNull();
    // Pendências e histórico da Maria não mostram nada do pedido do João.
    const mariaTasks = await pendingTasksFor(maria);
    expect(
      mariaTasks.some(
        (t) => t.link.includes(order.id) || t.link.includes(request.id),
      ),
    ).toBe(false);
    expect(await loadCommercialHistory(maria)).toEqual([]);
    expect((await loadCommercialHistory(joao)).length).toBeGreaterThan(0);
    // Notificações do pedido foram só para o João.
    const notes = await getStore().list("notifications", {
      filter: { userId: maria.id },
    });
    expect(notes).toEqual([]);
  });

  it("pedido aberto pela Wellmix sem solicitante: nenhum login do cliente vê; ao indicar a Maria, só ela vê", async () => {
    const { request, order } = await fullOrder(admin);
    expect(order.requestedByUserId).toBeNull();
    expect(canViewOrder(joao, order)).toBe(false);
    expect(canViewOrder(maria, order)).toBe(false);
    expect(canViewOrder(admin, order)).toBe(true);
    await setRequester(admin, request.id, maria.id);
    const store = getStore();
    const updated = (await store.get("orders", order.id))!;
    expect(canViewOrder(maria, updated)).toBe(true);
    expect(canViewOrder(joao, updated)).toBe(false);
    expect(
      canViewRequest(maria, (await store.get("requests", request.id))!),
    ).toBe(true);
  });

  it("Wellmix já indica o solicitante na criação; login de outra empresa é recusado", async () => {
    const { order } = await fullOrder(admin, joao.id);
    expect(order.requestedByUserId).toBe(joao.id);
    await expect(
      createRequest(admin, {
        customerId: "cliente-joao",
        productName: "X",
        description: "Y",
        quantity: 1,
        unit: "un",
        requestedForUserId: supplier.id,
      }),
    ).rejects.toThrow("invalid_requester");
    await expect(
      setRequester(joao, order.requestId, joao.id),
    ).rejects.toThrow();
  });
});

describe("início do cliente (Solicitações)", () => {
  it("pedidos em andamento: só os do login, sem os encerrados, sem dados de fornecedor", async () => {
    const { order } = await fullOrder(joao);
    const mine = await customerOrdersInProgress(joao);
    const row = mine.find((o) => o.order.id === order.id)!;
    expect(row).toBeTruthy();
    expect(row.stageKey).toBe(order.status);
    expect(row.productName).toBeTruthy();
    expect(row.eta).toBeNull();
    expect(Object.keys(row)).not.toContain("supplierId");
    // Maria (mesma empresa) não vê; Wellmix e fornecedor não usam esta lista.
    expect(
      (await customerOrdersInProgress(maria)).some(
        (o) => o.order.id === order.id,
      ),
    ).toBe(false);
    expect(await customerOrdersInProgress(admin)).toEqual([]);
    expect(await customerOrdersInProgress(supplier)).toEqual([]);
    // Encerrado sai da lista.
    await getStore().update("orders", order.id, { status: "CLOSED" });
    expect(
      (await customerOrdersInProgress(joao)).some(
        (o) => o.order.id === order.id,
      ),
    ).toBe(false);
  });
});
