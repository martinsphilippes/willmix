import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Painel de SLA por divisão: cada linha de produto é da Wellmix ou da
 * WellKids; a solicitação nova cai sozinha no analista da divisão da linha
 * com menos pendências, e o pedido herda. Cada um vê o próprio painel e o de
 * quem está abaixo; o admin vê todos e o "sem responsável". Só o admin muda
 * equipe e linhas; ciclo é recusado.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderFromRequest } = await import("./helpers/order");
const r = await import("@/lib/services/requests");
const team = await import("@/lib/services/team");
const { slaBoardFor, UNASSIGNED, ALL } =
  await import("@/lib/services/sla-panel");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let analyst: User;
let analyst2: User;
let kids: User;
let coordinator: User;
let manager: User;

async function wellmixUser(email: string, name: string) {
  return getStore().create("users", {
    email,
    name,
    role: "operator",
    partyId: null,
    locale: "pt",
    passwordHash: null,
    active: true,
    importerId: null,
  });
}

const reload = async (u: User) => (await getStore().get("users", u.id))!;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  analyst = await wellmixUser("ana.analista@wellmix.com", "Ana Analista");
  analyst2 = await wellmixUser("bia.analista@wellmix.com", "Bia Analista");
  kids = await wellmixUser("kai.kids@wellmix.com", "Kai Kids");
  coordinator = await wellmixUser("caio.coord@wellmix.com", "Caio Coordenador");
  manager = await wellmixUser("gil.gerente@wellmix.com", "Gil Gerente");
  await team.setTeamMember(admin, manager.id, {
    jobLevel: "manager",
    managerUserId: null,
    division: null,
  });
  await team.setTeamMember(admin, coordinator.id, {
    jobLevel: "coordinator",
    managerUserId: manager.id,
    division: null,
  });
  for (const a of [analyst, analyst2])
    await team.setTeamMember(admin, a.id, {
      jobLevel: "analyst",
      managerUserId: coordinator.id,
      division: "wellmix",
    });
  await team.setTeamMember(admin, kids.id, {
    jobLevel: "analyst",
    managerUserId: manager.id,
    division: "wellkids",
  });
  [analyst, analyst2, kids, coordinator, manager] = await Promise.all(
    [analyst, analyst2, kids, coordinator, manager].map(reload),
  );
});

async function request(name: string, productId: string | null = null) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: name,
    specification: null,
    quantity: 10000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

