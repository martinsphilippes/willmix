import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Linha do tempo "Etapas do pedido" do operador da Wellmix (pedido do dono,
 * 14/11/2026): só as tarefas a fazer que cabem ao login, tarefa a tarefa,
 * inclusive dentro das etapas e das subetapas compartilhadas. A etapa sai da
 * lista quando o login conclui a última tarefa dele, mesmo com outros ainda
 * pendentes; o que foi feito continua no pedido. O administrador vê tudo.
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
const engine = await import("@/lib/workflow/engine");
const tl = await import("@/lib/services/order-timeline");
const { loadRoutingContext, internalRoute } =
  await import("@/lib/services/cert-art-routing");
const { sheetProgress } = await import("@/lib/services/purchase-sheet");
const { uploadDocument } = await import("@/lib/services/documents");
const { ORDER_PART_KEYS, ORDER_PART_STAGE } = await import("@/lib/order-parts");
const { isOffFlowStage } = await import("@/lib/workflow/stages");
const { baseKeyOf } = await import("@/lib/purchase-lanes");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Requirement = import("@/lib/db").Requirement;

let admin: User;
let supplierA: User;
/** Comprador, responsável interno (analista) do primeiro pedido. */
let buyer: User;
/** Outro Comprador, sem pedido dele. */
let otherBuyer: User;
/** Designer da Wellmix, designer do primeiro pedido. */
let designer: User;
/** Cadastro: NCM e ficha mestre. */
let catalog: User;

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
async function purchaseOrder(sku: string, owner: User): Promise<Order> {
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
  return store.update("orders", order.id, { ownerUserId: owner.id });
}

const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: "application/pdf",
  });

async function requirementOf(order: Order, base: string): Promise<Requirement> {
  return (
    await getStore().list("requirements", { filter: { orderId: order.id } })
  ).find((r) => baseKeyOf(r.key) === base)!;
}

/** Envia um item do pedido com um arquivo (a faca, a foto, a arte...). */
async function submit(user: User, order: Order, base: string) {
  const req = await requirementOf(order, base);
  const documentId = (
    await uploadDocument(user, pdf(`${base}.pdf`), {
      orderId: order.id,
      requirementId: req.id,
      type: "attachment",
    })
  ).id;
  await engine.submitRequirement(user, req.id, { value: null, documentId });
}

/** Mesmas entradas da tela do pedido para a linha do tempo do login. */
async function timelineOf(user: User, orderId: string) {
  const store = getStore();
  const order = (await store.get("orders", orderId))!;
  const stages = (await store.list("stages", { filter: { orderId } }))
    .filter((s) => !isOffFlowStage(s.key))
    .sort((a, b) => a.sequence - b.sequence);
  const requirements = await store.list("requirements", {
    filter: { orderId },
  });
  const sheet = await sheetProgress(order);
  const artwork = art.canFixArt(user, order)
    ? await art.artworkView(user, order)
    : null;
  const mine = await tl.myOrderTimeline(user, {
    order,
    stages,
    requirements,
    certSteps: await f.importFlowView(user, order, "certification"),
    importSteps: await f.importFlowView(user, order),
    sheetMissing: sheet ? sheet.missing.length : null,
    sheetStarted: !!sheet && (sheet.saved || sheet.prefillSource !== "catalog"),
    artIssues: artwork?.items.flatMap((i) => i.issues) ?? [],
    supplierPaymentOpen: false,
    receivingOpen: false,
  });
  return { stages, mine };
}

/** As linhas que o login vê: etapa → itens abertos dele, subetapas e contagem. */
async function rowsOf(user: User, order: Order) {
  const { stages, mine } = await timelineOf(user, order.id);
  const out: Record<
    string,
    {
      open: string[];
      parts: string[];
      progress: ReturnType<typeof tl.myProgress>;
    }
  > = {};
  for (const stage of stages) {
    const partKeys = ORDER_PART_KEYS.filter(
      (k) => ORDER_PART_STAGE[k] === stage.key,
    );
    const r = tl.myStageRow(mine, stage, partKeys);
    if (r)
      out[stage.key] = {
        open: r.open.map((x) => baseKeyOf(x.key)).sort(),
        parts: [...r.parts],
        progress: r.progress,
      };
  }
  return out;
}

