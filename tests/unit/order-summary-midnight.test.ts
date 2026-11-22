import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Virada do dia em Brasília (docs/RESUMOS.md). Entre 00:00 e 03:00 UTC a data
 * UTC já é a de amanhã; às 03:00 UTC vira o dia em Brasília. O dia das
 * parcelas é sempre o de Brasília, e os quadros da Control Tower montados num
 * "agora" dado dão o mesmo pelo resumo e pelas tabelas, mesmo com o relógio
 * já no dia seguinte. Antes, o caminho das tabelas pegava a situação das
 * parcelas pelo relógio (vencida) e o do resumo pelo "agora" (a vencer): o
 * teste de order-summary.test.ts falhava quando a rodada passava das 03:00 UTC.
 */
// 23:50 de 21/11 em Brasília, já 22/11 em UTC. O relógio anda a partir daqui.
vi.useFakeTimers({
  now: new Date("2026-11-22T02:50:00Z"),
  toFake: ["Date"],
  shouldAdvanceTime: true,
});
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const { loadTowerBoard } = await import("@/lib/services/tower-board");
const summary = await import("@/lib/services/order-summary");
const { listPayables } = await import("@/lib/services/supplier-terms");
const { brazilDay } = await import("@/lib/supplier-terms");
type User = import("@/lib/db").User;
type TowerBoard = import("@/lib/services/tower-board").TowerBoard;

let admin: User;
let joao: User;
const NOW = new Date();
const DAY_IN_BRAZIL = "2026-11-21";
const NEXT_DAY_IN_BRAZIL = "2026-11-22";
/** 00:00:30 de 22/11 em Brasília. */
const AFTER_MIDNIGHT_IN_BRAZIL = new Date("2026-11-22T03:00:30Z");

async function placeOrder(name: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: "Virada do dia",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
  return orderFromRequest(admin, request, { sellPrice: 1000 });
}

/** A leitura pelo caminho antigo (sem o marcador da reconstrução). */
async function direct<T>(read: () => Promise<T>): Promise<T> {
  const store = getStore();
  const [marker] = await store.list("settings", {
    filter: { key: summary.SUMMARY_SETTING_KEY },
  });
  if (marker) await store.remove("settings", marker.id);
  try {
    return await read();
  } finally {
    if (marker)
      await store.create("settings", {
        id: marker.id,
        key: marker.key,
        value: marker.value,
      });
  }
}

const count = (board: TowerBoard, key: string) =>
  board.cards.find((c) => c.key === key)?.count ?? 0;

/** Parcelas que vencem no dia do pedido (a condição do fornecedor da demonstração). */
async function dueOnOrderDay(today?: string) {
  const payables = await listPayables(today ? { today } : {});
  return payables
    .filter((p) => p.order.status !== "CANCELLED")
    .flatMap((p) => p.schedule.installments)
    .filter((i) => i.base === "order_created" && i.days === 0);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  await placeOrder("Jarra A");
  await placeOrder("Copo B");
  const { flushMilestoneSync } =
    await import("@/lib/services/order-milestones");
  await flushMilestoneSync();
});

afterAll(() => {
  vi.useRealTimers();
});

describe("virada do dia em Brasília", () => {
  it("às 02:50 UTC o dia é o de Brasília: a parcela que vence hoje está a vencer", async () => {
    expect(NOW.toISOString().slice(0, 10)).toBe(NEXT_DAY_IN_BRAZIL);
    expect(brazilDay(NOW)).toBe(DAY_IN_BRAZIL);
    const due = await dueOnOrderDay();
    expect(due.length).toBeGreaterThan(0);
    for (const i of due) {
      expect(i.dueDate).toBe(DAY_IN_BRAZIL);
      expect(i.status).toBe("due_soon");
    }
  });

  it("com o relógio já no dia seguinte, os quadros num 'agora' dado são iguais pelo resumo e pelas tabelas", async () => {
    await summary.rebuildOrderSummaries();
    expect(await summary.readOrderSummaries()).not.toBeNull();
    vi.setSystemTime(AFTER_MIDNIGHT_IN_BRAZIL);
    expect(brazilDay(new Date())).toBe(NEXT_DAY_IN_BRAZIL);

    // Pelo relógio, a parcela de ontem venceu; no dia dado, ainda está a vencer.
    for (const i of await dueOnOrderDay()) expect(i.status).toBe("overdue");
    for (const i of await dueOnOrderDay(DAY_IN_BRAZIL))
      expect(i.status).toBe("due_soon");

    // Quadros no "agora" do teste (23:50 de 21/11 em Brasília).
    const fromSummary = await loadTowerBoard({ finance: true, now: NOW });
    const fromTables = await direct(() =>
      loadTowerBoard({ finance: true, now: NOW }),
    );
    expect(fromSummary).toEqual(fromTables);
    expect(count(fromSummary, "parInstallmentDueSoon")).toBeGreaterThan(0);
    expect(count(fromSummary, "parInstallmentOverdue")).toBe(0);

    // Quadros no relógio (já 22/11 em Brasília): vencidas nos dois caminhos.
    const nowSummary = await loadTowerBoard({ finance: true });
    const nowTables = await direct(() => loadTowerBoard({ finance: true }));
    expect(count(nowSummary, "parInstallmentOverdue")).toBeGreaterThan(0);
    expect(count(nowSummary, "parInstallmentDueSoon")).toBe(0);
    expect(
      nowSummary.cards.filter((c) => c.key.startsWith("parInstallment")),
    ).toEqual(
      nowTables.cards.filter((c) => c.key.startsWith("parInstallment")),
    );
  });
});
