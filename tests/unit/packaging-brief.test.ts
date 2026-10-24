import { beforeAll, describe, expect, it } from "vitest";
import { translator } from "@/i18n";
import { withTempStore } from "./setup";

/*
 * Embalagem na RFQ: ao abrir a cotação para os fornecedores, a agência (ou o
 * marketing da Wellmix) recebe no mesmo instante a pendência da faca e da
 * arte. Arquivos só chegam ao fornecedor escolhido depois que o pedido nasce;
 * a arte já enviada conclui o item "Arte" e ele só aprova.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const r = await import("@/lib/services/requests");
const pb = await import("@/lib/services/packaging-brief");
const calc = await import("@/lib/services/packaging-brief-calc");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { canAccessDocument } = await import("@/lib/services/documents");
const { submitRequirement, decideRequirement } =
  await import("@/lib/workflow/engine");
const { saveQuoteSheet } = await import("@/lib/services/quote-sheet");
const { runReminders } = await import("@/lib/services/reminders");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;
let agency: User;
let agencyB: User;

const pdf = (name = "arte.pdf") =>
  new File([new Uint8Array([37, 80, 68, 70, 45, 49])], name, {
    type: "application/pdf",
  });

/** Avisos no portal (cada aviso também gera e-mail e WhatsApp simulados). */
async function notificationsOf(user: User) {
  return getStore().list("notifications", {
    filter: { userId: user.id, channel: "inapp" },
  });
}

async function newRequest(productId: string | null = "prod-jarra") {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: "Jarra teste",
    description: "Embalagem na RFQ",
    specification: null,
    quantity: 500,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

async function answer(request: Request, supplierUser: User, supplierId: string) {
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: request.id, supplierId },
  });
  await r.answerQuote(supplierUser, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  return quote;
}

async function toOrder(request: Request) {
  const quote = await answer(request, supplierA, "fornecedor-a");
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  return r.confirmDownPayment(admin, request.id);
}

/** Avança ORDER_CREATED e PREPARATION para a Embalagem abrir. */
async function reachPackaging(orderId: string) {
  const store = getStore();
  for (const key of ["ORDER_CREATED", "PREPARATION"]) {
    const [stage] = await store.list("stages", {
      filter: { orderId, key: key as never },
    });
    for (const req of await store.list("requirements", {
      filter: { stageId: stage.id, status: "pending" },
    }))
      if ((await store.get("stages", stage.id))?.status === "active")
        await submitRequirement(admin, req.id, { value: "1" });
  }
  return (await store.get("orders", orderId))!;
}

async function packagingReqs(orderId: string) {
  const store = getStore();
  const [pack] = await store.list("stages", {
    filter: { orderId, key: "PACKAGING" },
  });
  const reqs = await store.list("requirements", {
    filter: { stageId: pack.id },
  });
  return {
    stage: (await store.get("stages", pack.id))!,
    art: reqs.find((x) => x.key === "art")!,
    approval: reqs.find((x) => x.key === "art_approval")!,
  };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.role === "admin")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  agency = users.find((u) => u.email === "agencia@design.com")!;
  // Segunda agência (inativa por padrão nos testes de "única ativa").
  const store = getStore();
  const party = await store.create("parties", {
    ...(await import("@/lib/db")).PARTY_EXTRA_DEFAULTS,
    type: "agency",
    name: "Agência B",
    country: "BR",
    email: "b@agencia.com",
    phone: null,
    taxId: null,
    notes: null,
    active: false,
  });
  agencyB = await store.create("users", {
    ...(await import("@/lib/db")).USER_EXTRA_DEFAULTS,
    email: "b@agencia.com",
    name: "Agência B",
    role: "agency",
    partyId: party.id,
    locale: "pt",
    passwordHash: "x",
    active: true,
  });
});

