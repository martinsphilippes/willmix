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
const { approveSample } = await import("./helpers/sampling");

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
async function approvedProducts(
  partnerId: string | null = null,
  codes: [string, string] = ["PO-1", "PO-2"],
) {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(
    admin,
    sheet([row(codes[0], "Glass jar 350ml"), row(codes[1], "Glass cup tall")]),
  );
  if (partnerId) await lots.setBookingLotPartner(admin, lot.id, partnerId);
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
    // Só o fornecedor responde: com parceiro, um login do parceiro.
    const answerer = partnerId
      ? { ...supplierA, partyId: partnerId }
      : supplierA;
    await svc.answerSupplierRequest(answerer, request.id, {
      canDo: "yes",
      price: 1.1 + i,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 30,
      note: null,
    });
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    await approveSample(admin, request.id);
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

describe("pedido em nome do responsável pelo booking (trading)", () => {
  it("o pedido sai em nome da trading e o contrato traz a fábrica do booking", async () => {
    const store = getStore();
    const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
    const trading = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type: "trading",
      name: "Trading Ningbo PO",
      country: "CN",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
      city: "Ningbo",
      contactName: null,
      wechat: null,
      operationMode: null,
      radar: null,
    });
    const [r1, r2] = await approvedProducts(trading.id, ["TR-1", "TR-2"]);
    expect(r1.supplierId).toBe(trading.id);
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
      { requestId: r2.id, quantity: null },
    ]);
    expect(order.supplierId).toBe(trading.id);
    const doc = await signature.buildOrderDocument(order);
    expect(doc.supplierName).toBe("Trading Ningbo PO");
    expect(doc.manufacturers).toEqual(["Shenzhen Supplier A"]);
    // Na Produção, "trade": a fábrica do booking entra sozinha.
    const { bookingFactory } = await import("@/lib/services/production");
    expect((await bookingFactory(order))?.name).toBe("Shenzhen Supplier A");
  });

  it("pedido do próprio fornecedor: o contrato não ganha a chave da fábrica", async () => {
    const [r1] = await approvedProducts(null, ["SF-1", "SF-2"]);
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
    ]);
    const doc = await signature.buildOrderDocument(order);
    expect("manufacturers" in doc).toBe(false);
  });

  it("quadro Die Cut: pendência por produto, quatro itens e aviso à Wellmix", async () => {
    const store = getStore();
    const dieCut = await import("@/lib/services/die-cut-step");
    const [r1] = await approvedProducts(null, ["DC-1", "DC-2"]);
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
    ]);
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    const href = `/app/orders/${order.id}/die-cut#item-${item.id}`;
    const mine = async () =>
      (await pendingTasksFor(supplierA)).filter((t) => t.orderId === order.id);

    // A pendência do fornecedor cai na etapa Die Cut e abre o quadro.
    const tasks = await mine();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      group: "supplier.dieline",
      supplierStep: "dieline",
      link: href,
      text: { title: "tasks.dieline.title" },
    });

    // O quadro traz os quatro itens e o negociado na solicitação.
    let view = (await dieCut.getDieCutView(supplierA, order.id))!;
    expect(view.open).toBe(true);
    expect(view.canAct).toBe(true);
    expect(view.products).toHaveLength(1);
    expect(view.products[0]).toMatchObject({
      itemId: item.id,
      negotiatedMoq: 1000,
      negotiatedLeadTimeDays: 30,
      complete: false,
      missing: ["dieline", "hd", "moq", "leadTime"],
    });
    // Só a Wellmix e o fornecedor do pedido abrem.
    expect(await dieCut.getDieCutView(agency, order.id)).toBeNull();
    expect(await dieCut.getDieCutView(admin, order.id)).not.toBeNull();
    await expect(
      dieCut.confirmDieCutTerms(agency, order.id, item.id, {
        moq: 1,
        leadTimeDays: 1,
      }),
    ).rejects.toThrow("not_found");

    const k = (base: string) => `${base}__${item.id}`;
    const notices = async () =>
      (await store.list("notifications")).filter((n) => n.link === href);
    await submit(supplierA, order.id, k("die_cut"), { file: "faca.pdf" });
    await submit(supplierA, order.id, k("hd_photo"), { file: "hd.pdf" });
    expect(await notices()).toHaveLength(0);
    // Confirma os dois números de uma vez, com o prazo diferente do negociado.
    await dieCut.confirmDieCutTerms(supplierA, order.id, item.id, {
      moq: 1000,
      leadTimeDays: 45,
    });
    view = (await dieCut.getDieCutView(supplierA, order.id))!;
    expect(view.products[0].complete).toBe(true);
    expect(view.products[0].items.moq?.value).toBe("1000");
    expect(view.products[0].items.leadTime?.value).toBe("45");
    expect(view.documents.size).toBe(2);
    expect(await mine()).toHaveLength(0);

    // Completo: um aviso só à Wellmix, com o número de antes.
    let sent = await notices();
    const subjects = () => [...new Set(sent.map((n) => n.subject))];
    expect(subjects()).toHaveLength(1);
    expect(subjects()[0]).toContain("mudou pedido mínimo ou prazo");
    expect(sent[0].body).toContain("45 dias");
    expect(sent[0].body).toContain("Antes: 1000 peças e 30 dias");

    // Confirmar de novo sem mudar nada não avisa; mudando, avisa com o de antes.
    const count = sent.length;
    await dieCut.confirmDieCutTerms(supplierA, order.id, item.id, {
      moq: 1000,
      leadTimeDays: 45,
    });
    expect(await notices()).toHaveLength(count);
    await dieCut.confirmDieCutTerms(supplierA, order.id, item.id, {
      moq: 1200,
      leadTimeDays: 45,
    });
    sent = await notices();
    expect(sent.length).toBeGreaterThan(count);
    expect(
      sent.some((n) => n.body.includes("Antes: 1000 peças e 45 dias")),
    ).toBe(true);
  });
});
