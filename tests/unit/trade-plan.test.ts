import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Plano de ação Trade (dono, 18/11/2026; docs/TRADE_COMERCIAL.md, PR 2; a tela
 * 12 do painel do Projeto Campineira): quem gere a carteira cria a ação do
 * cliente ou do grupo, com responsável e prazo; aberta, é pendência do
 * responsável (atrasada passado o prazo); concluir pede a resposta ou uma
 * evidência; cancelar e reabrir ficam com quem gere.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
  },
  notFound: () => {
    throw new Error("not_found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const portfolio = await import("@/lib/services/portfolio");
const plan = await import("@/lib/services/trade-plan");
const actions = await import("@/app/app/actions/trade-plan");
const { tasksForFunctions } = await import("@/lib/task-owner");
const { flowStepsOf } = await import("@/lib/flow");
type User = import("@/lib/db").User;

const DAY = 86_400_000;
const NOW = new Date();
const day = (offset: number) =>
  portfolio.brDay(new Date(NOW.getTime() + offset * DAY));

let admin: User;
let sales: User;
let buyer: User;
let groupId: string;

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  sales = users.find((u) => u.email === "vendas@wellmix.com")!;
  buyer = users.find((u) => u.email === "operador@wellmix.com")!;
  const group = await portfolio.createCustomerGroup(admin, {
    name: "Grupo Campineira",
    notes: null,
    ownerUserId: sales.id,
  });
  groupId = group.id;
  await portfolio.setCustomerGroup(admin, "cliente-joao", groupId);
});

describe("regras puras", () => {
  it("dia válido, atrasada e concluída no prazo", () => {
    expect(plan.validDay("2026-11-30")).toBe(true);
    expect(plan.validDay("2026-02-30")).toBe(false);
    expect(plan.validDay("30/11/2026")).toBe(false);
    const now = new Date("2026-11-20T15:00:00Z");
    expect(plan.isLate({ status: "pending", dueDate: "2026-11-19" }, now)).toBe(
      true,
    );
    expect(plan.isLate({ status: "pending", dueDate: "2026-11-20" }, now)).toBe(
      false,
    );
    expect(plan.isLate({ status: "done", dueDate: "2026-11-01" }, now)).toBe(
      false,
    );
    expect(
      plan.doneOnTime({
        status: "done",
        doneAt: "2026-11-20T23:30:00-03:00",
        dueDate: "2026-11-20",
      }),
    ).toBe(true);
    expect(
      plan.doneOnTime({
        status: "done",
        doneAt: "2026-11-21T10:00:00-03:00",
        dueDate: "2026-11-20",
      }),
    ).toBe(false);
    expect(
      plan.doneOnTime({ status: "pilot", doneAt: null, dueDate: "2026-11-20" }),
    ).toBeNull();
  });
});

