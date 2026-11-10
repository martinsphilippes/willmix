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
    });
    expect(answered).toMatchObject({
      status: "answered",
      supplierCanDo: "yes",
      supplierPrice: 1.4,
      supplierMoq: 2000,
      supplierLeadTimeDays: 45,
    });
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

describe("regras puras", () => {
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
