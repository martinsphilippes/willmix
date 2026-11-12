import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { DAY_MS, towerScenario } from "./helpers/tower-fixture";

/*
 * Indicadores prontos da Control Tower (docs/RESUMOS.md): os números lidos da
 * linha agregada têm de ser os mesmos da tela calculada inteira (quadrados,
 * etapas, visões gerais, exceções e totais), também quando o tempo passa (um
 * prazo vence) e depois de gravações. A lista do escolhido é a mesma.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { loadTowerBoard, BOARD_CARDS } =
  await import("@/lib/services/tower-board");
const { loadControlTower, loadTowerTotals } =
  await import("@/lib/services/control-tower");
const { buildTowerStages } = await import("@/lib/tower-stages");
const summary = await import("@/lib/services/order-summary");
const k = await import("@/lib/services/tower-kpis");
const { pendingTasksFor } = await import("@/lib/services/tasks");
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

/** Pendências da Wellmix (admin e operador) pelo resumo e pelas tabelas: iguais. */
async function expectSameTasks() {
  const users = await getStore().list("users");
  const operator = users.find((u) => u.role === "operator") as User;
  for (const user of [scenario.admin, operator].filter(Boolean)) {
    const fromSummary = await pendingTasksFor(user);
    const fromTables = await withoutSummaries(() => pendingTasksFor(user));
    expect(fromSummary, user.role).toEqual(fromTables);
  }
}
type BoardCardKey = import("@/lib/services/tower-board").BoardCardKey;

const NOW = new Date();
let scenario: Awaited<ReturnType<typeof towerScenario>>;

beforeAll(async () => {
  scenario = await towerScenario(NOW);
});

/** A tela inteira (todas as linhas), pelo resumo, no instante dado. */
async function fullTower(now: Date) {
  const [board, data, totals] = await Promise.all([
    loadTowerBoard({ finance: true, now }),
    loadControlTower(now.getTime()),
    loadTowerTotals(),
  ]);
  return { board, data, totals };
}

/** Os números da tela inteira e os do indicador pronto são iguais. */
async function expectSame(now: Date) {
  const kpis = (await k.readTowerKpis(now))!;
  expect(kpis).not.toBeNull();
  const full = await fullTower(now);
  for (const card of full.board.cards) {
    const got = kpis.cards[card.key];
    expect(
      { key: card.key, count: got.count, overdue: got.overdue, risk: got.risk },
      card.key,
    ).toEqual({
      key: card.key,
      count: card.count,
      overdue: card.overdue,
      risk: card.risk,
    });
    if (card.value === null) expect(got.value, card.key).toBeNull();
    else expect(got.value, card.key).toBeCloseTo(card.value, 6);
  }
  // Etapas: as mesmas contagens (a soma dos passos fecha com as linhas).
  const strip = (stages: ReturnType<typeof buildTowerStages>) =>
    stages.map((s) => ({
      key: s.key,
      count: s.count,
      overdue: s.overdue,
      risk: s.risk,
      alongside: s.alongside,
      single: s.single,
      groups: s.groups.map((g) => [g.key, g.count, g.overdue, g.risk]),
    }));
  expect(strip(buildTowerStages(k.boardFromKpis(kpis, true), now))).toEqual(
    strip(buildTowerStages(full.board, now)),
  );
  for (const [key, rows] of Object.entries(full.data.buckets))
    expect(kpis.buckets[key as keyof typeof kpis.buckets], key).toBe(
      rows.length,
    );
  expect(kpis.exceptions).toBe(full.data.exceptions.length);
  expect(kpis.totals).toEqual(full.totals);
  return { kpis, full };
}

