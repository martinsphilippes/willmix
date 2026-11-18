import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * TS - Trading Sales e Venda - Encomenda (dono, 16/11/2026;
 * docs/REQUEST_SCREENS.md): duas telas de nova solicitação no Produto novo,
 * logo abaixo do Overview, com o tipo de operação fixo pela tela e o acesso
 * de cada uma no controle de telas de sempre. A Nova solicitação de
 * Encomendas continua como está.
 */
const h = vi.hoisted(() => ({
  current: null as unknown,
  redirects: [] as string[],
  terms: [] as Array<{ input: Record<string, unknown>; opts: unknown }>,
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
// O idioma de quem envia (cookie): fora da requisição, o padrão.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Map(),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.current,
}));
// A conferência das condições (país, família, transportadora) tem os testes
// dela (tests/unit/order-terms.test.ts); aqui, o que a tela manda conferir.
vi.mock("@/lib/services/order-terms", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/services/order-terms")>();
  return {
    ...real,
    resolveOrderTerms: async (
      input: Record<string, string | null>,
      opts: { operationType?: "ts" | "sale" } = {},
    ) => {
      h.terms.push({ input, opts });
      const operationType = opts.operationType ?? input.operationType;
      if (!opts.operationType && operationType !== "ts")
        throw new real.OrderTermsError("order_terms_operation_disabled");
      return {
        operationType,
        saleFormat: "wd",
        wellmixTier: null,
        carrierCaller: "customer",
        carrier: null,
        redispatch: null,
        redispatchRequired: false,
        originCountry: "CHINA",
        originCountryName: "CHINA",
        productFamily: "fm:UTILIDADES",
        productFamilyName: "UTILIDADES",
        noReturnsNotice: true,
        confirmation: null,
      };
    },
    assertProductsMatchOrigin: async () => {},
  };
});

withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const screens = await import("@/lib/auth/screens");
const fa = await import("@/lib/auth/function-access");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { navFor, flattenNav, isActiveLink } = await import("@/lib/nav");
const { PERMISSION_MODULES } = await import("@/lib/auth/permission-modules");
const { isGrantable } = await import("@/lib/partner-access");
const drafts = await import("@/lib/services/request-drafts");
const { REQUEST_SCREEN, draftIsReplenishment, draftResumeHref, draftScreenOf } =
  await import("@/lib/request-screens");
const actions = await import("@/app/app/actions");
const draftActions = await import("@/app/app/actions/request-drafts");
type User = import("@/lib/db").User;

const op = (functions: string[]) => ({
  role: "operator" as const,
  functions,
});

let admin: User;
let buyer: User;
let joao: User;
let designer: User;
let planner: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const store = getStore();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  const operator = users.find((u) => u.email === "operador@wellmix.com")!;
  buyer = await store.update("users", operator.id, { functions: ["buyer"] });
  designer = await store.create("users", {
    ...operator,
    id: undefined,
    email: "designer.ts@wellmix.com",
    name: "Designer TS",
    functions: ["designer"],
  } as never);
  // Planner: abre Encomendas e tem "Abrir reposição", mas não a tela Venda.
  planner = await store.create("users", {
    ...operator,
    id: undefined,
    email: "planner.rep@wellmix.com",
    name: "Planner Reposição",
    functions: ["planner"],
  } as never);
});

