import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Selo de certificação (docs/CERTIFICATION.md): o pedido nasce na mão da
 * certificadora (OCP) vinculada a ele, que envia o selo e o memorial (só ela;
 * dono, 14/11/2026); o selo vai para quem faz a arte da embalagem (a agência
 * do pedido ou, sem ela, a Wellmix), que envia a arte com o selo; a Wellmix
 * confere.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const f = await import("@/lib/services/import-flow");
const art = await import("@/lib/services/artwork");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canAccessDocument } = await import("@/lib/services/documents");
const { areaPanel } = await import("@/lib/services/dashboards");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

let admin: User;
let operator: User;
let joao: User;
let supplierA: User;
let ocp: User;
/** Despachante do pedido: laudo e registro; não envia o selo nem o memorial. */
let broker: User;
let comex: User;
let agency: User;

/** Pedido novo: solicitação → pedido; nasce na mão da certificadora (aviso do selo). */
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
  const order = await orderFromRequest(admin, req, { sellPrice: 50_000 });
  await f.notifySealRequested(order);
  return order;
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

/** Avisos na tela (um por aviso; e-mail e WhatsApp são cópias). */
async function inbox(user: User, order: Order) {
  const rows = await getStore().list("notifications", {
    filter: { userId: user.id, channel: "inapp" },
  });
  return rows.filter((n) => n.link?.startsWith(`/app/orders/${order.id}`));
}

/*
 * Links diretos para a tarefa no cartão Certificação: o quadro em destaque
 * (selo e memorial a enviar) ou a linha do passo.
 */
const featuredLink = (order: Order) =>
  `/app/orders/${order.id}#certification-featured`;
const stepLink = (order: Order, key: string) =>
  `/app/orders/${order.id}#certification-step-${key}`;
const isCertLink = (order: Order, link: string | null | undefined) =>
  !!link?.startsWith(`/app/orders/${order.id}#certification`);

async function certTasks(user: User, order: Order) {
  return (await pendingTasksFor(user)).filter((t) => isCertLink(order, t.link));
}

const fresh = async (order: Order) =>
  (await getStore().get("orders", order.id))!;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  operator = by("operador@wellmix.com");
  joao = by("joao@lojista.com");
  supplierA = by("supplier.a@china.com");
  // Selo e memorial: a certificadora (OCP) do pedido (dono, 14/11/2026).
  ocp = by("ocp@certifica.com");
  broker = by("despachante@comex.com");
  comex = by("comex@assessoria.com");
  agency = users.find((u) => u.role === "agency")!;
});

