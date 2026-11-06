import { describe, expect, it } from "vitest";
import { buildInventory, inInventorySituation } from "@/lib/services/inventory";

const at = "2026-11-01T10:00:00.000Z";
const ci = (over: Record<string, unknown>) => ({
  containerId: "c1",
  orderId: null,
  orderItemId: null,
  productId: "p1",
  quantity: 100,
  unit: "un",
  boxCount: 10,
  updatedAt: at,
  ...over,
});

describe("estoque", () => {
  it("soma mercadoria livre por situação do container e ignora a vendida", () => {
    const rows = buildInventory({
      containers: [
        { id: "c1", status: "arrived" },
        { id: "c2", status: "shipped" },
        { id: "c3", status: "closed" },
      ],
      containerItems: [
        ci({}),
        ci({ containerId: "c2", quantity: 50, boxCount: 5 }),
        ci({ containerId: "c3", quantity: 7 }), // fechado: fora (como a vitrine)
        ci({ orderId: "venda", quantity: 999 }), // vendida a cliente
      ],
      stockOrders: [],
      stockOrderItems: [],
      products: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      brazil: 100,
      transit: 50,
      production: 0,
      total: 150,
      boxes: 15,
    });
    expect(rows[0].containerIds).toEqual(["c1", "c2"]);
  });

  it("compra para estoque: o que falta embarcar fica em produção, sem contar duas vezes", () => {
    const rows = buildInventory({
      containers: [{ id: "c1", status: "loading" }],
      containerItems: [
        ci({ orderId: "o1", orderItemId: "oi1", quantity: 40, boxCount: 4 }),
      ],
      stockOrders: [{ id: "o1", status: "PACKAGING", updatedAt: at }],
      stockOrderItems: [
        {
          id: "oi1",
          orderId: "o1",
          productId: "p1",
          quantity: 100,
          unit: "un",
        },
      ],
      products: [{ id: "p1", masterBoxQty: 12 }],
    });
    expect(rows[0]).toMatchObject({
      transit: 40,
      production: 60,
      total: 100,
      boxes: 4 + 5,
    });
    expect(rows[0].orderIds).toEqual(["o1"]);
  });

  it("compra entregue sem container conta no Brasil; pedido cancelado não conta", () => {
    const rows = buildInventory({
      containers: [],
      containerItems: [],
      stockOrders: [{ id: "o1", status: "DELIVERED", updatedAt: at }],
      stockOrderItems: [
        { id: "a", orderId: "o1", productId: "p1", quantity: 30, unit: "un" },
        {
          id: "b",
          orderId: "cancelado",
          productId: "p2",
          quantity: 9,
          unit: "un",
        },
      ],
      products: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: "p1", brazil: 30 });
    expect(inInventorySituation(rows[0], "brazil")).toBe(true);
    expect(inInventorySituation(rows[0], "transit")).toBe(false);
    expect(inInventorySituation(rows[0], "all")).toBe(true);
  });
});
