import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const {
  createRequest,
  openRfq,
  answerQuote,
  selectQuote,
  confirmDownPayment,
  getRequestForUser,
} = await import("@/lib/services/requests");
const {
  canViewOrder,
  canViewQuote,
  canSeeInternalCosts,
  canSeeSupplier,
  canSeeSellPrice,
} = await import("@/lib/auth/permissions");
const { canAccessDocument } = await import("@/lib/services/documents");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let users: User[] = [];
const by = (role: string, party: string | null = null) =>
  users.find(
    (u) => u.role === role && (party === null || u.partyId === party),
  )!;

beforeAll(async () => {
  users = (await seedDemo()).users;
});

describe("isolamento entre papéis", () => {
  it("cliente não vê solicitação de outro cliente; fornecedor não vê cotação de outro", async () => {
    const store = getStore();
    const customer = by("customer", "cliente-joao");
    const operator = by("operator");
    const otherCustomerParty = await store.create("parties", {
      type: "customer",
      name: "Outra Loja",
      country: "BR",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    });
    const otherCustomer = await store.create("users", {
      email: "outra@loja.com",
      name: "Outra",
      role: "customer",
      partyId: otherCustomerParty.id,
      locale: "pt",
      passwordHash: null,
      active: true,
    });

    const request = await createRequest(customer, {
      customerId: "cliente-joao",
      productId: "prod-boneca",
      productName: "Boneca",
      description: "Boneca 30 cm",
      quantity: 500,
      unit: "un",
    });
    // cliente não cria em nome de outro
    await expect(
      createRequest(customer, {
        customerId: otherCustomerParty.id,
        productName: "x",
        description: "xx",
        quantity: 1,
        unit: "un",
      }),
    ).rejects.toThrow();

    expect(await getRequestForUser(otherCustomer, request.id)).toBeNull();
    expect(await getRequestForUser(customer, request.id)).not.toBeNull();
    expect(await getRequestForUser(operator, request.id)).not.toBeNull();

    await openRfq(operator, request.id, ["fornecedor-a", "fornecedor-b"]);
    const [quoteA] = await store.list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-a" },
    });
    expect(canViewQuote(by("supplier", "fornecedor-a"), quoteA)).toBe(true);
    expect(canViewQuote(by("supplier", "fornecedor-b"), quoteA)).toBe(false);
    expect(canViewQuote(by("supplier", "fornecedor-c"), quoteA)).toBe(false);
    // fornecedor C (não convidado) não tem pendência de cotação
    expect(
      (await pendingTasksFor(by("supplier", "fornecedor-c"))).filter(
        (t) => t.kind === "quote",
      ),
    ).toHaveLength(0);

    await answerQuote(by("supplier", "fornecedor-a"), quoteA.id, {
      price: 3,
      currency: "USD",
      leadTimeDays: 20,
    });
    // fornecedor não seleciona cotação
    await expect(
      selectQuote(by("supplier", "fornecedor-a"), quoteA.id, {
        sellPrice: 100,
        sellCurrency: "BRL",
      }),
    ).rejects.toThrow();
    await selectQuote(operator, quoteA.id, {
      sellPrice: 9000,
      sellCurrency: "BRL",
    });
    // cliente não confirma o próprio sinal (modo manual é da Wellmix)
    await expect(confirmDownPayment(customer, request.id)).rejects.toThrow();
    const order = await confirmDownPayment(operator, request.id);

    // visibilidade do pedido
    expect(canViewOrder(customer, order)).toBe(true);
    expect(canViewOrder(otherCustomer, order)).toBe(false);
    expect(canViewOrder(by("supplier", "fornecedor-a"), order)).toBe(true);
    expect(canViewOrder(by("supplier", "fornecedor-b"), order)).toBe(false);
    expect(canViewOrder(by("agency", "agencia"), order)).toBe(true);
    expect(canViewOrder(by("legal"), order)).toBe(true);

    // campos sensíveis
    expect(canSeeSupplier(customer)).toBe(false);
    expect(canSeeInternalCosts(customer)).toBe(false);
    expect(canSeeInternalCosts(by("supplier", "fornecedor-a"))).toBe(false);
    expect(canSeeSellPrice(by("supplier", "fornecedor-a"))).toBe(false);
    expect(canSeeSellPrice(customer)).toBe(true);
    expect(canSeeInternalCosts(operator)).toBe(true);

    // documentos: comprovante interno não é visível ao cliente nem ao fornecedor
    const proof = await store.create("documents", {
      orderId: order.id,
      requestId: null,
      requirementId: null,
      type: "proof",
      name: "comprovante.pdf",
      mime: "application/pdf",
      size: 1,
      storageKey: "k",
      version: 1,
      previousDocumentId: null,
      uploadedByUserId: operator.id,
      visibility: "internal",
    });
    expect(await canAccessDocument(customer, proof)).toBe(false);
    expect(await canAccessDocument(by("supplier", "fornecedor-a"), proof)).toBe(
      false,
    );
    expect(await canAccessDocument(operator, proof)).toBe(true);
    const bl = await store.create("documents", {
      ...proof,
      id: undefined as never,
      type: "bl",
      visibility: "all",
    } as never);
    expect(await canAccessDocument(customer, bl)).toBe(true);
    expect(await canAccessDocument(by("supplier", "fornecedor-b"), bl)).toBe(
      false,
    );
  });
});