describe("pedido novo: cai no login da certificadora (OCP)", () => {
  let order: Order;
  beforeAll(async () => {
    order = await newOrder();
  });

  it("nasce com a certificadora vinculada, avisada e com a pendência do selo", async () => {
    expect(order.status).toBe("ORDER_CREATED");
    expect(order.ocpId).toBe(ocp.partyId);
    // O despachante (laudo e registro) não recebe o aviso nem a pendência.
    expect(await inbox(broker, order)).toHaveLength(0);
    expect(await certTasks(broker, order)).toHaveLength(0);
    const notes = await inbox(ocp, order);
    expect(notes).toHaveLength(1);
    expect(notes[0].link).toBe(featuredLink(order));
    expect(notes[0].kind).toBe("action");
    expect(notes[0].subject).toContain(`#${order.number}`);
    const tasks = await certTasks(ocp, order);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].kind).toBe("cert_step");
    expect(tasks[0].group).toBe("cert_step");
    expect(tasks[0].text?.title).toBe("tasks.seal.issue.title");
    expect(tasks[0].title).toContain(`#${order.number}`);
  });

  it("a certificadora vê o cartão no pedido recém-criado e só ela envia o selo", async () => {
    const view = await f.importFlowView(ocp, order, "certification");
    const seal = view.find((v) => v.template.key === "cert_seal")!;
    const applied = view.find((v) => v.template.key === "cert_seal_art")!;
    expect(seal.canSubmit).toBe(true);
    expect(applied.ready).toBe(false);
    expect(applied.canSubmit).toBe(false);
    // A Wellmix (inclusive o administrador) e o despachante só acompanham.
    for (const user of [admin, operator, broker]) {
      const other = await f.importFlowView(user, order, "certification");
      expect(other.find((v) => v.template.key === "cert_seal")!.canSubmit).toBe(
        false,
      );
    }
    for (const user of [
      admin,
      operator,
      broker,
      agency,
      supplierA,
      joao,
      comex,
    ])
      await expect(
        f.submitStep(user, order.id, "cert_seal", {
          documentId: (await doc(user, order, `x-${user.role}.pdf`)).id,
        }),
      ).rejects.toThrow();
  });

  it("antes do selo, quem faz a arte só acompanha: sem aviso e sem pendência", async () => {
    expect(await certTasks(agency, order)).toHaveLength(0);
    expect(
      (await inbox(agency, order)).filter((n) => isCertLink(order, n.link)),
    ).toHaveLength(0);
    // A agência vê só as duas linhas do selo (não memorial, laudo ou registro).
    const view = await f.importFlowView(agency, order, "certification");
    expect(view.map((v) => v.template.key)).toEqual([
      "cert_seal",
      "cert_seal_art",
    ]);
    expect(view.every((v) => !v.canSubmit && !v.canValidate)).toBe(true);
    for (const key of [
      "cert_memorial",
      "cert_lab",
      "cert_registration",
    ] as const)
      expect(f.canSeeStep(agency, order, key)).toBe(false);
  });

  it("na Preparação, o memorial também é da certificadora; a Wellmix não recebe nada", async () => {
    expect(await certTasks(admin, order)).toHaveLength(0);
    await getStore().update("orders", order.id, {
      status: "PREPARATION",
      ownerUserId: operator.id,
    });
    // Memorial e selo: só a certificadora (OCP) do pedido (dono, 14/11/2026),
    // com o analista no pedido ou não.
    expect(
      (await certTasks(ocp, order)).map((t) => [t.text?.title, t.link]).sort(),
    ).toEqual([
      ["tasks.memorial.send.title", featuredLink(order)],
      ["tasks.seal.issue.title", featuredLink(order)],
    ]);
    for (const user of [admin, operator, broker])
      expect(await certTasks(user, order)).toHaveLength(0);
    await getStore().update("orders", order.id, {
      status: "ORDER_CREATED",
      ownerUserId: null,
    });
  });

  it("a Wellmix e o despachante não enviam o memorial: o servidor recusa e nada é gravado", async () => {
    const other = await newOrder();
    expect(other.status).toBe("ORDER_CREATED");
    for (const user of [admin, operator, broker])
      await expect(
        f.submitStep(user, other.id, "cert_memorial", {
          documentId: (await doc(user, other, `memorial-${user.role}.pdf`)).id,
        }),
      ).rejects.toThrow();
    const steps = await getStore().list("import_steps", {
      filter: { orderId: other.id },
    });
    expect(steps.some((s) => s.key === "cert_memorial")).toBe(false);
    // Nem validação: o memorial não tem quem valide.
    await expect(
      f.validateStep(admin, other.id, "cert_memorial", "validated", null),
    ).rejects.toThrow("no_validation");
  });

  it("a certificadora anexa o memorial em PDF, que já vale; outra certificadora não", async () => {
    const other = await newOrder();
    const sent = await f.submitStep(ocp, other.id, "cert_memorial", {
      documentId: (await doc(ocp, other, "memorial.pdf")).id,
    });
    // Sem validação: o envio dela conclui o passo, com a autoria dela.
    expect([sent.status, sent.submittedByUserId]).toEqual([
      "submitted",
      ocp.id,
    ]);
    const view = await f.importFlowView(admin, other, "certification");
    expect(view.find((v) => v.template.key === "cert_memorial")!.done).toBe(
      true,
    );
    await expect(
      f.submitStep(
        { ...ocp, id: "ocp-outra", partyId: "ocp-outra" },
        other.id,
        "cert_memorial",
        {
          documentId: sent.documentId,
        },
      ),
    ).rejects.toThrow();
    // Não gera pendência de validar nem de laudo para ninguém.
    expect((await certTasks(ocp, other)).map((t) => t.kind)).toEqual([
      "cert_step",
    ]);
    expect(await certTasks(admin, other)).toHaveLength(0);
  });

  it("pedido cancelado ou encerrado não deixa pendência", async () => {
    for (const status of ["CANCELLED", "CLOSED"] as const) {
      const closed = await getStore().update("orders", order.id, { status });
      expect(await certTasks(ocp, order)).toHaveLength(0);
      // A tela do briefing também não pede mais o selo.
      expect(await f.sealStateFor(agency, closed)).toBeNull();
      await expect(
        f.submitStep(ocp, order.id, "cert_seal", {
          documentId: (await doc(ocp, order, `late-${status}.pdf`)).id,
        }),
      ).rejects.toThrow("order_cancelled");
    }
    await getStore().update("orders", order.id, { status: "ORDER_CREATED" });
  });
});

