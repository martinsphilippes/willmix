import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Apagar os testes do portal (mantém o Sankhya): bookings, solicitações ao
 * fornecedor, agrupamentos e o que foi criado no portal saem; pedidos,
 * produtos e parceiros com código do Sankhya ficam.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const reset = await import("@/lib/services/portal-test-reset");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = (table: string, data: Record<string, unknown>): Promise<any> =>
  getStore().create(table as never, data as never);

describe("limpeza dos testes do portal", () => {
  it("apaga o que nasceu no portal e mantém o que veio do Sankhya", async () => {
    const store = getStore();
    const file = await store.putFile(
      new Uint8Array([1, 2, 3]),
      "a.jpg",
      "image/jpeg",
    );
    const photo = await create("documents", {
      type: "photo",
      name: "a.jpg",
      mime: "image/jpeg",
      size: 3,
      storageKey: file.key,
      version: 1,
      visibility: "internal",
    });
    const lot = await create("booking_lots", {
      number: 1,
      status: "draft",
      itemCount: 1,
    });
    const item = await create("booking_items", {
      lotId: lot.id,
      position: 0,
      photoDocumentId: photo.id,
    });
    const sr = await create("supplier_requests", {
      number: 1,
      status: "open",
      bookingItemId: item.id,
      bookingLotId: lot.id,
    });
    await create("selection_groups", {
      status: "open",
      itemIds: [item.id],
      supplierRequestId: sr.id,
    });
    const testProduct = await create("products", {
      name: "Produto de teste",
      sku: "TST-1",
      active: true,
      sankhyaCode: null,
    });
    await create("purchase_sheets", {
      orderId: testProduct.id,
      productId: testProduct.id,
    });
    const erpProduct = await create("products", {
      name: "Produto do Sankhya",
      sku: "WX-1",
      active: true,
      sankhyaCode: "123",
    });
    const erpRequest = await create("requests", {
      customerId: "cliente-joao",
      createdByUserId: joao.id,
      productId: erpProduct.id,
      productName: "Produto do Sankhya",
      description: "",
      quantity: 1,
      unit: "un",
      status: "ORDERED",
    });
    const erpOrder = await create("orders", {
      number: 900,
      requestId: erpRequest.id,
      customerId: "cliente-joao",
      status: "IN_PRODUCTION",
      sankhyaCode: "5555",
    });
    await store.update("requests", erpRequest.id, { orderId: erpOrder.id });
    const portalRequest = await create("requests", {
      customerId: "cliente-joao",
      createdByUserId: joao.id,
      productId: testProduct.id,
      productName: "Produto de teste",
      description: "",
      quantity: 1,
      unit: "un",
      status: "NEW",
    });
    await create("notifications", {
      userId: admin.id,
      channel: "in_app",
      subject: "SLA",
      body: "",
      link: `/app/supplier-requests/${sr.id}`,
      status: "sent",
    });
    await create("notifications", {
      userId: admin.id,
      channel: "in_app",
      subject: "Pedido do Sankhya",
      body: "",
      link: `/app/orders/${erpOrder.id}`,
      status: "sent",
    });
    await create("counters", { key: "booking_lot_number", value: 1 });

    await expect(reset.planPortalTestReset(joao)).rejects.toThrow("forbidden");
    await expect(reset.resetPortalTestData(admin, "errado")).rejects.toThrow(
      "reset_confirm",
    );
    const plan = await reset.planPortalTestReset(admin);
    expect(plan.remove.booking_lots).toBe(1);
    expect(plan.remove.supplier_requests).toBe(1);
    expect(plan.remove.selection_groups).toBe(1);
    expect(plan.files).toBe(1);

    const result = await reset.resetPortalTestData(admin, "apagar");
    expect(result.finished).toBe(true);

    expect(await store.list("booking_lots")).toHaveLength(0);
    expect(await store.list("booking_items")).toHaveLength(0);
    expect(await store.list("supplier_requests")).toHaveLength(0);
    expect(await store.list("selection_groups")).toHaveLength(0);
    expect(await store.get("documents", photo.id)).toBeNull();
    expect(await store.getFile(file.key)).toBeNull();
    expect(await store.get("products", testProduct.id)).toBeNull();
    expect(
      await store.list("purchase_sheets", {
        filter: { productId: testProduct.id },
      }),
    ).toHaveLength(0);
    expect(await store.get("requests", portalRequest.id)).toBeNull();
    // Do Sankhya: fica.
    expect(await store.get("products", erpProduct.id)).not.toBeNull();
    expect(await store.get("orders", erpOrder.id)).not.toBeNull();
    expect(await store.get("requests", erpRequest.id)).not.toBeNull();
    const notes = await store.list("notifications");
    expect(notes.some((n) => n.link?.includes(sr.id))).toBe(false);
    expect(notes.some((n) => n.link?.includes(erpOrder.id))).toBe(true);
    expect(
      (await store.list("counters")).some(
        (c) => c.key === "booking_lot_number",
      ),
    ).toBe(false);
    // Usuários e parceiros ficam.
    expect((await store.list("users")).length).toBeGreaterThan(0);
    expect(await store.get("parties", "cliente-joao")).not.toBeNull();

    // Rodar de novo: nada a fazer.
    const again = await reset.planPortalTestReset(admin);
    expect(again.total).toBe(0);
  });
});
