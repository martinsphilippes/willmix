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
    // Certificado: do despachante do pedido (dono, 13/11/2026).
    expect(order.brokerId).toBeTruthy();
    expect(roles).toEqual(
      new Set(["supplier", "agency", "operator", "broker"]),
    );
    // Avisos das raias: fornecedor e certificadora na hora; a agência só com
    // a faca e a foto em alta; Vendas fica sabendo do que vem.
    const linked = async (u: User) =>
      (
        await store.list("notifications", {
          filter: { userId: u.id, channel: "inapp" },
        })
      ).filter((n) => n.link === `/app/orders/${order.id}`);
    const broker = (await store.list("users")).find(
      (u) => u.role === "broker" && u.partyId === order.brokerId,
    )!;
    for (const u of [supplierA, broker])
      expect((await linked(u)).length).toBe(1);
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
  /** Pedido de amostras: "none" (padrão) ou gerado e aceito pelo fornecedor. */
  samplesStatus: "none" | "ordered" = "none",
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
  const samples = await import("@/lib/services/sample-order");
  if (samplesStatus === "ordered") {
    const doc = await samples.decideSampleOrder(admin, order.id, {
      status: "ordered",
    });
    await samples.acceptSampleOrder(supplierA, order.id, {
      name: "Li Supplier",
      agree: true,
      hash: doc.hash,
    });
  } else {
    // Sem amostras neste pedido: o aceite do fornecedor fica dispensado.
    await samples.decideSampleOrder(admin, order.id, { status: "none" });
    expect(
      (await requirementsOf(order.id)).find(
        (r) => r.key === "sample_order_supplier",
      ),
    ).toMatchObject({ status: "done", value: "not_applicable" });
  }
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

  it("inspeção: vídeo, conformidade, aprovação da Wellmix e tentativas (R3/R4?/R10)", async () => {
    const store = getStore();
    const terms = await import("@/lib/services/supplier-terms");
    const production = await import("@/lib/services/production");
    // Conta corrente: o pedido chega à inspeção com as duas assinaturas.
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
      terms: [{ percent: 100, base: "delivered", days: 60 }],
      note: null,
    });
    let order;
    let items;
    try {
      ({ order, items } = await signedPurchaseOrder(["IN-1", "IN-2"]));
    } finally {
      await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
        terms: [
          { percent: 30, base: "order_created", days: 0 },
          { percent: 70, base: "delivered", days: 90 },
        ],
        note: null,
      });
    }
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");
    await production.savePlan(admin, order.id, { etd: "2027-01-10" });
    const media = async () => {
      for (const key of ["photo_unpacked", "photo_packed", "photo_scale"])
        await submit(supplierA, order.id, key, { file: `${key}.pdf` });
      await submit(supplierA, order.id, "weight_measured", { value: "15" });
      await submit(supplierA, order.id, "production_video", {
        file: "video.pdf",
      });
      await submit(supplierA, order.id, "supplier_conformity", {
        value: "ok",
      });
    };
    const [a, b] = [...items].sort((x, y) =>
      x.createdAt.localeCompare(y.createdAt),
    );
    // A declaração espera as fotos, o peso e o vídeo; a Wellmix, a declaração.
    await expect(
      submit(supplierA, order.id, "supplier_conformity", { value: "ok" }),
    ).rejects.toThrow("lane_prerequisite");
    await expect(
      production.inspectSku(admin, order.id, {
        orderItemId: a.id,
        result: "approved",
        note: null,
      }),
    ).rejects.toThrow("conformity_required");
    await media();
    // Reprovado 1 a 3 vezes: ETD +1 dia e volta à produção a cada vez.
    for (let round = 1; round <= 3; round++) {
      const row = await production.inspectSku(admin, order.id, {
        orderItemId: a.id,
        result: "rejected",
        note: `Cor errada ${round}`,
      });
      expect(row.round).toBe(round);
      const track = (await production.getTrack(order.id))!;
      expect(track.etd!.slice(0, 10)).toBe(
        new Date(Date.parse("2027-01-10") + round * 86_400_000)
          .toISOString()
          .slice(0, 10),
      );
      const video = (await requirementsOf(order.id)).find(
        (r) => r.key === "production_video",
      )!;
      expect(video.status).toBe("pending");
      await production.respondSku(supplierA, row.id, `Corrigido ${round}`);
      await media();
    }
    // 4ª reprovação: passou do limite; a Wellmix confirma o cancelamento.
    const last = await production.inspectSku(admin, order.id, {
      orderItemId: a.id,
      result: "rejected",
      note: "Cor errada de novo",
    });
    expect(production.attemptsExhausted(last, 3)).toBe(true);
    await production.respondSku(supplierA, last.id, "Tentamos de novo");
    await expect(
      production.inspectSku(admin, order.id, {
        orderItemId: a.id,
        result: "approved",
        note: null,
      }),
    ).rejects.toThrow("attempts_exhausted");
    expect(
      (await store.list("audit_log", { filter: { entityId: order.id } })).some(
        (e) => e.action === "production.attempts_exhausted",
      ),
    ).toBe(true);
    // O outro produto aprovado não libera o embarque sozinho.
    await production.inspectSku(admin, order.id, {
      orderItemId: b.id,
      result: "approved",
      note: null,
    });
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");
  });

  it("inspeção aprovada em todos os SKUs libera o embarque", async () => {
    const store = getStore();
    const terms = await import("@/lib/services/supplier-terms");
    const production = await import("@/lib/services/production");
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
      terms: [{ percent: 100, base: "delivered", days: 60 }],
      note: null,
    });
    let order;
    let items;
    try {
      ({ order, items } = await signedPurchaseOrder(["IN-3", "IN-4"]));
    } finally {
      await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
        terms: [
          { percent: 30, base: "order_created", days: 0 },
          { percent: 70, base: "delivered", days: 90 },
        ],
        note: null,
      });
    }
    for (const key of ["photo_unpacked", "photo_packed", "photo_scale"])
      await submit(supplierA, order.id, key, { file: `${key}.pdf` });
    await submit(supplierA, order.id, "weight_measured", { value: "15" });
    await submit(supplierA, order.id, "production_video", { file: "v.pdf" });
    await submit(supplierA, order.id, "supplier_conformity", { value: "ok" });
    expect((await store.get("orders", order.id))!.status).toBe("INSPECTION");
    for (const item of items)
      await production.inspectSku(admin, order.id, {
        orderItemId: item.id,
        result: "approved",
        note: null,
      });
    expect(
      (await requirementsOf(order.id)).find((r) => r.key === "sku_approved"),
    ).toMatchObject({ status: "done", value: "approved" });
    expect((await store.get("orders", order.id))!.status).toBe("SHIPPING");
  });

  it("container na origem e o rastreio diário do Comex interno (R19 a R26)", async () => {
    const store = getStore();
    const terms = await import("@/lib/services/supplier-terms");
    const flow = await import("@/lib/services/import-flow");
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
      terms: [{ percent: 100, base: "delivered", days: 60 }],
      note: null,
    });
    let order;
    try {
      ({ order } = await signedPurchaseOrder(["OR-1", "OR-2"]));
    } finally {
      await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
        terms: [
          { percent: 30, base: "order_created", days: 0 },
          { percent: 70, base: "delivered", days: 90 },
        ],
        note: null,
      });
    }
    order = (await store.get("orders", order.id))!;
    expect(order.status).toBe("INSPECTION");
    const doc = async (user: User, name: string) =>
      (
        await uploadDocument(user, pdf(name), {
          orderId: order.id,
          type: "import_step",
        })
      ).id;
    const keysOf = async (user: User) =>
      (await flow.importTasks(user, [order]))
        .filter((t) => t.key.startsWith("container_"))
        .map((t) => t.key);
    // Antes do booking, nada do container.
    expect(await keysOf(supplierA)).toEqual([]);
    // Booking (sem agente designado, a Wellmix faz) e validado por outro login.
    const ops = await store.create("users", {
      email: "comex.interno@wellmix.com",
      name: "Clara Comex",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: "x",
      active: true,
      importerId: null,
      functions: ["comex_internal"],
      screens: null,
      mustChangePassword: false,
    } as never);
    await flow.submitStep(admin, order.id, "booking", { value: "BK-1" });
    await flow.validateStep(ops, order.id, "booking", "validated", null);
    // O fornecedor faz a sequência; cada passo só abre depois do anterior.
    expect(await keysOf(supplierA)).toEqual(["container_at_factory"]);
    await expect(
      flow.submitStep(supplierA, order.id, "container_empty", {
        documentId: await doc(supplierA, "vazio.pdf"),
      }),
    ).rejects.toThrow("previous_step");
    await flow.submitStep(supplierA, order.id, "container_at_factory", {
      value: "2027-01-12",
    });
    // Começou o rastreio: pendência diária do Comex interno.
    expect(await keysOf(ops)).toContain("container_tracking");
    await flow.submitStep(ops, order.id, "container_tracking", {
      value: "Container no depósito da fábrica",
    });
    expect(await keysOf(ops)).not.toContain("container_tracking");
    // O fornecedor não rastreia; o rastreio não é dele.
    await expect(
      flow.submitStep(supplierA, order.id, "container_tracking", {
        value: "x",
      }),
    ).rejects.toThrow();
    await flow.submitStep(supplierA, order.id, "container_empty", {
      documentId: await doc(supplierA, "vazio.pdf"),
    });
    await flow.submitStep(supplierA, order.id, "container_loaded", {
      value: "480 caixas, sem avarias",
      documentId: await doc(supplierA, "carga.pdf"),
    });
    // O carregamento é conferido pela Wellmix antes do lacre.
    await expect(
      flow.submitStep(supplierA, order.id, "container_sealed", {
        value: "MSCU1234567",
        documentId: await doc(supplierA, "lacre.pdf"),
      }),
    ).rejects.toThrow("previous_step");
    await flow.validateStep(
      ops,
      order.id,
      "container_loaded",
      "validated",
      null,
    );
    await flow.submitStep(supplierA, order.id, "container_sealed", {
      value: "MSCU1234567",
      documentId: await doc(supplierA, "lacre.pdf"),
    });
    await flow.submitStep(supplierA, order.id, "container_at_port", {
      value: "2027-01-15",
    });
    expect(await keysOf(supplierA)).toEqual([]);
    // No dia seguinte o rastreio volta a ser pendência.
    const [tracking] = await store.list("import_steps", {
      filter: { orderId: order.id, key: "container_tracking" },
    });
    await store.update("import_steps", tracking.id, {
      submittedAt: "2026-01-01T12:00:00.000Z",
    });
    expect(await keysOf(ops)).toContain("container_tracking");
  });

  it("documentos do embarque: check list, packing list, invoice e BL conferidos", async () => {
    const store = getStore();
    const terms = await import("@/lib/services/supplier-terms");
    const flow = await import("@/lib/services/import-flow");
    const docs = await import("@/lib/services/shipping-docs");
    await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
      terms: [{ percent: 100, base: "delivered", days: 60 }],
      note: null,
    });
    let order;
    try {
      ({ order } = await signedPurchaseOrder(["SD-1", "SD-2"]));
    } finally {
      await terms.saveSupplierPaymentTerms(admin, "fornecedor-a", {
        terms: [
          { percent: 30, base: "order_created", days: 0 },
          { percent: 70, base: "delivered", days: 90 },
        ],
        note: null,
      });
    }
    order = (await store.get("orders", order.id))!;
    const items = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    // Caixa master de 10 peças, 0,5 kg líquido e 0,6 kg bruto por peça.
    for (const i of items) {
      await store.update("order_items", i.id, { quantity: 25, variant: null });
      await store.update("products", i.productId!, {
        masterBoxQty: 10,
        netWeightKg: 0.5,
        grossWeightKg: 0.6,
      });
    }
    const [a, b] = items;
    // Os passos antigos do despachante e do agente não aparecem no pedido de compra.
    const shown = (await flow.importFlowView(admin, order)).map(
      (s) => s.template.key,
    );
    expect(shown).not.toContain("invoice_packing");
    expect(shown).not.toContain("draft_bl");
    expect(shown).toContain("bl");
    // O check list só abre depois das fotos do container vazio.
    await expect(
      docs.addLoad(supplierA, order.id, [{ itemId: a.id, cartons: 1 }]),
    ).rejects.toThrow("shipping_load_closed");
    await flow.submitStep(admin, order.id, "booking", { value: "BK-9" });
    const ops = await store.create("users", {
      email: "comex.docs@wellmix.com",
      name: "Caio Comex",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: "x",
      active: true,
      importerId: null,
      functions: ["comex_internal"],
      screens: null,
      mustChangePassword: false,
    } as never);
    await flow.validateStep(ops, order.id, "booking", "validated", null);
    await flow.submitStep(supplierA, order.id, "container_at_factory", {
      value: "2027-01-12",
    });
    await flow.submitStep(supplierA, order.id, "container_empty", {
      documentId: (
        await uploadDocument(supplierA, pdf("vazio.pdf"), {
          orderId: order.id,
          type: "import_step",
        })
      ).id,
    });
    // Check list: 3 caixas por item (25 peças / 10 por caixa), abatendo.
    let view = (await docs.shippingDocsView(supplierA, order.id))!;
    expect(view.load.map((l) => l.expected)).toEqual([3, 3]);
    await docs.addLoad(supplierA, order.id, [
      { itemId: a.id, cartons: 2 },
      { itemId: b.id, cartons: 3 },
    ]);
    await expect(
      docs.addLoad(supplierA, order.id, [{ itemId: a.id, cartons: 2 }]),
    ).rejects.toThrow("shipping_load_over");
    expect(
      (await docs.shippingDocTasks(supplierA))
        .filter((t) => t.order.id === order.id)
        .map((t) => t.kind),
    ).toEqual(["load"]);
    await docs.addLoad(supplierA, order.id, [{ itemId: a.id, cartons: 1 }]);
    view = (await docs.shippingDocsView(supplierA, order.id))!;
    expect(view.loadDone).toBe(true);
    expect(view.open.load).toBe(false);
    // Packing list: caixas do check list, peças e pesos pelo cadastro.
    expect(view.suggestion).toEqual([
      expect.objectContaining({
        cartons: 3,
        pieces: 25,
        netKg: 12.5,
        grossKg: 15,
      }),
      expect.objectContaining({
        cartons: 3,
        pieces: 25,
        netKg: 12.5,
        grossKg: 15,
      }),
    ]);
    await expect(
      docs.submitInvoice(supplierA, order.id, {
        number: "INV-1",
        lines: view.suggestion,
        documentId: "x",
        currency: null,
      }),
    ).rejects.toThrow("shipping_doc_closed");
    await docs.submitPackingList(supplierA, order.id, {
      // Caixas digitadas diferentes não valem: ficam as do check list.
      lines: view.suggestion.map((l) => ({ ...l, cartons: 99 })),
      documentId: null,
    });
    view = (await docs.shippingDocsView(supplierA, order.id))!;
    expect(view.docs.packing_list!.lines.map((l) => l.cartons)).toEqual([3, 3]);
    // Invoice da trading: uma linha com peso bruto diferente volta para refazer.
    const file = (
      await uploadDocument(supplierA, pdf("invoice.pdf"), {
        orderId: order.id,
        type: "attachment",
        visibility: "supplier",
      })
    ).id;
    const wrong = view.suggestion.map((l, i) =>
      i === 1 ? { ...l, grossKg: 16, pieces: 24 } : l,
    );
    await docs.submitInvoice(supplierA, order.id, {
      number: "INV-1",
      lines: wrong,
      documentId: file,
      currency: null,
    });
    view = (await docs.shippingDocsView(supplierA, order.id))!;
    expect(view.docs.invoice!.status).toBe("rejected");
    expect(view.docs.invoice!.mismatches!.map((m) => m.field)).toEqual([
      "pieces",
      "grossKg",
    ]);
    expect(
      (await docs.shippingDocTasks(supplierA)).filter(
        (t) => t.order.id === order.id,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "invoice", redo: true }),
      ]),
    );
    await docs.submitInvoice(supplierA, order.id, {
      number: "INV-1",
      lines: view.docs.packing_list!.lines,
      documentId: null,
      currency: null,
    });
    view = (await docs.shippingDocsView(supplierA, order.id))!;
    expect(view.docs.invoice!.status).toBe("accepted");
    expect(view.can.bl).toBe(false);
    // BL: sem marítima no pedido, a Wellmix faz; conferido com a invoice.
    expect(await docs.shipmentBlockers(order.id)).toEqual([
      "container_at_port",
      "bl",
    ]);
    await expect(
      flow.submitStep(admin, order.id, "bl", { value: "BL-0" }),
    ).rejects.toThrow();
    const bl = (await docs.shippingDocsView(admin, order.id))!;
    await docs.submitBl(admin, order.id, {
      number: "BL-1",
      containerNumber: "mscu1234567",
      lines: bl.suggestion.map((l, i) => (i === 0 ? { ...l, cartons: 2 } : l)),
      documentId: file,
    });
    expect(
      (await docs.shippingDocsView(admin, order.id))!.docs.bl!.status,
    ).toBe("rejected");
    await docs.submitBl(admin, order.id, {
      number: "BL-1",
      containerNumber: "mscu1234567",
      lines: bl.suggestion,
      documentId: null,
    });
    const done = (await docs.shippingDocsView(admin, order.id))!;
    expect(done.docs.bl).toMatchObject({
      status: "accepted",
      containerNumber: "MSCU1234567",
    });
    // BL conferido fecha o passo "BL" do desembaraço.
    const [blStep] = await store.list("import_steps", {
      filter: { orderId: order.id, key: "bl" },
    });
    expect(blStep).toMatchObject({ status: "validated", value: "BL-1" });
    expect(await docs.shipmentBlockers(order.id)).toEqual([
      "container_at_port",
    ]);
    // Fatura ativa (R24): N dias do fornecedor contados do BL conferido.
    const inv = await import("@/lib/services/supplier-invoice");
    await expect(
      inv.setSupplierInvoiceDays(supplierA, "fornecedor-a", 15),
    ).rejects.toThrow();
    await inv.setSupplierInvoiceDays(admin, "fornecedor-a", 15);
    try {
      const fresh = (await store.get("orders", order.id))!;
      const due = (await inv.invoiceDueOf(fresh))!;
      expect(due.days).toBe(15);
      expect(Date.parse(due.dueAt) - Date.parse(due.activeAt)).toBe(
        15 * 24 * 60 * 60 * 1000,
      );
      expect((await inv.invoiceTasks(admin)).map((x) => x.order.id)).toContain(
        order.id,
      );
      expect(await inv.invoiceTasks(supplierA)).toEqual([]);
      const { registerOrderInvoice } =
        await import("@/lib/services/order-invoicing");
      await registerOrderInvoice(admin, order.id);
      expect(
        (await inv.invoiceTasks(admin)).map((x) => x.order.id),
      ).not.toContain(order.id);
    } finally {
      await inv.setSupplierInvoiceDays(admin, "fornecedor-a", null);
    }
  });

  it("amostras: retirada, Brasil 4×3×Nm e China 1×3×Nm, fotos reais aprovadas, devolução antes do carregamento", async () => {
    const store = getStore();
    const flow = await import("@/lib/services/import-flow");
    const sf = await import("@/lib/services/sample-flow");
    const { showcaseOf } = await import("@/lib/services/documents");
    const { order, items } = await signedPurchaseOrder(
      ["SF-1", "SF-2"],
      null,
      "ordered",
    );
    const mkt = (
      await store.list("users", {
        filter: { email: "agencia@marketing.cn" },
      })
    )[0]!;
    await store.update("orders", order.id, {
      marketingAgencyId: mkt.partyId,
    });
    const split = await sf.samplesSplitOf(order);
    expect(split.map((l) => [l.brazil, l.china, l.total])).toEqual([
      [12, 3, 15],
      [12, 3, 15],
    ]);
    // Antes do SKU aprovado (ainda não está no Embarque): nada das amostras.
    let fresh = (await store.get("orders", order.id))!;
    expect(await flow.importFlowView(admin, fresh, "samples")).toEqual([]);
    await expect(
      flow.submitStep(supplierA, order.id, "samples_picked", {
        value: "2026-11-20",
      }),
    ).rejects.toThrow("samples_closed");
    // SKU aprovado: o pedido está no Embarque.
    await store.update("orders", order.id, { status: "SHIPPING" });
    fresh = (await store.get("orders", order.id))!;
    expect(
      (await flow.importFlowView(mkt, fresh, "samples")).map(
        (s) => s.template.key,
      ),
    ).toEqual([
      "samples_picked",
      "samples_china",
      "samples_china_received",
      "samples_returned",
    ]);
    const doc = async (user: User, name: string) =>
      (
        await uploadDocument(user, pdf(name), {
          orderId: order.id,
          type: "import_step",
        })
      ).id;
    await flow.submitStep(supplierA, order.id, "samples_picked", {
      value: "2026-11-20",
    });
    await flow.submitStep(supplierA, order.id, "samples_brazil", {
      value: "AWB-BR-1",
      documentId: await doc(supplierA, "br.pdf"),
    });
    await flow.submitStep(supplierA, order.id, "samples_china", {
      value: "SF-CN-1",
      documentId: await doc(supplierA, "cn.pdf"),
    });
    // A agência recebe a pendência de confirmar o recebimento.
    expect((await flow.importTasks(mkt, [fresh])).map((t) => t.key)).toContain(
      "samples_china_received",
    );
    expect((await sf.realMediaView(mkt, order.id))!.open).toBe(false);
    await flow.submitStep(mkt, order.id, "samples_china_received", {
      value: "2026-11-24",
    });
    // Container vazio já registrado: o carregamento espera a amostra voltar.
    await store.create("import_steps", {
      orderId: order.id,
      key: "container_empty",
      status: "submitted",
      value: null,
      amount: null,
      currency: null,
      documentId: null,
      submittedByUserId: supplierA.id,
      submittedAt: new Date().toISOString(),
      validatedByUserId: null,
      validatedAt: null,
      rejectReason: null,
    });
    await expect(
      flow.submitStep(supplierA, order.id, "container_loaded", {
        documentId: await doc(supplierA, "carga.pdf"),
      }),
    ).rejects.toThrow("samples_return_required");
    // A amostra só volta com as fotos reais aprovadas.
    await expect(
      flow.submitStep(mkt, order.id, "samples_returned", {
        value: "Entregue na trading",
      }),
    ).rejects.toThrow("real_media_required");
    const png = (name: string) =>
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, {
        type: "image/png",
      });
    const [a, b] = items;
    const media = async (itemId: string, productId: string) =>
      (
        await uploadDocument(mkt, png(`${itemId}.png`), {
          productId,
          type: "real_media",
          visibility: "internal",
        })
      ).id;
    let view = (await sf.realMediaView(mkt, order.id))!;
    expect(view.canSend).toBe(true);
    expect(view.canApprove).toBe(false);
    await sf.sendRealMedia(mkt, order.id, a.id, [
      await media(a.id, a.productId!),
    ]);
    await sf.sendRealMedia(mkt, order.id, b.id, [
      await media(b.id, b.productId!),
    ]);
    expect(
      (await sf.realMediaTasks(admin))
        .filter((t) => t.order.id === order.id)
        .map((t) => t.kind),
    ).toEqual(["approve"]);
    await expect(
      sf.decideRealMedia(mkt, order.id, a.id, "approved", null),
    ).rejects.toThrow();
    await expect(
      sf.decideRealMedia(admin, order.id, b.id, "rejected", null),
    ).rejects.toThrow("reason_required");
    await sf.decideRealMedia(admin, order.id, b.id, "rejected", "Fundo sujo");
    await sf.decideRealMedia(admin, order.id, a.id, "approved", null);
    // Aprovado: a foto real é a principal e a única na vitrine; o produto à venda.
    const photos = await store.list("product_photos", {
      filter: { productId: a.productId! },
    });
    const real = photos.filter((p) => p.kind === "real");
    expect(real).toHaveLength(1);
    expect(real[0].isPrimary).toBe(true);
    expect(showcaseOf(photos).map((p) => p.kind)).toEqual(["real"]);
    expect(photos.filter((p) => p.kind !== "real" && p.isPrimary)).toEqual([]);
    const product = (await store.get("products", a.productId!))!;
    expect(product).toMatchObject({
      active: true,
      primaryPhotoDocumentId: real[0].documentId,
    });
    // Refeito e aprovado: a amostra pode voltar à trading.
    expect(
      (await sf.realMediaTasks(mkt))
        .filter((t) => t.order.id === order.id)
        .map((t) => t.kind),
    ).toEqual(["do"]);
    await sf.sendRealMedia(mkt, order.id, b.id, [
      await media(b.id, b.productId!),
    ]);
    await sf.decideRealMedia(admin, order.id, b.id, "approved", null);
    view = (await sf.realMediaView(admin, order.id))!;
    expect(view.complete).toBe(true);
    await flow.submitStep(mkt, order.id, "samples_returned", {
      value: "Entregue na trading com o pedido",
    });
    // A trading confirma que recebeu: o carregamento libera.
    await flow.validateStep(
      supplierA,
      order.id,
      "samples_returned",
      "validated",
      null,
    );
    await flow.submitStep(supplierA, order.id, "container_loaded", {
      documentId: await doc(supplierA, "carga.pdf"),
    });
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
