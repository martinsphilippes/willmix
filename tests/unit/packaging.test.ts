import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Arte e embalagem: a agência (ou a Wellmix, sem agência) faz e envia a arte;
 * o fornecedor confere e aprova para produzir. Pedidos de antes da inversão
 * passam para o fluxo novo.
 */
withTempStore();

const { getStore, DOCUMENT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { submitRequirement, decideRequirement } =
  await import("@/lib/workflow/engine");
const { normalizePackaging, normalizePackagingStage } =
  await import("@/lib/services/packaging");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;
let supplierA: User;
let agency: User;

/** Pedido na Embalagem (fornecedor A). */
async function inPackaging(): Promise<Order> {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste arte",
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
  const fresh = (await store.get("orders", order.id))!;
  expect(fresh.status).toBe("PACKAGING");
  return fresh;
}

async function packagingReqs(orderId: string) {
  const store = getStore();
  const [pack] = await store.list("stages", {
    filter: { orderId, key: "PACKAGING" },
  });
  const reqs = await store.list("requirements", {
    filter: { stageId: pack.id },
  });
  return {
    pack,
    art: reqs.find((x) => x.key === "art")!,
    approval: reqs.find((x) => x.key === "art_approval")!,
  };
}

async function uploadArt(user: User, orderId: string, requirementId: string) {
  const doc = await getStore().create("documents", {
    ...DOCUMENT_EXTRA_DEFAULTS,
    orderId,
    requestId: null,
    requirementId,
    type: "art",
    name: "arte.pdf",
    mime: "application/pdf",
    size: 10,
    storageKey: "x",
    version: 1,
    previousDocumentId: null,
    uploadedByUserId: user.id,
    visibility: "supplier",
  });
  await submitRequirement(user, requirementId, { documentId: doc.id });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  agency = users.find((u) => u.email === "agencia@design.com")!;
});

describe("arte e embalagem", () => {
  it("a agência envia a arte, o fornecedor é avisado e aprova; a reprovação volta para a agência", async () => {
    const store = getStore();
    const order = await inPackaging();
    const { art, approval } = await packagingReqs(order.id);
    expect(art.role).toBe("agency");
    expect(approval.role).toBe("supplier");

    // Pendências: a agência tem a arte; o fornecedor ainda não tem o que aprovar.
    const supplierBefore = await pendingTasksFor(supplierA);
    expect(
      supplierBefore.some(
        (x) => x.kind === "requirement" && x.orderNumber === order.number,
      ),
    ).toBe(false);
    const agencyTasks = await pendingTasksFor(agency);
    expect(
      agencyTasks.some(
        (x) => x.kind === "requirement" && x.orderNumber === order.number,
      ),
    ).toBe(true);

    await expect(
      decideRequirement(supplierA, approval.id, "reject", "x"),
    ).rejects.toThrow("art_missing");
    await uploadArt(agency, order.id, art.id);
    const supplierNotes = await store.list("notifications", {
      filter: { userId: supplierA.id, channel: "inapp" },
    });
    expect(
      supplierNotes.some((n) =>
        n.subject.includes("packaging artwork to review"),
      ),
    ).toBe(true);
    const supplierAfter = await pendingTasksFor(supplierA);
    expect(
      supplierAfter.some(
        (x) => x.kind === "requirement" && x.orderNumber === order.number,
      ),
    ).toBe(true);

    // A agência não aprova a própria arte.
    await expect(
      decideRequirement(agency, approval.id, "approve"),
    ).rejects.toThrow();
    await decideRequirement(supplierA, approval.id, "reject", "Cor errada");
    expect((await store.get("requirements", art.id))!.status).toBe("rejected");
    const agencyNotes = await store.list("notifications", {
      filter: { userId: agency.id, channel: "inapp" },
    });
    expect(agencyNotes.some((n) => n.body === "Cor errada")).toBe(true);
    // Arte reprovada: nada a aprovar até a agência reenviar.
    await expect(
      decideRequirement(supplierA, approval.id, "approve"),
    ).rejects.toThrow("art_missing");

    await uploadArt(agency, order.id, art.id);
    await decideRequirement(supplierA, approval.id, "approve");
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");
  });

  it("sem agência no pedido, a Wellmix envia a arte; designar a agência depois passa a arte para ela", async () => {
    const store = getStore();
    const order = await inPackaging();
    await store.update("orders", order.id, { agencyId: null });
    const { pack, art } = await packagingReqs(order.id);
    expect(await normalizePackagingStage(pack.id)).toBe(true);
    expect((await store.get("requirements", art.id))!.role).toBe("operator");
    // Idempotente.
    expect(await normalizePackagingStage(pack.id)).toBe(false);

    await store.update("orders", order.id, { agencyId: "agencia" });
    expect(await normalizePackagingStage(pack.id)).toBe(true);
    expect((await store.get("requirements", art.id))!.role).toBe("agency");
  });

  it("pedido de antes da inversão passa para o fluxo novo (inclusive aprovação concluída sem arte)", async () => {
    const store = getStore();
    const order = await inPackaging();
    const { pack, art, approval } = await packagingReqs(order.id);
    // Como era: arte do fornecedor; aprovação da agência "concluída" sem arte.
    await store.update("requirements", art.id, { role: "supplier" });
    await store.update("requirements", approval.id, {
      role: "agency",
      label: "Aprovação da arte pela agência",
      status: "done",
      value: "approved",
      submittedByUserId: admin.id,
      submittedAt: new Date().toISOString(),
    });
    // Outro pedido antigo sem a aprovação (sem agência quando nasceu).
    const other = await inPackaging();
    const otherReqs = await packagingReqs(other.id);
    await store.update("requirements", otherReqs.art.id, { role: "supplier" });
    await store.remove("requirements", otherReqs.approval.id);

    expect(await normalizePackaging(undefined, { force: true })).toBe(2);
    const fixedArt = (await store.get("requirements", art.id))!;
    const fixedApproval = (await store.get("requirements", approval.id))!;
    expect(fixedArt.role).toBe("agency");
    expect(fixedApproval.role).toBe("supplier");
    expect(fixedApproval.status).toBe("pending");
    expect(fixedApproval.label).toBe("Aprovação da arte pelo fornecedor");
    expect((await store.get("stages", pack.id))!.status).toBe("active");
    const created = (await packagingReqs(other.id)).approval;
    expect(created.role).toBe("supplier");
    expect(created.status).toBe("pending");
    // Nada mais a ajustar.
    expect(await normalizePackaging(undefined, { force: true })).toBe(0);
  });
});
