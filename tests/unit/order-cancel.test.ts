import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Cancelamento: só o admin cancela (qualquer etapa); o cliente pede até a produção. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { submitRequirement } = await import("@/lib/workflow/engine");
const { computeOrderFinance } = await import("@/lib/services/finance");
const c = await import("@/lib/services/order-cancel");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;

async function newOrder(): Promise<Order> {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste cancelamento",
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
  return r.confirmDownPayment(admin, request.id);
}

/** Conclui as etapas até a indicada (exclusive). */
async function advanceTo(order: Order, until: string) {
  const store = getStore();
  for (const key of ["ORDER_CREATED", "PREPARATION", "SUPPLIER_PAYMENT"]) {
    if (key === until) break;
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
  expect(fresh.status).toBe(until);
  return fresh;
}

const input = {
  reason: "customer_withdrew" as const,
  note: "Cliente desistiu",
  settlement: null,
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("cancelamento pelo administrador", () => {
  it("só o admin cancela; etapas abertas viram canceladas e o pedido não avança mais", async () => {
    const store = getStore();
    const order = await advanceTo(await newOrder(), "SUPPLIER_PAYMENT");
    for (const who of [operator, joao, supplierA])
      await expect(c.cancelOrder(who, order.id, input)).rejects.toThrow(
        "forbidden",
      );

    const cancelled = await c.cancelOrder(admin, order.id, input);
    expect(cancelled?.status).toBe("CANCELLED");
    expect(cancelled?.currentStageId).toBeNull();
    expect(cancelled?.cancelStageKey).toBe("SUPPLIER_PAYMENT");
    expect(cancelled?.cancelReason).toBe("customer_withdrew");
    expect(cancelled?.cancelledByUserId).toBe(admin.id);

    const stages = await store.list("stages", {
      filter: { orderId: order.id },
    });
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.status]));
    expect(byKey.ORDER_CREATED).toBe("done");
    expect(byKey.PREPARATION).toBe("done");
    expect(byKey.SUPPLIER_PAYMENT).toBe("cancelled");
    expect(byKey.SHIPPING).toBe("cancelled");

    // Nada avança: requisito da etapa cancelada é recusado.
    const [payStage] = stages.filter((s) => s.key === "SUPPLIER_PAYMENT");
    const [pending] = await store.list("requirements", {
      filter: { stageId: payStage.id, status: "pending" },
    });
    await expect(
      submitRequirement(admin, pending.id, { value: "1" }),
    ).rejects.toThrow("stage_not_active");

    // Cancelar de novo: recusado.
    await expect(c.cancelOrder(admin, order.id, input)).rejects.toThrow(
      "already_cancelled",
    );

    // Cliente e fornecedor avisados; auditoria registrada.
    const notes = await store.list("notifications", {
      filter: { channel: "inapp" },
    });
    const subject = `Pedido #${order.number} cancelado`;
    expect(
      notes.some((n) => n.userId === joao.id && n.subject === subject),
    ).toBe(true);
    expect(
      notes.some((n) => n.userId === supplierA.id && n.subject === subject),
    ).toBe(true);
    const logs = await store.list("audit_log", {
      filter: { entityId: order.id },
    });
    expect(logs.some((l) => l.action === "order.cancel")).toBe(true);
  });

  it("admin cancela em qualquer etapa; nada a receber nem a pagar depois", async () => {
    const store = getStore();
    const order = await newOrder();
    await store.update("orders", order.id, { status: "SHIPPING" });
    const cancelled = await c.cancelOrder(admin, order.id, {
      ...input,
      reason: "supplier_issue",
    });
    expect(cancelled?.status).toBe("CANCELLED");
    expect(cancelled?.cancelStageKey).toBe("SHIPPING");
    const finance = computeOrderFinance(cancelled!, [], {
      customer: "c",
      supplier: "s",
      product: "p",
    });
    expect(finance.receivable).toBe(0);
    expect(finance.payable).toBe(0);
  });

  it("acerto financeiro é livre, editável depois e só pelo admin", async () => {
    const order = await newOrder();
    await expect(
      c.updateCancelSettlement(admin, order.id, "x"),
    ).rejects.toThrow("not_cancelled");
    await c.cancelOrder(admin, order.id, input);
    await expect(
      c.updateCancelSettlement(operator, order.id, "x"),
    ).rejects.toThrow("forbidden");
    await c.updateCancelSettlement(
      admin,
      order.id,
      "Sinal de R$ 300 devolvido por Pix em 05/10",
    );
    const fresh = await getStore().get("orders", order.id);
    expect(fresh?.cancelSettlement).toBe(
      "Sinal de R$ 300 devolvido por Pix em 05/10",
    );
  });
});

