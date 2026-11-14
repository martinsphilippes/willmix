import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { DAY_MS, towerScenario } from "./helpers/tower-fixture";

/*
 * Indicadores prontos do Overview dos blocos (docs/RESUMOS.md e
 * docs/FLOW_MENU.md): os números da linha agregada (`kpi_snapshots`, chave
 * "flow") e a lista montada da contribuição de cada pedido
 * (`order_summaries.kpi.f`) têm de ser os mesmos do cálculo pelas tabelas,
 * também quando o tempo passa e depois de gravações.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const summary = await import("@/lib/services/order-summary");
const flow = await import("@/lib/services/flow");
const k = await import("@/lib/services/flow-kpis");
type User = import("@/lib/db").User;

/** O mesmo cálculo pelas tabelas (sem o marcador dos resumos). */
async function withoutSummaries<T>(fn: () => Promise<T>): Promise<T> {
  const store = getStore();
  const [marker] = await store.list("settings", {
    filter: { key: summary.SUMMARY_SETTING_KEY },
  });
  if (marker) await store.remove("settings", marker.id);
  try {
    return await fn();
  } finally {
    if (marker)
      await store.create("settings", {
        id: marker.id,
        key: marker.key,
        value: marker.value,
      });
  }
}

const NOW = new Date();
let admin: User;
let scenario: Awaited<ReturnType<typeof towerScenario>>;

beforeAll(async () => {
  scenario = await towerScenario(NOW);
  admin = scenario.admin;
  // Produto novo: um book em rascunho e uma solicitação aberta.
  const store = getStore();
  const lot = await store.create("booking_lots", {
    number: 901,
    status: "draft",
    supplierId: null,
    supplierHint: null,
    origin: null,
    bookingDate: null,
    sheetDate: null,
    fileName: "book.xlsx",
    fileDocumentId: null,
    sheetName: null,
    extraHeaders: null,
    itemCount: 1,
    businessType: null,
    closedAt: null,
    closedByUserId: null,
    analyzedAt: null,
    statusChangedAt: null,
    statusChangedByUserId: null,
    note: null,
    ownerUserId: null,
    createdByUserId: admin.id,
  } as never);
  await store.create("supplier_requests", {
    number: 902,
    status: "open",
    supplierId: "fornecedor-china",
    bookingItemId: "item-1",
    bookingLotId: lot.id,
    alternativeItemIds: null,
    item: { description: "Copo" },
    quantity: 100,
    unit: "un",
    needs: null,
    searchQuery: null,
    supplierCanDo: null,
    supplierPrice: null,
    supplierCurrency: null,
    supplierMoq: null,
    supplierLeadTimeDays: null,
    supplierNote: null,
    respondedAt: null,
    respondedByUserId: null,
    decidedAt: null,
    decidedByUserId: null,
    decisionNote: null,
    createdByUserId: admin.id,
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

const sortRows = (rows: import("@/lib/services/flow").OverviewEntity[]) =>
  [...rows].sort((a, b) =>
    `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`),
  );

/** Números e listas pelo resumo e pelas tabelas: iguais. */
async function expectSame(now: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const ready = (await k.readFlowKpis(now))!;
  expect(ready).not.toBeNull();
  const fromTables = await withoutSummaries(() =>
    flow.flowOverviewKpis(admin, now),
  );
  expect({ blocks: ready.blocks, steps: ready.steps }).toEqual(fromTables);
  for (const block of k.ENTITY_BLOCKS) {
    const rows = await flow.flowOverviewEntities(admin, block);
    const tableRows = await withoutSummaries(() =>
      flow.flowOverviewEntities(admin, block),
    );
    expect(sortRows(rows), block).toEqual(sortRows(tableRows));
  }
  return ready;
}

describe("indicadores prontos do Overview dos blocos", () => {
  it("sem resumos em uso, não há indicador (a tela soma pelas tabelas)", async () => {
    expect(await k.readFlowKpis(NOW)).toBeNull();
  });

  it("depois da reconstrução, os números e as listas são os das tabelas", async () => {
    await summary.rebuildOrderSummaries(NOW);
    const kpis = await expectSame(NOW);
    // O teste não compara telas vazias.
    expect(kpis.blocks.order.count).toBeGreaterThan(0);
    expect(kpis.blocks["new-product"].count).toBeGreaterThan(0);
    expect(
      Object.values(kpis.steps).reduce((a, b) => a + b, 0),
    ).toBeGreaterThan(0);
    const row = await getStore().get("kpi_snapshots", k.FLOW_KPI_KEY);
    expect(row).toBeTruthy();
    // A lista vem mesmo do resumo (contribuição de cada pedido em andamento).
    const flows = await k.readOrderFlows();
    expect(flows?.length).toBeGreaterThan(0);
    expect(flows!.some(({ f }) => Object.keys(f.s).length > 0)).toBe(true);
  });

  it("com o tempo: um prazo que vence muda o atraso sem gravação nenhuma", async () => {
    const store = getStore();
    const { b } = scenario.orders;
    const [stage] = await store.list("stages", {
      filter: { orderId: b.id, status: ["active", "blocked"] },
      limit: 1,
    });
    await store.update("stages", stage.id, {
      dueAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    });
    const before = await expectSame(NOW);
    expect(before.validUntil).toBeTruthy();
    // Um dia inteiro depois do prazo: atrasado.
    const later = new Date(NOW.getTime() + DAY_MS + 2 * 3_600_000);
    const after = await expectSame(later);
    const lateBefore = Object.values(before.blocks).reduce(
      (n, x) => n + x.late,
      0,
    );
    const lateAfter = Object.values(after.blocks).reduce(
      (n, x) => n + x.late,
      0,
    );
    expect(lateAfter).toBeGreaterThan(lateBefore);
    await expectSame(new Date(NOW.getTime() + 40 * DAY_MS));
  });

  it("depois de gravações, o indicador é refeito e continua igual", async () => {
    const store = getStore();
    const { c } = scenario.orders;
    const [stage] = await store.list("stages", {
      filter: { orderId: c.id, status: ["active", "blocked"] },
      limit: 1,
    });
    await store.update("stages", stage.id, { status: "done", percent: 100 });
    await scenario.placeOrder("Garrafa Flow");
    const [request] = await store.list("supplier_requests", {
      filter: { number: 902 },
    });
    await store.update("supplier_requests", request.id, {
      status: "answered",
    });
    await expectSame(NOW);
  });

  it("com o indicador válido, a leitura é a linha pronta, sem ler as tabelas", async () => {
    await expectSame(NOW);
    // O teste mexe no marcador dos resumos (settings): recalcula uma vez.
    await k.readFlowKpis(NOW);
    const store = getStore();
    const spy = vi.spyOn(store, "list");
    await k.readFlowKpis(NOW);
    const tables = spy.mock.calls.map((c) => c[0]);
    spy.mockRestore();
    for (const t of ["stages", "requirements", "orders", "import_steps"])
      expect(tables, t).not.toContain(t);
    const first = await k.readFlowKpis(NOW);
    const second = await k.readFlowKpis(NOW);
    expect(second?.computedAt).toBe(first?.computedAt);
  });
});
