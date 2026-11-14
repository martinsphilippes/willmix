import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

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
  "COLOR ASSORTMENT",
];
const row = (sku: string, desc: string, colors = "") => [
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
  colors,
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
}

/*
 * Variações de cor até o fechamento (docs/PURCHASE_SCHEDULE.md, "Cores"): a
 * escolha grava as cores incluídas e as peças de cada cor por data; a
 * solicitação, o pedido pai, as rodadas, os pedidos filhos e o documento
 * assinado levam cada cor na própria linha, do mesmo produto, sem refazer a
 * conta nem duplicar.
 */

/** Book com os itens, fechado; devolve os itens na ordem da planilha. */
async function closedLot(rows: string[][]) {
  const store = getStore();
  const lot = await lots.createBookingLotFromSheet(admin, sheet(rows));
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
  return store.list("booking_items", { filter: { lotId: lot.id } });
}

/** Da escolha gravada à solicitação aprovada, com produto e amostra aprovada. */
async function approvedFromGroup(
  input: Parameters<typeof groups.saveSelectionGroup>[1],
) {
  const store = getStore();
  const group = await groups.saveSelectionGroup(admin, input);
  const opened = await groups.openGroupRequests(admin, [group.id]);
  expect(opened.failed).toEqual([]);
  const request = opened.opened[0];
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
  const lineId = (await store.list("product_lines"))[0].id;
  await product.createProductFromRequest(admin, request.id, {
    name: `Produto ${request.number}`,
    lineId,
    itemIds: [input.chosenItemId],
  });
  return {
    group,
    request: (await store.get("supplier_requests", request.id))!,
  };
}

