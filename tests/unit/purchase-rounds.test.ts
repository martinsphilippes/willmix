import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { approveMilestones } from "./helpers/approvals";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Programação de compra (docs/PURCHASE_SCHEDULE.md): a escolha do grupo leva
 * rodadas, peças por rodada e intervalo; a solicitação mostra isso ao
 * responsável; o pedido de compra vira o pai e cada rodada nasce como pedido
 * filho no dia, com a Preparação do pai copiada e o contrato próprio.
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
const rounds = await import("@/lib/services/purchase-rounds");
const groups = await import("@/lib/services/selection-groups");
const pure = await import("@/lib/purchase-rounds");
const { buildSchedule, todayIso, addDaysIso } =
  await import("@/lib/workflow/request-schedule");
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

/** Solicitações aprovadas do fornecedor A (com produto), cada uma com a sua programação. */
async function approvedWith(
  codes: string[],
  schedules: Array<import("@/lib/db").RequestSchedule | null>,
) {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(
    admin,
    sheet(codes.map((c, i) => row(c, `Scheduled item ${c} ${i}`))),
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
      schedule: schedules[i] ?? null,
    });
    await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 2,
      currency: "USD",
      moq: 1000,
      leadTimeDays: 30,
      note: null,
    });
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    await approveSample(admin, request.id);
    await product.createProductFromRequest(admin, request.id, {
      name: `Produto rodada ${codes[i]}`,
      lineId,
      itemIds: [item.id],
    });
    out.push((await store.get("supplier_requests", request.id))!);
  }
  return { lot, items, requests: out };
}

/** Conclui as três raias de todos os produtos do pedido. */
async function finishLanes(orderId: string) {
  const store = getStore();
  const items = await store.list("order_items", { filter: { orderId } });
  const k = (base: string, id: string) => `${base}__${id}`;
  for (const item of items) {
    await submit(supplierA, orderId, k("die_cut", item.id), {
      file: "faca.pdf",
    });
    await submit(supplierA, orderId, k("hd_photo", item.id), {
      file: "foto.pdf",
    });
    await submit(supplierA, orderId, k("moq_confirmed", item.id), {
      value: "1000",
    });
    await submit(supplierA, orderId, k("lead_time_confirmed", item.id), {
      value: "30",
    });
    await submit(agency, orderId, k("art", item.id), { file: "arte.pdf" });
    const review = (await requirementsOf(orderId)).find(
      (r) => r.key === k("art_review", item.id),
    )!;
    await engine.decideRequirement(admin, review.id, "approve");
    // Certificado e arte final com o selo só quando a linha exige.
    const keys = new Set((await requirementsOf(orderId)).map((r) => r.key));
    if (keys.has(k("certificate", item.id))) {
      await submit(ocp, orderId, k("certificate", item.id), {
        file: "cert.pdf",
      });
      await submit(agency, orderId, k("art_final", item.id), {
        file: "final.pdf",
      });
    }
  }
  // Cadastro e fiscal: NCM validado e ficha completa de cada produto.
  await gates.readyOrderProducts(admin, orderId);
  // Aprovações do mapa no fim dos marcos (docs/MILESTONES.md).
  await approveMilestones(admin, orderId);
}