describe("acesso de cada tela (o controle de telas de sempre)", () => {
  it("padrão: Comprador só TS; Gerente de produto e diretorias as duas; administrador tudo; os outros, nada", () => {
    const opens = (fn: string) => {
      const has = screens.screensFor(op([fn]));
      return [has.has("requestTs"), has.has("requestSale")];
    };
    expect(opens("buyer")).toEqual([true, false]);
    expect(opens("product_manager")).toEqual([true, true]);
    expect(opens("purchasing_director")).toEqual([true, true]);
    expect(opens("executive_director")).toEqual([true, true]);
    for (const fn of [
      "planner",
      "catalog",
      "finance",
      "designer",
      "comex_internal",
      "quality",
      "sales",
    ])
      expect(opens(fn)).toEqual([false, false]);
    const adminHas = screens.screensFor({ role: "admin" });
    expect(adminHas.has("requestTs") && adminHas.has("requestSale")).toBe(true);
    // Fora da Wellmix, nunca (nem a Gestão de telas oferece).
    expect(screens.screensFor({ role: "customer" }).has("requestTs")).toBe(
      false,
    );
    expect(isGrantable("requestTs")).toBe(false);
    expect(isGrantable("requestSale")).toBe(false);
  });

  it("funções já gravadas (como em produção): a tela nova chega pelo padrão sem mexer no que o administrador marcou", () => {
    // Gravadas antes de 16/11/2026: sem a lista knownScreens.
    const defs = fa.resolveFunctions({
      functions: [
        { key: "buyer", screens: ["booking", "requests", "orders"] },
        { key: "product_manager", screens: ["booking", "requests"] },
        { key: "purchasing_director", screens: ["orders"] },
        { key: "planner", screens: ["requests"] },
        { key: "fn_vendas_sul", name: "Vendas Sul", screens: ["requests"] },
      ],
    });
    const screensOf = (key: string) => defs.find((d) => d.key === key)!.screens;
    expect(screensOf("buyer")).toEqual([
      "booking",
      "requests",
      "requestTs",
      "orders",
    ]);
    expect(screensOf("product_manager")).toEqual(
      expect.arrayContaining(["requestTs", "requestSale"]),
    );
    expect(screensOf("purchasing_director")).toEqual(
      expect.arrayContaining(["requestTs", "requestSale", "orders"]),
    );
    expect(screensOf("planner")).toEqual(["requests"]);
    expect(screensOf("fn_vendas_sul")).toEqual(["requests"]);
    // Gravada depois (conhece as telas novas): vale o que o administrador
    // marcou, inclusive tirar o TS do Comprador e dar a Venda ao Planner.
    const saved = fa.resolveFunctions({
      functions: [
        {
          key: "buyer",
          screens: ["requests"],
          knownScreens: [...screens.SCREENS],
        },
        {
          key: "planner",
          screens: ["requests", "requestSale"],
          knownScreens: [...screens.SCREENS],
        },
      ],
    });
    expect(saved.find((d) => d.key === "buyer")!.screens).toEqual(["requests"]);
    expect(saved.find((d) => d.key === "planner")!.screens).toEqual([
      "requests",
      "requestSale",
    ]);
    // E o login com a função recebe a tela pelo acesso resolvido.
    const planner = op(["planner"]);
    attachAccess(planner, {
      ...fa.accessFromFunctions(["planner"], saved),
      external: undefined,
      menuHidden: [],
    } as never);
    expect(screens.canOpen(planner, "requestSale")).toBe(true);
    expect(screens.canOpen(planner, "requestTs")).toBe(false);
  });

  it("rotas, rótulos e módulo da tela de permissões", () => {
    expect(screens.screenOfPath("/app/new-request/ts")).toBe("requestTs");
    expect(screens.screenOfPath("/app/new-request/sale")).toBe("requestSale");
    // A Nova solicitação de Encomendas continua na tela de sempre.
    expect(screens.screenOfPath("/app/requests/new")).toBe("requests");
    expect(screens.SCREEN_LABEL.requestTs).toBe("nav.requestTs");
    expect(screens.SCREEN_LABEL.requestSale).toBe("nav.requestSale");
    const newProduct = PERMISSION_MODULES.find((m) => m.key === "newProduct")!;
    expect(newProduct.screens.slice(0, 2)).toEqual([
      "requestTs",
      "requestSale",
    ]);
    expect(REQUEST_SCREEN.ts.path).toBe("/app/new-request/ts");
    expect(REQUEST_SCREEN.sale.operation).toBe("sale");
  });

  it("menu: TS e Venda saíram; Encomendas e Reposição acendem nas telas que abrem", () => {
    for (const who of [
      { role: "admin" as const },
      op(["buyer"]),
      op(["product_manager"]),
      op(["planner"]),
      op(["purchasing_director"]),
    ]) {
      const links = flattenNav(navFor(who)).map((l) => l.href);
      expect(links).not.toContain("/app/new-request/ts");
      expect(links).not.toContain("/app/new-request/sale");
    }
    // Encomendas e Reposição seguem no menu de sempre.
    const admin = flattenNav(navFor({ role: "admin" }));
    expect(admin.map((l) => l.href)).toEqual(
      expect.arrayContaining(["/app/requests", "/app/replenishment"]),
    );
    const link = (href: string) => admin.find((l) => l.href === href)!;
    // O item acende na tela que o "+ Adicionar" dele abre.
    expect(isActiveLink(link("/app/requests"), "/app/new-request/ts")).toBe(
      true,
    );
    expect(isActiveLink(link("/app/requests"), "/app/new-request/sale")).toBe(
      false,
    );
    expect(
      isActiveLink(link("/app/replenishment"), "/app/new-request/sale"),
    ).toBe(true);
    expect(
      isActiveLink(link("/app/replenishment"), "/app/new-request/ts"),
    ).toBe(false);
  });

  it("as consultas do formulário valem para quem abre qualquer tela de nova solicitação", () => {
    expect(screens.canOpenNewRequest(op(["buyer"]))).toBe(true);
    expect(screens.canOpenNewRequest(op(["designer"]))).toBe(false);
    const onlyTs = op(["fn_so_ts"]);
    attachAccess(onlyTs, {
      screens: ["requestTs"],
      actions: [],
      menuHidden: [],
    } as never);
    expect(screens.canOpen(onlyTs, "requests")).toBe(false);
    expect(screens.canOpenNewRequest(onlyTs)).toBe(true);
    // O cliente, pela tela de sempre.
    expect(screens.canOpenNewRequest({ role: "customer" })).toBe(true);
  });
});

