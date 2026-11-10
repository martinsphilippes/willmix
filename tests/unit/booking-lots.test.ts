import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Booking por planilha (docs/BOOKING.md, "Booking por planilha"): a planilha
 * de um fornecedor vira um booking em rascunho com os itens (nenhum produto
 * do cadastro); fornecedor, origem e data são estimados da planilha; colunas
 * sem campo próprio ficam guardadas no item; fechar exige os campos
 * obrigatórios e roda o Superplan em todos os itens.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/booking-lots");
const lib = await import("@/lib/booking-lots");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const HEADER = [
  "PRODUCT NUMBER LIST",
  "DATE",
  "LOCAL",
  "SUPPLIER NAME",
  "SUPPLIER STORE NO",
  "SUPPLIER PHONE NO",
  "SKU/FACTORY ITEM CODE",
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
  "COLOR ASSORTMENT",
  "CERTIFICATE",
];

const line = (
  n: string,
  sku: string,
  desc: string,
  extra: Partial<Record<string, string>> = {},
) => [
  n,
  "2026.10.13",
  "Yiwu",
  "Ningbo Glassware Co., Ltd.",
  "A 154678",
  "+86 138 0000 1111",
  sku,
  desc,
  "FOB",
  "USD",
  extra.price ?? "1.25",
  "48",
  "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  extra.height ?? "20",
  "350",
  "color box",
  "glass",
  "1000",
  "clear",
  extra.cert ?? "CE",
];

const file = (rows: string[][], name = "booking-ningbo.xlsx") =>
  new File([xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

describe("booking por planilha", () => {
  it("cria o booking em rascunho com os itens, sem produto", async () => {
    const store = getStore();
    const productsBefore = (await store.list("products")).length;
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([
        line("1", "GL-01", "Glass cup"),
        line("2", "GL-02", "Glass jar", { height: "" }),
      ]),
    );
    expect(lot.status).toBe("draft");
    expect(lot.number).toBeGreaterThan(0);
    expect(lot.itemCount).toBe(2);
    expect(lot.bookingDate?.slice(0, 10)).toBe("2026-10-13");
    expect(lot.origin).toBe("Yiwu");
    // Fornecedor desconhecido: sugestão com o que a planilha trouxe.
    expect(lot.supplierId).toBeNull();
    expect(lot.supplierHint).toEqual({
      name: "Ningbo Glassware Co., Ltd.",
      store: "A 154678",
      phone: "+86 138 0000 1111",
      city: "Yiwu",
    });
    expect(lot.extraHeaders).toContain("CERTIFICATE");
    expect((await store.list("products")).length).toBe(productsBefore);

    const items = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).sort((a, b) => a.position - b.position);
    expect(items).toHaveLength(2);
    const [cup, jar] = items;
    expect(cup).toMatchObject({
      itemNumber: "1",
      factoryItemCode: "GL-01",
      description: "Glass cup",
      incoterm: "FOB",
      currency: "USD",
      price: 1.25,
      masterCartonQty: 48,
      innerQty: 12,
      netWeightPcKg: 0.3,
      grossWeightPcKg: 0.35,
      cbmPerCarton: 0.12,
      lengthCm: 10,
      widthCm: 8,
      heightCm: 20,
      capacityMl: 350,
      packageType: "color box",
      material: "glass",
      moq: 1000,
      colorAssortment: "clear",
      productId: null,
    });
    expect(cup.extras).toEqual({ CERTIFICATE: "CE" });
    expect(lib.missingItemFields(cup)).toEqual([]);
    expect(lib.missingItemFields(jar)).toEqual(["heightCm"]);
  });

  it("reconhece o fornecedor já cadastrado pelo nome", async () => {
    const store = getStore();
    const party = await store.create("parties", {
      type: "supplier",
      name: "NINGBO GLASSWARE",
      country: "China",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
      city: "Ningbo",
      address: null,
      contactName: null,
      wechat: null,
      operationMode: null,
      radar: null,
      radarNotes: null,
      importerId: null,
      bankBeneficiary: null,
      bankName: null,
      bankAccount: null,
      bankSwift: null,
      bankAddress: null,
    });
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([line("1", "GL-01", "Glass cup")]),
    );
    expect(lot.supplierId).toBe(party.id);
    // Origem: a cidade do fornecedor.
    expect(lot.origin).toBe("Ningbo");
    await store.update("parties", party.id, { active: false });
  });

  it("só fecha completo, e fechar analisa todos os itens", async () => {
    const store = getStore();
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([
        line("1", "GL-01", "Glass cup"),
        line("2", "GL-02", "Glass jar", { height: "" }),
      ]),
    );
    await expect(svc.closeBookingLot(admin, lot.id, null)).rejects.toThrow(
      "supplier_required",
    );
    const party = await svc.registerBookingLotSupplier(admin, lot.id, {
      name: lot.supplierHint!.name!,
      storeNumber: lot.supplierHint!.store,
      phone: lot.supplierHint!.phone,
      city: lot.supplierHint!.city,
      country: null,
    });
    expect(party).toMatchObject({
      type: "supplier",
      storeNumber: "A 154678",
      phone: "+86 138 0000 1111",
      city: "Yiwu",
      active: true,
    });
    expect((await store.get("booking_lots", lot.id))!.supplierId).toBe(
      party.id,
    );
    await expect(svc.closeBookingLot(admin, lot.id, null)).rejects.toThrow(
      "booking_items_incomplete",
    );
    const jar = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).find((i) => i.factoryItemCode === "GL-02")!;
    await expect(
      svc.setBookingItemField(admin, jar.id, "heightCm", "abc"),
    ).rejects.toThrow("booking_item_invalid");
    const saved = await svc.setBookingItemField(
      admin,
      jar.id,
      "heightCm",
      "21,5",
    );
    expect(saved.heightCm).toBe(21.5);

    const closed = await svc.closeBookingLot(admin, lot.id, null);
    expect(closed.status).toBe("closed");
    expect(closed.analyzedAt).toBeTruthy();
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    expect(items.every((i) => i.analysis && i.analysis.at)).toBe(true);
    // Fechado não edita.
    await expect(
      svc.setBookingItemField(admin, jar.id, "heightCm", "22"),
    ).rejects.toThrow("booking_lot_locked");
    // Status à mão: só os caminhos previstos.
    await expect(svc.moveBookingLot(admin, lot.id, "draft")).rejects.toThrow(
      "booking_lot_move_invalid",
    );
    await svc.moveBookingLot(admin, lot.id, "in_progress");
    expect((await store.get("booking_lots", lot.id))!.status).toBe(
      "in_progress",
    );
  });

  it("cliente não sobe booking", async () => {
    await expect(
      svc.createBookingLotFromSheet(joao, file([line("1", "X", "Y")])),
    ).rejects.toThrow();
  });
});