describe("regras puras", () => {
  it("medidas: só com as três da caixa; comparação com tolerância", () => {
    expect(calc.packagingDimsFor(null)).toBeNull();
    expect(calc.packagingDimsFor({ lengthCm: 10, widthCm: 20 })).toBeNull();
    const a = calc.packagingDimsFor({
      lengthCm: 60,
      widthCm: 40,
      heightCm: 30,
      masterCartonQty: 12,
    })!;
    expect(a.masterCartonQty).toBe(12);
    const b = { ...a, lengthCm: 62 }; // +3,3 %
    expect(calc.packagingDimsChanged(a, b, 5)).toBe(false);
    expect(calc.packagingDimsChanged(a, b, 2)).toBe(true);
    expect(calc.packagingDimsChanged(a, { ...a, masterCartonQty: 24 }, 5)).toBe(
      true,
    );
    expect(calc.packagingDimsChanged(null, a, 5)).toBe(true);
    expect(calc.normalizeRequiredKeys(["art", "x", "art"])).toEqual(["art"]);
    expect(calc.normalizeRequiredKeys([])).toEqual(["dieline", "art"]);
  });
});

describe("abertura junto com a RFQ", () => {
  it("abrir a RFQ cria o briefing e, no mesmo instante, pendência e aviso para a agência e para o fornecedor", async () => {
    const request = await newRequest();
    const beforeAgency = (await notificationsOf(agency)).length;
    const beforeSupplier = (await notificationsOf(supplierA)).length;
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = await pb.briefForRequest(request.id);
    expect(brief).not.toBeNull();
    expect(brief!.status).toBe("open");
    // Única agência ativa: ela é a dona.
    expect(brief!.agencyId).toBe("agencia");
    expect(brief!.ownerSource).toBe("only_active");
    expect(brief!.requiredKeys).toEqual(["dieline", "art"]);
    expect(brief!.dueAt).not.toBeNull();

    const agencyTasks = await pendingTasksFor(agency);
    const mine = agencyTasks.find((t) => t.kind === "packaging_brief");
    expect(mine).toBeDefined();
    expect(mine!.link).toBe(`/app/packaging/${brief!.id}`);
    expect(mine!.group).toBe("PACKAGING");
    expect(mine!.detail).toContain("venda ainda não confirmada");
    const supplierTasks = await pendingTasksFor(supplierA);
    expect(supplierTasks.some((t) => t.kind === "quote")).toBe(true);

    const agencyNotes = (await notificationsOf(agency)).slice(beforeAgency);
    expect(agencyNotes).toHaveLength(1);
    expect(agencyNotes[0].kind).toBe("action");
    expect(agencyNotes[0].subject).toContain("Embalagem para preparar");
    expect(agencyNotes[0].link).toBe(`/app/packaging/${brief!.id}`);
    expect((await notificationsOf(supplierA)).length).toBe(beforeSupplier + 1);
    // A Wellmix não tem pendência do briefing (é da agência).
    expect(
      (await pendingTasksFor(admin)).some((t) => t.kind === "packaging_brief"),
    ).toBe(false);
  });

  it("é idempotente: convidar mais fornecedores não duplica nem avisa de novo a agência", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const count = (await notificationsOf(agency)).length;
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    const rows = await getStore().list("packaging_briefs", {
      filter: { requestId: request.id },
    });
    expect(rows).toHaveLength(1);
    expect((await notificationsOf(agency)).length).toBe(count);
  });

  it("agência escolhida no formulário, marketing Wellmix explícito e agência inválida", async () => {
    const store = getStore();
    const chosen = await newRequest();
    await r.openRfq(admin, chosen.id, ["fornecedor-a"], {
      packaging: { agencyId: "agencia", brief: "Marca em dourado" },
    });
    const b1 = (await pb.briefForRequest(chosen.id))!;
    expect(b1.ownerSource).toBe("chosen");
    expect(b1.brief).toBe("Marca em dourado");

    const self = await newRequest();
    const beforeAdmin = (await notificationsOf(admin)).length;
    await r.openRfq(admin, self.id, ["fornecedor-a"], {
      packaging: { agencyId: null },
    });
    const b2 = (await pb.briefForRequest(self.id))!;
    expect(b2.agencyId).toBeNull();
    expect(b2.ownerSource).toBe("chosen");
    // Pendência da Wellmix; aviso "marketing Wellmix".
    expect(
      (await pendingTasksFor(admin)).some(
        (t) => t.kind === "packaging_brief" && t.link.includes(b2.id),
      ),
    ).toBe(true);
    const adminNotes = (await notificationsOf(admin)).slice(beforeAdmin);
    expect(adminNotes.some((n) => /marketing Wellmix/.test(n.subject))).toBe(true);

    const bad = await newRequest();
    await expect(
      r.openRfq(admin, bad.id, ["fornecedor-a"], {
        packaging: { agencyId: "nao-existe" },
      }),
    ).rejects.toThrow("no_agency");
    // Nenhuma cotação foi criada: a validação vem antes.
    expect(
      await store.list("quotes", { filter: { requestId: bad.id } }),
    ).toHaveLength(0);
  });

  it("configuração: 'order' não abre nada; 'selection' abre ao escolher o fornecedor; agência desligada → Wellmix", async () => {
    await setSetting("packagingBriefAt", "order");
    const none = await newRequest();
    await r.openRfq(admin, none.id, ["fornecedor-a"]);
    expect(await pb.briefForRequest(none.id)).toBeNull();

    await setSetting("packagingBriefAt", "selection");
    const later = await newRequest();
    await r.openRfq(admin, later.id, ["fornecedor-a"]);
    expect(await pb.briefForRequest(later.id)).toBeNull();
    const quote = await answer(later, supplierA, "fornecedor-a");
    await r.selectQuote(admin, quote.id, {
      sellPrice: 1000,
      sellCurrency: "BRL",
      downPaymentAmount: 300,
    });
    expect((await pb.briefForRequest(later.id))?.status).toBe("open");
    await setSetting("packagingBriefAt", "rfq");

    await setSetting("agencyValidationEnabled", false);
    const wm = await newRequest();
    await r.openRfq(admin, wm.id, ["fornecedor-a"]);
    const b = (await pb.briefForRequest(wm.id))!;
    expect(b.agencyId).toBeNull();
    expect(b.ownerSource).toBe("wellmix");
    await setSetting("agencyValidationEnabled", true);
  });

  it("RFQ do lote: um briefing por produto e um aviso só para a agência", async () => {
    const before = (await notificationsOf(agency)).length;
    const batch = await r.createRequestBatch(
      joao,
      {
        customerId: "cliente-joao",
        deadline: null,
        notes: null,
        requestedForUserId: joao.id,
      },
      [
        {
          productId: "prod-jarra",
          productName: "Jarra A",
          description: "lote",
          specification: null,
          quantity: 10,
          unit: "un",
          sourcingDemand: false,
        },
        {
          productId: null,
          productName: "Copo B",
          description: "lote",
          specification: null,
          quantity: 20,
          unit: "un",
          sourcingDemand: false,
        },
      ],
    );
    const groupId = batch[0].groupId!;
    await r.openBatchRfq(admin, groupId, ["fornecedor-a"]);
    for (const req of batch)
      expect((await pb.briefForRequest(req.id))?.status).toBe("open");
    const notes = (await notificationsOf(agency)).slice(before);
    expect(notes).toHaveLength(1);
    expect(notes[0].subject).toContain("2 produtos");
    expect(notes[0].link).toBe("/app/packaging");
  });
});