describe("selo enviado: vai para a agência aplicar na arte", () => {
  let order: Order;
  let sealDocId: string;
  beforeAll(async () => {
    order = await newOrder();
  });

  it("o despachante envia o selo (número opcional) e a agência recebe", async () => {
    const before = (await inbox(agency, order)).length;
    // O arquivo é obrigatório; o número não.
    await expect(
      f.submitStep(ocp, order.id, "cert_seal", { value: "INMETRO 001" }),
    ).rejects.toThrow("file_required");
    const sealDoc = await doc(ocp, order, "selo.pdf");
    sealDocId = sealDoc.id;
    const step = await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: sealDoc.id,
    });
    expect(step.status).toBe("submitted");
    expect(step.value).toBeNull();
    // A certificadora não tem mais o que fazer; a agência ganha o aviso e a pendência.
    expect(await certTasks(ocp, order)).toHaveLength(0);
    const notes = await inbox(agency, order);
    expect(notes).toHaveLength(before + 1);
    const handOver = notes.find(
      (n) => n.link === stepLink(order, "cert_seal_art"),
    )!;
    // "Agora é com você": quem recebe é quem age (não a certificadora).
    expect(handOver.kind).toBe("action");
    expect(handOver.actor).toBe("recipient");
    const tasks = await certTasks(agency, order);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].kind).toBe("cert_step");
    expect(tasks[0].text?.title).toBe("tasks.seal.apply.title");
    // A Wellmix não ganha a pendência da agência.
    expect(await certTasks(admin, order)).toHaveLength(0);
  });

  it("o arquivo do selo abre para a Wellmix, o despachante e a agência; para mais ninguém", async () => {
    const sealDoc = (await getStore().get("documents", sealDocId))!;
    for (const user of [admin, operator, ocp, agency])
      expect(await canAccessDocument(user, sealDoc)).toBe(true);
    for (const user of [supplierA, joao, comex])
      expect(await canAccessDocument(user, sealDoc)).toBe(false);
  });

  it("o zip das artes leva o selo para quem pode abrir", async () => {
    const forAgency = await art.artworkDocuments(agency, order);
    expect(forAgency.some((d) => d.id === sealDocId)).toBe(true);
    const forSupplier = await art.artworkDocuments(supplierA, order);
    expect(forSupplier.some((d) => d.id === sealDocId)).toBe(false);
  });

  it("a agência vê em que pé está o selo", async () => {
    expect(await f.sealStateFor(agency, order)).toBe("ready");
  });

  it("a agência envia a arte com o selo; só a Wellmix valida; recusa volta para a agência", async () => {
    await expect(
      f.submitStep(ocp, order.id, "cert_seal_art", {
        documentId: (await doc(ocp, order, "arte-ocp.pdf")).id,
      }),
    ).rejects.toThrow();
    await f.submitStep(agency, order.id, "cert_seal_art", {
      documentId: (await doc(agency, order, "arte-com-selo.pdf")).id,
    });
    expect(await certTasks(agency, order)).toHaveLength(0);
    expect(await f.sealStateFor(agency, order)).toBe("sent");
    const validate = await certTasks(admin, order);
    expect(validate.map((t) => t.kind)).toEqual(["cert_validate"]);
    expect(validate[0].text?.title).toBe("tasks.seal.validate.title");
    expect((await certTasks(operator, order)).map((t) => t.kind)).toEqual([
      "cert_validate",
    ]);
    for (const user of [agency, ocp])
      await expect(
        f.validateStep(user, order.id, "cert_seal_art", "validated", null),
      ).rejects.toThrow();
    await expect(
      f.validateStep(admin, order.id, "cert_seal_art", "rejected", null),
    ).rejects.toThrow("reason_required");
    const before = (await inbox(agency, order)).length;
    await f.validateStep(
      admin,
      order.id,
      "cert_seal_art",
      "rejected",
      "Selo pequeno demais",
    );
    expect(await inbox(agency, order)).toHaveLength(before + 1);
    expect(await certTasks(agency, order)).toHaveLength(1);
    // A tela do briefing diz que a arte com o selo é para refazer.
    expect(await f.sealStateFor(agency, order)).toBe("rejected");
  });

  it("arte reenviada e validada: tudo concluído, sem pendência para ninguém", async () => {
    await f.submitStep(agency, order.id, "cert_seal_art", {
      documentId: (await doc(agency, order, "arte-com-selo-v2.pdf")).id,
    });
    await f.validateStep(
      operator,
      order.id,
      "cert_seal_art",
      "validated",
      null,
    );
    const view = await f.importFlowView(admin, order, "certification");
    expect(
      view
        .filter((v) => v.template.key.startsWith("cert_seal"))
        .every((v) => v.done),
    ).toBe(true);
    for (const user of [admin, operator, ocp, agency])
      expect(await certTasks(user, order)).toHaveLength(0);
    expect(await f.sealStateFor(agency, order)).toBe("done");
  });
});

