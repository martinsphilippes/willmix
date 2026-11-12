import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Booking para o login externo (dono, 11/11/2026): o Trading abre a tela
 * Booking e vê só os bookings da empresa dele (responsável ou fornecedor),
 * sem a análise da Wellmix; as rotinas internas continuam só da Wellmix.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
const svc = await import("@/lib/services/booking-partner");
const internal = await import("@/lib/services/booking-lots");
const { screensFor } = await import("@/lib/auth/screens");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { externalAccessFor } = await import("@/lib/services/partner-access");
const { flattenNav, navFor } = await import("@/lib/nav");
type User = import("@/lib/db").User;

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
