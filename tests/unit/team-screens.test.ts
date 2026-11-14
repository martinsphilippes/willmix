import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Card "Telas que o login abre" de Editar acessos (dono, 14/11/2026;
 * docs/ACCESS.md): as caixas reagem na hora às funções marcadas, com a mesma
 * regra do servidor; no Personalizado, o que o administrador marca ou
 * desmarca à mão continua quando as funções mudam, e as telas do Início
 * também ficam livres (users.screensBaseOff). Admin continua com tudo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const team = await import("@/lib/services/team");
const { WELLMIX_BASE, canOpen, customBaseFor, functionScreensFor, screensFor } =
  await import("@/lib/auth/screens");
const { accessFromFunctions, resolveFunctions } =
  await import("@/lib/auth/function-access");
const {
  combineFunctionScreens,
  exceptionsOf,
  inheritedScreens,
  toggleException,
  withExceptions,
} = await import("@/lib/auth/screen-picker");
type User = import("@/lib/db").User;

const sorted = (set: Iterable<string>) => [...set].sort();

describe("regra das caixas (navegador e servidor)", () => {
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

  it("o padrão das funções no card é o mesmo do servidor", () => {
    for (const selected of selections) {
      const server = functionScreensFor(
        { role: "operator", functions: selected },
        accessFromFunctions(selected, defs),
      );
      expect(sorted(inheritedScreens(selected, defs, WELLMIX_BASE))).toEqual(
        sorted(server),
      );
    }
  });

  it("Início: abre se alguma função ativa deixa marcada; sem função, todas", () => {
    const fns = [
      { key: "a", screens: ["orders"], baseOff: ["sla", "home"] },
      { key: "b", screens: ["products"], baseOff: ["sla"] },
    ];
    expect(combineFunctionScreens([], fns, WELLMIX_BASE).base).toEqual([
      ...WELLMIX_BASE,
    ]);
    const onlyA = combineFunctionScreens(["a"], fns, WELLMIX_BASE);
    expect(onlyA.base).not.toContain("sla");
    expect(onlyA.base).not.toContain("home");
    expect(onlyA.screens).toEqual(["orders"]);
    const both = combineFunctionScreens(["a", "b"], fns, WELLMIX_BASE);
    expect(both.base).toContain("home");
    expect(both.base).not.toContain("sla");
    expect(sorted(both.screens)).toEqual(["orders", "products"]);
  });

  it("função desativada não libera nada (o servidor e o card não a contam)", () => {
    const withArchived = [
      ...defs,
      {
        key: "fn_velha",
        name: "Velha",
        builtin: false,
        screens: ["finance" as const],
        actions: [],
        baseOff: [],
        archived: true,
      },
    ];
    const access = accessFromFunctions(["fn_velha"], withArchived);
    expect(access.screens).toEqual([]);
    expect(access.base).toEqual([...WELLMIX_BASE]);
  });

  it("Personalizado: as exceções à mão ficam quando as funções mudam", () => {
    const designer = inheritedScreens(["designer"], defs, WELLMIX_BASE);
    // À mão: tira Produtos (herdada) e põe Financeiro (não herdada).
    let ex = toggleException(
      { added: [], removed: [] },
      "products",
      false,
      designer,
    );
    ex = toggleException(ex, "finance", true, designer);
    expect(ex).toEqual({ added: ["finance"], removed: ["products"] });
    // Marca o comprador (que também libera Produtos e o Book).
    const both = inheritedScreens(["designer", "buyer"], defs, WELLMIX_BASE);
    const now = withExceptions(both, ex);
    expect(now.has("booking")).toBe(true);
    expect(now.has("products")).toBe(false);
    expect(now.has("finance")).toBe(true);
    // Desmarca o comprador: o Book sai; as exceções continuam.
    const back = withExceptions(designer, ex);
    expect(back.has("booking")).toBe(false);
    expect(back.has("products")).toBe(false);
    expect(back.has("finance")).toBe(true);
    // Voltar a caixa ao padrão das funções apaga a exceção.
    expect(toggleException(ex, "products", true, designer)).toEqual({
      added: ["finance"],
      removed: [],
    });
  });

  it("lista gravada: as exceções são a diferença para o padrão das funções", () => {
    const inherited = new Set(["home", "tasks", "orders"]);
    expect(exceptionsOf(["home", "orders", "finance"], inherited)).toEqual({
      added: ["finance"],
      removed: ["tasks"],
    });
  });
});

