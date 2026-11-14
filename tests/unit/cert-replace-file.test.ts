import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Certificação, quadro do alto (dono, 14/11/2026): a certificadora (OCP) do
 * pedido envia e substitui o selo e o memorial descritivo; o despachante só
 * lê. Substituir troca só o arquivo: o número do selo fica, o arquivo antigo
 * continua nos documentos e a auditoria registra a troca. Sem arquivo antes,
 * não há o que substituir.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const f = await import("@/lib/services/import-flow");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let joao: User;
let ocp: User;
let broker: User;
let agency: User;

async function newOrder(): Promise<Order> {
  const req = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Jarra",
    specification: null,
    quantity: 10000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  return orderFromRequest(admin, req, { sellPrice: 50_000 });
}

async function doc(user: User, order: Order, name: string) {
  return getStore().create("documents", {
    orderId: order.id,
    requestId: null,
    requirementId: null,
    type: "import_step",
    name,
    mime: "application/pdf",
    size: 3,
    storageKey: `k-${order.id}-${name}`,
    version: 1,
    previousDocumentId: null,
    uploadedByUserId: user.id,
    visibility: "internal",
  } as never);
}

async function stepOf(order: Order, key: string) {
  return (
    await getStore().list("import_steps", { filter: { orderId: order.id } })
  ).find((s) => s.key === key)!;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  joao = by("joao@lojista.com");
  ocp = by("ocp@certifica.com");
  broker = by("despachante@comex.com");
  agency = users.find((u) => u.role === "agency")!;
});

describe("selo: primeiro envio e substituição", () => {
  let order: Order;
  beforeAll(async () => {
    order = await newOrder();
  });

  it("sem arquivo ainda, não há o que substituir", async () => {
    await expect(
      f.submitStep(ocp, order.id, "cert_seal", {
        documentId: (await doc(ocp, order, "selo-novo.pdf")).id,
        replace: true,
      }),
    ).rejects.toThrow("replace_nothing");
  });

  it("a certificadora envia o selo com o número", async () => {
    const first = await doc(ocp, order, "selo.pdf");
    await f.submitStep(ocp, order.id, "cert_seal", {
      value: "BR-123",
      documentId: first.id,
    });
    const seal = await stepOf(order, "cert_seal");
    expect([seal.status, seal.value, seal.documentId]).toEqual([
      "submitted",
      "BR-123",
      first.id,
    ]);
  });

  it("o despachante não substitui (o servidor recusa)", async () => {
    expect(await f.canSubmitStep(broker, order, "cert_seal")).toBe(false);
    await expect(
      f.submitStep(broker, order.id, "cert_seal", {
        documentId: (await doc(broker, order, "selo-despachante.pdf")).id,
        replace: true,
      }),
    ).rejects.toThrow();
    expect((await stepOf(order, "cert_seal")).value).toBe("BR-123");
  });

  it("substituir sem arquivo novo é recusado; o arquivo atual continua", async () => {
    const before = await stepOf(order, "cert_seal");
    await expect(
      f.submitStep(ocp, order.id, "cert_seal", { replace: true }),
    ).rejects.toThrow("file_required");
    expect((await stepOf(order, "cert_seal")).documentId).toBe(
      before.documentId,
    );
  });

  it("substituir troca só o arquivo: o número fica, o antigo fica nos documentos e a auditoria registra", async () => {
    const before = await stepOf(order, "cert_seal");
    const next = await doc(ocp, order, "selo-v2.pdf");
    // O formulário da troca não leva o número: mesmo assim ele fica.
    await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: next.id,
      replace: true,
    });
    const after = await stepOf(order, "cert_seal");
    expect([after.status, after.value, after.documentId]).toEqual([
      "submitted",
      "BR-123",
      next.id,
    ]);
    expect(await getStore().get("documents", before.documentId!)).toBeTruthy();
    const log = await getStore().list("audit_log", {
      filter: { entityId: order.id, action: "import.step_file_replaced" },
    });
    expect(log).toHaveLength(1);
    expect(log[0].before).toEqual({ documentId: before.documentId });
    expect(log[0].after).toEqual({ documentId: next.id });
  });

  it("selo substituído com a arte já enviada: a arte reabre, como no reenvio", async () => {
    await f.submitStep(admin, order.id, "cert_seal_art", {
      documentId: (await doc(admin, order, "arte-com-selo.pdf")).id,
    });
    await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: (await doc(ocp, order, "selo-v3.pdf")).id,
      replace: true,
    });
    const art = await stepOf(order, "cert_seal_art");
    expect([art.status, art.rejectReason]).toEqual([
      "rejected",
      f.SEAL_REPLACED_REASON,
    ]);
    expect((await stepOf(order, "cert_seal")).value).toBe("BR-123");
  });

  it("só o selo e o memorial têm substituição", async () => {
    await expect(
      f.submitStep(agency, order.id, "cert_seal_art", {
        documentId: (await doc(agency, order, "arte.pdf")).id,
        replace: true,
      }),
    ).rejects.toThrow("replace_not_allowed");
  });
});

describe("memorial: substituição com a validação", () => {
  let order: Order;
  beforeAll(async () => {
    order = await newOrder();
  });

  it("anexado pela certificadora, já vale; substituído por ela, continua valendo", async () => {
    await f.submitStep(ocp, order.id, "cert_memorial", {
      documentId: (await doc(ocp, order, "memorial.pdf")).id,
    });
    expect((await stepOf(order, "cert_memorial")).status).toBe("validated");
    // O quadro mostra "Substituir arquivo" para ela (e para a Wellmix), não
    // para o despachante.
    const memorialFor = async (user: User) =>
      (await f.importFlowView(user, order, "certification")).find(
        (v) => v.template.key === "cert_memorial",
      )!;
    expect((await memorialFor(ocp)).canSubmit).toBe(true);
    expect((await memorialFor(admin)).canSubmit).toBe(true);
    expect((await memorialFor(broker)).canSubmit).toBe(false);
    // Antes da regra nova, o validado não aceitava outro envio.
    const next = await doc(ocp, order, "memorial-v2.pdf");
    await f.submitStep(ocp, order.id, "cert_memorial", {
      documentId: next.id,
      replace: true,
    });
    const after = await stepOf(order, "cert_memorial");
    expect([after.status, after.documentId]).toEqual(["validated", next.id]);
    // Reenviar sem ser substituição continua recusado.
    await expect(
      f.submitStep(ocp, order.id, "cert_memorial", { documentId: next.id }),
    ).rejects.toThrow("already_validated");
  });

  it("substituído pela Wellmix, volta para a certificadora validar", async () => {
    const next = await doc(admin, order, "memorial-wellmix.pdf");
    await f.submitStep(admin, order.id, "cert_memorial", {
      documentId: next.id,
      replace: true,
    });
    const after = await stepOf(order, "cert_memorial");
    expect([after.status, after.documentId]).toEqual(["submitted", next.id]);
    const tasks = (await pendingTasksFor(ocp)).filter(
      (t) =>
        t.link.startsWith(`/app/orders/${order.id}#certification`) &&
        t.kind === "cert_validate",
    );
    expect(tasks).toHaveLength(1);
    await expect(
      f.validateStep(broker, order.id, "cert_memorial", "validated", null),
    ).rejects.toThrow();
    await f.validateStep(ocp, order.id, "cert_memorial", "validated", null);
    expect((await stepOf(order, "cert_memorial")).status).toBe("validated");
  });
});
