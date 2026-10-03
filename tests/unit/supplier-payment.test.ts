import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Pagar o fornecedor: valor devido, dados para o banco, pedido ao financeiro. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const { submitRequirement } = await import("@/lib/workflow/engine");
const { supplierPaymentView, registerSupplierPayment } =
  await import("@/lib/services/supplier-payment");
const { computeOrderFinance } = await import("@/lib/services/finance");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

/** Pedido com fornecedor A (USD 2 × 100 = 200), parado no pagamento ao fornecedor. */
async function orderAtSupplierPayment() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste pagamento",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
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
  const order = await r.confirmDownPayment(admin, request.id);
  // Avança Pedido criado e Preparação.
  for (const key of ["ORDER_CREATED", "PREPARATION"]) {
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: key as never },
    });
    for (const req of await store.list("requirements", {
      filter: { stageId: stage.id, status: "pending" },
    })) {
      if ((await store.get("stages", stage.id))?.status !== "active") break;
      await submitRequirement(admin, req.id, { value: "1" });
    }
  }
  const fresh = (await store.get("orders", order.id))!;
  expect(fresh.status).toBe("SUPPLIER_PAYMENT");
  return fresh;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  await getStore().update("parties", "fornecedor-a", {
    bankBeneficiary: "SHENZHEN SUPPLIER A LTD",
    bankName: "Bank of China",
    bankAccount: "6217 0000 1234",
    bankSwift: "BKCHCNBJ",
    bankAddress: null,
  });
  await setSetting("financeEmail", "financeiro@wellmix.com.br");
  await setSetting("financeWhatsapp", "5511999998888");
});

describe("pagar o fornecedor", () => {
  it("valor devido, dados para o banco e links para o financeiro", async () => {
    const order = await orderAtSupplierPayment();
    const view = await supplierPaymentView(order, "https://portal/x");
    expect(view.due).toBe(200);
    expect(view.currency).toBe("USD");
    expect(view.missingBank).toEqual([]);
    expect(view.transferText).toContain("Beneficiary: SHENZHEN SUPPLIER A LTD");
    expect(view.transferText).toContain("SWIFT: BKCHCNBJ");
    expect(view.transferText).toContain("Amount: USD 200.00");
    expect(view.transferText).toContain(
      `Reference: WELLMIX PO #${order.number}`,
    );
    expect(view.emailUrl).toMatch(
      /^mailto:financeiro%40wellmix\.com\.br\?subject=/,
    );
    expect(view.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(view.whatsappUrl)).toContain("https://portal/x");
  });

  it("ação rápida registra pendente, conclui o item e não conta como pago até o fornecedor confirmar", async () => {
    const order = await orderAtSupplierPayment();
    await expect(
      registerSupplierPayment(supplierA, order.id, { method: "finance_email" }),
    ).rejects.toThrow("forbidden");

    const payment = await registerSupplierPayment(admin, order.id, {
      method: "finance_whatsapp",
    });
    expect(payment.amount).toBe(200);
    expect(payment.currency).toBe("USD");
    expect(payment.status).toBe("pending");
    expect(payment.method).toMatch(/WhatsApp/);

    const store = getStore();
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    const [registered] = await store.list("requirements", {
      filter: { stageId: stage.id, key: "payment_registered" },
    });
    expect(registered.status).toBe("done");
    const view = await supplierPaymentView(order, "");
    expect(view.registered).toBe(true);
    expect(view.due).toBe(0);
    // Nada mais a pagar: nova ação rápida é recusada.
    await expect(
      registerSupplierPayment(admin, order.id, { method: "transfer_copied" }),
    ).rejects.toThrow("nothing_due");
    // Pendente não conta como pago na conta corrente.
    const payments = await store.list("payments", {
      filter: { orderId: order.id },
    });
    const finance = computeOrderFinance(order, payments, {
      customer: "c",
      supplier: "s",
      product: "p",
    });
    expect(finance.paid).toBe(0);
    expect(finance.payable).toBe(200);
  });

  it("o fornecedor confirmar o recebimento conclui a etapa mesmo sem registro da Wellmix", async () => {
    const order = await orderAtSupplierPayment();
    const store = getStore();
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    const [received] = await store.list("requirements", {
      filter: { stageId: stage.id, key: "payment_received" },
    });
    await submitRequirement(supplierA, received.id, { value: "ok" });
    const [registered] = await store.list("requirements", {
      filter: { stageId: stage.id, key: "payment_registered" },
    });
    expect(registered.status).toBe("done");
    expect(registered.value).toBe("supplier_confirmed");
    expect((await store.get("stages", stage.id))!.status).toBe("done");
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    // A Wellmix ainda registra o pagamento depois, para a conta corrente.
    const payment = await registerSupplierPayment(admin, order.id, {
      method: "transfer_copied",
    });
    expect(payment.amount).toBe(200);
  });
});
