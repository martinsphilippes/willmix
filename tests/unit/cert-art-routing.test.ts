import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Pedido de compra: cada tarefa dos cartões Certificação e Artes no login
 * certo (docs/CERTIFICATION.md, "Quem recebe cada tarefa"; dono, 13/11/2026).
 * Selo e memorial → a certificadora (OCP) vinculada ao pedido, só ela envia
 * (dono, 14/11/2026); aplicar o selo → designer do pedido, agência que faz a
 * arte ou Wellmix; validar a arte → analista que pode validar arte. O
 * fornecedor fica só com o que é dele. Sem responsável, a equipe fica com a
 * tarefa e a tela aponta onde designar (sem certificadora, uma pendência só,
 * a de vincular). Trocar o responsável move a pendência aberta.
 */
withTempStore();
const { approveSample } = await import("./helpers/sampling");

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const product = await import("@/lib/services/supplier-request-product");
const po = await import("@/lib/services/purchase-order");
const f = await import("@/lib/services/import-flow");
const art = await import("@/lib/services/artwork");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canAccessDocument } = await import("@/lib/services/documents");
const { setSetting } = await import("@/lib/settings");
const { can } = await import("@/lib/auth/function-access");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Task = import("@/lib/services/tasks").Task;

let admin: User;
let operator: User;
let supplierA: User;
let agency: User;
let broker: User;
/** Certificadora (OCP) do pedido: só ela envia o memorial e o selo. */
let ocp: User;
/** Analista do pedido (responsável interno), que pode validar arte. */
let analyst: User;
/** Designer da Wellmix (função Designer). */
let designer: User;
/** Da Wellmix, sem a ação "Validar a arte". */
let noArt: User;

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

/** Pedido de compra de um produto aprovado (linha que exige certificação). */
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
  const line = (await store.list("product_lines")).find(
    (l) => l.requiredCertifications?.length,
  )!;
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
    lineId: line.id,
    itemIds: [items[0].id],
  });
  const order = await po.createPurchaseOrder(admin, [
    { requestId: request.id, quantity: null },
  ]);
  // O analista do pedido é o responsável interno.
  return store.update("orders", order.id, { ownerUserId: analyst.id });
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

/** Pendências do login neste pedido (cartões Certificação, Artes e Parceiros). */
async function tasksOf(user: User, order: Order): Promise<Task[]> {
  return (await pendingTasksFor(user)).filter(
    (t) =>
      t.link.startsWith(`/app/orders/${order.id}#certification`) ||
      t.link.startsWith(`/app/orders/${order.id}#artwork`) ||
      t.link === `/app/orders/${order.id}#order-partners`,
  );
}
const shape = (tasks: Task[]) =>
  tasks.map((t) => [t.kind, t.text?.title ?? t.title, t.link]).sort();

const featured = (order: Order) =>
  `/app/orders/${order.id}#certification-featured`;
const stepRow = (order: Order, key: string) =>
  `/app/orders/${order.id}#certification-step-${key}`;

const fresh = async (order: Order) =>
  (await getStore().get("orders", order.id))!;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  supplierA = by("supplier.a@china.com");
  agency = users.find((u) => u.role === "agency")!;
  // Despachante do pedido: laudo e registro (dono, 13/11/2026).
  broker = by("despachante@comex.com");
  // Memorial e selo: a certificadora (OCP) do pedido (dono, 14/11/2026).
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
  analyst = await wellmixLogin("analista", ["buyer", "planner"]);
  designer = await wellmixLogin("designer", ["designer"]);
  noArt = await wellmixLogin("sem-arte", []);
});

