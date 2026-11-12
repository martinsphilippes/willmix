import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Gestão de telas dos logins externos (docs/PARTNER_ACCESS.md): padrão dos
 * tipos novos igual ao do Fornecedor, conceder pelo catálogo, copiar em
 * qualquer direção, comparar, telas internas bloqueadas, revogação valendo
 * na leitura seguinte, auditoria e só o administrador.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lib = await import("@/lib/partner-access");
const svc = await import("@/lib/services/partner-access");
const { ROLE_SCREENS, screensFor, menuScreensFor } =
  await import("@/lib/auth/screens");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { navFor, flattenNav } = await import("@/lib/nav");
const { PARTY_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;
let supplier: User;
let trader: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
  supplier = users.find((u) => u.email === "supplier.a@china.com")!;
  const store = getStore();
  const trading = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "trading",
    name: "Yiwu Trading Co",
    country: "CN",
    email: null,
    phone: null,
    taxId: null,
    notes: null,
    active: true,
  });
  const { createPortalLogin } = await import("@/lib/services/portal-access");
  trader = await createPortalLogin(admin, {
    name: "Wang",
    email: "wang@trading.com",
    password: "senha-forte-123",
    role: "supplier",
    partyId: trading.id,
    locale: "zh",
  } as Parameters<typeof createPortalLogin>[1]);
});

/** As telas que o login abre agora (como a sessão resolve a cada requisição). */
async function screensNow(user: User) {
  const fresh = { ...user };
  const access = await svc.externalAccessFor(fresh);
  if (access)
    attachAccess(fresh, {
      screens: [],
      actions: [],
      external: access.screens,
      menuHidden: access.menuHidden,
    });
  return {
    open: [...screensFor(fresh)].sort(),
    menu: [...menuScreensFor(fresh)].sort(),
    links: flattenNav(navFor(fresh)).map((l) => l.href),
  };
}