describe("entregáveis, medidas e isolamento", () => {
  it("uploads versionam por entregável, 'pronto' só com os obrigatórios, excluir volta a 'em preparação'", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    const beforeAdmin = (await notificationsOf(admin)).length;

    const d1 = await pb.uploadPackagingItem(agency, brief.id, "dieline", pdf("faca.pdf"));
    expect(d1.document.version).toBe(1);
    expect(d1.document.packagingBriefId).toBe(brief.id);
    expect(d1.brief.status).toBe("open");
    const d2 = await pb.uploadPackagingItem(agency, brief.id, "dieline", pdf("faca2.pdf"));
    expect(d2.document.version).toBe(2);
    expect(d2.document.previousDocumentId).toBe(d1.document.id);
    const a1 = await pb.uploadPackagingItem(agency, brief.id, "art", pdf());
    expect(a1.brief.status).toBe("ready");
    expect(a1.brief.readyAt).not.toBeNull();
    // Pronto: a Wellmix recebe "concluído"; a pendência da agência some.
    const adminNotes = (await notificationsOf(admin)).slice(beforeAdmin);
    expect(adminNotes.some((n) => n.kind === "done" && /Embalagem pronta/.test(n.subject))).toBe(true);
    expect(
      (await pendingTasksFor(agency)).some((t) => t.link.includes(brief.id)),
    ).toBe(false);

    // Opcional depois de pronto: aviso de novidade, continua pronto.
    const s1 = await pb.uploadPackagingItem(agency, brief.id, "packaging_sample", pdf("foto.pdf"));
    expect(s1.brief.status).toBe("ready");

    const cleared = await pb.clearPackagingItem(agency, brief.id, "art");
    expect(cleared.status).toBe("open");
    expect(cleared.artDocumentId).toBeNull();
    expect(await getStore().get("documents", a1.document.id)).toBeNull();

    // Outra agência (não dona) não envia nem exclui.
    await expect(
      pb.uploadPackagingItem(agencyB, brief.id, "art", pdf()),
    ).rejects.toThrow();
  });

  it("arquivos: só a agência dona abre antes do pedido; depois, só o fornecedor escolhido; cliente e concorrente nunca", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    const brief = (await pb.briefForRequest(request.id))!;
    const { document } = await pb.uploadPackagingItem(agency, brief.id, "art", pdf());
    expect(await canAccessDocument(agency, document)).toBe(true);
    expect(await canAccessDocument(agencyB, document)).toBe(false);
    expect(await canAccessDocument(supplierA, document)).toBe(false);
    expect(await canAccessDocument(supplierB, document)).toBe(false);
    expect(await canAccessDocument(joao, document)).toBe(false);
    expect(await canAccessDocument(admin, document)).toBe(true);

    const order = await toOrder(request);
    const moved = (await getStore().get("documents", document.id))!;
    expect(moved.orderId).toBe(order.id);
    expect(moved.visibility).toBe("supplier");
    expect(await canAccessDocument(supplierA, moved)).toBe(true);
    expect(await canAccessDocument(supplierB, moved)).toBe(false);
    expect(await canAccessDocument(joao, moved)).toBe(false);
    expect(await canAccessDocument(agency, moved)).toBe(true);
    // A tela do briefing: agência dona vê; outra agência e cliente não.
    expect(await pb.getPackagingBriefView(agency, brief.id)).not.toBeNull();
    expect(await pb.getPackagingBriefView(agencyB, brief.id)).toBeNull();
    expect(await pb.getPackagingBriefView(joao, brief.id)).toBeNull();
    const view = (await pb.getPackagingBriefView(agency, brief.id))!;
    // Agência não vê o cliente por padrão; vê o fornecedor escolhido.
    expect(view.customerName).toBeNull();
    expect(view.supplierName).toBeTruthy();
  });

  it("medidas: sem ficha mestre → provisórias da 1ª ficha de cotação → definitivas na escolha; mudança além da tolerância alerta e reabre", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    let brief = (await pb.briefForRequest(request.id))!;
    expect(brief.dims).toBeNull();
    const [qa] = await getStore().list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-a" },
    });
    const [qb] = await getStore().list("quotes", {
      filter: { requestId: request.id, supplierId: "fornecedor-b" },
    });
    await saveQuoteSheet(supplierA, qa.id, {
      lengthCm: 60,
      widthCm: 40,
      heightCm: 30,
      masterCartonQty: 12,
    } as never);
    brief = (await pb.briefForRequest(request.id))!;
    expect(brief.dims?.lengthCm).toBe(60);
    expect(brief.dimsProvisional).toBe(true);
    expect(brief.dimsSource).toBe("quote");
    // Segunda ficha não substitui as provisórias.
    await saveQuoteSheet(supplierB, qb.id, {
      lengthCm: 80,
      widthCm: 50,
      heightCm: 40,
      masterCartonQty: 24,
    } as never);
    expect((await pb.briefForRequest(request.id))!.dims?.lengthCm).toBe(60);

    // Faca e arte prontas com as provisórias.
    await pb.uploadPackagingItem(agency, brief.id, "dieline", pdf("faca.pdf"));
    await pb.uploadPackagingItem(agency, brief.id, "art", pdf());
    expect((await pb.briefForRequest(request.id))!.status).toBe("ready");

    // Fornecedor B escolhido: medidas bem diferentes → alerta e volta a "em preparação".
    await r.answerQuote(supplierA, qa.id, { price: 2, currency: "USD", leadTimeDays: 10, conditions: null });
    await r.answerQuote(supplierB, qb.id, { price: 2, currency: "USD", leadTimeDays: 10, conditions: null });
    const before = (await notificationsOf(agency)).length;
    await r.selectQuote(admin, qb.id, {
      sellPrice: 1000,
      sellCurrency: "BRL",
      downPaymentAmount: 300,
    });
    brief = (await pb.briefForRequest(request.id))!;
    expect(brief.dims?.lengthCm).toBe(80);
    expect(brief.dimsProvisional).toBe(false);
    expect(brief.dimsChangedAt).not.toBeNull();
    expect(brief.status).toBe("open");
    expect(brief.artDocumentId).not.toBeNull(); // arquivos ficam
    const notes = (await notificationsOf(agency)).slice(before);
    expect(notes.some((n) => n.kind === "alert" && /mudaram/.test(n.subject))).toBe(true);
  });

  it("ficha mestre completa: medidas 'master' desde a abertura; escolha dentro da tolerância não alerta", async () => {
    const store = getStore();
    const product = await store.create("products", {
      ...(await import("@/lib/db")).PRODUCT_EXTRA_DEFAULTS,
      lineId: "linha-utilidades",
      name: "Caneca com ficha",
      sku: "CAN-900",
      description: null,
      specification: null,
      active: true,
      supplierId: "fornecedor-a",
    } as never);
    const { saveProductSheet } = await import("@/lib/services/product-sheet");
    await saveProductSheet(admin, product.id, {
      lengthCm: 50,
      widthCm: 40,
      heightCm: 30,
      masterCartonQty: 48,
    } as never);
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: product.id,
      productName: "Caneca com ficha",
      description: "x",
      specification: null,
      quantity: 480,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    expect(brief.dimsSource).toBe("master");
    expect(brief.dims?.masterCartonQty).toBe(48);
    const [qa] = await store.list("quotes", { filter: { requestId: request.id } });
    await saveQuoteSheet(supplierA, qa.id, {
      lengthCm: 51,
      widthCm: 40,
      heightCm: 30,
      masterCartonQty: 48,
    } as never);
    await r.answerQuote(supplierA, qa.id, { price: 2, currency: "USD", leadTimeDays: 10, conditions: null });
    const before = (await notificationsOf(agency)).length;
    await r.selectQuote(admin, qa.id, { sellPrice: 1000, sellCurrency: "BRL", downPaymentAmount: 300 });
    const after = (await pb.briefForRequest(request.id))!;
    expect(after.dimsChangedAt).toBeNull();
    expect(after.dimsSource).toBe("quote");
    expect(after.dims?.lengthCm).toBe(51);
    const notes = (await notificationsOf(agency)).slice(before);
    expect(notes.some((n) => /mudaram/.test(n.subject))).toBe(false);
    // "Fornecedor escolhido" informa quem fabrica.
    expect(notes.some((n) => /Fornecedor escolhido/.test(n.subject))).toBe(true);
  });
});

