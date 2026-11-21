import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ensaio da reconstrução dos pedidos de compra do Sankhya (21/11/2026;
 * docs/SANKHYA_INTEGRACAO.md, seção 9, etapa 3): a tela lê a tabela
 * sankhya_projection (montada no banco pelo scripts/sankhya-projection.sql),
 * só o administrador, e conta por situação, marco e motivo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const proj = await import("@/lib/services/sankhya-projection");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;

const row = (
  kind: "order" | "shipment",
  key: string,
  over: Record<string, unknown> = {},
) => ({
  id: `${kind}:${key}`,
  kind,
  key,
  situation: "in_progress",
  milestone: "production",
  top: kind === "order" ? 1104 : 35,
  supplierCode: "54134",
  supplierName: "YIWU SEAWAY",
  shipmentState: kind === "order" ? "partial" : null,
  data: {},
  computedAt: "2026-11-21T12:00:00.000Z",
  ...over,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  const store = getStore();
  for (const r of [
    row("order", "1153105", {
      data: {
        chain: [
          { nunota: 1100001, top: 1100 },
          { nunota: 1153105, top: 1104, pending: true },
        ],
        shipments: [1500001],
      },
    }),
    row("order", "1200000", { milestone: "new-order", top: 1100 }),
    row("order", "900", {
      situation: "awaiting_definition",
      milestone: null,
      supplierName: "NINGBO",
      data: { reason: "no_successor" },
    }),
    row("order", "800", { situation: "interrupted", milestone: null }),
    row("shipment", "1500001", {
      milestone: "loading",
      data: { orders: [{ order: 1153105, seq: 1, qty: 10 }] },
    }),
  ])
    await store.create("sankhya_projection", r as never);
});

describe("ensaio dos pedidos do Sankhya", () => {
  it("só o administrador", async () => {
    await expect(proj.projectionCounts(operator)).rejects.toThrow();
    await expect(
      proj.listProjection(operator, { kind: "order" }),
    ).rejects.toThrow();
  });

  it("conta por situação, marco e motivo", async () => {
    const c = await proj.projectionCounts(admin);
    expect(c.orders).toEqual({
      in_progress: 2,
      awaiting_definition: 1,
      interrupted: 1,
    });
    expect(c.shipments).toEqual({ in_progress: 1 });
    expect(c.milestones).toEqual({ production: 1, "new-order": 1 });
    expect(c.reasons).toEqual({ no_successor: 1 });
    expect(c.computedAt).toBe("2026-11-21T12:00:00.000Z");
  });

  it("filtra por situação, motivo, NUNOTA da cadeia e fornecedor", async () => {
    const inProgress = await proj.listProjection(admin, {
      situation: "in_progress",
    });
    expect(inProgress.rows.map((r) => r.key)).toEqual(["1200000", "1153105"]);
    const byReason = await proj.listProjection(admin, {
      situation: "awaiting_definition",
      reason: "no_successor",
    });
    expect(byReason.rows.map((r) => r.key)).toEqual(["900"]);
    // Um NUNOTA do meio da cadeia acha o pedido.
    const byChain = await proj.listProjection(admin, { search: "1100001" });
    expect(byChain.rows.map((r) => r.key)).toEqual(["1153105"]);
    const bySupplier = await proj.listProjection(admin, { search: "ningbo" });
    expect(bySupplier.rows.map((r) => r.key)).toEqual(["900"]);
  });

  it("detalhe do pedido traz os embarques; do embarque, os pedidos", async () => {
    const order = await proj.projectionDetail(admin, "order", "1153105");
    expect(order.related.map((r) => r.id)).toEqual(["shipment:1500001"]);
    const ship = await proj.projectionDetail(admin, "shipment", "1500001");
    expect(ship.related.map((r) => r.id)).toEqual(["order:1153105"]);
  });
});
