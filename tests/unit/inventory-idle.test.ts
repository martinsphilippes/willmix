import { describe, expect, it } from "vitest";
import {
  IDLE_DAYS,
  buildInventory,
  idleDaysFor,
  inInventorySituation,
} from "@/lib/services/inventory";

const item = (containerId: string, updatedAt: string) => ({
  containerId,
  orderId: null,
  orderItemId: null,
  productId: "p1",
  quantity: 100,
  unit: "un",
  boxCount: 10,
  updatedAt,
});

describe("produto parado", () => {
  it("conta desde a chegada quando nunca vendeu", () => {
    const [r] = buildInventory({
      containers: [{ id: "c1", status: "arrived" }],
      containerItems: [item("c1", "2026-07-01T10:00:00.000Z")],
      stockOrders: [],
      stockOrderItems: [],
      products: [],
      today: "2026-11-06",
    });
    expect(r.lastInAt).toBe("2026-07-01T10:00:00.000Z");
    expect(r.lastSaleAt).toBeNull();
    expect(r.idleDays).toBe(128);
    expect(inInventorySituation(r, "idle")).toBe(true);
  });

  it("a última venda zera a contagem; ajuste de inventário não conta como venda", () => {
    const [r] = buildInventory({
      containers: [{ id: "c1", status: "arrived" }],
      containerItems: [item("c1", "2026-07-01T10:00:00.000Z")],
      stockOrders: [],
      stockOrderItems: [],
      products: [],
      movements: [
        {
          productId: "p1",
          kind: "sale_out",
          quantity: -10,
          unit: "un",
          updatedAt: "2026-10-20T10:00:00.000Z",
        },
        {
          productId: "p1",
          kind: "count_loss",
          quantity: -1,
          unit: "un",
          updatedAt: "2026-11-05T10:00:00.000Z",
        },
      ],
      today: "2026-11-06",
    });
    expect(r.lastSaleAt).toBe("2026-10-20T10:00:00.000Z");
    expect(r.idleDays).toBe(17);
    expect(inInventorySituation(r, "idle")).toBe(false);
  });

  it("só em trânsito não é parado; sem hoje, não calcula", () => {
    const [r] = buildInventory({
      containers: [{ id: "c1", status: "shipped" }],
      containerItems: [item("c1", "2026-01-01T10:00:00.000Z")],
      stockOrders: [],
      stockOrderItems: [],
      products: [],
      today: "2026-11-06",
    });
    expect(r.idleDays).toBeNull();
    const [s] = buildInventory({
      containers: [{ id: "c1", status: "arrived" }],
      containerItems: [item("c1", "2026-01-01T10:00:00.000Z")],
      stockOrders: [],
      stockOrderItems: [],
      products: [],
    });
    expect(s.idleDays).toBeNull();
  });

  it("limite de 90 dias", () => {
    const base = { brazil: 5, lastInAt: "2026-08-08", lastSaleAt: null };
    expect(IDLE_DAYS).toBe(90);
    expect(idleDaysFor(base, "2026-11-06")).toBe(90);
    expect(
      inInventorySituation(
        { brazil: 5, transit: 0, production: 0, total: 5, idleDays: 89 },
        "idle",
      ),
    ).toBe(false);
  });
});
