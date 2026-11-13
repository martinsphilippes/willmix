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
const gates = await import("./helpers/product-gates");

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
  /** Linha dos produtos (padrão: a primeira, que não exige certificação). */
  lineIdOf: string | null = null,
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
  const lineId = lineIdOf ?? (await store.list("product_lines"))[0].id;
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
  it("junta os produtos aprovados do fornecedor e abre as raias na sequência do mapa", async () => {
    const store = getStore();
    // Brinquedos exige Inmetro: certificado e arte final com o selo entram.
    const [r1, r2] = await approvedProducts(
      null,
      ["PO-1", "PO-2"],
      "linha-brinquedos",
    );
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

    // As raias, item a item: cadastro (NCM e ficha), fornecedor, arte e
    // certificadora (a linha exige certificação).
    const reqs = await requirementsOf(order.id);
    const prep = reqs.filter((r) => r.key.includes("__"));
    expect(prep).toHaveLength(2 * 10);
    const roles = new Set(prep.map((r) => r.role));
    expect(roles).toEqual(new Set(["supplier", "agency", "operator", "ocp"]));
    // Avisos das raias: fornecedor e certificadora na hora; a agência só com
    // a faca e a foto em alta; Vendas fica sabendo do que vem.
    const linked = async (u: User) =>
      (
        await store.list("notifications", {
          filter: { userId: u.id, channel: "inapp" },
        })
      ).filter((n) => n.link === `/app/orders/${order.id}`);
    for (const u of [supplierA, ocp]) expect((await linked(u)).length).toBe(1);
    expect(await linked(agency)).toHaveLength(0);
    // Vendas: quem tem a ação "Receber o aviso de pedido de compra" (padrão:
    // quem abre Pós-venda, como o operador de compras do seed).
    const operator = (await store.list("users")).find(
      (u) => u.email === "operador@wellmix.com",
    )!;
    expect(
      (await linked(operator)).some((n) => /o que vem/.test(n.subject)),
    ).toBe(true);
    expect(
      (await linked(admin)).some((n) => /NCM e ficha/.test(n.subject)),
    ).toBe(true);

    const [itemA, itemB] = [...items].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const k = (base: string, id: string) => `${base}__${id}`;
    // NCM e ficha: o sistema confere; ninguém marca à mão.
    const ncmReq = reqs.find((r) => r.key === k("ncm_validated", itemA.id))!;
    await expect(
      engine.submitRequirement(admin, ncmReq.id, { value: "ok" }),
    ).rejects.toThrow();
    // A arte espera a faca e a foto em alta do fornecedor (P4 → P5).
    await expect(
      submit(agency, order.id, k("art", itemA.id), { file: "arte.pdf" }),
    ).rejects.toThrow("lane_prerequisite");
    await submit(supplierA, order.id, k("die_cut", itemA.id), {
      file: "faca.pdf",
    });
    expect(await linked(agency)).toHaveLength(0);
    await submit(supplierA, order.id, k("hd_photo", itemA.id), {
      file: "foto.pdf",
    });
    // Faca e foto em alta na mão: a agência é avisada para criar a arte.
    expect(
      (await linked(agency)).some((n) => /faca e foto/.test(n.subject)),
    ).toBe(true);

    // Ordem dentro da raia: sem arte não valida; sem certificado não há arte final.
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
      if (item === itemB) {
        await submit(supplierA, order.id, k("die_cut", item.id), {
          file: "faca.pdf",
        });
        await submit(supplierA, order.id, k("hd_photo", item.id), {
          file: "foto.pdf",
        });
      }
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

    // Fornecedor, arte e certificado prontos, mas o contrato espera o
    // cadastro: NCM validado e ficha completa de cada produto (P9/P14).
    expect((await store.get("orders", order.id))!.status).toBe("PREPARATION");
    await gates.validateNcm(admin, itemA.productId!);
    expect(
      (await requirementsOf(order.id)).find(
        (r) => r.key === k("ncm_validated", itemA.id),
      )!.status,
    ).toBe("done");
    await gates.readyOrderProducts(admin, order.id);

    // Raias concluídas: o contrato (com a arte final) espera as duas assinaturas.
    const afterLanes = (await store.get("orders", order.id))!;
    expect(afterLanes.status).toBe("PACKAGING");
    // Pedido de amostras (P17): a Wellmix decide antes de assinar.
    const before = (await signature.getOrderSignatureView(admin, order.id))!;
    expect(before.samplesPending).toBe(true);
    expect(before.canSign).toBeNull();
    await expect(
      signature.signOrderDocument(admin, order.id, {
        name: "Ana Wellmix",
        agree: true,
        hash: before.hash,
        signedFile: pdf("cedo.pdf"),
      }),
    ).rejects.toThrow("signature_samples_pending");
    // 5 × 3 por variante: o produto A tem duas variantes; o B, nenhuma (conta 1).
    const pv = await import("@/lib/services/product-variants");
    for (const name of ["Azul", "Verde"])
      await pv.upsertProductVariant(admin, itemA.productId!, {
        name,
        factoryItemCode: `PO-1-${name}`,
        sortOrder: 0,
      });
    const samples = await import("@/lib/services/sample-order");
    const doc = await samples.decideSampleOrder(admin, order.id, {
      status: "ordered",
    });
    expect(doc.lines.map((l) => [l.itemId, l.variants, l.quantity])).toEqual([
      [itemA.id, 2, 30],
      [itemB.id, 1, 15],
    ]);
    await expect(
      samples.decideSampleOrder(admin, order.id, { status: "none" }),
    ).rejects.toThrow("sample_order_already_done");
    // O fornecedor aceita o pedido de amostras à parte.
    const supplierView = (await samples.getSampleOrderView(
      supplierA,
      order.id,
    ))!;
    expect(supplierView.canAccept).toBe(true);
    await samples.acceptSampleOrder(supplierA, order.id, {
      name: "Li Supplier",
      agree: true,
      hash: doc.hash,
    });
    expect(
      (await requirementsOf(order.id)).find(
        (r) => r.key === "sample_order_supplier",
      )!.status,
    ).toBe("done");
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
    // Assinado pelos dois, mas a produção espera o sinal (a condição do
    // fornecedor tem parcela no pedido gerado) ou a conta corrente (P12?).
    const signed = (await store.get("orders", order.id))!;
    expect(signed.status).toBe("PACKAGING");
    const downPayment = (await requirementsOf(order.id)).find(
      (r) => r.key === "down_payment",
    )!;
    expect(downPayment.status).toBe("pending");
    const { productionStartFor } = signature;
    expect((await productionStartFor(order.id)).at).toBeNull();
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

/**
 * Pedido de compra levado até o contrato pela sequência do mapa: fornecedor,
 * arte (e certificado, quando a linha exige), cadastro e as duas assinaturas.
 */
async function signedPurchaseOrder(
  codes: [string, string],
  lineId: string | null = null,
) {
  const store = getStore();
  const [r1, r2] = await approvedProducts(null, codes, lineId);
  const order = await po.createPurchaseOrder(admin, [
    { requestId: r1.id, quantity: null },
    { requestId: r2.id, quantity: null },
  ]);
  const items = await store.list("order_items", {
    filter: { orderId: order.id },
  });
  const k = (base: string, id: string) => `${base}__${id}`;
  for (const item of items) {
    await submit(supplierA, order.id, k("die_cut", item.id), { file: "f.pdf" });
    await submit(supplierA, order.id, k("hd_photo", item.id), {
      file: "h.pdf",
    });
    await submit(supplierA, order.id, k("moq_confirmed", item.id), {
      value: "1000",
    });
    await submit(supplierA, order.id, k("lead_time_confirmed", item.id), {
      value: "30",
    });
    await submit(agency, order.id, k("art", item.id), { file: "a.pdf" });
    const review = (await requirementsOf(order.id)).find(
      (r) => r.key === k("art_review", item.id),
    )!;
    await engine.decideRequirement(admin, review.id, "approve");
  }
  await gates.readyOrderProducts(admin, order.id);
  expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
  // Sem amostras neste pedido: o aceite do fornecedor fica dispensado.
  const samples = await import("@/lib/services/sample-order");
  await samples.decideSampleOrder(admin, order.id, { status: "none" });
  expect(
    (await requirementsOf(order.id)).find(
      (r) => r.key === "sample_order_supplier",
    ),
  ).toMatchObject({ status: "done", value: "not_applicable" });
  const view = (await signature.getOrderSignatureView(admin, order.id))!;
  for (const [who, name] of [
    [admin, "Ana Wellmix"],
    [supplierA, "Li Supplier"],
  ] as const)
    await signature.signOrderDocument(who, order.id, {
      name,
      agree: true,
      hash: view.hash,
      signedFile: pdf(`${name}.pdf`),
    });
  return { order, items };
}

describe("pedido de compra: sequência do mapa do processo", () => {
  it("linha sem certificação: sem certificado nem arte final; o contrato vem da arte validada", async () => {
    const store = getStore();
    const [r1] = await approvedProducts(null, ["SQ-0", "SQ-00"]);
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
    ]);
    const keys = (await requirementsOf(order.id)).map(
      (r) => r.key.split("__")[0],
    );
    expect(keys).not.toContain("certificate");
    expect(keys).not.toContain("art_final");
    expect(keys).toEqual(
      expect.arrayContaining(["ncm_validated", "sheet_complete", "art"]),
    );
    // A certificadora não recebe nada deste pedido.
    const ocpNotes = await store.list("notifications", {
      filter: { userId: ocp.id, channel: "inapp" },
    });
    expect(ocpNotes.some((n) => n.link === `/app/orders/${order.id}`)).toBe(
      false,
    );
  });

  it("sinal pago libera a produção; o início dela conta da liberação", async () => {
    const store = getStore();
    const { order } = await signedPurchaseOrder(["SQ-1", "SQ-2"]);
    // Assinado pelos dois: a produção espera o sinal (30% no pedido gerado).
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    const finance = await store.list("notifications", {
      filter: { userId: admin.id, channel: "inapp" },
    });
    expect(
      finance.some(
        (n) =>
          n.link === `/app/orders/${order.id}` &&
          /pagar o sinal/.test(n.subject),
      ),
    ).toBe(true);
    // Pagamento pedido ao banco ainda não é sinal pago.
    const pay = await import("@/lib/services/supplier-payment");
    const requested = await pay.registerSupplierPayment(admin, order.id, {
      method: "transfer_copied",
    });
    expect((await store.get("orders", order.id))!.status).toBe("PACKAGING");
    await pay.markSupplierPaymentPaid(admin, order.id, requested.id, {});
    const released = (await store.get("orders", order.id))!;
    expect(released.status).toBe("INSPECTION");
    const down = (await requirementsOf(order.id)).find(
      (r) => r.key === "down_payment",
    )!;
    expect(down).toMatchObject({ status: "done", value: "paid" });
    expect((await signature.productionStartFor(order.id)).at).not.toBeNull();
    // O fornecedor fica sabendo que pode produzir.
    const supplierNotes = await store.list("notifications", {
      filter: { userId: supplierA.id, channel: "inapp" },
    });
    expect(
      supplierNotes.some(
        (n) =>
          n.link === `/app/orders/${order.id}` &&
          /produção liberada|production released|已放行生产/.test(n.subject),
      ),
    ).toBe(true);
  });

  it("conta corrente com o fornecedor: a produção começa com as duas assinaturas", async () => {
    const store = getStore();
    const terms = await import("@/lib/services/supplier-terms");
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
      terms: [{ percent: 100, base: "delivered", days: 60 }],
      note: null,
    });
    try {
      const { order } = await signedPurchaseOrder(["SQ-3", "SQ-4"]);
      expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");
      const down = (await requirementsOf(order.id)).find(
        (r) => r.key === "down_payment",
      )!;
      expect(down).toMatchObject({ status: "done", value: "current_account" });
    } finally {
      await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
        terms: [
          { percent: 30, base: "order_created", days: 0 },
          { percent: 70, base: "delivered", days: 90 },
        ],
        note: null,
      });
    }
  });

  it("certificação válida pelo período do pedido dispensa a certificadora (P8)", async () => {
    const store = getStore();
    const compliance = await import("@/lib/services/compliance");
    const [r1, r2] = await approvedProducts(
      null,
      ["SQ-5", "SQ-6"],
      "linha-brinquedos",
    );
    const productOf = async (id: string) =>
      (await store.get("supplier_requests", id))!.productId!;
    const [p1, p2] = [await productOf(r1.id), await productOf(r2.id)];
    const valid = (days: number) =>
      new Date(Date.now() + days * 86_400_000).toISOString();
    // Um vale o período (120 dias); o outro vence antes e precisa renovar.
    await compliance.addCertification(admin, "product", p1, {
      kind: "Inmetro",
      number: "INM-1",
      validUntil: valid(400),
      status: "valid",
    });
    await compliance.addCertification(admin, "product", p2, {
      kind: "Inmetro",
      number: "INM-2",
      validUntil: valid(30),
      status: "valid",
    });
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
      { requestId: r2.id, quantity: null },
    ]);
    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    const certOf = async (productId: string) => {
      const item = items.find((i) => i.productId === productId)!;
      return (await requirementsOf(order.id)).find(
        (r) => r.key === `certificate__${item.id}`,
      )!;
    };
    expect(await certOf(p1)).toMatchObject({
      status: "done",
      value: "valid",
    });
    expect((await certOf(p2)).status).toBe("pending");
    // Renovada no cadastro do produto: o item fecha sozinho.
    await compliance.addCertification(admin, "product", p2, {
      kind: "Inmetro",
      number: "INM-2b",
      validUntil: valid(500),
      status: "valid",
    });
    expect((await certOf(p2)).status).toBe("done");
  });

  it("mesas de trabalho: cada área vê a fila dela, já liberada e com prazo", async () => {
    const store = getStore();
    const desks = await import("@/lib/services/desks");
    const [r1] = await approvedProducts(
      null,
      ["DK-1", "DK-2"],
      "linha-brinquedos",
    );
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
    ]);
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    const rowsOf = async (u: User, desk: (typeof desks.DESK_KEYS)[number]) =>
      Object.fromEntries(
        (await desks.loadDesk(u, desk)).map((q) => [
          q.key,
          q.rows.filter((r) => r.orderNumber === order.number),
        ]),
      );
    // Quem tem mesa: a Wellmix (todas), a agência e a certificadora (a sua).
    expect(desks.desksFor(admin)).toContain("cadastro");
    expect(desks.desksFor(agency)).toEqual(["agency"]);
    expect(desks.desksFor(ocp)).toEqual(["ocp"]);
    expect(desks.desksFor(supplierA)).toEqual([]);
    expect(await desks.loadDesk(supplierA, "cadastro")).toEqual([]);
    // Cadastro: NCM e ficha a fazer, com o atalho para a tela do produto.
    const cadastro = await rowsOf(admin, "cadastro");
    expect(cadastro.ncm).toHaveLength(1);
    expect(cadastro.ncm[0].link).toBe(`/app/products/${item.productId}/tax`);
    expect(cadastro.ncm[0].dueAt).toBeTruthy();
    expect(cadastro.sheet).toHaveLength(1);
    // Certificadora: o certificado do pedido dela.
    expect((await rowsOf(ocp, "ocp")).certificates).toHaveLength(1);
    // Agência: a arte só entra na fila com a faca e a foto em alta.
    expect((await rowsOf(agency, "agency")).art).toHaveLength(0);
    const k = (base: string) => `${base}__${item.id}`;
    await submit(supplierA, order.id, k("die_cut"), { file: "f.pdf" });
    await submit(supplierA, order.id, k("hd_photo"), { file: "h.pdf" });
    const art = (await rowsOf(agency, "agency")).art;
    expect(art).toHaveLength(1);
    expect(art[0].dueAt).toBeTruthy();
    // Marketing: a validação entra quando a arte chega.
    expect((await rowsOf(admin, "mkt")).artReview).toHaveLength(0);
    await submit(agency, order.id, k("art"), { file: "a.pdf" });
    expect((await rowsOf(admin, "mkt")).artReview).toHaveLength(1);
    expect((await rowsOf(agency, "agency")).art).toHaveLength(0);
    // NCM validado: sai da fila do cadastro.
    await gates.validateNcm(admin, item.productId!);
    expect((await rowsOf(admin, "cadastro")).ncm).toHaveLength(0);
  });

  it("prazo de cada passo conta da liberação do anterior", async () => {
    const lanes = await import("@/lib/purchase-lanes");
    const sla = {
      artDays: 5,
      reviewDays: 2,
      dieCutDays: 7,
      finalDays: 3,
      signatureDays: 2,
      downPaymentDays: 3,
    };
    const created = "2026-11-01T12:00:00.000Z";
    const reqs = [
      {
        key: "die_cut__i",
        status: "done",
        submittedAt: "2026-11-03T12:00:00.000Z",
      },
      {
        key: "hd_photo__i",
        status: "done",
        submittedAt: "2026-11-04T12:00:00.000Z",
      },
      { key: "art__i", status: "pending", submittedAt: null },
      {
        key: "order_signed_wellmix",
        status: "done",
        submittedAt: "2026-11-10T12:00:00.000Z",
      },
      { key: "order_signed_supplier", status: "pending", submittedAt: null },
      { key: "down_payment", status: "pending", submittedAt: null },
    ] as Array<
      Pick<import("@/lib/db").Requirement, "key" | "status" | "submittedAt">
    >;
    // Faca: do pedido; arte: da última peça do fornecedor (foto em alta).
    expect(lanes.laneDueAt("die_cut__i", created, reqs, sla)).toBe(
      "2026-11-08T12:00:00.000Z",
    );
    expect(lanes.laneDueAt("art__i", created, reqs, sla)).toBe(
      "2026-11-09T12:00:00.000Z",
    );
    // Fornecedor assina contando da Wellmix; o sinal espera os dois.
    expect(lanes.laneDueAt("order_signed_supplier", created, reqs, sla)).toBe(
      "2026-11-12T12:00:00.000Z",
    );
    expect(lanes.laneDueAt("down_payment", created, reqs, sla)).toBeNull();
    expect(lanes.blockedBy("down_payment", reqs)).toEqual([
      "order_signed_supplier",
    ]);
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

    // Visão do login Trading (dono, 13/11/2026): com a faca, a foto em alta
    // e o prazo de cada produto enviados, a etapa 2 ("Die-Cut") aparece
    // concluída para ele, contada do que está gravado. A etapa de verdade e
    // o andamento do pedido seguem com a arte e o certificado em aberto.
    const { supplierLaneView } = await import("@/lib/purchase-lanes");
    const tradingUser = { ...supplierA, partyId: trading.id };
    const [prep] = await store.list("stages", {
      filter: { orderId: order.id, key: "PREPARATION" },
    });
    const prepReqs = async () =>
      (await requirementsOf(order.id)).filter((r) => r.stageId === prep.id);
    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(supplierLaneView(prep, await prepReqs())).toMatchObject({
      status: "active",
      done: 0,
      total: 6,
      percent: 0,
    });
    for (const [i, item] of items.entries()) {
      const k = (base: string) => `${base}__${item.id}`;
      await submit(tradingUser, order.id, k("die_cut"), { file: "faca.pdf" });
      await submit(tradingUser, order.id, k("hd_photo"), { file: "hd.pdf" });
      // Com a faca e a foto do primeiro produto, a visão é parcial (2 de 6).
      if (i === 0)
        expect(supplierLaneView(prep, await prepReqs())).toMatchObject({
          done: 2,
          percent: 33,
          complete: false,
        });
      await submit(tradingUser, order.id, k("lead_time_confirmed"), {
        value: "30",
      });
    }
    const stage = (await store.get("stages", prep.id))!;
    const view = supplierLaneView(stage, await prepReqs())!;
    expect(view).toMatchObject({
      status: "done",
      done: 6,
      total: 6,
      percent: 100,
      complete: true,
    });
    expect(view.completedAt).toBeTruthy();
    expect(stage.status).toBe("active");
    expect(stage.percent).toBeLessThan(100);
    expect((await store.get("orders", order.id))!.status).toBe("PREPARATION");
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

  it("Preparação na visão do fornecedor: três tarefas por produto e o prazo registrado", async () => {
    const store = getStore();
    const dieCut = await import("@/lib/services/die-cut-step");
    const { baseKeyOf, supplierSeesLaneRequirement } =
      await import("@/lib/purchase-lanes");
    const [r1, r2] = await approvedProducts(null, ["SV-1", "SV-2"]);
    // O segundo produto ficou sem prazo na solicitação (resposta sem o prazo).
    await store.update("supplier_requests", r2.id, {
      supplierLeadTimeDays: null,
    });
    const order = await po.createPurchaseOrder(admin, [
      { requestId: r1.id, quantity: null },
      { requestId: r2.id, quantity: null },
    ]);
    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    const itemOf = async (requestId: string) => {
      const request = (await store.get("supplier_requests", requestId))!;
      return items.find((i) => i.productId === request.productId)!;
    };
    const registered = await itemOf(r1.id);
    const manual = await itemOf(r2.id);

    // O prazo registrado de cada item: é ele que preenche o campo do
    // fornecedor; sem registro, o campo fica vazio.
    const terms = await dieCut.negotiatedTerms(order);
    expect(terms.get(registered.id)?.days).toBe(30);
    expect(terms.get(manual.id)?.days).toBeNull();

    // O fornecedor vê três tarefas por produto; as oito continuam na etapa.
    const [prep] = await store.list("stages", {
      filter: { orderId: order.id, key: "PREPARATION" },
    });
    const ofPrep = async () =>
      (await requirementsOf(order.id)).filter((r) => r.stageId === prep.id);
    const reqs = await ofPrep();
    expect(reqs).toHaveLength(16);
    const seen = reqs.filter(supplierSeesLaneRequirement);
    expect(seen).toHaveLength(6);
    expect([...new Set(seen.map((r) => baseKeyOf(r.key)))].sort()).toEqual([
      "die_cut",
      "hd_photo",
      "lead_time_confirmed",
    ]);
    expect(reqs.every((r) => r.required && r.status === "pending")).toBe(true);

    // Preencher o campo não confirma nada: a confirmação segue o envio de
    // sempre (o registrado num item, o digitado no outro).
    const k = (base: string, itemId: string) => `${base}__${itemId}`;
    await submit(supplierA, order.id, k("lead_time_confirmed", registered.id), {
      value: "30",
    });
    await submit(supplierA, order.id, k("lead_time_confirmed", manual.id), {
      value: "40",
    });
    const after = await ofPrep();
    const lead = (itemId: string) =>
      after.find((r) => r.key === k("lead_time_confirmed", itemId))!;
    expect(lead(registered.id)).toMatchObject({ status: "done", value: "30" });
    expect(lead(manual.id)).toMatchObject({ status: "done", value: "40" });
    // O MOQ, que ele não vê nessa seção, continua pendente e obrigatório: ele
    // confirma no quadro Die Cut (com o negociado já no campo) ou a Wellmix.
    expect(
      after.find((r) => r.key === k("moq_confirmed", registered.id)),
    ).toMatchObject({ status: "pending", required: true, role: "supplier" });
    const view = (await dieCut.getDieCutView(supplierA, order.id))!;
    expect(view.products.find((p) => p.itemId === registered.id)).toMatchObject(
      { missing: ["dieline", "hd", "moq"], negotiatedMoq: 1000 },
    );
  });
});
