import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * De-para aprovado pelo dono (21/11/2026; docs/SANKHYA_INTEGRACAO.md, 9.4):
 * o marco do pedido pelo documento mais adiantado do track, os status da
 * 1104 e as datas de inspeção, ETD e ETA; a 1100 vira reposição (aberta se
 * pendente, encerrada se não) e sai de Pedidos.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const load = await import("@/lib/services/sankhya-orders-load");
const plan = await import("@/lib/integrations/sankhya-orders-plan");
type User = import("@/lib/db").User;

const NOW = new Date("2026-11-21T12:00:00.000Z");
const row = (
  top: number,
  data: Record<string, unknown> = {},
  pending = true,
) => ({
  top,
  milestone: null,
  data: { chain: [{ nunota: 1, top, pending }], ...data },
});
const ship = (
  over: Partial<
    import("@/lib/integrations/sankhya-orders-plan").TrackShipment
  > = {},
) => ({
  open: true,
  customs: false,
  prenota: false,
  eta: null,
  channel: null,
  ...over,
});

describe("marco pelo de-para (função pura)", () => {
  const m = (
    r: ReturnType<typeof row>,
    ships = [] as ReturnType<typeof ship>[],
  ) => plan.trackMilestone(r, ships, NOW);

  it("documentos 1101 a 1103", () => {
    expect(m(row(1101))).toBe("new-order");
    expect(m(row(1102))).toBe("art");
    expect(m(row(1103))).toBe("contract");
  });

  it("1104 pendente: sinal, produção, inspeção e booking", () => {
    expect(m(row(1104, { statusShipping: "8" }))).toBe("down-payment");
    expect(m(row(1104, { statusShipping: "1" }))).toBe("production");
    expect(m(row(1104, {}))).toBe("production");
    expect(m(row(1104, { quality: "Inspeção parcial" }))).toBe("inspection");
    expect(
      m(row(1104, { quality: "Inspecionado", etd: "10012027 00:00:00" })),
    ).toBe("booking");
    expect(m(row(1104, { inspectedAt: "01112026 00:00:00" }))).toBe("booking");
  });

  it("ETD passado: embarque só até 30 dias e sem nada embarcado", () => {
    const insp = { quality: "Inspecionado" };
    expect(m(row(1104, { ...insp, etd: "10112026 00:00:00" }))).toBe(
      "shipment",
    );
    expect(m(row(1104, { ...insp, etd: "01062026 00:00:00" }))).toBe("booking");
    expect(m(row(1104, { ...insp, etd: "10112026 00:00:00" }), [ship()])).toBe(
      "booking",
    );
  });

  it("1104 sem pendência: o embarque aberto menos adiantado", () => {
    const done = row(1104, {}, false);
    expect(m(done, [ship({ eta: "2026-12-20T00:00:00.000Z" })])).toBe(
      "shipment",
    );
    expect(m(done, [ship({ eta: "2026-11-01T00:00:00.000Z" })])).toBe(
      "customs",
    );
    expect(m(done, [ship({ channel: "Verde" })])).toBe("customs");
    expect(m(done, [ship({ customs: true, prenota: true })])).toBe("customs");
    expect(m(done, [ship({ prenota: true })])).toBe("invoice-transport");
    expect(
      m(done, [
        ship({ prenota: true }),
        ship({ eta: "2026-12-20T00:00:00.000Z" }),
      ]),
    ).toBe("shipment");
    expect(
      m(row(1104, { receipt: "Recebimento parcial" }, false), [ship()]),
    ).toBe("delivery");
  });

  it("1104 sem STATUS_SHIPPING e 1101 pendente seguem em andamento", () => {
    expect(
      plan.trackSituation({
        situation: "awaiting_definition",
        top: 1104,
        data: { reason: "no_status_shipping" },
      }),
    ).toBe("in_progress");
    expect(
      plan.trackSituation({ situation: "awaiting_definition", ...row(1101) }),
    ).toBe("in_progress");
    expect(
      plan.trackSituation({
        situation: "awaiting_definition",
        top: 1104,
        data: { reason: "no_successor" },
      }),
    ).toBe("awaiting_definition");
  });
});