describe("pedido de cancelamento do cliente", () => {
  it("cliente pede até a produção; Wellmix recusa com resposta ou cancela", async () => {
    const store = getStore();
    const order = await newOrder();
    await expect(
      c.requestOrderCancel(admin, order.id, "Quero cancelar"),
    ).rejects.toThrow("forbidden");
    const requested = await c.requestOrderCancel(
      joao,
      order.id,
      "Mudei de ideia",
    );
    expect(requested?.cancelRequestStatus).toBe("requested");
    const toWellmix = await store.list("notifications", {
      filter: { userId: admin.id, channel: "inapp" },
    });
    expect(
      toWellmix.some((n) => n.subject.includes("cliente pediu cancelamento")),
    ).toBe(true);

    // Cliente não recusa; admin recusa e o cliente é avisado.
    await expect(c.rejectCancelRequest(joao, order.id, "não")).rejects.toThrow(
      "forbidden",
    );
    await c.rejectCancelRequest(admin, order.id, "Produção já reservada");
    const rejected = await store.get("orders", order.id);
    expect(rejected?.cancelRequestStatus).toBe("rejected");
    expect(rejected?.status).toBe("ORDER_CREATED");
    const toJoao = await store.list("notifications", {
      filter: { userId: joao.id, channel: "inapp" },
    });
    expect(toJoao.some((n) => n.body === "Produção já reservada")).toBe(true);
    await expect(
      c.rejectCancelRequest(admin, order.id, "de novo"),
    ).rejects.toThrow("no_cancel_request");

    // Pede de novo; o admin cancela e o pedido fica aprovado.
    await c.requestOrderCancel(joao, order.id, "Insisto");
    const done = await c.cancelOrder(admin, order.id, input);
    expect(done?.cancelRequestStatus).toBe("approved");
  });

  it("depois do início da produção (ou do pagamento ao fornecedor), só a Wellmix", async () => {
    const store = getStore();
    // Data de início da produção já passou.
    const started = await advanceTo(await newOrder(), "SUPPLIER_PAYMENT");
    const [sheet] = await store.list("purchase_sheets", {
      filter: { orderId: started.id },
    });
    if (sheet)
      await store.update("purchase_sheets", sheet.id, {
        productionStartAt: "2020-01-01",
      });
    else
      await store.create("purchase_sheets", {
        orderId: started.id,
        productionStartAt: "2020-01-01",
      } as never);
    expect(await c.customerCanRequestCancel(started)).toBe(false);
    await expect(
      c.requestOrderCancel(joao, started.id, "Quero cancelar"),
    ).rejects.toThrow("cancel_not_allowed");

    // Produção marcada para o futuro: ainda pode.
    const future = await advanceTo(await newOrder(), "SUPPLIER_PAYMENT");
    expect(
      await c.customerCanRequestCancel(future, new Date("2000-01-01")),
    ).toBe(true);

    // Pagamento ao fornecedor concluído (embalagem em diante): não pode.
    const packing = await newOrder();
    await store.update("orders", packing.id, { status: "PACKAGING" });
    const fresh = (await store.get("orders", packing.id))!;
    expect(await c.customerCanRequestCancel(fresh)).toBe(false);
    // O admin continua podendo cancelar.
    expect((await c.cancelOrder(admin, packing.id, input))?.status).toBe(
      "CANCELLED",
    );
  });

  it("outro cliente não pede o cancelamento de pedido alheio", async () => {
    const order = await newOrder();
    const other: User = {
      ...joao,
      id: "outro-cliente",
      partyId: "cliente-outro",
      email: "outro@cliente.com",
    };
    await expect(
      c.requestOrderCancel(other, order.id, "Quero cancelar"),
    ).rejects.toThrow("not_found");
  });
});
