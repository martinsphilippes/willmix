import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { createRequest, openRfq, answerQuote, selectQuote, confirmDownPayment } = await import(
  "@/lib/services/requests"
);
const { submitRequirement, decideRequirement, loadOrderProgress } = await import("@/lib/workflow/engine");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canViewOrder } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;

let users: Record<string, User> = {};

beforeAll(async () => {
  const seeded = await seedDemo();
  users = Object.fromEntries(seeded.users.map((u) => [u.role + ":" + (u.partyId ?? ""), u]));
});

const by = (role: string, party = "") => users[`${role}:${party}`];

async function fillStage(user: User, orderId: string, stageKey: string, values: Record<string, string> = {}) {
  const store = getStore();
  const [stage] = await store.list("stages", { filter: { orderId, key: stageKey as never } });
  const reqs = await store.list("requirements", { filter: { stageId: stage.id, status: ["pending", "rejected"] } });
  for (const req of reqs) {
    if (!req.required || req.type === "approval") continue;
    if (req.type === "file" || req.type === "photo") {
      const doc = await store.create("documents", {
        orderId,
        requestId: null,
        requirementId: req.id,
        type: "photo",
        name: `${req.key}.png`,
        mime: "image/png",
        size: 10,
        storageKey: "x",
        version: 1,
        previousDocumentId: null,
        uploadedByUserId: user.id,
        visibility: "all",
      });
      await submitRequirement(user, req.id, { documentId: doc.id });
    } else {
      const value = values[req.key] ?? (req.type === "number" ? "10" : req.type === "date" ? "2026-10-01" : "ok");
      await submitRequirement(user, req.id, { value });
    }
  }
  return (await store.get("stages", stage.id))!;
}

describe("fluxo completo: solicitação → entrega", () => {
  it("atravessa todas as etapas com avanço automático", async () => {
    const store = getStore();
    const customer = by("customer", "cliente-joao");
    const operator = by("operator");
    const supplierA = by("supplier", "fornecedor-a");
    const supplierB = by("supplier", "fornecedor-b");

    const request = await createRequest(customer, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra de vidro 1,5 L",
      description: "Jarra com tampa",
      quantity: 1000,
      unit: "un",
    });
    expect(request.status).toBe("REQUESTED");

    await openRfq(operator, request.id, ["fornecedor-a", "fornecedor-b"]);
    expect((await pendingTasksFor(supplierA)).some((t) => t.kind === "quote")).toBe(true);

    const [quoteA] = await store.list("quotes", { filter: { requestId: request.id, supplierId: "fornecedor-a" } });
    const [quoteB] = await store.list("quotes", { filter: { requestId: request.id, supplierId: "fornecedor-b" } });
    await answerQuote(supplierA, quoteA.id, { price: 2.5, currency: "USD", leadTimeDays: 30 });
    await answerQuote(supplierB, quoteB.id, { price: 2.8, currency: "USD", leadTimeDays: 25 });
    // fornecedor B não responde a cotação de A
    await expect(answerQuote(supplierB, quoteA.id, { price: 1, currency: "USD", leadTimeDays: 1 })).rejects.toThrow();

    await selectQuote(operator, quoteA.id, { sellPrice: 25000, sellCurrency: "BRL" });
    const updated = (await store.get("requests", request.id))!;
    expect(updated.status).toBe("WAITING_DOWN_PAYMENT");
    expect(updated.downPaymentAmount).toBe(7500);

    const order = await confirmDownPayment(operator, request.id);
    expect(order.status).toBe("ORDER_CREATED");
    expect(order.erpSyncStatus).toBe("pending");
    expect(order.agencyId).toBe("agencia");

    // isolamento
    expect(canViewOrder(customer, order)).toBe(true);
    expect(canViewOrder(supplierA, order)).toBe(true);
    expect(canViewOrder(supplierB, order)).toBe(false);

    // fornecedor não pode confirmar pedido (etapa da Willmix)
    const [created] = await store.list("stages", { filter: { orderId: order.id, key: "ORDER_CREATED" } });
    const [confirm] = await store.list("requirements", { filter: { stageId: created.id, key: "order_confirmed" } });
    await expect(submitRequirement(supplierA, confirm.id, { value: "ok" })).rejects.toThrow();

    await fillStage(operator, order.id, "ORDER_CREATED");
    expect((await store.get("orders", order.id))!.status).toBe("PREPARATION");

    const prep = await fillStage(supplierA, order.id, "PREPARATION", { weight: "12.0" });
    expect(prep.status).toBe("done");
    expect((await store.get("orders", order.id))!.status).toBe("SUPPLIER_PAYMENT");

    // pagamento: operador registra, fornecedor confirma
    const [payStage] = await store.list("stages", { filter: { orderId: order.id, key: "SUPPLIER_PAYMENT" } });
    const [registered] = await store.list("requirements", { filter: { stageId: payStage.id, key: "payment_registered" } });
    const [received] = await store.list("requirements", { filter: { stageId: payStage.id, key: "payment_received" } });
    await expect(submitRequirement(supplierA, registered.id, { value: "ok" })).rejects.toThrow();
    await submitRequirement(operator, registered.id, { value: "ok" });
    expect((await store.get("stages", payStage.id))!.percent).toBe(50);
    await submitRequirement(supplierA, received.id, { value: "ok" });
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");

    // embalagem: arte + aprovação da agência
    await fillStage(supplierA, order.id, "PACKAGING");
    const [pack] = await store.list("stages", { filter: { orderId: order.id, key: "PACKAGING" } });
    expect((await store.get("stages", pack.id))!.status).toBe("active");
    const [approval] = await store.list("requirements", { filter: { stageId: pack.id, key: "art_approval" } });
    await decideRequirement(by("agency", "agencia"), approval.id, "reject", "Logo errado");
    const [art] = await store.list("requirements", { filter: { stageId: pack.id, key: "art" } });
    expect((await store.get("requirements", art.id))!.status).toBe("rejected");
    await fillStage(supplierA, order.id, "PACKAGING");
    await decideRequirement(by("agency", "agencia"), approval.id, "approve");
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");

    // inspeção com peso divergente bloqueia
    await fillStage(supplierA, order.id, "INSPECTION", { weight_measured: "15" });
    const [insp] = await store.list("stages", { filter: { orderId: order.id, key: "INSPECTION" } });
    expect((await store.get("stages", insp.id))!.status).toBe("blocked");
    const [review] = await store.list("requirements", { filter: { stageId: insp.id, key: "inspection_review" } });
    expect(review.status).toBe("pending");
    await decideRequirement(operator, review.id, "approve", "Diferença aceita");
    expect((await store.get("orders", order.id))!.status).toBe("SHIPPING");

    await fillStage(by("shipping_line", "armador"), order.id, "SHIPPING");
    expect((await store.get("orders", order.id))!.status).toBe("CUSTOMS");
    await fillStage(by("broker", "despachante"), order.id, "CUSTOMS");
    expect((await store.get("orders", order.id))!.status).toBe("TRANSPORT");
    await fillStage(by("carrier", "transportador"), order.id, "TRANSPORT", { plate: "ABC1D23" });
    expect((await store.get("orders", order.id))!.status).toBe("DELIVERED");
    await fillStage(customer, order.id, "DELIVERED");

    const final = (await store.get("orders", order.id))!;
    expect(final.status).toBe("CLOSED");
    expect(final.closedAt).not.toBeNull();

    const progress = (await loadOrderProgress(order.id))!;
    expect(progress.stages.every((s) => s.status === "done")).toBe(true);
    const audit = await store.list("audit_log");
    expect(audit.length).toBeGreaterThan(20);
  });
});
