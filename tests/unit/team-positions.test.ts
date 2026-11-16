import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import { planBulkPositions, positionLine } from "@/lib/team-positions";

/*
 * Cargos da equipe (Equipe Acessos e Parceiros → Cargos; dono, 16/11/2026):
 * cada cargo em uma área; o cadastro em massa aceita a área na mesma linha
 * (tabulação ou ";") e ignora a linha de título ("AREA"); cria só os que
 * faltam. A pessoa recebe o cargo e a área vem junto; trocar a área do cargo
 * leva quem tem o cargo. Nada mexe em logins, funções ou permissões.
 */
withTempStore();

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { DEMO_PASSWORD } = await import("@/lib/demo-data");
const session = await import("@/lib/auth/session");
const areas = await import("@/lib/services/team-areas");
const positions = await import("@/lib/services/team-positions");
const team = await import("@/lib/services/team");
const { bulkTeamPositionsAction } = await import("@/app/app/actions/team");
type User = import("@/lib/db").User;

/** As 12 áreas do dono. */
const AREAS = [
  "Marketing",
  "Showroom",
  "Financeiro",
  "Comercial",
  "Contabil Fiscal",
  "Tecnologia da Informação",
  "Compras",
  "Comex",
  "Recursos Humanos",
  "Presidência",
  "Operações e Processos",
  "Processos Projetos",
];

/** Os 44 cargos do dono, na ordem, com a área proposta ("" = sem área). */
const OWNER_POSITIONS: [string, string][] = [
  ["Designer Gráfico Sênior", "Marketing"],
  ["Vendedor Key Accounts", "Comercial"],
  ["Analista Financeiro Jr", "Financeiro"],
  ["Vendedora Pleno", "Comercial"],
  ["Designer Gráfico Pleno", "Marketing"],
  ["Analista ADM de Vendas Jr", "Comercial"],
  ["Assistente Fiscal", "Contabil Fiscal"],
  ["Analista ADM de Vendas Sr", "Comercial"],
  ["Analista de TI Jr", "Tecnologia da Informação"],
  ["Especialista de Operações", "Operações e Processos"],
  ["Vendedora Sênior", "Comercial"],
  ["Promotora de Merchandising", "Marketing"],
  ["Analista Fiscal Pleno", "Contabil Fiscal"],
  ["Assistente de Embalagens", "Marketing"],
  ["Vendedor Sênior", "Comercial"],
  ["Analista de Eventos Pleno", "Marketing"],
  ["Assistente de Cobrança", "Financeiro"],
  ["Jovem Aprendiz", ""],
  ["Assistente de Compras", "Compras"],
  ["Analista Financeiro Pleno", "Financeiro"],
  ["Analista PMO Sr", "Processos Projetos"],
  ["Vendedora Jr", "Comercial"],
  ["Analista de Processos Jr", "Processos Projetos"],
  ["Analista de Compras Pleno", "Compras"],
  ["Analista de Compras Jr", "Compras"],
  ["Analista de Automação e BI Pleno", "Tecnologia da Informação"],
  ["Vendedora Key Accounts", "Comercial"],
  ["Analista de Planejamento Sr", "Compras"],
  ["Assistente Comercial", "Comercial"],
  ["Analista Fiscal Sênior", "Contabil Fiscal"],
  ["Promotor de Merchandising", "Marketing"],
  ["Analista de Importação Sênior", "Comex"],
  ["Analista de Crédito Pleno", "Financeiro"],
  ["Vendedora Pleno I", "Comercial"],
  ["Vendedor Pleno", "Comercial"],
  ["Analista de Contas a Pagar Sr", "Financeiro"],
  ["Analista de Contas a Receber Sr", "Financeiro"],
  ["Analista de RH Sênior", "Recursos Humanos"],
  ["Auxiliar de Showroom", "Showroom"],
  ["Coordenadora de Trade Marketing", "Marketing"],
  ["Coordenador Regional de Vendas", "Comercial"],
  ["Diretor", "Presidência"],
  ["Gerente Nacional de Vendas", "Comercial"],
  ["Gerente Operações e Processos", "Operações e Processos"],
];

