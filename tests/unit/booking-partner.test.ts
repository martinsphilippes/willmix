import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Booking para o login externo (dono, 11/11/2026): o Trading abre a tela
 * Booking, lança os bookings da empresa dele (sobe a planilha) e vê só os
 * dela (aqueles pelos quais ela responde), sem a análise da Wellmix; as
 * rotinas internas continuam só da Wellmix.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const svc = await import("@/lib/services/booking-partner");
const internal = await import("@/lib/services/booking-lots");
const ncm = await import("@/lib/services/booking-ncm");
const invites = await import("@/lib/services/booking-invites");
const requests = await import("@/lib/services/supplier-requests");
const { screensFor } = await import("@/lib/auth/screens");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { externalAccessFor } = await import("@/lib/services/partner-access");
const { flattenNav, navFor } = await import("@/lib/nav");
const { ROLE_SCREENS } = await import("@/lib/auth/screens");
const { uploadDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;

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
/** Planilha de booking com as linhas dadas. */
const sheet = (name: string, rows: string[][]) =>
  new File([xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
const row = (supplier: string, sku: string, price: string) => [
  supplier,
  "2026.10.13",
  sku,
  `Item ${sku}`,
  "FOB",
  "USD",
  price,
  "48",
  "1000",
  "3000",
];

let admin: User;
let supplier: User;
let trader: User;
let otherTrader: User;
let mine: string;
let asSupplier: string;
let foreign: string;

/** A sessão carrega as telas do perfil a cada requisição; aqui, à mão. */
async function withAccess(user: User): Promise<User> {
  const access = await externalAccessFor(user);
  if (access)
    attachAccess(user, {
      screens: [],
      actions: [],
      external: access.screens,
      menuHidden: access.menuHidden,
    });
  return user;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  const store = getStore();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  const { createPortalLogin } = await import("@/lib/services/portal-access");
  const login = async (name: string, email: string) => {
    const party = await store.create("parties", {
      ...PARTY_EXTRA_DEFAULTS,
      type: "trading",
      name,
      country: "CN",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    } as never);
    return withAccess(
      await createPortalLogin(admin, {
        partyId: party.id,
        email,
        name,
        role: "supplier",
        locale: "pt",
        password: "SenhaTeste123",
      }),
    );
  };
  trader = await login("Trading Um", "um@trading.com");
  otherTrader = await login("Trading Dois", "dois@trading.com");
  await withAccess(supplier);
  const lot = async (patch: Record<string, unknown>, n: number) => {
    const row = await store.create("booking_lots", {
      number: n,
      status: "draft",
      supplierId: null,
      partnerId: null,
      fileName: `booking-${n}.xlsx`,
      itemCount: 1,
      createdByUserId: admin.id,
      ...patch,
    } as never);
    await store.create("booking_items", {
      lotId: row.id,
      position: 0,
      itemNumber: `IT-${n}`,
      productName: `Produto ${n}`,
      price: 1.25,
      currency: "USD",
      moq: 1000,
      analysis: { verdict: "loss", minimumBrl: 9.9 },
      extras: { "MARGEM INTERNA": "segredo" },
      productId: "prod-jarra",
    } as never);
    return row.id;
  };
  // Dele como responsável (o fornecedor é outra empresa).
  mine = await lot(
    { partnerId: trader.partyId, supplierId: supplier.partyId },
    901,
  );
  // Dele como fornecedor.
  asSupplier = await lot({ supplierId: trader.partyId }, 902);
  // De outra empresa.
  foreign = await lot({ supplierId: otherTrader.partyId }, 903);
});

describe("tela Booking do Trading", () => {
  it("o Trading tem a tela Booking; o Fornecedor comum não", () => {
    expect(screensFor(trader).has("booking")).toBe(true);
    expect(screensFor(supplier).has("booking")).toBe(false);
  });

  it("lista só os bookings da empresa dele, sem dados da Wellmix", async () => {
    const lots = (await svc.listPartnerBookingLots(trader))!;
    expect(lots.map((l) => l.id).sort()).toEqual([mine, asSupplier].sort());
    expect(lots.map((l) => l.id)).not.toContain(foreign);
    // Só os campos da planilha: sem responsável interno, nota ou fornecedor.
    expect(Object.keys(lots[0]).sort()).toEqual(
      [
        "bookingDate",
        "createdAt",
        "fileName",
        "id",
        "itemCount",
        "number",
        "origin",
        "status",
      ].sort(),
    );
    expect(
      (await svc.listPartnerBookingLots(otherTrader))!.map((l) => l.id),
    ).toEqual([foreign]);
    // Do mais novo para o mais antigo.
    expect(lots.map((l) => l.number)).toEqual([902, 901]);
  });

  it("responsável e fornecedor ao mesmo tempo: o booking aparece uma vez", async () => {
    const store = getStore();
    const both = await store.create("booking_lots", {
      number: 904,
      status: "closed",
      supplierId: otherTrader.partyId,
      partnerId: otherTrader.partyId,
      fileName: "booking-904.xlsx",
      itemCount: 0,
      createdByUserId: admin.id,
    } as never);
    const lots = (await svc.listPartnerBookingLots(otherTrader))!;
    expect(lots.map((l) => l.id)).toEqual([both.id, foreign]);
    await store.remove("booking_lots", both.id);
  });

  it("liberada a outro papel (cliente): abre, sem nenhum booking", async () => {
    const customer = (await getStore().list("users")).find(
      (u) => u.role === "customer" && u.partyId,
    )!;
    attachAccess(customer, {
      screens: [],
      actions: [],
      external: ["home", "booking"],
      menuHidden: [],
    });
    expect(await svc.listPartnerBookingLots(customer)).toEqual([]);
    expect(await svc.getPartnerBookingLot(customer, mine)).toBeNull();
    // E o menu do cliente ganha a entrada da tela.
    expect(flattenNav(navFor(customer)).map((l) => l.href)).toContain(
      "/app/booking",
    );
  });

  it("abre o booking dele com os itens, sem análise, extras nem produto", async () => {
    const detail = (await svc.getPartnerBookingLot(trader, mine))!;
    expect(detail.items).toHaveLength(1);
    const item = detail.items[0] as Record<string, unknown>;
    expect([item.productName, item.price, item.moq]).toEqual([
      "Produto 901",
      1.25,
      1000,
    ]);
    for (const hidden of ["analysis", "extras", "productId", "ncm"])
      expect(item).not.toHaveProperty(hidden);
  });

  it("booking de outra empresa não abre", async () => {
    expect(await svc.getPartnerBookingLot(trader, foreign)).toBeNull();
    expect(await svc.getPartnerBookingLot(otherTrader, mine)).toBeNull();
  });

  it("booking com responsável não aparece para a fábrica citada nele", async () => {
    // `mine`: a trading responde, a fábrica é o Fornecedor A. Mesmo com a
    // tela liberada, o fornecedor não vê o booking (nem o preço da trading).
    const factory = { ...supplier };
    attachAccess(factory, {
      screens: [],
      actions: [],
      external: [...ROLE_SCREENS.supplier, "booking"],
      menuHidden: [],
    });
    const own = (await svc.listPartnerBookingLots(factory))!;
    expect(own.map((l) => l.id)).not.toContain(mine);
    expect(await svc.getPartnerBookingLot(factory, mine)).toBeNull();
    // Sem responsável, o booking é do fornecedor dele.
    const store = getStore();
    const plain = await store.create("booking_lots", {
      number: 905,
      status: "draft",
      supplierId: supplier.partyId,
      partnerId: null,
      fileName: "booking-905.xlsx",
      itemCount: 0,
      createdByUserId: admin.id,
    } as never);
    expect(
      (await svc.listPartnerBookingLots(factory))!.map((l) => l.id),
    ).toEqual([plain.id]);
    await store.remove("booking_lots", plain.id);
  });

  it("sem a tela, ou sendo da Wellmix, a visão do parceiro recusa", async () => {
    await expect(svc.listPartnerBookingLots(supplier)).rejects.toThrow();
    await expect(svc.listPartnerBookingLots(admin)).rejects.toThrow();
    await expect(svc.getPartnerBookingLot(supplier, mine)).rejects.toThrow();
  });

  it("as rotinas internas do Booking continuam só da Wellmix", async () => {
    await expect(internal.listBookingLots(trader)).rejects.toThrow();
    await expect(internal.getBookingLot(trader, mine)).rejects.toThrow();
  });
});

describe("lançar booking pelo parceiro", () => {
  it("quem pode lançar: login externo de empresa ativa que responde por booking", async () => {
    expect(await svc.canLaunchBooking(trader)).toBe(true);
    // Sem a tela, a Wellmix e o cliente com a tela liberada: não.
    expect(await svc.canLaunchBooking(supplier)).toBe(false);
    expect(await svc.canLaunchBooking(admin)).toBe(false);
    const customer = (await getStore().list("users")).find(
      (u) => u.role === "customer" && u.partyId,
    )!;
    attachAccess(customer, {
      screens: [],
      actions: [],
      external: ["home", "booking"],
      menuHidden: [],
    });
    expect(await svc.canLaunchBooking(customer)).toBe(false);
    await expect(
      svc.launchPartnerBooking(
        customer,
        sheet("cliente.xlsx", [row("Fábrica Z", "CL-1", "1.00")]),
      ),
    ).rejects.toThrow();
    await expect(
      svc.launchPartnerBooking(
        admin,
        sheet("admin.xlsx", [row("Fábrica Z", "AD-1", "1.00")]),
      ),
    ).rejects.toThrow();
    await expect(
      svc.launchPartnerBooking(
        supplier,
        sheet("fornecedor.xlsx", [row("Fábrica Z", "FO-1", "1.00")]),
      ),
    ).rejects.toThrow();
  });

  it("subir a planilha: nasce em preenchimento, só dele, e a Wellmix ainda não vê", async () => {
    const store = getStore();
    const before = (await store.list("notifications")).length;
    const counter = await store.nextNumber("booking_lot_number");
    const launched = await svc.launchPartnerBooking(
      trader,
      sheet("booking-trading.xlsx", [
        row("Fábrica Yiwu Glass", "TR-100", "2.40"),
        row("Fábrica Yiwu Glass", "TR-101", "3.10"),
      ]),
      { defaultCurrency: "USD" },
    );
    // Em preenchimento, sem número (ele vem no envio).
    expect(launched.status).toBe("preparing");
    expect(launched.number).toBe(0);
    expect(launched.itemCount).toBe(2);
    expect(launched.fileName).toBe("booking-trading.xlsx");
    const saved = (await store.get("booking_lots", launched.id))!;
    // Responsável: a empresa dele. Sem dono interno; criado pelo login dele.
    expect(saved.partnerId).toBe(trader.partyId);
    expect(saved.ownerUserId).toBeNull();
    expect(saved.createdByUserId).toBe(trader.id);
    // Na lista dele, em primeiro (falta enviar); fora da lista da outra trading.
    const own = (await svc.listPartnerBookingLots(trader))!;
    expect(own[0].id).toBe(launched.id);
    expect(
      (await svc.listPartnerBookingLots(otherTrader))!.map((l) => l.id),
    ).not.toContain(launched.id);
    expect(await svc.getPartnerBookingLot(otherTrader, launched.id)).toBeNull();
    // Todos os campos da planilha vêm preenchidos, prontos para conferir.
    const detail = (await svc.getPartnerBookingLot(trader, launched.id))!;
    expect(
      detail.items.map((i) => [i.factoryItemCode, i.price, i.moq, i.incoterm]),
    ).toEqual([
      ["TR-100", 2.4, 1000, "FOB"],
      ["TR-101", 3.1, 1000, "FOB"],
    ]);
    const first = detail.items[0] as Record<string, unknown>;
    for (const hidden of ["analysis", "extras", "productId", "ncm"])
      expect(first).not.toHaveProperty(hidden);
    // Para a Wellmix o booking ainda não existe: nem na lista, nem pelo
    // endereço, nem nas rotinas dela; ninguém foi avisado; o NCM não rodou.
    expect(
      (await internal.listBookingLots(admin))!.map((e) => e.lot.id),
    ).not.toContain(launched.id);
    expect(await internal.getBookingLot(admin, launched.id)).toBeNull();
    await expect(
      internal.setBookingItemField(admin, detail.items[0].id, "price", "9"),
    ).rejects.toThrow("not_found");
    await expect(
      internal.setBookingLotPartner(admin, launched.id, null),
    ).rejects.toThrow("not_found");
    await expect(
      internal.setBookingLotNote(admin, launched.id, "x"),
    ).rejects.toThrow("not_found");
    await expect(
      internal.moveBookingLot(admin, launched.id, "cancelled"),
    ).rejects.toThrow("not_found");
    await expect(
      internal.closeBookingLot(admin, launched.id, null),
    ).rejects.toThrow("not_found");
    await expect(
      ncm.setBookingItemsNcm(admin, [detail.items[0].id], "7013.37.00"),
    ).rejects.toThrow("booking_lot_locked");
    await expect(ncm.reclassifyBookingLot(admin, launched.id)).rejects.toThrow(
      "not_found",
    );
    expect(await invites.inviteScreen(admin, detail.items[0].id)).toBeNull();
    const selection = (await requests.listSelectionItems(admin, ""))!;
    expect(selection.rows.map((r) => r.lot.id)).not.toContain(launched.id);
    expect((await store.list("notifications")).length).toBe(before);
    const items = await store.list("booking_items", {
      filter: { lotId: launched.id },
    });
    expect(items.every((i) => !i.ncm && !i.ncmRequestedAt)).toBe(true);
    // E não gastou número da sequência dos bookings.
    expect(await store.nextNumber("booking_lot_number")).toBe(counter + 1);
  });

  it("conferir: ele corrige os campos; outra empresa e a Wellmix não", async () => {
    const store = getStore();
    const lot = (await svc.listPartnerBookingLots(trader))!.find(
      (l) => l.status === "preparing",
    )!;
    const [item] = (await svc.getPartnerBookingLot(trader, lot.id))!.items;
    await svc.setPartnerBookingItemField(trader, item.id, "price", "2,55");
    await svc.setPartnerBookingItemField(trader, item.id, "currency", "RMB");
    await svc.setPartnerBookingItemField(trader, item.id, "material", "glass");
    await svc.setPartnerBookingItemField(trader, item.id, "moq", "");
    const saved = (await store.get("booking_items", item.id))!;
    expect([saved.price, saved.currency, saved.material, saved.moq]).toEqual([
      2.55,
      "RMB",
      "glass",
      null,
    ]);
    expect(saved.updatedByUserId).toBe(trader.id);
    // Valor que não dá para ler recusa, como na tela da Wellmix.
    await expect(
      svc.setPartnerBookingItemField(trader, item.id, "price", "abc"),
    ).rejects.toThrow("booking_item_invalid");
    await expect(
      svc.setPartnerBookingItemField(trader, item.id, "incoterm", "CIF"),
    ).rejects.toThrow("booking_item_invalid");
    // Outra empresa, o fornecedor sem a tela e a Wellmix: não mexem.
    await expect(
      svc.setPartnerBookingItemField(otherTrader, item.id, "price", "1"),
    ).rejects.toThrow("not_found");
    await expect(
      svc.setPartnerBookingItemField(supplier, item.id, "price", "1"),
    ).rejects.toThrow();
    await expect(
      svc.setPartnerBookingItemField(admin, item.id, "price", "1"),
    ).rejects.toThrow();
    await expect(svc.sendPartnerBooking(otherTrader, lot.id)).rejects.toThrow(
      "not_found",
    );
    await expect(
      svc.discardPartnerBooking(otherTrader, lot.id),
    ).rejects.toThrow("not_found");
    expect((await store.get("booking_items", item.id))!.price).toBe(2.55);
  });

  it("Enviar para Wellmix Conferir: ganha o número, vira rascunho e a Wellmix é avisada", async () => {
    const store = getStore();
    const before = (await store.list("notifications")).length;
    const lot = (await svc.listPartnerBookingLots(trader))!.find(
      (l) => l.status === "preparing",
    )!;
    const next = (await store.nextNumber("booking_lot_number")) + 1;
    const sent = await svc.sendPartnerBooking(trader, lot.id);
    expect(sent.status).toBe("draft");
    expect(sent.number).toBe(next);
    // A Wellmix passa a ver, com a trading de responsável e o que ele corrigiu.
    const mineForWellmix = (await internal.listBookingLots(admin))!.find(
      (e) => e.lot.id === sent.id,
    )!;
    expect(mineForWellmix.lot.partnerId).toBe(trader.partyId);
    const wellmixDetail = (await internal.getBookingLot(admin, sent.id))!;
    expect(wellmixDetail.partner?.id).toBe(trader.partyId);
    expect(wellmixDetail.items[0].price).toBe(2.55);
    // E é avisada (quem abre o Booking), com o link do booking.
    const notes = (await store.list("notifications")).slice(before);
    const inApp = notes.filter(
      (n) => n.channel === "inapp" && n.link === `/app/booking/lots/${sent.id}`,
    );
    expect(inApp.map((n) => n.userId)).toContain(admin.id);
    expect(inApp.every((n) => n.kind === "action")).toBe(true);
    expect(inApp[0].subject).toContain(String(sent.number));
    expect(inApp[0].body).toContain("Trading Um");
    // Fora a Wellmix, só o despachante recebe aviso (NCM dos itens sem
    // produto parecido, como em qualquer booking); nenhum fornecedor, trading
    // ou cliente fica sabendo do booking.
    const users = await store.list("users");
    const roleOf = new Map(users.map((u) => [u.id, u.role]));
    const roles = new Set(notes.map((n) => roleOf.get(n.userId ?? "")));
    expect(roles.has("admin")).toBe(true);
    expect(
      [...roles].filter((r) => !["admin", "operator", "broker"].includes(r!)),
    ).toEqual([]);
    // Depois de enviado ele só consulta: não corrige, não reenvia, não descarta.
    const [item] = (await svc.getPartnerBookingLot(trader, sent.id))!.items;
    await expect(
      svc.setPartnerBookingItemField(trader, item.id, "price", "1"),
    ).rejects.toThrow("booking_partner_sent");
    await expect(svc.sendPartnerBooking(trader, sent.id)).rejects.toThrow(
      "booking_partner_sent",
    );
    await expect(svc.discardPartnerBooking(trader, sent.id)).rejects.toThrow(
      "booking_partner_sent",
    );
    // E a Wellmix edita como em qualquer rascunho.
    await internal.setBookingItemField(admin, item.id, "price", "2,60");
    expect((await store.get("booking_items", item.id))!.price).toBe(2.6);
  });

  it("descartar o que ainda preenchia: some o booking, os itens e a planilha", async () => {
    const store = getStore();
    const launched = await svc.launchPartnerBooking(
      trader,
      sheet("errado.xlsx", [row("Fábrica Z", "ERR-1", "1.00")]),
    );
    const saved = (await store.get("booking_lots", launched.id))!;
    expect(saved.fileDocumentId).toBeTruthy();
    const lotsBefore = (await internal.listBookingLots(admin))!.length;
    await svc.discardPartnerBooking(trader, launched.id);
    expect(await store.get("booking_lots", launched.id)).toBeNull();
    expect(
      await store.list("booking_items", { filter: { lotId: launched.id } }),
    ).toEqual([]);
    expect(await store.get("documents", saved.fileDocumentId!)).toBeNull();
    expect(
      (await svc.listPartnerBookingLots(trader))!.map((l) => l.id),
    ).not.toContain(launched.id);
    // Para a Wellmix nada mudou.
    expect((await internal.listBookingLots(admin))!.length).toBe(lotsBefore);
  });

  it("empresa inativa não lança", async () => {
    const store = getStore();
    await store.update("parties", otherTrader.partyId!, { active: false });
    expect(await svc.canLaunchBooking(otherTrader)).toBe(false);
    await expect(
      svc.launchPartnerBooking(
        otherTrader,
        sheet("inativa.xlsx", [row("Fábrica Z", "IN-1", "1.00")]),
      ),
    ).rejects.toThrow();
    await store.update("parties", otherTrader.partyId!, { active: true });
    expect(await svc.canLaunchBooking(otherTrader)).toBe(true);
  });

  it("arquivo que já é de um documento não é lido para dentro do booking dele", async () => {
    // A planilha guardada de um booking da Wellmix (documento interno).
    const kept = await uploadDocument(
      admin,
      sheet("interno.xlsx", [row("Fábrica Secreta", "SEG-1", "9.99")]),
      { type: "attachment", visibility: "internal" },
    );
    const store = getStore();
    const before = (await store.list("booking_lots")).length;
    await expect(
      svc.launchPartnerBooking(trader, { fileKey: kept.storageKey }),
    ).rejects.toThrow("file_required");
    expect((await store.list("booking_lots")).length).toBe(before);
  });

  it("trava de abuso: limite de lançamentos por empresa em 24 horas", async () => {
    const store = getStore();
    const had = (
      await store.list("booking_lots", {
        filter: { partnerId: otherTrader.partyId! },
      })
    ).length;
    const filler: string[] = [];
    for (let i = had; i < svc.PARTNER_DAILY_LAUNCHES; i++) {
      const lot = await store.create("booking_lots", {
        number: 2000 + i,
        status: "draft",
        supplierId: null,
        partnerId: otherTrader.partyId,
        fileName: `lote-${i}.xlsx`,
        itemCount: 0,
        createdByUserId: otherTrader.id,
      } as never);
      filler.push(lot.id);
    }
    await expect(
      svc.launchPartnerBooking(
        otherTrader,
        sheet("demais.xlsx", [row("Fábrica Z", "LIM-1", "1.00")]),
      ),
    ).rejects.toThrow("booking_launch_limit");
    for (const id of filler) await store.remove("booking_lots", id);
    // Com folga de novo, lança.
    const ok = await svc.launchPartnerBooking(
      otherTrader,
      sheet("de-novo.xlsx", [row("Fábrica Z", "LIM-2", "1.00")]),
    );
    expect(ok.status).toBe("preparing");
  });
});

describe("capacidade com letras na planilha", () => {
  it("o tamanho que vem na coluna da capacidade aparece na tela e pode ser corrigido", async () => {
    const store = getStore();
    // Porta-retratos: a coluna "capacity" traz o tamanho da foto, não ml.
    const frames = new File(
      [
        xlsxBytes([
          {
            name: "BOOKING",
            cells: [
              [...HEADER, "CAPACITY"],
              [...row("Fábrica Frames", "PR-8X10", "2.00"), "8X10"],
              [...row("Fábrica Frames", "PR-ML", "2.10"), "350 ml"],
              [...row("Fábrica Frames", "PR-L", "2.20"), "1,5 L"],
              [...row("Fábrica Frames", "PR-VAZIO", "2.30"), ""],
            ],
          },
        ]),
      ],
      "porta-retrato.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    const lot = await svc.launchPartnerBooking(trader, frames);
    const read = async () =>
      (await svc.getPartnerBookingLot(trader, lot.id))!.items.map((i) => [
        i.factoryItemCode,
        i.capacityMl,
        i.sizeText,
      ]);
    // O que veio da planilha: o tamanho em texto; os volumes em mililitros.
    expect(await read()).toEqual([
      ["PR-8X10", null, "8X10"],
      ["PR-ML", 350, null],
      ["PR-L", 1500, null],
      ["PR-VAZIO", null, null],
    ]);
    const { items } = (await svc.getPartnerBookingLot(trader, lot.id))!;
    // Ele corrige: outro tamanho, mililitros no lugar do tamanho, e preenche o vazio.
    await svc.setPartnerBookingItemField(
      trader,
      items[0].id,
      "capacityMl",
      "20x25 cm",
    );
    await svc.setPartnerBookingItemField(
      trader,
      items[1].id,
      "capacityMl",
      "A4",
    );
    await svc.setPartnerBookingItemField(
      trader,
      items[3].id,
      "capacityMl",
      "500",
    );
    expect(await read()).toEqual([
      ["PR-8X10", null, "20x25 cm"],
      ["PR-ML", null, "A4"],
      ["PR-L", 1500, null],
      ["PR-VAZIO", 500, null],
    ]);
    await expect(
      svc.setPartnerBookingItemField(trader, items[2].id, "capacityMl", "0"),
    ).rejects.toThrow("booking_item_invalid");
    // Enviado, a Wellmix vê o tamanho, pode corrigir e ele vale como capacidade.
    const sent = await svc.sendPartnerBooking(trader, lot.id);
    const detail = (await internal.getBookingLot(admin, sent.id))!;
    expect(
      detail.items.map((i) => [i.factoryItemCode, i.capacityMl, i.sizeText]),
    ).toEqual([
      ["PR-8X10", null, "20x25 cm"],
      ["PR-ML", null, "A4"],
      ["PR-L", 1500, null],
      ["PR-VAZIO", 500, null],
    ]);
    const { bookingLotPending } = await import("@/lib/booking-lots");
    const pending = bookingLotPending(detail.lot, detail.items);
    for (const missing of pending.items.values())
      expect(missing).not.toContain("capacityMl");
    await internal.setBookingItemField(
      admin,
      items[0].id,
      "capacityMl",
      "8X10",
    );
    await internal.setBookingItemField(
      admin,
      items[1].id,
      "capacityMl",
      "250 ml",
    );
    const after = await store.list("booking_items", {
      filter: { lotId: sent.id },
    });
    const byCode = new Map(after.map((i) => [i.factoryItemCode, i]));
    expect([
      byCode.get("PR-8X10")!.capacityMl,
      byCode.get("PR-8X10")!.sizeText,
    ]).toEqual([null, "8X10"]);
    expect([
      byCode.get("PR-ML")!.capacityMl,
      byCode.get("PR-ML")!.sizeText,
    ]).toEqual([250, null]);
    // A cópia do item para a solicitação leva o tamanho.
    const { supplierRequestItemOf } = await import("@/lib/supplier-requests");
    expect(supplierRequestItemOf(byCode.get("PR-8X10")!).sizeText).toBe("8X10");
    expect(supplierRequestItemOf(byCode.get("PR-ML")!)).not.toHaveProperty(
      "sizeText",
    );
  });
});
