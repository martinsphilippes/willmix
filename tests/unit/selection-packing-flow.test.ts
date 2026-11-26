import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Embalagens e variações na gravação (dono, 26/11/2026;
 * docs/SUPPLIER_REQUESTS.md, "Embalagens e variações"): no book da Wellmix,
 * "Gravar escolha" abre uma cotação separada por variação × embalagem, com
 * a cópia do item em embalagens; no book do parceiro, só grava.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const groups = await import("@/lib/services/selection-groups");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;

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
const row = (sku: string, colors: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  `Copo ${sku}`,
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

async function closedItem(sku: string, colors: string) {
  const file = new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, row(sku, colors)] }])],
    `${sku}.xlsx`,
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
  const lot = await lots.createBookingLotFromSheet(admin, file);
  const store = getStore();
  const [item] = await store.list("booking_items", {
    filter: { lotId: lot.id },
  });
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  await setBookingItemsNcm(admin, [item.id], "7013.37.00");
  await lots.closeBookingLot(admin, lot.id);
  return { lot, item };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

const packing = {
  // Caixa de 48 → 24 (CBM 0,12 → 0,06) e embalagem de 3 peças.
  carton: 24,
  packs: [3],
  parentOption: true,
  mix: false,
  variations: [
    { label: "AZUL", custom: false },
    { label: "Preto fosco", custom: true },
  ],
};