let admin: User;
let operator: User;

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "ok";
};

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
});

describe("regras do cadastro em massa (sem banco)", () => {
  const areaRows = AREAS.map((name, i) => ({
    id: `a${i}`,
    name,
    active: true,
  }));
  const idOf = (name: string) =>
    areaRows.find((a) => a.name === name)?.id ?? null;

  it("a área na mesma linha: tabulação (da planilha) ou ponto e vírgula", () => {
    expect(positionLine("Analista Financeiro Jr\tFinanceiro")).toEqual({
      name: "Analista Financeiro Jr",
      area: "Financeiro",
    });
    expect(positionLine("Analista Financeiro Jr ;  Financeiro ")).toEqual({
      name: "Analista Financeiro Jr",
      area: "Financeiro",
    });
    expect(positionLine("Diretor")).toEqual({ name: "Diretor", area: "" });
  });

  it("a lista do dono como veio (com o título AREA): os 44, sem área", () => {
    const text = ["AREA", ...OWNER_POSITIONS.map(([n]) => n)].join("\n");
    const plan = planBulkPositions(text, [], areaRows);
    expect(plan.header).toBe("AREA");
    expect(plan.create.map((c) => c.name)).toEqual(
      OWNER_POSITIONS.map(([n]) => n),
    );
    expect(plan.create.every((c) => c.areaId === null)).toBe(true);
    // "Vendedor" e "Vendedora" são cargos diferentes; nada repetido.
    expect(plan.repeated).toEqual([]);
    expect(plan.invalid).toEqual([]);
  });

  it("com a área de cada um (colado da planilha): a área certa em cada cargo", () => {
    const text = [
      "CARGO\tÁREA",
      ...OWNER_POSITIONS.map(([n, a]) => (a ? `${n}\t${a}` : n)),
    ].join("\n");
    const plan = planBulkPositions(text, [], areaRows);
    expect(plan.header).toBe("CARGO\tÁREA");
    expect(plan.unknownArea).toEqual([]);
    expect(plan.create.map((c) => [c.name, c.areaName ?? ""])).toEqual(
      OWNER_POSITIONS,
    );
    expect(plan.create.map((c) => c.areaId)).toEqual(
      OWNER_POSITIONS.map(([, a]) => (a ? idOf(a) : null)),
    );
  });

  it("área da lista, área desconhecida e cargo que já existe", () => {
    const plan = planBulkPositions(
      "Assistente Fiscal\nAnalista de BI; Dados\nanalista financeiro jr\n",
      [
        {
          id: "p1",
          name: "Analista Financeiro Jr",
          active: true,
          areaId: "a2",
        },
      ],
      areaRows,
      idOf("Contabil Fiscal"),
    );
    expect(plan.create).toEqual([
      {
        name: "Assistente Fiscal",
        areaId: idOf("Contabil Fiscal"),
        areaName: "Contabil Fiscal",
      },
    ]);
    expect(plan.unknownArea).toEqual([
      { name: "Analista de BI", area: "Dados" },
    ]);
    expect(plan.existing).toEqual([
      {
        asked: "analista financeiro jr",
        id: "p1",
        name: "Analista Financeiro Jr",
        active: true,
        areaId: "a2",
      },
    ]);
  });
});

