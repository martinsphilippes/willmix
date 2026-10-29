import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Embarque e desembaraço (Fase D): cada passo tem quem faz e quem valida;
 * o parceiro só vê os passos dele (o fornecedor nunca vê numerário nem DI,
 * nem os arquivos deles); o financeiro (função) valida e paga o numerário.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const f = await import("@/lib/services/import-flow");
const team = await import("@/lib/services/team");
const { canAccessDocument } = await import("@/lib/services/documents");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { setSetting } = await import("@/lib/settings");
const { canViewOrder } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let finance: User;
let joao: User;
let supplierA: User;
let otherSupplier: User;
let comex: User;
let logistics: User;
let order: Order;

async function doc(user: User, name: string) {
  return getStore().create("documents", {
    orderId: order.id,
    requestId: null,
    requirementId: null,
    type: "import_step",
    name,
    mime: "application/pdf",
    size: 10,
    storageKey: `k-${name}`,
    version: 1,
    previousDocumentId: null,
    uploadedByUserId: user.id,
    visibility: "internal",
  } as never);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  comex = by("comex@assessoria.com");
  logistics = by("agente@cargo.com");
  otherSupplier = users.find(
    (u) => u.role === "supplier" && u.partyId !== supplierA.partyId,
  )!;
  finance = await getStore().create("users", {
    email: "financeiro@wellmix.com",
    name: "Fábio Financeiro",
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
  await team.setTeamMember(admin, finance.id, {
    jobLevel: null,
    managerUserId: null,
    division: null,
    functions: ["finance"],
  });
  finance = (await getStore().get("users", finance.id))!;
  await setSetting("approvalsEnabled", false);
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra embarque",
    description: "Jarra",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, req.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: req.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 10_000,
    sellCurrency: "BRL",
  });
  order = await r.confirmDownPayment(admin, req.id);
  // Pedido no embarque, com comex e agente de carga designados.
  order = await getStore().update("orders", order.id, {
    status: "SHIPPING",
    comexId: comex.partyId,
    logisticsId: logistics.partyId,
  });
});