describe("regras puras", () => {
  it("padrão: o papel; nos tipos novos, o do Fornecedor", () => {
    expect(lib.defaultScreens("role:agency")).toEqual([...ROLE_SCREENS.agency]);
    for (const key of ["type:factory", "type:gp", "type:x"])
      expect(lib.defaultScreens(key)).toEqual([...ROLE_SCREENS.supplier]);
    // Trading: as do Fornecedor mais a tela Booking (só os bookings dele).
    expect(lib.defaultScreens("type:trading")).toEqual([
      ...ROLE_SCREENS.supplier,
      "booking",
    ]);
    // O Booking é uma tela interna adaptada: pode ser liberada a um login
    // externo e tem dados para quem entra como o Fornecedor (responsável ou
    // fornecedor do booking); nos outros papéis abre vazia. Não vem aberta
    // no Fornecedor comum.
    expect(lib.isGrantable("booking")).toBe(true);
    expect(lib.isAdaptedInternal("booking")).toBe(true);
    expect(lib.isAdaptedInternal("orders")).toBe(false);
    expect(lib.originRoles("booking")).toEqual(["supplier"]);
    expect(lib.isLimitedFor("booking", "type:trading")).toBe(false);
    expect(lib.isLimitedFor("booking", "role:supplier")).toBe(false);
    expect(lib.isLimitedFor("booking", "role:customer")).toBe(true);
    expect(lib.isLimitedFor("booking", "role:agency")).toBe(true);
    expect(lib.defaultScreens("role:supplier")).not.toContain("booking");
    // Perfil do Trading gravado antes de o Booking existir: ganha a tela;
    // depois de o administrador gravar de novo, vale o que ele marcou.
    const old = {
      "type:trading": {
        screens: ["home", "orders"],
        menuHidden: [],
        sources: {},
      },
    };
    expect(lib.resolveProfile(old, "type:trading").screens).toContain(
      "booking",
    );
    const saved = lib.setProfileScreens(old, "type:trading", {
      screens: ["orders"],
      menuHidden: [],
    });
    expect(lib.resolveProfile(saved, "type:trading").screens).not.toContain(
      "booking",
    );
    const access = lib.resolveProfile({}, "type:trading");
    expect(access.custom).toBe(false);
    expect(access.sources.orders).toBe("default");
  });

  it("telas internas da Wellmix não entram em perfil externo", () => {
    expect(lib.isGrantable("orders")).toBe(true);
    expect(lib.isGrantable("explore")).toBe(true);
    for (const internal of ["finance", "parties", "settings", "superplan"])
      expect(lib.isGrantable(internal as never)).toBe(false);
    expect(() =>
      lib.setProfileScreens({}, "type:trading", {
        screens: ["orders", "finance"],
        menuHidden: [],
      }),
    ).toThrow("partner_access_internal_screen");
    // Tela de outra classe de login (a vitrine do Cliente): pode ser liberada
    // a qualquer perfil; fica marcada como "sem dados neste perfil" até ser
    // adaptada. As que mostram os dados da própria empresa valem inteiras.
    expect(lib.isLimitedFor("explore", "role:customer")).toBe(false);
    expect(lib.isLimitedFor("explore", "type:trading")).toBe(true);
    expect(lib.isLimitedFor("quotes", "role:customer")).toBe(true);
    expect(lib.isLimitedFor("quotes", "type:gp")).toBe(false);
    for (const own of ["orders", "penalties", "messages"] as const)
      expect(lib.isLimitedFor(own, "type:gp")).toBe(false);
    expect(lib.isLimitedFor("finance" as never, "type:gp")).toBe(false);
    const granted = lib.resolveProfile(
      lib.setProfileScreens({}, "type:trading", {
        screens: ["orders", "explore", "penalties"],
        menuHidden: [],
      }),
      "type:trading",
    );
    expect(granted.screens).toEqual(
      expect.arrayContaining(["explore", "penalties"]),
    );
    expect(granted.sources.explore).toBe("manual");
    // Copiar a vitrine do Cliente para a Factory vale.
    const copied = lib.copyScreens(
      {},
      "role:customer",
      "type:factory",
      ["explore"],
      "add",
    );
    expect(lib.resolveProfile(copied, "type:factory").sources.explore).toBe(
      "copy:role:customer",
    );
    // Um gravado antigo com tela interna não vale.
    expect(
      lib.resolveProfile(
        {
          "type:gp": {
            screens: ["orders", "finance"],
            menuHidden: [],
            sources: {},
          },
        },
        "type:gp",
      ).screens,
    ).not.toContain("finance");
  });

  it("conceder: o início fica sempre; tirar e devolver marca a tela como liberada à mão", () => {
    const less = lib.setProfileScreens({}, "type:gp", {
      screens: ["orders", "tasks"],
      menuHidden: ["tasks", "home"],
    });
    const gp = lib.resolveProfile(less, "type:gp");
    expect([...gp.screens].sort()).toEqual(["home", "orders", "tasks"]);
    expect(gp.menuHidden).toEqual(["tasks"]);
    expect(
      lib
        .diffProfiles(lib.resolveProfile({}, "type:gp"), gp)
        .map((c) => `${c.change}:${c.screen}`),
    ).toEqual(
      expect.arrayContaining([
        "removed:quotes",
        "removed:account",
        "menu_hidden:tasks",
      ]),
    );
    const back = lib.resolveProfile(
      lib.setProfileScreens(less, "type:gp", {
        screens: ["orders", "tasks", "quotes"],
        menuHidden: [],
      }),
      "type:gp",
    );
    expect(back.sources).toMatchObject({ orders: "default", quotes: "manual" });
  });

  it("copiar: adicionar só acrescenta; substituir iguala (e tira); a origem não muda", () => {
    // Trading sem cotações; copia Cotações do Fornecedor.
    let config = lib.setProfileScreens({}, "type:trading", {
      screens: ["orders"],
      menuHidden: [],
    });
    config = lib.copyScreens(
      config,
      "role:supplier",
      "type:trading",
      ["quotes"],
      "add",
    );
    const trading = lib.resolveProfile(config, "type:trading");
    expect(trading.screens).toContain("quotes");
    expect(trading.sources.quotes).toBe("copy:role:supplier");
    expect(config["role:supplier"]).toBeUndefined();
    // Trading → Factory, substituindo: Factory perde a conta corrente (que a
    // Trading não tem) e fica igual nas telas escolhidas.
    config = lib.copyScreens(
      config,
      "type:trading",
      "type:factory",
      ["quotes", "account"],
      "replace",
    );
    const factory = lib.resolveProfile(config, "type:factory");
    expect(factory.screens).toContain("quotes");
    expect(factory.screens).not.toContain("account");
    // "Adicionar" nunca tira: a mesma cópia em modo adicionar manteria a conta.
    const kept = lib.copyScreens(
      lib.resetProfile(config, "type:factory"),
      "type:trading",
      "type:factory",
      ["quotes", "account"],
      "add",
    );
    expect(lib.resolveProfile(kept, "type:factory").screens).toContain(
      "account",
    );
    // Sentido inverso (GP → Fornecedor): o Fornecedor fica como o GP em Pedidos
    // (abre, fora do menu) e perde Cotações, que o GP não tem.
    const reverse = lib.copyScreens(
      lib.setProfileScreens(config, "type:gp", {
        screens: ["orders", "tasks"],
        menuHidden: ["orders"],
      }),
      "type:gp",
      "role:supplier",
      ["orders", "quotes"],
      "replace",
    );
    const fornecedor = lib.resolveProfile(reverse, "role:supplier");
    expect(fornecedor.menuHidden).toEqual(["orders"]);
    expect(fornecedor.screens).not.toContain("quotes");
    expect(fornecedor.screens).toContain("account");
    expect(() =>
      lib.copyScreens(config, "type:gp", "type:gp", ["orders"], "add"),
    ).toThrow("partner_access_profile");
    expect(() =>
      lib.copyScreens(config, "type:gp", "type:trading", [], "add"),
    ).toThrow("partner_access_pick");
  });
});