describe("cadastro de cargos", () => {
  const areaId = async (name: string) =>
    (await areas.listTeamAreas()).find((a) => a.name === name)!.id;

  it("só o administrador cadastra", async () => {
    expect(
      await code(() => positions.createTeamPosition(operator, "Diretor", null)),
    ).toBe("forbidden");
    expect(
      await code(() =>
        positions.bulkCreateTeamPositions(operator, "Diretor", null),
      ),
    ).toBe("forbidden");
    expect(await positions.listTeamPositions()).toHaveLength(0);
  });

  it("os 44 do dono com a área proposta: logins, funções e permissões intactos", async () => {
    const store = getStore();
    await areas.bulkCreateTeamAreas(admin, AREAS.join("\n"));
    const usersBefore = JSON.stringify(await store.list("users"));
    const settingsBefore = JSON.stringify(await store.list("settings"));
    const areasBefore = JSON.stringify(await areas.listTeamAreas());

    const text = [
      "CARGO\tAREA",
      ...OWNER_POSITIONS.map(([n, a]) => (a ? `${n}\t${a}` : n)),
    ].join("\n");
    const done = await positions.bulkCreateTeamPositions(admin, text, null);
    expect(done.header).toBe("CARGO\tAREA");
    expect(done.created.map((c) => [c.name, c.areaName ?? ""])).toEqual(
      OWNER_POSITIONS,
    );
    expect(done.existing).toEqual([]);

    const list = await positions.listTeamPositions();
    expect(list).toHaveLength(44);
    const areaList = await areas.listTeamAreas();
    const areaName = (id: string | null) =>
      areaList.find((a) => a.id === id)?.name ?? "";
    for (const [name, area] of OWNER_POSITIONS) {
      const row = list.find((p) => p.name === name);
      expect(row, name).toBeDefined();
      expect(areaName(row!.areaId), name).toBe(area);
      expect(row!.active).toBe(true);
    }
    expect(JSON.stringify(await store.list("users"))).toBe(usersBefore);
    expect(JSON.stringify(await store.list("settings"))).toBe(settingsBefore);
    expect(JSON.stringify(await areas.listTeamAreas())).toBe(areasBefore);

    expect(
      await store.list("audit_log", {
        filter: { action: "team.position_create" },
      }),
    ).toHaveLength(44);
    const [bulk] = await store.list("audit_log", {
      filter: { action: "team.position_bulk" },
    });
    expect(bulk.summary).toBe(
      "Cadastro em massa de cargos: 44 criado(s), 0 já existia(m)",
    );

    // De novo: nada a criar.
    const again = await positions.bulkCreateTeamPositions(admin, text, null);
    expect(again.created).toEqual([]);
    expect(again.existing).toHaveLength(44);
    expect(await positions.listTeamPositions()).toHaveLength(44);
    // O mesmo nome com outra grafia é recusado.
    const comex = await areaId("Comex");
    expect(
      await code(() => positions.createTeamPosition(admin, "DIRETOR", comex)),
    ).toBe("position_exists");
  });

  it("a pessoa recebe o cargo e a área vem junto; trocar a área do cargo leva a pessoa", async () => {
    const store = getStore();
    const list = await positions.listTeamPositions();
    const analyst = list.find((p) => p.name === "Analista Financeiro Jr")!;
    const apprentice = list.find((p) => p.name === "Jovem Aprendiz")!;
    const place = {
      jobLevel: operator.jobLevel ?? null,
      managerUserId: operator.managerUserId ?? null,
      division: operator.division ?? null,
    };
    // A área enviada não vale: a do cargo manda.
    await team.setTeamMember(admin, operator.id, {
      ...place,
      positionId: analyst.id,
      areaId: await areaId("Comex"),
    });
    let person = await store.get("users", operator.id);
    expect(person?.positionId).toBe(analyst.id);
    expect(person?.areaId).toBe(await areaId("Financeiro"));
    // Sem o campo do cargo (formulário de antes), a área continua a do cargo.
    await team.setTeamMember(admin, operator.id, {
      ...place,
      areaId: await areaId("Comex"),
    });
    person = await store.get("users", operator.id);
    expect(person?.areaId).toBe(await areaId("Financeiro"));

    // Trocar a área do cargo leva quem tem o cargo.
    const moved = await positions.setTeamPositionArea(
      admin,
      analyst.id,
      await areaId("Contabil Fiscal"),
    );
    expect(moved.moved).toBe(1);
    expect((await store.get("users", operator.id))?.areaId).toBe(
      await areaId("Contabil Fiscal"),
    );
    await positions.setTeamPositionArea(
      admin,
      analyst.id,
      await areaId("Financeiro"),
    );
    expect((await store.get("users", operator.id))?.areaId).toBe(
      await areaId("Financeiro"),
    );

    // Cargo sem área: a área é escolhida à mão.
    await team.setTeamMember(admin, operator.id, {
      ...place,
      positionId: apprentice.id,
      areaId: await areaId("Showroom"),
    });
    person = await store.get("users", operator.id);
    expect(person?.positionId).toBe(apprentice.id);
    expect(person?.areaId).toBe(await areaId("Showroom"));

    // Desativado: quem já tem continua; outra pessoa não recebe.
    await positions.setTeamPositionActive(admin, apprentice.id, false);
    await team.setTeamMember(admin, operator.id, {
      ...place,
      positionId: apprentice.id,
      areaId: await areaId("Showroom"),
    });
    expect((await store.get("users", operator.id))?.positionId).toBe(
      apprentice.id,
    );
    expect(
      await code(() =>
        team.setTeamMember(admin, admin.id, {
          jobLevel: admin.jobLevel ?? null,
          managerUserId: admin.managerUserId ?? null,
          division: admin.division ?? null,
          positionId: apprentice.id,
        }),
      ),
    ).toBe("position_inactive");
    expect(
      await code(() =>
        team.setTeamMember(admin, operator.id, {
          ...place,
          positionId: "nao-existe",
        }),
      ),
    ).toBe("position_invalid");
    await positions.setTeamPositionActive(admin, apprentice.id, true);

    // Sem cargo e sem área: como nos dados de demonstração.
    await team.setTeamMember(admin, operator.id, {
      ...place,
      positionId: null,
      areaId: null,
    });
    person = await store.get("users", operator.id);
    expect(person?.positionId).toBeNull();
    expect(person?.areaId).toBeNull();

    const log = await store.list("audit_log", {
      filter: { entityId: analyst.id },
    });
    expect(log.map((e) => e.action).sort()).toEqual(
      [
        "team.position_area",
        "team.position_area",
        "team.position_create",
      ].sort(),
    );
  });

  it("renomear sem repetir", async () => {
    const list = await positions.listTeamPositions();
    const seller = list.find((p) => p.name === "Vendedor Pleno")!;
    expect(
      await code(() =>
        positions.renameTeamPosition(admin, seller.id, "vendedora pleno"),
      ),
    ).toBe("position_exists");
    await positions.renameTeamPosition(admin, seller.id, "Vendedor Pleno II");
    await positions.renameTeamPosition(admin, seller.id, "Vendedor Pleno");
    expect(
      (await positions.listTeamPositions()).find((p) => p.id === seller.id)
        ?.name,
    ).toBe("Vendedor Pleno");
  });
});

