import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import {
  levelOfPosition,
  parseTeamImport,
  proposeTeamImport,
  suggestFromPosition,
} from "@/lib/team-import";

/*
 * Importar equipe (Equipe → "Importar da planilha"; dono, 16/11/2026): a
 * planilha Nome, Cargo, Área, Email vira logins da equipe com o cargo, a
 * área, as funções e o nível sugeridos; o que não dá para afirmar fica "a
 * conferir" no login. Senha provisória igual para todos, com a troca pedida
 * no primeiro acesso. Quem já tem login não é criado de novo.
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
const importing = await import("@/lib/services/team-import");
const { teamImportAction } = await import("@/app/app/actions/team");
type User = import("@/lib/db").User;

const SHARED = "12345678";

/** Os 44 cargos do dono (a lista "AREA"), na ordem. */
const OWNER_POSITIONS = [
  "Designer Gráfico Sênior",
  "Vendedor Key Accounts",
  "Analista Financeiro Jr",
  "Vendedora Pleno",
  "Designer Gráfico Pleno",
  "Analista ADM de Vendas Jr",
  "Assistente Fiscal",
  "Analista ADM de Vendas Sr",
  "Analista de TI Jr",
  "Especialista de Operações",
  "Vendedora Sênior",
  "Promotora de Merchandising",
  "Analista Fiscal Pleno",
  "Assistente de Embalagens",
  "Vendedor Sênior",
  "Analista de Eventos Pleno",
  "Assistente de Cobrança",
  "Jovem Aprendiz",
  "Assistente de Compras",
  "Analista Financeiro Pleno",
  "Analista PMO Sr",
  "Vendedora Jr",
  "Analista de Processos Jr",
  "Analista de Compras Pleno",
  "Analista de Compras Jr",
  "Analista de Automação e BI Pleno",
  "Vendedora Key Accounts",
  "Analista de Planejamento Sr",
  "Assistente Comercial",
  "Analista Fiscal Sênior",
  "Promotor de Merchandising",
  "Analista de Importação Sênior",
  "Analista de Crédito Pleno",
  "Vendedora Pleno I",
  "Vendedor Pleno",
  "Analista de Contas a Pagar Sr",
  "Analista de Contas a Receber Sr",
  "Analista de RH Sênior",
  "Auxiliar de Showroom",
  "Coordenadora de Trade Marketing",
  "Coordenador Regional de Vendas",
  "Diretor",
  "Gerente Nacional de Vendas",
  "Gerente Operações e Processos",
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

describe("leitura da planilha (sem banco)", () => {
  it("títulos, tabulação, e-mail fora do lugar, recusadas e repetidas", () => {
    const parsed = parseTeamImport(
      [
        "Nome\tCargo\tÁrea\tE-mail",
        "Ana Souza\tVendedora Sênior\tComercial\tANA@Empresa.com.br",
        "",
        "Bruno Lima\tAnalista de Compras Jr\tCompras\tbruno@empresa.com.br",
        "X\tDiretor\tPresidência\tx@empresa.com.br",
        "Carla Dias\tDiretor\tPresidência\tsem-email",
        "Ana S.\tVendedora Sênior\tComercial\tana@empresa.com.br",
      ].join("\n"),
    );
    expect(parsed.header).toBe("Nome | Cargo | Área | E-mail");
    expect(parsed.rows.map((r) => [r.line, r.name, r.email])).toEqual([
      [2, "Ana Souza", "ana@empresa.com.br"],
      [4, "Bruno Lima", "bruno@empresa.com.br"],
    ]);
    expect(parsed.rows[1]).toMatchObject({
      position: "Analista de Compras Jr",
      area: "Compras",
    });
    expect(parsed.invalid.map((i) => [i.line, i.reason])).toEqual([
      [5, "name"],
      [6, "email"],
    ]);
    expect(parsed.repeated).toEqual([{ line: 7, email: "ana@empresa.com.br" }]);
  });

  it("a ordem das colunas pelos títulos (coluna a mais fica de fora)", () => {
    const parsed = parseTeamImport(
      "Matrícula;E-mail;Nome;Área;Cargo\n123;dani@empresa.com;Dani Rocha;Financeiro;Analista Financeiro Jr",
    );
    expect(parsed.rows).toEqual([
      {
        line: 2,
        name: "Dani Rocha",
        position: "Analista Financeiro Jr",
        area: "Financeiro",
        email: "dani@empresa.com",
      },
    ]);
  });

  it("sem títulos: Nome, Cargo, Área, Email", () => {
    const parsed = parseTeamImport(
      "Eva Melo; Designer Gráfico Pleno; Marketing; eva@empresa.com",
    );
    expect(parsed.header).toBeNull();
    expect(parsed.rows[0]).toMatchObject({
      name: "Eva Melo",
      position: "Designer Gráfico Pleno",
      area: "Marketing",
      email: "eva@empresa.com",
    });
  });
});

describe("funções e nível sugeridos pelo cargo", () => {
  const sure = (name: string) => suggestFromPosition(name);

  it("os 44 cargos do dono têm sugestão; a dúvida vem com o motivo", () => {
    for (const name of OWNER_POSITIONS) {
      const s = sure(name);
      expect(s.sure || !!s.doubt, name).toBe(true);
    }
  });

  it("os certos", () => {
    for (const name of [
      "Vendedor Key Accounts",
      "Vendedora Pleno",
      "Vendedora Pleno I",
      "Analista ADM de Vendas Jr",
      "Assistente Comercial",
      "Coordenador Regional de Vendas",
    ])
      expect(sure(name), name).toMatchObject({
        functions: ["sales"],
        sure: true,
      });
    expect(sure("Analista de Compras Jr")).toMatchObject({
      functions: ["buyer"],
      sure: true,
    });
    expect(sure("Assistente de Compras").functions).toEqual(["buyer"]);
    expect(sure("Analista de Planejamento Sr").functions).toEqual(["planner"]);
    expect(sure("Analista de Importação Sênior").functions).toEqual([
      "comex_internal",
    ]);
    expect(sure("Designer Gráfico Sênior").functions).toEqual(["designer"]);
    expect(sure("Analista Financeiro Pleno").functions).toEqual(["finance"]);
    expect(sure("Analista de Contas a Pagar Sr")).toMatchObject({
      functions: ["finance"],
      sure: true,
    });
  });

  it("os que ficam a conferir", () => {
    for (const name of [
      "Gerente Nacional de Vendas",
      "Assistente de Embalagens",
      "Analista de Contas a Receber Sr",
      "Analista de Crédito Pleno",
      "Assistente de Cobrança",
      "Assistente Fiscal",
      "Diretor",
      "Coordenadora de Trade Marketing",
      "Promotor de Merchandising",
      "Analista de Eventos Pleno",
      "Gerente Operações e Processos",
      "Analista PMO Sr",
      "Analista de TI Jr",
      "Analista de Automação e BI Pleno",
      "Analista de RH Sênior",
      "Auxiliar de Showroom",
      "Jovem Aprendiz",
    ]) {
      const s = sure(name);
      expect(s.sure, name).toBe(false);
      expect(s.doubt, name).toBeTruthy();
    }
    expect(sure("Diretor").functions).toEqual(["executive_director"]);
    expect(sure("Analista de RH Sênior").functions).toEqual([]);
  });

  it("nível pelo cargo", () => {
    expect(levelOfPosition("Diretor")).toBe("director");
    expect(levelOfPosition("Gerente Nacional de Vendas")).toBe("manager");
    expect(levelOfPosition("Coordenadora de Trade Marketing")).toBe(
      "coordinator",
    );
    expect(levelOfPosition("Vendedora Sênior")).toBe("analyst");
  });

  it("a proposta: cargo e área pelo nome; área diferente e nomes desconhecidos ficam a conferir", () => {
    const areaRows = [
      { id: "a1", name: "Comercial", active: true },
      { id: "a2", name: "Marketing", active: true },
      { id: "a3", name: "Compras", active: true },
    ];
    const positionRows = [
      { id: "p1", name: "Vendedora Sênior", active: true, areaId: "a1" },
      { id: "p2", name: "Jovem Aprendiz", active: true, areaId: null },
    ];
    const [seller, apprentice, unknown] = proposeTeamImport(
      parseTeamImport(
        [
          "Ana;vendedora senior;Marketing;ana@x.com",
          "Bia;Jovem Aprendiz;Compras;bia@x.com",
          "Caio;Estagiário;Jurídico;caio@x.com",
        ].join("\n"),
      ).rows,
      positionRows,
      areaRows,
    );
    expect(seller).toMatchObject({
      positionId: "p1",
      positionName: "Vendedora Sênior",
      areaId: "a1",
      functions: ["sales"],
    });
    expect(seller.review).toEqual([
      'Área na planilha: "Marketing"; o cargo está em "Comercial"',
    ]);
    // Cargo sem área: vale a área da planilha.
    expect(apprentice).toMatchObject({ positionId: "p2", areaId: "a3" });
    expect(unknown.positionId).toBeNull();
    expect(unknown.areaId).toBeNull();
    expect(unknown.review.slice(0, 2)).toEqual([
      'Cargo "Estagiário" não está cadastrado em Cargos',
      'Área "Jurídico" não está cadastrada em Áreas',
    ]);
  });
});

describe("criar os logins", () => {
  const sheet = [
    "Nome\tCargo\tÁrea\tEmail",
    "Ana Souza\tVendedora Sênior\tComercial\tana.souza@wellmix.com",
    "Bruno Lima\tAnalista de Compras Jr\tCompras\tbruno.lima@wellmix.com",
    "Carla Dias\tAnalista de Contas a Receber Sr\tFinanceiro\tcarla.dias@wellmix.com",
    "Otávio Operador\tAnalista de Planejamento Sr\tCompras\toperador@wellmix.com",
    "Fornecedor A\tVendedor Sênior\tComercial\tsupplier.a@china.com",
  ].join("\n");

  beforeAll(async () => {
    await areas.bulkCreateTeamAreas(
      admin,
      "Comercial\nCompras\nFinanceiro\nMarketing",
    );
    await positions.bulkCreateTeamPositions(
      admin,
      [
        "Vendedora Sênior\tComercial",
        "Vendedor Sênior\tComercial",
        "Analista de Compras Jr\tCompras",
        "Analista de Contas a Receber Sr\tFinanceiro",
        "Analista de Planejamento Sr\tCompras",
      ].join("\n"),
      null,
    );
  });

  it("só o administrador; senha com pelo menos 8 caracteres", async () => {
    expect(
      await code(() => importing.runTeamImport(operator, sheet, SHARED)),
    ).toBe("forbidden");
    expect(
      await code(() => importing.runTeamImport(admin, sheet, "1234567")),
    ).toBe("user_password_short");
    expect(await code(() => importing.previewTeamImport(admin, "  \n "))).toBe(
      "import_empty",
    );
  });

  it("a prévia não grava nada e mostra a situação de cada e-mail", async () => {
    const before = (await getStore().list("users")).length;
    const preview = await importing.previewTeamImport(admin, sheet);
    expect(preview.rows.map((r) => [r.email, r.status])).toEqual([
      ["ana.souza@wellmix.com", "new"],
      ["bruno.lima@wellmix.com", "new"],
      ["carla.dias@wellmix.com", "new"],
      ["operador@wellmix.com", "existing"],
      ["supplier.a@china.com", "partner"],
    ]);
    expect((await getStore().list("users")).length).toBe(before);
  });

  it("cria em lotes, com cargo, área, funções, nível e o a conferir; quem já tinha login só ganha cargo e área", async () => {
    const store = getStore();
    const functionsBefore = (await store.get("users", operator.id))!.functions;
    const first = await importing.runTeamImport(admin, sheet, SHARED, 2);
    expect(first.created.map((c) => c.email)).toEqual([
      "ana.souza@wellmix.com",
      "bruno.lima@wellmix.com",
    ]);
    expect(first.remaining).toBe(1);
    expect(first.linked.map((l) => l.email)).toEqual(["operador@wellmix.com"]);
    expect(first.skipped).toEqual([
      {
        name: "Fornecedor A",
        email: "supplier.a@china.com",
        reason: "partner",
      },
    ]);

    // De novo: continua de onde parou, sem repetir ninguém.
    const second = await importing.runTeamImport(admin, sheet, SHARED, 2);
    expect(second.created.map((c) => c.email)).toEqual([
      "carla.dias@wellmix.com",
    ]);
    expect(second.remaining).toBe(0);
    // Ana e Bruno (criados na primeira), Otávio (ligado) e o fornecedor.
    expect(second.skipped.map((s) => [s.email, s.reason])).toEqual([
      ["ana.souza@wellmix.com", "has_place"],
      ["bruno.lima@wellmix.com", "has_place"],
      ["operador@wellmix.com", "has_place"],
      ["supplier.a@china.com", "partner"],
    ]);

    const byEmail = async (email: string) =>
      (await store.list("users", { filter: { email } }))[0];
    const areaList = await areas.listTeamAreas();
    const positionList = await positions.listTeamPositions();
    const areaName = (id: string | null | undefined) =>
      areaList.find((a) => a.id === id)?.name;
    const positionName = (id: string | null | undefined) =>
      positionList.find((p) => p.id === id)?.name;

    const ana = await byEmail("ana.souza@wellmix.com");
    expect(ana).toMatchObject({
      name: "Ana Souza",
      role: "operator",
      mustChangePassword: true,
      functions: ["sales"],
      jobLevel: "analyst",
    });
    expect(positionName(ana.positionId)).toBe("Vendedora Sênior");
    expect(areaName(ana.areaId)).toBe("Comercial");
    expect(ana.reviewNote ?? null).toBeNull();

    const carla = await byEmail("carla.dias@wellmix.com");
    expect(carla.functions).toEqual(["finance"]);
    expect(carla.reviewNote).toContain("Função: Financeiro; conferir");

    // Quem já tinha login: cargo e área da planilha; funções iguais.
    const otavio = (await store.get("users", operator.id))!;
    expect(positionName(otavio.positionId)).toBe("Analista de Planejamento Sr");
    expect(areaName(otavio.areaId)).toBe("Compras");
    expect(otavio.functions).toEqual(functionsBefore);
    expect(otavio.reviewNote).toContain("Já tinha login");

    // O fornecedor ficou como estava.
    const supplier = await byEmail("supplier.a@china.com");
    expect(supplier.positionId ?? null).toBeNull();

    // A senha provisória entra; o primeiro acesso pede a troca.
    jar.clear();
    const signed = await session.signIn("bruno.lima@wellmix.com", SHARED);
    expect(signed.mustChangePassword).toBe(true);

    // Auditoria de cada rodada.
    expect(
      await store.list("audit_log", { filter: { action: "team.import" } }),
    ).toHaveLength(2);
  });

  it("conferido: a marcação sai em Editar acessos", async () => {
    const { setTeamMember } = await import("@/lib/services/team");
    const store = getStore();
    const [carla] = await store.list("users", {
      filter: { email: "carla.dias@wellmix.com" },
    });
    await setTeamMember(admin, carla.id, {
      jobLevel: carla.jobLevel ?? null,
      managerUserId: carla.managerUserId ?? null,
      division: carla.division ?? null,
      reviewNote: null,
    });
    expect((await store.get("users", carla.id))?.reviewNote).toBeNull();
  });

  it("a ação: prévia com as situações e a rodada com o resumo", async () => {
    jar.clear();
    await session.signIn("admin@wellmix.com", DEMO_PASSWORD);
    const form = new FormData();
    form.set("intent", "preview");
    form.set(
      "rows",
      `${sheet}\nDani Rocha\tVendedor Sênior\tComercial\tdani.rocha@wellmix.com`,
    );
    const initial = {
      ok: false,
      error: null,
      message: null,
      intent: null,
      header: null,
      rows: [],
      invalid: [],
      repeated: [],
      result: null,
      doneAt: null,
    };
    const preview = await teamImportAction(initial, form);
    expect(preview.ok).toBe(true);
    expect(preview.result).toBeNull();
    expect(
      preview.rows.find((r) => r.email === "dani.rocha@wellmix.com")?.status,
    ).toBe("new");
    form.set("intent", "run");
    form.set("password", SHARED);
    const run = await teamImportAction(initial, form);
    expect(run.result?.created.map((c) => c.email)).toEqual([
      "dani.rocha@wellmix.com",
    ]);
    expect(
      run.rows.find((r) => r.email === "dani.rocha@wellmix.com")?.status,
    ).toBe("existing");
  });
});