describe("variações de cor do vencedor até o pedido", () => {
  it("várias cores e datas, com uma cor retirada: pai, rodadas, filhos e contrato", async () => {
    const store = getStore();
    const today = todayIso();
    const items = await closedLot([
      row("CL-1", "Color jar", "BEGE / CARVALHO / MARROM"),
      row("CL-2", "Color jar b"),
    ]);
    const colored = items.find((i) => i.factoryItemCode === "CL-1")!;
    expect(colored.colorAssortment).toBe("BEGE / CARVALHO / MARROM");
    const schedule = buildSchedule({
      intervalDays: 30,
      firstDate: today,
      // 31 + 30 caixas de 48.
      quantities: [1488, 1440],
    });
    const { group, request } = await approvedFromGroup({
      itemIds: items.map((i) => i.id),
      chosenItemId: colored.id,
      quantity: null,
      needs: null,
      schedule,
      colors: ["BEGE", "MARROM"],
    });
    const expected = {
      colors: ["BEGE", "CARVALHO", "MARROM"],
      included: ["BEGE", "MARROM"],
      rows: [
        { color: "BEGE", quantity: 1488, rounds: [768, 720] },
        { color: "MARROM", quantity: 1440, rounds: [720, 720] },
      ],
    };
    expect(group.colorPlan).toEqual(expected);
    // A solicitação leva o mesmo plano (as cores do Book não mudam).
    expect(request.colorPlan).toEqual(expected);
    expect(
      (await store.get("booking_items", colored.id))!.colorAssortment,
    ).toBe("BEGE / CARVALHO / MARROM");

    const parent = await po.createPurchaseOrder(admin, [
      { requestId: request.id, quantity: null },
    ]);
    const [parentItem] = await store.list("order_items", {
      filter: { orderId: parent.id },
    });
    // Uma linha de produto com as cores, somando o total.
    expect(parentItem.quantity).toBe(2928);
    expect(parentItem.colors).toEqual([
      { color: "BEGE", quantity: 1488 },
      { color: "MARROM", quantity: 1440 },
    ]);
    expect(parent.purchaseRounds!.map((r) => r.items[0].colors)).toEqual([
      [
        { color: "BEGE", quantity: 768 },
        { color: "MARROM", quantity: 720 },
      ],
      [
        { color: "BEGE", quantity: 720 },
        { color: "MARROM", quantity: 720 },
      ],
    ]);

    await finishLanes(parent.id);
    const first = (await store.get("orders", parent.id))!.purchaseRounds![0];
    const [childItem] = await store.list("order_items", {
      filter: { orderId: first.orderId! },
    });
    expect(childItem.quantity).toBe(1488);
    expect(childItem.colors).toEqual(first.items[0].colors);
    // O contrato do filho mostra cada cor na própria linha.
    const samples = await import("@/lib/services/sample-order");
    await samples.decideSampleOrder(admin, first.orderId!, { status: "none" });
    const view = (await signature.getOrderSignatureView(
      admin,
      first.orderId!,
    ))!;
    expect(view.document.items[0].colors).toEqual(first.items[0].colors);

    // Mais tarde a 2ª rodada nasce com as peças dela; nada duplica.
    const later = new Date(`${addDaysIso(today, 40)}T15:00:00Z`);
    const born = await rounds.spawnDueRounds(null, { now: later });
    expect(born.map((o) => o.roundIndex)).toEqual([2]);
    const [secondItem] = await store.list("order_items", {
      filter: { orderId: born[0].id },
    });
    expect(secondItem.colors).toEqual([
      { color: "BEGE", quantity: 720 },
      { color: "MARROM", quantity: 720 },
    ]);
    expect(await rounds.spawnDueRounds(null, { now: later })).toEqual([]);
  });

  it("pedido único: a quantidade mudada no pedido é dividida de novo, em caixas inteiras", async () => {
    const store = getStore();
    const items = await closedLot([row("CL-3", "Solo jar", "AZUL/VERDE")]);
    const { request } = await approvedFromGroup({
      itemIds: [items[0].id],
      chosenItemId: items[0].id,
      quantity: 960,
      needs: null,
    });
    // Sem cores marcadas no formulário: todas, divididas igualmente.
    expect(request.colorPlan!.rows).toEqual([
      { color: "AZUL", quantity: 480, rounds: [480] },
      { color: "VERDE", quantity: 480, rounds: [480] },
    ]);
    // Quantidade que não fecha caixas para as cores: recusa, nada muda.
    await expect(
      po.createPurchaseOrder(admin, [
        { requestId: request.id, quantity: 1000 },
      ]),
    ).rejects.toThrow("purchase_order_colors_cartons");
    // 21 caixas: 11 + 10.
    const order = await po.createPurchaseOrder(admin, [
      { requestId: request.id, quantity: 1008 },
    ]);
    const [item] = await store.list("order_items", {
      filter: { orderId: order.id },
    });
    expect(item.colors).toEqual([
      { color: "AZUL", quantity: 528 },
      { color: "VERDE", quantity: 480 },
    ]);
  });

  it("recusa gravar sem cor ou com caixa que não fecha; sem variações segue igual", async () => {
    const items = await closedLot([
      row("CL-4", "Odd jar", "ROSA/LILAS"),
      row("CL-5", "Plain jar", "BRANCO"),
    ]);
    const [odd, plain] = ["CL-4", "CL-5"].map((c) =>
      items.find((i) => i.factoryItemCode === c)!,
    );
    await expect(
      groups.saveSelectionGroup(admin, {
        itemIds: [odd.id],
        chosenItemId: odd.id,
        quantity: 100,
        needs: null,
      }),
    ).rejects.toThrow("selection_colors_cartons");
    await expect(
      groups.saveSelectionGroup(admin, {
        itemIds: [odd.id],
        chosenItemId: odd.id,
        quantity: 96,
        needs: null,
        colors: [],
      }),
    ).rejects.toThrow("selection_colors_none");
    // Uma cor só no Book: sem plano, a quantidade como sempre (sem caixa).
    const group = await groups.saveSelectionGroup(admin, {
      itemIds: [plain.id],
      chosenItemId: plain.id,
      quantity: 100,
      needs: null,
    });
    expect(group.quantity).toBe(100);
    expect(group.colorPlan ?? null).toBeNull();
  });
});