describe("indicadores prontos da Control Tower", () => {
  it("sem resumos em uso, não há indicador (a tela segue pelo caminho completo)", async () => {
    expect(await k.readTowerKpis(NOW)).toBeNull();
  });

  it("depois da reconstrução, os números são os da tela inteira", async () => {
    await summary.rebuildOrderSummaries(NOW);
    const { kpis, full } = await expectSame(NOW);
    await expectSameTasks();
    expect(
      (await pendingTasksFor(scenario.admin)).some(
        (t) => t.kind === "requirement",
      ),
    ).toBe(true);
    // O teste não compara telas vazias.
    expect(kpis.cards.ordPrepSankhya.count).toBeGreaterThan(0);
    expect(kpis.cards.parProduction.count).toBeGreaterThan(0);
    expect(kpis.cards.probOverdue.count).toBeGreaterThan(0);
    expect(kpis.cards.probPenalty.count).toBeGreaterThan(0);
    expect(kpis.cards.ordClosedMonth.count).toBeGreaterThan(0);
    expect(kpis.exceptions).toBeGreaterThan(0);
    expect(full.totals.sold).toBeGreaterThan(0);
    // A linha agregada fica gravada, com até quando vale.
    const row = await getStore().get("kpi_snapshots", k.TOWER_KPI_KEY);
    expect(row?.validUntil).toBeTruthy();
  });

  it("a lista do quadrado, da visão e das exceções é a mesma da tela inteira", async () => {
    const full = await fullTower(NOW);
    for (const card of full.board.cards) {
      if (card.href || card.rows.length === 0) continue;
      const list = await k.towerCardRows(card.key as BoardCardKey, true, NOW);
      expect(list.rows, card.key).toEqual(card.rows);
      expect(list.total, card.key).toBe(card.rows.length);
    }
    for (const [key, rows] of Object.entries(full.data.buckets)) {
      if (rows.length === 0) continue;
      const list = await k.towerBucketRows(
        key as Parameters<typeof k.towerBucketRows>[0],
        NOW,
      );
      expect(list.rows, key).toEqual(rows);
      expect(list.total, key).toBe(rows.length);
    }
    expect(await k.towerExceptionRows(NOW)).toEqual(full.data.exceptions);
  });

  it("com o tempo: um prazo que vence muda os números sem gravação nenhuma", async () => {
    const store = getStore();
    // Pedido de compra com prazo daqui a 1 hora: em risco agora, atrasado depois.
    const { b } = scenario.orders;
    await store.update("orders", b.id, { flow: "supplier_request" });
    const [stage] = await store.list("stages", {
      filter: { orderId: b.id, status: ["active", "blocked"] },
      limit: 1,
    });
    await store.update("stages", stage.id, {
      dueAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    });
    const before = (await expectSame(NOW)).kpis;
    expect(Date.parse(before.validUntil!)).toBeLessThanOrEqual(
      NOW.getTime() + 3_600_000 + 1,
    );
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    const after = (await expectSame(later)).kpis;
    expect(after.cards.probOverdue.count).toBe(
      before.cards.probOverdue.count + 1,
    );
    // Dias depois (virada do dia e do mês, parcelas, produção): continua igual.
    await expectSame(new Date(NOW.getTime() + 40 * DAY_MS));
  });

  it("depois de gravações, o indicador é refeito e continua igual", async () => {
    const store = getStore();
    const { c } = scenario.orders;
    const [stage] = await store.list("stages", {
      filter: { orderId: c.id, status: ["active", "blocked"] },
      limit: 1,
    });
    await store.update("stages", stage.id, { status: "blocked" });
    await store.create("penalties", {
      orderId: c.id,
      reason: "atraso",
      amount: 50,
      currency: "USD",
      status: "open",
    } as never);
    await store.update("parties", "cliente-joao", { name: "Loja do João 3" });
    const fresh = await scenario.placeOrder("Garrafa F");
    const { kpis } = await expectSame(NOW);
    await expectSameTasks();
    // Bloqueado (pedido fora do portal): entra nas visões "Problemas".
    const problems = await k.towerBucketRows("problems", NOW);
    expect(problems.rows.some((r) => r.id === c.id)).toBe(true);
    expect(kpis.buckets.problems).toBe(problems.total);
    const active = await k.towerBucketRows("active", NOW);
    expect(active.rows.some((r) => r.id === fresh.id)).toBe(true);
    expect(active.rows.find((r) => r.id === fresh.id)?.customer).toBe(
      "Loja do João 3",
    );
  });

  it("tabela que não é de pedido (revisão) também refaz o indicador", async () => {
    const store = getStore();
    const before = (await k.readTowerKpis(NOW))!;
    await store.create("review_items", {
      orderId: null,
      entity: "product",
      entityId: "x",
      rule: "sheet.missing",
      problem: "Falta a ficha",
      expected: null,
      found: null,
      responsibleRole: "operator",
      action: null,
      link: null,
      status: "open",
    } as never);
    const after = (await expectSame(NOW)).kpis;
    expect(after.cards.probReviews.count).toBe(
      before.cards.probReviews.count + 1,
    );
    expect(after.exceptions).toBe(before.exceptions + 1);
  });

  it("com o indicador válido, a leitura é direta: só a linha agregada", async () => {
    await k.readTowerKpis(NOW);
    const store = getStore();
    const read: string[] = [];
    const list = store.list.bind(store);
    const get = store.get.bind(store);
    const spies = [
      vi.spyOn(store, "list").mockImplementation(((
        table: string,
        o?: object,
      ) => {
        read.push(`list:${table}`);
        return list(table as never, o as never);
      }) as typeof store.list),
      vi.spyOn(store, "get").mockImplementation(((
        table: string,
        id: string,
      ) => {
        read.push(`get:${table}`);
        return get(table as never, id);
      }) as typeof store.get),
    ];
    try {
      const kpis = await k.readTowerKpis(NOW);
      expect(kpis).not.toBeNull();
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(read.sort()).toEqual(["get:kpi_snapshots", "list:settings"]);
  });

  it("os quadrados do indicador são os da tela, na mesma ordem", async () => {
    const kpis = (await k.readTowerKpis(NOW))!;
    expect(k.boardFromKpis(kpis, true).cards.map((c) => c.key)).toEqual(
      BOARD_CARDS.map((c) => c.key),
    );
    const noMoney = k.boardFromKpis(kpis, false);
    expect(noMoney.cards.every((c) => c.value === null)).toBe(true);
    expect(noMoney.cards.map((c) => c.key)).not.toContain("parReceivable");
  });
});