describe("gravar escolha com embalagens e variações", () => {
  it("book da Wellmix: uma cotação separada por combinação, em embalagens", async () => {
    const { item } = await closedItem("PK-1", "AZUL / ROSA");
    // 8 caixas de 24 = 192 peças: 2 caixas por combinação (4 combinações).
    const { group, opened } = await groups.saveAndOpenSelectionGroup(admin, {
      itemIds: [item.id],
      chosenItemId: item.id,
      quantity: 192,
      needs: null,
      packing,
    });
    expect(opened?.failed).toEqual([]);
    const requests = opened!.opened;
    expect(requests).toHaveLength(4);
    // Cada uma com o próprio número (cotação separada).
    expect(new Set(requests.map((r) => r.number)).size).toBe(4);
    expect(requests.map((r) => r.variant?.key)).toEqual([
      "AZUL|1",
      "AZUL|3",
      "Preto fosco|1",
      "Preto fosco|3",
    ]);
    const pack = requests.find((r) => r.variant?.key === "Preto fosco|3")!;
    expect(pack.quantity).toBe(16);
    expect(pack.supplierId).toBe(supplierA.partyId);
    expect(pack.item).toMatchObject({
      price: 3.75,
      masterCartonQty: 8,
      moq: 334,
      cbmPerCarton: 0.06,
      colorAssortment: "Preto fosco",
    });
    expect(pack.variant).toMatchObject({
      units: 3,
      pieceCarton: 24,
      selectionGroupId: group.id,
    });
    const unit = requests.find((r) => r.variant?.key === "AZUL|1")!;
    expect(unit.quantity).toBe(48);
    expect(unit.item.masterCartonQty).toBe(24);
    // A escolha guarda as combinações e as cotações abertas.
    const saved = (await getStore().get("selection_groups", group.id))!;
    expect(saved.status).toBe("requested");
    expect(saved.packing?.lines).toHaveLength(4);
    expect(saved.packing?.cbm).toBe(0.06);
    expect(saved.supplierRequestIds).toEqual(requests.map((r) => r.id));
    expect(saved.colorPlan ?? null).toBeNull();
    // O item tem várias cotações abertas, uma por combinação; a mesma
    // combinação de novo é recusada.
    const svc = await import("@/lib/services/supplier-requests");
    await expect(
      svc.openSupplierRequest(admin, {
        itemId: item.id,
        alternativeIds: [],
        quantity: 48,
        needs: null,
        searchQuery: null,
        variant: { ...unit.variant! },
      }),
    ).rejects.toThrow("supplier_request_exists");
  });

  it("recusa a embalagem que não divide a caixa e a quantidade que não fecha caixas", async () => {
    const { item } = await closedItem("PK-2", "AZUL / ROSA");
    await expect(
      groups.saveAndOpenSelectionGroup(admin, {
        itemIds: [item.id],
        chosenItemId: item.id,
        quantity: 192,
        needs: null,
        packing: { ...packing, packs: [5] },
      }),
    ).rejects.toThrow("selection_pack_divide");
    await expect(
      groups.saveAndOpenSelectionGroup(admin, {
        itemIds: [item.id],
        chosenItemId: item.id,
        quantity: 200,
        needs: null,
        packing,
      }),
    ).rejects.toThrow("selection_colors_cartons");
  });

  it("book enviado pelo parceiro: demandas de estoque, Estratégia com o parceiro marcado, cotação de compra e a vencedora ligada ao item", async () => {
    const store = getStore();
    const { lot, item } = await closedItem("PK-3", "AZUL / ROSA");
    // Quem subiu o book foi o parceiro (o login do fornecedor A).
    await store.update("booking_lots", lot.id, {
      createdByUserId: supplierA.id,
    });
    const { group, opened } = await groups.saveAndOpenSelectionGroup(admin, {
      itemIds: [item.id],
      chosenItemId: item.id,
      quantity: 192,
      needs: "Caixa com a marca",
      packing,
    });
    // Nenhuma cotação direta: as 4 combinações viram demandas de estoque.
    expect(opened.opened).toEqual([]);
    expect(opened.failed).toEqual([]);
    expect(opened.strategy).toHaveLength(1);
    const demandIds = opened.strategy[0].demandIds;
    expect(demandIds).toHaveLength(4);
    const demands = await store.list("requests", { filter: { id: demandIds } });
    const { STOCK_PARTY_ID } = await import("@/lib/services/stock-party");
    for (const d of demands) {
      expect(d).toMatchObject({
        customerId: STOCK_PARTY_ID,
        origin: "replenishment",
        productId: null,
        status: "REQUESTED",
      });
      expect(d.bookingSource).toMatchObject({
        bookingItemId: item.id,
        bookingLotId: lot.id,
        partnerId: supplierA.partyId,
        selectionGroupId: group.id,
      });
    }
    // Um lote só (uma solicitação na Estratégia).
    expect(new Set(demands.map((d) => d.groupId)).size).toBe(1);
    const pack = demands.find(
      (d) => d.bookingSource?.variant?.key === "AZUL|3",
    )!;
    expect(pack.quantity).toBe(16);
    expect(pack.bookingSource!.snapshot).toMatchObject({
      price: 3.75,
      masterCartonQty: 8,
    });
    const saved = (await store.get("selection_groups", group.id))!;
    expect(saved).toMatchObject({ status: "requested", demandIds });
    expect(
      await store.list("supplier_requests", {
        filter: { bookingItemId: item.id },
      }),
    ).toHaveLength(0);

    // Estratégia: o parceiro que mandou o book já vem marcado.
    const { translator } = await import("@/i18n");
    const t = translator("pt");
    const strategy = await import("@/lib/services/purchase-strategy");
    const board = await strategy.strategyBoard(t);
    const card = board.groups.find((g) => g.demandIds.includes(demandIds[0]))!;
    expect(card.demandIds.sort()).toEqual([...demandIds].sort());
    expect(card.linkedIds).toContain(supplierA.partyId);
    // Sem última compra nem pedido direto: só cotar.
    await expect(
      strategy.sendStrategy(
        admin,
        {
          lines: [{ demandIds, choice: "last_supplier", recipientIds: [] }],
          note: null,
        },
        t,
      ),
    ).rejects.toThrow("strategy_book_quote_only");
    const send = await strategy.sendStrategy(
      admin,
      {
        lines: [
          { demandIds, choice: "quote", recipientIds: [supplierA.partyId!] },
        ],
        note: null,
      },
      t,
    );
    expect(send.lines[0].recipients[0]).toMatchObject({
      partyId: supplierA.partyId,
      status: "sent",
    });
    const quote = (await store.get("purchase_quotes", send.lines[0].quoteId!))!;
    expect(quote.items).toHaveLength(4);
    for (const i of quote.items) {
      expect(i.productId.startsWith("bk-")).toBe(true);
      expect(i.book?.bookingItemId).toBe(item.id);
    }

    // O parceiro responde (preço e ficha de cada SKU) e vence.
    const quotes = await import("@/lib/services/purchase-quote");
    const { sheetFor } = await import("./quote-sheet-fixture");
    await quotes.answerQuote(supplierA, quote.id, {
      decline: false,
      prices: quote.items.map((i) => ({
        productId: i.productId,
        unitPrice: 2,
      })),
      currency: "USD",
      incoterm: "FOB",
      leadTimeDays: 30,
      port: "Ningbo",
      moq: 100,
      note: null,
      sheets: quote.items.map((i) => sheetFor(i.productId)),
    });
    // A ficha do SKU fica na resposta: nada vai para a revisão do Cadastro.
    expect(
      (await store.list("supplier_product_sheets")).filter((x) =>
        x.productId.startsWith("bk-"),
      ),
    ).toHaveLength(0);
    const [response] = await store.list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    const { approveQuoteSample } = await import("./helpers/sampling");
    await approveQuoteSample(quote.id, response.id);
    const users = await store.list("users");
    const director = users.find((u) => u.email === "diretoria@wellmix.com")!;
    await quotes.chooseWinner(admin, quote.id, response.id, null);
    const approved = await quotes.decideWinner(director, quote.id, {
      approve: true,
      note: null,
    });
    const created = await store.list("supplier_requests", {
      filter: { id: approved.supplierRequestIds! },
    });
    expect(created).toHaveLength(4);
    for (const r of created) {
      expect(r).toMatchObject({
        status: "answered",
        supplierId: supplierA.partyId,
        bookingItemId: item.id,
        bookingLotId: lot.id,
        supplierPrice: 2,
      });
      expect(r.productId ?? null).toBeNull();
      expect(r.variant?.selectionGroupId).toBe(group.id);
    }
    const sku = created.find((r) => r.variant?.key === "AZUL|3")!;
    expect(sku.quantity).toBe(16);
    expect(sku.item).toMatchObject({ masterCartonQty: 8, price: 2 });
  });
});