const fresh = async (order: Order) =>
  (await getStore().get("orders", order.id))!;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  supplierA = by("supplier.a@china.com");
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
  buyer = await wellmixLogin("comprador", ["buyer"]);
  otherBuyer = await wellmixLogin("usuario", ["buyer"]);
  designer = await wellmixLogin("designer", ["designer"]);
  catalog = await wellmixLogin("cadastro", ["catalog"]);
});

describe("quem vê só as próprias tarefas", () => {
  it("o operador da Wellmix; o administrador continua vendo a linha inteira", () => {
    for (const user of [buyer, otherBuyer, designer, catalog])
      expect(tl.timelineMineOnly(user)).toBe(true);
    expect(tl.timelineMineOnly(admin)).toBe(false);
  });
});

describe("pedido do Comprador, com designer da Wellmix e parceiros", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("TL-1", buyer);
    await art.assignDesigner(admin, order.id, designer.id);
    order = await fresh(order);
  });

  it("no início: o Comprador vê o memorial e a ficha de compra; o Cadastro, NCM e ficha mestre", async () => {
    // As etapas e a numeração continuam as do pedido; cada um vê as dele.
    expect(await rowsOf(buyer, order)).toEqual({
      ORDER_CREATED: {
        open: [],
        parts: ["certification"],
        progress: { status: "pending", percent: 0, done: 0, total: 1 },
      },
      // A ficha já veio com os dados do booking: a tarefa dele está em
      // andamento, ainda sem nada concluído.
      PREPARATION: {
        open: [],
        parts: ["sheet"],
        progress: { status: "active", percent: 0, done: 0, total: 1 },
      },
    });
    expect(await rowsOf(catalog, order)).toEqual({
      PREPARATION: {
        open: ["ncm_validated", "sheet_complete"],
        parts: [],
        progress: { status: "pending", percent: 0, done: 0, total: 2 },
      },
    });
    // A arte espera a faca e a foto em alta do fornecedor; o selo é da OCP.
    expect(await rowsOf(designer, order)).toEqual({});
    expect(await rowsOf(otherBuyer, order)).toEqual({});
  });

  it("faca e foto em alta enviadas: a arte aparece para o designer do pedido", async () => {
    await submit(supplierA, order, "die_cut");
    await submit(supplierA, order, "hd_photo");
    expect(await rowsOf(designer, order)).toEqual({
      PREPARATION: {
        open: ["art"],
        parts: [],
        progress: { status: "pending", percent: 0, done: 0, total: 1 },
      },
    });
    // A validação ainda não está disponível: não aparece para o Comprador.
    expect((await rowsOf(buyer, order)).PREPARATION.open).toEqual([]);
  });

  it("arte enviada: a etapa sai da lista do designer, com os outros ainda pendentes, e a validação aparece para o Comprador", async () => {
    await submit(designer, order, "art");
    expect(await rowsOf(designer, order)).toEqual({});
    const reqs = await getStore().list("requirements", {
      filter: { orderId: order.id },
    });
    // Outros responsáveis ainda têm o que fazer na etapa.
    expect(
      reqs.some(
        (r) =>
          r.status !== "done" &&
          ["moq_confirmed", "certificate"].includes(baseKeyOf(r.key)),
      ),
    ).toBe(true);
    // A conclusão continua no pedido, com quem fez.
    const done = await requirementOf(order, "art");
    expect([done.status, done.submittedByUserId]).toEqual([
      "done",
      designer.id,
    ]);
    expect((await rowsOf(buyer, order)).PREPARATION).toEqual({
      open: ["art_review"],
      parts: ["sheet"],
      progress: { status: "active", percent: 0, done: 0, total: 2 },
    });
    expect(await rowsOf(otherBuyer, order)).toEqual({});
  });

  it("arte validada: a etapa fica para o Comprador só pela ficha de compra, com a contagem dele", async () => {
    const review = await requirementOf(order, "art_review");
    await engine.decideRequirement(buyer, review.id, "approve");
    expect((await rowsOf(buyer, order)).PREPARATION).toEqual({
      open: [],
      parts: ["sheet"],
      progress: { status: "active", percent: 50, done: 1, total: 2 },
    });
  });

  it("memorial enviado: a Certificação sai da lista do Comprador; a validação é da certificadora", async () => {
    const memorial = await getStore().create("documents", {
      orderId: order.id,
      requestId: null,
      requirementId: null,
      type: "import_step",
      name: "memorial.pdf",
      mime: "application/pdf",
      size: 3,
      storageKey: `k-${order.id}-memorial`,
      version: 1,
      previousDocumentId: null,
      uploadedByUserId: buyer.id,
      visibility: "internal",
    } as never);
    await f.submitStep(buyer, order.id, "cert_memorial", {
      documentId: memorial.id,
    });
    const rows = await rowsOf(buyer, order);
    expect(rows.ORDER_CREATED).toBeUndefined();
    expect(Object.keys(rows)).toEqual(["PREPARATION"]);
  });
});

