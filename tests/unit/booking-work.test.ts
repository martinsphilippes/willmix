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
  "SUPPLIER STORE NO",
];
const row = (sku: string, desc: string, store = "") => [
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
  store,
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
    // A Fábrica digitada é a da planilha (outra, as linhas divergiriam).
    supplierName: "Shenzhen Supplier A",
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
        supplierName: "Shenzhen  Supplier A",
        itemType: "  Vidro   decorado ",
      },
    );
    expect(lot.storeNumber).toBe("A 154678");
    expect(lot.supplierName).toBe("Shenzhen Supplier A");
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

describe("fábrica, fornecedor e fabricante", () => {
  // Uma linha com o nº da loja que a planilha traz.
  const mixedRow = (sku: string, store: string) =>
    row(sku, `Item ${sku}`, store);

  it("o Supplier digitado é o Fornecedor: do cadastro, ou cadastrado depois", async () => {
    const store = getStore();
    // Já está no cadastro: o book nasce com ele como Fornecedor.
    const known = await svc.createBookingLotFromSheet(
      admin,
      file([row("FN-1", "Cup")]),
      { itemType: "Fornecedor", supplierName: "shenzhen supplier a" },
    );
    expect(known.partnerId).toBe(supplierA.partyId);
    // Não está: fica o nome, e a Wellmix cadastra depois na tela do book.
    const fresh = await svc.createBookingLotFromSheet(
      admin,
      file([row("FN-2", "Cup")]),
      { itemType: "Fornecedor", supplierName: "HOME IN" },
    );
    expect(fresh.partnerId ?? null).toBeNull();
    expect(fresh.supplierName).toBe("HOME IN");
    const party = await svc.registerBookingLotPartner(admin, fresh.id);
    expect(party.name).toBe("HOME IN");
    expect(party.type).toBe("supplier");
    expect((await store.get("booking_lots", fresh.id))?.partnerId).toBe(
      party.id,
    );
    // O Supplier não é o Fabricante: a Fábrica continua sendo a da planilha,
    // e nenhuma linha diverge por causa dele.
    expect(fresh.supplierId).toBe(known.supplierId);
    expect(
      await svc.manufacturerMismatches(fresh, await itemsOf(fresh.id)),
    ).toEqual([]);
  });

  it("linha com outro nº de loja trava o fechamento até ser removida", async () => {
    const lot = await svc.createBookingLotFromSheet(
      admin,
      file([
        mixedRow("FB-1", "Z 9"),
        mixedRow("FB-2", "z-9"),
        mixedRow("FB-3", "B 22"),
        mixedRow("FB-4", ""),
      ]),
      { itemType: "Fabricante", storeNumber: "Z 9" },
    );
    const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
    const items = await itemsOf(lot.id);
    await setBookingItemsNcm(
      admin,
      items.map((i) => i.id),
      "7013.37.00",
    );
    expect(items.map((i) => i.sheetStore ?? null)).toEqual([
      "Z 9",
      "z-9",
      "B 22",
      null,
    ]);
    // O Fabricante é o nº da loja digitado, repetido em todas as linhas.
    expect(await svc.lotManufacturer(lot)).toBe("Z 9");
    const wrong = await svc.manufacturerMismatches(lot, items);
    // "z-9" é a mesma loja; sem loja na linha não há o que comparar.
    expect(wrong.map((i) => i.factoryItemCode)).toEqual(["FB-3"]);
    await expect(svc.closeBookingLot(admin, lot.id)).rejects.toThrow(
      "booking_manufacturer_mismatch",
    );
    await svc.removeBookingItem(admin, lot.id, wrong[0].id);
    expect((await getStore().get("booking_lots", lot.id))?.itemCount).toBe(3);
    const closed = await svc.closeBookingLot(admin, lot.id);
    expect(closed.status).toBe("closed");
    // A tela do book não edita mais a loja nem o Supplier: ficam como estão.
    const kept = await svc.setBookingLotMeta(admin, lot.id, {
      itemType: "Fabricante B",
    });
    expect(kept.storeNumber).toBe("Z 9");
    expect(kept.itemType).toBe("Fabricante B");
  });

  it("o parceiro não envia o book com outro nº de loja", async () => {
    const lot = await partner.launchPartnerBooking(
      supplierA,
      file([mixedRow("PF-1", "A 154678"), mixedRow("PF-2", "X 1")]),
      { itemType: "Fabricante", storeNumber: "A 154678" },
    );
    const detail = (await partner.getPartnerBookingLot(supplierA, lot.id))!;
    expect(detail.manufacturer).toBe("A 154678");
    expect(detail.items.map((i) => i.manufacturerMismatch)).toEqual([
      false,
      true,
    ]);
    await expect(partner.sendPartnerBooking(supplierA, lot.id)).rejects.toThrow(
      "booking_manufacturer_mismatch",
    );
    await partner.removePartnerBookingItem(
      supplierA,
      lot.id,
      detail.items[1].id,
    );
    const sent = await partner.sendPartnerBooking(supplierA, lot.id);
    expect(sent.status).toBe("draft");
    expect(sent.itemCount).toBe(1);
  });

  it("nº da loja digitado diferente do da planilha só avisa", async () => {
    const lib = await import("@/lib/booking-lots");
    expect(lib.storeNumberMismatch("A 154678", "a-154678")).toBe(false);
    expect(lib.storeNumberMismatch("A 154678", "B 22")).toBe(true);
    expect(lib.storeNumberMismatch("A 154678", null)).toBe(false);
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

describe("recusar itens na tela do book", () => {
  it("só depois do rascunho; o recusado fica trabalhado e sai da seleção", async () => {
    const draft = await svc.createBookingLotFromSheet(
      admin,
      file([row("RF-0", "Refuse draft")]),
      { itemType: "Recusa" },
    );
    await expect(
      svc.refuseBookingItems(
        admin,
        draft.id,
        (await itemsOf(draft.id)).map((i) => i.id),
      ),
    ).rejects.toThrow("booking_refuse_draft");

    const lot = await closedLot(
      [row("RF-1", "Refuse tray"), row("RF-2", "Refuse spoon")],
      "Recusa",
    );
    const [a, b] = await itemsOf(lot.id);
    await svc.lockBookingLot(ana, lot.id);
    expect(await svc.refuseBookingItems(ana, lot.id, [a.id])).toBe(1);
    // O fornecedor que publicou vê o que foi recusado.
    expect(
      (await partner.getPartnerBookingLot(supplierA, lot.id))!.items.map(
        (i) => [!!i.refused, !!i.worked],
      ),
    ).toEqual([
      [true, true],
      [false, false],
    ]);
    let items = await itemsOf(lot.id);
    expect(items.map((i) => [!!i.refusedAt, !!i.workedAt])).toEqual([
      [true, true],
      [false, false],
    ]);
    // De novo não recusa outra vez; e o recusado some da Seleção de itens.
    expect(await svc.refuseBookingItems(ana, lot.id, [a.id])).toBe(0);
    expect(
      (await requests.listSelectionItems(admin, "Refuse"))!.all.map(
        (r) => r.item.factoryItemCode,
      ),
    ).not.toContain("RF-1");
    // Recusado o último, o book inteiro está trabalhado: a trava sai sozinha.
    await svc.refuseBookingItems(ana, lot.id, [b.id]);
    items = await itemsOf(lot.id);
    expect(items.every((i) => i.workedAt)).toBe(true);
    expect(await svc.myBookingLocks(ana)).toEqual([]);
  });
});

describe("trava liberada sozinha", () => {
  it("o book inteiro trabalhado libera a trava e volta à vista de todos", async () => {
    const lot = await closedLot(
      [row("WD-1", "Done tray"), row("WD-2", "Done spoon")],
      "Trabalho completo",
    );
    const [a, b] = await itemsOf(lot.id);
    await svc.lockBookingLot(ana, lot.id);
    const open = (item: { id: string }) =>
      requests.openSupplierRequest(admin, {
        itemId: item.id,
        alternativeIds: [],
        quantity: 500,
        needs: null,
        searchQuery: null,
      });
    // Metade trabalhada: continua com a Ana.
    await open(a);
    expect((await svc.getBookingLot(admin, lot.id))?.held?.user?.id).toBe(
      ana.id,
    );
    expect(await svc.getBookingLot(bia, lot.id)).toBeNull();
    // Tudo trabalhado: a trava sai sozinha.
    await open(b);
    const done = (await svc.getBookingLot(bia, lot.id))!;
    expect(done.held).toBeNull();
    expect(done.lot.workDoneAt).toBeTruthy();
    expect(await svc.myBookingLocks(ana)).toEqual([]);
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

    // Só depois do rascunho: o book ainda em rascunho não trava, e a trava
    // do tipo não o esconde de ninguém.
    const draft = await svc.createBookingLotFromSheet(
      admin,
      file([row("LK-9", "Lock draft")]),
      { itemType: "Trava madeira" },
    );
    await expect(svc.lockBookingLot(ana, draft.id)).rejects.toThrow(
      "booking_lock_draft",
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
    expect(await found("A 100 Lock")).toEqual(
      expect.arrayContaining(["LK-1", "LK-2", "LK-3"]),
    );
    expect(await found("A 100 trava vidro")).toEqual(["LK-1"]);

    // A Bia trava o tipo (escrito de outro jeito): pega os dois de madeira.
    await svc.lockBookingType(bia, "Trava Madeira");
    expect((await seen(bia)).sort()).toEqual([wood.id, wood2.id].sort());
    // O rascunho do mesmo tipo continua livre, à vista de quem supervisiona
    // e de quem não travou nada.
    expect(
      (await svc.listBookingLots(admin))!.find((e) => e.lot.id === draft.id)!
        .held,
    ).toBeNull();
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

    // Quem travou não libera (nem outra analista): só o gestor dela ou
    // quem supervisiona os books (dono, 24/11/2026).
    const [anaLock] = await svc.myBookingLocks(ana);
    expect(anaLock.canRelease).toBe(false);
    for (const who of [ana, bia])
      await expect(svc.unlockBooking(who, anaLock.lock.id)).rejects.toThrow(
        "booking_lock_release_manager",
      );
    // A Bia vira gestora da Ana ("Responde a"): passa a liberar a trava dela.
    await getStore().update("users", ana.id, { managerUserId: bia.id });
    const forBia = (await svc.getBookingLot(director, glass.id))!.held!;
    expect(forBia.canRelease).toBe(true);
    await svc.unlockBooking(bia, anaLock.lock.id);
    await getStore().update("users", ana.id, { managerUserId: null });
    const [biaLock] = await svc.myBookingLocks(bia);
    await svc.unlockBooking(director, biaLock.lock.id);
    expect(await seen(bia)).toEqual(
      expect.arrayContaining([glass.id, wood.id, wood2.id]),
    );
  });
});