describe("regras puras da programação de compra", () => {
  const s = (first: string, qtys: number[], days = 30) =>
    buildSchedule({ intervalDays: days, firstDate: first, quantities: qtys });

  it("resume rodadas, peças por rodada e total", () => {
    expect(
      pure.scheduleSummary(s("2026-12-01", [1000, 1000, 1000])),
    ).toMatchObject({
      rounds: 3,
      sameQuantity: 1000,
      total: 3000,
      lastDate: "2027-01-30",
    });
    expect(
      pure.scheduleSummary(s("2026-12-01", [500, 700]))!.sameQuantity,
    ).toBeNull();
    expect(pure.scheduleSummary(null)).toBeNull();
  });

  it("monta as rodadas do pai só com as mesmas datas", () => {
    const a = s("2026-12-01", [10, 20]);
    const ok = pure.buildPurchaseRounds([
      { productId: "p1", schedule: a },
      { productId: "p2", schedule: s("2026-12-01", [5, 5]) },
    ]);
    expect("rounds" in ok && ok.rounds).toEqual([
      {
        index: 1,
        expectedAt: "2026-12-01",
        items: [
          { productId: "p1", quantity: 10 },
          { productId: "p2", quantity: 5 },
        ],
        orderId: null,
        createdAt: null,
      },
      {
        index: 2,
        expectedAt: "2026-12-31",
        items: [
          { productId: "p1", quantity: 20 },
          { productId: "p2", quantity: 5 },
        ],
        orderId: null,
        createdAt: null,
      },
    ]);
    expect(
      pure.buildPurchaseRounds([
        { productId: "p1", schedule: a },
        { productId: "p2", schedule: s("2026-12-02", [5, 5]) },
      ]),
    ).toEqual({ error: "purchase_order_schedule_mixed" });
    expect(
      pure.buildPurchaseRounds([
        { productId: "p1", schedule: a },
        { productId: "p2", schedule: null },
      ]),
    ).toEqual({ error: "purchase_order_schedule_mixed" });
    expect(
      pure.buildPurchaseRounds([{ productId: "p1", schedule: null }]),
    ).toEqual({ rounds: null });
  });

  it("rodadas do dia e chave da raia do filho", () => {
    const list = [
      {
        index: 1,
        expectedAt: "2026-12-01",
        items: [],
        orderId: "x",
        createdAt: "",
      },
      {
        index: 2,
        expectedAt: "2026-12-31",
        items: [],
        orderId: null,
        createdAt: null,
      },
      {
        index: 3,
        expectedAt: "2027-01-30",
        items: [],
        orderId: null,
        createdAt: null,
      },
    ];
    expect(pure.dueRounds(list, "2026-12-31").map((r) => r.index)).toEqual([2]);
    expect(
      pure.mapLaneKey(
        "art_final__a1",
        [{ id: "a1", productId: "p" }],
        [{ id: "b1", productId: "p" }],
      ),
    ).toBe("art_final__b1");
    expect(pure.mapLaneKey("art__zz", [], [])).toBeNull();
  });
});