describe("Início no Personalizado (servidor)", () => {
  const op = { role: "operator" as const, functions: ["designer"] };

  it("as caixas do Início desmarcadas não abrem; nula = todas, como antes", () => {
    const legacy = { ...op, screens: ["orders"] };
    for (const s of WELLMIX_BASE) expect(canOpen(legacy, s)).toBe(true);
    const custom = {
      ...op,
      screens: ["orders"],
      screensBaseOff: ["messages", "sla"],
    };
    expect(customBaseFor(custom)).toEqual(["home", "tasks", "notifications"]);
    expect(canOpen(custom, "messages")).toBe(false);
    expect(canOpen(custom, "sla")).toBe(false);
    expect(canOpen(custom, "tasks")).toBe(true);
    expect(canOpen(custom, "orders")).toBe(true);
    // Tela do Início que sobrou na lista não vence o que foi desmarcado.
    expect(
      canOpen({ ...custom, screens: ["orders", "messages"] }, "messages"),
    ).toBe(false);
  });

  it("no padrão das funções a lista do Início não vale; admin abre tudo", () => {
    expect(canOpen({ ...op, screensBaseOff: ["messages"] }, "messages")).toBe(
      true,
    );
    const admin = {
      role: "admin" as const,
      screens: [],
      screensBaseOff: [...WELLMIX_BASE],
    };
    for (const s of WELLMIX_BASE) expect(canOpen(admin, s)).toBe(true);
    expect(canOpen(admin, "finance")).toBe(true);
  });
});

describe("gravação (setTeamMember)", () => {
  let admin: User;
  let op: User;
  const place = { jobLevel: null, managerUserId: null, division: null };
  const reload = async () => (await getStore().get("users", op.id))!;

  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    op = await getStore().create("users", {
      email: "teo.telas@wellmix.com",
      name: "Teo Telas",
      role: "operator",
      partyId: null,
      locale: "pt",
      passwordHash: null,
      active: true,
      importerId: null,
    });
  });

  it("grava o Início desmarcado no Personalizado e o padrão limpa", async () => {
    // Sem a lista do Início: a coluna nem é escrita (logins antigos ficam sem).
    await team.setTeamMember(admin, op.id, {
      ...place,
      functions: ["designer"],
      screens: ["orders", "products"],
      screensBaseOff: [],
    });
    let saved = await reload();
    expect(saved.screens).toEqual(["orders", "products"]);
    expect("screensBaseOff" in saved).toBe(false);

    // Só telas do Início, na ordem do menu.
    await team.setTeamMember(admin, op.id, {
      ...place,
      screens: ["orders"],
      screensBaseOff: ["sla", "orders", "messages", "lixo"],
    });
    saved = await reload();
    expect(saved.screensBaseOff).toEqual(["sla", "messages"]);
    expect(sorted(screensFor(saved))).toEqual(
      sorted(["home", "tasks", "notifications", "orders"]),
    );

    // Sem a lista no envio: não muda.
    await team.setTeamMember(admin, op.id, { ...place, screens: ["orders"] });
    expect((await reload()).screensBaseOff).toEqual(["sla", "messages"]);

    // Padrão das funções: volta a nula (o Início segue as funções).
    await team.setTeamMember(admin, op.id, { ...place, screens: null });
    saved = await reload();
    expect(saved.screens ?? null).toBeNull();
    expect(saved.screensBaseOff ?? null).toBeNull();
    for (const s of WELLMIX_BASE) expect(canOpen(saved, s)).toBe(true);
  });

  it("só o administrador muda", async () => {
    await expect(
      team.setTeamMember(op, op.id, {
        ...place,
        screens: ["orders"],
        screensBaseOff: ["tasks"],
      }),
    ).rejects.toThrow();
  });
});