describe("selo trocado depois da arte", () => {
  let order: Order;
  beforeAll(async () => {
    order = await newOrder();
    await f.submitStep(ocp, order.id, "cert_seal", {
      value: "INMETRO 001",
      documentId: (await doc(ocp, order, "selo-v1.pdf")).id,
    });
    await f.submitStep(agency, order.id, "cert_seal_art", {
      documentId: (await doc(agency, order, "arte-v1.pdf")).id,
    });
    await f.validateStep(admin, order.id, "cert_seal_art", "validated", null);
  });

  it("reenviar sem mudar nada não reabre a arte nem avisa de novo", async () => {
    const before = (await inbox(agency, order)).length;
    await f.submitStep(ocp, order.id, "cert_seal", { value: "INMETRO 001" });
    expect(await inbox(agency, order)).toHaveLength(before);
    expect(await certTasks(agency, order)).toHaveLength(0);
  });

  it("selo novo reabre a arte (leva o selo antigo) e avisa a agência", async () => {
    const before = (await inbox(agency, order)).length;
    await f.submitStep(ocp, order.id, "cert_seal", {
      value: "INMETRO 002",
      documentId: (await doc(ocp, order, "selo-v2.pdf")).id,
    });
    const view = await f.importFlowView(agency, order, "certification");
    const applied = view.find((v) => v.template.key === "cert_seal_art")!;
    expect(applied.step?.status).toBe("rejected");
    // Motivo gravado como marcador: a tela mostra no idioma de quem lê.
    expect(applied.step?.rejectReason).toBe(f.SEAL_REPLACED_REASON);
    expect(applied.done).toBe(false);
    expect(applied.canSubmit).toBe(true);
    expect(await inbox(agency, order)).toHaveLength(before + 1);
    expect(await certTasks(agency, order)).toHaveLength(1);
    // A arte antiga (com o selo antigo) não volta: o reenvio pede arquivo novo.
    expect(applied.step?.documentId).toBeNull();
    await expect(
      f.submitStep(agency, order.id, "cert_seal_art", {}),
    ).rejects.toThrow("file_required");
  });
});

describe("pedido sem agência: a Wellmix aplica o selo", () => {
  let order: Order;
  beforeAll(async () => {
    order = await newOrder();
    order = await getStore().update("orders", order.id, { agencyId: null });
  });

  it("selo enviado: o aviso e a pendência de aplicar vão para a Wellmix", async () => {
    const before = (await inbox(admin, order)).length;
    await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: (await doc(ocp, order, "selo.pdf")).id,
    });
    expect((await inbox(admin, order)).length).toBeGreaterThan(before);
    const tasks = await certTasks(admin, order);
    expect(tasks.map((t) => t.kind)).toEqual(["cert_step"]);
    expect(tasks[0].text?.title).toBe("tasks.seal.apply.title");
    expect(await certTasks(agency, order)).toHaveLength(0);
  });

  it("quem enviou a arte não valida a própria (exceto o administrador)", async () => {
    // O analista do pedido envia: o aviso de validar vai para o resto da
    // equipe, não só para ele (que não valida o próprio passo).
    order = await getStore().update("orders", order.id, {
      ownerUserId: operator.id,
    });
    const adminBefore = (await inbox(admin, order)).length;
    const operatorBefore = (await inbox(operator, order)).length;
    await f.submitStep(operator, order.id, "cert_seal_art", {
      documentId: (await doc(operator, order, "arte.pdf")).id,
    });
    expect(await inbox(admin, order)).toHaveLength(adminBefore + 1);
    expect(await inbox(operator, order)).toHaveLength(operatorBefore);
    await expect(
      f.validateStep(operator, order.id, "cert_seal_art", "validated", null),
    ).rejects.toThrow("own_step");
    expect((await certTasks(admin, order)).map((t) => t.kind)).toEqual([
      "cert_validate",
    ]);
    await f.validateStep(admin, order.id, "cert_seal_art", "validated", null);
    expect(await certTasks(admin, order)).toHaveLength(0);
  });
});

