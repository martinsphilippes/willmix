import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import {
  freeStock,
  isReservationLive,
  reservationState,
  reservedByProduct,
} from "@/lib/services/reservation-rules";

/*
 * Reserva de estoque para cliente: sai do livre (vitrine e baixa para
 * outros), vira baixa por venda ao usar, volta ao livre ao cancelar ou vencer.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const c = await import("@/lib/services/containers");
const inv = await import("@/lib/services/inventory");
const s = await import("@/lib/services/stock");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let customer: User;
let customerId: string;

const row = async (productId: string) =>
  (await inv.loadInventory()).find((r) => r.productId === productId);

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  customer = users.find((u) => u.email === "joao@lojista.com")!;
  customerId = customer.partyId!;
  const container = await c.createContainer(admin, {
    code: "RES-1",
    type: "40HC",
    capacityCbm: 68,
  });
  await c.addContainerItem(admin, container.id, {
    productId: "prod-panela",
    quantity: 100,
  });
  await getStore().update("containers", container.id, { status: "arrived" });
});

describe("regras da reserva", () => {
  const r = (over: object) => ({
    id: "r",
    productId: "p",
    quantity: 10,
    status: "active" as const,
    expiresAt: "2026-11-10T15:00:00.000Z",
    ...over,
  });
  it("vale até o fim do dia da validade", () => {
    expect(isReservationLive(r({}), "2026-11-10")).toBe(true);
    expect(isReservationLive(r({}), "2026-11-11")).toBe(false);
    expect(reservationState(r({}), "2026-11-11")).toBe("expired");
    expect(reservationState(r({ status: "used" }), "2026-11-01")).toBe("used");
  });
  it("soma só as que valem; livre nunca negativo", () => {
    const m = reservedByProduct(
      [
        r({ id: "a" }),
        r({ id: "b", quantity: 5 }),
        r({ id: "c", status: "cancelled" }),
        r({ id: "d", expiresAt: "2026-10-01T15:00:00.000Z" }),
      ],
      "2026-11-06",
    );
    expect(m.get("p")).toBe(15);
    expect(freeStock(10, 15)).toBe(0);
  });
});

describe("reserva no estoque", () => {
  it("reserva tira do livre e da vitrine; baixa comum não passa do livre", async () => {
    const res = await s.createReservation(operator, {
      productId: "prod-panela",
      customerId,
      quantity: 40,
      days: 15,
      note: "Segurar para o João",
    });
    expect(res.status).toBe("active");
    const r = await row("prod-panela");
    expect(r?.brazil).toBe(100);
    expect(r?.reserved).toBe(40);
    expect(
      (await c.availableStockByProduct()).get("prod-panela")?.quantity,
    ).toBe(60);
    await expect(
      s.recordSaleOut(operator, {
        productId: "prod-panela",
        quantity: 61,
        orderId: null,
        note: null,
      }),
    ).rejects.toThrow("stock_reserved");
    await expect(
      s.createReservation(operator, {
        productId: "prod-panela",
        customerId,
        quantity: 61,
        days: 15,
        note: null,
      }),
    ).rejects.toThrow("stock_insufficient");
  });

  it("usar vira baixa por venda; cancelar devolve ao livre; cliente não mexe", async () => {
    const [res] = await getStore().list("stock_reservations", {
      filter: { status: "active" },
    });
    await expect(
      s.consumeReservation(customer, res.id, null),
    ).rejects.toThrow();
    await s.consumeReservation(operator, res.id, null);
    const used = await getStore().get("stock_reservations", res.id);
    expect(used?.status).toBe("used");
    expect(used?.movementId).toBeTruthy();
    let r = await row("prod-panela");
    expect(r?.brazil).toBe(60);
    expect(r?.reserved ?? 0).toBe(0);
    await expect(s.consumeReservation(operator, res.id, null)).rejects.toThrow(
      "reservation_closed",
    );

    const other = await s.createReservation(operator, {
      productId: "prod-panela",
      customerId,
      quantity: 10,
      days: 1,
      note: null,
    });
    expect((await row("prod-panela"))?.reserved).toBe(10);
    await s.cancelReservation(operator, other.id);
    r = await row("prod-panela");
    expect(r?.reserved ?? 0).toBe(0);
    expect(r?.brazil).toBe(60);
  });

  it("não reserva para o estoque da Wellmix nem com validade fora do limite", async () => {
    await expect(
      s.createReservation(operator, {
        productId: "prod-panela",
        customerId: "wellmix-estoque",
        quantity: 1,
        days: 5,
        note: null,
      }),
    ).rejects.toThrow("customer_not_found");
    await expect(
      s.createReservation(operator, {
        productId: "prod-panela",
        customerId,
        quantity: 1,
        days: 500,
        note: null,
      }),
    ).rejects.toThrow("reservation_days");
  });
});
