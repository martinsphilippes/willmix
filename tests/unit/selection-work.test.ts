import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";
import { TEST_FAMILY, setTestFamily } from "./helpers/book-family";

/*
 * Ajustes da Seleção e do book (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Trabalho na Seleção"): a Família do produto na capa do book (obrigatória
 * para fechar), só os itens não trabalhados dos books fechados nas abas
 * Itens e Blocos, o filtro do nº do book, o rascunho e a trava da seleção em
 * andamento e o contador do menu com os itens dos books travados.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const sr = await import("@/lib/services/supplier-requests");
const drafts = await import("@/lib/services/selection-draft");
type User = import("@/lib/db").User;

let admin: User;

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
const row = (sku: string) => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  `Prato ${sku}`,
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

async function lotWith(skus: string[], close = true) {
  const file = new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...skus.map(row)] }])],
    `${skus[0]}.xlsx`,
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
  const lot = await lots.createBookingLotFromSheet(admin, file);
  const items = await getStore().list("booking_items", {
    filter: { lotId: lot.id },
  });
  const { setBookingItemsNcm } = await import("@/lib/services/booking-ncm");
  await setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  if (close) {
    await setTestFamily(lot.id);
    await lots.closeBookingLot(admin, lot.id);
  }
  return { lot: (await getStore().get("booking_lots", lot.id))!, items };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("Família do produto na capa do book", () => {
  it("o book só fecha com a família; família fora do cadastro é recusada", async () => {
    const { lot } = await lotWith(["FM-1"], false);
    await expect(lots.closeBookingLot(admin, lot.id)).rejects.toThrow(
      "booking_family_required",
    );
    await expect(
      lots.setBookingLotFamily(admin, lot.id, "99999999"),
    ).rejects.toThrow("family_unknown");
    const saved = await lots.setBookingLotFamily(admin, lot.id, TEST_FAMILY);
    expect(saved.familyCode).toBe(TEST_FAMILY);
    const closed = await lots.closeBookingLot(admin, lot.id);
    expect(closed.status).toBe("closed");
  });
});

describe("abas Itens e Blocos: só os não trabalhados dos books fechados", () => {
  it("rascunho e item trabalhado ficam de fora; o filtro do nº do book", async () => {
    const draft = await lotWith(["PW-DRAFT"], false);
    const a = await lotWith(["PW-A1", "PW-A2"]);
    const b = await lotWith(["PW-B1"]);
    const list = (lotNumber: number | null = null) =>
      sr.listSelectionItems(admin, "PW-", {
        filters: {
          statuses: [],
          from: null,
          to: null,
          supplierId: null,
          origin: null,
          lotNumber,
        },
        pendingOnly: true,
      });
    const codes = async (lotNumber: number | null = null) =>
      (await list(lotNumber))!.rows.map((r) => r.item.factoryItemCode).sort();
    expect(await codes()).toEqual(["PW-A1", "PW-A2", "PW-B1"]);
    expect(await codes()).not.toContain("PW-DRAFT");
    void draft;
    // Trabalhado (escolha gravada ou cotação aberta): sai da lista.
    await lots.markItemsWorked(admin, [a.items[0]]);
    expect(await codes()).toEqual(["PW-A2", "PW-B1"]);
    // O nº do book: só os itens dele; a lista de books continua completa.
    const one = (await list(b.lot.number))!;
    expect(one.rows.map((r) => r.item.factoryItemCode)).toEqual(["PW-B1"]);
    const numbers = one.books.map((x) => x.number);
    expect(numbers).toContain(a.lot.number);
    expect(numbers).toContain(b.lot.number);
    expect(numbers).not.toContain(draft.lot.number);
    expect(one.books.find((x) => x.number === a.lot.number)?.pending).toBe(1);
  });
});

describe("seleção em andamento", () => {
  it("rascunho por login: guarda, volta, recusa outra e some ao concluir ou cancelar", async () => {
    expect(await drafts.loadSelectionDraft(admin)).toBeNull();
    await drafts.saveSelectionDraft(admin, {
      ids: ["it-1", "it-2"],
      values: {
        chosen: ["it-1"],
        needs: ["Caixa com a marca"],
        "art.|1": ["arquivo"],
        "artUploaded.|1": ["chave-do-armazenamento"],
        // A arte já registrada (documento) fica no rascunho (dono, 26/11/2026).
        "artKeep.Azul|1": ["doc-arte-1"],
        "artKeep.Verde|1": ["../fora"],
        quantity: ["480"],
      },
    });
    const saved = (await drafts.loadSelectionDraft(admin))!;
    expect(saved.ids).toEqual(["it-1", "it-2"]);
    expect(saved.values).toMatchObject({
      chosen: ["it-1"],
      needs: ["Caixa com a marca"],
      quantity: ["480"],
    });
    // O arquivo e a chave do armazenamento não entram; o documento entra.
    expect(saved.values["art.|1"]).toBeUndefined();
    expect(saved.values["artUploaded.|1"]).toBeUndefined();
    expect(saved.values["artKeep.Azul|1"]).toEqual(["doc-arte-1"]);
    expect(saved.values["artKeep.Verde|1"]).toBeUndefined();
    // A mesma seleção continua salvando; outra é recusada.
    await drafts.saveSelectionDraft(admin, {
      ids: ["it-2", "it-1"],
      values: { chosen: ["it-2"] },
    });
    await expect(
      drafts.saveSelectionDraft(admin, { ids: ["it-9"], values: {} }),
    ).rejects.toThrow("selection_draft_other");
    await expect(drafts.assertSelectionFree(admin, ["it-9"])).rejects.toThrow(
      "selection_draft_other",
    );
    await drafts.assertSelectionFree(admin, ["it-1"]);
    await drafts.clearSelectionDraft(admin);
    expect(await drafts.loadSelectionDraft(admin)).toBeNull();
    await drafts.assertSelectionFree(admin, ["it-9"]);
  });
});

describe("arte da combinação no rascunho", () => {
  it("vira documento interno na hora; só imagem", async () => {
    const png = new File(
      [new Uint8Array([137, 80, 78, 71, 1, 2, 3])],
      "a.png",
      {
        type: "image/png",
      },
    );
    const id = await drafts.registerSelectionArt(admin, { file: png });
    const doc = (await getStore().get("documents", id))!;
    expect(doc.type).toBe("photo");
    expect(doc.visibility).toBe("internal");
    expect(doc.uploadedByUserId).toBe(admin.id);
    const txt = new File(["oi"], "a.txt", { type: "text/plain" });
    await expect(
      drafts.registerSelectionArt(admin, { file: txt }),
    ).rejects.toThrow("mime");
    await expect(drafts.registerSelectionArt(admin, {})).rejects.toThrow(
      "invalid_input",
    );
  });
});

describe("contador da Seleção de itens no menu", () => {
  it("os itens não trabalhados dos books travados para o login", async () => {
    const { lot, items } = await lotWith(["CT-1", "CT-2", "CT-3"]);
    const before = await lots.lockedPendingItems(admin);
    await lots.lockBookingLot(admin, lot.id);
    const after = await lots.lockedPendingItems(admin);
    expect(after.count - before.count).toBe(3);
    await lots.markItemsWorked(admin, [items[0]]);
    expect((await lots.lockedPendingItems(admin)).count - before.count).toBe(2);
    // Trava atrasada (passou de 3 h): os itens contam como atrasados.
    const later = new Date(Date.now() + 4 * 3_600_000);
    expect((await lots.lockedPendingItems(admin, later)).overdue).toBe(
      (await lots.lockedPendingItems(admin, later)).count,
    );
  });
});