describe("1100 vira reposição na carga", () => {
  let admin: User;
  const pre = (key: string, situation: string, pending: boolean) => ({
    id: `order:${key}`,
    kind: "order",
    key,
    situation,
    milestone: null,
    top: 1100,
    supplierCode: "SNK-F9",
    supplierName: "NINGBO TESTE",
    shipmentState: "none",
    computedAt: NOW.toISOString(),
    data: {
      track: key,
      mainKey: String(Number(key) + 1),
      chain: [{ nunota: Number(key) + 1, top: 1100, pending }],
      items: [
        {
          seq: 1,
          doc: Number(key) + 1,
          codprod: "SNK-P9",
          name: "CANECA",
          unit: "UN",
          qty: 500,
          shipped: 0,
          pendingQty: 500,
          price: 1,
        },
        {
          seq: 2,
          doc: Number(key) + 1,
          codprod: "SEM",
          name: "TAMPA",
          unit: "UN",
          qty: 200,
          shipped: 0,
          pendingQty: 200,
          price: 1,
        },
      ],
      orderedAt: "15012027 00:00:00",
    },
  });

  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    const store = getStore();
    await store.create("products", {
      name: "CANECA",
      sankhyaCode: "SNK-P9",
      active: true,
    } as never);
    await store.create(
      "sankhya_projection",
      pre("7000", "in_progress", true) as never,
    );
    await store.create(
      "sankhya_projection",
      pre("7100", "interrupted", false) as never,
    );
    // Reposição de uma reprovada gravada por uma carga anterior: sai.
    await store.create("requests", {
      id: plan.sankhyaReplenishmentId("7100", 7101, 2),
      origin: "replenishment",
      status: "CANCELLED",
      productName: "TAMPA",
      quantity: 200,
      unit: "UN",
    } as never);
    // Pedido de 1100 gravado por uma carga anterior: sai de Pedidos.
    await store.create("orders", {
      id: "snk-t7000",
      number: 7000,
      status: "ORDER_CREATED",
    } as never);
    await store.create("order_items", {
      id: "snk-t7000-7001-1",
      orderId: "snk-t7000",
      name: "CANECA",
      quantity: 500,
    } as never);
  });

  async function runAll() {
    let p = await load.runOrdersLoadStep(admin, { restart: true });
    for (let i = 0; i < 20 && p.phase !== "done"; i++)
      p = await load.runOrdersLoadStep(admin);
    return p;
  }

  it("pendente vira reposição aberta; a reprovada fica fora; sem pedido", async () => {
    const p = await runAll();
    expect(p.phase).toBe("done");
    expect(p.replenishments).toBe(2);
    expect(p.rejectedPreOrders).toBe(1);
    expect(p.removedOrders).toBe(1);
    const store = getStore();
    expect(await store.get("orders", "snk-t7000")).toBeNull();
    expect(
      await store.list("order_items", { filter: { orderId: "snk-t7000" } }),
    ).toEqual([]);
    const open = (await store.get(
      "requests",
      plan.sankhyaReplenishmentId("7000", 7001, 1),
    ))!;
    expect(open.origin).toBe("replenishment");
    expect(open.status).toBe("REQUESTED");
    expect(open.number).toBe(7000);
    expect(open.quantity).toBe(500);
    expect(open.productId).toBeTruthy();
    expect(open.desiredAt).toBe("2027-01-15T00:00:00.000Z");
    for (const seq of [1, 2])
      expect(
        await store.get(
          "requests",
          plan.sankhyaReplenishmentId("7100", 7101, seq),
        ),
      ).toBeNull();
    const { listDemands } = await import("@/lib/services/purchase-demand");
    const ids = (await listDemands("replenishment")).map((r) => r.id);
    expect(ids).toContain(open.id);
    // Uma solicitação só, com os produtos dentro (dono, 22/11/2026).
    const second = (await store.get(
      "requests",
      plan.sankhyaReplenishmentId("7000", 7001, 2),
    ))!;
    expect(open.groupId).toBe("snk-r7000");
    expect(second.groupId).toBe("snk-r7000");
    const { groupRequestRows } = await import("@/lib/services/request-groups");
    const entries = groupRequestRows(await listDemands("replenishment"));
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("batch");
  });

  it("rodar de novo não duplica", async () => {
    const store = getStore();
    const before = (
      await store.list("requests", {
        filter: { origin: "replenishment" } as never,
      })
    ).length;
    const p = await runAll();
    expect(p.removedOrders).toBe(0);
    expect(
      (
        await store.list("requests", {
          filter: { origin: "replenishment" } as never,
        })
      ).length,
    ).toBe(before);
  });
});

describe("passo da carga respeita o prazo", () => {
  it("sem tempo, grava um pedido por passo e termina sem refazer", async () => {
    const { users } = await seedDemo();
    const admin = users.find((u) => u.email === "admin@wellmix.com")!;
    const store = getStore();
    for (const key of ["7200", "7300", "7400"])
      await store.create("sankhya_projection", {
        id: `order:${key}`,
        kind: "order",
        key,
        situation: "in_progress",
        milestone: null,
        top: 1100,
        supplierCode: null,
        supplierName: null,
        shipmentState: "none",
        computedAt: NOW.toISOString(),
        data: {
          track: key,
          chain: [{ nunota: Number(key), top: 1100, pending: true }],
          items: [
            {
              seq: 1,
              codprod: "X",
              name: "ITEM",
              unit: "UN",
              qty: 1,
              shipped: 0,
              pendingQty: 1,
              price: 1,
            },
          ],
        },
      } as never);
    let p = await load.runOrdersLoadStep(admin, { restart: true });
    const total = p.total;
    expect(total).toBeGreaterThanOrEqual(3);
    const seen: number[] = [];
    for (let i = 0; i < 50 && p.phase === "orders"; i++) {
      p = await load.runOrdersLoadStep(admin, { budgetMs: 0 });
      seen.push(p.phase === "orders" ? p.done : total);
    }
    // Cada passo avança pelo menos um pedido, sem pular nem voltar.
    expect(seen.length).toBe(total);
    expect(seen[0]).toBe(1);
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(p.phase).not.toBe("orders");
  });
});
