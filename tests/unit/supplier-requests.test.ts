import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md):
 * a busca por parte da descrição traz os itens dos bookings fechados; a
 * solicitação vai ao fornecedor do item escolhido, que só vê as próprias,
 * responde até a Wellmix decidir; nada de produto nasce aqui.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const svc = await import("@/lib/services/supplier-requests");
const { answerTimes, requestTimeline } =
  await import("@/lib/supplier-requests");
const lib = await import("@/lib/supplier-requests");
const { canAccessDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let supplierB: User;
let joao: User;

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
const row = (supplier: string, sku: string, desc: string, qty = "") => [
  supplier,
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
  qty,
];
const file = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "b.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

/** Sobe e fecha um booking do fornecedor (o do cadastro de demonstração). */
async function closedLot(supplierName: string, rows: string[][]) {
  const lot = await lots.createBookingLotFromSheet(admin, file(rows));
  expect(lot.supplierId).toBeTruthy();
  // NCM é obrigatório para fechar (docs/BOOKING.md, "NCM do item").
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  const items = await getStore().list("booking_items", {
    filter: { lotId: lot.id },
  });
  await setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  return lots.closeBookingLot(admin, lot.id, null);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("seleção de itens e solicitação ao fornecedor", () => {
  it("compara itens parecidos e abre a solicitação ao fornecedor do escolhido", async () => {
    const store = getStore();
    const lotA = await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "A-1", "Glass cup 350ml", "3000"),
      row("Shenzhen Supplier A", "A-2", "Plastic bottle"),
    ]);
    const lotB = await closedLot("Guangzhou Supplier B", [
      row("Guangzhou Supplier B", "B-1", "Cup glass with handle"),
    ]);
    const products = (await store.list("products")).length;

    const found = await svc.listSelectionItems(admin, "glass cup");
    expect(found?.rows.map((r) => r.item.factoryItemCode).sort()).toEqual([
      "A-1",
      "B-1",
    ]);
    const cupA = found!.rows.find((r) => r.item.factoryItemCode === "A-1")!;
    const cupB = found!.rows.find((r) => r.item.factoryItemCode === "B-1")!;

    // Sem quantidade digitada: a da planilha (PURCHASE QTY IN PCS).
    const request = await svc.openSupplierRequest(admin, {
      itemId: cupA.item.id,
      alternativeIds: [cupB.item.id, cupA.item.id],
      quantity: null,
      needs: "Cor âmbar e caixa com a marca",
      searchQuery: "glass cup",
    });
    expect(request).toMatchObject({
      status: "open",
      supplierId: lotA.supplierId,
      quantity: 3000,
      alternativeItemIds: [cupB.item.id],
      needs: "Cor âmbar e caixa com a marca",
    });
    expect(request.item.factoryItemCode).toBe("A-1");
    expect((await store.get("booking_lots", lotA.id))!.status).toBe(
      "in_progress",
    );
    expect((await store.get("booking_lots", lotB.id))!.status).toBe("closed");
    // Nada de produto.
    expect((await store.list("products")).length).toBe(products);
    // O fornecedor recebe o aviso.
    const notes = await store.list("notifications", {
      filter: { userId: supplierA.id, channel: "inapp" },
    });
    expect(
      notes.some((n) => n.link === `/app/supplier-requests/${request.id}`),
    ).toBe(true);

    // Uma solicitação em andamento por item.
    await expect(
      svc.openSupplierRequest(admin, {
        itemId: cupA.item.id,
        alternativeIds: [],
        quantity: 100,
        needs: null,
        searchQuery: null,
      }),
    ).rejects.toThrow("supplier_request_exists");
    // Sem quantidade na planilha nem digitada: recusa.
    await expect(
      svc.openSupplierRequest(admin, {
        itemId: cupB.item.id,
        alternativeIds: [],
        quantity: null,
        needs: null,
        searchQuery: null,
      }),
    ).rejects.toThrow("supplier_request_qty_required");
    const selection = await svc.listSelectionItems(admin, "glass cup");
    expect(
      selection!.rows.find((r) => r.item.id === cupA.item.id)!.activeRequest
        ?.id,
    ).toBe(request.id);

    // Isolamento: o fornecedor dono vê, sem as alternativas; outro não vê.
    const mine = await svc.getSupplierRequest(supplierA, request.id);
    expect(mine?.request.id).toBe(request.id);
    expect(mine?.alternatives).toEqual([]);
    expect(await svc.getSupplierRequest(supplierB, request.id)).toBeNull();
    expect(await svc.listSupplierRequests(supplierB)).toEqual([]);
    expect(
      (await svc.listSupplierRequests(supplierA))!.map((e) => e.request.id),
    ).toEqual([request.id]);
    const wellmixView = await svc.getSupplierRequest(admin, request.id);
    expect(wellmixView!.alternatives.map((a) => a.item.id)).toEqual([
      cupB.item.id,
    ]);
    // Cliente não abre a tela.
    await expect(svc.listSupplierRequests(joao)).rejects.toThrow();
    await expect(
      svc.answerSupplierRequest(supplierB, request.id, {
        canDo: "yes",
        price: 1,
        currency: "USD",
        moq: null,
        leadTimeDays: null,
        note: null,
      }),
    ).rejects.toThrow("not_found");

    // Resposta: "faz" pede preço; muda até a Wellmix decidir.
    await expect(
      svc.answerSupplierRequest(supplierA, request.id, {
        canDo: "yes",
        price: null,
        currency: null,
        moq: null,
        leadTimeDays: null,
        note: null,
      }),
    ).rejects.toThrow("supplier_request_price_required");
    const answered = await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 1.4,
      currency: "USD",
      moq: 2000,
      leadTimeDays: 45,
      note: "Âmbar sem custo extra",
      incoterm: "EXW",
    });
    expect(answered).toMatchObject({
      status: "answered",
      supplierCanDo: "yes",
      supplierPrice: 1.4,
      supplierMoq: 2000,
      supplierLeadTimeDays: 45,
      supplierIncoterm: "EXW",
    });
    // A resposta entra no histórico; a primeira e a última vêm dele.
    const answerEvents = answered.negotiation!.filter(
      (e) => e.kind === "answer",
    );
    expect(answerEvents).toHaveLength(1);
    expect(answerEvents[0]).toMatchObject({
      side: "supplier",
      canDo: "yes",
      price: 1.4,
      moq: 2000,
      incoterm: "EXW",
      onBehalf: false,
    });
    const times = answerTimes(answered);
    expect(times.first).toBe(answerEvents[0].at);
    expect(times.last).toBe(answered.respondedAt);
    expect(requestTimeline(answered).map((e) => e.kind)).toEqual([
      "opened",
      "answer",
    ]);
    // Fornecedor não decide.
    await expect(
      svc.decideSupplierRequest(supplierA, request.id, "approved", null),
    ).rejects.toThrow();
    const approved = await svc.decideSupplierRequest(
      admin,
      request.id,
      "approved",
      "Seguir",
    );
    expect(approved.status).toBe("approved");
    await expect(
      svc.answerSupplierRequest(supplierA, request.id, {
        canDo: "no",
        price: null,
        currency: null,
        moq: null,
        leadTimeDays: null,
        note: null,
      }),
    ).rejects.toThrow("supplier_request_closed");
    // Decidida, o item pode ter outra solicitação.
    const again = await svc.openSupplierRequest(admin, {
      itemId: cupA.item.id,
      alternativeIds: [],
      quantity: 500,
      needs: null,
      searchQuery: null,
    });
    expect(again.quantity).toBe(500);
  });

  it("tabela da solicitação: só a própria, não as outras do booking", async () => {
    const lot = await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "G-1", "Group mug one"),
      row("Shenzhen Supplier A", "G-2", "Group mug two"),
    ]);
    const other = await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "G-3", "Group mug three"),
    ]);
    const items = await getStore().list("booking_items", {
      filter: { lotId: [lot.id, other.id] },
    });
    const open = (code: string) =>
      svc.openSupplierRequest(admin, {
        itemId: items.find((i) => i.factoryItemCode === code)!.id,
        alternativeIds: [],
        quantity: 100,
        needs: null,
        searchQuery: null,
      });
    const first = await open("G-1");
    const second = await open("G-2");
    await open("G-3");
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    expect(ids(await svc.supplierRequestGroup(supplierA, second))).toEqual([
      second.id,
    ]);
    // A Wellmix também recebe só a própria; outro fornecedor, nada.
    expect(ids(await svc.supplierRequestGroup(admin, first))).toEqual([
      first.id,
    ]);
    expect(await svc.supplierRequestGroup(supplierB, first)).toEqual([]);
  });

  it("foto do item: o fornecedor dono abre, outro não", async () => {
    const store = getStore();
    const doc = await store.create("documents", {
      orderId: null,
      requestId: null,
      requirementId: null,
      type: "photo",
      name: "p.png",
      mime: "image/png",
      size: 1,
      storageKey: "x",
      version: 1,
      previousDocumentId: null,
      uploadedByUserId: admin.id,
      visibility: "internal",
      productId: null,
      sourcingItemId: null,
      kitId: null,
      imageHash: null,
    });
    const lot = await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "A-9", "Mug ceramic", "100"),
    ]);
    const [item] = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    await store.update("booking_items", item.id, { photoDocumentId: doc.id });
    expect(await canAccessDocument(supplierA, doc)).toBe(false);
    await svc.openSupplierRequest(admin, {
      itemId: item.id,
      alternativeIds: [],
      quantity: null,
      needs: null,
      searchQuery: null,
    });
    expect(await canAccessDocument(supplierA, doc)).toBe(true);
    expect(await canAccessDocument(supplierB, doc)).toBe(false);
  });
});

