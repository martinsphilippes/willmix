import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Pendências: ordem pelo prazo (urgentes primeiro, sem prazo por último), filtros por prazo e tipo. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const tasks = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;
type Task = import("@/lib/services/tasks").Task;

// 5 de outubro de 2026, 15h em Brasília (18h UTC).
const NOW = new Date("2026-10-05T18:00:00Z");

function mk(partial: Partial<Task> & { dueAt: string | null }): Task {
  const daysLeft = tasks.daysUntil(partial.dueAt, NOW);
  const due = tasks.dueBucket(daysLeft);
  return {
    kind: "requirement",
    title: partial.title ?? partial.dueAt ?? "sem prazo",
    detail: "",
    link: "/app",
    group: partial.group ?? partial.stageKey ?? partial.kind ?? "requirement",
    ...partial,
    daysLeft,
    due,
    overdue: due === "overdue",
  };
}

let admin: User;
let joao: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("prazo em dia civil (Brasília)", () => {
  it("conta dias até o prazo e classifica", () => {
    expect(tasks.daysUntil("2026-10-05", NOW)).toBe(0);
    expect(tasks.daysUntil("2026-10-06", NOW)).toBe(1);
    expect(tasks.daysUntil("2026-10-12", NOW)).toBe(7);
    expect(tasks.daysUntil("2026-10-13", NOW)).toBe(8);
    expect(tasks.daysUntil("2026-10-03", NOW)).toBe(-2);
    expect(tasks.daysUntil(null, NOW)).toBeNull();
    expect(tasks.daysUntil("não é data", NOW)).toBeNull();
    // Com hora: 23h59 de Brasília do dia 5 ainda é dia 5; 00h30 UTC do dia 6 é dia 5 em Brasília (21h30).
    expect(tasks.daysUntil("2026-10-06T02:59:00Z", NOW)).toBe(0);
    expect(tasks.daysUntil("2026-10-06T03:00:00Z", NOW)).toBe(1);
    expect(tasks.dueBucket(-1)).toBe("overdue");
    expect(tasks.dueBucket(0)).toBe("today");
    expect(tasks.dueBucket(7)).toBe("week");
    expect(tasks.dueBucket(8)).toBe("later");
    expect(tasks.dueBucket(null)).toBe("none");
  });

  it("vence hoje não é atrasada; ontem é", () => {
    expect(mk({ dueAt: "2026-10-05" }).overdue).toBe(false);
    expect(mk({ dueAt: "2026-10-04" }).overdue).toBe(true);
  });
});

describe("ordem e filtros", () => {
  const list = [
    mk({ dueAt: null, title: "A sem prazo", kind: "review", group: "review" }),
    mk({ dueAt: "2026-10-20", title: "B depois", stageKey: "SHIPPING" }),
    mk({ dueAt: "2026-10-05", title: "C hoje", stageKey: "PREPARATION" }),
    mk({ dueAt: "2026-10-01", title: "D atrasada", stageKey: "INSPECTION" }),
    mk({ dueAt: null, title: "E sem prazo", kind: "rfq", group: "rfq" }),
    mk({ dueAt: "2026-10-08", title: "F semana", stageKey: "PREPARATION" }),
    mk({ dueAt: "2026-10-01", title: "G atrasada 2", stageKey: "PREPARATION" }),
  ];

  it("ordena pelo prazo, urgentes primeiro, sem prazo por último, empate estável", () => {
    expect(tasks.sortTasks(list).map((t) => t.title)).toEqual([
      "D atrasada",
      "G atrasada 2",
      "C hoje",
      "F semana",
      "B depois",
      "A sem prazo",
      "E sem prazo",
    ]);
  });

  it("filtra por prazo e por tipo, juntos ou separados; filtro inválido não filtra", () => {
    const sorted = tasks.sortTasks(list);
    const names = (l: Task[]) => l.map((t) => t.title);
    expect(names(tasks.filterTasks(sorted, { due: "overdue" }))).toEqual([
      "D atrasada",
      "G atrasada 2",
    ]);
    expect(names(tasks.filterTasks(sorted, { due: "today" }))).toEqual([
      "C hoje",
    ]);
    expect(names(tasks.filterTasks(sorted, { due: "week" }))).toEqual([
      "F semana",
    ]);
    expect(names(tasks.filterTasks(sorted, { due: "none" }))).toEqual([
      "A sem prazo",
      "E sem prazo",
    ]);
    expect(names(tasks.filterTasks(sorted, { group: "PREPARATION" }))).toEqual([
      "G atrasada 2",
      "C hoje",
      "F semana",
    ]);
    expect(
      names(
        tasks.filterTasks(sorted, { due: "overdue", group: "PREPARATION" }),
      ),
    ).toEqual(["G atrasada 2"]);
    expect(tasks.filterTasks(sorted, { due: "xyz", group: "" })).toHaveLength(
      7,
    );
  });

  it("grupos na ordem do fluxo (etapas) e depois os tipos, com contagem", () => {
    expect(tasks.taskGroups(list)).toEqual([
      { group: "PREPARATION", stage: true, count: 3 },
      { group: "INSPECTION", stage: true, count: 1 },
      { group: "SHIPPING", stage: true, count: 1 },
      { group: "rfq", stage: false, count: 1 },
      { group: "review", stage: false, count: 1 },
    ]);
  });
});

