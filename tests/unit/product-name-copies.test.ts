import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Nome de exemplo nos pedidos (docs/PURCHASE_ORDER.md, "Nome de exemplo"):
 * as tarefas das raias nascem sem ele, e quando o produto ganha o nome real
 * no cadastro, as cópias vazias ou de exemplo (item do pedido, tarefas e
 * solicitação) recebem o nome. Pedido assinado ou encerrado fica como está;
 * status, respostas e vínculos das tarefas não mudam.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { ORDER_EXTRA_DEFAULTS, PRODUCT_EXTRA_DEFAULTS, REQUEST_EXTRA_DEFAULTS } =
  await import("@/lib/db/schema");
const { createStagesForOrder } = await import("@/lib/workflow/engine");
const { fillProductNameCopies } =
  await import("@/lib/services/product-name-copies");
const { ORDER_SIGNED_WELLMIX } = await import("@/lib/workflow/stages");
type User = import("@/lib/db").User;

const XPTO = "Produto novo XPTO";
let admin: User;
let lineId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  const [line] = await getStore().list("product_lines");
  lineId = line.id;
});

async function product(name: string) {
  return getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name,
    sku: null,
    specification: null,
    active: true,
  });
}

/** Pedido de compra (flow "supplier_request") com um item, já com as etapas. */
async function purchaseOrder(productId: string, itemName: string) {
  const store = getStore();
  const request = await store.create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: "cliente-joao",
    createdByUserId: admin.id,
    productId,
    productName: itemName,
    description: `Pedido de compra das solicitações ao fornecedor nº 3 (${itemName})`,
    specification: null,
    quantity: 100,
    unit: "pcs",
    deadline: null,
    status: "ORDERED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    origin: "supplier_request",
    ownerUserId: admin.id,
  });
  const order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: await store.nextNumber("order_number"),
    requestId: request.id,
    customerId: "cliente-joao",
    supplierId: "fornecedor-a",
    lineId,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal: null,
    fobCurrency: "USD",
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
    ownerUserId: admin.id,
    flow: "supplier_request",
  });
  await store.update("requests", request.id, { orderId: order.id });
  const item = await store.create("order_items", {
    orderId: order.id,
    productId,
    name: itemName,
    quantity: 100,
    unit: "pcs",
    unitPrice: 1,
  });
  await createStagesForOrder(order);
  return { order, item, request };
}

const lane = async (orderId: string) =>
  (await getStore().list("requirements", { filter: { orderId } }))
    .filter((r) => r.key.includes("__"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

describe("tarefas das raias", () => {
  it("item com nome de exemplo e produto com nome real: o nome do produto", async () => {
    const p = await product("Jarra de vidro");
    const { order } = await purchaseOrder(p.id, XPTO);
    const labels = (await lane(order.id)).map((r) => r.label);
    expect(labels).toContain("Faca (die cut) · Jarra de vidro");
    expect(labels.join("|")).not.toMatch(/xpto/i);
  });

  it("sem nome real em lugar nenhum: só o título, sem separador sobrando", async () => {
    const p = await product(XPTO);
    const { order } = await purchaseOrder(p.id, XPTO);
    const labels = (await lane(order.id)).map((r) => r.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Faca (die cut)",
        "Foto em alta resolução",
        "MOQ confirmado (peças)",
        "Prazo de produção confirmado (dias)",
      ]),
    );
    expect(labels.some((l) => l.includes(" · "))).toBe(false);
  });
});

describe("o produto ganha o nome real", () => {
  it("as cópias sem nome recebem o nome; status e respostas ficam", async () => {
    const store = getStore();
    const p = await product(XPTO);
    const { order, item, request } = await purchaseOrder(p.id, XPTO);
    // Rótulo antigo, gravado antes desta regra, e uma tarefa já respondida.
    const [first, second] = await lane(order.id);
    const keys = (await lane(order.id)).map((r) => r.key);
    await store.update("requirements", first.id, {
      label: `Faca (die cut) · ${XPTO}`,
    });
    await store.update("requirements", second.id, {
      status: "done",
      value: "foto.jpg",
    });

    const done = await fillProductNameCopies(admin, {
      id: p.id,
      name: "Jarra de vidro",
    });
    expect(done.items).toBe(1);
    expect(done.tasks).toBeGreaterThanOrEqual(8);
    expect(done.requests).toBe(1);

    expect((await store.get("order_items", item.id))?.name).toBe(
      "Jarra de vidro",
    );
    const after = await lane(order.id);
    expect(after.find((r) => r.id === first.id)?.label).toBe(
      "Faca (die cut) · Jarra de vidro",
    );
    expect(after.find((r) => r.id === second.id)).toMatchObject({
      label: "Foto em alta resolução · Jarra de vidro",
      status: "done",
      value: "foto.jpg",
    });
    // Chaves (o vínculo com o item) não mudam.
    expect(after.map((r) => r.key)).toEqual(keys);
    expect(await store.get("requests", request.id)).toMatchObject({
      productName: "Jarra de vidro",
      description:
        "Pedido de compra das solicitações ao fornecedor nº 3 (Jarra de vidro)",
    });
  });

  it("cópia com nome real não é tocada", async () => {
    const store = getStore();
    const p = await product(XPTO);
    const { item, order } = await purchaseOrder(p.id, "Copo azul");
    const before = (await lane(order.id)).map((r) => r.label);
    await fillProductNameCopies(admin, { id: p.id, name: "Jarra de vidro" });
    expect((await store.get("order_items", item.id))?.name).toBe("Copo azul");
    expect((await lane(order.id)).map((r) => r.label)).toEqual(before);
  });

  it("pedido assinado ou encerrado fica como está", async () => {
    const store = getStore();
    const p = await product(XPTO);
    const signed = await purchaseOrder(p.id, XPTO);
    const [sign] = await store.list("requirements", {
      filter: { orderId: signed.order.id, key: ORDER_SIGNED_WELLMIX },
    });
    await store.update("requirements", sign.id, { status: "done" });
    const closed = await purchaseOrder(p.id, XPTO);
    await store.update("orders", closed.order.id, { status: "CLOSED" });

    const done = await fillProductNameCopies(admin, {
      id: p.id,
      name: "Jarra de vidro",
    });
    expect(done).toEqual({ items: 0, tasks: 0, requests: 0 });
    for (const o of [signed, closed])
      expect((await store.get("order_items", o.item.id))?.name).toBe(XPTO);
  });

  it("nome de exemplo no cadastro não leva nada a lugar nenhum", async () => {
    const p = await product(XPTO);
    await purchaseOrder(p.id, "");
    expect(
      await fillProductNameCopies(admin, { id: p.id, name: XPTO }),
    ).toEqual({ items: 0, tasks: 0, requests: 0 });
  });
});