describe("produto da solicitação aprovada", () => {
  /** Dois bookings fechados com um copo cada; solicitação ao A aprovada com o B de alternativa. */
  async function approvedWithAlternative(code: string) {
    const store = getStore();
    const lotA = await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", `${code}-A`, `Bottle ${code} 500ml`, "2000"),
    ]);
    const lotB = await closedLot("Guangzhou Supplier B", [
      row("Guangzhou Supplier B", `${code}-B`, `Bottle ${code} slim`),
    ]);
    const [itemA] = await store.list("booking_items", {
      filter: { lotId: lotA.id },
    });
    const [itemB] = await store.list("booking_items", {
      filter: { lotId: lotB.id },
    });
    const request = await svc.openSupplierRequest(admin, {
      itemId: itemA.id,
      alternativeIds: [itemB.id],
      quantity: null,
      needs: "Tampa azul",
      searchQuery: null,
    });
    await svc.answerSupplierRequest(supplierA, request.id, {
      canDo: "yes",
      price: 2.1,
      currency: "USD",
      moq: 1500,
      leadTimeDays: 40,
      note: null,
    });
    await svc.decideSupplierRequest(admin, request.id, "approved", null);
    return { request, itemA, itemB, lotA, lotB };
  }

  it("cria o produto fora da vitrine, com a resposta do fornecedor, e liga os itens", async () => {
    const store = getStore();
    const product = await import("@/lib/services/supplier-request-product");
    const { hiddenBookingProductIds, isHiddenByBooking } =
      await import("@/lib/services/booking-visibility");
    const { request, itemA, itemB, lotA, lotB } =
      await approvedWithAlternative("PX");
    const lineId = (await store.list("product_lines"))[0].id;

    // Só aprovada ganha produto.
    const open = await svc.openSupplierRequest(admin, {
      itemId: (
        await store.list("booking_items", { filter: { lotId: lotB.id } })
      )[0].id,
      alternativeIds: [],
      quantity: 10,
      needs: null,
      searchQuery: null,
    });
    await expect(
      product.createProductFromRequest(admin, open.id, {
        name: "X",
        lineId,
        itemIds: [],
      }),
    ).rejects.toThrow("request_product_not_approved");
    await svc.decideSupplierRequest(admin, open.id, "cancelled", null);
    // Fornecedor não cria produto.
    await expect(
      product.createProductFromRequest(supplierA, request.id, {
        name: "X",
        lineId,
        itemIds: [],
      }),
    ).rejects.toThrow();

    const created = await product.createProductFromRequest(admin, request.id, {
      name: "Garrafa térmica 500 ml",
      lineId,
      itemIds: [itemB.id],
    });
    expect(created).toMatchObject({
      name: "Garrafa térmica 500 ml",
      supplierId: lotA.supplierId,
      supplierSku: "PX-A",
      active: true,
      // Herda o NCM do item escolhido.
      ncm: "70133700",
    });
    // Ficha mestre com preço, moeda e MOQ da resposta.
    const [master] = await store.list("purchase_sheets", {
      filter: { orderId: created.id },
    });
    expect(master).toMatchObject({ price: 2.1, currency: "USD", moq: 1500 });
    // Itens ligados; fornecedores das alternativas na lista do produto.
    expect((await store.get("booking_items", itemA.id))!.productId).toBe(
      created.id,
    );
    expect((await store.get("booking_items", itemB.id))!.productId).toBe(
      created.id,
    );
    const links = await store.list("product_suppliers", {
      filter: { productId: created.id },
    });
    expect(links.map((l) => l.supplierId).sort()).toEqual(
      [lotA.supplierId, lotB.supplierId].sort(),
    );
    expect(links.find((l) => l.supplierId === lotA.supplierId)).toMatchObject({
      price: 2.1,
      moq: 1500,
      leadTimeDays: 40,
    });
    // Fora da vitrine até liberar.
    expect((await hiddenBookingProductIds()).has(created.id)).toBe(true);
    expect(await isHiddenByBooking(created.id)).toBe(true);
    await expect(
      product.createProductFromRequest(admin, request.id, {
        name: "Outro",
        lineId,
        itemIds: [],
      }),
    ).rejects.toThrow("request_product_exists");
    await product.releaseRequestProduct(admin, request.id);
    expect(await isHiddenByBooking(created.id)).toBe(false);
    expect((await hiddenBookingProductIds()).has(created.id)).toBe(false);

    // CODPROD: sem Sankhya configurado, grava sem conferir; inválido recusa.
    await expect(
      product.setRequestProductErpCode(admin, request.id, "12a"),
    ).rejects.toThrow("request_erp_code_invalid");
    const res = await product.setRequestProductErpCode(
      admin,
      request.id,
      "40123",
    );
    expect(res.checked).toBe(false);
    expect((await store.get("products", created.id))!.sankhyaCode).toBe(
      "40123",
    );
    expect(
      (await store.get("supplier_requests", request.id))!.erpCheckedAt,
    ).toBeNull();
  });

  it("associa a um produto existente sem esconder e não toma item de outro produto", async () => {
    const store = getStore();
    const product = await import("@/lib/services/supplier-request-product");
    const { isHiddenByBooking } =
      await import("@/lib/services/booking-visibility");
    const { request, itemB } = await approvedWithAlternative("QZ");
    const existing = (await store.list("products")).find((p) => p.active)!;
    const other = (await store.list("products")).find(
      (p) => p.active && p.id !== existing.id,
    )!;
    await store.update("booking_items", itemB.id, { productId: other.id });
    await expect(
      product.linkRequestToProduct(admin, request.id, {
        productId: existing.id,
        itemIds: [itemB.id],
      }),
    ).rejects.toThrow("request_product_item_taken");
    await store.update("booking_items", itemB.id, { productId: null });
    await store.update("supplier_requests", request.id, {
      productId: null,
      productAction: null,
    });
    const linked = await product.linkRequestToProduct(admin, request.id, {
      productId: existing.id,
      itemIds: [],
    });
    expect(linked.id).toBe(existing.id);
    expect(
      (await store.get("supplier_requests", request.id))!.productAction,
    ).toBe("linked");
    expect(await isHiddenByBooking(existing.id)).toBe(false);
    // Busca no catálogo pelo nome.
    const found = await product.searchCatalogProducts(
      existing.name.split(" ")[0],
    );
    expect(found.some((p) => p.id === existing.id)).toBe(true);
    // Sem credencial do Sankhya, a busca diz que não está configurado.
    expect((await product.searchSankhyaProducts("copo")).status).toBe(
      "not_configured",
    );
  });
});

