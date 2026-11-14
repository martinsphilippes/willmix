import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cadastros → Parceiros em três abas (dono, 14/11/2026): comparar "Abre" e
 * "No menu" separadamente, prévia da cópia tela a tela (o que se vê é o que
 * se grava), endereços antigos abrindo o painel certo, origem da
 * configuração e tipos de parceiro mudando só o que veio (sem perder
 * tradução, descrição nem situação).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const lib = await import("@/lib/partner-access");
const view = await import("@/lib/partner-access-view");
const svc = await import("@/lib/services/partner-access");
const types = await import("@/lib/services/partner-types");
const { partnerTypeName } = await import("@/lib/partner-types");
type User = import("@/lib/db").User;

let admin: User;
let operator: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  operator = users.find((u) => u.email === "operador@wellmix.com")!;
});

describe("comparar e prever a cópia (regras puras)", () => {
  const config = lib.setProfileScreens({}, "type:trading", {
    // Trading: sem Solicitações ao fornecedor; Pedidos fora do menu.
    screens: [
      "tasks",
      "notifications",
      "messages",
      "orders",
      "booking",
      "account",
    ],
    menuHidden: ["orders"],
  });
  const trading = lib.resolveProfile(config, "type:trading");
  const factory = lib.resolveProfile(config, "type:factory");

  it("compara Abre e No menu separadamente", () => {
    const rows = lib.compareAccess(trading, factory);
    const quotes = rows.find((r) => r.screen === "quotes")!;
    expect(quotes).toMatchObject({ openDiff: true, menuDiff: false });
    expect(quotes.a).toEqual({ open: false, menu: null });
    const orders = rows.find((r) => r.screen === "orders")!;
    expect(orders).toMatchObject({ openDiff: false, menuDiff: true });
    expect(orders.a).toEqual({ open: true, menu: false });
    expect(orders.b).toEqual({ open: true, menu: true });
    expect(
      rows.filter((r) => r.openDiff || r.menuDiff).map((r) => r.screen),
    ).toEqual(["quotes", "orders"]);
    // Tela interna não entra na comparação.
    expect(rows.some((r) => r.screen === "finance")).toBe(false);
  });

  it("prévia tela a tela: valor atual e o que será gravado, só no destino", () => {
    const { rows, changes } = lib.copyPreview(
      config,
      "type:factory",
      "type:trading",
      ["quotes", "orders", "messages"],
      "replace",
    );
    expect(rows).toEqual([
      {
        screen: "messages",
        before: { open: true, menu: true },
        after: { open: true, menu: true },
        changed: false,
      },
      {
        screen: "quotes",
        before: { open: false, menu: null },
        after: { open: true, menu: true },
        changed: true,
      },
      {
        screen: "orders",
        before: { open: true, menu: false },
        after: { open: true, menu: true },
        changed: true,
      },
    ]);
    expect(lib.changesKey(changes)).toBe("added:quotes,menu_shown:orders");
    // A mesma conta da aplicação: aplicar e prever de novo não muda nada.
    const next = lib.copyScreens(
      config,
      "type:factory",
      "type:trading",
      ["quotes", "orders", "messages"],
      "replace",
    );
    expect(
      lib.copyPreview(
        next,
        "type:factory",
        "type:trading",
        ["quotes"],
        "replace",
      ).changes,
    ).toEqual([]);
    // A origem não muda.
    expect(lib.resolveProfile(next, "type:factory")).toEqual(factory);
  });

  it("impressão digital das mudanças não depende da ordem", () => {
    expect(
      lib.changesKey([
        { screen: "orders", change: "menu_shown" },
        { screen: "quotes", change: "added" },
      ]),
    ).toBe(
      lib.changesKey([
        { screen: "quotes", change: "added" },
        { screen: "orders", change: "menu_shown" },
      ]),
    );
  });

  it("origem: tirar do menu ou devolver é mudança à mão; bloqueio fora do padrão é reconhecido", () => {
    expect(trading.sources.orders).toBe("manual");
    expect(trading.sources.messages).toBe("default");
    expect(lib.blockedFromDefault("type:trading", "quotes")).toBe(true);
    expect(lib.blockedFromDefault("type:trading", "explore")).toBe(false);
    const back = lib.resolveProfile(
      lib.setProfileScreens(config, "type:trading", {
        screens: trading.screens,
        menuHidden: [],
      }),
      "type:trading",
    );
    expect(back.sources.orders).toBe("manual");
    expect(back.menuHidden).toEqual([]);
  });
});

describe("endereço da aba Acessos externos", () => {
  it("endereços antigos abrem o painel sobre a visão por perfil", () => {
    expect(
      view.parseAccessUrl({ view: "copy", from: "role:supplier" }),
    ).toMatchObject({ view: "profile", panel: "copy", from: "role:supplier" });
    expect(
      view.parseAccessUrl({
        view: "compare",
        a: "type:factory",
        b: "role:supplier",
      }),
    ).toMatchObject({
      view: "profile",
      panel: "compare",
      a: "type:factory",
      b: "role:supplier",
    });
    expect(
      view.parseAccessUrl({ view: "screen", screen: "quotes" }),
    ).toMatchObject({
      view: "screen",
      panel: null,
      screen: "quotes",
    });
    // Valores estranhos não passam.
    expect(
      view.parseAccessUrl({ profile: "type:../x", state: "x", screen: "a/b" }),
    ).toMatchObject({ profile: "", state: "", screen: "" });
  });

  it("fechar o painel volta à visão e aos filtros de antes", () => {
    const url = view.parseAccessUrl({
      profile: "type:trading",
      q: "pedidos",
      state: "hidden",
      panel: "copy",
      from: "type:factory",
      screens: ["quotes", "orders"],
    });
    expect(view.closePanelHref(url)).toBe(
      "/app/parties/access?profile=type%3Atrading&q=pedidos&state=hidden",
    );
    expect(view.panelHref(url, "compare", { a: "type:trading" })).toBe(
      "/app/parties/access?profile=type%3Atrading&q=pedidos&state=hidden&panel=compare&a=type%3Atrading",
    );
    const byScreen = view.parseAccessUrl({ view: "screen", screen: "orders" });
    expect(view.closePanelHref(byScreen)).toBe(
      "/app/parties/access?view=screen&screen=orders",
    );
    expect(view.viewHref(url, "screen")).toBe(
      "/app/parties/access?view=screen&profile=type%3Atrading&q=pedidos&state=hidden",
    );
    expect(view.editHref("type:factory", "orders")).toBe(
      "/app/parties/access?profile=type%3Afactory&focus=orders#access-orders",
    );
  });
});