describe("rascunhos por tela", () => {
  it("cada tela lista, reabre e apaga só os dela; os de Encomendas ficam lá", async () => {
    const form = (name: string, extra: Record<string, string> = {}) => {
      const f = new FormData();
      f.append("customerId", "cliente-joao");
      f.append("p0.productName", name);
      f.append("p0.quantity", "10");
      for (const [k, v] of Object.entries(extra)) f.append(k, v);
      return f;
    };
    const legacy = await drafts.saveRequestDraft(admin, form("Copo"), null);
    // O campo do formulário não manda: a tela vem de quem grava.
    const ts = await drafts.saveRequestDraft(
      admin,
      form("Jarra", { requestScreen: "sale" }),
      null,
      "ts",
    );
    const sale = await drafts.saveRequestDraft(
      admin,
      form("Pote"),
      null,
      "sale",
    );
    expect(draftScreenOf(legacy.payload)).toBeNull();
    expect(draftScreenOf(ts.payload)).toBe("ts");
    expect(draftScreenOf(sale.payload)).toBe("sale");
    const ids = async (screen: "ts" | "sale" | null) =>
      (await drafts.listRequestDrafts(admin, screen)).map((d) => d.id);
    expect(await ids(null)).toContain(legacy.id);
    expect(await ids(null)).not.toContain(ts.id);
    expect(await ids(null)).not.toContain(sale.id);
    expect(await ids("ts")).toEqual([ts.id]);
    expect(await ids("sale")).toEqual([sale.id]);
    // O rascunho de uma tela não abre na outra.
    expect(await drafts.getRequestDraft(admin, ts.id, "sale")).toBeNull();
    expect(await drafts.getRequestDraft(admin, ts.id)).toBeNull();
    expect((await drafts.getRequestDraft(admin, ts.id, "ts"))?.id).toBe(ts.id);
    await expect(
      drafts.saveRequestDraft(admin, form("Outro"), ts.id, "sale"),
    ).rejects.toThrow("draft_not_found");
    // O Comprador não abre Venda: não grava rascunho dela.
    await expect(
      drafts.saveRequestDraft(buyer, form("Copo"), null, "sale"),
    ).rejects.toThrow();
    await drafts.deleteRequestDraft(admin, ts.id, "sale");
    expect(await ids("ts")).toEqual([ts.id]);
    await drafts.deleteRequestDraft(admin, ts.id, "ts");
    expect(await ids("ts")).toEqual([]);
    await drafts.deleteRequestDraft(admin, sale.id, "sale");
    await drafts.deleteRequestDraft(admin, legacy.id);
  });

  it("as ações de rascunho conferem a tela de quem envia", async () => {
    h.current = buyer;
    const f = new FormData();
    f.append("requestScreen", "sale");
    f.append("customerId", "cliente-joao");
    await draftActions.saveScreenRequestDraftAction(f);
    expect(h.redirects.at(-1)).toMatch(/^\/app\/new-request\/sale\?error=/);
    f.set("requestScreen", "ts");
    await draftActions.saveScreenRequestDraftAction(f);
    expect(h.redirects.at(-1)).toMatch(
      /^\/app\/new-request\/ts\?draft=[^&]+&draftSaved=1$/,
    );
    const [saved] = await drafts.listRequestDrafts(buyer, "ts");
    expect(saved).toBeTruthy();
    // Campo inventado: recusado.
    f.set("requestScreen", "encomenda");
    await draftActions.saveScreenRequestDraftAction(f);
    expect(h.redirects.at(-1)).toMatch(/\?error=/);
    await drafts.deleteRequestDraft(buyer, saved.id, "ts");
  });
});