describe("ação do cadastro em massa de cargos", () => {
  it("devolve o resumo com a área de cada um; área desconhecida fica de fora", async () => {
    jar.clear();
    await session.signIn("admin@wellmix.com", DEMO_PASSWORD);
    const form = new FormData();
    form.set(
      "names",
      "CARGO\nDiretor\nAnalista de Dados; Dados\nAnalista de BI Sr\tTecnologia da Informação",
    );
    form.set("areaId", "");
    const state = await bulkTeamPositionsAction(
      {
        ok: false,
        error: null,
        message: null,
        done: null,
        created: 0,
        existing: 0,
        groups: [],
        text: "",
        doneAt: null,
      },
      form,
    );
    expect(state.ok).toBe(true);
    expect(state.done).toBe(
      "Pronto: 1 cargo(s) criado(s) e 1 já cadastrado(s).",
    );
    const items = (kind: string) =>
      state.groups.find((g) => g.kind === kind)?.items ?? [];
    expect(items("created")).toEqual([
      "Analista de BI Sr → Tecnologia da Informação",
    ]);
    expect(items("existing")).toEqual(["Diretor → Presidência"]);
    expect(items("unknownArea")).toEqual(["Analista de Dados (área “Dados”)"]);
    expect(items("header")).toEqual(["CARGO"]);
  });
});