describe("regras puras", () => {
  it("linha do tempo e respostas antigas (sem passo no histórico)", () => {
    const legacy = {
      id: "r1",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
      number: 1,
      status: "approved",
      quantity: 10,
      respondedAt: "2026-11-01T11:00:00.000Z",
      respondedByUserId: "u",
      supplierCanDo: "yes",
      supplierPrice: 2,
      supplierCurrency: "USD",
      supplierMoq: null,
      supplierLeadTimeDays: null,
      supplierNote: null,
      decidedAt: "2026-11-01T12:00:00.000Z",
      decisionNote: "ok",
      productLinkedAt: "2026-11-01T13:00:00.000Z",
      productAction: "created",
      negotiation: [
        {
          id: "m",
          at: "2026-11-01T10:30:00.000Z",
          kind: "message",
          side: "wellmix",
          byUserId: "u",
          text: "oi",
        },
      ],
    } as unknown as Parameters<typeof requestTimeline>[0];
    expect(requestTimeline(legacy).map((e) => e.kind)).toEqual([
      "opened",
      "message",
      "answer",
      "decided",
      "product",
    ]);
    expect(answerTimes(legacy)).toEqual({
      first: "2026-11-01T11:00:00.000Z",
      last: "2026-11-01T11:00:00.000Z",
    });
    expect(answerTimes({ negotiation: [], respondedAt: null })).toEqual({
      first: null,
      last: null,
    });
  });

  it("busca por parte das palavras e sugere parecidos", () => {
    const text = lib.itemSearchText({
      description: "Copo de Vidro 350ml",
      productName: null,
      factoryItemCode: "GL-01",
      itemNumber: null,
      material: "glass",
      packageType: null,
      colorAssortment: null,
    });
    expect(lib.matchesItemSearch(text, lib.searchWords("vidro cop"))).toBe(
      true,
    );
    expect(lib.matchesItemSearch(text, lib.searchWords("vidro garrafa"))).toBe(
      false,
    );
    expect(
      lib.similarQuery({
        description: "Copo de Vidro 350ml",
        productName: null,
      }),
    ).toBe("copo vidro");
  });

  it("converte para US$ e decide o que vale em cada situação", () => {
    expect(lib.priceInUsd(7, "RMB", 7)).toBe(1);
    expect(lib.priceInUsd(2, "USD", null)).toBe(2);
    expect(lib.priceInUsd(2, "EUR", 7)).toBeNull();
    expect(lib.supplierRequestDecisions("open", null)).toEqual([
      "cancelled",
      "declined",
    ]);
    expect(lib.supplierRequestDecisions("answered", "yes")).toEqual([
      "approved",
      "declined",
    ]);
    expect(lib.supplierRequestDecisions("answered", "no")).toEqual([
      "declined",
    ]);
    expect(lib.supplierRequestDecisions("approved", "yes")).toEqual([]);
  });
});

