import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Convite para booking concorrente (docs/BOOKING_INVITES.md): a Wellmix
 * convida fornecedores e tradings; o convidado vê só o dele, tem a pendência
 * com o prazo do SLA e responde subindo a planilha, que vira um booking com
 * ele como responsável.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const lots = await import("@/lib/services/booking-lots");
const inv = await import("@/lib/services/booking-invites");
const { pendingTasksFor } = await import("@/lib/services/tasks");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;

let admin: User;
let supplierA: User;
let tradingUser: User;
let tradingId: string;

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "MOQ",
  "PURCHASE QTY IN PCS",
];
const file = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "b.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
const row = (supplier: string, sku: string, desc: string) => [
  supplier,
  "2026.10.13",
  sku,
  desc,
  "FOB",
  "USD",
  "1.25",
  "48",
  "1000",
  "2000",
];

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  const store = getStore();
  const trading = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "trading",
    name: "Trading Yiwu",
    country: "CN",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
    city: "Yiwu",
    contactName: null,
    wechat: null,
    operationMode: null,
    radar: null,
  });
  tradingId = trading.id;
  tradingUser = await store.create("users", {
    email: "trading@yiwu.com",
    name: "Trading Yiwu",
    role: "supplier",
    partyId: trading.id,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
    screens: ["home", "tasks", "notifications", "quotes"],
  } as never);
});

describe("convite para booking concorrente", () => {
  it("convida, o convidado vê e responde com a planilha; o booking nasce com ele responsável", async () => {
    const store = getStore();
    await setSetting("bookingInviteSlaDays", 2);
    const lot = await lots.createBookingLotFromSheet(
      admin,
      file([row("Shenzhen Supplier A", "C-1", "Ceramic mug 300ml")]),
    );
    const [item] = await store.list("booking_items", {
      filter: { lotId: lot.id },
    });

    // Só a Wellmix com a tela Booking convida; cliente não é convidado.
    await expect(
      inv.inviteForItem(supplierA, {
        itemId: item.id,
        partnerIds: [tradingId],
        message: null,
      }),
    ).rejects.toThrow();
    await expect(
      inv.inviteForItem(admin, {
        itemId: item.id,
        partnerIds: ["cliente-joao"],
        message: null,
      }),
    ).rejects.toThrow("booking_invite_partner_invalid");

    const before = Date.now();
    const created = await inv.inviteForItem(admin, {
      itemId: item.id,
      partnerIds: [tradingId, "fornecedor-b"],
      message: "Mesma caneca, caixa individual",
    });
    expect(created).toHaveLength(2);
    const mine = created.find((c) => c.partnerId === tradingId)!;
    // Prazo: o SLA das configurações (2 dias).
    const due = Date.parse(mine.dueAt) - before;
    expect(due).toBeGreaterThan(2 * 86_400_000 - 60_000);
    expect(due).toBeLessThan(2 * 86_400_000 + 60_000);
    expect(mine.item).toMatchObject({
      factoryItemCode: "C-1",
      quantity: 2000,
    });
    // Convite aberto para o mesmo parceiro e item não se repete.
    await expect(
      inv.inviteForItem(admin, {
        itemId: item.id,
        partnerIds: [tradingId],
        message: null,
      }),
    ).rejects.toThrow("booking_invite_exists");

    // O convidado vê só o dele e tem a pendência com o prazo.
    expect((await inv.listInvitesFor(tradingUser))!.map((i) => i.id)).toEqual(
      [mine.id],
    );
    expect(await inv.getInvite(supplierA, mine.id)).toBeNull();
    const tasks = await pendingTasksFor(tradingUser);
    const task = tasks.find((x) => x.kind === "booking_invite");
    expect(task?.link).toBe(`/app/supplier-requests/invites/${mine.id}`);
    expect(task?.dueAt).toBe(mine.dueAt);

    // Outro parceiro não responde o convite dele.
    await expect(
      inv.answerInviteWithSheet(
        supplierA,
        mine.id,
        file([row("Trading Yiwu", "Y-1", "Ceramic mug 300ml")]),
      ),
    ).rejects.toThrow("not_found");
    const answered = await inv.answerInviteWithSheet(
      tradingUser,
      mine.id,
      file([row("Trading Yiwu", "Y-1", "Ceramic mug 300ml")]),
    );
    expect(answered.status).toBe("draft");
    expect(answered.partnerId).toBe(tradingId);
    expect(answered.ownerUserId).toBe(admin.id);
    const after = (await store.get("booking_invites", mine.id))!;
    expect(after).toMatchObject({
      status: "answered",
      answeredLotId: answered.id,
      answeredByUserId: tradingUser.id,
    });
    // Respondido: sem pendência e sem nova resposta.
    expect(
      (await pendingTasksFor(tradingUser)).some(
        (x) => x.kind === "booking_invite",
      ),
    ).toBe(false);
    await expect(
      inv.answerInviteWithSheet(
        tradingUser,
        mine.id,
        file([row("Trading Yiwu", "Y-2", "Ceramic mug")]),
      ),
    ).rejects.toThrow("booking_invite_closed");

    // A Wellmix cancela o outro convite aberto.
    const other = created.find((c) => c.partnerId === "fornecedor-b")!;
    expect((await inv.cancelInvite(admin, other.id)).status).toBe("cancelled");
    await expect(inv.cancelInvite(admin, other.id)).rejects.toThrow(
      "booking_invite_closed",
    );
  });

  it("atraso: aberto e com o prazo vencido", () => {
    const now = new Date("2026-11-12T12:00:00Z");
    expect(
      inv.inviteLate({ status: "open", dueAt: "2026-11-12T11:00:00Z" }, now),
    ).toBe(true);
    expect(
      inv.inviteLate(
        { status: "answered", dueAt: "2026-11-12T11:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(inv.inviteDueAt(now, 1)).toBe("2026-11-13T12:00:00.000Z");
  });
});