describe("plano de ação", () => {
  let activityId: string;

  it("só quem gere a carteira cria; do cliente ou do grupo; prazo de hoje em diante", async () => {
    const base = {
      title: "Proteger o produto líder",
      description: "Auditar exposição, estoque de loja e reposição",
      customerId: null,
      groupId,
      responsibleUserId: sales.id,
      dueDate: day(7),
    };
    await expect(plan.createTradeActivity(sales, base, NOW)).rejects.toThrow(
      "forbidden",
    );
    await expect(
      plan.createTradeActivity(admin, { ...base, groupId: null }, NOW),
    ).rejects.toThrow("trade_scope_required");
    await expect(
      plan.createTradeActivity(
        admin,
        { ...base, customerId: "cliente-joao" },
        NOW,
      ),
    ).rejects.toThrow("trade_scope_required");
    await expect(
      plan.createTradeActivity(admin, { ...base, dueDate: day(-1) }, NOW),
    ).rejects.toThrow("trade_due_past");
    await expect(
      plan.createTradeActivity(admin, { ...base, dueDate: "31/12/2026" }, NOW),
    ).rejects.toThrow("trade_due_invalid");
    await expect(
      plan.createTradeActivity(admin, { ...base, title: " a " }, NOW),
    ).rejects.toThrow("trade_title_required");
    const created = await plan.createTradeActivity(admin, base, NOW);
    activityId = created.id;
    expect(created).toMatchObject({
      status: "pending",
      responsibleUserId: sales.id,
      createdByUserId: admin.id,
    });
    // O responsável recebe o aviso.
    const notes = await getStore().list("notifications", {
      filter: { userId: sales.id },
    });
    expect(
      notes.some((n) => n.link === `/app/portfolio/plan/${created.id}`),
    ).toBe(true);
  });

  it("aberta é pendência do responsável, no passo Plano de ação Trade", async () => {
    const drafts = await plan.tradeTaskDrafts(NOW);
    const mine = drafts.find((d) => d.link.endsWith(activityId))!;
    expect(mine).toMatchObject({
      kind: "trade_activity",
      ownerUserId: sales.id,
      dueAt: day(7),
    });
    expect(mine.title).toContain("Proteger o produto líder");
    expect(flowStepsOf({ kind: "trade_activity" }).map((s) => s.key)).toEqual([
      "tradePlan",
    ]);
    const asTask = [{ ...mine, overdue: false, group: mine.kind }];
    expect(tasksForFunctions(sales, asTask)).toHaveLength(1);
    expect(tasksForFunctions(buyer, asTask)).toHaveLength(0);
    expect(tasksForFunctions(admin, asTask)).toHaveLength(1);
  });

  it("quem vê: quem gere vê todas; o responsável, as dele; o comprador não abre", async () => {
    const asAdmin = await plan.loadTradePlan(admin, {}, NOW);
    expect(asAdmin.rows.map((r) => r.id)).toContain(activityId);
    expect(asAdmin.rows[0]).toMatchObject({
      scopeName: "Grupo Campineira",
      scopeKind: "group",
      responsibleName: sales.name,
    });
    const asSales = await plan.loadTradePlan(sales, {}, NOW);
    expect(asSales.rows.map((r) => r.id)).toEqual([activityId]);
    expect(asSales.canManage).toBe(false);
    await expect(plan.loadTradePlan(buyer, {}, NOW)).rejects.toThrow(
      "forbidden",
    );
    // Na ficha do grupo e do cliente (pelo grupo, não).
    expect(
      (await plan.tradeActivitiesFor(sales, { groupId }, NOW)).map((r) => r.id),
    ).toEqual([activityId]);
    expect(
      await plan.tradeActivitiesFor(sales, { customerId: "cliente-joao" }, NOW),
    ).toEqual([]);
  });

  it("passado o prazo, atrasada (pendência vencida e contador)", async () => {
    const later = new Date(NOW.getTime() + 9 * DAY);
    const view = await plan.loadTradePlan(admin, { status: "late" }, later);
    expect(view.rows.map((r) => r.id)).toContain(activityId);
    expect(view.counts.late).toBeGreaterThanOrEqual(1);
  });

  it("o responsável avança; concluir pede resposta ou evidência; no prazo", async () => {
    await expect(
      plan.setTradeActivityStatus(buyer, activityId, {
        status: "investigating",
        notes: null,
      }),
    ).rejects.toThrow("forbidden");
    await plan.setTradeActivityStatus(
      sales,
      activityId,
      { status: "investigating", notes: "Visitar as 5 lojas" },
      NOW,
    );
    await expect(
      plan.setTradeActivityStatus(
        sales,
        activityId,
        { status: "cancelled", notes: null },
        NOW,
      ),
    ).rejects.toThrow("forbidden");
    await expect(
      plan.setTradeActivityStatus(
        sales,
        activityId,
        { status: "done", notes: " " },
        NOW,
      ),
    ).rejects.toThrow("trade_evidence_required");
    const done = await plan.setTradeActivityStatus(
      sales,
      activityId,
      { status: "done", notes: "Exposição conferida nas 5 lojas" },
      NOW,
    );
    expect(done).toMatchObject({ status: "done", doneByUserId: sales.id });
    expect(plan.doneOnTime(done)).toBe(true);
    // Quem criou é avisado.
    const notes = await getStore().list("notifications", {
      filter: { userId: admin.id },
    });
    expect(
      notes.some((n) => n.link === `/app/portfolio/plan/${activityId}`),
    ).toBe(true);
    // Concluída sai das pendências; o responsável não reabre, quem gere sim.
    expect(
      (await plan.tradeTaskDrafts(NOW)).some((d) =>
        d.link.endsWith(activityId),
      ),
    ).toBe(false);
    await expect(
      plan.setTradeActivityStatus(
        sales,
        activityId,
        { status: "pending", notes: null },
        NOW,
      ),
    ).rejects.toThrow("trade_closed");
    const reopened = await plan.setTradeActivityStatus(
      admin,
      activityId,
      { status: "pilot", notes: "Piloto em 2 lojas" },
      NOW,
    );
    expect(reopened).toMatchObject({ status: "pilot", doneAt: null });
  });

  it("editar: quem gere, enquanto aberta; trocar o responsável avisa o novo", async () => {
    await expect(
      plan.updateTradeActivity(
        sales,
        activityId,
        {
          title: "Outra",
          description: null,
          customerId: null,
          groupId,
          responsibleUserId: sales.id,
          dueDate: day(10),
        },
        NOW,
      ),
    ).rejects.toThrow("forbidden");
    const edited = await plan.updateTradeActivity(
      admin,
      activityId,
      {
        title: "Piloto de exposição",
        description: null,
        customerId: "cliente-joao",
        groupId: null,
        responsibleUserId: buyer.id,
        dueDate: day(10),
      },
      NOW,
    );
    expect(edited).toMatchObject({
      customerId: "cliente-joao",
      groupId: null,
      responsibleUserId: buyer.id,
    });
    await plan.setTradeActivityStatus(
      admin,
      activityId,
      { status: "cancelled", notes: null },
      NOW,
    );
    await expect(
      plan.updateTradeActivity(
        admin,
        activityId,
        {
          title: "De novo",
          description: null,
          customerId: "cliente-joao",
          groupId: null,
          responsibleUserId: sales.id,
          dueDate: day(10),
        },
        NOW,
      ),
    ).rejects.toThrow("trade_closed");
    // Cancelada não aparece na lista padrão, mas aparece no filtro.
    const view = await plan.loadTradePlan(admin, {}, NOW);
    expect(view.rows.map((r) => r.id)).not.toContain(activityId);
    const cancelled = await plan.loadTradePlan(
      admin,
      { status: "cancelled" },
      NOW,
    );
    expect(cancelled.rows.map((r) => r.id)).toContain(activityId);
  });
});