describe("painel de SLA por divisão", () => {
  it("linha sem divisão: sem responsável (só o admin vê); depois 'Distribuir agora' dá o analista", async () => {
    const early = await request("Jarra antes da divisão", "prod-jarra");
    expect(early.ownerUserId ?? null).toBeNull();
    const forAdmin = await slaBoardFor(admin, UNASSIGNED);
    expect(forAdmin.items.some((i) => i.title.includes("Jarra antes"))).toBe(
      true,
    );
    const forAnalyst = await slaBoardFor(analyst, UNASSIGNED);
    expect(forAnalyst.selected).toBe(analyst.id);
    expect(forAnalyst.unassigned).toBeNull();

    await team.setLineDivision(admin, "linha-utilidades", "wellmix");
    await team.setLineDivision(admin, "linha-brinquedos", "wellkids");
    const done = await team.distributeUnassigned(admin);
    expect(done.requests).toBeGreaterThanOrEqual(1);
    const after = (await getStore().get("requests", early.id))!;
    expect([analyst.id, analyst2.id]).toContain(after.ownerUserId);
  });

  it("solicitação nova cai sozinha no analista da divisão com menos pendências", async () => {
    const a = await request("Jarra 1", "prod-jarra");
    const b = await request("Jarra 2", "prod-jarra");
    expect([analyst.id, analyst2.id]).toContain(a.ownerUserId);
    expect([analyst.id, analyst2.id]).toContain(b.ownerUserId);
    // Com a anterior já distribuída, as duas analistas ficam equilibradas.
    const owners = (await getStore().list("requests"))
      .filter((x) => x.productId === "prod-jarra" && x.status !== "CANCELLED")
      .map((x) => x.ownerUserId);
    const countA = owners.filter((o) => o === analyst.id).length;
    const countB = owners.filter((o) => o === analyst2.id).length;
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(1);
    const toy = await request("Boneca", "prod-boneca");
    expect(toy.ownerUserId).toBe(kids.id);
    // Fora do catálogo: sem responsável.
    const free = await request("Produto fora do catálogo");
    expect(free.ownerUserId ?? null).toBeNull();
  });

  it("hierarquia: o analista vê só o dele; o coordenador vê as analistas; o gerente vê todos abaixo", async () => {
    const mine = await slaBoardFor(analyst);
    expect(mine.manages).toBe(false);
    expect(mine.selected).toBe(analyst.id);
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((i) => i.ownerId === analyst.id)).toBe(true);
    expect(mine.people.map((p) => p.id)).toEqual([analyst.id]);
    expect(mine.people[0].division).toBe("wellmix");

    const coord = await slaBoardFor(coordinator);
    expect(coord.selected).toBe(ALL);
    expect(coord.people.map((p) => p.id).sort()).toEqual(
      [coordinator.id, analyst.id, analyst2.id].sort(),
    );
    expect(coord.items.some((i) => i.ownerId === kids.id)).toBe(false);
    // Não enxerga o gerente nem a WellKids.
    expect((await slaBoardFor(coordinator, kids.id)).selected).toBe(ALL);

    const mgr = await slaBoardFor(manager, kids.id);
    expect(mgr.selected).toBe(kids.id);
    expect(mgr.items.some((i) => i.title.includes("Boneca"))).toBe(true);
  });

  it("o pedido herda o analista da solicitação", async () => {
    const req = await request("Jarra pedida", "prod-jarra");
    const order = await orderFromRequest(admin, req, {
      downPaymentAmount: 300,
    });
    expect(order.ownerUserId).toBe(req.ownerUserId);
  });

  it("só o admin muda equipe e linhas; ciclo e chefe de si mesmo são recusados; de fora não abre", async () => {
    await expect(
      team.setLineDivision(manager, "linha-utilidades", "wellkids"),
    ).rejects.toThrow();
    await expect(team.distributeUnassigned(manager)).rejects.toThrow();
    await expect(
      team.setTeamMember(admin, manager.id, {
        jobLevel: "manager",
        managerUserId: analyst.id,
        division: null,
      }),
    ).rejects.toThrow("manager_cycle");
    await expect(
      team.setTeamMember(admin, analyst.id, {
        jobLevel: "analyst",
        managerUserId: analyst.id,
        division: "wellmix",
      }),
    ).rejects.toThrow("manager_self");
    await expect(slaBoardFor(joao)).rejects.toThrow();
  });

  it("telas marcadas uma a uma: só chaves válidas, sem o básico; nulo volta ao padrão", async () => {
    const { screensFor, hasCustomScreens } = await import("@/lib/auth/screens");
    await team.setTeamMember(admin, analyst.id, {
      jobLevel: "analyst",
      managerUserId: null,
      division: "wellmix",
      screens: ["finance", "tasks", "orders", "nada"],
    });
    let saved = (await getStore().get("users", analyst.id))!;
    expect(saved.screens).toEqual(["finance", "orders"]);
    expect(hasCustomScreens(saved)).toBe(true);
    expect(screensFor(saved).has("finance")).toBe(true);
    expect(screensFor(saved).has("tasks")).toBe(true);
    await team.setTeamMember(admin, analyst.id, {
      jobLevel: "analyst",
      managerUserId: null,
      division: "wellmix",
      screens: null,
    });
    saved = (await getStore().get("users", analyst.id))!;
    expect(saved.screens ?? null).toBeNull();
    expect(hasCustomScreens(saved)).toBe(false);
    // Só o admin.
    await expect(
      team.setTeamMember(manager, analyst.id, {
        jobLevel: null,
        managerUserId: null,
        division: null,
        screens: ["finance"],
      }),
    ).rejects.toThrow();
  });

  it("as etapas por trás de 'no prazo' acompanham o indicador e a pessoa escolhida", async () => {
    const all = await slaBoardFor(admin, ALL);
    expect(all.recentStages.length).toBe(all.onTime.total);
    expect(all.recentStages.filter((s) => s.onTime).length).toBe(
      all.onTime.done,
    );
    for (const s of all.recentStages) {
      expect(s.link).toBe(`/app/orders/${s.orderId}`);
      expect(typeof s.onTime).toBe("boolean");
    }
    const one = await slaBoardFor(admin, analyst.id);
    expect(one.recentStages.every((s) => s.ownerId === analyst.id)).toBe(true);
    expect(one.recentStages.length).toBe(one.onTime.total);
  });

  it("'no prazo' vem do indicador pronto, refeito quando uma etapa com prazo é concluída", async () => {
    const store = getStore();
    const before = await slaBoardFor(admin, ALL);
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: null,
      productName: "Etapa no prazo",
      description: "SLA",
      specification: null,
      quantity: 10,
      unit: "un",
      deadline: null,
      notes: null,
    });
    const order = await orderFromRequest(admin, request);
    const [stage] = await store.list("stages", {
      filter: { orderId: order.id, status: ["active", "blocked"] },
      limit: 1,
    });
    await store.update("stages", stage.id, {
      dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
    await store.update("stages", stage.id, {
      status: "done",
      completedAt: new Date().toISOString(),
    });
    const after = await slaBoardFor(admin, ALL);
    expect(after.onTime.total).toBe(before.onTime.total + 1);
    expect(after.onTime.done).toBe(before.onTime.done + 1);
    expect(after.recentStages.some((x) => x.orderId === order.id)).toBe(true);
    const row = await store.get("kpi_snapshots", "sla.done");
    expect(row).not.toBeNull();
  });
});
