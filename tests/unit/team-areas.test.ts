import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";
import {
  areaNameKey,
  bulkAreaLines,
  findAreaByName,
  planBulkAreas,
} from "@/lib/team-areas";

/*
 * Áreas da equipe (Equipe Acessos e Parceiros → Áreas; dono, 16/11/2026):
 * cadastro só do administrador; o cadastro em massa cria só as que faltam e
 * mantém as que já existem com a grafia cadastrada ("Processos/Projetos" vale
 * por "Processos Projetos"; "Operações e Processos" é outra). Nada mexe em
 * logins, funções ou permissões; a área da pessoa é escolhida em Editar
 * acessos. Tudo na Auditoria.
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
const team = await import("@/lib/services/team");
const { bulkTeamAreasAction } = await import("@/app/app/actions/team");
type User = import("@/lib/db").User;

/** A lista do dono, como foi enviada. */
const OWNER_LIST = [
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

describe("regras do nome (sem banco)", () => {
  it("mesma área sem contar maiúsculas, acentos e pontuação", () => {
    expect(areaNameKey("Processos/Projetos")).toBe(
      areaNameKey("Processos Projetos"),
    );
    expect(areaNameKey("Contábil  Fiscal")).toBe(
      areaNameKey("contabil-fiscal"),
    );
    expect(areaNameKey("Presidência")).toBe(areaNameKey("PRESIDENCIA"));
    expect(areaNameKey("Operações e Processos")).not.toBe(
      areaNameKey("Processos Projetos"),
    );
    expect(areaNameKey("Operações e Processos")).not.toBe(
      areaNameKey("Processos/Projetos"),
    );
  });

  it("linhas do cadastro em massa: sem vazias e sem marcador de lista", () => {
    expect(
      bulkAreaLines(
        "  Marketing \n\n- Showroom\n• Financeiro\r\n1. Comercial;Comex\n2) RH\n3D Design",
      ),
    ).toEqual([
      "Marketing",
      "Showroom",
      "Financeiro",
      "Comercial",
      "Comex",
      "RH",
      "3D Design",
    ]);
  });

  it("a lista do dono: cria só as que faltam e mantém a grafia cadastrada", () => {
    const existing = [
      { id: "a1", name: "Comex", active: true },
      { id: "a2", name: "Processos/Projetos", active: true },
    ];
    const plan = planBulkAreas(OWNER_LIST.join("\n"), existing);
    expect(plan.create).toEqual(
      OWNER_LIST.filter((n) => n !== "Comex" && n !== "Processos Projetos"),
    );
    expect(plan.create).toContain("Operações e Processos");
    expect(plan.existing).toEqual([
      { asked: "Comex", id: "a1", name: "Comex", active: true },
      {
        asked: "Processos Projetos",
        id: "a2",
        name: "Processos/Projetos",
        active: true,
      },
    ]);
    expect(plan.repeated).toEqual([]);
    expect(plan.invalid).toEqual([]);
  });

  it("repetidas entram uma vez; nome curto ou só pontuação fica de fora", () => {
    const plan = planBulkAreas("Comex\ncomex\nCÔMEX\nX\n///\nRH", [
      { id: "z", name: "RH", active: false },
    ]);
    expect(plan.create).toEqual(["Comex"]);
    expect(plan.repeated).toEqual(["comex", "CÔMEX"]);
    expect(plan.invalid).toEqual(["X", "///"]);
    // Desativada também conta como já cadastrada (fica como está).
    expect(plan.existing).toEqual([
      { asked: "RH", id: "z", name: "RH", active: false },
    ]);
  });
});

describe("cadastro de áreas", () => {
  it("só o administrador cadastra", async () => {
    expect(await code(() => areas.createTeamArea(operator, "Marketing"))).toBe(
      "forbidden",
    );
    expect(
      await code(() => areas.bulkCreateTeamAreas(operator, "Marketing")),
    ).toBe("forbidden");
    expect(await areas.listTeamAreas()).toHaveLength(0);
  });

  it("cadastro em massa da lista do dono: 10 criadas, 2 já existiam; logins, funções e permissões intactos", async () => {
    const store = getStore();
    // Já cadastradas antes (uma delas com a grafia "Processos/Projetos").
    await areas.createTeamArea(admin, "Comex");
    await areas.createTeamArea(admin, "Processos/Projetos");
    expect(await code(() => areas.createTeamArea(admin, "COMEX"))).toBe(
      "area_exists",
    );
    expect(
      await code(() => areas.createTeamArea(admin, "Processos Projetos")),
    ).toBe("area_exists");

    const usersBefore = JSON.stringify(await store.list("users"));
    const settingsBefore = JSON.stringify(await store.list("settings"));

    const done = await areas.bulkCreateTeamAreas(admin, OWNER_LIST.join("\n"));
    expect(done.created.map((c) => c.name)).toEqual(
      OWNER_LIST.filter((n) => n !== "Comex" && n !== "Processos Projetos"),
    );
    expect(done.existing.map((e) => [e.asked, e.name])).toEqual([
      ["Comex", "Comex"],
      ["Processos Projetos", "Processos/Projetos"],
    ]);

    // Os 12 representados: os nomes exatos e "Processos/Projetos" como estava.
    const list = await areas.listTeamAreas();
    expect(list).toHaveLength(12);
    for (const name of OWNER_LIST)
      expect(findAreaByName(name, list), name).not.toBeNull();
    expect(list.map((a) => a.name)).toContain("Processos/Projetos");
    expect(list.map((a) => a.name)).not.toContain("Processos Projetos");
    expect(list.map((a) => a.name)).toContain("Operações e Processos");
    expect(list.every((a) => a.active)).toBe(true);

    // Logins (inclusive os administradores), funções e permissões: iguais.
    expect(JSON.stringify(await store.list("users"))).toBe(usersBefore);
    expect(JSON.stringify(await store.list("settings"))).toBe(settingsBefore);

    // Auditoria: cada área criada e o resumo do cadastro em massa.
    const created = await store.list("audit_log", {
      filter: { action: "team.area_create" },
    });
    expect(created).toHaveLength(12);
    const [bulk] = await store.list("audit_log", {
      filter: { action: "team.area_bulk" },
    });
    expect(bulk.summary).toBe(
      "Cadastro em massa de áreas: 10 criada(s), 2 já existia(m)",
    );
    expect(bulk.userId).toBe(admin.id);

    // De novo: nada a criar (todas já cadastradas).
    const again = await areas.bulkCreateTeamAreas(admin, OWNER_LIST.join("\n"));
    expect(again.created).toEqual([]);
    expect(again.existing).toHaveLength(12);
    expect(await areas.listTeamAreas()).toHaveLength(12);
  });

  it("renomear sem repetir e desativar sem apagar", async () => {
    const list = await areas.listTeamAreas();
    const showroom = list.find((a) => a.name === "Showroom")!;
    expect(
      await code(() => areas.renameTeamArea(admin, showroom.id, "marketing")),
    ).toBe("area_exists");
    await areas.renameTeamArea(admin, showroom.id, "Showroom SP");
    await areas.renameTeamArea(admin, showroom.id, "Showroom");
    expect(
      (await areas.listTeamAreas()).find((a) => a.id === showroom.id)?.name,
    ).toBe("Showroom");
    await areas.setTeamAreaActive(admin, showroom.id, false);
    const after = await areas.listTeamAreas();
    expect(after).toHaveLength(12);
    expect(after.find((a) => a.id === showroom.id)?.active).toBe(false);
    await areas.setTeamAreaActive(admin, showroom.id, true);
    const log = await getStore().list("audit_log", {
      filter: { entityId: showroom.id },
    });
    expect(log.map((e) => e.action).sort()).toEqual(
      [
        "team.area_activate",
        "team.area_create",
        "team.area_deactivate",
        "team.area_rename",
        "team.area_rename",
      ].sort(),
    );
  });

  it("área da pessoa: escolhe, mantém a desativada que já tinha e recusa a desativada nova", async () => {
    const list = await areas.listTeamAreas();
    const comex = list.find((a) => a.name === "Comex")!;
    const hr = list.find((a) => a.name === "Recursos Humanos")!;
    const place = {
      jobLevel: operator.jobLevel ?? null,
      managerUserId: operator.managerUserId ?? null,
      division: operator.division ?? null,
    };
    await team.setTeamMember(admin, operator.id, {
      ...place,
      areaId: comex.id,
    });
    expect((await getStore().get("users", operator.id))?.areaId).toBe(comex.id);
    // Sem o campo, a área não muda.
    await team.setTeamMember(admin, operator.id, place);
    expect((await getStore().get("users", operator.id))?.areaId).toBe(comex.id);
    // Desativada: quem já está nela salva o resto sem perdê-la.
    await areas.setTeamAreaActive(admin, comex.id, false);
    await team.setTeamMember(admin, operator.id, {
      ...place,
      areaId: comex.id,
    });
    expect((await getStore().get("users", operator.id))?.areaId).toBe(comex.id);
    // Outra pessoa não entra numa área desativada; área inexistente, recusada.
    expect(
      await code(() =>
        team.setTeamMember(admin, admin.id, {
          jobLevel: admin.jobLevel ?? null,
          managerUserId: admin.managerUserId ?? null,
          division: admin.division ?? null,
          areaId: comex.id,
        }),
      ),
    ).toBe("area_inactive");
    expect(
      await code(() =>
        team.setTeamMember(admin, operator.id, {
          ...place,
          areaId: "nao-existe",
        }),
      ),
    ).toBe("area_invalid");
    await areas.setTeamAreaActive(admin, comex.id, true);
    await team.setTeamMember(admin, operator.id, { ...place, areaId: hr.id });
    expect((await getStore().get("users", operator.id))?.areaId).toBe(hr.id);
    // Sem área.
    await team.setTeamMember(admin, operator.id, { ...place, areaId: null });
    expect((await getStore().get("users", operator.id))?.areaId).toBeNull();
  });
});

describe("ação do cadastro em massa", () => {
  const send = async (names: string) => {
    const form = new FormData();
    form.set("names", names);
    return bulkTeamAreasAction(
      {
        ok: false,
        error: null,
        message: null,
        created: [],
        existing: [],
        repeated: [],
        invalid: [],
        text: "",
        doneAt: null,
      },
      form,
    );
  };

  it("devolve o resumo; vazio, o motivo e o texto colado", async () => {
    jar.clear();
    await session.signIn("admin@wellmix.com", DEMO_PASSWORD);
    const ok = await send("Comex\nLogística Reversa\n- Logistica reversa");
    expect(ok.ok).toBe(true);
    expect(ok.created).toEqual(["Logística Reversa"]);
    expect(ok.existing).toEqual([
      { asked: "Comex", name: "Comex", active: true },
    ]);
    expect(ok.repeated).toEqual(["Logistica reversa"]);

    const empty = await send("  \n - \n");
    expect(empty.ok).toBe(false);
    expect(empty.error).toBe("area_bulk_empty");
    expect(empty.message).toBe("Cole ao menos uma área, uma por linha.");

    jar.clear();
    await session.signIn("operador@wellmix.com", DEMO_PASSWORD);
    const refused = await send("Jurídico");
    expect(refused.ok).toBe(false);
    expect(refused.text).toBe("Jurídico");
    expect(
      (await areas.listTeamAreas()).some((a) => a.name === "Jurídico"),
    ).toBe(false);
  });
});
