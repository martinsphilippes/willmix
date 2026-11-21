import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Carga real dos pedidos de compra do Sankhya a partir do ensaio
 * (docs/SANKHYA_INTEGRACAO.md, seção 9, etapa 5): pedido por cadeia sem
 * solicitação, itens com embarcado e saldo, pendências só no em andamento,
 * encerrado e interrompido sem pendências, canal vermelho pausa e o embarque
 * (35) com o que cada pedido leva. Rodar de novo não duplica.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const load = await import("@/lib/services/sankhya-orders-load");
const plan = await import("@/lib/integrations/sankhya-orders-plan");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;

const item = (seq: number, over: Record<string, unknown> = {}) => ({
  seq,
  codprod: "SNK-P1",
  name: "GARRAFA TERMICA",
  unit: "UN",
  qty: 100,
  shipped: 0,
  pendingQty: 100,
  price: 2.5,
  boxes: 10,
  ...over,
});

const order = (
  key: string,
  situation: string,
  milestone: string | null,
  data: Record<string, unknown> = {},
) => ({
  id: `order:${key}`,
  kind: "order",
  key,
  situation,
  milestone,
  top: 1104,
  supplierCode: "SNK-F1",
  supplierName: "YIWU SEAWAY",
  shipmentState: "none",
  computedAt: "2026-11-21T12:00:00.000Z",
  data: {
    chain: [
      {
        nunota: Number(key) - 1,
        top: 1100,
        pending: false,
        date: "01092026 00:00:00",
      },
      { nunota: Number(key), top: 1104, pending: situation === "in_progress" },
    ],
    items: [item(1)],
    currency: "USD - DOLAR",
    total: 250,
    incoterm: "FOB",
    orderedAt: "01092026 00:00:00",
    changedAt: "15102026 10:00:00",
    numnota: "4455",
    track: key,
    ...data,
  },
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  const store = getStore();
  await store.create("parties", {
    type: "supplier",
    name: "YIWU SEAWAY",
    taxId: null,
    active: true,
    sankhyaCode: "SNK-F1",
  } as never);
  await store.create("products", {
    name: "GARRAFA TERMICA",
    sankhyaCode: "SNK-P1",
    active: true,
  } as never);
  const rows = [
    order("2000", "in_progress", "production", {
      items: [item(1, { shipped: 40, pendingQty: 60 })],
      shipments: [3000],
    }),
    order("2010", "closed", null, {
      receipt: "Recebido",
      receivedAt: "20112026 00:00:00",
      items: [item(1, { shipped: 100, pendingQty: 0 })],
    }),
    order("2020", "interrupted", null),
    order("2030", "in_progress", "customs", { customsChannel: "Vermelho" }),
    order("2040", "awaiting_definition", null, { reason: "no_successor" }),
    order("2050", "in_progress", "production", {}),
    order("2060", "in_progress", "loading", {}),
    // Caminho antigo: a ponta é o 1103 e o embarque sai do 30 seguinte (2075).
    order("2070", "legacy_path", null, { shipments: [2075] }),
  ];
  // Fornecedor sem cadastro: pulado com o motivo.
  rows[5].supplierCode = "SEM-CADASTRO";
  for (const r of rows) await store.create("sankhya_projection", r as never);
  await store.create("sankhya_projection", {
    id: "shipment:3000",
    kind: "shipment",
    key: "3000",
    situation: "in_progress",
    milestone: "loading",
    top: 35,
    supplierCode: "SNK-F1",
    supplierName: "YIWU SEAWAY",
    shipmentState: null,
    computedAt: "2026-11-21T12:00:00.000Z",
    data: {
      // O mesmo item em duas linhas do 35 (Sankhya divide): soma 30 + 10.
      orders: [
        { order: 2000, seq: 1, qty: 30 },
        // Saiu do documento do meio da cadeia (1999 → 2000): vai para o 2000.
        { order: 1999, seq: 1, qty: 10 },
        { order: 2075, seq: 1, qty: 5 },
      ],
      statusShipping: "3",
      etd: "10112026 00:00:00",
      numnota: "0",
    },
  } as never);
  for (const key of [
    "2000",
    "2010",
    "2020",
    "2030",
    "2040",
    "2050",
    "2060",
    "2070",
  ])
    await store.create("sankhya_stage_rows", {
      dataset: "purchaseHeaders",
      rowKey: key,
      nunota: Number(key),
      row: { NUNOTA: Number(key), CODEMP: key === "2040" ? "77" : "3" },
    } as never);
  await store.create("parties", {
    type: "customer",
    name: "WELLMIX - SC",
    taxId: null,
    active: true,
    sankhyaCode: "EMP-3",
  } as never);
});