describe("arte feita pela Wellmix nas configurações", () => {
  it("com agência no pedido, o passo do selo na arte fica com a Wellmix", async () => {
    const order = await newOrder();
    expect(order.agencyId).toBe(agency.partyId);
    await setSetting("agencyValidationEnabled", false);
    try {
      const before = (await inbox(agency, order)).length;
      await f.submitStep(ocp, order.id, "cert_seal", {
        documentId: (await doc(ocp, order, "selo.pdf")).id,
      });
      expect(await inbox(agency, order)).toHaveLength(before);
      expect(await certTasks(agency, order)).toHaveLength(0);
      expect((await certTasks(admin, order)).map((t) => t.kind)).toEqual([
        "cert_step",
      ]);
      // A agência do pedido só acompanha: não envia a arte com o selo.
      const view = await f.importFlowView(agency, order, "certification");
      expect(view.every((v) => !v.canSubmit)).toBe(true);
      expect(await f.sealStateFor(agency, order)).toBeNull();
      await expect(
        f.submitStep(agency, order.id, "cert_seal_art", {
          documentId: (await doc(agency, order, "arte-agencia.pdf")).id,
        }),
      ).rejects.toThrow();
      // Trocar a agência não muda quem faz a arte: ninguém é avisado de novo.
      const adminBefore = (await inbox(admin, order)).length;
      await f.notifySealPartner(
        { ...order, agencyId: null },
        "agencyId",
        order.agencyId,
      );
      expect(await inbox(admin, order)).toHaveLength(adminBefore);
    } finally {
      await setSetting("agencyValidationEnabled", true);
    }
    // De volta à agência: a pendência é dela.
    expect(await certTasks(agency, order)).toHaveLength(1);
    expect(await certTasks(admin, order)).toHaveLength(0);
  });
});

describe("parceiro designado depois", () => {
  it("certificadora vinculada depois é avisada; com o selo já enviado, não; despachante designado não é avisado", async () => {
    let order = await newOrder();
    const before = (await inbox(ocp, order)).length;
    // Mesma certificadora de novo no pedido ainda sem selo: avisa.
    await f.notifySealPartner(order, "ocpId");
    expect(await inbox(ocp, order)).toHaveLength(before + 1);
    // Despachante designado: o selo não é dele (dono, 14/11/2026).
    const brokerBefore = (await inbox(broker, order)).length;
    await f.notifySealPartner(order, "brokerId");
    expect(await inbox(broker, order)).toHaveLength(brokerBefore);
    expect(await inbox(ocp, order)).toHaveLength(before + 1);
    await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: (await doc(ocp, order, "selo.pdf")).id,
    });
    order = await fresh(order);
    await f.notifySealPartner(order, "ocpId");
    expect(await inbox(ocp, order)).toHaveLength(before + 1);
  });

  it("agência designada depois do selo é avisada de que há selo a aplicar", async () => {
    let order = await newOrder();
    order = await getStore().update("orders", order.id, { agencyId: null });
    await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: (await doc(ocp, order, "selo.pdf")).id,
    });
    const before = (await inbox(agency, order)).length;
    order = await getStore().update("orders", order.id, {
      agencyId: agency.partyId,
    });
    await f.notifySealPartner(order, "agencyId");
    expect(await inbox(agency, order)).toHaveLength(before + 1);
    expect(await certTasks(agency, order)).toHaveLength(1);
    // Com a arte já enviada, nada a avisar.
    await f.submitStep(agency, order.id, "cert_seal_art", {
      documentId: (await doc(agency, order, "arte.pdf")).id,
    });
    await f.notifySealPartner(order, "agencyId");
    expect(await inbox(agency, order)).toHaveLength(before + 1);
  });

  it("pedido sem certificadora: todo pedido precisa de selo, então a Wellmix é avisada e fica com a pendência de vincular", async () => {
    let order = await newOrder();
    order = await getStore().update("orders", order.id, {
      ocpId: null,
      brokerId: null,
    });
    const before = (await inbox(admin, order)).length;
    await f.notifySealRequested(order);
    const notes = await inbox(admin, order);
    expect(notes).toHaveLength(before + 1);
    expect(notes.some((n) => n.link?.endsWith("#order-partners"))).toBe(true);
    // A pendência do selo não fica sem dono: vai para a Wellmix, em Parceiros.
    const assign = (await pendingTasksFor(admin)).filter(
      (t) => t.link === `/app/orders/${order.id}#order-partners`,
    );
    expect(assign).toHaveLength(1);
    expect(assign[0].kind).toBe("cert_step");
    expect(assign[0].text?.title).toBe("tasks.seal.assign.title");
    expect(await certTasks(ocp, order)).toHaveLength(0);
    // Memorial, laudo e registro não viram pendência sem certificadora.
    await getStore().update("orders", order.id, { status: "PREPARATION" });
    expect(await certTasks(admin, order)).toHaveLength(0);
    // Ninguém da Wellmix envia o selo no lugar dela (dono, 14/11/2026).
    await expect(
      f.submitStep(admin, order.id, "cert_seal", {
        documentId: (await doc(admin, order, "selo-por-email.pdf")).id,
      }),
    ).rejects.toThrow();
    // Certificadora vinculada: a pendência passa para ela e sai da Wellmix.
    order = await getStore().update("orders", order.id, {
      ocpId: ocp.partyId,
      status: "ORDER_CREATED",
    });
    const ocpBefore = (await inbox(ocp, order)).length;
    await f.notifySealPartner(order, "ocpId");
    expect(await inbox(ocp, order)).toHaveLength(ocpBefore + 1);
    expect(await certTasks(ocp, order)).toHaveLength(1);
    expect(
      (await pendingTasksFor(admin)).filter(
        (t) =>
          t.link === `/app/orders/${order.id}#order-partners` ||
          isCertLink(order, t.link),
      ),
    ).toHaveLength(0);
  });

  it("sem certificadora, o cartão e a tela do briefing mostram o selo do mesmo jeito", async () => {
    let order = await newOrder();
    order = await getStore().update("orders", order.id, { ocpId: null });
    const view = await f.importFlowView(agency, order, "certification");
    expect(view.map((v) => v.template.key)).toEqual([
      "cert_seal",
      "cert_seal_art",
    ]);
    expect(await f.sealStateFor(agency, order)).toBe("pending");
  });

  it("a Wellmix não envia o selo no lugar da certificadora: o servidor recusa e a agência segue esperando", async () => {
    let order = await newOrder();
    order = await getStore().update("orders", order.id, { ocpId: null });
    for (const user of [admin, operator, broker])
      await expect(
        f.submitStep(user, order.id, "cert_seal", {
          value: "SELO-123",
          documentId: (await doc(user, order, `selo-${user.role}.pdf`)).id,
        }),
      ).rejects.toThrow();
    expect(await certTasks(agency, order)).toHaveLength(0);
    expect(await f.sealStateFor(agency, order)).toBe("pending");
  });
});

