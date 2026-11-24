import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Dinâmica dos books (dono, 23/11/2026; docs/BOOKING.md): Loja/Fábrica e
 * Tipo de item gravados no book, várias planilhas num book só, itens
 * trabalhados na Seleção de itens, "Carregar" e a trava (o analista pega um
 * book ou um tipo; os outros deixam de ver; quem supervisiona vê todos).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/booking-lots");
const partner = await import("@/lib/services/booking-partner");
const groups = await import("@/lib/services/selection-groups");
const requests = await import("@/lib/services/supplier-requests");
const locks = await import("@/lib/booking-locks");
type User = import("@/lib/db").User;

let admin: User;
let ana: User;
let bia: User;
let director: User;
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
const file = (rows: string[][], name = "b.xlsx") =>
  new File([xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

const itemsOf = async (lotId: string) =>
  (await getStore().list("booking_items", { filter: { lotId } })).sort(
    (a, b) => a.position - b.position,
  );

/** Sobe e fecha um book (o NCM é obrigatório para fechar). */
async function closedLot(rows: string[][], itemType: string) {
  const lot = await svc.createBookingLotFromSheet(admin, file(rows), {
    storeNumber: "A 100",
    supplierName: "Fabrica Livre",
    itemType,
  });
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  await setBookingItemsNcm(
    admin,
    (await itemsOf(lot.id)).map((i) => i.id),
    "7013.37.00",
  );
  return svc.closeBookingLot(admin, lot.id);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  ana = users.find((u) => u.email === "operador@wellmix.com")!;
  director = users.find((u) => u.email === "diretoria@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  // A sessão carrega as telas do perfil a cada requisição; aqui, à mão.
  const { externalAccessFor } = await import("@/lib/services/partner-access");
  const { attachAccess } = await import("@/lib/auth/access-cache");
  const access = await externalAccessFor(supplierA);
  if (access)
    attachAccess(supplierA, {
      screens: [],
      actions: [],
      external: access.screens,
      menuHidden: access.menuHidden,
    });
  // Uma segunda analista, com as mesmas funções da primeira.
  const { id: _id, createdAt: _c, updatedAt: _u, ...copy } = ana;
  void [_id, _c, _u];
  bia = await getStore().create("users", {
    ...copy,
    email: "bia@wellmix.com",
    name: "Bia Analista",
  });
});

describe("importar o book", () => {
  it("grava Loja/Fábrica e Tipo de item", async () => {
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([row("MT-1", "Glass cup")]),
      {
        storeNumber: " A 154678 ",
        supplierName: "Yiwu  Glass Shop",
        itemType: "  Vidro   decorado ",
      },
    );
    expect(lot.storeNumber).toBe("A 154678");
    expect(lot.supplierName).toBe("Yiwu Glass Shop");
    expect(lot.itemType).toBe("Vidro decorado");
    const changed = await svc.setBookingLotMeta(admin, lot.id, {
      storeNumber: "B 22",
      supplierName: null,
      itemType: "Plástico",
    });
    expect(changed.storeNumber).toBe("B 22");
    expect(changed.supplierName).toBeNull();
    expect(changed.itemType).toBe("Plástico");
    expect(await svc.bookingItemTypes()).toContain("Plástico");
  });

  it("FOB ou EXW escolhido vale para todos os itens; EXW pede o valor", async () => {
    // A planilha diz FOB; quem importa escolhe EXW.
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([row("EX-1", "Exw one"), row("EX-2", "Exw two")]),
      { itemType: "Exw", incoterm: "EXW", exwValue: 0.35 },
    );
    expect(lot.incoterm).toBe("EXW");
    expect(lot.exwValue).toBe(0.35);
    expect((await itemsOf(lot.id)).map((i) => i.incoterm)).toEqual([
      "EXW",
      "EXW",
    ]);
    await expect(
      svc.createBookingLotFromSheet(admin, file([row("EX-3", "x")]), {
        incoterm: "EXW",
      }),
    ).rejects.toThrow("booking_exw_value_required");
    // No rascunho a Wellmix troca: volta para FOB e o valor do EXW sai.
    const back = await svc.setBookingLotMeta(admin, lot.id, {
      storeNumber: null,
      supplierName: null,
      itemType: "Exw",
      incoterm: "FOB",
    });
    expect(back.incoterm).toBe("FOB");
    expect(back.exwValue).toBeNull();
    expect((await itemsOf(lot.id)).map((i) => i.incoterm)).toEqual([
      "FOB",
      "FOB",
    ]);
  });

  it("várias planilhas viram um book só, uma depois da outra", async () => {
    const lot = await svc.createBookingLotFromSheet(
      admin,
      [
        file([row("AP-1", "Tray one"), row("AP-2", "Tray two")], "um.xlsx"),
        file([row("AP-3", "Spoon one")], "dois.xlsx"),
        file([row("AP-4", "Bowl one"), row("AP-5", "Bowl two")], "tres.xlsx"),
      ],
      { itemType: "Append" },
    );
    expect(lot.itemCount).toBe(5);
    expect(lot.fileName).toBe("um.xlsx + dois.xlsx + tres.xlsx");
    expect(lot.sheetFiles?.map((f) => [f.name, f.items])).toEqual([
      ["um.xlsx", 2],
      ["dois.xlsx", 1],
      ["tres.xlsx", 2],
    ]);
    const items = await itemsOf(lot.id);
    expect(items.map((i) => i.position)).toEqual([0, 1, 2, 3, 4]);
    expect(items.map((i) => i.factoryItemCode)).toEqual([
      "AP-1",
      "AP-2",
      "AP-3",
      "AP-4",
      "AP-5",
    ]);
  });

  it("uma planilha que não abre não deixa book pela metade", async () => {
    const before = (await getStore().list("booking_lots")).length;
    await expect(
      svc.createBookingLotFromSheet(admin, [
        file([row("BAD-1", "Ok")]),
        new File([new Uint8Array([1, 2, 3])], "ruim.xlsx"),
      ]),
    ).rejects.toThrow();
    expect((await getStore().list("booking_lots")).length).toBe(before);
    await expect(
      svc.createBookingLotFromSheet(
        admin,
        Array.from({ length: 11 }, (_, i) => file([row(`M-${i}`, "x")])),
      ),
    ).rejects.toThrow("booking_sheets_too_many");
  });

  it("o parceiro também lança várias planilhas com Loja/Fábrica e tipo", async () => {
    const lot = await partner.launchPartnerBooking(
      supplierA,
      [file([row("PA-1", "Cup a")], "a.xlsx"), file([row("PA-2", "Cup b")])],
      { storeNumber: "C 9", supplierName: "Loja Nove", itemType: "Copos" },
    );
    expect(lot.itemCount).toBe(2);
    expect(lot.storeNumber).toBe("C 9");
    expect(lot.supplierName).toBe("Loja Nove");
    expect(lot.itemType).toBe("Copos");
    await partner.discardPartnerBooking(supplierA, lot.id);
  });
});

