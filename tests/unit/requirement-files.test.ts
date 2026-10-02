import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Checklist do pedido: foto/arquivo enviado pode ser excluído para mandar outro; foto é sempre obrigatória. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { uploadDocument } = await import("@/lib/services/documents");
const engine = await import("@/lib/workflow/engine");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

async function newOrder() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Jarra",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(admin, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 20,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 5000,
    sellCurrency: "BRL",
  });
  return r.confirmDownPayment(admin, request.id);
}

const photo = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "foto.png", {
    type: "image/png",
  });

describe("fotos e arquivos do checklist", () => {
  it("todo requisito de foto nasce obrigatório", async () => {
    const order = await newOrder();
    const photos = await getStore().list("requirements", {
      filter: { orderId: order.id, type: "photo" },
    });
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.every((p) => p.required)).toBe(true);
  });

  it("excluir a foto volta o item a pendente e apaga o arquivo", async () => {
    const store = getStore();
    const order = await newOrder();
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, key: "ORDER_CREATED" },
    });
    // Foto do fornecedor numa etapa aberta.
    const req = await store.create("requirements", {
      orderId: order.id,
      stageId: stage.id,
      key: "photo_test",
      label: "Foto de teste",
      type: "photo",
      required: true,
      role: "supplier",
      status: "pending",
      value: null,
      documentId: null,
      submittedByUserId: null,
      submittedAt: null,
      note: null,
    });
    const doc = await uploadDocument(supplierA, photo(), {
      orderId: order.id,
      requirementId: req.id,
      type: "photo",
    });
    await engine.submitRequirement(supplierA, req.id, { documentId: doc.id });
    expect((await store.get("requirements", req.id))?.status).toBe("done");

    // Outro fornecedor não exclui.
    await expect(
      engine.clearRequirementDocument(supplierB, req.id),
    ).rejects.toThrow();
    await engine.clearRequirementDocument(supplierA, req.id);
    const cleared = await store.get("requirements", req.id);
    expect(cleared).toMatchObject({ status: "pending", documentId: null });
    expect(await store.get("documents", doc.id)).toBeNull();

    // Envia outra foto normalmente.
    const again = await uploadDocument(supplierA, photo(), {
      orderId: order.id,
      requirementId: req.id,
      type: "photo",
    });
    await engine.submitRequirement(supplierA, req.id, {
      documentId: again.id,
    });
    expect((await store.get("requirements", req.id))?.documentId).toBe(
      again.id,
    );
  });
});
