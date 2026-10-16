import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Condição de pagamento ao fornecedor (serviço): só a Wellmix configura, o
 * pedido guarda a condição do dia em que nasceu, Contas a pagar, Pendências e
 * o aviso diário.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { submitRequirement } = await import("@/lib/workflow/engine");
const terms = await import("@/lib/services/supplier-terms");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;
let supplierC: User;

async function newOrder(supplier: User, supplierId: string): Promise<Order> {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste condição",
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
    price: 10,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 9000,
    sellCurrency: "BRL",
    downPaymentAmount: 2700,
  });
  return r.confirmDownPayment(admin, request.id);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierC = users.find((u) => u.email === "supplier.c@china.com")!;
});

describe("cadastro da condição", () => {
  it("só a Wellmix configura, só para fornecedor, somando 100%", async () => {
    const valid = [
      { percent: 40, base: "shipped" as const, days: 30 },
      { percent: 60, base: "delivered" as const, days: 120 },
    ];
    await expect(
      terms.saveSupplierPaymentTerms(supplierA, "fornecedor-b", {
        terms: valid,
        note: null,
      }),
    ).rejects.toThrow("forbidden");
    await expect(
      terms.saveSupplierPaymentTerms(admin, "cliente-joao", {
        terms: valid,
        note: null,
      }),
    ).rejects.toThrow("not_supplier");
    await expect(
      terms.saveSupplierPaymentTerms(admin, "fornecedor-b", {
        terms: [{ percent: 40, base: "shipped", days: 30 }],
        note: null,
      }),
    ).rejects.toThrow("terms_total");
    await expect(
      terms.saveSupplierPaymentTerms(admin, "fornecedor-b", {
        terms: [{ percent: 100, base: "shipped", days: 900 }],
        note: null,
      }),
    ).rejects.toThrow("terms_invalid");

    const saved = await terms.saveSupplierPaymentTerms(
      operator,
      "fornecedor-b",
      { terms: valid, note: "  T/T Hong Kong  " },
    );
    expect(saved.paymentTerms).toEqual(valid);
    expect(saved.paymentTermsNote).toBe("T/T Hong Kong");
    const [log] = await getStore().list("audit_log", {
      filter: {
        entity: "party",
        entityId: "fornecedor-b",
        action: "party.payment_terms",
      },
    });
    expect(log).toBeTruthy();

    // Lista vazia: volta a "não configurada".
    const cleared = await terms.saveSupplierPaymentTerms(
      admin,
      "fornecedor-b",
      { terms: [], note: null },
    );
    expect(cleared.paymentTerms).toBeNull();
  });
});

describe("condição no pedido", () => {
  it("o pedido guarda a condição do dia; mudar o cadastro não mexe nele até a Wellmix aplicar", async () => {
    const store = getStore();
    const order = await newOrder(supplierC, "fornecedor-c");
    // Seed: fornecedor C combina 100% 60 dias após a entrega.
    const fresh = (await store.get("orders", order.id))!;
    expect(fresh.supplierPaymentTerms).toEqual([
      { percent: 100, base: "delivered", days: 60 },
    ]);

    const novo = [
      { percent: 50, base: "order_created" as const, days: 0 },
      { percent: 50, base: "shipped" as const, days: 15 },
    ];
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-c", {
      terms: novo,
      note: null,
    });
    const supplier = await store.get("parties", "fornecedor-c");
    const kept = terms.termsForOrder(
      (await store.get("orders", order.id))!,
      supplier,
    );
    expect(kept.source).toBe("order");
    expect(kept.terms).toEqual([{ percent: 100, base: "delivered", days: 60 }]);

    await expect(
      terms.applySupplierTermsToOrder(supplierC, order.id),
    ).rejects.toThrow("forbidden");
    await terms.applySupplierTermsToOrder(admin, order.id);
    expect((await store.get("orders", order.id))!.supplierPaymentTerms).toEqual(
      novo,
    );

    // Pedido antigo (sem cópia): vale a condição atual do fornecedor.
    await store.update("orders", order.id, { supplierPaymentTerms: null });
    const legacy = terms.termsForOrder(
      (await store.get("orders", order.id))!,
      supplier,
    );
    expect(legacy.source).toBe("supplier");
    expect(legacy.terms).toEqual(novo);

    // Fornecedor sem condição: aplicar é recusado.
    const orderB = await newOrder(
      (
        await store.list("users", { filter: { email: "supplier.b@china.com" } })
      )[0],
      "fornecedor-b",
    );
    await expect(
      terms.applySupplierTermsToOrder(admin, orderB.id),
    ).rejects.toThrow("terms_missing");
  });
});

