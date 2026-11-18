import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { orderFromRequest } from "./helpers/order";

/*
 * Embalagem e cubagem na Estratégia de compra (dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na Estratégia"): caixas
 * master, caixas inner e cubagem total pela quantidade em peças, com as
 * fontes da ficha completa; a conferência no servidor ao gerar o pedido; e a
 * estratégia parada por encomenda cancelada (não aprova, não gera, a
 * pendência some, nada gravado muda).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { PRODUCT_EXTRA_DEFAULTS, REQUEST_EXTRA_DEFAULTS } =
  await import("@/lib/db/schema");
const pack = await import("@/lib/strategy-packing");
const packing = await import("@/lib/services/strategy-packing");
const requests = await import("@/lib/services/requests");
const strategy = await import("@/lib/services/purchase-strategy");
const { closedDemandReason } = await import("@/lib/purchase-demand");
const { parseNumberInput } = await import("@/lib/number-input");
type User = import("@/lib/db").User;
type Request = import("@/lib/db").Request;
type PackingBasis = import("@/lib/strategy-packing").PackingBasis;

const basis = (
  perMaster: number | null,
  perInner: number | null,
  cbmPerMaster: number | null,
  cbmOtherBox: number | null = null,
): PackingBasis => ({ perMaster, perInner, cbmPerMaster, cbmOtherBox });

describe("conta de embalagem (pura)", () => {
  it("lousa mágica WBY425 (dados de produção): 2 programações de 263.160, 120 por master, sem inner, 0,031 m³", () => {
    const parcels = pack.packingParcels(526_320, [263_160, 263_160]);
    expect(parcels).toEqual([263_160, 263_160]);
    const totals = pack.packingTotals(parcels, basis(120, null, 0.031));
    expect(totals).toMatchObject({
      pieces: 526_320,
      masterBoxes: 4386,
      masterByParcel: [2193, 2193],
      masterIncomplete: [],
      innerBoxes: null,
      inner: "missing",
      cbm: 135.966,
      cbmState: "value",
    });
    expect(pack.packingSeal(totals)).toBe("4386|-|135.966");
  });

  it("com inner que fecha a master (boneca: 48 por master, 6 por inner): caixas para cima e a última incompleta", () => {
    const totals = pack.packingTotals([2000], basis(48, 6, 0.1202));
    expect(totals).toMatchObject({
      masterBoxes: 42,
      masterByParcel: [],
      masterIncomplete: [32],
      innerBoxes: 334,
      inner: "count",
      innerIncomplete: [2],
      cbm: 5.0484,
    });
    expect(totals.innerCheck).toEqual({ kind: "fits", boxes: 8 });
  });

  it("por programação (dono, 18/11/2026): 1.000 + 1.000 com 192 por master são 12 caixas; a quantidade mudada conta pelo total", () => {
    const planned = [1000, 1000];
    const scheduled = pack.packingTotals(
      pack.packingParcels(2000, planned),
      basis(192, null, null),
    );
    expect(scheduled.masterBoxes).toBe(12);
    expect(scheduled.masterByParcel).toEqual([6, 6]);
    expect(scheduled.masterIncomplete).toEqual([40, 40]);
    // Quantidade digitada diferente da programada: uma conta só.
    const typed = pack.packingTotals(
      pack.packingParcels(2001, planned),
      basis(192, null, null),
    );
    expect(typed.masterBoxes).toBe(11);
    expect(typed.masterByParcel).toEqual([]);
    // Sem programação (uma só): a quantidade.
    expect(pack.packingParcels(500, [500])).toEqual([500]);
    expect(pack.packingParcels(500, null)).toEqual([500]);
  });

  it("alterar a quantidade refaz caixas, inner e cubagem", () => {
    const b = basis(120, 24, 0.031);
    const at = (q: number) => pack.packingTotals([q], b);
    expect(at(120)).toMatchObject({
      masterBoxes: 1,
      innerBoxes: 5,
      cbm: 0.031,
    });
    expect(at(121)).toMatchObject({
      masterBoxes: 2,
      masterIncomplete: [1],
      innerBoxes: 6,
      innerIncomplete: [1],
      cbm: 0.062,
    });
    expect(at(1200)).toMatchObject({
      masterBoxes: 10,
      innerBoxes: 50,
      cbm: 0.31,
    });
  });

  it("sem caixa inner gravado (0) é zero; não informado é '—'", () => {
    expect(pack.packingTotals([480], basis(48, 0, 0.12))).toMatchObject({
      inner: "none",
      innerBoxes: 0,
    });
    expect(pack.packingTotals([480], basis(48, null, 0.12))).toMatchObject({
      inner: "missing",
      innerBoxes: null,
    });
    expect(
      pack.packingSeal(pack.packingTotals([480], basis(48, 0, 0.12))),
    ).toBe("10|0|1.2");
  });

  it("inner que não fecha a master (CJ 6 COPOS: master 8, inner 6) ou maior que ela: '—' com o aviso", () => {
    const rest = pack.packingTotals([800], basis(8, 6, 0.048));
    expect(rest).toMatchObject({ inner: "mismatch", innerBoxes: null });
    expect(rest.innerCheck).toEqual({ kind: "rest", rest: 2 });
    // A master e a cubagem seguem normais.
    expect(rest).toMatchObject({ masterBoxes: 100, cbm: 4.8 });
    const bigger = pack.packingTotals([800], basis(6, 8, null));
    expect(bigger).toMatchObject({ inner: "mismatch", innerBoxes: null });
    // Inner igual à master: conta (na prática, sem inner), com a observação.
    const same = pack.packingTotals([24], basis(12, 12, null));
    expect(same).toMatchObject({ inner: "count", innerBoxes: 2 });
    expect(same.innerCheck).toEqual({ kind: "same" });
  });

  it("dado de embalagem ausente: caixas e cubagem '—', nunca zero", () => {
    expect(pack.packingTotals([1000], basis(null, null, null))).toMatchObject({
      masterBoxes: null,
      innerBoxes: null,
      cbm: null,
      cbmState: "missing",
    });
    // CBM sem peças por master: não há caixas para multiplicar.
    expect(pack.packingTotals([1000], basis(null, null, 0.12))).toMatchObject({
      masterBoxes: null,
      cbm: null,
      cbmState: "noBoxes",
    });
    // CBM de outra caixa (a ficha atual é de 120 e a conta usa 48).
    expect(pack.packingTotals([480], basis(48, null, null, 120))).toMatchObject(
      {
        masterBoxes: 10,
        cbm: null,
        cbmState: "otherBox",
      },
    );
    expect(
      pack.packingSeal(pack.packingTotals([1000], basis(null, null, null))),
    ).toBe("-|-|-");
  });

  it("quantidade inválida não inventa caixas", () => {
    for (const q of [0, -5, Number.NaN])
      expect(pack.packingTotals([q], basis(48, 6, 0.12))).toMatchObject({
        masterBoxes: null,
        innerBoxes: null,
        cbm: null,
      });
  });

  it("peças digitadas com milhar ('526.320') são lidas como inteiro, na tela e no servidor", () => {
    expect(parseNumberInput("526.320", { int: true })).toBe(526_320);
    expect(parseNumberInput("526320", { int: true })).toBe(526_320);
    expect(parseNumberInput("1.000.000", { int: true })).toBe(1_000_000);
  });
});

describe("estratégia com a embalagem da ficha e a encomenda cancelada", () => {
  let admin: User;
  let buyer: User;
  let director: User;
  let joao: User;

  const product = (id: string, over: Record<string, unknown>) =>
    getStore().create("products", {
      ...PRODUCT_EXTRA_DEFAULTS,
      id,
      lineId: "linha-brinquedos",
      name: id,
      sku: id.toUpperCase(),
      specification: null,
      active: true,
      supplierId: "fornecedor-b",
      price: 0.48,
      currency: "USD",
      ...over,
    } as never);

  const request = (productId: string, over: Partial<Request> = {}) =>
    getStore().create("requests", {
      ...REQUEST_EXTRA_DEFAULTS,
      customerId: "cliente-joao",
      createdByUserId: admin.id,
      productId,
      productName: productId,
      description: productId,
      specification: null,
      quantity: 1000,
      unit: "un",
      deadline: null,
      status: "REQUESTED",
      orderId: null,
      sellPrice: null,
      sellCurrency: null,
      downPaymentAmount: null,
      notes: null,
      requestedForUserId: joao.id,
      ...over,
    } as never);

  /** Encomenda do João enviada para cotação (entra na Estratégia). */
  const demand = async (productId: string, quantity: number) => {
    const r = await requests.createRequest(joao, {
      customerId: "cliente-joao",
      productId,
      productName: productId,
      description: "Encomenda",
      quantity,
      unit: "un",
    });
    const { sent } = await strategy.sendToStrategy(admin, [r.id]);
    return sent[0] ?? r;
  };

  /** Escolha "fornecedor da última compra" e aprovação da Diretoria. */
  const approved = async (d: Request) => {
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "last_supplier",
      note: null,
    });
    await strategy.decideStrategy(director, decision.id, {
      approve: true,
      note: null,
    });
    return decision;
  };

  beforeAll(async () => {
    const { users } = await seedDemo();
    const by = (email: string) => users.find((u) => u.email === email)!;
    admin = by("admin@wellmix.com");
    buyer = by("operador@wellmix.com");
    joao = by("joao@lojista.com");
    director = by("diretoria@wellmix.com");
    // Compra anterior da panela (4 por master, inner 1, caixa 62 × 32 × 42).
    const previous = await demand("prod-panela", 2000);
    await orderFromRequest(admin, previous, {
      supplierId: "fornecedor-a",
      price: 3.5,
      currency: "USD",
    });
    await getStore().update("requests", previous.id, { status: "ORDERED" });
  });

  it("fontes da ficha: cadastro (lousa), sem embalagem (jarra), inner 0 e o CBM de outra caixa", async () => {
    await product("prod-lousa", {
      masterBoxQty: 120,
      innerBoxQty: null,
      cbm: 0.031,
    });
    await product("prod-sem-inner", {
      masterBoxQty: 48,
      innerBoxQty: 0,
      cbm: 0.12,
    });
    const lousa = await request("prod-lousa", {
      quantity: 526_320,
      schedule: {
        items: [
          { index: 1, quantity: 263_160, expectedAt: "2027-03-17" },
          { index: 2, quantity: 263_160, expectedAt: "2027-04-16" },
        ],
        firstDate: "2027-03-17",
        intervalDays: 30,
      } as never,
    });
    const jarra = await request("prod-jarra", { quantity: 300 });
    const semInner = await request("prod-sem-inner", { quantity: 480 });
    // A especificação diz 48 por caixa: o CBM do cadastro (caixa de 120) não vale.
    const outraCaixa = await request("prod-lousa", {
      quantity: 480,
      specification: "Unidades por caixa master: 48",
    });
    const map = await packing.demandPackings(admin, [
      lousa,
      jarra,
      semInner,
      outraCaixa,
    ]);
    expect(map.get(lousa.id)).toMatchObject({
      pieces: 526_320,
      parcels: [263_160, 263_160],
      facts: {
        basis: { perMaster: 120, perInner: null, cbmPerMaster: 0.031 },
        from: { perMaster: "current", cbm: "current" },
      },
      totals: { masterBoxes: 4386, cbm: 135.966, inner: "missing" },
    });
    expect(map.get(jarra.id)?.totals).toMatchObject({
      masterBoxes: null,
      innerBoxes: null,
      cbm: null,
    });
    expect(map.get(semInner.id)?.totals).toMatchObject({
      inner: "none",
      innerBoxes: 0,
      masterBoxes: 10,
    });
    expect(map.get(outraCaixa.id)).toMatchObject({
      facts: {
        basis: { perMaster: 48, cbmPerMaster: null, cbmOtherBox: 120 },
        from: { perMaster: "request" },
      },
      totals: { masterBoxes: 10, cbm: null, cbmState: "otherBox" },
    });
  });

  it("encomenda em caixas é convertida em peças; programação que não bate conta pelo total", async () => {
    const emCaixas = await request("prod-boneca", { quantity: 10, unit: "CX" });
    const semMaster = await request("prod-jarra", { quantity: 10, unit: "CX" });
    const torta = await request("prod-boneca", {
      quantity: 2000,
      schedule: {
        items: [
          { index: 1, quantity: 1000, expectedAt: "2027-03-17" },
          { index: 2, quantity: 900, expectedAt: "2027-04-16" },
        ],
        firstDate: "2027-03-17",
        intervalDays: 30,
      } as never,
    });
    const map = await packing.demandPackings(admin, [
      emCaixas,
      semMaster,
      torta,
    ]);
    expect(map.get(emCaixas.id)).toMatchObject({
      pieces: 480,
      totals: { masterBoxes: 10, innerBoxes: 80 },
    });
    expect(map.get(semMaster.id)).toMatchObject({
      pieces: null,
      totals: null,
      warnings: ["boxUnitNoMaster"],
    });
    expect(map.get(torta.id)).toMatchObject({
      parcels: [2000],
      warnings: ["scheduleMismatch"],
      totals: { masterBoxes: 42 },
    });
  });

  it("gerar o pedido: o servidor refaz a conta e recusa se a embalagem mudou desde que a tela abriu", async () => {
    const store = getStore();
    const d = await demand("prod-panela", 2000);
    const decision = await approved(d);
    const lines = packing.linePackings(
      [d],
      await packing.demandPackings(admin, [d]),
    );
    // Panela: 4 por master, inner 1, CBM das medidas da caixa (0,0833 m³).
    expect(lines[0]).toMatchObject({
      productId: "prod-panela",
      quantity: 2000,
      basis: { perMaster: 4, perInner: 1, cbmPerMaster: 0.0833 },
    });
    const seen = packing.lineSeal(lines[0], 2000);
    expect(seen).toBe("500|2000|41.65");
    // A embalagem muda depois que a tela abriu: nada é criado.
    await store.update("products", "prod-panela", { masterBoxQty: 5 });
    const input = {
      currency: "USD",
      leadTimeDays: 30,
      incoterm: "FOB" as const,
      lines: [{ productId: "prod-panela", quantity: 2000, unitPrice: 3.4 }],
      seals: { "prod-panela": seen },
    };
    await expect(
      strategy.orderFromStrategy(admin, decision.id, input),
    ).rejects.toThrow("strategy_packing_changed");
    expect(await store.get("requests", d.id)).toMatchObject({
      status: "REQUESTED",
      orderId: null,
    });
    expect((await store.get("purchase_decisions", decision.id))?.status).toBe(
      "approved",
    );
    // A tela recarregada mostra os totais novos; com eles, o pedido sai.
    await store.update("products", "prod-panela", { masterBoxQty: 4 });
    const order = await strategy.orderFromStrategy(admin, decision.id, input);
    expect(order.supplierId).toBe("fornecedor-a");
    const logs = await store.list("audit_log", {
      filter: { entityId: decision.id },
    });
    expect(
      logs.find((l) => l.action === "purchase_strategy.order")?.summary,
    ).toContain("500 caixas master");
  });

  it("encomenda cancelada depois da aprovação: não gera o pedido, a pendência some e nada gravado muda", async () => {
    const store = getStore();
    const d = await demand("prod-panela", 1200);
    const decision = await approved(d);
    const before = await strategy.strategyTaskDrafts([]);
    expect(
      before.some(
        (x) =>
          x.kind === "purchase_strategy_order" && x.link.endsWith(decision.id),
      ),
    ).toBe(true);
    // Excluída em Encomendas (cancelada), como a nº 5 de produção.
    await requests.deleteRequests(admin, [d.id]);
    expect(
      closedDemandReason(decision, await store.get("requests", d.id)),
    ).toBe("cancelled");
    await expect(
      strategy.orderFromStrategy(admin, decision.id, {
        currency: "USD",
        leadTimeDays: null,
        incoterm: null,
        lines: [{ productId: "prod-panela", quantity: 1200, unitPrice: 3.5 }],
      }),
    ).rejects.toThrow("strategy_demand_closed");
    // A encomenda segue cancelada, sem pedido e sem reserva para o cliente.
    expect(await store.get("requests", d.id)).toMatchObject({
      status: "CANCELLED",
      orderId: null,
    });
    const reservations = await store.list("stock_reservations", {
      filter: { requestId: d.id },
    });
    expect(reservations).toHaveLength(0);
    expect(await store.get("purchase_decisions", decision.id)).toMatchObject({
      status: "approved",
      orderId: null,
    });
    // A pendência "Gerar pedido" some.
    const after = await strategy.strategyTaskDrafts([]);
    expect(
      after.some(
        (x) =>
          x.kind === "purchase_strategy_order" && x.link.endsWith(decision.id),
      ),
    ).toBe(false);
  });

  it("encomenda cancelada antes da aprovação: a Diretoria não aprova, mas pode recusar", async () => {
    const d = await demand("prod-panela", 800);
    const decision = await strategy.chooseStrategy(buyer, {
      demandIds: [d.id],
      choice: "last_supplier",
      note: null,
    });
    await requests.deleteRequests(admin, [d.id]);
    await expect(
      strategy.decideStrategy(director, decision.id, {
        approve: true,
        note: null,
      }),
    ).rejects.toThrow("strategy_demand_closed");
    const rejected = await strategy.decideStrategy(director, decision.id, {
      approve: false,
      note: "Encomenda cancelada",
    });
    expect(rejected.status).toBe("rejected");
  });

  it("encomenda já em outro pedido também para a estratégia", () => {
    expect(
      closedDemandReason(
        { orderId: null },
        { status: "ORDERED", orderId: "outro-pedido" },
      ),
    ).toBe("ordered");
    expect(
      closedDemandReason(
        { orderId: "este" },
        { status: "ORDERED", orderId: "este" },
      ),
    ).toBeNull();
    expect(closedDemandReason({ orderId: null }, undefined)).toBe("missing");
    expect(
      closedDemandReason(
        { orderId: null },
        { status: "REQUESTED", orderId: null },
      ),
    ).toBeNull();
  });
});
