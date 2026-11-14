import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Equipe e acessos (dono, 14/11/2026; docs/ACCESS.md): a prévia de "Acessos
 * efetivos" usa a mesma regra do servidor; o Personalizado guarda só as
 * exceções (o que o administrador marcou ou desmarcou à mão, inclusive no
 * Início), então mudar uma função muda o resultado dos logins com ela e a
 * exceção continua; o administrador abre e faz tudo; abrir uma tela não
 * concede as ações dela; e a recusa no servidor segue a configuração salva,
 * já na próxima requisição de uma sessão aberta.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const team = await import("@/lib/services/team");
const fns = await import("@/lib/services/team-functions");
const c = await import("@/lib/services/order-cancel");
const r = await import("@/lib/services/requests");
const { orderFromRequest } = await import("./helpers/order");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { accessStamp } = await import("@/lib/auth/access-stamp");
const {
  SCREENS,
  WELLMIX_BASE,
  canOpen,
  functionScreensFor,
  hasCustomScreens,
  screensFor,
} = await import("@/lib/auth/screens");
const { ACTION_KEYS, accessFromFunctions, can, canSeeMoney, resolveFunctions } =
  await import("@/lib/auth/function-access");
const { PERMISSION_MODULES, RETIRED_ACTIONS } =
  await import("@/lib/auth/permission-modules");
const {
  actionSources,
  combineFunctionScreens,
  exceptionsOf,
  inheritedScreens,
  screenSources,
  toggleException,
  withExceptions,
} = await import("@/lib/auth/screen-picker");
type User = import("@/lib/db").User;

const sorted = (set: Iterable<string>) => [...set].sort();

describe("módulos do portal nas telas de permissão", () => {
  it("cada tela e cada ação que vale fica num módulo só", () => {
    const screens = PERMISSION_MODULES.flatMap((m) => [...m.screens]);
    expect(sorted(screens)).toEqual(sorted(SCREENS));
    expect(new Set(screens).size).toBe(screens.length);
    const actions = PERMISSION_MODULES.flatMap((m) => [...m.actions]);
    expect(new Set(actions).size).toBe(actions.length);
    expect(sorted([...actions, ...RETIRED_ACTIONS])).toEqual(
      sorted(ACTION_KEYS),
    );
    // O Início tem as cinco telas livres por função e no Personalizado.
    expect(PERMISSION_MODULES[0].screens).toEqual([
      "home",
      "tasks",
      "sla",
      "messages",
      "notifications",
    ]);
  });
});

describe("regra da prévia (navegador e servidor)", () => {
  const defs = resolveFunctions(null);
  const selections = [
    [],
    ["buyer"],
    ["designer"],
    ["planner", "designer"],
    ["finance", "comex_internal"],
    ["purchasing_director"],
    ["buyer", "desconhecida"],
  ];

  it("o padrão das funções na prévia é o mesmo do servidor", () => {
    for (const selected of selections) {
      const server = functionScreensFor(
        { role: "operator", functions: selected },
        accessFromFunctions(selected, defs),
      );
      expect(sorted(inheritedScreens(selected, defs, WELLMIX_BASE))).toEqual(
        sorted(server),
      );
      expect(sorted(actionSources(selected, defs).keys())).toEqual(
        sorted(accessFromFunctions(selected, defs).actions),
      );
    }
  });

  it("Início: abre se alguma função ativa deixa marcada; sem função, todas", () => {
    const list = [
      { key: "a", screens: ["orders"], baseOff: ["sla", "home"] },
      { key: "b", screens: ["products"], baseOff: ["sla"] },
    ];
    expect(combineFunctionScreens([], list, WELLMIX_BASE).base).toEqual([
      ...WELLMIX_BASE,
    ]);
    const onlyA = combineFunctionScreens(["a"], list, WELLMIX_BASE);
    expect(onlyA.base).not.toContain("sla");
    expect(onlyA.base).not.toContain("home");
    const both = combineFunctionScreens(["a", "b"], list, WELLMIX_BASE);
    expect(both.base).toContain("home");
    expect(both.base).not.toContain("sla");
  });

  it("origem de cada permissão: as funções que liberam, ou o padrão do portal", () => {
    const from = screenSources(["buyer", "planner"], defs, WELLMIX_BASE);
    expect(from.get("booking")).toEqual(["buyer", "planner"]);
    expect(from.get("dashboards")).toEqual(["planner"]);
    expect(from.get("home")).toEqual(["buyer", "planner"]);
    expect(from.has("finance")).toBe(false);
    // Sem função: o Início vem do padrão do portal (lista vazia).
    expect(screenSources([], defs, WELLMIX_BASE).get("tasks")).toEqual([]);
    expect(actionSources(["designer"], defs).get("art.design")).toEqual([
      "designer",
    ]);
  });

  it("função desativada não libera nada", () => {
    const withArchived = [
      ...defs,
      {
        key: "fn_velha",
        name: "Velha",
        builtin: false,
        screens: ["finance" as const],
        actions: ["order.cancel" as const],
        baseOff: [],
        archived: true,
      },
    ];
    const access = accessFromFunctions(["fn_velha"], withArchived);
    expect(access.screens).toEqual([]);
    expect(access.actions).toEqual([]);
    expect(access.base).toEqual([...WELLMIX_BASE]);
  });

  it("Personalizado: as exceções à mão ficam quando as funções mudam", () => {
    const designer = inheritedScreens(["designer"], defs, WELLMIX_BASE);
    let ex = toggleException(
      { added: [], removed: [] },
      "products",
      false,
      designer,
    );
    ex = toggleException(ex, "finance", true, designer);
    ex = toggleException(ex, "messages", false, designer);
    expect(ex).toEqual({
      added: ["finance"],
      removed: ["products", "messages"],
    });
    const both = inheritedScreens(["designer", "buyer"], defs, WELLMIX_BASE);
    const now = withExceptions(both, ex);
    expect(now.has("booking")).toBe(true);
    expect(now.has("products")).toBe(false);
    expect(now.has("messages")).toBe(false);
    expect(now.has("finance")).toBe(true);
    // Voltar a caixa ao padrão das funções apaga a exceção.
    expect(toggleException(ex, "products", true, designer).removed).toEqual([
      "messages",
    ]);
    expect(
      exceptionsOf(
        ["home", "orders", "finance"],
        new Set(["home", "tasks", "orders"]),
      ),
    ).toEqual({ added: ["finance"], removed: ["tasks"] });
  });
});