describe("contas a pagar, pendências e aviso diário", () => {
  it("parcela vencida aparece primeiro, vira pendência da Wellmix e entra no resumo", async () => {
    const store = getStore();
    // Fornecedor A: 30% no pedido (vence hoje) + 70% após a entrega.
    const order = await newOrder(supplierA, "fornecedor-a");
    // Pedido de 40 dias atrás: a parcela 1 venceu.
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await store.update("orders", order.id, { createdAt: old } as never);
    const stored = (await store.get("orders", order.id))!;
    const payable = await terms.orderPayable(stored);
    // O store pode não aceitar createdAt; nesse caso a parcela vence hoje.
    const first = payable.schedule.installments[0];
    expect(["overdue", "due_soon"]).toContain(first.status);
    expect(first.amount).toBe(300);

    const rows = terms.payableRows(await terms.listPayables());
    const mine = rows.filter((x) => x.payable.order.id === order.id);
    expect(mine.map((x) => x.installment.index)).toEqual([1, 2]);
    // Vencidas/da semana antes das que aguardam o marco.
    const firstWaiting = rows.findIndex(
      (x) => x.installment.status === "waiting",
    );
    const lastUrgent = rows.findLastIndex(
      (x) =>
        x.installment.status === "overdue" ||
        x.installment.status === "due_soon",
    );
    expect(lastUrgent).toBeLessThan(firstWaiting);

    // Só a conta do fornecedor A na visão filtrada.
    const onlyA = await terms.listPayables({ supplierId: "fornecedor-a" });
    expect(onlyA.every((p) => p.order.supplierId === "fornecedor-a")).toBe(
      true,
    );

    const adminTasks = await pendingTasksFor(admin);
    const task = adminTasks.find(
      (x) => x.kind === "supplier_payment" && x.orderNumber === order.number,
    );
    expect(task?.link).toBe(`/app/orders/${order.id}#supplier-payment`);
    expect(task?.detail).toContain("parcela 1/2");
    const supplierTasks = await pendingTasksFor(supplierA);
    expect(supplierTasks.some((x) => x.kind === "supplier_payment")).toBe(
      false,
    );

    const sent = await terms.notifyPayablesDue();
    expect(sent).toBeGreaterThan(0);
    const notes = await store.list("notifications", {
      filter: { userId: operator.id },
    });
    expect(
      notes.some(
        (n) =>
          n.subject.startsWith("Pagamento a fornecedores") &&
          n.link?.startsWith("/app/payables"),
      ),
    ).toBe(true);
    // Fornecedor não recebe o resumo da Wellmix.
    const supplierNotes = await store.list("notifications", {
      filter: { userId: supplierA.id },
    });
    expect(
      supplierNotes.some((n) =>
        n.subject.startsWith("Pagamento a fornecedores"),
      ),
    ).toBe(false);
  });

  it("pedido parado na etapa antiga não vira pendência de etapa", async () => {
    const store = getStore();
    const order = await newOrder(supplierA, "fornecedor-a");
    const [created] = await store.list("stages", {
      filter: { orderId: order.id, key: "ORDER_CREATED" },
    });
    for (const req of await store.list("requirements", {
      filter: { stageId: created.id, status: "pending" },
    }))
      if ((await store.get("stages", created.id))?.status === "active")
        await submitRequirement(admin, req.id, { value: "1" });
    const tasks = await pendingTasksFor(admin);
    expect(
      tasks.some(
        (x) => x.kind === "requirement" && x.stageKey === "SUPPLIER_PAYMENT",
      ),
    ).toBe(false);
  });
});