describe("rascunhos nas listas (dono, 17/11/2026)", () => {
  const form = (name: string, extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.append("p0.productName", name);
    f.append("p0.quantity", "10");
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  };

  it("a entrada da Reposição tem rascunho próprio, listado na fila de Reposição", async () => {
    // Planner: sem a tela Venda, mas com "Abrir reposição".
    const rep = await drafts.saveRequestDraft(
      planner,
      form("Balde", { from: "replenishment" }),
      null,
      "sale",
    );
    expect(draftIsReplenishment(rep.payload)).toBe(true);
    expect(draftResumeHref(rep.id, rep.payload)).toBe(
      `/app/new-request/sale?from=replenishment&draft=${rep.id}`,
    );
    // Sem a entrada da Reposição, o Planner não grava rascunho de Venda.
    await expect(
      drafts.saveRequestDraft(planner, form("Balde"), null, "sale"),
    ).rejects.toThrow();
    // Abre só na entrada da Reposição.
    expect(await drafts.getRequestDraft(planner, rep.id, "sale")).toBeNull();
    expect(
      (await drafts.getRequestDraft(planner, rep.id, "sale", true))?.id,
    ).toBe(rep.id);
    const listed = (list: "requests" | "replenishment", u = planner) =>
      drafts.listDraftsForList(u, list).then((r) => r.map((d) => d.draft.id));
    expect(await listed("replenishment")).toEqual([rep.id]);
    expect(await listed("requests")).not.toContain(rep.id);
    await drafts.deleteRequestDraft(planner, rep.id, "sale", true);
    expect(await listed("replenishment")).toEqual([]);
  });

  it("Encomendas lista os de Encomendas, TS e Venda, com o endereço de cada tela", async () => {
    const legacy = await drafts.saveRequestDraft(admin, form("Copo"), null);
    const ts = await drafts.saveRequestDraft(admin, form("Jarra"), null, "ts");
    // O campo da Reposição fora da tela Venda não vale.
    const odd = await drafts.saveRequestDraft(
      admin,
      form("Pote", { from: "replenishment" }),
      null,
      "ts",
    );
    expect(draftIsReplenishment(odd.payload)).toBe(false);
    const listed = await drafts.listDraftsForList(admin, "requests");
    const hrefOf = (id: string) => listed.find((d) => d.draft.id === id)?.href;
    expect(hrefOf(legacy.id)).toBe(`/app/requests/new?draft=${legacy.id}`);
    expect(hrefOf(ts.id)).toBe(`/app/new-request/ts?draft=${ts.id}`);
    expect(hrefOf(odd.id)).toBe(`/app/new-request/ts?draft=${odd.id}`);
    // Só de quem criou.
    expect(
      (await drafts.listDraftsForList(buyer, "requests")).map(
        (d) => d.draft.id,
      ),
    ).not.toContain(legacy.id);
    for (const [d, screen] of [
      [legacy, null],
      [ts, "ts"],
      [odd, "ts"],
    ] as const)
      await drafts.deleteRequestDraft(admin, d.id, screen);
  });

  it("o rascunho automático e o Salvar rascunho da Reposição voltam à entrada dela", async () => {
    h.current = planner;
    const auto = await draftActions.autosaveRequestDraftAction({
      mode: "sale",
      draftId: null,
      entries: [
        ["from", "replenishment"],
        ["p0.productName", "Regador"],
      ],
    });
    expect(auto.ok).toBe(true);
    const id = auto.ok ? auto.draftId : "";
    const f = form("Regador 2", {
      requestScreen: "sale",
      from: "replenishment",
      draftId: id,
    });
    await draftActions.saveScreenRequestDraftAction(f);
    expect(h.redirects.at(-1)).toBe(
      `/app/new-request/sale?from=replenishment&draft=${id}&draftSaved=1`,
    );
    // Sem a entrada, a tela Venda segue recusada para o Planner.
    const denied = await draftActions.autosaveRequestDraftAction({
      mode: "sale",
      draftId: null,
      entries: [["p0.productName", "Regador"]],
    });
    expect(denied.ok).toBe(false);
    await drafts.deleteRequestDraft(planner, id, "sale", true);
  });
});

