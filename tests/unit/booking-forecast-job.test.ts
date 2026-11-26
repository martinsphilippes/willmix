import { beforeAll, describe, expect, it } from "vitest";
import { setTestFamily } from "./helpers/book-family";
import { withTempStore } from "./setup";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Job diário da previsão de preço do Sankhya nos books fechados (dono,
 * 24/11/2026: sem botão de refazer, "trazer em todos esses já fechados o
 * cálculo do Sankhya"): pede a previsão dos itens que não a têm (o retrato
 * antigo do portal, nunca previsto, ou quando o Sankhya não estava
 * disponível), um de cada vez, e grava a hora no book. O rascunho fica de
 * fora; o FOB/EXW não vai. O Sankhya aqui é um adaptador de teste.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lots = await import("@/lib/services/booking-lots");
const ncm = await import("@/lib/services/booking-ncm");
const job = await import("@/lib/services/booking-price-forecast");
const { productInput } = await import("@/lib/integrations/price-forecast");
type User = import("@/lib/db").User;
type Adapter = import("@/lib/integrations/price-forecast").PriceForecastAdapter;
type Query = import("@/lib/integrations/price-forecast").PriceForecastQuery;

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
const row = (sku: string, desc: string, price = "1.25") => [
  "Shenzhen Supplier A",
  "2026.10.13",
  sku,
  desc,
  "EXW",
  "USD",
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
    "forecast.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

async function bookWithNcm(rows: string[][]) {
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
function fakeSankhya() {
  const calls: Query[] = [];
  const adapter: Adapter = {
    mode: "api",
    async forecast(q) {
      calls.push(q);
      return {
        mode: "api",
        kind: "forecast",
        salePrice: 30,
        tablePrice: null,
        wholesalePrice: null,
        retailPrice: null,
        targetPrice: 34,
        cost: (q.price ?? 0) * 10,
        profitPercent: 12,
        goalPercent: 20,
        goalReached: false,
      };
    },
    async solve() {
      return { mode: "manual" };
    },
  };
  return { adapter, calls };
}

const itemsOf = (lotId: string) =>
  getStore().list("booking_items", { filter: { lotId } });

describe("job diário da previsão nos books fechados", () => {
  it("completa os itens sem a previsão do Sankhya, sem o FOB/EXW", async () => {
    const store = getStore();
    const closed = await bookWithNcm([
      row("FJ-1", "Glass jar 1L"),
      row("FJ-2", "Glass jar 2L", "2"),
    ]);
    // Fechar sem o Sankhya configurado (nos testes): a previsão fica
    // "Sankhya não configurado", e o job pede de novo.
    await setTestFamily(closed.id);
    await lots.closeBookingLot(admin, closed.id);
    const [first, second] = await itemsOf(closed.id);
    expect(first.analysis?.missing).toEqual(["manual"]);
    // Tentado há mais de um dia: o Sankhya fora não insiste a cada hora.
    await store.update("booking_items", first.id, {
      analysis: { ...first.analysis!, at: "2026-11-20T00:00:00.000Z" },
    });
    // O outro item com o retrato antigo do portal (antes de 24/11/2026).
    await store.update("booking_items", second.id, {
      analysis: { at: "2026-11-20T20:46:49.452Z", missing: [] } as never,
    });
    // Um rascunho não entra.
    const draft = await bookWithNcm([row("FJ-3", "Glass jar 3L")]);

    const { adapter, calls } = fakeSankhya();
    const run = await job.fillBookingForecasts({
      adapter,
      since: new Date().toISOString(),
    });
    expect(run).toEqual({ done: 2, left: 0, lots: 1 });
    expect(calls).toHaveLength(2);
    for (const q of calls) {
      expect(q).not.toHaveProperty("incoterm");
      expect(productInput(q).INCOTERM).toBeUndefined();
      // A rota padrão (dono, 25/11/2026): o book não tem pedido.
      expect(q.route).toBe("VIA_DEPOSITO");
    }
    for (const item of await itemsOf(closed.id))
      expect(item.analysis).toMatchObject({
        source: "price_forecast",
        salePriceBrl: 30,
        missing: [],
        byUserId: "system",
      });
    expect(
      (await store.get("booking_lots", closed.id))!.analyzedAt,
    ).toBeTruthy();
    const [draftItem] = await itemsOf(draft.id);
    expect(draftItem.analysis ?? null).toBeNull();

    // Nada mais a pedir: a próxima rodada não chama o Sankhya.
    const again = fakeSankhya();
    expect(await job.fillBookingForecasts({ adapter: again.adapter })).toEqual({
      done: 0,
      left: 0,
      lots: 0,
    });
    expect(again.calls).toHaveLength(0);
  });

  it("o erro recente não vai de novo na hora; sem tempo, fica na fila", async () => {
    const store = getStore();
    const lot = await bookWithNcm([row("FT-1", "Glass bowl small")]);
    await setTestFamily(lot.id);
    await lots.closeBookingLot(admin, lot.id);
    // Acabou de falhar (Sankhya fora): a rodada seguinte não insiste.
    const quiet = fakeSankhya();
    expect(
      await job.fillBookingForecasts({ adapter: quiet.adapter }),
    ).toMatchObject({ done: 0 });
    expect(quiet.calls).toHaveLength(0);
    // Nunca previsto: vai, mas sem tempo na rodada fica para a próxima.
    const [item] = await itemsOf(lot.id);
    await store.update("booking_items", item.id, { analysis: null });
    const { adapter, calls } = fakeSankhya();
    const run = await job.fillBookingForecasts({ adapter, budgetMs: 0 });
    expect(run.done).toBe(0);
    expect(run.left).toBeGreaterThanOrEqual(1);
    expect(calls).toHaveLength(0);
  });
});
