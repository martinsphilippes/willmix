import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Custo dos itens do book pela cotação V2 do Sankhya (dono, 24/11/2026;
 * docs/BOOKING.md, "Custo no Sankhya"): cada item vai com os dados dele, um
 * de cada vez; falta de dado não chama o Sankhya; erro do Sankhya fica no
 * item; sem o Sankhya nada é gravado. O Sankhya aqui é um adaptador de
 * teste (o de verdade não roda nos testes).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const ncm = await import("@/lib/services/booking-ncm");
const cost = await import("@/lib/services/booking-cost");
const pure = await import("@/lib/booking-cost");
type User = import("@/lib/db").User;
type BookingItem = import("@/lib/db").BookingItem;
type Adapter = import("@/lib/integrations/price-forecast").PriceForecastAdapter;
type Query = import("@/lib/integrations/price-forecast").PriceForecastQuery;
type Answer = import("@/lib/integrations/price-forecast").PriceForecastAnswer;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

const HEADER = [
  "SUPPLIER NAME",
  "DATE",
  "SKU",
  "DESCRIPTION",
  "FOB/EXW",
  "CONI US $/RMB",
  "PRICE",
  "QTY/BOX",
  "QTY/INNER",
  "N.W./PC",
  "G.W./PC",
  "CBM",
  "SIZE(CM) LENGTH",
  "SIZE(CM) WIDTH",
  "SIZE(CM) HEIGHT",
  "CAPACITY(ML)",
  "PACKAGE",
  "MATERIAL",
  "MOQ",
];
const row = (sku: string, desc: string, price = "1.25", currency = "USD") => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  desc,
  "FOB",
  currency,
  price,
  "48",
  "12",
  "0.3",
  "0.35",
  "0.12",
  "10",
  "8",
  "20",
  "350",
  "color box",
  "glass",
  "1000",
];
const file = (rows: string[][]) =>
  new File(
    [xlsxBytes([{ name: "BOOKING", cells: [HEADER, ...rows] }])],
    "cost.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

/** Um book pronto para fechar (NCM em todos os itens). */
async function readyLot(rows: string[][]) {
  const lot = await lots.createBookingLotFromSheet(admin, file(rows));
  const items = await getStore().list("booking_items", {
    filter: { lotId: lot.id },
  });
  await ncm.setBookingItemsNcm(
    admin,
    items.map((i) => i.id),
    "7013.37.00",
  );
  return lot;
}

/** Sankhya de teste: responde pelo preço do item e guarda as consultas. */
function fakeSankhya(
  answer: (q: Query) => Answer | Promise<Answer> = (q) => ({
    mode: "api",
    kind: "forecast",
    salePrice: 30,
    tablePrice: null,
    wholesalePrice: null,
    retailPrice: null,
    targetPrice: 28.5,
    cost: (q.price ?? 0) * 10,
    profitPercent: 18.25,
    goalPercent: 22,
    status: "FRETE_PENDENTE",
    goalReached: false,
  }),
) {
  const calls: Query[] = [];
  const adapter: Adapter = {
    mode: "api",
    async forecast(q) {
      calls.push(q);
      return await answer(q);
    },
    async solve() {
      return { mode: "manual" };
    },
  };
  return { adapter, calls };
}

const itemsOf = (lotId: string) =>
  getStore().list("booking_items", { filter: { lotId } });

describe("regras puras", () => {
  const base = {
    ncm: "7013.37.00",
    price: 1.25,
    currency: "USD" as const,
    masterCartonQty: 48,
    cbmPerCarton: 0.12,
    netWeightPcKg: 0.3,
    grossWeightPcKg: 0.35,
  };

  it("leva os dados do item e diz o que falta (o Real não vai)", () => {
    expect(pure.bookingCostInputs(base)).toEqual({
      sent: {
        ncm: "70133700",
        price: 1.25,
        currency: "USD",
        pcsPerCarton: 48,
        cbmPerCarton: 0.12,
        netWeightPcKg: 0.3,
        grossWeightPcKg: 0.35,
      },
      missing: [],
    });
    expect(
      pure.bookingCostInputs({
        ...base,
        ncm: "7013",
        currency: "BRL",
        grossWeightPcKg: null,
      }).missing,
    ).toEqual(["ncm", "currency", "grossWeight"]);
    expect(pure.sankhyaCurrency("cny")).toBe("RMB");
    expect(pure.sankhyaCurrency("EUR")).toBe("EUR");
  });

  it("o sinal vem da resposta do Sankhya", () => {
    expect(pure.costVerdict(true, 5)).toBe("viable");
    expect(pure.costVerdict(false, 12)).toBe("below");
    expect(pure.costVerdict(false, 0)).toBe("loss");
    expect(pure.costVerdict(null, -3)).toBe("loss");
    expect(pure.costVerdict(null, 25, 22)).toBe("viable");
    expect(pure.costVerdict(null, null)).toBeNull();
    expect(pure.costVerdict(false, null)).toBe("below");
  });

  it("o retrato antigo do portal não conta como custo do Sankhya", () => {
    expect(
      pure.bookingCostOf({ sankhyaCost: { costBrl: 10, verdict: "below" } }),
    ).toBeNull();
    expect(pure.bookingCostValue({ sankhyaCost: null })).toBeNull();
    const snap = {
      source: "sankhya",
      at: "2026-11-24T10:00:00.000Z",
      costBrl: 12.5,
      missing: [],
      error: null,
    };
    expect(pure.bookingCostValue({ sankhyaCost: snap })).toBe(12.5);
    expect(pure.bookingCostPending({ sankhyaCost: snap })).toBe(false);
    expect(
      pure.bookingCostPending(
        { sankhyaCost: snap },
        "2026-11-24T11:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      pure.bookingCostCounts(
        [
          { sankhyaCost: snap },
          { sankhyaCost: { ...snap, error: "NCM inválido" } },
          { sankhyaCost: { ...snap, missing: ["ncm"] } },
          { sankhyaCost: null },
        ],
        null,
      ),
    ).toEqual({ costed: 1, missing: 1, failed: 1, pending: 1 });
    const now = Date.parse("2026-11-24T10:00:00.000Z");
    expect(pure.bookingCostRunning("2026-11-24T09:58:00.000Z", now)).toBe(true);
    expect(pure.bookingCostRunning("2026-11-24T09:50:00.000Z", now)).toBe(
      false,
    );
    expect(pure.bookingCostRunning(null, now)).toBe(false);
  });
});

describe("cálculo no Sankhya", () => {
  it("fechar pede o custo de cada item, com os dados do próprio item", async () => {
    const lot = await readyLot([
      row("GL-1", "Glass cup 350ml", "1.25"),
      row("GL-2", "Glass cup 500ml", "2", "RMB"),
    ]);
    const { adapter, calls } = fakeSankhya();
    const closed = await lots.closeBookingLot(admin, lot.id, { adapter });
    expect(closed.status).toBe("closed");
    expect(calls).toHaveLength(2);
    // Sem o código do Sankhya, sem quantidade e sem cliente: a oferta do book.
    expect(calls[0]).toMatchObject({
      sankhyaCode: null,
      quantity: null,
      containers: null,
      customerId: null,
      ncm: "70133700",
      price: 1.25,
      currency: "USD",
      masterBoxQty: 48,
      cbmPerCarton: 0.12,
      netWeightKg: 0.3,
      grossWeightKg: 0.35,
    });
    expect(calls[0].dataRef).toMatch(/^\d{8}$/);
    expect(calls[1]).toMatchObject({ price: 2, currency: "RMB" });
    const lotNow = (await getStore().get("booking_lots", lot.id))!;
    expect(lotNow.sankhyaCostAt).toBeTruthy();
    const items = await itemsOf(lot.id);
    for (const item of items) {
      expect(item.sankhyaCost).toMatchObject({
        source: "sankhya",
        byUserId: admin.id,
        status: "FRETE_PENDENTE",
        salePriceBrl: 30,
        targetPriceBrl: 28.5,
        profitPct: 18.25,
        goalPct: 22,
        goalReached: false,
        verdict: "below",
        missing: [],
        error: null,
      });
      // O retrato antigo do portal não é gravado.
      expect(item.analysis ?? null).toBeNull();
    }
    const gl1 = items.find((i) => i.factoryItemCode === "GL-1")!;
    expect(pure.bookingCostValue(gl1)).toBe(12.5);
    // A lista de Books conta os sinais pelo custo do Sankhya.
    const entry = (await lots.listBookingLots(admin))!.find(
      (e) => e.lot.id === lot.id,
    )!;
    expect(entry.signals).toEqual({ viable: 0, below: 2, loss: 0, missing: 0 });
  });

  it("erro do Sankhya fica no item; sem o Sankhya nada é gravado", async () => {
    const lot = await readyLot([row("ER-1", "Glass jar")]);
    const failing = fakeSankhya(() => ({
      mode: "api",
      kind: "error",
      message: "NCM sem tributação cadastrada",
    }));
    await lots.closeBookingLot(admin, lot.id, { adapter: failing.adapter });
    const [item] = await itemsOf(lot.id);
    expect(item.sankhyaCost).toMatchObject({
      source: "sankhya",
      costBrl: null,
      verdict: null,
      error: "NCM sem tributação cadastrada",
    });

    // "Calcular no Sankhya" sem o Sankhya configurado: nada muda.
    const off = fakeSankhya(() => ({ mode: "manual" }));
    const run = await lots.calculateBookingLotCosts(admin, lot.id, {
      adapter: off.adapter,
    });
    expect(run).toMatchObject({ done: 0, manual: true });
    expect((await itemsOf(lot.id))[0].sankhyaCost?.error).toBe(
      "NCM sem tributação cadastrada",
    );
  });

  it("item sem algum dado não vai ao Sankhya", async () => {
    const lot = await readyLot([row("NB-1", "Glass bowl")]);
    await lots.closeBookingLot(admin, lot.id, {
      adapter: fakeSankhya().adapter,
    });
    const [item] = await itemsOf(lot.id);
    // Moeda trocada para o Real depois (não vai à função): falta a moeda.
    await getStore().update("booking_items", item.id, { currency: "BRL" });
    const { adapter, calls } = fakeSankhya();
    await lots.calculateBookingLotCosts(admin, lot.id, { adapter });
    expect(calls).toHaveLength(0);
    expect((await itemsOf(lot.id))[0].sankhyaCost).toMatchObject({
      missing: ["currency"],
      costBrl: null,
      error: null,
    });
  });

  it("um pedido mais novo do book faz o anterior parar; o prazo deixa na fila", async () => {
    const lot = await readyLot([
      row("Q-1", "Glass plate 20cm"),
      row("Q-2", "Glass plate 25cm"),
      row("Q-3", "Glass plate 30cm"),
    ]);
    const store = getStore();
    await lots.closeBookingLot(admin, lot.id, {
      adapter: fakeSankhya(() => ({ mode: "manual" })).adapter,
    });
    const items = await itemsOf(lot.id);
    expect(items.every((i) => !i.sankhyaCost)).toBe(true);

    // Prazo zero: nada é calculado agora; fica na fila (fora de uma
    // requisição não agenda o resto).
    const queued = await cost.requestLotCosts(lot.id, admin.id, {
      adapter: fakeSankhya().adapter,
      budgetMs: 0,
    });
    expect(queued).toEqual({ done: 0, left: 3, manual: false });

    // Durante a rodada, outro pedido de cálculo começa: esta para.
    const since = "2026-11-24T10:00:00.000Z";
    await store.update("booking_lots", lot.id, { sankhyaCostAt: since });
    let first = true;
    const racing = fakeSankhya(async (q): Promise<Answer> => {
      if (first) {
        first = false;
        await store.update("booking_lots", lot.id, {
          sankhyaCostAt: "2026-11-24T10:05:00.000Z",
        });
      }
      return {
        mode: "api",
        kind: "forecast",
        salePrice: null,
        tablePrice: null,
        wholesalePrice: null,
        retailPrice: null,
        targetPrice: null,
        cost: q.price ?? null,
        profitPercent: null,
        goalPercent: null,
      };
    });
    const run = await cost.calculateBookingCosts(items as BookingItem[], {
      byUserId: admin.id,
      since,
      lotId: lot.id,
      adapter: racing.adapter,
      budgetMs: 10_000,
    });
    expect(racing.calls).toHaveLength(1);
    expect(run).toEqual({ done: 1, left: 2, manual: false });
  });

  it("trocar o NCM de um item fechado pede de novo só o custo dele", async () => {
    const lot = await readyLot([
      row("N-1", "Glass vase small"),
      row("N-2", "Glass vase big"),
    ]);
    await lots.closeBookingLot(admin, lot.id, {
      adapter: fakeSankhya().adapter,
    });
    const before = await itemsOf(lot.id);
    const target = before.find((i) => i.factoryItemCode === "N-1")!;
    const other = before.find((i) => i.factoryItemCode === "N-2")!;
    // Sem o Sankhya nos testes: o NCM troca e o custo antigo fica.
    const res = await ncm.setBookingItemsNcm(admin, [target.id], "70139900");
    expect(res.reanalyzed).toBe(0);
    // Com o Sankhya: só o item trocado vai de novo, e o book não muda a data.
    const lotBefore = (await getStore().get("booking_lots", lot.id))!;
    const { adapter, calls } = fakeSankhya();
    const run = await cost.requestLotCosts(lot.id, admin.id, {
      only: [target.id],
      adapter,
    });
    expect(run.done).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].ncm).toBe("70139900");
    const lotAfter = (await getStore().get("booking_lots", lot.id))!;
    expect(lotAfter.sankhyaCostAt).toBe(lotBefore.sankhyaCostAt);
    const after = await itemsOf(lot.id);
    expect(after.find((i) => i.id === other.id)!.sankhyaCost!.at).toBe(
      other.sankhyaCost!.at,
    );
  });
});
