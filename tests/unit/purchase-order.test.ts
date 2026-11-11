import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Pedido de compra (docs/PURCHASE_ORDER.md): as solicitações aprovadas do
 * mesmo fornecedor, com o produto cadastrado, viram um pedido. "Pedido
 * criado" conclui sozinho; a Preparação traz as três raias (fornecedor,
 * agência de arte e certificadora) item a item, com a ordem dentro delas; o
 * contrato só conclui com os dois arquivos assinados.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const product = await import("@/lib/services/supplier-request-product");
const po = await import("@/lib/services/purchase-order");
const engine = await import("@/lib/workflow/engine");
const signature = await import("@/lib/services/order-signature");
const { uploadDocument } = await import("@/lib/services/documents");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let agency: User;
let ocp: User;

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
  "PURCHASE QTY IN PCS",
];
const row = (sku: string, desc: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  desc,
  "FOB",
  "USD",
  "1.25",
  "48",
  "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  "20",
  "350",
  "color box",
  "glass",
  "1000",
  "3000",
];
const sheet = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "po.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: "application/pdf",
  });

/** Duas solicitações aprovadas do fornecedor A, cada uma com o produto cadastrado. */
async function approvedProducts() {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(
    admin,
    sheet([row("PO-1", "Glass jar 350ml"), row("PO-2", "Glass cup tall")]),
  );
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  const items = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  await setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  await lots.closeBookingLot(admin, lot.id, null);
  const lineId = (await store.list("product_lines"))[0].id;
  const out = [];
  for (const [i, item] of items.entries()) {
    const request = await svc.openSupplierRequest(admin, {
      itemId: item.id,
      alternativeIds: [],
      quantity: null,
      needs: null,
      searchQuery: null,
    });
    await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 1.1 + i,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 30,
      note: null,
    });
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    await product.createProductFromRequest(admin, request.id, {
      name: `Produto PO ${i + 1}`,
      lineId,
      itemIds: [item.id],
    });
    out.push(request);
  }
  return out;
}

async function requirementsOf(orderId: string) {
  return getStore().list("requirements", { filter: { orderId } });
}