describe("painel de certificação", () => {
  it("em andamento enquanto falta aplicar ou conferir o selo; sai quando conclui", async () => {
    const count = async () =>
      Number(
        (await areaPanel(admin, "certification")).metrics.find(
          (m) => m.key === "certInProgress",
        )!.value,
      );
    const base = await count();
    const order = await newOrder();
    // Pedido novo, nada enviado: ainda não conta.
    expect(await count()).toBe(base);
    await f.submitStep(ocp, order.id, "cert_seal", {
      documentId: (await doc(ocp, order, "selo.pdf")).id,
    });
    expect(await count()).toBe(base + 1);
    await f.submitStep(agency, order.id, "cert_seal_art", {
      documentId: (await doc(agency, order, "arte.pdf")).id,
    });
    expect(await count()).toBe(base + 1);
    await f.validateStep(admin, order.id, "cert_seal_art", "validated", null);
    expect(await count()).toBe(base);
  });
});

describe("certificadora vê o pedido completo (papel sem uso, mantido)", () => {
  // A Wellmix não trabalha com certificadora (dono, 13/11/2026), mas o papel
  // continua no código: a designada ainda lê o pedido como antes.
  let order: Order;
  let ocp: User;
  const otherOcp = () =>
    ({ ...ocp, id: "outra", partyId: "outra-ocp" }) as User;

  beforeAll(async () => {
    ocp = (await getStore().list("users")).find(
      (u) => u.email === "ocp@certifica.com",
    )!;
    order = await getStore().update("orders", (await newOrder()).id, {
      ocpId: ocp.partyId,
    });
  });

  it("lê a ficha de compra inteira, com preço, e não edita", async () => {
    const ps = await import("@/lib/services/purchase-sheet");
    await ps.saveSheet(admin, order.id, {
      supplierName: "Fábrica A",
      material: "GLASS",
      masterCartonQty: 24,
      incoterm: "FOB",
      currency: "USD",
      price: 2.5,
      moq: 500,
      averagePrice: 3.1,
      certificationNote: "Inmetro",
    } as never);
    expect(ps.sheetAccess(ocp, order)).toEqual({
      view: true,
      editSupplier: false,
      editCustoms: false,
      addPhotos: false,
    });
    const view = (await ps.getSheetForUser(ocp, order.id))!;
    expect(view.sheet.supplierName).toBe("Fábrica A");
    expect(view.sheet.material).toBe("GLASS");
    expect(view.sheet.masterCartonQty).toBe(24);
    expect(view.sheet.certificationNote).toBe("Inmetro");
    // Vê tudo do pedido (decisão do dono): o preço também.
    expect(ps.CERTIFIER_HIDDEN_FIELDS).toEqual([]);
    expect(view.sheet.price).toBe(2.5);
    expect(view.sheet.moq).toBe(500);
    expect(view.sheet.averagePrice).toBe(3.1);
    // A Wellmix continua vendo o preço; a ficha gravada não muda.
    const full = (await ps.getSheetForUser(admin, order.id))!;
    expect(full.sheet.price).toBe(2.5);
    expect(full.sheet.averagePrice).toBe(3.1);
    await expect(
      ps.saveSheet(ocp, order.id, { material: "PLASTIC" } as never),
    ).rejects.toThrow("forbidden");
    // Agência, comex e outra certificadora não abrem a ficha.
    for (const user of [agency, comex, otherOcp()])
      expect(await ps.getSheetForUser(user, order.id)).toBeNull();
  });

  it("abre o documento do pedido para ler, mas não assina", async () => {
    const sig = await import("@/lib/services/order-signature");
    expect(sig.canViewOrderDocument(ocp, order)).toBe(true);
    expect(sig.canViewOrderDocument(otherOcp(), order)).toBe(false);
    expect(sig.canViewOrderDocument(agency, order)).toBe(false);
    const view = (await sig.getOrderSignatureView(ocp, order.id))!;
    expect(view.canSign).toBeNull();
    expect(view.waitingWellmix).toBe(false);
    await expect(
      sig.signOrderDocument(ocp, order.id, {
        name: "Certificadora",
        agree: true,
        hash: view.hash,
      }),
    ).rejects.toThrow("forbidden");
  });

  it("abre as fotos de vitrine do produto, não o cartão do fabricante", async () => {
    const photo = async (name: string, kind: string) => {
      const d = await getStore().create("documents", {
        orderId: null,
        requestId: null,
        requirementId: null,
        productId: "prod-jarra",
        type: "photo",
        name,
        mime: "image/png",
        size: 3,
        storageKey: `k-${name}`,
        version: 1,
        previousDocumentId: null,
        uploadedByUserId: admin.id,
        visibility: "internal",
      } as never);
      await getStore().create("product_photos", {
        productId: "prod-jarra",
        sourcingItemId: null,
        orderId: null,
        documentId: d.id,
        kind,
        caption: null,
        takenAt: null,
        takenByUserId: admin.id,
        derivedFromPhotoId: null,
        isPrimary: false,
      } as never);
      return d;
    };
    const original = await photo("jarra.png", "original");
    const card = await photo("cartao.png", "business_card");
    expect(await canAccessDocument(ocp, original)).toBe(true);
    expect(await canAccessDocument(ocp, card)).toBe(false);
    // Certificadora sem pedido com este produto, comex e fornecedor: nada.
    for (const user of [otherOcp(), comex, supplierA])
      expect(await canAccessDocument(user, original)).toBe(false);
  });

  it("abre os certificados já registrados do produto e do fornecedor do pedido", async () => {
    const certDoc = async (name: string, productId: string | null) =>
      getStore().create("documents", {
        orderId: null,
        requestId: null,
        requirementId: null,
        productId,
        type: "other",
        name,
        mime: "application/pdf",
        size: 3,
        storageKey: `k-${name}`,
        version: 1,
        previousDocumentId: null,
        uploadedByUserId: admin.id,
        visibility: "supplier",
      } as never);
    const cert = async (
      entity: "product" | "party",
      entityId: string,
      documentId: string,
    ) =>
      getStore().create("certifications", {
        entity,
        entityId,
        kind: "Inmetro",
        name: null,
        issuer: null,
        number: "001",
        validUntil: null,
        documentId,
        status: "valid",
        notes: null,
        createdByUserId: admin.id,
        validatedByUserId: admin.id,
        validatedAt: new Date().toISOString(),
      } as never);
    const ofProduct = await certDoc("cert-produto.pdf", "prod-jarra");
    await cert("product", "prod-jarra", ofProduct.id);
    const ofSupplier = await certDoc("cert-fornecedor.pdf", null);
    await cert("party", order.supplierId, ofSupplier.id);
    const ofOtherSupplier = await certDoc("cert-outro.pdf", null);
    await cert("party", "fornecedor-b", ofOtherSupplier.id);
    expect(await canAccessDocument(ocp, ofProduct)).toBe(true);
    expect(await canAccessDocument(ocp, ofSupplier)).toBe(true);
    expect(await canAccessDocument(ocp, ofOtherSupplier)).toBe(false);
    for (const d of [ofProduct, ofSupplier]) {
      expect(await canAccessDocument(otherOcp(), d)).toBe(false);
      expect(await canAccessDocument(agency, d)).toBe(false);
    }
  });
});