describe("ações", () => {
  it("criar pela tela (o diagnóstico manda o produto) e salvar a situação", async () => {
    h.current = admin;
    h.redirects.length = 0;
    await actions.createTradeActivityAction(
      form({
        title: "Ampliar alcance do SKU",
        description: "Selecionar lojas e testar ampliação de mix",
        groupId,
        customerId: "",
        responsibleUserId: sales.id,
        dueDate: day(5),
        productCode: "12345",
        productName: "MINI LUMINARIA",
        focus: "reach",
        back: "/app/portfolio/plan#new",
      }),
    );
    const target = h.redirects.at(-1)!;
    expect(target).toMatch(/^\/app\/portfolio\/plan\/[^/?]+\?created=1$/);
    const id = target.split("/").pop()!.split("?")[0];
    const saved = (await getStore().get("trade_activities", id))!;
    expect(saved).toMatchObject({
      productCode: "12345",
      productName: "MINI LUMINARIA",
      focus: "reach",
    });

    h.current = sales;
    await actions.setTradeActivityStatusAction(
      form({ activityId: id, status: "done", notes: "" }),
    );
    expect(h.redirects.at(-1)).toContain("error=trade_evidence_required");
    await actions.setTradeActivityStatusAction(
      form({ activityId: id, status: "investigating", notes: "Em andamento" }),
    );
    expect(h.redirects.at(-1)).toBe(
      `/app/portfolio/plan/${id}?status=1#status`,
    );

    // Volta de erro só para telas da carteira.
    h.current = admin;
    await actions.createTradeActivityAction(
      form({
        title: "x",
        groupId,
        responsibleUserId: sales.id,
        dueDate: day(5),
        back: "https://fora.example/app",
      }),
    );
    expect(h.redirects.at(-1)).toMatch(
      /^\/app\/portfolio\/plan\?error=trade_title_required#new$/,
    );
  });
});