describe("serviço: cópia só com a prévia que foi vista", () => {
  it("a prévia por tela vem do servidor; prévia velha não grava", async () => {
    const { rows, changes } = await svc.previewCopyRows(
      "role:supplier",
      "type:factory",
      ["quotes"],
      "add",
    );
    // A Factory já tem Solicitações ao fornecedor: nada muda.
    expect(rows).toEqual([
      {
        screen: "quotes",
        before: { open: true, menu: true },
        after: { open: true, menu: true },
        changed: false,
      },
    ]);
    expect(changes).toEqual([]);
    // Alguém tira a tela da Factory depois da prévia: aplicar com a prévia
    // antiga recusa e não grava.
    await svc.saveProfileScreens(admin, "type:factory", {
      screens: [
        "tasks",
        "notifications",
        "messages",
        "orders",
        "booking",
        "account",
      ],
      menuHidden: [],
    });
    await expect(
      svc.copyProfileScreens(
        admin,
        "role:supplier",
        "type:factory",
        ["quotes"],
        "add",
        lib.changesKey(changes),
      ),
    ).rejects.toThrow("partner_access_stale");
    const config = await svc.loadPartnerAccess();
    expect(lib.resolveProfile(config, "type:factory").screens).not.toContain(
      "quotes",
    );
    // Com a prévia nova, aplica.
    const fresh = await svc.previewCopyRows(
      "role:supplier",
      "type:factory",
      ["quotes"],
      "add",
    );
    const applied = await svc.copyProfileScreens(
      admin,
      "role:supplier",
      "type:factory",
      ["quotes"],
      "add",
      lib.changesKey(fresh.changes),
    );
    expect(applied).toEqual([{ screen: "quotes", change: "added" }]);
    // Só o destino mudou: a Trading continua no padrão.
    const after = await svc.listAccessProfiles();
    expect(after.find((p) => p.key === "type:trading")?.access.custom).toBe(
      false,
    );
    await svc.resetProfileScreens(admin, "type:factory");
  });
});

describe("tipos de parceiro: mudar só o que veio", () => {
  it("renomear mantém descrição, traduções e situação; inativar mantém os nomes", async () => {
    const created = await types.savePartnerType(admin, {
      value: null,
      name: "Inspeção Têxtil",
      nameEn: "Textile Inspection",
      nameZh: "纺织检验",
      description: "Inspeciona tecidos.",
      active: true,
      allowLogin: true,
    });
    const renamed = await types.updatePartnerType(admin, created.value, {
      name: "Inspeção de Tecidos",
      nameEn: "Textile Inspection",
      nameZh: "纺织检验",
    });
    expect(renamed).toMatchObject({
      key: created.key,
      description: "Inspeciona tecidos.",
      active: true,
      loginRole: "supplier",
    });
    expect(partnerTypeName(renamed, "pt")).toBe("Inspeção de Tecidos");
    expect(partnerTypeName(renamed, "zh")).toBe("纺织检验");
    const off = await types.updatePartnerType(admin, created.value, {
      active: false,
    });
    expect(off).toMatchObject({
      active: false,
      description: "Inspeciona tecidos.",
      loginRole: "supplier",
    });
    expect(partnerTypeName(off, "en")).toBe("Textile Inspection");
    const on = await types.updatePartnerType(admin, created.value, {
      active: true,
    });
    expect(on.active).toBe(true);
    // Auditoria: cada mudança com antes e depois.
    const audits = await getStore().list("audit_log", {
      filter: { action: "partner_type.update", entityId: created.rowId! },
    });
    expect(audits).toHaveLength(3);
  });

  it("tipo de fábrica: inativar não troca o inglês e o chinês pelo nome em português", async () => {
    const before = (await types.getPartnerTypeCatalog()).find(
      (e) => e.value === "agency",
    )!;
    expect(types.editableTypeNames(before)).toEqual({
      pt: "Agência",
      en: partnerTypeName(before, "en"),
      zh: partnerTypeName(before, "zh"),
    });
    const off = await types.updatePartnerType(admin, "agency", {
      active: false,
    });
    expect(partnerTypeName(off, "en")).toBe(partnerTypeName(before, "en"));
    expect(partnerTypeName(off, "zh")).toBe(partnerTypeName(before, "zh"));
    expect(partnerTypeName(off, "pt")).toBe("Agência");
    await types.updatePartnerType(admin, "agency", { active: true });
  });

  it("só o administrador muda; tipo desconhecido recusa", async () => {
    await expect(
      types.updatePartnerType(operator, "agency", { active: false }),
    ).rejects.toThrow();
    await expect(
      types.updatePartnerType(admin, "custom:nao-existe", { active: false }),
    ).rejects.toThrow("not_found");
  });
});