describe("tudo designado: cada tarefa no login certo", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("RT-1");
  });

  it("o pedido nasce com certificadora, despachante e agência, e o analista pode validar arte", () => {
    expect(order.flow).toBe("supplier_request");
    expect(order.ocpId).toBe(ocp.partyId);
    expect(order.brokerId).toBe(broker.partyId);
    expect(order.agencyId).toBe(agency.partyId);
    expect(can(analyst, "art.validate")).toBe(true);
    expect(can(noArt, "art.validate")).toBe(false);
  });

  it("selo e memorial para a certificadora (OCP) do pedido; mais ninguém", async () => {
    expect(shape(await tasksOf(ocp, order))).toEqual([
      ["cert_step", "tasks.memorial.send.title", featured(order)],
      ["cert_step", "tasks.seal.issue.title", featured(order)],
    ]);
    for (const user of [
      admin,
      operator,
      analyst,
      designer,
      broker,
      agency,
      supplierA,
    ])
      expect(await tasksOf(user, order)).toHaveLength(0);
    // Só ela tem a ação de enviar os dois no quadro do alto; a Wellmix e o
    // despachante só acompanham (situação e arquivo).
    const view = await f.importFlowView(ocp, order, "certification");
    for (const key of ["cert_seal", "cert_memorial"])
      expect(view.find((v) => v.template.key === key)!.canSubmit).toBe(true);
    for (const user of [admin, analyst, broker]) {
      const other = await f.importFlowView(user, order, "certification");
      for (const key of ["cert_seal", "cert_memorial"] as const) {
        expect(
          other.find((v) => v.template.key === key)!.canSubmit,
          `${user.email} ${key}`,
        ).toBe(false);
        expect(await f.canSubmitStep(user, order, key)).toBe(false);
      }
    }
  });

  it("a visão interna diz com quem está cada passo aberto", async () => {
    const view = await f.importFlowView(admin, order, "certification");
    const of = (key: string) =>
      view.find((v) => v.template.key === key)!.assignee;
    for (const key of ["cert_seal", "cert_memorial"])
      expect(of(key)).toMatchObject({
        via: "ocp",
        label: "Certifica OCP",
        validating: false,
        missing: null,
      });
    // Aplicar o selo ainda espera o selo: sem pendência, sem dono.
    expect(of("cert_seal_art")).toBeNull();
    // Quem é de fora não vê o encaminhamento interno.
    const forOcp = await f.importFlowView(ocp, order, "certification");
    expect(forOcp.every((v) => !v.assignee)).toBe(true);
  });

  it("memorial: só a certificadora envia; o envio dela conclui o passo, sem validação", async () => {
    for (const user of [analyst, admin, broker])
      await expect(
        f.submitStep(user, order.id, "cert_memorial", {
          documentId: (await doc(user, order, `memorial-${user.role}.pdf`)).id,
        }),
        user.email,
      ).rejects.toThrow();
    await f.submitStep(ocp, order.id, "cert_memorial", {
      documentId: (await doc(ocp, order, "memorial.pdf")).id,
    });
    expect(shape(await tasksOf(ocp, order))).toEqual([
      ["cert_step", "tasks.seal.issue.title", featured(order)],
    ]);
    for (const user of [admin, analyst, broker])
      expect(await tasksOf(user, order)).toHaveLength(0);
    const view = await f.importFlowView(admin, order, "certification");
    const memorial = view.find((v) => v.template.key === "cert_memorial")!;
    expect([memorial.done, memorial.canSubmit, memorial.canValidate]).toEqual([
      true,
      false,
      false,
    ]);
    // A autoria fica com quem enviou.
    expect(memorial.step?.submittedByUserId).toBe(ocp.id);
  });

  it("selo enviado: só então aplicar o selo vai para a agência, com o arquivo para baixar", async () => {
    const seal = await doc(ocp, order, "selo.pdf");
    await f.submitStep(ocp, order.id, "cert_seal", { documentId: seal.id });
    expect(await tasksOf(ocp, order)).toHaveLength(0);
    expect(shape(await tasksOf(agency, order))).toEqual([
      ["cert_step", "tasks.seal.apply.title", stepRow(order, "cert_seal_art")],
    ]);
    // A agência baixa o selo; o fornecedor não.
    expect(await canAccessDocument(agency, seal)).toBe(true);
    expect(await canAccessDocument(supplierA, seal)).toBe(false);
    const view = await f.importFlowView(agency, order, "certification");
    expect(
      view.find((v) => v.template.key === "cert_seal")!.step?.documentId,
    ).toBe(seal.id);
    expect(
      view.find((v) => v.template.key === "cert_seal_art")!.canSubmit,
    ).toBe(true);
    for (const user of [admin, analyst, designer, supplierA])
      expect(await tasksOf(user, order)).toHaveLength(0);
  });

  it("designer do pedido escolhido: a pendência muda de login, sem duplicar", async () => {
    await art.assignDesigner(admin, order.id, designer.id);
    order = await fresh(order);
    expect(await tasksOf(agency, order)).toHaveLength(0);
    expect(shape(await tasksOf(designer, order))).toEqual([
      ["cert_step", "tasks.seal.apply.title", stepRow(order, "cert_seal_art")],
    ]);
    for (const user of [admin, operator, analyst])
      expect(await tasksOf(user, order)).toHaveLength(0);
    // Designer trocado para o login da agência: volta para ele, uma vez só.
    await art.assignDesigner(admin, order.id, agency.id);
    order = await fresh(order);
    expect(await tasksOf(designer, order)).toHaveLength(0);
    expect(await tasksOf(agency, order)).toHaveLength(1);
  });

  it("arte com o selo enviada: a validação vai para o analista; o servidor confere quem valida", async () => {
    await expect(
      f.submitStep(supplierA, order.id, "cert_seal_art", {
        documentId: (await doc(supplierA, order, "x.pdf")).id,
      }),
    ).rejects.toThrow();
    await f.submitStep(agency, order.id, "cert_seal_art", {
      documentId: (await doc(agency, order, "arte-com-selo.pdf")).id,
    });
    expect(await tasksOf(agency, order)).toHaveLength(0);
    expect(shape(await tasksOf(analyst, order))).toEqual([
      [
        "cert_validate",
        "tasks.seal.validate.title",
        stepRow(order, "cert_seal_art"),
      ],
    ]);
    for (const user of [admin, operator, designer, noArt, broker, supplierA])
      expect(await tasksOf(user, order)).toHaveLength(0);
    // Sem a ação "Validar a arte" a Wellmix não valida; parceiros também não.
    for (const user of [noArt, broker, supplierA, agency])
      await expect(
        f.validateStep(user, order.id, "cert_seal_art", "validated", null),
      ).rejects.toThrow();
    const view = await f.importFlowView(noArt, order, "certification");
    expect(
      view.find((v) => v.template.key === "cert_seal_art")!.canValidate,
    ).toBe(false);
    await f.validateStep(analyst, order.id, "cert_seal_art", "validated", null);
    for (const user of [admin, analyst, agency, broker, designer])
      expect(await tasksOf(user, order)).toHaveLength(0);
    // O histórico fica com quem fez e quem validou.
    const steps = await getStore().list("import_steps", {
      filter: { orderId: order.id, key: "cert_seal_art" },
    });
    expect([steps[0].submittedByUserId, steps[0].validatedByUserId]).toEqual([
      agency.id,
      analyst.id,
    ]);
  });

  it("o fornecedor só vê as tarefas dele", async () => {
    const mine = await pendingTasksFor(supplierA);
    expect(
      mine.filter(
        (t) =>
          t.link.includes("#certification") ||
          t.link.includes("#artwork") ||
          t.kind.startsWith("cert_") ||
          t.kind.startsWith("art_"),
      ),
    ).toHaveLength(0);
  });
});