async function submit(
  user: User,
  orderId: string,
  key: string,
  input: { value?: string; file?: string },
) {
  const req = (await requirementsOf(orderId)).find((r) => r.key === key)!;
  const documentId = input.file
    ? (
        await uploadDocument(user, pdf(input.file), {
          orderId,
          requirementId: req.id,
          type: "attachment",
        })
      ).id
    : undefined;
  await engine.submitRequirement(user, req.id, {
    value: input.value ?? null,
    documentId,
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  agency = users.find((u) => u.email === "agencia@design.com")!;
  ocp = users.find((u) => u.email === "ocp@certifica.com")!;
});

describe("pedido de compra", () => {
  it("junta os produtos aprovados do fornecedor e abre as três raias", async () => {
    const store = getStore();
    const [r1, r2] = await approvedProducts();
    const groups = (await po.listPurchaseCandidates(admin))!;
    const group = groups.find((g) => g.supplierId === r1.supplierId)!;
    expect(group.candidates.map((c) => c.request.id).sort()).toEqual(
      [r1.id, r2.id].sort(),
    );

    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
      { requestId: r2.id, quantity: 5000 },
    ]);
    expect(order).toMatchObject({
      flow: "supplier_request",
      supplierId: r1.supplierId,
      fobCurrency: "USD",
      status: "PREPARATION",
    });
    expect(order.agencyId).toBeTruthy();
    expect(order.ocpId).toBeTruthy();
    const customer = await store.get("parties", order.customerId);
    // Comprador: o cadastro de cliente da Wellmix com o CODEMP do Sankhya (3).
    expect(customer).toMatchObject({ type: "customer", sankhyaCode: "3" });
    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(items.map((i) => i.quantity).sort()).toEqual([3000, 5000]);
    expect(order.fobTotal).toBeCloseTo(1.1 * 3000 + 2.1 * 5000);
    // A solicitação fica presa ao pedido e sai da lista de candidatas.
    expect((await store.get("supplier_requests", r1.id))!.orderId).toBe(
      order.id,
    );
    await expect(
      po.createPurchaseOrder(admin, [{ requestId: r1.id, quantity: null }]),
    ).rejects.toThrow("purchase_order_taken");

    // As três raias, item a item.
    const reqs = await requirementsOf(order.id);
    const prep = reqs.filter((r) => r.key.includes("__"));
    expect(prep).toHaveLength(2 * 8);
    const roles = new Set(prep.map((r) => r.role));
    expect(roles).toEqual(new Set(["supplier", "agency", "operator", "ocp"]));
    // Avisos das raias: fornecedor, agência e certificadora.
    for (const u of [supplierA, agency, ocp]) {
      const notes = await store.list("notifications", {
        filter: { userId: u.id, channel: "inapp" },
      });
      expect(notes.some((n) => n.link === `/app/orders/${order.id}`)).toBe(
        true,
      );
    }

    // Ordem dentro da raia: sem arte não valida; sem certificado não há arte final.
    const [itemA, itemB] = [...items].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const k = (base: string, id: string) => `${base}__${id}`;
    const review = reqs.find((r) => r.key === k("art_review", itemA.id))!;
    await expect(
      engine.decideRequirement(admin, review.id, "approve"),
    ).rejects.toThrow("art_missing");
    // A validação ainda não é pendência da Wellmix.
    expect(
      (await pendingTasksFor(admin)).some((t) =>
        t.detail.includes("Validação da arte"),
      ),
    ).toBe(false);
    await submit(agency, order.id, k("art", itemA.id), { file: "arte.pdf" });
    // Devolve: a arte volta para a agência.
    await engine.decideRequirement(admin, review.id, "reject", "Logo maior");
    expect(
      (await requirementsOf(order.id)).find(
        (r) => r.key === k("art", itemA.id),
      )!.status,
    ).toBe("rejected");
    await submit(agency, order.id, k("art", itemA.id), { file: "arte2.pdf" });
    await engine.decideRequirement(admin, review.id, "approve");
    await expect(
      submit(agency, order.id, k("art_final", itemA.id), { file: "final.pdf" }),
    ).rejects.toThrow("lane_prerequisite");
    await submit(ocp, order.id, k("certificate", itemA.id), {
      file: "certificado.pdf",
    });
    await submit(agency, order.id, k("art_final", itemA.id), {
      file: "final.pdf",
    });

    // Resto das raias: o fornecedor e o item B.
    for (const item of [itemA, itemB]) {
      await submit(supplierA, order.id, k("die_cut", item.id), {
        file: "faca.pdf",
      });
      await submit(supplierA, order.id, k("hd_photo", item.id), {
        file: "foto.pdf",
      });
      await submit(supplierA, order.id, k("moq_confirmed", item.id), {
        value: "1000",
      });
      await submit(supplierA, order.id, k("lead_time_confirmed", item.id), {
        value: "30",
      });
    }
    await submit(agency, order.id, k("art", itemB.id), { file: "b.pdf" });
    await engine.decideRequirement(
      admin,
      reqs.find((r) => r.key === k("art_review", itemB.id))!.id,
      "approve",
    );
    await submit(ocp, order.id, k("certificate", itemB.id), { file: "c.pdf" });
    await submit(agency, order.id, k("art_final", itemB.id), { file: "f.pdf" });

    // Raias concluídas: o contrato (com a arte final) espera as duas assinaturas.
    const afterLanes = (await store.get("orders", order.id))!;
    expect(afterLanes.status).toBe("PACKAGING");
    const view = (await signature.getOrderSignatureView(admin, order.id))!;
    expect(view.document.finalArts).toHaveLength(2);
    expect(view.document.items.every((i) => i.moq === 1000)).toBe(true);
    expect(view.canSign).toBe("wellmix");
    // Sem arquivo não assina.
    await expect(
      signature.signOrderDocument(admin, order.id, {
        name: "Ana Wellmix",
        agree: true,
        hash: view.hash,
      }),
    ).rejects.toThrow("signature_file_required");
    await signature.signOrderDocument(admin, order.id, {
      name: "Ana Wellmix",
      agree: true,
      hash: view.hash,
      signedFile: pdf("contrato-wellmix.pdf"),
    });
    await signature.signOrderDocument(supplierA, order.id, {
      name: "Li Supplier",
      agree: true,
      hash: view.hash,
      signedFile: pdf("contrato-fornecedor.pdf"),
    });
    const signed = (await store.get("orders", order.id))!;
    expect(signed.status).toBe("INSPECTION");
  });

  it("o comprador é o cliente com o CODEMP, nunca o cadastro de fornecedor da mesma empresa", async () => {
    const store = getStore();
    // A mesma empresa também cadastrada como fornecedor (como vem do Sankhya), mais antiga.
    await store.create("parties", {
      type: "supplier",
      name: "WELLMIX (fornecedor)",
      country: "BR",
      email: null,
      phone: null,
      taxId: "09517464000306",
      notes: null,
      active: true,
      sankhyaCode: "3",
    } as never);
    const buyer = await po.purchaseOrderCustomer();
    expect(buyer).toMatchObject({ id: "wellmix-sc", type: "customer" });
  });

  it("recusa produtos de fornecedores ou moedas diferentes e solicitação sem produto", async () => {
    await expect(po.createPurchaseOrder(admin, [])).rejects.toThrow(
      "purchase_order_choose_items",
    );
    await expect(
      po.createPurchaseOrder(supplierA, [{ requestId: "x", quantity: null }]),
    ).rejects.toThrow();
  });
});
