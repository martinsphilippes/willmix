import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Escolha por grupo (docs/SUPPLIER_REQUESTS.md): o grupo comparado grava o
 * item que ganhou e a quantidade sem avisar o fornecedor; a solicitação abre
 * depois, dos grupos marcados ou de todos, só do ganhador de cada um.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
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
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

const groups = await import("@/lib/services/selection-groups");
const sel = await import("@/lib/booking-selection");

describe("escolha por grupo", () => {
  it("grava o ganhador sem avisar o fornecedor e abre a solicitação depois, só dele", async () => {
    const store = getStore();
    await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "GA-1", "Marble tray large", "3000"),
      row("Shenzhen Supplier A", "GA-2", "Marble tray small"),
      row("Shenzhen Supplier A", "GA-3", "Wood spoon long", "500"),
      row("Shenzhen Supplier A", "GA-4", "Wood spoon short", "800"),
    ]);
    const items = await store.list("booking_items");
    const of = (code: string) => items.find((i) => i.factoryItemCode === code)!;
    const notesBefore = (
      await store.list("notifications", { filter: { userId: supplierA.id } })
    ).length;

    // Fornecedor e cliente não gravam; sem quantidade (nem na planilha) recusa.
    await expect(
      groups.saveSelectionGroup(supplierA, {
        itemIds: [of("GA-1").id],
        chosenItemId: of("GA-1").id,
        quantity: null,
        needs: null,
      }),
    ).rejects.toThrow();
    await expect(groups.listSelectionGroups(joao)).rejects.toThrow();
    await expect(
      groups.saveSelectionGroup(admin, {
        itemIds: [of("GA-1").id, of("GA-2").id],
        chosenItemId: of("GA-2").id,
        quantity: null,
        needs: null,
      }),
    ).rejects.toThrow("supplier_request_qty_required");

    // Grava: quantidade em branco = a da planilha do ganhador.
    const tray = await groups.saveSelectionGroup(admin, {
      itemIds: [of("GA-1").id, of("GA-2").id],
      chosenItemId: of("GA-1").id,
      quantity: null,
      needs: "Caixa com a marca",
    });
    expect(tray).toMatchObject({ status: "saved", quantity: 3000 });
    // Rever a escolha do mesmo grupo troca a anterior (não duplica).
    const again = await groups.saveSelectionGroup(admin, {
      itemIds: [of("GA-1").id, of("GA-2").id],
      chosenItemId: of("GA-2").id,
      quantity: 1200,
      needs: null,
    });
    expect(again.id).toBe(tray.id);
    expect(again).toMatchObject({
      chosenItemId: of("GA-2").id,
      quantity: 1200,
    });
    const spoon = await groups.saveSelectionGroup(admin, {
      itemIds: [of("GA-3").id, of("GA-4").id],
      chosenItemId: of("GA-4").id,
      quantity: null,
      needs: null,
    });
    expect(spoon.quantity).toBe(800);

    // Nada foi ao fornecedor: nem solicitação, nem aviso.
    expect(await store.list("supplier_requests")).toHaveLength(0);
    expect(
      (await store.list("notifications", { filter: { userId: supplierA.id } }))
        .length,
    ).toBe(notesBefore);
    const listed = await groups.listSelectionGroups(admin);
    expect(listed.map((e) => e.group.id).sort()).toEqual(
      [tray.id, spoon.id].sort(),
    );
    // O bloco acha a própria escolha pelo ganhador.
    expect(
      sel.groupForBlock(
        [of("GA-3").id, of("GA-4").id],
        listed.map((e) => e.group),
      )?.id,
    ).toBe(spoon.id);

    // Abre só o marcado: a solicitação é do ganhador, o outro vira alternativa.
    await expect(groups.openGroupRequests(admin, ["nada"])).rejects.toThrow(
      "selection_group_none",
    );
    const one = await groups.openGroupRequests(admin, [spoon.id]);
    expect(one.failed).toEqual([]);
    expect(one.opened).toHaveLength(1);
    expect(one.opened[0]).toMatchObject({
      status: "open",
      bookingItemId: of("GA-4").id,
      quantity: 800,
      alternativeItemIds: [of("GA-3").id],
      supplierId: supplierA.partyId,
    });
    expect(await store.get("selection_groups", spoon.id)).toMatchObject({
      status: "requested",
      supplierRequestId: one.opened[0].id,
    });
    // Todos: só o que ainda esperava (o já aberto não abre de novo).
    const all = await groups.openGroupRequests(admin, "all");
    expect(all.opened.map((r) => r.bookingItemId)).toEqual([of("GA-2").id]);
    expect(all.opened[0].quantity).toBe(1200);
    expect(await store.list("supplier_requests")).toHaveLength(2);
    await expect(groups.openGroupRequests(admin, "all")).rejects.toThrow(
      "selection_group_none",
    );

    // Item com solicitação em andamento: o grupo não abre e continua gravado.
    const dup = await groups.saveSelectionGroup(admin, {
      itemIds: [of("GA-3").id, of("GA-4").id],
      chosenItemId: of("GA-4").id,
      quantity: 900,
      needs: null,
    });
    const failed = await groups.openGroupRequests(admin, [dup.id]);
    expect(failed.opened).toEqual([]);
    expect(failed.failed).toEqual([
      { groupId: dup.id, error: "supplier_request_exists" },
    ]);
    expect((await store.get("selection_groups", dup.id))!.status).toBe("saved");
  });

  it("abrir vários de uma vez vira uma solicitação só por fornecedor, com os produtos dentro", async () => {
    const store = getStore();
    await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "GB-1", "Blue vase tall", "100"),
      row("Shenzhen Supplier A", "GB-2", "Green bowl deep", "200"),
    ]);
    // Outro booking do mesmo fornecedor: entra na mesma solicitação.
    await closedLot("Shenzhen Supplier A", [
      row("Shenzhen Supplier A", "GB-3", "Red plate flat", "300"),
    ]);
    const items = await store.list("booking_items");
    const of = (code: string) => items.find((i) => i.factoryItemCode === code)!;
    const saved: string[] = [];
    for (const code of ["GB-1", "GB-2", "GB-3"]) {
      const group = await groups.saveSelectionGroup(admin, {
        itemIds: [of(code).id],
        chosenItemId: of(code).id,
        quantity: null,
        needs: null,
      });
      saved.push(group.id);
    }
    const notes = async () =>
      (
        await store.list("notifications", {
          filter: { userId: supplierA.id, channel: "inapp" },
        })
      ).length;
    const before = await notes();
    const { opened, failed } = await groups.openGroupRequests(admin, saved);
    expect(failed).toEqual([]);
    expect(opened).toHaveLength(3);
    // Um número e um lote só; um aviso só ao fornecedor.
    expect(new Set(opened.map((r) => r.number)).size).toBe(1);
    expect(opened[0].batchId).toBeTruthy();
    expect(new Set(opened.map((r) => r.batchId)).size).toBe(1);
    expect(await notes()).toBe(before + 1);
    const lib = await import("@/lib/supplier-requests");
    expect(lib.groupRequests(opened)).toHaveLength(1);
    // O fornecedor e a Wellmix veem os três produtos na mesma solicitação.
    const svc = await import("@/lib/services/supplier-requests");
    for (const who of [supplierA, admin])
      expect(
        (await svc.supplierRequestGroup(who, opened[2])).map((r) => r.id),
      ).toEqual(opened.map((r) => r.id));
    // Na lista, as solicitações de antes não se misturam com a nova.
    const all = (await svc.listSupplierRequests(supplierA))!.map(
      (e) => e.request,
    );
    const mine = lib
      .groupRequests(all)
      .find((list) => list.some((r) => r.id === opened[0].id))!;
    expect(mine).toHaveLength(3);
  });
});