describe("itens trabalhados", () => {
  it("a escolha gravada na Seleção marca os itens do grupo no book de origem", async () => {
    const lot = await closedLot(
      [
        row("WK-1", "Marble tray large"),
        row("WK-2", "Marble tray small"),
        row("WK-3", "Wood spoon"),
        row("WK-4", "Wood fork"),
      ],
      "Trabalhados",
    );
    const [a, b, c] = await itemsOf(lot.id);
    expect(locks.workedShare(await itemsOf(lot.id)).pct).toBe(0);
    await groups.saveSelectionGroup(admin, {
      itemIds: [a.id, b.id],
      chosenItemId: a.id,
      quantity: 3000,
      needs: null,
    });
    let items = await itemsOf(lot.id);
    expect(items.map((i) => !!i.workedAt)).toEqual([true, true, false, false]);
    expect(items[0].workedByUserId).toBe(admin.id);
    // A solicitação direta também marca (o escolhido e as alternativas).
    await requests.openSupplierRequest(admin, {
      itemId: c.id,
      alternativeIds: [],
      quantity: 500,
      needs: null,
      searchQuery: null,
    });
    items = await itemsOf(lot.id);
    expect(locks.workedShare(items)).toEqual({ worked: 3, total: 4, pct: 75 });
    // A Wellmix vê o percentual na lista; o fornecedor que publicou, também.
    const entry = (await svc.listBookingLots(admin))!.find(
      (e) => e.lot.id === lot.id,
    )!;
    expect(entry.worked).toEqual({ worked: 3, total: 4, pct: 75 });
    const mine = (await partner.listPartnerBookingLots(supplierA))!.find(
      (l) => l.id === lot.id,
    )!;
    expect(mine.worked).toEqual({ worked: 3, total: 4, pct: 75 });
    const detail = (await partner.getPartnerBookingLot(supplierA, lot.id))!;
    expect(detail.items.map((i) => i.worked)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});

describe("travar books", () => {
  it("regras puras: o que cada um vê e o prazo", () => {
    const lot = (id: string, itemType: string | null) => ({
      id,
      itemType,
      createdAt: "2026-11-01T00:00:00.000Z",
    });
    const all = [lot("a", "Vidro"), lot("b", "vidro "), lot("c", "Madeira")];
    const lock = (scope: "lot" | "type", userId: string, target: string) => ({
      id: `${scope}:${target}`,
      scope,
      lotId: scope === "lot" ? target : null,
      typeKey: scope === "type" ? locks.itemTypeKey(target) : null,
      itemType: scope === "type" ? target : null,
      userId,
      lockedAt: "2026-11-02T00:00:00.000Z",
    });
    const ids = (list: Array<{ id: string }>) => list.map((l) => l.id);
    // Sem travas: todos veem tudo.
    expect(ids(locks.visibleLots(all, [], "u1", false))).toEqual([
      "a",
      "b",
      "c",
    ]);
    // u1 trava o tipo Vidro: só vê os dois de vidro; u2 só o que sobrou.
    const byType = [lock("type", "u1", "VIDRO")];
    expect(ids(locks.visibleLots(all, byType, "u1", false))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(locks.visibleLots(all, byType, "u2", false))).toEqual(["c"]);
    expect(ids(locks.visibleLots(all, byType, "boss", true))).toEqual([
      "a",
      "b",
      "c",
    ]);
    // A trava do book vale mais que a do tipo.
    const mixed = [...byType, lock("lot", "u2", "b")];
    expect(locks.lockOfLot(all[1], mixed)?.userId).toBe("u2");
    expect(ids(locks.visibleLots(all, mixed, "u2", false))).toEqual(["b"]);
    // Prazo de 3 h; o book que chegou depois da trava do tipo conta da chegada.
    expect(locks.lockLate(180, 3)).toBe(false);
    expect(locks.lockLate(181, 3)).toBe(true);
    expect(
      locks.lockedSince(
        { id: "n", itemType: "vidro", createdAt: "2026-11-03T00:00:00.000Z" },
        byType[0],
      ),
    ).toBe("2026-11-03T00:00:00.000Z");
    expect(locks.durationText(125)).toBe("2 h 05 min");
  });

  it("quem trava só vê os dele; os outros deixam de ver; o supervisor vê com quem está", async () => {
    const glass = await closedLot([row("LK-1", "Lock glass")], "Trava vidro");
    const wood = await closedLot([row("LK-2", "Lock wood")], "Trava madeira");
    const wood2 = await closedLot(
      [row("LK-3", "Lock wood 2")],
      "trava MADEIRA",
    );
    const seen = async (user: User) =>
      (await svc.listBookingLots(user))!.map((e) => e.lot.id);
    expect(await seen(ana)).toEqual(
      expect.arrayContaining([glass.id, wood.id]),
    );

    await svc.lockBookingLot(ana, glass.id);
    expect(await seen(ana)).toEqual([glass.id]);
    expect(await seen(bia)).not.toContain(glass.id);
    expect(await seen(bia)).toEqual(
      expect.arrayContaining([wood.id, wood2.id]),
    );
    // Travado por outra pessoa: para a Bia o book não existe.
    expect(await svc.getBookingLot(bia, glass.id)).toBeNull();
    expect((await svc.getBookingLot(ana, glass.id))?.held?.user?.id).toBe(
      ana.id,
    );
    await expect(svc.lockBookingLot(bia, glass.id)).rejects.toThrow(
      "booking_lock_taken",
    );
    // A Seleção de itens segue a mesma regra.
    const selection = async (user: User) =>
      (await requests.listSelectionItems(user, "Lock"))!.all.map(
        (r) => r.item.factoryItemCode,
      );
    expect(await selection(ana)).toEqual(["LK-1"]);
    expect(await selection(bia)).toEqual(
      expect.arrayContaining(["LK-2", "LK-3"]),
    );
    expect(await selection(bia)).not.toContain("LK-1");
    // Nº da loja e nome do supplier digitados na importação são buscáveis.
    const found = async (q: string) =>
      (await requests.listSelectionItems(admin, q))!.all.map(
        (r) => r.item.factoryItemCode,
      );
    expect(await found("Fabrica Livre")).toEqual(
      expect.arrayContaining(["LK-1", "LK-2", "LK-3"]),
    );
    expect(await found("A 100 trava vidro")).toEqual(["LK-1"]);

    // A Bia trava o tipo (escrito de outro jeito): pega os dois de madeira.
    await svc.lockBookingType(bia, "Trava Madeira");
    expect((await seen(bia)).sort()).toEqual([wood.id, wood2.id].sort());
    await expect(svc.lockBookingType(ana, "trava madeira")).rejects.toThrow(
      "booking_lock_taken",
    );

    // O administrador e a Diretoria de compras veem todos e com quem está.
    for (const boss of [admin, director]) {
      expect(await svc.canSuperviseBooks(boss)).toBe(true);
      const list = (await svc.listBookingLots(boss))!;
      const holder = (id: string) =>
        list.find((e) => e.lot.id === id)?.held?.user?.id ?? null;
      expect(holder(glass.id)).toBe(ana.id);
      expect(holder(wood.id)).toBe(bia.id);
      expect(holder(wood2.id)).toBe(bia.id);
      expect(
        list.find((e) => e.lot.id === glass.id)!.held!.minutes,
      ).toBeGreaterThanOrEqual(0);
    }
    expect(await svc.canSuperviseBooks(ana)).toBe(false);

    // Só quem travou (ou quem supervisiona) libera.
    const [anaLock] = await svc.myBookingLocks(ana);
    await expect(svc.unlockBooking(bia, anaLock.lock.id)).rejects.toThrow(
      "forbidden",
    );
    await svc.unlockBooking(ana, anaLock.lock.id);
    const [biaLock] = await svc.myBookingLocks(bia);
    await svc.unlockBooking(director, biaLock.lock.id);
    expect(await seen(bia)).toEqual(
      expect.arrayContaining([glass.id, wood.id, wood2.id]),
    );
  });
});