describe("enviar: o tipo de operação é o da tela", () => {
  // Forma de pagamento (obrigatória na venda; dono, 16/11/2026).
  let planId = "";
  beforeAll(async () => {
    const { listPaymentPlans } =
      await import("@/lib/services/customer-payment");
    planId = (await listPaymentPlans())[0].id;
  });
  const sale = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    const fields: Record<string, string> = {
      customerId: "cliente-joao",
      requestedForUserId: joao.id,
      operationType: "sale",
      saleFormat: "wd",
      carrierCaller: "customer",
      redispatch: "no",
      originCountry: "CHINA",
      productFamily: "fm:UTILIDADES",
      paymentPlanId: planId,
      contactsEdit: "1",
      "contact.partner.phone": "(47) 99999-0001",
      "contact.partner.email": "socio@loja.com",
      "contact.buyer.phone": "(47) 99999-0002",
      "contact.buyer.email": "compras@loja.com",
      "contact.finance.phone": "(47) 99999-0003",
      "contact.finance.email": "fin@loja.com",
      "contact.logistics.phone": "(47) 99999-0004",
      "contact.logistics.email": "log@loja.com",
      "p0.productId": "prod-jarra",
      "p0.productName": "Jarra",
      "p0.quantity": "500",
      "p0.unit": "un",
      ...extra,
    };
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const lastRequest = async () => {
    const id = /^\/app\/requests\/([^/?]+)/.exec(h.redirects.at(-1) ?? "")?.[1];
    return id ? getStore().get("requests", id) : null;
  };

  it("TS grava TS mesmo com Venda no formulário; Venda grava Venda", async () => {
    h.current = admin;
    h.terms.length = 0;
    await actions.createTsRequestAction(sale({ operationType: "sale" }));
    expect(h.terms.at(-1)?.opts).toEqual({ operationType: "ts" });
    const ts = await lastRequest();
    expect(ts?.orderTerms?.operationType).toBe("ts");
    await actions.createSaleRequestAction(sale({ operationType: "ts" }));
    expect(h.terms.at(-1)?.opts).toEqual({ operationType: "sale" });
    const venda = await lastRequest();
    expect(venda?.orderTerms?.operationType).toBe("sale");
    // Encomendas continua como sempre: o tipo do formulário, só TS.
    await actions.createRequestAction(sale({ operationType: "sale" }));
    expect(h.terms.at(-1)?.opts).toEqual({});
    expect(h.redirects.at(-1)).toBe(
      "/app/requests/new?error=order_terms_operation_disabled",
    );
  });

  it("recusa quem não abre a tela, o cliente e a compra para estoque", async () => {
    h.current = buyer;
    const before = h.terms.length;
    await actions.createSaleRequestAction(sale());
    expect(h.redirects.at(-1)).toBe("/app/new-request/sale?error=forbidden");
    expect(h.terms.length).toBe(before);
    h.current = designer;
    await actions.createTsRequestAction(sale());
    expect(h.redirects.at(-1)).toBe("/app/new-request/ts?error=forbidden");
    h.current = joao;
    await actions.createTsRequestAction(sale());
    expect(h.redirects.at(-1)).toBe("/app/new-request/ts?error=forbidden");
    h.current = admin;
    const { STOCK_OPTION } = await import("@/lib/services/stock-party");
    await actions.createTsRequestAction(sale({ customerId: STOCK_OPTION }));
    expect(h.redirects.at(-1)).toBe(
      "/app/new-request/ts?error=request_screen_stock",
    );
    // "Adicionar produto" não existe nas telas novas (o campo é ignorado).
    h.current = buyer;
    await actions.createTsRequestAction(sale({ addTo: "qualquer" }));
    const added = await lastRequest();
    expect(added?.orderTerms?.operationType).toBe("ts");
  });
});