describe("Personalizado por exceções (servidor)", () => {
  const op = { role: "operator" as const, functions: ["designer"] };

  it("as funções de agora com as exceções por cima, inclusive no Início", () => {
    const custom = {
      ...op,
      screenExceptions: {
        added: ["finance"],
        removed: ["messages", "products"],
      },
    };
    expect(hasCustomScreens(custom)).toBe(true);
    expect(canOpen(custom, "finance")).toBe(true);
    expect(canOpen(custom, "messages")).toBe(false);
    expect(canOpen(custom, "products")).toBe(false);
    expect(canOpen(custom, "marketing")).toBe(true);
    expect(canOpen(custom, "tasks")).toBe(true);
    // Lista antiga marcada uma a uma (de antes das exceções): como antes.
    const legacy = { ...op, screens: ["orders"] };
    expect(hasCustomScreens(legacy)).toBe(true);
    for (const s of WELLMIX_BASE) expect(canOpen(legacy, s)).toBe(true);
    expect(canOpen(legacy, "marketing")).toBe(false);
  });

  it("abrir uma tela não concede as ações dela; o administrador faz tudo", () => {
    const custom = {
      ...op,
      screenExceptions: { added: ["finance", "orders"], removed: [] },
    };
    expect(canOpen(custom, "finance")).toBe(true);
    expect(canSeeMoney(custom)).toBe(false);
    expect(can(custom, "order.cancel")).toBe(false);
    const admin = {
      role: "admin" as const,
      functions: [],
      screenExceptions: { added: [], removed: [...SCREENS] },
    };
    for (const s of SCREENS) expect(canOpen(admin, s)).toBe(true);
    expect(canSeeMoney(admin)).toBe(true);
    expect(can(admin, "order.cancel")).toBe(true);
  });
});