describe("pedido sem responsável designado", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("RT-2");
    // Parceiros retirados em Parceiros do pedido: a arte e a arte final
    // abertas voltam para a Wellmix, como na tela; o certificado das raias
    // continua da certificadora (dono, 14/11/2026).
    order = await getStore().update("orders", order.id, {
      ocpId: null,
      brokerId: null,
      agencyId: null,
      designerUserId: null,
      ownerUserId: null,
    });
    expect(await po.syncLaneRoles(admin, order)).toBe(2);
  });

  it("sem certificadora, a equipe fica com uma pendência só, a de vincular, que diz onde", async () => {
    for (const user of [admin, operator]) {
      const tasks = await tasksOf(user, order);
      expect(shape(tasks)).toEqual([
        [
          "cert_step",
          "tasks.seal.assign.title",
          `/app/orders/${order.id}#order-partners`,
        ],
      ]);
      // Filtro do operador: vincular é de Compras.
      expect(tasks[0].stepKey).toBe("assign");
    }
    for (const user of [ocp, broker, supplierA])
      expect(await tasksOf(user, order)).toHaveLength(0);
    // Sem certificadora ninguém envia o memorial nem o selo: a Wellmix só
    // vincula.
    for (const key of ["cert_seal", "cert_memorial"] as const)
      expect(await f.canSubmitStep(admin, order, key)).toBe(false);
  });

  it("a visão interna sinaliza o que falta designar", async () => {
    const view = await f.importFlowView(admin, order, "certification");
    const of = (key: string) =>
      view.find((v) => v.template.key === key)!.assignee;
    for (const key of ["cert_seal", "cert_memorial"])
      expect(of(key)).toMatchObject({ via: "team", missing: "certifier" });
    const artwork = await art.artworkView(admin, order);
    // Arte feita pela Wellmix sem designer: fica com a função Designer.
    expect(artwork.maker).toMatchObject({
      via: "art_design",
      label: "designer",
      missing: "designer",
    });
  });

  it("certificadora vinculada: o memorial e o selo abertos passam para ela, sem duplicar; o despachante não recebe nada", async () => {
    const store = getStore();
    const certificate = () =>
      store
        .list("requirements", { filter: { orderId: order.id } })
        .then((r) => r.filter((x) => x.key.startsWith("certificate__")));
    expect((await certificate()).map((r) => r.role)).toEqual(["ocp"]);
    // Despachante designado: o memorial e o selo não vão para ele.
    order = await store.update("orders", order.id, {
      brokerId: broker.partyId,
    });
    await f.notifySealPartner(order, "brokerId", null);
    expect(await tasksOf(broker, order)).toHaveLength(0);
    // Certificadora vinculada: as duas pendências abertas são dela.
    order = await store.update("orders", order.id, { ocpId: ocp.partyId });
    expect(await po.syncLaneRoles(admin, order)).toBe(0);
    await f.notifySealPartner(order, "ocpId", null);
    expect((await certificate()).map((r) => r.role)).toEqual(["ocp"]);
    expect(shape(await tasksOf(ocp, order))).toEqual([
      ["cert_step", "tasks.memorial.send.title", featured(order)],
      ["cert_step", "tasks.seal.issue.title", featured(order)],
    ]);
    // A Wellmix fica sem nada (nem a de vincular).
    for (const user of [admin, operator])
      expect(await tasksOf(user, order)).toHaveLength(0);
    // Rodar de novo não muda nada.
    expect(await po.syncLaneRoles(admin, order)).toBe(0);
  });

  it("agência designada depois: as raias de arte abertas passam para ela; o que foi feito fica", async () => {
    const store = getStore();
    const reqs = await store.list("requirements", {
      filter: { orderId: order.id },
    });
    const artReq = reqs.find((r) => r.key.startsWith("art__"))!;
    const finalReq = reqs.find((r) => r.key.startsWith("art_final__"))!;
    // A arte já foi feita pela Wellmix: fica com quem fez.
    await store.update("requirements", artReq.id, {
      status: "done",
      submittedByUserId: admin.id,
      submittedAt: new Date().toISOString(),
    });
    order = await store.update("orders", order.id, {
      agencyId: agency.partyId,
    });
    expect(await po.syncLaneRoles(admin, order)).toBe(1);
    expect((await store.get("requirements", artReq.id))!.role).toBe("operator");
    expect((await store.get("requirements", finalReq.id))!.role).toBe("agency");
  });

  it("selo enviado com a arte da Wellmix e sem designer: aplicar vai para a função Designer", async () => {
    await setSetting("agencyValidationEnabled", false);
    try {
      await f.submitStep(ocp, order.id, "cert_seal", {
        documentId: (await doc(ocp, order, "selo.pdf")).id,
      });
      const apply = async (user: User) =>
        (await tasksOf(user, order)).filter(
          (t) => t.link === stepRow(order, "cert_seal_art"),
        );
      const tasks = await apply(designer);
      expect(shape(tasks)).toEqual([
        [
          "cert_step",
          "tasks.seal.apply.title",
          stepRow(order, "cert_seal_art"),
        ],
      ]);
      expect(tasks[0].text?.detailExtra).toBe("tasks.missing.designer");
      for (const user of [admin, operator, agency, broker, supplierA])
        expect(await apply(user)).toHaveLength(0);
      // A agência do pedido só acompanha: não envia a arte com o selo.
      await expect(
        f.submitStep(agency, order.id, "cert_seal_art", {
          documentId: (await doc(agency, order, "a.pdf")).id,
        }),
      ).rejects.toThrow();
      // O login da agência escolhido como designer do pedido envia.
      await art.assignDesigner(admin, order.id, agency.id);
      order = await fresh(order);
      expect(await apply(designer)).toHaveLength(0);
      expect(await apply(agency)).toHaveLength(1);
      expect(await f.canSubmitStep(agency, order, "cert_seal_art")).toBe(true);
    } finally {
      await setSetting("agencyValidationEnabled", true);
    }
  });
});

