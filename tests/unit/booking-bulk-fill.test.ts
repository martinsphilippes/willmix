import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Preenchimento em massa dos itens do Book (dono, 16/11/2026): os valores
 * digitados acima das colunas vão para as linhas marcadas, com as regras da
 * célula. Cada valor troca o daquela coluna nas linhas marcadas; as outras
 * linhas e as colunas deixadas em branco ficam como estão.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/booking-lots");
const lib = await import("@/lib/booking-lots");
type User = import("@/lib/db").User;
type BookingItem = import("@/lib/db").BookingItem;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

const HEADER = [
  "DATE",
  "SUPPLIER NAME",
  "SKU/FACTORY ITEM CODE",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "MOQ",
  "MATERIAL",
];
const line = (n: number) => [
  "2026.10.13",
  "Ningbo Glassware Co., Ltd.",
  `GL-${n}`,
  `Glass cup ${n}`,
  "FOB",
  "RMB",
  "1.25",
  "48",
  "1000",
  "glass",
];
const file = (count: number) =>
  new File(
    [
      xlsxBytes([
        {
          name: "BOOKING",
          cells: [
            HEADER,
            ...Array.from({ length: count }, (_, i) => line(i + 1)),
          ],
        },
      ]),
    ],
    "booking-massa.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

async function itemsOf(lotId: string): Promise<BookingItem[]> {
  return (await getStore().list("booking_items", { filter: { lotId } })).sort(
    (a, b) => a.position - b.position,
  );
}

describe("regra de cada campo (a mesma da célula)", () => {
  const item = {
    currency: "RMB",
    price: 1.25,
    capacityMl: 350,
    sizeText: null,
  } as unknown as BookingItem;

  it("o que gravar: só o que muda, com a leitura da célula", () => {
    expect(lib.bookingItemPatch(item, "currency", "usd")).toEqual({
      currency: "USD",
    });
    expect(lib.bookingItemPatch(item, "currency", "RMB")).toBeNull();
    expect(lib.bookingItemPatch(item, "price", "2,5")).toEqual({ price: 2.5 });
    // Capacidade: os mililitros ou o tamanho em texto.
    expect(lib.bookingItemPatch(item, "capacityMl", "8X10")).toEqual({
      capacityMl: null,
      sizeText: "8X10",
    });
    expect(() => lib.bookingItemPatch(item, "price", "abc")).toThrow(
      "booking_item_invalid",
    );
    // Vários campos, um sobre o outro.
    expect(
      lib.bookingItemPatches(item, [
        ["currency", "USD"],
        ["price", "3"],
        ["currency", "USD"],
      ]),
    ).toEqual({ currency: "USD", price: 3 });
    expect(lib.bookingItemPatches(item, [["currency", "RMB"]])).toBeNull();
  });

  it("valor válido para o Carregar: os mesmos limites da célula", () => {
    expect(lib.bulkValueValid("currency", "USD")).toBe(true);
    expect(lib.bulkValueValid("currency", "XYZ")).toBe(false);
    expect(lib.bulkValueValid("incoterm", "fob")).toBe(true);
    expect(lib.bulkValueValid("incoterm", "CIF")).toBe(false);
    expect(lib.bulkValueValid("price", "1,5")).toBe(true);
    expect(lib.bulkValueValid("price", "0")).toBe(false);
    expect(lib.bulkValueValid("moq", "abc")).toBe(false);
    expect(lib.bulkValueValid("capacityMl", "8X10")).toBe(true);
    expect(lib.bulkValueValid("material", "vidro")).toBe(true);
    // Vazio não é valor: a coluna fica como está.
    expect(lib.bulkValueValid("material", "   ")).toBe(false);
    expect(lib.bulkValueValid("ncm", "7013.37.00")).toBe(true);
    expect(lib.bulkValueValid("ncm", "7013")).toBe(false);
  });
});

describe("Carregar na tela da Wellmix", () => {
  it("linhas 2, 5 e 8 recebem USD; as outras e as outras colunas ficam", async () => {
    const lot = await svc.createBookingLotFromSheet(admin, file(9));
    const items = await itemsOf(lot.id);
    expect(items.map((i) => i.currency)).toEqual(Array(9).fill("RMB"));
    const chosen = [items[1], items[4], items[7]].map((i) => i.id);
    const result = await svc.setBookingItemsFields(admin, lot.id, chosen, [
      ["currency", "USD"],
    ]);
    expect(result.updated.sort()).toEqual([...chosen].sort());
    expect(result.failed).toEqual([]);
    const after = await itemsOf(lot.id);
    expect(after.map((i) => i.currency)).toEqual([
      "RMB",
      "USD",
      "RMB",
      "RMB",
      "USD",
      "RMB",
      "RMB",
      "USD",
      "RMB",
    ]);
    // As demais colunas das linhas marcadas não mudaram.
    expect(after[1]).toMatchObject({
      price: 1.25,
      moq: 1000,
      material: "glass",
      factoryItemCode: "GL-2",
      updatedByUserId: admin.id,
    });
    // Ficou registrado na auditoria.
    const logs = await getStore().list("audit_log", {
      filter: { entityId: lot.id },
    });
    expect(logs.some((l) => l.action === "booking_item.bulk")).toBe(true);
  });

  it("várias colunas de uma vez; valor recusado diz o campo de cada item", async () => {
    const lot = await svc.createBookingLotFromSheet(admin, file(3));
    const [a, b, c] = await itemsOf(lot.id);
    const ok = await svc.setBookingItemsFields(
      admin,
      lot.id,
      [a.id, b.id],
      [
        ["moq", "2.000"],
        ["material", "vidro temperado"],
        ["capacityMl", "8X10"],
      ],
    );
    expect(ok.updated).toHaveLength(2);
    const [a2, b2, c2] = await itemsOf(lot.id);
    for (const it of [a2, b2])
      expect(it).toMatchObject({
        moq: 2000,
        material: "vidro temperado",
        capacityMl: null,
        sizeText: "8X10",
      });
    expect(c2).toMatchObject({ moq: 1000, material: "glass" });

    // Preço que não dá para ler: nenhum dos dois grava, cada um diz o campo.
    const bad = await svc.setBookingItemsFields(
      admin,
      lot.id,
      [a.id, c.id],
      [
        ["material", "metal"],
        ["price", "abc"],
      ],
    );
    expect(bad.updated).toEqual([]);
    expect(bad.failed.map((f) => [f.itemId, f.field])).toEqual([
      [a.id, "price"],
      [c.id, "price"],
    ]);
    expect((await itemsOf(lot.id)).map((i) => i.material)).toEqual([
      "vidro temperado",
      "vidro temperado",
      "glass",
    ]);
  });

  it("item de outro booking fica de fora; os do booking gravam", async () => {
    const one = await svc.createBookingLotFromSheet(admin, file(2));
    const two = await svc.createBookingLotFromSheet(admin, file(1));
    const [x, y] = await itemsOf(one.id);
    const [other] = await itemsOf(two.id);
    const result = await svc.setBookingItemsFields(
      admin,
      one.id,
      [x.id, other.id, y.id],
      [["incoterm", "EXW"]],
    );
    expect(result.updated.sort()).toEqual([x.id, y.id].sort());
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ itemId: other.id, field: null });
    expect((await itemsOf(two.id))[0].incoterm).toBe("FOB");
  });

  it("NCM em massa e booking travado: as regras da célula", async () => {
    const lot = await svc.createBookingLotFromSheet(admin, file(2));
    const [a, b] = await itemsOf(lot.id);
    const result = await svc.setBookingItemsFields(
      admin,
      lot.id,
      [a.id, b.id],
      [],
      "7013.37.00",
    );
    expect(result.updated).toHaveLength(2);
    expect((await itemsOf(lot.id)).map((i) => i.ncm)).toEqual([
      "70133700",
      "70133700",
    ]);
    // NCM inválido: os dois itens recusados com o motivo do NCM.
    const bad = await svc.setBookingItemsFields(
      admin,
      lot.id,
      [a.id, b.id],
      [],
      "123",
    );
    expect(bad.updated).toEqual([]);
    expect(bad.failed.map((f) => f.field)).toEqual(["ncm", "ncm"]);
    // Cancelado: os campos não se editam (o pedido inteiro é recusado).
    await svc.moveBookingLot(admin, lot.id, "cancelled");
    await expect(
      svc.setBookingItemsFields(admin, lot.id, [a.id], [["moq", "5"]]),
    ).rejects.toThrow("booking_lot_locked");
  });
});