describe("Reposição: o + Adicionar abre a tela Venda como compra para estoque", () => {
  const stockForm = async (extra: Record<string, string> = {}) => {
    const { STOCK_OPTION } = await import("@/lib/services/stock-party");
    const f = new FormData();
    const fields: Record<string, string> = {
      customerId: STOCK_OPTION,
      from: "replenishment",
      "p0.productId": "prod-jarra",
      "p0.productName": "Jarra",
      "p0.quantity": "300",
      "p0.unit": "un",
      ...extra,
    };
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  it("grava a origem reposição, sem cliente nem condições do pedido, e volta à fila", async () => {
    const { demandKind } = await import("@/lib/purchase-demand");
    const { isStockCustomer } = await import("@/lib/services/stock-party");
    // O Planner abre a fila (Encomendas) e tem a ação, sem a tela de Venda.
    expect(screens.canOpen(planner, "requestSale")).toBe(false);
    h.current = planner;
    h.terms.length = 0;
    await actions.createSaleRequestAction(await stockForm());
    expect(h.redirects.at(-1)).toMatch(/^\/app\/replenishment\?opened=[^&]+$/);
    expect(h.terms).toHaveLength(0);
    const rows = await getStore().list("requests", {
      filter: { origin: "replenishment" },
      orderBy: "createdAt",
      direction: "desc",
    });
    const made = rows.find(
      (r) => r.quantity === 300 && r.productId === "prod-jarra",
    );
    expect(made).toBeTruthy();
    expect(demandKind(made!)).toBe("replenishment");
    expect(isStockCustomer(made!.customerId)).toBe(true);
    expect(made!.orderTerms ?? null).toBeNull();
    expect(made!.channel ?? null).toBeNull();
    // Entra na fila de Reposição (a mesma lista da tela).
    const { listDemands } = await import("@/lib/services/purchase-demand");
    expect((await listDemands("replenishment")).map((r) => r.id)).toContain(
      made!.id,
    );
  });

  it("sem a entrada da Reposição a tela segue só de venda (estoque recusado)", async () => {
    h.current = admin;
    await actions.createSaleRequestAction(await stockForm({ from: "" }));
    expect(h.redirects.at(-1)).toBe(
      "/app/new-request/sale?error=request_screen_stock",
    );
    // O campo só vale na tela Venda: em TS segue recusado.
    await actions.createTsRequestAction(await stockForm());
    expect(h.redirects.at(-1)).toBe(
      "/app/new-request/ts?error=request_screen_stock",
    );
  });

  it("recusa quem não tem a ação Abrir reposição e produto fora do catálogo", async () => {
    // Comprador: não tem a ação nem a tela de Venda.
    h.current = buyer;
    await actions.createSaleRequestAction(await stockForm());
    expect(h.redirects.at(-1)).toBe(
      "/app/new-request/sale?from=replenishment&error=forbidden",
    );
    // Cliente do portal: nunca.
    h.current = joao;
    await actions.createSaleRequestAction(await stockForm());
    expect(h.redirects.at(-1)).toMatch(/error=forbidden$/);
    // Reposição é de produto do catálogo.
    h.current = planner;
    await actions.createSaleRequestAction(
      await stockForm({
        "p0.productId": "",
        "p0.productName": "Copo de vidro",
        "p0.description": "Copo de vidro 300 ml",
        "p0.sourcingDemand": "on",
      }),
    );
    expect(h.redirects.at(-1)).toBe(
      "/app/new-request/sale?from=replenishment&error=replenishment_product",
    );
  });
});
