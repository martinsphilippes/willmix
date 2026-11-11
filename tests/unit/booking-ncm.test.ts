import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * NCM dos itens do booking (docs/BOOKING.md, "NCM do item"): por aproximação
 * com os produtos do cadastro (o mais provável ou a moda entre os
 * igualmente prováveis); sem correspondência, o despachante classifica os
 * parecidos de uma vez. Obrigatório para fechar; trocar depois de fechado
 * refaz a análise; o produto criado herda o NCM.
 */
withTempStore();

const { getStore, PRODUCT_EXTRA_DEFAULTS } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const match = await import("@/lib/ncm-match");
const lots = await import("@/lib/services/booking-lots");
const ncm = await import("@/lib/services/booking-ncm");
type User = import("@/lib/db").User;

let admin: User;
let broker: User;
let supplierA: User;
let lineId: string;

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
];
const file = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "ncm.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

async function product(name: string, ncmCode: string, supplierSku?: string) {
  return getStore().create("products", {
    ...PRODUCT_EXTRA_DEFAULTS,
    lineId,
    name,
    sku: null,
    specification: null,
    active: true,
    supplierSku: supplierSku ?? null,
    ncm: ncmCode,
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  broker = users.find((u) => u.role === "broker")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  lineId = (await getStore().list("product_lines"))[0].id;
});

describe("aproximação (regras puras)", () => {
  const cand = (
    productId: string,
    ncmCode: string,
    names: string[],
    codes: string[] = [],
  ) => ({ productId, ncm: ncmCode, names, codes });

  it("pega o NCM do produto mais provável", () => {
    const found = match.matchNcm(
      { names: ["Glass cup 350ml tall"], code: null },
      [
        cand("a", "70133700", ["Glass cup tall"]),
        cand("b", "39241000", ["Plastic cup"]),
      ],
    );
    expect(found).toMatchObject({ ncm: "70133700", productIds: ["a"] });
    expect(found!.score).toBeCloseTo(1);
  });

  it("igualmente prováveis: vale a moda; empate na moda não é correspondência", () => {
    const item = { names: ["Glass cup"], code: null };
    expect(
      match.matchNcm(item, [
        cand("a", "70133700", ["Glass cup"]),
        cand("b", "70133700", ["Cup glass"]),
        cand("c", "70134900", ["glass CUP"]),
      ]),
    ).toMatchObject({ ncm: "70133700", productIds: ["a", "b"] });
    expect(
      match.matchNcm(item, [
        cand("a", "70133700", ["Glass cup"]),
        cand("c", "70134900", ["Cup glass"]),
      ]),
    ).toBeNull();
  });

  it("código de fábrica igual vale como certo; nome pouco parecido não conta", () => {
    expect(
      match.matchNcm({ names: ["Something else"], code: "gl-01" }, [
        cand("a", "70133700", ["Glass cup"], ["GL01"]),
      ]),
    ).toMatchObject({ ncm: "70133700", score: 1 });
    expect(
      match.matchNcm({ names: ["Glass vase decorative big"], code: null }, [
        cand("a", "70133700", ["Glass cup"]),
      ]),
    ).toBeNull();
  });

  it("agrupa os parecidos pelas palavras principais", () => {
    expect(match.ncmGroupKey("Plastic chair 45cm white")).toBe("chair plastic");
    expect(match.ncmGroupKey("Chair plastic kids")).toBe("chair plastic");
  });
});

describe("no booking", () => {
  it("aproxima pelo cadastro, manda o resto ao despachante e exige NCM para fechar", async () => {
    const store = getStore();
    await product("Thermal bottle steel", "96170010");
    const lot = await lots.createBookingLotFromSheet(
      admin,
      file([
        row("TB-1", "Thermal bottle steel 500ml"),
        row("PC-1", "Plastic chair white"),
        row("PC-2", "Plastic chair kids"),
      ]),
    );
    const items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    const bottle = items.find((i) => i.factoryItemCode === "TB-1")!;
    const chairs = items.filter((i) => i.factoryItemCode !== "TB-1");
    expect(bottle).toMatchObject({ ncm: "96170010", ncmSource: "match" });
    for (const c of chairs) {
      expect(c.ncm ?? null).toBeNull();
      expect(c.ncmRequestedAt).toBeTruthy();
    }
    // O despachante recebe o aviso e vê os parecidos num grupo só.
    const notes = await store.list("notifications", {
      filter: { userId: broker.id, channel: "inapp" },
    });
    expect(notes.some((n) => n.link === "/app/ncm-items")).toBe(true);
    const groups = await ncm.pendingNcmGroups(broker);
    const group = groups.find((g) => g.key === "chair plastic")!;
    expect(group.items.map((i) => i.id).sort()).toEqual(
      chairs.map((c) => c.id).sort(),
    );
    // Sem fornecedor nem preço para o despachante.
    expect(Object.keys(group.items[0])).not.toContain("price");

    // Sem NCM em todos, não fecha (fornecedor e data já vieram da planilha).
    await expect(lots.closeBookingLot(admin, lot.id, null)).rejects.toThrow(
      "booking_items_incomplete",
    );
    // Fornecedor não preenche; NCM inválido recusa.
    await expect(
      ncm.setBookingItemsNcm(supplierA, [chairs[0].id], "94017900"),
    ).rejects.toThrow();
    await expect(
      ncm.setBookingItemsNcm(broker, [chairs[0].id], "9401"),
    ).rejects.toThrow("booking_ncm_invalid");
    await ncm.setBookingItemsNcm(
      broker,
      chairs.map((c) => c.id),
      "9401.79.00",
    );
    for (const c of chairs)
      expect(await store.get("booking_items", c.id)).toMatchObject({
        ncm: "94017900",
        ncmSource: "broker",
        ncmByUserId: broker.id,
      });
    expect(await ncm.pendingNcmGroups(broker)).toEqual([]);

    // Fecha; trocar o NCM depois refaz a análise do item; apagar não pode.
    await lots.closeBookingLot(admin, lot.id, null);
    const before = (await store.get("booking_items", bottle.id))!.analysis!;
    expect(before.inputs?.ncmFound).toBeDefined();
    await new Promise((r) => setTimeout(r, 5));
    const res = await ncm.setBookingItemsNcm(admin, [bottle.id], "96170020");
    expect(res.reanalyzed).toBe(1);
    const after = (await store.get("booking_items", bottle.id))!;
    expect(after).toMatchObject({ ncm: "96170020", ncmSource: "manual" });
    expect(after.analysis!.at > before.at).toBe(true);
    await expect(
      ncm.setBookingItemsNcm(admin, [bottle.id], ""),
    ).rejects.toThrow("booking_ncm_required");
  });

  it("o item já ligado a um produto ensina o nome em inglês do produto", async () => {
    const store = getStore();
    const p = await product("Copo de vidro alto", "70133700");
    const first = await lots.createBookingLotFromSheet(
      admin,
      file([row("CV-1", "Drinking glass highball")]),
    );
    const [old] = await store.list("booking_items", {
      filter: { lotId: first.id },
    });
    // Nome em português: sem correspondência; ligado ao produto, passa a ter.
    expect(old.ncm ?? null).toBeNull();
    await store.update("booking_items", old.id, { productId: p.id });
    const second = await lots.createBookingLotFromSheet(
      admin,
      file([row("CV-9", "Drinking glass highball clear")]),
    );
    const [fresh] = await store.list("booking_items", {
      filter: { lotId: second.id },
    });
    expect(fresh).toMatchObject({ ncm: "70133700", ncmSource: "match" });
    expect(fresh.ncmMatchProductIds).toEqual([p.id]);
  });
});

describe("sugestões e estimar de novo", () => {
  const cand = (
    productId: string,
    name: string,
    ncmCode: string,
    codes: string[] = [],
  ) => ({
    productId,
    ncm: ncmCode,
    names: [name],
    codes,
  });

  it("sugere pela tradução do inglês, com nota mínima e desempate pelo material", () => {
    const index = match.buildNcmIndex([
      cand("p1", "TABUA RETANGULAR PLASTICO MARMORE 19CM", "39241000"),
      cand("p2", "TABUA REDONDA PLASTICO MARMORE 30CM", "39241000"),
      cand("p3", "BANDEJA MARMORE CERAMICA", "69120000"),
      cand("p4", "SACOLA LISTRAS 38CM", "42022220"),
      cand("p5", "VASO DECORATIVO", "69139000", ["MY-059A"]),
    ]);
    // "Stone marble" (inglês) acha "MARMORE" (português): metade das palavras.
    const marble = match.suggestNcms(
      { names: ["STONE MARBLE"], code: null, material: "PS+PVC" },
      index,
    );
    expect(marble.map((s) => s.ncm)).toEqual(["39241000", "69120000"]);
    expect(marble[0]).toMatchObject({ score: 0.5, products: 2 });
    // Material de cerâmica inverte o desempate.
    expect(
      match
        .suggestNcms(
          { names: ["Marble"], code: null, material: "ceramic" },
          index,
        )
        .map((s) => s.ncm)[0],
    ).toBe("69120000");
    // Código de fábrica igual: 100%.
    expect(
      match.suggestNcms({ names: ["WD STRIBY VERT"], code: "MY-059A" }, index),
    ).toEqual([
      { ncm: "69139000", score: 1, products: 1, example: "VASO DECORATIVO" },
    ]);
    // Uma palavra de três: abaixo de 50%, nada.
    expect(
      match.suggestNcms({ names: ["blue marble lamp"], code: null }, index),
    ).toEqual([]);
  });

  it("estimar de novo preenche o que o cadastro passou a ter", async () => {
    const store = getStore();
    const lot = await lots.createBookingLotFromSheet(
      admin,
      file([row("ZX-1", "Zircon tumbler"), row("ZX-2", "Quartzite hanger")]),
    );
    let items = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });
    expect(items.every((i) => !i.ncm)).toBe(true);
    await product("Zircon tumbler", "70133700");
    await expect(ncm.reclassifyBookingLot(supplierA, lot.id)).rejects.toThrow(
      "forbidden",
    );
    expect(await ncm.reclassifyBookingLot(admin, lot.id)).toEqual({
      matched: 1,
      toBroker: 1,
    });
    items = await store.list("booking_items", { filter: { lotId: lot.id } });
    expect(items.find((i) => i.factoryItemCode === "ZX-1")).toMatchObject({
      ncm: "70133700",
      ncmSource: "match",
    });
    // Sugestões só para os que continuam sem NCM.
    const suggestions = await ncm.bookingNcmSuggestions(items);
    expect(
      suggestions.has(items.find((i) => i.factoryItemCode === "ZX-1")!.id),
    ).toBe(false);
  });
});
