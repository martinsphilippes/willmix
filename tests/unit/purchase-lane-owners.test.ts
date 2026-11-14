import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Pedido de compra, etapa "Die-Cut, Arte e Certificação" (dono, 14/11/2026;
 * docs/PURCHASE_ORDER.md, "Quem faz cada tarefa"): as quatro tarefas de cada
 * produto, cada uma só no login responsável, em Pendências, nas mesas e no
 * servidor.
 *
 * - Arte e arte final com o selo → o designer do pedido (cartão Artes).
 * - Validação da arte pela Wellmix → o operador responsável pelo pedido.
 * - Certificado (Inmetro) → a certificadora (OCP) do pedido.
 *
 * O fornecedor não vê nenhuma das quatro. As dependências continuam: a
 * validação depois da arte; a arte final depois da validação e do
 * certificado. Sem o responsável, a gestão interna vê "Responsável não
 * definido". As pendências abertas com o papel antigo são corrigidas no
 * lugar, sem duplicar.
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
const art = await import("@/lib/services/artwork");
const { uploadDocument, canAccessDocument } =
  await import("@/lib/services/documents");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { loadDesk } = await import("@/lib/services/desks");
const { isRoutedLaneKey, baseKeyOf } = await import("@/lib/purchase-lanes");
const routing = await import("@/lib/services/cert-art-routing");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Document = import("@/lib/db").Document;

let admin: User;
/** Operador Wellmix responsável pelo pedido (valida a arte). */
let operator: User;
let supplierA: User;
let agency: User;
let ocp: User;
/** Designer da Wellmix (função Designer). */
let designer: User;
/** Da Wellmix, sem função: não recebe nenhuma das quatro. */
let other: User;

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
const row = (sku: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  `Glass jar ${sku}`,
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

const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: "application/pdf",
  });
const png = (name: string) =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, {
    type: "image/png",
  });

/**
 * Pedido de compra de um produto da linha de brinquedos (exige Inmetro: tem
 * certificado e arte final), com o operador como responsável.
 */
async function purchaseOrder(sku: string): Promise<Order> {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(
    admin,
    new File(
      [xlsxBytes([{ name: "BOOKING", cells: [HEADER, row(sku)] }])],
      `${sku}.xlsx`,
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ),
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
  const request = await svc.openSupplierRequest(admin, {
    itemId: items[0].id,
    alternativeIds: [],
    quantity: null,
    needs: null,
    searchQuery: null,
  });
  await svc.answerSupplierRequest(supplierA, request.id, {
    canDo: "yes",
    price: 1.1,
    currency: "USD",
    moq: 1000,
    leadTimeDays: 30,
    note: null,
  });
  await svc.decideSupplierRequest(admin, request.id, "approved", null);
  await approveSample(admin, request.id);
  await product.createProductFromRequest(admin, request.id, {
    name: `Produto ${sku}`,
    lineId: "linha-brinquedos",
    itemIds: [items[0].id],
  });
  const order = await po.createPurchaseOrder(admin, [
    { requestId: request.id, quantity: null },
  ]);
  return store.update("orders", order.id, { ownerUserId: operator.id });
}

const fresh = async (order: Order) =>
  (await getStore().get("orders", order.id))!;

async function requirementOf(order: Order, base: string) {
  const all = await getStore().list("requirements", {
    filter: { orderId: order.id },
  });
  return all.find((r) => baseKeyOf(r.key) === base && r.key.includes("__"))!;
}

/** Envia a tarefa como a tela: o arquivo (interno, como na tela) e o envio. */
async function submit(
  user: User,
  order: Order,
  base: string,
  file: string,
): Promise<Document> {
  const req = await requirementOf(order, base);
  const photo = req.type === "photo";
  const doc = await uploadDocument(user, photo ? png(file) : pdf(file), {
    orderId: order.id,
    requirementId: req.id,
    type: photo ? "photo" : "other",
  });
  await engine.submitRequirement(user, req.id, {
    value: null,
    documentId: doc.id,
  });
  return doc;
}

/** Tentativa de enviar (sem arquivo): o servidor confere quem é antes. */
async function trySubmit(user: User, order: Order, base: string) {
  const req = await requirementOf(order, base);
  return engine.submitRequirement(user, req.id, { value: null });
}

/** As quatro tarefas deste pedido que o login vê em Pendências (chave base). */
async function laneTasksOf(user: User, order: Order): Promise<string[]> {
  return (await pendingTasksFor(user))
    .filter((t) => t.orderId === order.id && t.kind === "requirement")
    .flatMap((t) => t.items ?? [])
    .filter((i) => isRoutedLaneKey(i.key))
    .map((i) => baseKeyOf(i.key))
    .sort();
}

/** Avisos do pedido para o login. */
async function noticesOf(user: User, order: Order) {
  return (
    await getStore().list("notifications", {
      filter: { userId: user.id, channel: "inapp" },
    })
  ).filter((n) => n.link === `/app/orders/${order.id}`);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  supplierA = by("supplier.a@china.com");
  agency = by("agencia@design.com");
  ocp = by("ocp@certifica.com");
  const store = getStore();
  const wellmixLogin = (name: string, functions: string[]) =>
    store.create("users", {
      email: `${name}@wellmix.com`,
      name,
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
      functions,
    } as never);
  designer = await wellmixLogin("designer", ["designer"]);
  other = await wellmixLogin("outro", []);
});