describe("seleção: rascunhos, filtros e grupo", () => {
  it("mostra o rascunho, filtra por status, fornecedor, período e origem e abre um grupo por ids", async () => {
    const closed = await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "Z-1", "Zebra mug enamel"),
    ]);
    const draft = await lots.createBookingLotFromSheet(
      admin,
      file([row("Guangzhou Supplier B", "Z-2", "Zebra mug steel")]),
    );
    expect(draft.status).toBe("draft");
    const none = {
      statuses: [],
      from: null,
      to: null,
      supplierId: null,
      origin: null,
    };

    const all = await svc.listSelectionItems(admin, "zebra", {
      filters: none,
    });
    expect(all!.rows.map((r) => r.item.factoryItemCode).sort()).toEqual([
      "Z-1",
      "Z-2",
    ]);
    expect(all!.suppliers.map((s) => s.id)).toEqual(
      expect.arrayContaining([closed.supplierId, draft.supplierId]),
    );

    const closedOnly = await svc.listSelectionItems(admin, "zebra", {
      filters: { ...none, statuses: ["closed"] },
    });
    expect(closedOnly!.rows.map((r) => r.item.factoryItemCode)).toEqual([
      "Z-1",
    ]);
    const bySupplier = await svc.listSelectionItems(admin, "zebra", {
      filters: { ...none, supplierId: draft.supplierId },
    });
    expect(bySupplier!.rows.map((r) => r.item.factoryItemCode)).toEqual([
      "Z-2",
    ]);
    const inOctober = await svc.listSelectionItems(admin, "zebra", {
      filters: { ...none, from: "2026-10-13", to: "2026-10-13" },
    });
    expect(inOctober!.rows).toHaveLength(2);
    const later = await svc.listSelectionItems(admin, "zebra", {
      filters: { ...none, from: "2026-10-14", to: null },
    });
    expect(later!.rows).toHaveLength(0);
    const origin = closedOnly!.rows[0].lot.origin;
    if (origin) {
      const byOrigin = await svc.listSelectionItems(admin, "zebra", {
        filters: { ...none, origin: origin.toUpperCase() },
      });
      expect(byOrigin!.rows.every((r) => r.lot.origin === origin)).toBe(true);
    }
    // Busca pelo nome do fornecedor também acha.
    const byName = await svc.listSelectionItems(admin, "zebra guangzhou", {
      filters: none,
    });
    expect(byName!.rows.map((r) => r.item.factoryItemCode)).toEqual(["Z-2"]);

    // Grupo: só os ids pedidos, sem os filtros.
    const ids = all!.rows.map((r) => r.item.id);
    const group = await svc.listSelectionItems(admin, "", {
      ids,
      filters: { ...none, statuses: ["cancelled"] },
    });
    expect(group!.rows.map((r) => r.item.id).sort()).toEqual([...ids].sort());

    // O rascunho não vira solicitação.
    const draftItem = all!.rows.find((r) => r.item.factoryItemCode === "Z-2")!;
    await expect(
      svc.openSupplierRequest(admin, {
        itemId: draftItem.item.id,
        alternativeIds: [],
        quantity: 100,
        needs: null,
        searchQuery: null,
      }),
    ).rejects.toThrow("supplier_request_lot_not_closed");
  });
});