describe("pedido criado", () => {
  it("arte enviada na RFQ: pedido nasce com a agência do briefing, 'Arte' concluída e o fornecedor só aprova", async () => {
    const store = getStore();
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    await pb.uploadPackagingItem(agency, brief.id, "dieline", pdf("faca.pdf"));
    const art = await pb.uploadPackagingItem(agency, brief.id, "art", pdf());
    const order = await toOrder(request);
    expect(order.agencyId).toBe("agencia");
    const moved = (await pb.briefForRequest(request.id))!;
    expect(moved.status).toBe("transferred");
    expect(moved.orderId).toBe(order.id);
    let reqs = await packagingReqs(order.id);
    expect(reqs.art.status).toBe("done");
    expect(reqs.art.documentId).toBe(art.document.id);
    expect(reqs.art.submittedByUserId).toBe(agency.id);
    expect(reqs.art.note).toMatch(/solicitação/);
    expect((await store.get("documents", art.document.id))!.requirementId).toBe(reqs.art.id);
    // Pendência do briefing some (agora é do pedido).
    expect((await pendingTasksFor(agency)).some((t) => t.link.includes(brief.id))).toBe(false);

    const beforeSupplier = (await notificationsOf(supplierA)).length;
    const beforeAgency = (await notificationsOf(agency)).length;
    await reachPackaging(order.id);
    reqs = await packagingReqs(order.id);
    expect(reqs.stage.status).toBe("active");
    expect(reqs.stage.responsibleRole).toBe("supplier");
    expect(reqs.stage.percent).toBe(50);
    // Aviso vai ao fornecedor (aprovar), no idioma dele, não à agência.
    const zh = translator(supplierA.locale);
    const supplierNotes = (await notificationsOf(supplierA)).slice(beforeSupplier);
    expect(
      supplierNotes.some(
        (n) =>
          n.subject ===
            zh("notif.stage.subject", { n: order.number, stage: zh("stage.PACKAGING") }) &&
          n.body === zh("notif.stage.body", { items: zh("req.art_approval") }),
      ),
    ).toBe(true);
    expect((await notificationsOf(agency)).length).toBe(beforeAgency);
    // Pendência: do fornecedor; a agência não tem nenhuma neste pedido.
    const orderLink = `/app/orders/${order.id}`;
    expect((await pendingTasksFor(supplierA)).some((t) => t.link === orderLink && t.stageKey === "PACKAGING")).toBe(true);
    expect((await pendingTasksFor(agency)).some((t) => t.link === orderLink)).toBe(false);

    // Reprovar devolve à mesma agência; reenvio pelo briefing vira v2 e reabre a aprovação.
    await decideRequirement(supplierA, reqs.approval.id, "reject", "Logo torto");
    reqs = await packagingReqs(order.id);
    // Reprovada: o item "Arte" volta a ser pedido (status `rejected`, como no pedido).
    expect(reqs.art.status).toBe("rejected");
    expect((await pendingTasksFor(agency)).some((t) => t.link === orderLink)).toBe(true);
    const again = await pb.uploadPackagingItem(agency, brief.id, "art", pdf("arte2.pdf"));
    expect(again.document.version).toBe(2);
    reqs = await packagingReqs(order.id);
    expect(reqs.art.status).toBe("done");
    expect(reqs.approval.status).toBe("pending");
    await decideRequirement(supplierA, reqs.approval.id, "approve", null);
    expect((await packagingReqs(order.id)).stage.status).toBe("done");
  });

  it("briefing ainda aberto ao nascer o pedido: uma pendência só, a etapa segue como antes", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    const beforeAgency = (await notificationsOf(agency)).length;
    const order = await toOrder(request);
    expect(order.agencyId).toBe("agencia");
    const moved = (await pb.briefForRequest(request.id))!;
    expect(moved.status).toBe("transferred");
    // Aviso "ainda pendente" com link ao briefing; pendência do briefing some.
    const notes = (await notificationsOf(agency)).slice(beforeAgency);
    expect(notes.some((n) => /ainda pendente/.test(n.subject))).toBe(true);
    expect((await pendingTasksFor(agency)).filter((t) => t.link.includes(brief.id))).toHaveLength(0);
    // Arte pelo briefing antes de a etapa abrir conclui o item; a etapa abre direto na aprovação.
    await pb.uploadPackagingItem(agency, brief.id, "art", pdf());
    expect((await packagingReqs(order.id)).art.status).toBe("done");
    await reachPackaging(order.id);
    const reqs = await packagingReqs(order.id);
    expect(reqs.stage.responsibleRole).toBe("supplier");
    const agencyTasks = await pendingTasksFor(agency);
    expect(agencyTasks.filter((t) => t.link === `/app/orders/${order.id}`)).toHaveLength(0);
  });

  it("'Marketing Wellmix' escolhido de propósito: pedido nasce sem agência e a arte é da Wellmix", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"], {
      packaging: { agencyId: null },
    });
    const order = await toOrder(request);
    expect(order.agencyId).toBeNull();
    const reqs = await packagingReqs(order.id);
    expect(reqs.art.role).toBe("operator");
  });
});

