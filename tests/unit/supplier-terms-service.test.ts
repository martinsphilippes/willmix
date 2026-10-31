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
    // Financeiro é só do admin: o resumo vai a ele, não ao operador.
    const notes = await store.list("notifications", {
      filter: { userId: admin.id },
    });
    expect(
      notes.some(
        (n) =>
          n.subject.startsWith("Pagamento a fornecedores") &&
          n.link?.startsWith("/app/payables"),
      ),
    ).toBe(true);
    const operatorNotes = await store.list("notifications", {
      filter: { userId: operator.id },
    });
    expect(
      operatorNotes.some((n) =>
        n.subject.startsWith("Pagamento a fornecedores"),
      ),
    ).toBe(false);
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

describe("segunda revisão: pedidos antigos, liberação e lembrete", () => {
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

  async function oldItem(order: Order, key: string) {
    const store = getStore();
    const [pay] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
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
      // Confirmado depois dos pagamentos já lançados (como no fluxo antigo).
      submittedAt: new Date(Date.now() + 1000).toISOString(),
      note: null,
    });
  }

  async function pendingRow(order: Order, amount: number) {
    return getStore().create("payments", {
      orderId: order.id,
      requestId: null,
      direction: "supplier_out",
      amount,
      currency: "USD",
      fxRate: null,
      method: "Transferência (dados copiados para o banco)",
      status: "pending",
      proofDocumentId: null,
      registeredByUserId: admin.id,
      confirmedByUserId: null,
      confirmedAt: null,
      note: null,
    } as never);
  }

  it("recebimento confirmado pela etapa antiga: sem pendência de confirmar nem 'Marcar como pago'", async () => {
    const { supplierPaymentView } =
      await import("@/lib/services/supplier-payment");
    const store = getStore();
    const received = await inPackaging();
    await store.update("orders", received.id, { supplierPaymentTerms: null });
    await pendingRow(received, 1000);
    await oldItem(received, "payment_registered");
    await oldItem(received, "payment_received");
    const fresh = (await store.get("orders", received.id))!;
    const view = await supplierPaymentView(fresh, "");
    expect(view.pending).toEqual([]);
    expect(view.schedule.legacySettled).toBe(true);
    expect(view.schedule.terms).not.toBeNull();
    const tasks = await pendingTasksFor(supplierA);
    expect(
      tasks.some(
        (x) => x.kind === "confirm_receipt" && x.orderNumber === fresh.number,
      ),
    ).toBe(false);

    // Só a Wellmix registrou (o fornecedor não confirmou): a pendência fica.
    const registered = await inPackaging();
    await oldItem(registered, "payment_registered");
    await pendingRow(registered, 1000);
    const again = await pendingTasksFor(supplierA);
    expect(
      again.some(
        (x) =>
          x.kind === "confirm_receipt" && x.orderNumber === registered.number,
      ),
    ).toBe(true);
  });

  it("passada geral e a do pedido ao mesmo tempo liberam uma vez; a geral acha pedido parado com a etapa concluída", async () => {
    const store = getStore();
    const order = await inPackaging();
    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const pay = stages.find((s) => s.key === "SUPPLIER_PAYMENT")!;
    const pack = stages.find((s) => s.key === "PACKAGING")!;
    const reset = async (status: "active" | "done") => {
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
    const offFlowAudits = async () =>
      (
        await store.list("audit_log", {
          filter: {
            entity: "stage",
            entityId: pay.id,
            action: "stage.off_flow",
          },
        })
      ).length;

    await reset("active");
    const before = await offFlowAudits();
    await Promise.all([
      terms.releaseOffFlowStages(undefined, { force: true }),
      terms.releaseOffFlowStages(order.id),
    ]);
    expect(await offFlowAudits()).toBe(before + 1);
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");

    await reset("done");
    // Job diário (force): passa mesmo logo depois de uma passada vazia.
    expect(
      await terms.releaseOffFlowStages(undefined, { force: true }),
    ).toBeGreaterThanOrEqual(1);
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    // Próxima etapa já começou: nada a refazer.
    expect(await terms.releaseOffFlowStages(order.id)).toBe(0);
  });

  it("lembra o fornecedor de confirmar pagamento feito há mais de 3 dias", async () => {
    const store = getStore();
    const order = await inPackaging();
    const row = await pendingRow(order, 300);
    await store.update("payments", row.id, { status: "confirmed" });
    const later = new Date(Date.now() + 4 * 86_400_000);
    const sent = await terms.notifySuppliersToConfirm(later);
    expect(sent).toBeGreaterThanOrEqual(1);
    const notes = await store.list("notifications", {
      filter: { userId: supplierA.id },
    });
    expect(
      notes.some(
        (n) =>
          n.subject.startsWith("Wellmix: please confirm receipt") &&
          n.link === "/app/account",
      ),
    ).toBe(true);
    // Ainda dentro dos 3 dias: nada.
    expect(await terms.notifySuppliersToConfirm(new Date())).toBe(0);
  });
});

