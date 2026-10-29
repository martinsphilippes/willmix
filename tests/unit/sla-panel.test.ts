import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Painel de SLA: a pendência cai no operador da carteira do cliente; cada um
 * vê o próprio painel e o de quem está abaixo dele; o admin vê todos e o que
 * está sem responsável. Só o admin muda equipe e carteira; ciclo é recusado.
 * RFQ sem resposta depois do prazo aparece como atraso de parceiro.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const team = await import("@/lib/services/team");
const { slaBoardFor, UNASSIGNED, ALL } = await import(
  "@/lib/services/sla-panel"
);
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let analyst: User;
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

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  analyst = await wellmixUser("ana.analista@wellmix.com", "Ana Analista");
  coordinator = await wellmixUser("caio.coord@wellmix.com", "Caio Coordenador");
  manager = await wellmixUser("gil.gerente@wellmix.com", "Gil Gerente");
  await team.setTeamMember(admin, analyst.id, {
    jobLevel: "analyst",
    managerUserId: coordinator.id,
  });
  await team.setTeamMember(admin, coordinator.id, {
    jobLevel: "coordinator",
    managerUserId: manager.id,
  });
  await team.setTeamMember(admin, manager.id, {
    jobLevel: "manager",
    managerUserId: null,
  });
  // Reload with the new fields.
  analyst = (await getStore().get("users", analyst.id))!;
  coordinator = (await getStore().get("users", coordinator.id))!;
  manager = (await getStore().get("users", manager.id))!;
});

async function request(name: string) {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: name,
    description: name,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
    notes: null,
  });
}

describe("painel de SLA", () => {
  it("sem carteira: a pendência fica em 'Sem responsável', que só o admin vê", async () => {
    await request("Copo sem dono");
    const forAdmin = await slaBoardFor(admin, UNASSIGNED);
    expect(forAdmin.selected).toBe(UNASSIGNED);
    expect(forAdmin.items.some((i) => i.title.includes("Copo sem dono"))).toBe(
      true,
    );
    const forAnalyst = await slaBoardFor(analyst, UNASSIGNED);
    // Não pode escolher "sem responsável": cai no próprio painel, vazio.
    expect(forAnalyst.selected).toBe(analyst.id);
    expect(forAnalyst.items).toEqual([]);
    expect(forAnalyst.unassigned).toBeNull();
  });

  it("com carteira: cai no analista; o coordenador e o gerente veem, o analista não vê os de cima", async () => {
    await team.setCustomerOwner(admin, "cliente-joao", analyst.id);
    const mine = await slaBoardFor(analyst);
    expect(mine.manages).toBe(false);
    expect(mine.selected).toBe(analyst.id);
    expect(mine.items.some((i) => i.title.includes("Copo sem dono"))).toBe(
      true,
    );
    expect(mine.items.every((i) => i.ownerId === analyst.id)).toBe(true);
    expect(mine.people.map((p) => p.id)).toEqual([analyst.id]);

    const coord = await slaBoardFor(coordinator);
    expect(coord.manages).toBe(true);
    expect(coord.selected).toBe(ALL);
    expect(coord.people.map((p) => p.id)).toEqual([
      coordinator.id,
      analyst.id,
    ]);
    expect(coord.people[1].depth).toBe(1);
    expect(coord.people[1].customers).toBe(1);
    expect(coord.items.length).toBeGreaterThan(0);
    // Não enxerga o gerente.
    const peek = await slaBoardFor(coordinator, manager.id);
    expect(peek.selected).toBe(ALL);

    const mgr = await slaBoardFor(manager, analyst.id);
    expect(mgr.selected).toBe(analyst.id);
    expect(mgr.people.map((p) => p.id)).toEqual([
      manager.id,
      coordinator.id,
      analyst.id,
    ]);
  });

  it("RFQ sem resposta depois do prazo vira atraso de parceiro para o dono da carteira", async () => {
    const late = await request("Prato atrasado");
    await r.openRfq(admin, late.id, ["fornecedor-a"]);
    await getStore().update("requests", late.id, {
      deadline: "2020-01-10",
    });
    const board = await slaBoardFor(analyst);
    const partner = board.items.find(
      (i) => i.source === "partner" && i.title.includes("Prato atrasado"),
    );
    expect(partner).toMatchObject({
      kind: "partner_quote",
      waitingOn: ["supplier"],
      waitingParty: "Shenzhen Supplier A",
      due: "overdue",
    });
    expect(board.totals.partnerLate).toBeGreaterThan(0);
  });

  it("só o admin muda equipe e carteira; ciclo e chefe de si mesmo são recusados", async () => {
    await expect(
      team.setCustomerOwner(manager, "cliente-joao", manager.id),
    ).rejects.toThrow();
    await expect(
      team.setTeamMember(admin, manager.id, {
        jobLevel: "manager",
        managerUserId: analyst.id,
      }),
    ).rejects.toThrow("manager_cycle");
    await expect(
      team.setTeamMember(admin, analyst.id, {
        jobLevel: "analyst",
        managerUserId: analyst.id,
      }),
    ).rejects.toThrow("manager_self");
    // Cliente não é operador válido.
    await expect(
      team.setCustomerOwner(admin, "cliente-joao", joao.id),
    ).rejects.toThrow("owner_invalid");
  });

  it("quem não é da Wellmix não abre o painel", async () => {
    await expect(slaBoardFor(joao)).rejects.toThrow();
  });
});