async function runAll(restart = false) {
  let p = await load.runOrdersLoadStep(admin, { restart: true });
  void restart;
  for (let i = 0; i < 20 && p.phase !== "done"; i++)
    p = await load.runOrdersLoadStep(admin);
  return p;
}

describe("regras da carga (funções puras)", () => {
  it("datas, moeda e canal", () => {
    expect(plan.sankhyaIso("31012027 00:00:00")).toBe(
      "2027-01-31T00:00:00.000Z",
    );
    expect(plan.sankhyaIso("")).toBeNull();
    expect(plan.sankhyaCurrency("RMB PARA US$")).toBe("USD");
    expect(plan.sankhyaCurrency("USD - DOLAR")).toBe("USD");
    expect(plan.channelPause("Vermelho")).toBe("red");
    expect(plan.channelPause("Cinza")).toBe("grey");
    expect(plan.channelPause("Amarelo")).toBeNull();
  });

  it("linhas do embarque: soma o item repetido e aceita lista ausente", () => {
    expect(
      plan.shipmentLines([
        { order: 1, seq: 5, qty: 816 },
        { order: 1, seq: 5, qty: 264 },
        { order: 2, seq: 1, qty: 10 },
      ]),
    ).toEqual([
      { order: 1, seq: 5, qty: 1080 },
      { order: 2, seq: 1, qty: 10 },
    ]);
    expect(plan.shipmentLines(null)).toEqual([]);
  });

  it("marcos feitos: os anteriores, sem os só do portal e sem a inspeção", () => {
    const done = plan.doneMilestones("production", null);
    expect(done.has("contract")).toBe(true);
    expect(done.has("down-payment")).toBe(true);
    expect(done.has("certification")).toBe(false);
    expect(done.has("samples")).toBe(false);
    expect(done.has("inspection")).toBe(false);
    expect(done.has("production")).toBe(false);
    expect(
      plan.doneMilestones("production", "Inspecionado").has("inspection"),
    ).toBe(true);
    // Carga já embarcada: inspeção e booking já passaram.
    const shipped = plan.doneMilestones("loading", null);
    expect(shipped.has("inspection")).toBe(true);
    expect(shipped.has("booking")).toBe(true);
    expect(shipped.has("samples")).toBe(true);
    expect(shipped.has("loading")).toBe(false);
  });
});