describe("pedido de compra sem produto que exige certificação", () => {
  it("nada do cartão Certificação vira pendência", async () => {
    const order = await purchaseOrder("RT-3");
    const store = getStore();
    for (const r of await store.list("requirements", {
      filter: { orderId: order.id },
    }))
      if (r.key.startsWith("certificate__") || r.key.startsWith("art_final__"))
        await store.remove("requirements", r.id);
    expect(await f.purchaseNeedsCertification(order)).toBe(false);
    for (const user of [
      admin,
      analyst,
      operator,
      ocp,
      broker,
      agency,
      supplierA,
    ])
      expect(
        (await tasksOf(user, order)).filter((t) =>
          t.link.includes("#certification"),
        ),
      ).toHaveLength(0);
    const view = await f.importFlowView(admin, order, "certification");
    expect(view.every((v) => !v.assignee)).toBe(true);
  });
});

describe("cartão Artes: não conformidade no login certo", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("RT-4");
  });

  it("apontada: corrigir vai para quem faz a arte (a agência); conferir, para quem apontou", async () => {
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order.id },
    });
    const issue = await art.reportArtIssue(analyst, order.id, {
      orderItemId: item.id,
      note: "Pantone errado",
    });
    const link = `/app/orders/${order.id}#artwork-issue-${issue.id}`;
    const artTasks = async (user: User) =>
      (await tasksOf(user, order)).filter((t) => t.link === link);
    expect(shape(await artTasks(agency))).toEqual([
      ["art_fix", "tasks.art.fix.title", link],
    ]);
    // Na tela da agência, a correção entra na etapa "arte".
    expect((await artTasks(agency))[0].group).toBe("agency.art");
    for (const user of [admin, analyst, operator, broker, supplierA])
      expect(await artTasks(user)).toHaveLength(0);

    await art.fixArtIssue(agency, issue.id, { fixNote: "Ajustado" });
    expect(await artTasks(agency)).toHaveLength(0);
    expect(shape(await artTasks(analyst))).toEqual([
      ["art_review", "tasks.art.review.title", link],
    ]);
    for (const user of [admin, operator, noArt])
      expect(await artTasks(user)).toHaveLength(0);
    // Conferir é validar a arte: sem a ação, o servidor recusa.
    await expect(
      art.reviewArtFix(noArt, issue.id, true, null),
    ).rejects.toThrow();
    expect((await art.artworkView(noArt, order)).canReview).toBe(false);

    // Reaberta: volta para quem faz a arte.
    await art.reviewArtFix(analyst, issue.id, false, "Ainda escuro");
    expect(await artTasks(analyst)).toHaveLength(0);
    expect(await artTasks(agency)).toHaveLength(1);
    await art.fixArtIssue(agency, issue.id, { fixNote: "Clareado" });
    await art.reviewArtFix(analyst, issue.id, true, null);
    for (const user of [admin, analyst, agency])
      expect(await artTasks(user)).toHaveLength(0);
  });
});

describe("painel de SLA: acompanhamento da equipe", () => {
  it("sem certificadora, a pendência de vincular aparece na visão da equipe, com o analista como dono", async () => {
    let order = await purchaseOrder("RT-5");
    const teamCert = async () =>
      (await pendingTasksFor(admin, { team: true })).filter(
        (t) =>
          t.kind.startsWith("cert_") &&
          t.link.startsWith(`/app/orders/${order.id}#`),
      );
    // Com a certificadora vinculada, o memorial e o selo são dela.
    expect(await tasksOf(admin, order)).toHaveLength(0);
    expect(await teamCert()).toHaveLength(0);
    order = await getStore().update("orders", order.id, { ocpId: null });
    expect(
      (await teamCert()).map((t) => [t.text?.title, t.ownerUserId]),
    ).toEqual([["tasks.seal.assign.title", analyst.id]]);
  });
});