describe("programação de compra de ponta a ponta", () => {
  it("a escolha do grupo grava as rodadas e a solicitação leva ao responsável", async () => {
    const store = getStore();
    const lot = await lots.createBookingLotFromSheet(
      admin,
      sheet([row("SG-1", "Scheduled jar"), row("SG-2", "Scheduled jar b")]),
    );
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    await setBookingItemsNcm(
      admin,
      (await store.list("booking_items", { filter: { lotId: lot.id } })).map(
        (i) => i.id,
      ),
      "7013.37.00",
    );
    await lots.closeBookingLot(admin, lot.id, null);
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    const schedule = buildSchedule({
      intervalDays: 45,
      firstDate: "2026-12-10",
      quantities: [2000, 1500, 1500],
    });
    const group = await groups.saveSelectionGroup(admin, {
      itemIds: items.map((i) => i.id),
      chosenItemId: items[0].id,
      quantity: 99,
      needs: null,
      schedule,
    });
    // A quantidade é a soma das rodadas.
    expect(group).toMatchObject({ quantity: 5000, schedule });
    const result = await groups.openGroupRequests(admin, [group.id]);
    expect(result.failed).toEqual([]);
    expect(result.opened[0]).toMatchObject({ quantity: 5000, schedule });
  });

  it("o pedido vira o pai e as rodadas nascem como filhos no dia", async () => {
    const store = getStore();
    const today = todayIso();
    const plan = (q: number[]) =>
      buildSchedule({ intervalDays: 30, firstDate: today, quantities: q });
    const { requests } = await approvedWith(
      ["RD-1", "RD-2"],
      [plan([1000, 1000, 1000]), plan([600, 400, 500])],
    );
    // Quantidade digitada não vale para quem tem programação: o total é a soma.
    const parent = await po.createPurchaseOrder(admin, [
      { requestId: requests[0].id, quantity: 7 },
      { requestId: requests[1].id, quantity: null },
    ]);
    expect(parent.purchaseRounds).toHaveLength(3);
    const parentItems = await store.list("order_items", {
      filter: { orderId: parent.id },
    });
    expect(parentItems.map((i) => i.quantity).sort()).toEqual([1500, 3000]);

    // Antes da Preparação do pai, nada nasce (as artes ainda não existem).
    expect(await rounds.spawnDueRounds(null)).toEqual([]);

    await finishLanes(parent.id);
    const afterPrep = (await store.get("orders", parent.id))!;
    // O pai não vai a contrato: para depois da Preparação.
    expect(afterPrep.status).toBe("PREPARATION");
    const [first] = afterPrep.purchaseRounds!;
    expect(first.orderId).toBeTruthy();
    const child = (await store.get("orders", first.orderId!))!;
    expect(child).toMatchObject({
      parentOrderId: parent.id,
      roundIndex: 1,
      flow: "supplier_request",
      supplierId: parent.supplierId,
      agencyId: parent.agencyId,
      ocpId: parent.ocpId,
      // Preparação copiada: o filho começa no contrato.
      status: "PACKAGING",
    });
    const childItems = await store.list("order_items", {
      filter: { orderId: child.id },
    });
    expect(childItems.map((i) => i.quantity).sort()).toEqual(
      [1000, 600].sort(),
    );
    expect(child.fobTotal).toBeCloseTo(2 * 1600);
    // Cada rodada decide o próprio pedido de amostras antes de assinar.
    expect(
      (await signature.getOrderSignatureView(admin, child.id))!.samplesPending,
    ).toBe(true);
    const samples = await import("@/lib/services/sample-order");
    await samples.decideSampleOrder(admin, child.id, { status: "none" });
    // Contrato próprio, com a negociação e as artes finais do pai.
    const view = (await signature.getOrderSignatureView(admin, child.id))!;
    expect(view.document.finalArts).toHaveLength(2);
    expect(view.document.items.every((i) => i.moq === 1000)).toBe(true);
    expect(view.canSign).toBe("wellmix");

    // Rodar de novo no mesmo dia não duplica.
    expect(await rounds.spawnDueRounds(null)).toEqual([]);

    // 60 dias depois: as rodadas 2 e 3 nascem e o pai encerra.
    const later = new Date(`${addDaysIso(today, 60)}T15:00:00Z`);
    const born = await rounds.spawnDueRounds(null, { now: later });
    expect(born.map((o) => o.roundIndex)).toEqual([2, 3]);
    const closed = (await store.get("orders", parent.id))!;
    expect(closed.status).toBe("CLOSED");
    expect(closed.purchaseRounds!.every((r) => r.orderId)).toBe(true);
    const third = born[1];
    const thirdItems = await store.list("order_items", {
      filter: { orderId: third.id },
    });
    expect(thirdItems.map((i) => i.quantity).sort()).toEqual(
      [1000, 500].sort(),
    );
  });

  it("recusa programações com datas diferentes no mesmo pedido", async () => {
    const today = todayIso();
    const { requests } = await approvedWith(
      ["MX-1", "MX-2"],
      [
        buildSchedule({
          intervalDays: 30,
          firstDate: today,
          quantities: [1, 1],
        }),
        buildSchedule({
          intervalDays: 45,
          firstDate: today,
          quantities: [1, 1],
        }),
      ],
    );
    await expect(
      po.createPurchaseOrder(
        admin,
        requests.map((r) => ({ requestId: r.id, quantity: null })),
      ),
    ).rejects.toThrow("purchase_order_schedule_mixed");
  });

  it("só a Wellmix gera as rodadas pelo botão", async () => {
    const store = getStore();
    const plain = (await store.list("orders")).find(
      (o) => !o.purchaseRounds?.length,
    )!;
    await expect(rounds.spawnRoundsNow(supplierA, plain.id)).rejects.toThrow();
    await expect(rounds.spawnRoundsNow(admin, plain.id)).rejects.toThrow(
      "rounds_not_parent",
    );
  });
});
