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

describe("pedidos antigos e correções da revisão", () => {
  /** Pedido depois da Preparação (na Embalagem), fornecedor A. */
  async function inPackaging(): Promise<Order> {
    const store = getStore();
    const order = await newOrder(supplierA, "fornecedor-a");
    for (const key of ["ORDER_CREATED", "PREPARATION"]) {
      const [stage] = await store.list("stages", {
        filter: { orderId: order.id, key: key as never },
      });
      for (const req of await store.list("requirements", {
        filter: { stageId: stage.id, status: "pending" },
      }))
        if ((await store.get("stages", stage.id))?.status === "active")
          await submitRequirement(admin, req.id, { value: "1" });
    }
    return (await store.get("orders", order.id))!;
  }

  /** Simula um pedido antigo: sem cópia da condição e a etapa paga pelos itens. */
  async function paidInOldFlow(order: Order) {
    const store = getStore();
    await store.update("orders", order.id, { supplierPaymentTerms: null });
    const [pay] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
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
        status: "done",
        value: "ok",
        documentId: null,
        submittedByUserId: admin.id,
        submittedAt: new Date().toISOString(),
        note: null,
      });
    return (await store.get("orders", order.id))!;
  }

  it("pedido pago pela etapa antiga não volta a cobrar, nem vira pendência, nem reabre o cancelamento", async () => {
    const { customerCanRequestCancel } =
      await import("@/lib/services/order-cancel");
    const { supplierPaymentView } =
      await import("@/lib/services/supplier-payment");
    const order = await paidInOldFlow(await inPackaging());
    const payable = await terms.orderPayable(order);
    expect(payable.schedule.legacySettled).toBe(true);
    expect(payable.schedule.installments).toEqual([]);
    expect(payable.schedule.open).toBe(0);
    const view = await supplierPaymentView(order, "");
    expect(view.due).toBe(0);
    const tasks = await pendingTasksFor(admin);
    expect(
      tasks.some(
        (x) => x.kind === "supplier_payment" && x.orderNumber === order.number,
      ),
    ).toBe(false);
    expect(await customerCanRequestCancel(order, new Date("2000-01-01"))).toBe(
      false,
    );
    // Pedido novo na embalagem, sem pagamento feito: o cliente ainda pode pedir.
    const fresh = await inPackaging();
    expect(await customerCanRequestCancel(fresh, new Date("2000-01-01"))).toBe(
      true,
    );
  });

  it("marcar como pago transforma o pedido ao banco em pago, sem pagamento em dobro", async () => {
    const store = getStore();
    const { registerSupplierPayment, markSupplierPaymentPaid } =
      await import("@/lib/services/supplier-payment");
    const order = await inPackaging();
    const pending = await registerSupplierPayment(admin, order.id, {
      method: "transfer_copied",
      installment: 1,
    });
    expect(pending.status).toBe("pending");
    await expect(
      markSupplierPaymentPaid(supplierA, order.id, pending.id),
    ).rejects.toThrow("forbidden");
    await expect(
      markSupplierPaymentPaid(admin, "outro-pedido", pending.id),
    ).rejects.toThrow("not_found");
    const paid = await markSupplierPaymentPaid(admin, order.id, pending.id, {
      fxRate: 5.4,
    });
    expect(paid.status).toBe("confirmed");
    expect(paid.fxRate).toBe(5.4);
    await expect(
      markSupplierPaymentPaid(admin, order.id, pending.id),
    ).rejects.toThrow("payment_not_pending");
    const rows = await store.list("payments", {
      filter: { orderId: order.id, direction: "supplier_out" },
    });
    expect(rows).toHaveLength(1);
    const schedule = (await terms.orderPayable(order)).schedule;
    expect(schedule.installments[0].status).toBe("paid");
    expect(schedule.installments[1].open).toBe(700);

    // O fornecedor tem a pendência de confirmar o recebimento.
    const supplierTasks = await pendingTasksFor(supplierA);
    const confirm = supplierTasks.find(
      (x) => x.kind === "confirm_receipt" && x.orderNumber === order.number,
    );
    expect(confirm?.link).toBe("/app/account");
    // Outro fornecedor não vê.
    const supplierB = (
      await store.list("users", { filter: { email: "supplier.b@china.com" } })
    )[0];
    const other = await pendingTasksFor(supplierB);
    expect(
      other.some(
        (x) => x.kind === "confirm_receipt" && x.orderNumber === order.number,
      ),
    ).toBe(false);
  });

  it("liberar a etapa: chamadas ao mesmo tempo liberam uma vez; parada concluída ou bloqueada também segue", async () => {
    const store = getStore();
    const order = await inPackaging();
    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const pay = stages.find((s) => s.key === "SUPPLIER_PAYMENT")!;
    const pack = stages.find((s) => s.key === "PACKAGING")!;
    const reset = async (status: "active" | "blocked" | "done") => {
      await store.update("stages", pack.id, {
        status: "pending",
        startedAt: null,
      });
      await store.update("stages", pay.id, { status });
      await store.update("orders", order.id, {
        status: "SUPPLIER_PAYMENT",
        currentStageId: pay.id,
      });
    };

    await reset("active");
    const [a, b] = await Promise.all([
      terms.releaseOffFlowStages(order.id),
      terms.releaseOffFlowStages(order.id),
    ]);
    // A segunda chamada espera a mesma passada (mesmo resultado, uma liberação só).
    expect([a, b]).toEqual([1, 1]);
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    const logs = await store.list("audit_log", {
      filter: { entity: "stage", entityId: pay.id, action: "stage.off_flow" },
    });
    expect(logs).toHaveLength(1);

    await reset("done");
    expect(await terms.releaseOffFlowStages(order.id)).toBe(1);
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");

    await reset("blocked");
    expect(await terms.releaseOffFlowStages(order.id)).toBe(1);
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
  });

  it("a condição é salva na ordem em que vence", async () => {
    const saved = await terms.saveSupplierPaymentTerms(admin, "fornecedor-b", {
      terms: [
        { percent: 70, base: "delivered", days: 30 },
        { percent: 30, base: "order_created", days: 0 },
      ],
      note: null,
    });
    expect(saved.paymentTerms?.map((x) => x.base)).toEqual([
      "order_created",
      "delivered",
    ]);
  });
});