describe("regras puras", () => {
  it("lê o valor digitado de cada campo", () => {
    expect(lib.readBookingItemValue("price", "1.234,50")).toBe(1234.5);
    expect(lib.readBookingItemValue("moq", "1.000")).toBe(1000);
    expect(lib.readBookingItemValue("incoterm", "exw")).toBe("EXW");
    expect(lib.readBookingItemValue("currency", "cny")).toBe("RMB");
    expect(lib.readBookingItemValue("material", "  ABS  ")).toBe("ABS");
    expect(lib.readBookingItemValue("price", "")).toBeNull();
    expect(() => lib.readBookingItemValue("price", "0")).toThrow();
    expect(() => lib.readBookingItemValue("incoterm", "CIF")).toThrow();
  });

  it("acha o fornecedor por nome, telefone ou loja", () => {
    const base = {
      type: "supplier" as const,
      active: true,
      phone: null,
      storeNumber: null,
    };
    const parties = [
      { ...base, id: "a", name: "Yiwu Toys Trading Co., Ltd" },
      { ...base, id: "b", name: "Other", phone: "+86 13800001111" },
      { ...base, id: "c", name: "Third", storeNumber: "B-200" },
    ] as unknown as import("@/lib/db").Party[];
    const hint = (
      h: Partial<{ name: string; phone: string; store: string }>,
    ) => ({
      name: h.name ?? null,
      phone: h.phone ?? null,
      store: h.store ?? null,
    });
    expect(
      lib.matchSheetSupplier(parties, hint({ name: "YIWU TOYS" }))?.id,
    ).toBe("a");
    expect(
      lib.matchSheetSupplier(parties, hint({ phone: "138-0000-1111" }))?.id,
    ).toBe("b");
    expect(lib.matchSheetSupplier(parties, hint({ store: "b 200" }))?.id).toBe(
      "c",
    );
    // Com outro nome na planilha, a loja igual não basta.
    expect(
      lib.matchSheetSupplier(parties, hint({ name: "New", store: "B-200" })),
    ).toBeNull();
    expect(
      lib.matchSheetSupplier(parties, hint({ name: "Nobody" })),
    ).toBeNull();
  });

  it("busca por qualquer campo e ordena por coluna", () => {
    const row = (n: number, supplier: string, origin: string) =>
      ({
        id: String(n),
        number: n,
        status: "draft",
        statusLabel: "Rascunho",
        origin,
        supplier,
        date: null,
        dateText: "",
        fileName: `f${n}.xlsx`,
        itemCount: n,
        pendingItems: 0,
        viable: 0,
        below: 0,
        loss: 0,
        missing: 0,
        owner: "",
        createdAt: "",
        createdText: "",
      }) satisfies import("@/lib/booking-lots").BookingLotRow;
    const rows = [
      row(1, "Ningbo Glass", "Yiwu"),
      row(2, "Shantou Toys", "Shantou"),
    ];
    expect(lib.searchBookingLots(rows, "toys").map((r) => r.number)).toEqual([
      2,
    ]);
    expect(
      lib.searchBookingLots(rows, "yiwu ningbo").map((r) => r.number),
    ).toEqual([1]);
    expect(
      lib.sortBookingLots(rows, "supplier", "desc").map((r) => r.number),
    ).toEqual([2, 1]);
    expect(
      lib.sortBookingLots(rows, "itemCount", "asc").map((r) => r.number),
    ).toEqual([1, 2]);
  });
});