describe("pendências reais", () => {
  it("saem ordenadas pelo prazo e com etapa/grupo preenchidos", async () => {
    const store = getStore();
    const r = await import("@/lib/services/requests");
    const supplierA = (await store.list("users", {})).find(
      (u) => u.email === "supplier.a@china.com",
    )!;
    // Dois pedidos: etapas com prazo (requisito) e uma solicitação aberta (RFQ, prazo da SLA).
    for (const name of ["Jarra", "Copo"]) {
      const request = await r.createRequest(joao, {
        customerId: "cliente-joao",
        productId: "prod-jarra",
        productName: name,
        description: "Teste pendências",
        specification: null,
        quantity: 100,
        unit: "un",
        deadline: null,
        notes: null,
      });
      await r.openRfq(admin, request.id, ["fornecedor-a"]);
      const [quote] = await store.list("quotes", {
        filter: { requestId: request.id },
      });
      await r.answerQuote(supplierA, quote.id, {
        price: 2,
        currency: "USD",
        leadTimeDays: 10,
        conditions: null,
      });
      await r.selectQuote(admin, quote.id, {
        sellPrice: 1000,
        sellCurrency: "BRL",
        downPaymentAmount: 300,
      });
      await r.confirmDownPayment(admin, request.id);
    }
    await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Sem fornecedor ainda",
      description: "Abrir RFQ",
      specification: null,
      quantity: 1,
      unit: "un",
      deadline: null,
      notes: null,
    });

    const mine = await tasks.pendingTasksFor(admin);
    expect(mine.length).toBeGreaterThanOrEqual(3);
    // Com prazo primeiro, em ordem crescente; sem prazo no fim.
    const dated = mine.filter((t) => t.daysLeft !== null);
    const undated = mine.filter((t) => t.daysLeft === null);
    expect(mine.slice(0, dated.length)).toEqual(dated);
    expect(mine.slice(dated.length)).toEqual(undated);
    for (let i = 1; i < dated.length; i++)
      expect(dated[i].daysLeft!).toBeGreaterThanOrEqual(dated[i - 1].daysLeft!);
    for (const t of mine) {
      expect(t.group).toBeTruthy();
      expect(["overdue", "today", "week", "later", "none"]).toContain(t.due);
      if (t.kind === "requirement") {
        expect(t.stageKey).toBeTruthy();
        expect(t.group).toBe(t.stageKey);
      } else expect(t.group).toBe(t.kind);
    }
    expect(mine.some((t) => t.kind === "requirement")).toBe(true);
    expect(mine.some((t) => t.kind === "rfq")).toBe(true);

    // Etapa com prazo de ontem: fica atrasada e vai para o topo.
    const [stage] = await store.list("stages", {
      filter: { status: "active" },
    });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await store.update("stages", stage.id, { dueAt: yesterday });
    const again = await tasks.pendingTasksFor(admin);
    const first = again[0];
    expect(first.overdue).toBe(true);
    expect(first.due).toBe("overdue");
    expect(first.link).toBe(`/app/orders/${stage.orderId}`);
    expect(tasks.taskGroups(again).map((g) => g.group)).toContain(
      "ORDER_CREATED",
    );
    // Cliente: só as próprias (nenhuma da Wellmix), mesma regra de ordem.
    const his = await tasks.pendingTasksFor(joao);
    expect(his.some((t) => t.kind === "rfq")).toBe(false);
    for (const t of his) expect(t.group).toBeTruthy();
  });
});