describe("memorial e selo são da certificadora do pedido (dono, 14/11/2026)", () => {
  it("a certificadora recebe o aviso e a pendência do selo e envia o selo; o despachante só acompanha", async () => {
    const order = await newOrder();
    expect(order.brokerId).toBe(broker.partyId);
    expect(await inbox(ocp, order)).toHaveLength(1);
    const tasks = await certTasks(ocp, order);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text?.title).toBe("tasks.seal.issue.title");
    // O despachante vê o passo (laudo e registro seguem dele), mas não recebe
    // aviso nem pendência e não envia.
    expect(f.canSeeStep(broker, order, "cert_seal")).toBe(true);
    expect(await inbox(broker, order)).toHaveLength(0);
    expect(await certTasks(broker, order)).toHaveLength(0);
    await expect(
      f.submitStep(broker, order.id, "cert_seal", {
        documentId: (await doc(broker, order, "selo-despachante.pdf")).id,
      }),
    ).rejects.toThrow();
    await f.submitStep(ocp, order.id, "cert_seal", {
      value: "SELO-OCP-1",
      documentId: (await doc(ocp, order, "selo-ocp.pdf")).id,
    });
    expect(await certTasks(ocp, order)).toHaveLength(0);
    // Autoria e valor ficam no passo.
    const [seal] = await getStore().list("import_steps", {
      filter: { orderId: order.id, key: "cert_seal" },
    });
    expect([seal.submittedByUserId, seal.value]).toEqual([
      ocp.id,
      "SELO-OCP-1",
    ]);
  });

  it("o comprador (operador) só acompanha: sem pendência, sem formulário e o servidor recusa; vincular a certificadora fica com compras", async () => {
    let order = await newOrder();
    const { tasksForFunctions } = await import("@/lib/task-owner");
    const buyer = {
      ...operator,
      role: "operator" as const,
      functions: ["buyer"],
      screens: null,
    };
    const cert = (list: Awaited<ReturnType<typeof pendingTasksFor>>) =>
      list
        .filter(
          (t) =>
            t.orderId === order.id ||
            t.link.startsWith(`/app/orders/${order.id}#certification`),
        )
        .filter((t) => t.kind === "cert_step" && t.stepKey !== "assign");
    // Com a certificadora: nada de certificação para o comprador.
    expect(
      cert(tasksForFunctions(buyer, await pendingTasksFor(buyer))),
    ).toHaveLength(0);
    const view = await f.importFlowView(buyer, order, "certification");
    for (const key of ["cert_seal", "cert_memorial"] as const) {
      const row = view.find((v) => v.template.key === key)!;
      expect(row, key).toBeTruthy();
      expect(row.canSubmit, key).toBe(false);
      expect(await f.canSubmitStep(buyer, order, key)).toBe(false);
      await expect(
        f.submitStep(buyer, order.id, key, {
          value: key === "cert_seal" ? "SELO-1" : null,
          documentId: (await doc(buyer, order, `${key}-comprador.pdf`)).id,
        }),
      ).rejects.toThrow();
    }
    // Sem a certificadora: uma pendência só, a de vincular, de compras.
    order = await getStore().update("orders", order.id, { ocpId: null });
    const all = await pendingTasksFor(buyer);
    expect(cert(tasksForFunctions(buyer, all))).toHaveLength(0);
    const assign = tasksForFunctions(buyer, all).filter(
      (t) => t.link === `/app/orders/${order.id}#order-partners`,
    );
    expect(assign.map((t) => [t.text?.title, t.stepKey])).toEqual([
      ["tasks.seal.assign.title", "assign"],
    ]);
  });
});

describe("despachante e certificadora leem o que precisam", () => {
  it("abrem as fotos de vitrine dos produtos dos pedidos deles", async () => {
    const order = await newOrder();
    const photos = await getStore().list("product_photos", {
      filter: { productId: "prod-jarra" },
    });
    const showcase = photos.find((p) => p.kind === "original");
    expect(showcase).toBeTruthy();
    const d = (await getStore().get("documents", showcase!.documentId))!;
    expect(order.brokerId).toBe(broker.partyId);
    expect(order.ocpId).toBe(ocp.partyId);
    expect(await canAccessDocument(broker, d)).toBe(true);
    expect(await canAccessDocument(ocp, d)).toBe(true);
  });
});