describe("cancelamento, troca de dono e lembretes", () => {
  it("excluir a solicitação cancela o briefing e alerta a agência; a pendência some", async () => {
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    const before = (await notificationsOf(agency)).length;
    await r.deleteRequests(admin, [request.id]);
    const after = (await pb.briefForRequest(request.id))!;
    expect(after.status).toBe("cancelled");
    expect(after.cancelReason).toBe("request_deleted");
    const notes = (await notificationsOf(agency)).slice(before);
    expect(notes.some((n) => n.kind === "alert" && /cancelada/.test(n.subject))).toBe(true);
    expect((await pendingTasksFor(agency)).some((t) => t.link.includes(brief.id))).toBe(false);
    // Encerrado: nada mais entra.
    await expect(pb.uploadPackagingItem(agency, brief.id, "art", pdf())).rejects.toThrow("brief_closed");
  });

  it("trocar o dono avisa os dois; a Wellmix pode assumir", async () => {
    const store = getStore();
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    const beforeAgency = (await notificationsOf(agency)).length;
    const beforeAdmin = (await notificationsOf(admin)).length;
    const mine = await pb.assignPackagingBrief(admin, brief.id, null);
    expect(mine.agencyId).toBeNull();
    expect(mine.ownerSource).toBe("chosen");
    expect((await notificationsOf(agency)).slice(beforeAgency).some((n) => /transferida/.test(n.subject))).toBe(true);
    expect((await notificationsOf(admin)).slice(beforeAdmin).some((n) => /marketing Wellmix/.test(n.subject))).toBe(true);
    expect((await pendingTasksFor(admin)).some((t) => t.link.includes(brief.id))).toBe(true);
    // Agência inativa não pode ser dona.
    const b = (await store.list("parties", { filter: { name: "Agência B" } }))[0];
    await expect(pb.assignPackagingBrief(admin, brief.id, b.id)).rejects.toThrow("no_agency");
  });

  it("lembrete: briefing vencido gera um alerta por dia", async () => {
    const store = getStore();
    const request = await newRequest();
    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const brief = (await pb.briefForRequest(request.id))!;
    await store.update("packaging_briefs", brief.id, {
      dueAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    const before = (await notificationsOf(agency)).length;
    await runReminders();
    await runReminders();
    const notes = (await notificationsOf(agency)).slice(before);
    const mine = notes.filter((n) => n.link === `/app/packaging/${brief.id}`);
    expect(mine).toHaveLength(1);
    expect(mine[0].kind).toBe("alert");
    expect(mine[0].subject).toMatch(/ATRASADA/);
  });

  it("esquema sem a tabela: a RFQ abre mesmo assim", async () => {
    const store = getStore();
    const original = store.create.bind(store);
    (store as { create: typeof store.create }).create = (async (
      table: string,
      data: unknown,
    ) => {
      if (table === "packaging_briefs")
        throw new Error(
          'Table with the requested ID "packaging_briefs" could not be found',
        );
      return original(table as never, data as never);
    }) as typeof store.create;
    try {
      const request = await newRequest();
      const quotes = await r.openRfq(admin, request.id, ["fornecedor-a"]);
      expect(quotes).toHaveLength(1);
      expect(await pb.briefForRequest(request.id)).toBeNull();
    } finally {
      (store as { create: typeof store.create }).create = original;
    }
  });
});