describe("designer da Wellmix, operador e certificadora: cada tarefa só no login dela", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("LO-1");
    await art.assignDesigner(admin, order.id, designer.id);
    order = await fresh(order);
  });

  it("o pedido tem designer, operador responsável e certificadora", () => {
    expect(order).toMatchObject({
      flow: "supplier_request",
      status: "PREPARATION",
      designerUserId: designer.id,
      ownerUserId: operator.id,
      ocpId: ocp.partyId,
    });
  });

  it("antes da faca e da foto: só o certificado está liberado, e só para a certificadora", async () => {
    expect(await laneTasksOf(ocp, order)).toEqual(["certificate"]);
    for (const user of [designer, operator, other, agency, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    // Gestão interna (administrador): todas as liberadas.
    expect(await laneTasksOf(admin, order)).toEqual(["certificate"]);
    // Aviso de abertura da certificação: a certificadora do pedido.
    expect(
      (await noticesOf(ocp, order)).some((n) => /certificação/.test(n.subject)),
    ).toBe(true);
  });

  it("faca e foto em alta enviadas: a arte aparece só para o designer, que é avisado", async () => {
    await submit(supplierA, order, "die_cut", "faca.pdf");
    await submit(supplierA, order, "hd_photo", "foto.png");
    expect(await laneTasksOf(designer, order)).toEqual(["art"]);
    expect(await laneTasksOf(ocp, order)).toEqual(["certificate"]);
    for (const user of [operator, other, agency, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    expect(await laneTasksOf(admin, order)).toEqual(["art", "certificate"]);
    expect(
      (await noticesOf(designer, order)).some((n) =>
        /faca e foto/.test(n.subject),
      ),
    ).toBe(true);
    expect(await noticesOf(agency, order)).toHaveLength(0);
  });

  it("mesas: a arte na mesa do designer; a agência do pedido não a recebe", async () => {
    const rowsOf = async (user: User, desk: "agency" | "ocp", key: string) =>
      (await loadDesk(user, desk))
        .find((q) => q.key === key)!
        .rows.filter((r) => r.orderNumber === order.number);
    expect(await rowsOf(designer, "agency", "art")).toHaveLength(1);
    expect(await rowsOf(agency, "agency", "art")).toHaveLength(0);
    expect(await rowsOf(operator, "agency", "art")).toHaveLength(0);
    expect(await rowsOf(ocp, "ocp", "certificates")).toHaveLength(1);
    expect(await rowsOf(operator, "ocp", "certificates")).toHaveLength(0);
    expect(await rowsOf(admin, "agency", "art")).toHaveLength(1);
  });

  it("o servidor recusa a arte de quem não é o designer do pedido", async () => {
    for (const user of [operator, other, agency])
      await expect(trySubmit(user, order, "art")).rejects.toThrow(
        "lane_not_assignee",
      );
    for (const user of [supplierA, ocp])
      await expect(trySubmit(user, order, "art")).rejects.toThrow("forbidden");
  });

  it("arte enviada pelo designer: a validação vai só para o operador, com o arquivo", async () => {
    const artDoc = await submit(designer, order, "art", "arte.pdf");
    expect(await laneTasksOf(operator, order)).toEqual(["art_review"]);
    for (const user of [designer, other, agency, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    expect(await laneTasksOf(ocp, order)).toEqual(["certificate"]);
    expect(await laneTasksOf(admin, order)).toEqual([
      "art_review",
      "certificate",
    ]);
    // O operador abre a arte para validar; o fornecedor e a agência não.
    expect(await canAccessDocument(operator, artDoc)).toBe(true);
    expect(await canAccessDocument(supplierA, artDoc)).toBe(false);
    expect(await canAccessDocument(agency, artDoc)).toBe(false);
    expect(
      (await noticesOf(operator, order)).some((n) =>
        /validar a arte/.test(n.subject),
      ),
    ).toBe(true);
    expect(
      (await noticesOf(designer, order)).some((n) =>
        /validar a arte/.test(n.subject),
      ),
    ).toBe(false);
  });

  it("só o operador responsável valida: o designer (que enviou) e os outros não", async () => {
    const review = await requirementOf(order, "art_review");
    await expect(
      engine.decideRequirement(designer, review.id, "approve"),
    ).rejects.toThrow("lane_not_assignee");
    await expect(
      engine.decideRequirement(other, review.id, "approve"),
    ).rejects.toThrow("forbidden");
    for (const user of [agency, ocp, supplierA])
      await expect(
        engine.decideRequirement(user, review.id, "approve"),
      ).rejects.toThrow("forbidden");
    // Devolvida: a arte volta para o designer; a validação sai do operador.
    await engine.decideRequirement(operator, review.id, "reject", "Logo maior");
    expect(await laneTasksOf(designer, order)).toEqual(["art"]);
    expect(await laneTasksOf(operator, order)).toEqual([]);
    await submit(designer, order, "art", "arte-2.pdf");
    expect(await laneTasksOf(operator, order)).toEqual(["art_review"]);
    await engine.decideRequirement(operator, review.id, "approve");
    expect(await laneTasksOf(operator, order)).toEqual([]);
  });

  it("arte validada, certificado aberto: a arte final ainda espera", async () => {
    expect(await laneTasksOf(designer, order)).toEqual([]);
    await expect(trySubmit(designer, order, "art_final")).rejects.toThrow(
      "lane_prerequisite",
    );
  });

  it("o certificado só a certificadora envia; depois a arte final vai para o designer", async () => {
    for (const user of [operator, designer, other])
      await expect(trySubmit(user, order, "certificate")).rejects.toThrow(
        "lane_not_assignee",
      );
    for (const user of [agency, supplierA])
      await expect(trySubmit(user, order, "certificate")).rejects.toThrow(
        "forbidden",
      );
    const certificate = await submit(ocp, order, "certificate", "inmetro.pdf");
    expect(await laneTasksOf(designer, order)).toEqual(["art_final"]);
    for (const user of [operator, other, ocp, agency, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    expect(await laneTasksOf(admin, order)).toEqual(["art_final"]);
    // O designer abre o certificado (o selo) para finalizar a arte.
    expect(await canAccessDocument(designer, certificate)).toBe(true);
    expect(await canAccessDocument(supplierA, certificate)).toBe(false);
    expect(
      (await noticesOf(designer, order)).some((n) =>
        /arte final com o selo/.test(n.subject),
      ),
    ).toBe(true);
    await expect(trySubmit(operator, order, "art_final")).rejects.toThrow(
      "lane_not_assignee",
    );
    await submit(designer, order, "art_final", "final.pdf");
    for (const user of [admin, designer, operator, ocp, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    // O histórico fica com quem fez cada uma.
    const done = await Promise.all(
      ["art", "art_review", "certificate", "art_final"].map((b) =>
        requirementOf(order, b),
      ),
    );
    expect(done.map((r) => [r.status, r.submittedByUserId])).toEqual([
      ["done", designer.id],
      ["done", operator.id],
      ["done", ocp.id],
      ["done", designer.id],
    ]);
  });
});

describe("designer da agência: arte e arte final no login dela, com os arquivos", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("LO-2");
    expect(order.agencyId).toBe(agency.partyId);
    await art.assignDesigner(admin, order.id, agency.id);
    order = await fresh(order);
  });

  it("a agência designada recebe a arte; abre a faca e a foto do fornecedor", async () => {
    const faca = await submit(supplierA, order, "die_cut", "faca.pdf");
    const foto = await submit(supplierA, order, "hd_photo", "foto.png");
    expect(await laneTasksOf(agency, order)).toEqual(["art"]);
    for (const user of [designer, operator, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    expect(await canAccessDocument(agency, faca)).toBe(true);
    expect(await canAccessDocument(agency, foto)).toBe(true);
    // A certificadora não faz a arte: não abre a faca.
    expect(await canAccessDocument(ocp, faca)).toBe(false);
    expect((await requirementOf(order, "art")).role).toBe("agency");
    expect((await requirementOf(order, "art_final")).role).toBe("agency");
  });

  it("a arte final abre o certificado da certificadora para o designer da agência", async () => {
    await submit(agency, order, "art", "arte.pdf");
    expect(await laneTasksOf(operator, order)).toEqual(["art_review"]);
    expect(await laneTasksOf(agency, order)).toEqual([]);
    await engine.decideRequirement(
      operator,
      (await requirementOf(order, "art_review")).id,
      "approve",
    );
    const certificate = await submit(ocp, order, "certificate", "inmetro.pdf");
    expect(await laneTasksOf(agency, order)).toEqual(["art_final"]);
    expect(await canAccessDocument(agency, certificate)).toBe(true);
    expect(await canAccessDocument(supplierA, certificate)).toBe(false);
    await submit(agency, order, "art_final", "final.pdf");
    expect(await laneTasksOf(agency, order)).toEqual([]);
  });
});

describe("responsável do pedido é o administrador (como em produção): a validação fica com ele", () => {
  let order: Order;
  let otherBuyer: User;
  beforeAll(async () => {
    otherBuyer = await getStore().create("users", {
      email: "comprador2@wellmix.com",
      name: "comprador2",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
      functions: ["buyer"],
    } as never);
    order = await purchaseOrder("LO-5");
    order = await getStore().update("orders", order.id, {
      ownerUserId: admin.id,
    });
    await art.assignDesigner(admin, order.id, designer.id);
    order = await fresh(order);
  });

  it("a validação é do responsável (o administrador), como na linha do tempo do operador; o designer nunca a recebe", async () => {
    const ctx = await routing.loadRoutingContext();
    const siblings = await getStore().list("requirements", {
      filter: { orderId: order.id },
    });
    const review = (await requirementOf(order, "art_review")).key;
    expect(routing.laneRoute(review, order, ctx, siblings)?.userIds).toEqual([
      admin.id,
    ]);
    const sees = (user: User) =>
      routing.seesLaneTask(user, review, order, ctx, siblings);
    for (const user of [designer, operator, otherBuyer, other])
      expect(sees(user)).toBe(false);
    expect(sees(admin)).toBe(true);
  });

  it("arte enviada pelo designer: os operadores não recebem a validação; o administrador valida", async () => {
    await submit(supplierA, order, "die_cut", "faca.pdf");
    await submit(supplierA, order, "hd_photo", "foto.png");
    await submit(designer, order, "art", "arte.pdf");
    for (const user of [designer, operator, otherBuyer, other, supplierA])
      expect(await laneTasksOf(user, order)).toEqual([]);
    expect(await laneTasksOf(ocp, order)).toEqual(["certificate"]);
    expect(await laneTasksOf(admin, order)).toEqual([
      "art_review",
      "certificate",
    ]);
    const review = await requirementOf(order, "art_review");
    for (const user of [designer, otherBuyer])
      await expect(
        engine.decideRequirement(user, review.id, "approve"),
      ).rejects.toThrow("lane_not_assignee");
    await engine.decideRequirement(admin, review.id, "approve");
    expect((await requirementOf(order, "art_review")).submittedByUserId).toBe(
      admin.id,
    );
  });

  it("com um operador como responsável, a validação passa para ele, sem duplicar", async () => {
    const second = await purchaseOrder("LO-6");
    await art.assignDesigner(admin, second.id, designer.id);
    const order2 = await getStore().update("orders", second.id, {
      ownerUserId: otherBuyer.id,
    });
    await submit(supplierA, order2, "die_cut", "faca.pdf");
    await submit(supplierA, order2, "hd_photo", "foto.png");
    await submit(designer, order2, "art", "arte.pdf");
    expect(await laneTasksOf(otherBuyer, order2)).toEqual(["art_review"]);
    for (const user of [operator, designer])
      expect(await laneTasksOf(user, order2)).toEqual([]);
  });
});

describe("sem certificadora ou sem designer: Responsável não definido", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("LO-3");
    // Certificadora e designer retirados em Parceiros do pedido.
    order = await getStore().update("orders", order.id, {
      ocpId: null,
      designerUserId: null,
      agencyId: null,
    });
    await po.syncLaneRoles(admin, order);
  });

  it("o certificado fica com o responsável interno, que só designa; a certificadora de outro pedido não vê", async () => {
    expect(await laneTasksOf(ocp, order)).toEqual([]);
    expect(await laneTasksOf(operator, order)).toEqual(["certificate"]);
    const task = (await pendingTasksFor(admin)).find(
      (t) =>
        t.orderId === order.id &&
        t.items?.some((i) => i.key.startsWith("certificate__")),
    )!;
    expect(task.detail).toContain("sem certificadora");
    // Ninguém da Wellmix envia o certificado no lugar da certificadora.
    await expect(trySubmit(operator, order, "certificate")).rejects.toThrow(
      "lane_not_assignee",
    );
  });
});

describe("pendências abertas antes da regra: corrigidas no lugar", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("LO-4");
    await art.assignDesigner(admin, order.id, agency.id);
    order = await fresh(order);
  });

  it("tudo gravado como da Wellmix: volta para quem recebe, sem duplicar, e o feito fica", async () => {
    const store = getStore();
    const before = await store.list("requirements", {
      filter: { orderId: order.id },
    });
    // Como estava antes de 14/11/2026: as quatro com o operador da Wellmix.
    for (const r of before.filter((x) => isRoutedLaneKey(x.key)))
      await store.update("requirements", r.id, { role: "operator" });
    // O fornecedor já tinha mandado a faca.
    await submit(supplierA, order, "die_cut", "faca.pdf");
    const dieCut = await requirementOf(order, "die_cut");
    // Arte e arte final (a agência), certificado (a certificadora); a
    // validação continua da Wellmix.
    expect(await po.normalizeLaneRoles(order.id)).toBe(3);
    const after = await store.list("requirements", {
      filter: { orderId: order.id },
    });
    expect(after.map((r) => r.id).sort()).toEqual(
      before.map((r) => r.id).sort(),
    );
    const roleOf = async (base: string) =>
      (await requirementOf(order, base)).role;
    expect(await roleOf("art")).toBe("agency");
    expect(await roleOf("art_review")).toBe("operator");
    expect(await roleOf("certificate")).toBe("ocp");
    expect(await roleOf("art_final")).toBe("agency");
    // O que foi feito não muda.
    expect(await requirementOf(order, "die_cut")).toMatchObject({
      status: dieCut.status,
      submittedByUserId: supplierA.id,
      documentId: dieCut.documentId,
    });
    // Rodar de novo não muda nada; a pendência da certificadora é uma só.
    expect(await po.normalizeLaneRoles(order.id)).toBe(0);
    expect(await laneTasksOf(ocp, order)).toEqual(["certificate"]);
    const logged = await store.list("audit_log", {
      filter: { entityId: order.id, action: "order.lanes_reassigned" },
    });
    expect(logged.length).toBeGreaterThan(0);
  });
});