describe("carga dos pedidos do Sankhya", () => {
  it("só o administrador", async () => {
    await expect(load.runOrdersLoadStep(operator)).rejects.toThrow();
  });

  it("grava pedidos, itens e o embarque pelo ensaio", async () => {
    const p = await runAll();
    expect(p.phase).toBe("done");
    expect(p.created).toBe(7);
    expect(p.skipped.map((s) => s.key)).toEqual(["2050"]);
    const store = getStore();
    const o = (await store.get("orders", "snk-t2000"))!;
    expect(o.requestId).toBeNull();
    expect(o.sankhyaCode).toBe("2000");
    expect(o.sankhyaTrackId).toBe("2000");
    // O número do pedido é o do Sankhya (o TRACK_ID).
    expect(o.number).toBe(2000);
    // O pedido nunca fica em espera (aparece nas listas); a espera é só das pendências.
    expect(o.held ?? null).toBeNull();
    expect(o.erpNumber).toBe("4455");
    expect(o.fobCurrency).toBe("USD");
    expect(o.sankhyaSituation).toBe("in_progress");
    expect(o.sankhyaChain?.map((d) => d.top)).toEqual([1100, 1104]);
    const [it] = await store.list("order_items", { filter: { orderId: o.id } });
    expect(it.shippedQty).toBe(40);
    expect(it.pendingQty).toBe(60);
    expect(it.productId).toBeTruthy();
    // Em andamento: pendências, com os marcos anteriores feitos.
    const reqs = await store.list("requirements", {
      filter: { orderId: o.id },
    });
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.some((r) => r.status === "done")).toBe(true);
    expect(reqs.some((r) => r.status === "pending")).toBe(true);
    // Embarque 35 com o que o pedido leva.
    const c = (await store.get("containers", "snk-35-3000"))!;
    expect(c.status).toBe("shipped");
    expect(c.code).toBe("3000");
    const lines = await store.list("container_items", {
      filter: { containerId: c.id },
    });
    expect(
      lines
        .map((l) => [l.orderItemId, l.quantity, l.boxCount])
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual([
      ["snk-t2000-2000-1", 10, 1],
      ["snk-t2000-2000-1", 30, 3],
      ["snk-t2070-2070-1", 5, 1],
    ]);
  });

  it("encerrado, interrompido e aguardando definição sem pendências", async () => {
    const store = getStore();
    const closed = (await store.get("orders", "snk-t2010"))!;
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).toBe("2026-11-20T00:00:00.000Z");
    const [it] = await store.list("order_items", {
      filter: { orderId: closed.id },
    });
    expect(it.receivedQty).toBe(100);
    const interrupted = (await store.get("orders", "snk-t2020"))!;
    expect(interrupted.status).toBe("CLOSED");
    expect(interrupted.sankhyaSituation).toBe("interrupted");
    const waiting = (await store.get("orders", "snk-t2040"))!;
    expect(waiting.status).toBe("ORDER_CREATED");
    expect(waiting.sankhyaSituation).toBe("awaiting_definition");
    for (const id of ["snk-t2010", "snk-t2020", "snk-t2040"])
      expect(
        await store.list("requirements", { filter: { orderId: id } }),
      ).toEqual([]);
    // Empresa compradora que faltava ganha o cadastro.
    const [emp] = await store.list("parties", {
      filter: { sankhyaCode: "EMP-77" } as never,
    });
    expect(waiting.customerId).toBe(emp.id);
  });

  it("carga já embarcada: o pedido passa do Booking (passos do embarque validados)", async () => {
    const store = getStore();
    const o = (await store.get("orders", "snk-t2060"))!;
    const steps = await store.list("import_steps", {
      filter: { orderId: o.id },
    });
    expect(steps.find((s) => s.key === "booking")?.status).toBe("validated");
    expect(o.milestoneKey).not.toBe("booking");
    expect(o.milestoneKey).not.toBe("inspection");
  });

  it("canal vermelho pausa o pedido em andamento", async () => {
    const o = (await getStore().get("orders", "snk-t2030"))!;
    expect(o.pauseReason).toBe("channel_red");
    expect(o.pausedAt).toBeTruthy();
  });

  it("rodada em andamento (trava) faz a outra esperar", async () => {
    const { readSetting, writeSetting } =
      await import("@/lib/integrations/sankhya-settings");
    const key = load.ORDERS_LOAD_KEY;
    const saved = await readSetting<Record<string, unknown>>(key);
    await writeSetting(key, {
      ...saved,
      phase: "orders",
      done: 0,
      lockUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    const p = await load.runOrdersLoadStep(admin);
    expect(p.done).toBe(0);
    expect(p.phase).toBe("orders");
    await writeSetting(key, saved);
  });

  it("rodar de novo atualiza sem duplicar", async () => {
    const store = getStore();
    const before = (await store.list("orders")).length;
    const reqs = (
      await store.list("requirements", { filter: { orderId: "snk-t2000" } })
    ).length;
    const p = await runAll();
    expect(p.created).toBe(0);
    expect(p.updated).toBe(7);
    expect((await store.list("orders")).length).toBe(before);
    expect(
      (await store.list("requirements", { filter: { orderId: "snk-t2000" } }))
        .length,
    ).toBe(reqs);
    expect(
      (
        await store.list("container_items", {
          filter: { containerId: "snk-35-3000" },
        })
      ).length,
    ).toBe(3);
  });
});