describe("embarque e desembaraço", () => {
  it("comex e agente de carga veem o pedido designado; o cliente não vê o card", async () => {
    expect(canViewOrder(comex, order)).toBe(true);
    expect(canViewOrder(logistics, order)).toBe(true);
    expect(f.canSeeImportFlow(joao, order)).toBe(false);
    // Fornecedor vê invoice e BL, nunca numerário e DI.
    expect(f.canSeeStep(supplierA, order, "invoice_packing")).toBe(true);
    expect(f.canSeeStep(supplierA, order, "numerario")).toBe(false);
    expect(f.canSeeStep(supplierA, order, "di")).toBe(false);
    // Outro fornecedor: nada.
    expect(f.canSeeImportFlow(otherSupplier, order)).toBe(false);
  });

  it("booking do agente, validado pela Wellmix; draft BL só depois", async () => {
    await expect(
      f.submitStep(logistics, order.id, "draft_bl", {
        documentId: (await doc(logistics, "draft.pdf")).id,
      }),
    ).rejects.toThrow("previous_step");
    await expect(
      f.submitStep(comex, order.id, "booking", { value: "BK1" }),
    ).rejects.toThrow();
    await f.submitStep(logistics, order.id, "booking", { value: "BK123" });
    // Agente não valida o próprio passo (é da Wellmix).
    await expect(
      f.validateStep(logistics, order.id, "booking", "validated", null),
    ).rejects.toThrow();
    await f.validateStep(operator, order.id, "booking", "validated", null);
    await f.submitStep(logistics, order.id, "draft_bl", {
      documentId: (await doc(logistics, "draft2.pdf")).id,
    });
    // Recusa exige motivo e volta para o agente.
    await expect(
      f.validateStep(comex, order.id, "draft_bl", "rejected", null),
    ).rejects.toThrow("reason_required");
    await f.validateStep(
      comex,
      order.id,
      "draft_bl",
      "rejected",
      "Shipper errado",
    );
    expect(
      (await pendingTasksFor(logistics)).some(
        (t) => t.kind === "import_step" && t.link.includes(order.id),
      ),
    ).toBe(true);
  });

  it("invoice: comex gera, fornecedor valida e devolve assinada", async () => {
    await f.submitStep(comex, order.id, "invoice_packing", {
      documentId: (await doc(comex, "invoice.pdf")).id,
    });
    expect(
      (await pendingTasksFor(supplierA)).some(
        (t) => t.kind === "import_validate" && t.link.includes(order.id),
      ),
    ).toBe(true);
    await f.validateStep(
      supplierA,
      order.id,
      "invoice_packing",
      "validated",
      null,
    );
    await f.submitStep(supplierA, order.id, "invoice_signed", {
      documentId: (await doc(supplierA, "signed.pdf")).id,
    });
    await f.validateStep(comex, order.id, "invoice_signed", "validated", null);
    const view = await f.importFlowView(comex, order);
    expect(view.find((v) => v.template.key === "invoice_signed")?.done).toBe(
      true,
    );
  });

  it("numerário: só o financeiro valida e paga; o arquivo não abre para o fornecedor", async () => {
    const proof = await doc(comex, "numerario.pdf");
    await expect(
      f.submitStep(comex, order.id, "numerario", { documentId: proof.id }),
    ).rejects.toThrow("amount_required");
    await f.submitStep(comex, order.id, "numerario", {
      amount: 25_000,
      currency: "BRL",
      documentId: proof.id,
    });
    const stored = (await getStore().get("documents", proof.id))!;
    expect(await canAccessDocument(comex, stored)).toBe(true);
    expect(await canAccessDocument(supplierA, stored)).toBe(false);
    expect(await canAccessDocument(logistics, stored)).toBe(false);
    expect(await canAccessDocument(joao, stored)).toBe(false);
    // Operador sem a função não valida; o financeiro sim.
    await expect(
      f.validateStep(operator, order.id, "numerario", "validated", null),
    ).rejects.toThrow();
    expect(
      (await pendingTasksFor(finance)).some(
        (t) => t.kind === "import_validate" && t.link.includes(order.id),
      ),
    ).toBe(true);
    await f.validateStep(finance, order.id, "numerario", "validated", null);
    await expect(
      f.submitStep(comex, order.id, "numerario_paid", {
        documentId: (await doc(comex, "x.pdf")).id,
      }),
    ).rejects.toThrow();
    await f.submitStep(finance, order.id, "numerario_paid", {
      documentId: (await doc(finance, "pago.pdf")).id,
    });
  });

  it("canal vermelho avisa a Wellmix; canal inválido é recusado", async () => {
    await expect(
      f.submitStep(comex, order.id, "channel", { value: "blue" }),
    ).rejects.toThrow("invalid_channel");
    const before = (
      await getStore().list("notifications", { filter: { userId: admin.id } })
    ).length;
    await f.submitStep(comex, order.id, "channel", { value: "red" });
    const after = (
      await getStore().list("notifications", { filter: { userId: admin.id } })
    ).length;
    expect(after).toBeGreaterThan(before);
  });

  it("arquivo de outro pedido não entra no passo", async () => {
    const foreign = await getStore().create("documents", {
      orderId: "outro-pedido",
      requestId: null,
      requirementId: null,
      type: "import_step",
      name: "x.pdf",
      mime: "application/pdf",
      size: 1,
      storageKey: "k-x",
      version: 1,
      previousDocumentId: null,
      uploadedByUserId: comex.id,
      visibility: "internal",
    } as never);
    await expect(
      f.submitStep(comex, order.id, "ci", { documentId: foreign.id }),
    ).rejects.toThrow("file_required");
  });
});