describe("pedido do Administrador, sem parceiros (como os de produção)", () => {
  let order: Order;
  beforeAll(async () => {
    order = await purchaseOrder("TL-2", admin);
    order = await getStore().update("orders", order.id, {
      ocpId: null,
      agencyId: null,
      designerUserId: null,
    });
    // Sem certificadora e sem agência: as raias delas voltam para a Wellmix.
    await po.syncLaneRoles(admin, order);
  });

  it("o responsável interno é o Administrador: os Compradores não têm tarefa nele", async () => {
    const ctx = await loadRoutingContext();
    expect(internalRoute(order, ctx)).toEqual({
      via: "analyst",
      userIds: [admin.id],
    });
    expect(await rowsOf(buyer, order)).toEqual({});
    expect(await rowsOf(otherBuyer, order)).toEqual({});
  });

  it("sem agência, a arte fica com a função Designer quando liberada; o Cadastro, com NCM e ficha mestre", async () => {
    expect(await rowsOf(designer, order)).toEqual({});
    await submit(supplierA, order, "die_cut");
    await submit(supplierA, order, "hd_photo");
    expect((await rowsOf(designer, order)).PREPARATION?.open).toEqual(["art"]);
    // O certificado, sem certificadora, é da Wellmix: do responsável interno.
    expect((await rowsOf(catalog, order)).PREPARATION.open).toEqual([
      "ncm_validated",
      "sheet_complete",
    ]);
    expect(await rowsOf(buyer, order)).toEqual({});
  });
});

describe("item de parceiro", () => {
  it("é só do parceiro designado; sem ele, a Wellmix faz (o responsável interno)", async () => {
    const ctx = await loadRoutingContext();
    const order = {
      ...(await getStore().list("orders"))[0],
      ownerUserId: buyer.id,
      shippingLineId: null,
    } as Order;
    const vessel = {
      key: "vessel",
      role: "shipping_line",
      status: "pending",
    } as Requirement;
    expect(tl.wellmixRequirementRoute(order, vessel, [vessel], ctx)).toEqual({
      via: "analyst",
      userIds: [buyer.id],
    });
    expect(
      tl.wellmixRequirementRoute(
        { ...order, shippingLineId: "armador" },
        vessel,
        [vessel],
        ctx,
      ),
    ).toBeNull();
  });
});

describe("contagem da etapa", () => {
  const stage = { id: "s1", status: "active" as const };
  const sign = { id: "r1", key: "order_signed_wellmix" } as Requirement;

  it("as assinaturas do documento do pedido contam uma vez, na etapa", () => {
    const row = tl.myStageRow(
      {
        stages: new Map([["s1", { open: [sign], done: 1 }]]),
        parts: { document: { open: 1, done: 0, mirror: true } },
      },
      stage,
      ["document", "production"],
    );
    expect(row).toEqual({
      open: [sign],
      parts: ["document"],
      progress: { status: "active", percent: 50, done: 1, total: 2 },
    });
  });

  it("sem tarefa aberta do login, a etapa sai da lista, mesmo com feitas", () => {
    expect(
      tl.myStageRow(
        {
          stages: new Map([["s1", { open: [], done: 3 }]]),
          parts: { production: { open: 0, done: 2 } },
        },
        stage,
        ["production"],
      ),
    ).toBeNull();
  });

  it("etapa travada com tarefa do login aparece travada", () => {
    expect(
      tl.myStageRow(
        { stages: new Map([["s1", { open: [sign], done: 0 }]]), parts: {} },
        { id: "s1", status: "blocked" },
        [],
      )?.progress.status,
    ).toBe("blocked");
  });
});

describe("pedido do histórico em espera até o go-live", () => {
  it("não tem tarefa para o operador, como nas pendências", async () => {
    let order = await purchaseOrder("TL-3", buyer);
    expect(Object.keys(await rowsOf(buyer, order)).length).toBeGreaterThan(0);
    order = await getStore().update("orders", order.id, { held: true });
    expect(await rowsOf(buyer, order)).toEqual({});
  });
});