describe("gravação e aplicação (servidor)", () => {
  let admin: User;
  let joao: User;
  const place = { jobLevel: null, managerUserId: null, division: null };
  const store = () => getStore();

  /** Como o getCurrentUser de cada requisição: o login lido de novo, com as funções salvas. */
  async function session(id: string): Promise<User> {
    const user = (await store().get("users", id))!;
    if (user.role === "operator")
      attachAccess(
        user,
        accessFromFunctions(user.functions, await fns.loadFunctionDefs()),
      );
    return user;
  }

  async function newLogin(email: string, functions: string[]) {
    const user = await store().create("users", {
      email,
      name: email.split("@")[0],
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
    });
    await team.setTeamMember(admin, user.id, { ...place, functions });
    return user.id;
  }

  async function designerMarks() {
    const def = (await fns.loadFunctionDefs()).find(
      (d) => d.key === "designer",
    )!;
    return {
      screens: [
        ...WELLMIX_BASE.filter((s) => !def.baseOff.includes(s)),
        ...def.screens,
      ],
      actions: [...def.actions],
    };
  }

  async function newOrder() {
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Teste de acesso",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
      notes: null,
    });
    return orderFromRequest(admin, request, { downPaymentAmount: 300 });
  }

  const cancelInput = {
    reason: "customer_withdrew" as const,
    note: "Teste de permissão",
    settlement: null,
  };

  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    joao = users.find((u) => u.email === "joao@lojista.com")!;
  });

  it("Personalizado grava só as exceções; o padrão limpa; a lista antiga também vale", async () => {
    const id = await newLogin("teo.telas@wellmix.com", ["designer"]);
    let saved = (await store().get("users", id))!;
    expect("screenExceptions" in saved).toBe(false);

    await team.setTeamMember(admin, id, {
      ...place,
      screenExceptions: {
        added: ["finance", "lixo"],
        removed: ["messages", "finance"],
      },
    });
    saved = (await store().get("users", id))!;
    expect(saved.screenExceptions).toEqual({
      added: ["finance"],
      removed: ["messages"],
    });
    expect(saved.screens ?? null).toBeNull();
    expect(screensFor(await session(id)).has("messages")).toBe(false);

    // Padrão das funções: as exceções saem.
    await team.setTeamMember(admin, id, { ...place, screens: null });
    saved = (await store().get("users", id))!;
    expect(saved.screenExceptions ?? null).toBeNull();
    expect(hasCustomScreens(saved)).toBe(false);

    // Lista antiga (chamadas de antes): grava a lista, sem exceções.
    await team.setTeamMember(admin, id, { ...place, screens: ["orders"] });
    saved = (await store().get("users", id))!;
    expect(saved.screens).toEqual(["orders"]);
    expect(saved.screenExceptions ?? null).toBeNull();
  });

  it("função salva vale na hora para os logins com ela: duas funções, Personalizado e administrador", async () => {
    const solo = await newLogin("dina.design@wellmix.com", ["designer"]);
    const duo = await newLogin("duda.duas@wellmix.com", [
      "designer",
      "planner",
    ]);
    const custom = await newLogin("cris.custom@wellmix.com", ["designer"]);
    await team.setTeamMember(admin, custom, {
      ...place,
      screenExceptions: { added: ["finance"], removed: ["products"] },
    });
    const before = accessStamp(await session(solo));
    expect(canOpen(await session(solo), "sla")).toBe(true);
    expect(canOpen(await session(custom), "dashboards")).toBe(false);

    // O administrador tira o Painel de SLA do Início do Designer e dá Painéis.
    const marks = await designerMarks();
    await fns.setFunctionPermissions(
      admin,
      "designer",
      [...marks.screens.filter((s) => s !== "sla"), "dashboards", "products"],
      marks.actions,
    );
    expect(canOpen(await session(solo), "sla")).toBe(false);
    expect(canOpen(await session(solo), "dashboards")).toBe(true);
    expect(accessStamp(await session(solo))).not.toBe(before);
    // Duas funções: o planner deixa o SLA marcado.
    expect(canOpen(await session(duo), "sla")).toBe(true);
    // Personalizado: ganha o que a função ganhou; as exceções continuam.
    const c1 = await session(custom);
    expect(canOpen(c1, "dashboards")).toBe(true);
    expect(canOpen(c1, "sla")).toBe(false);
    expect(canOpen(c1, "finance")).toBe(true);
    expect(canOpen(c1, "products")).toBe(false);
    // Administrador: tudo, sempre.
    expect(canOpen(await session(admin.id), "sla")).toBe(true);

    await fns.resetFunction(admin, "designer");
    expect(canOpen(await session(solo), "sla")).toBe(true);
  });

  it("ação sem permissão é recusada pelo servidor; concedida, passa; retirada com a sessão aberta, volta a recusar", async () => {
    const id = await newLogin("ana.acao@wellmix.com", ["designer"]);
    const order1 = await newOrder();
    await expect(
      c.cancelOrder(await session(id), order1.id, cancelInput),
    ).rejects.toThrow("forbidden");

    const marks = await designerMarks();
    await fns.setFunctionPermissions(admin, "designer", marks.screens, [
      ...marks.actions,
      "order.cancel",
    ]);
    expect(can(await session(id), "order.cancel")).toBe(true);
    await expect(
      c.cancelOrder(await session(id), order1.id, cancelInput),
    ).resolves.not.toThrow();

    // Retirada enquanto a pessoa está com o portal aberto: a próxima
    // requisição já recusa.
    await fns.setFunctionPermissions(
      admin,
      "designer",
      marks.screens,
      marks.actions,
    );
    const order2 = await newOrder();
    await expect(
      c.cancelOrder(await session(id), order2.id, cancelInput),
    ).rejects.toThrow("forbidden");
    await fns.resetFunction(admin, "designer");
  });

  it("salvar a função guarda as ações que saíram do portal como estavam", async () => {
    const before = (await fns.loadFunctionDefs()).find(
      (d) => d.key === "buyer",
    )!;
    expect(before.actions).toContain("dumping.release");
    await fns.setFunctionPermissions(
      admin,
      "buyer",
      [...WELLMIX_BASE, ...before.screens],
      before.actions.filter((a) => a !== "dumping.release"),
    );
    const after = (await fns.loadFunctionDefs()).find(
      (d) => d.key === "buyer",
    )!;
    expect(after.actions).toContain("dumping.release");
    await fns.resetFunction(admin, "buyer");
  });

  it("só o administrador grava", async () => {
    const id = await newLogin("otto.only@wellmix.com", ["designer"]);
    const user = (await store().get("users", id))!;
    await expect(
      team.setTeamMember(user, id, {
        ...place,
        screenExceptions: { added: ["finance"], removed: [] },
      }),
    ).rejects.toThrow();
    await expect(
      fns.setFunctionPermissions(user, "designer", [], []),
    ).rejects.toThrow();
  });
});