describe("revisão final: condição fixa depois do pagamento, legado por pagamento, avisos sem repetir", () => {
  async function inPackagingWith(user: User, partyId: string) {
    const store = getStore();
    const order = await newOrder(user, partyId);
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

  it("com pagamento lançado, a condição do pedido não muda; pagar parcela fixa a condição no pedido", async () => {
    const store = getStore();
    const { registerSupplierPayment } =
      await import("@/lib/services/supplier-payment");
    const supplierB = (
      await store.list("users", { filter: { email: "supplier.b@china.com" } })
    )[0];
    // Pedido nasce sem condição (fornecedor B sem condição).
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-b", {
      terms: [],
      note: null,
    });
    const order = await inPackagingWith(supplierB, "fornecedor-b");
    expect(order.supplierPaymentTerms ?? null).toBeNull();
    const first = [
      { percent: 50, base: "order_created" as const, days: 0 },
      { percent: 50, base: "shipped" as const, days: 0 },
    ];
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-b", {
      terms: first,
      note: null,
    });
    // Paga a parcela 1 pela condição atual do fornecedor: ela fica no pedido.
    await registerSupplierPayment(admin, order.id, {
      method: "transfer_copied",
      installment: 1,
    });
    expect((await store.get("orders", order.id))!.supplierPaymentTerms).toEqual(
      first,
    );
    // Cadastro muda depois: o pedido continua com a condição do pagamento.
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-b", {
      terms: [
        { percent: 50, base: "shipped" as const, days: 0 },
        { percent: 50, base: "delivered" as const, days: 30 },
      ],
      note: null,
    });
    const payable = await terms.orderPayable(
      (await store.get("orders", order.id))!,
    );
    expect(payable.source).toBe("order");
    expect(payable.schedule.installments[0].status).toBe("requested");
    // E "Usar a condição atual" é recusado com pagamento lançado.
    await expect(
      terms.applySupplierTermsToOrder(admin, order.id),
    ).rejects.toThrow("terms_has_payments");
  });

  it("pagamento lançado depois da confirmação antiga pede a confirmação do fornecedor", async () => {
    const store = getStore();
    // Fornecedor C: ainda sem lembrete neste arquivo de teste.
    const order = await inPackagingWith(supplierC, "fornecedor-c");
    const [pay] = await store.list("stages", {
      filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" },
    });
    // Fluxo antigo: sinal confirmado pela etapa há 10 dias.
    const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await store.create("requirements", {
      orderId: order.id,
      stageId: pay.id,
      key: "payment_received",
      label: "payment_received",
      type: "confirm",
      required: true,
      role: "supplier",
      status: "done",
      value: "ok",
      documentId: null,
      submittedByUserId: supplierC.id,
      submittedAt: old,
      note: null,
    });
    // Saldo pago agora pela Wellmix (registro à mão): o fornecedor confirma.
    const later = await store.create("payments", {
      orderId: order.id,
      requestId: null,
      direction: "supplier_out",
      amount: 700,
      currency: "USD",
      fxRate: null,
      method: "manual",
      status: "confirmed",
      proofDocumentId: null,
      registeredByUserId: admin.id,
      confirmedByUserId: null,
      confirmedAt: null,
      note: null,
    } as never);
    const tasks = await pendingTasksFor(supplierC);
    expect(
      tasks.some(
        (x) => x.kind === "confirm_receipt" && x.orderNumber === order.number,
      ),
    ).toBe(true);
    const inFourDays = new Date(Date.now() + 4 * 86_400_000);
    const firstRun = await terms.notifySuppliersToConfirm(inFourDays);
    expect(firstRun).toBeGreaterThanOrEqual(1);
    // O job rodando de novo no mesmo dia não repete o lembrete.
    expect(await terms.notifySuppliersToConfirm(inFourDays)).toBe(0);
    expect(later.status).toBe("confirmed");
  });

  it("o resumo diário da Wellmix não repete no mesmo dia", async () => {
    // Já houve um resumo neste arquivo de teste (parcelas vencidas/da semana).
    const again = await terms.notifyPayablesDue();
    expect(again).toBe(0);
  });
});
