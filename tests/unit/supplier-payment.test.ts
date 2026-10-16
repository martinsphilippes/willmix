import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Pagar o fornecedor: fora do fluxo das etapas, pela condição do cadastro do
 * fornecedor (parcelas), com dados para o banco e pedido ao financeiro.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const { submitRequirement } = await import("@/lib/workflow/engine");
const { supplierPaymentView, registerSupplierPayment } =
  await import("@/lib/services/supplier-payment");
const { confirmSupplierPaymentReceipt } =
  await import("@/lib/services/acknowledgements");
const { orderPayable, releaseOffFlowStages } =
  await import("@/lib/services/supplier-terms");
const { computeOrderFinance } = await import("@/lib/services/finance");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

/** Pedido (USD 2 × 100 = 200) depois da Preparação, com o fornecedor indicado. */
async function orderAfterPreparation(supplierId = "fornecedor-a") {
  const store = getStore();
  const supplier = supplierId === "fornecedor-a" ? supplierA : supplierB;
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
  await r.openRfq(admin, request.id, [supplierId]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplier, quote.id, {
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
  return (await store.get("orders", order.id))!;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
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

describe("pagamento ao fornecedor fora do fluxo", () => {
  it("o pedido não para no pagamento: a etapa conclui sozinha e copia a condição do fornecedor", async () => {
    const order = await orderAfterPreparation();
    expect(order.status).toBe("PACKAGING");
    const store = getStore();
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    expect(stage.status).toBe("done");
    // Seed: fornecedor A combina 30% no pedido + 70% 90 dias após a entrega.
    expect(order.supplierPaymentTerms).toEqual([
      { percent: 30, base: "order_created", days: 0 },
      { percent: 70, base: "delivered", days: 90 },
    ]);
  });

  it("valor a pagar é a parcela da vez, com a parcela na referência do banco", async () => {
    const order = await orderAfterPreparation();
    const view = await supplierPaymentView(order, "https://portal/x");
    expect(view.due).toBe(60);
    expect(view.installment?.index).toBe(1);
    expect(view.installment?.count).toBe(2);
    expect(view.currency).toBe("USD");
    expect(view.missingBank).toEqual([]);
    expect(view.transferText).toContain("Beneficiary: SHENZHEN SUPPLIER A LTD");
    expect(view.transferText).toContain("SWIFT: BKCHCNBJ");
    expect(view.transferText).toContain("Amount: USD 60.00");
    expect(view.transferText).toContain(
      `Reference: WELLMIX PO #${order.number} 1/2`,
    );
    expect(view.emailUrl).toMatch(
      /^mailto:financeiro%40wellmix\.com\.br\?subject=/,
    );
    expect(view.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511999998888\?text=/);
    expect(decodeURIComponent(view.whatsappUrl)).toContain("https://portal/x");
    expect(decodeURIComponent(view.whatsappUrl)).toContain("Parcela: 1/2");
  });

  it("ação rápida pede a parcela; clique duplo não paga a seguinte; o fornecedor confirma", async () => {
    const order = await orderAfterPreparation();
    await expect(
      registerSupplierPayment(supplierA, order.id, { method: "finance_email" }),
    ).rejects.toThrow("forbidden");

    const payment = await registerSupplierPayment(admin, order.id, {
      method: "finance_whatsapp",
      installment: 1,
    });
    expect(payment.amount).toBe(60);
    expect(payment.currency).toBe("USD");
    expect(payment.status).toBe("pending");
    expect(payment.note).toBe("Parcela 1/2");

    // O mesmo clique de novo (a tela ainda mostrava a parcela 1): recusado.
    await expect(
      registerSupplierPayment(admin, order.id, {
        method: "transfer_copied",
        installment: 1,
      }),
    ).rejects.toThrow("installment_changed");

    const after = await supplierPaymentView(order, "");
    expect(after.installment?.index).toBe(2);
    expect(after.due).toBe(140);
    const first = after.schedule.installments[0];
    expect(first.status).toBe("requested");
    // A entrega ainda não aconteceu: a parcela 2 aguarda o marco.
    expect(after.schedule.installments[1].status).toBe("waiting");
    expect(after.schedule.installments[1].dueDate).toBeNull();

    // Pedido (pendente) não conta como pago no financeiro.
    const store = getStore();
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

    // O fornecedor confirma o recebimento: a parcela fica recebida.
    await confirmSupplierPaymentReceipt(supplierA, payment.id);
    const confirmed = await orderPayable(order);
    expect(confirmed.schedule.installments[0].status).toBe("received");
    expect(confirmed.schedule.paid).toBe(60);
    expect(confirmed.schedule.open).toBe(140);
  });

  it("fornecedor sem condição: o valor a pagar é o saldo, sem parcelas", async () => {
    const order = await orderAfterPreparation("fornecedor-b");
    expect(order.status).toBe("PACKAGING");
    expect(order.supplierPaymentTerms ?? null).toBeNull();
    const view = await supplierPaymentView(order, "");
    expect(view.installment).toBeNull();
    expect(view.schedule.terms).toBeNull();
    expect(view.due).toBe(200);
    const payment = await registerSupplierPayment(admin, order.id, {
      method: "transfer_copied",
    });
    expect(payment.amount).toBe(200);
    expect(payment.note).toBeNull();
    await expect(
      registerSupplierPayment(admin, order.id, { method: "transfer_copied" }),
    ).rejects.toThrow("nothing_due");
  });

  it("pedido antigo parado na etapa (itens obrigatórios) segue para a embalagem", async () => {
    const store = getStore();
    const order = await orderAfterPreparation();
    // Simula um pedido de antes: etapa de pagamento ativa com os dois itens.
    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const pay = stages.find((s) => s.key === "SUPPLIER_PAYMENT")!;
    const pack = stages.find((s) => s.key === "PACKAGING")!;
    await store.update("stages", pack.id, {
      status: "pending",
      startedAt: null,
    });
    await store.update("stages", pay.id, {
      status: "active",
      completedAt: null,
      percent: 0,
    });
    for (const key of ["payment_registered", "payment_received"])
      await store.create("requirements", {
        orderId: order.id,
        stageId: pay.id,
        key,
        label: key,
        type: "confirm",
        required: true,
        role: key === "payment_received" ? "supplier" : "operator",
        status: "pending",
        value: null,
        documentId: null,
        submittedByUserId: null,
        submittedAt: null,
        note: null,
      });
    await store.update("orders", order.id, {
      status: "SUPPLIER_PAYMENT",
      currentStageId: pay.id,
    });

    expect(await releaseOffFlowStages(order.id)).toBe(1);
    expect((await store.get("stages", pay.id))!.status).toBe("done");
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    // Idempotente: nada mais a liberar.
    expect(await releaseOffFlowStages(order.id)).toBe(0);
  });
});