describe("serviço e sessão", () => {
  it("o login de Trading nasce com as telas do Fornecedor mais o Booking", async () => {
    const now = await screensNow(trader);
    expect(now.open).toEqual([...ROLE_SCREENS.supplier, "booking"].sort());
    // O menu é o do Fornecedor mais a entrada do Booking.
    expect(now.links).toContain("/app/booking");
    expect(now.links.filter((l) => l !== "/app/booking")).toEqual(
      (await screensNow(supplier)).links,
    );
    expect((await screensNow(supplier)).links).not.toContain("/app/booking");
    const profiles = await svc.listAccessProfiles();
    const trading = profiles.find((p) => p.key === "type:trading")!;
    expect(trading.users).toBe(1);
    expect(trading.access.custom).toBe(false);
    // Os quatro novos, os criados com login e todos os papéis externos.
    expect(profiles.map((p) => p.key)).toEqual(
      expect.arrayContaining([
        "type:trading",
        "type:factory",
        "type:supplier_partner",
        "type:gp",
        "role:supplier",
        "role:customer",
        "role:agency",
      ]),
    );
  });

  it("só o administrador muda; perfil desconhecido recusa", async () => {
    for (const who of [operator, supplier, trader])
      await expect(
        svc.saveProfileScreens(who, "type:trading", {
          screens: ["orders"],
          menuHidden: [],
        }),
      ).rejects.toThrow();
    await expect(
      svc.saveProfileScreens(admin, "type:nao_existe", {
        screens: ["orders"],
        menuHidden: [],
      }),
    ).rejects.toThrow("partner_access_profile");
  });

  it("revogar vale na leitura seguinte, só para o perfil mexido; tela fora do menu continua abrindo", async () => {
    const changes = await svc.saveProfileScreens(admin, "type:trading", {
      screens: ["tasks", "notifications", "messages", "orders"],
      menuHidden: ["orders"],
    });
    expect(changes.map((c) => `${c.change}:${c.screen}`).sort()).toEqual([
      "menu_hidden:orders",
      "removed:account",
      "removed:booking",
      "removed:quotes",
    ]);
    const now = await screensNow(trader);
    expect(now.open).not.toContain("quotes");
    // Pedidos abre (por link), mas saiu do menu.
    expect(now.open).toContain("orders");
    expect(now.links).not.toContain("/app/orders");
    expect(now.links).not.toContain("/app/quotes");
    // O Fornecedor de sempre não mudou.
    expect((await screensNow(supplier)).open).toEqual(
      [...ROLE_SCREENS.supplier].sort(),
    );
    const audits = await getStore().list("audit_log", {
      filter: { action: "partner_access.set", entityId: "type:trading" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].before).toMatchObject({
      screens: expect.arrayContaining(["quotes"]),
    });
    expect((audits[0].after as { screens: string[] }).screens).not.toContain(
      "quotes",
    );
  });

  it("copiar com prévia: a prévia é o que a cópia grava; auditoria com origem e destino", async () => {
    const preview = await svc.previewCopy(
      "role:supplier",
      "type:trading",
      ["quotes"],
      "add",
    );
    expect(preview).toEqual([{ screen: "quotes", change: "added" }]);
    // A prévia não gravou nada.
    expect((await screensNow(trader)).open).not.toContain("quotes");
    const applied = await svc.copyProfileScreens(
      admin,
      "role:supplier",
      "type:trading",
      ["quotes"],
      "add",
    );
    expect(applied).toEqual(preview);
    expect((await screensNow(trader)).open).toContain("quotes");
    // Trading → Factory e GP → Fornecedor (sentido inverso).
    // Trading → Factory e Factory → Fornecedor (sentido inverso), substituindo:
    // Pedidos fica fora do menu nos dois, como na Trading.
    await svc.copyProfileScreens(
      admin,
      "type:trading",
      "type:factory",
      ["orders"],
      "replace",
    );
    await svc.copyProfileScreens(
      admin,
      "type:factory",
      "role:supplier",
      ["orders"],
      "replace",
    );
    const fornecedor = await screensNow(supplier);
    expect(fornecedor.open).toContain("orders");
    expect(fornecedor.links).not.toContain("/app/orders");
    // Tela de outra classe de login (a vitrine do Cliente) → Trading: vale,
    // e entra no menu de quem recebeu.
    await svc.copyProfileScreens(
      admin,
      "role:customer",
      "type:trading",
      ["explore"],
      "add",
    );
    const withShowcase = await screensNow(trader);
    expect(withShowcase.open).toContain("explore");
    expect(withShowcase.links).toContain("/app/explore");
    await expect(
      svc.copyProfileScreens(
        trader,
        "role:supplier",
        "type:trading",
        ["account"],
        "add",
      ),
    ).rejects.toThrow();
    const audits = await getStore().list("audit_log", {
      filter: { action: "partner_access.copy" },
    });
    expect(audits).toHaveLength(4);
    expect(
      audits.some(
        (a) =>
          (a.after as { from: string; to: string }).from === "role:supplier" &&
          (a.after as { from: string; to: string }).to === "type:trading",
      ),
    ).toBe(true);
  });

  it("voltar ao padrão devolve as telas de fábrica", async () => {
    await svc.resetProfileScreens(admin, "role:supplier");
    await svc.resetProfileScreens(admin, "type:trading");
    expect((await screensNow(supplier)).open).toEqual(
      [...ROLE_SCREENS.supplier].sort(),
    );
    expect((await screensNow(trader)).open).toEqual(
      [...ROLE_SCREENS.supplier, "booking"].sort(),
    );
  });
});
