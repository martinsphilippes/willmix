import { describe, expect, it } from "vitest";
import {
  ACTION_KEYS,
  accessFromFunctions,
  can,
  canSeeMoney,
  canSeeOrderPurchasePrice,
  canSeePurchasePrice,
  customFunctionKey,
  defaultActionsFor,
  holdersOf,
  resolveFunctions,
} from "@/lib/auth/function-access";
import {
  FUNCTION_SCREENS,
  WELLMIX_BASE,
  screensFor,
  startPathFor,
} from "@/lib/auth/screens";
import { attachAccess } from "@/lib/auth/access-cache";
import { WELLMIX_FUNCTIONS } from "@/lib/db/schema";

/* Funções e acessos: telas e ações por função, padrão do código e configuração do administrador. */

const op = (functions: string[]) => ({
  role: "operator" as const,
  functions,
});

describe("padrão (sem nada gravado)", () => {
  it("as 8 funções de fábrica com as telas de antes", () => {
    const defs = resolveFunctions(null);
    expect(defs.map((d) => d.key)).toEqual([...WELLMIX_FUNCTIONS]);
    for (const d of defs)
      expect(d.screens).toEqual([
        ...FUNCTION_SCREENS[d.key as (typeof WELLMIX_FUNCTIONS)[number]],
      ]);
  });

  it("as ações seguem quem já fazia antes", () => {
    expect(can(op(["buyer"]), "receiving.follow")).toBe(true);
    expect(can(op(["planner"]), "receiving.follow")).toBe(false);
    expect(can(op(["finance"]), "numerario.manage")).toBe(true);
    expect(can(op(["designer"]), "art.design")).toBe(true);
    // Quem abria Cotações decidia a solicitação; o designer não abre.
    expect(can(op(["buyer"]), "supplierRequest.decide")).toBe(true);
    expect(can(op(["designer"]), "supplierRequest.decide")).toBe(false);
    // Cancelar pedido e ver valores continuam só do admin.
    for (const fn of WELLMIX_FUNCTIONS) {
      expect(defaultActionsFor(fn)).not.toContain("order.cancel");
      expect(defaultActionsFor(fn)).not.toContain("values.view");
    }
  });

  it("admin faz tudo; cliente, fornecedor e parceiros não fazem nada", () => {
    for (const a of ACTION_KEYS) {
      expect(can({ role: "admin", functions: [] }, a)).toBe(true);
      expect(can({ role: "supplier", functions: ["buyer"] }, a)).toBe(false);
    }
  });
});

describe("configuração do administrador", () => {
  it("muda telas e ações de uma função de fábrica e cria uma nova", () => {
    const defs = resolveFunctions({
      functions: [
        {
          key: "buyer",
          screens: ["orders"],
          actions: ["order.cancel"],
          // Gravada depois de 15/11/2026: conhece todas as ações de hoje.
          knownActions: [...ACTION_KEYS],
        },
        {
          key: "fn_logistica",
          name: "Logística",
          screens: ["freight", "containers", "lixo"],
          actions: ["receiving.follow", "nao_existe"],
        },
      ],
    });
    const buyer = accessFromFunctions(["buyer"], defs);
    expect(buyer.screens).toEqual(["orders"]);
    expect(buyer.actions).toEqual(["order.cancel"]);
    const logistics = defs.find((d) => d.key === "fn_logistica")!;
    // Chaves inválidas são descartadas.
    expect(logistics.screens).toEqual(["freight", "containers"]);
    expect(logistics.actions).toEqual(["receiving.follow"]);
    expect(can(op(["fn_logistica"]), "receiving.follow", defs)).toBe(true);
    expect(can(op(["fn_logistica"]), "order.cancel", defs)).toBe(false);
    // Telas do login: o básico mais as da função.
    const screens = screensFor(
      op(["fn_logistica"]),
      accessFromFunctions(["fn_logistica"], defs),
    );
    expect(screens.has("freight")).toBe(true);
    expect(screens.has("home")).toBe(true);
    expect(screens.has("orders")).toBe(false);
  });

  it("função desativada não libera nada", () => {
    const defs = resolveFunctions({
      functions: [
        {
          key: "fn_temp",
          name: "Temporária",
          screens: ["orders"],
          actions: ["values.view"],
          archived: true,
        },
      ],
    });
    expect(accessFromFunctions(["fn_temp"], defs)).toEqual({
      screens: [],
      actions: [],
      base: [...WELLMIX_BASE],
    });
  });

  it("telas do Início por função: desmarcar numa não tira de quem tem outra", () => {
    // Sem nada gravado: todas as telas do Início, como antes.
    const before = resolveFunctions(null);
    expect(before.every((d) => d.baseOff.length === 0)).toBe(true);
    expect(
      screensFor(op(["designer"]), accessFromFunctions(["designer"], before)),
    ).toEqual(new Set([...WELLMIX_BASE, ...FUNCTION_SCREENS.designer]));

    // Designer sem Painel de SLA e sem Control Tower; Planner intacto.
    const defs = resolveFunctions({
      functions: [{ key: "designer", baseOff: ["sla", "home", "orders", "x"] }],
    });
    const designer = defs.find((d) => d.key === "designer")!;
    // Só telas do Início entram; as telas da função seguem o padrão.
    expect(designer.baseOff).toEqual(["home", "sla"]);
    expect(designer.screens).toEqual([...FUNCTION_SCREENS.designer]);

    const only = screensFor(
      op(["designer"]),
      accessFromFunctions(["designer"], defs),
    );
    expect(only.has("sla")).toBe(false);
    expect(only.has("home")).toBe(false);
    expect(only.has("tasks")).toBe(true);
    expect(only.has("orders")).toBe(true);

    const planner = screensFor(
      op(["planner"]),
      accessFromFunctions(["planner"], defs),
    );
    expect(planner.has("sla")).toBe(true);
    expect(planner.has("home")).toBe(true);

    // Outra função do mesmo login libera: vale a união.
    const both = screensFor(
      op(["designer", "planner"]),
      accessFromFunctions(["designer", "planner"], defs),
    );
    expect(both.has("sla")).toBe(true);

    // Admin abre tudo; tela marcada direto no login também segue valendo.
    expect(
      screensFor({ role: "admin", functions: ["designer"] }).has("sla"),
    ).toBe(true);
    expect(
      screensFor({
        role: "operator",
        functions: ["designer"],
        screens: [],
      }).has("sla"),
    ).toBe(true);
    // Sem função ativa: o Início inteiro.
    expect(accessFromFunctions([], defs).base).toEqual([...WELLMIX_BASE]);
    // Ações não mudam.
    expect(accessFromFunctions(["designer"], defs).actions).toEqual(
      accessFromFunctions(["designer"], before).actions,
    );
  });

  it("sem o Control Tower, o início vai à primeira tela do menu", () => {
    const defs = resolveFunctions({
      functions: [
        { key: "designer", baseOff: ["home", "tasks"] },
        {
          key: "fn_vazia",
          name: "Vazia",
          screens: [],
          baseOff: [...WELLMIX_BASE],
        },
      ],
    });
    const designer = op(["designer"]);
    attachAccess(designer, accessFromFunctions(["designer"], defs));
    expect(startPathFor(designer)).toBe("/app/sla");
    const empty = op(["fn_vazia"]);
    attachAccess(empty, accessFromFunctions(["fn_vazia"], defs));
    expect(screensFor(empty).size).toBe(0);
    expect(startPathFor(empty)).toBeNull();
  });

  it("valores: só quem tem a permissão (abrir Financeiro não concede)", () => {
    const defs = resolveFunctions({
      functions: [{ key: "planner", actions: ["values.view"] }],
    });
    expect(canSeeMoney({ role: "admin", functions: [] })).toBe(true);
    expect(canSeeMoney(op(["buyer"]))).toBe(false);
    // Tela Financeiro posta à mão (Personalizado), sem a ação: não vê valores.
    expect(
      canSeeMoney({
        ...op(["buyer"]),
        screenExceptions: { added: ["finance"], removed: [] },
      } as Parameters<typeof canSeeMoney>[0]),
    ).toBe(false);
    expect(can(op(["planner"]), "values.view", defs)).toBe(true);
  });

  it("quem tem a ação, entre os logins (avisos e listas de aprovadores)", () => {
    const users = [
      { id: "a", role: "admin", functions: [] },
      { id: "b", role: "operator", functions: ["buyer"] },
      { id: "c", role: "operator", functions: ["designer"] },
      { id: "d", role: "admin", functions: ["designer"] },
    ];
    const defs = resolveFunctions(null);
    expect(holdersOf(users, "art.design", defs).map((u) => u.id)).toEqual([
      "c",
      "d",
    ]);
  });

  it("chave da função criada: sem acento e sem repetir", () => {
    expect(customFunctionKey("Logística Fina", [])).toBe("fn_logistica_fina");
    expect(customFunctionKey("Logística", ["fn_logistica"])).toBe(
      "fn_logistica_2",
    );
  });
});

describe("ação nova numa função já gravada (15/11/2026)", () => {
  it("vale pelo padrão até o administrador salvar a função de novo", () => {
    // Gravada antes da lista knownActions: as ações de hoje que não estavam
    // em LEGACY_ACTIONS entram pelo padrão do código.
    const legacy = resolveFunctions({
      functions: [
        { key: "planner", screens: ["requests"], actions: ["approve.planner"] },
        { key: "buyer", screens: ["requests"], actions: [] },
      ],
    });
    const planner = legacy.find((d) => d.key === "planner")!;
    expect(planner.actions).toContain("replenishment.open");
    expect(planner.actions).toContain("approve.planner");
    // Ação antiga tirada pelo administrador continua fora.
    expect(planner.actions).not.toContain("supplierRequest.decide");
    // Gravada já conhecendo a ação nova e sem ela: o administrador tirou.
    const saved = resolveFunctions({
      functions: [
        {
          key: "planner",
          screens: ["requests"],
          actions: ["approve.planner"],
          knownActions: [...ACTION_KEYS],
        },
      ],
    });
    expect(saved.find((d) => d.key === "planner")!.actions).toEqual([
      "approve.planner",
    ]);
  });

  it("Vendas lança encomenda em nome do cliente e abre Encomendas por padrão", () => {
    const defs = resolveFunctions(null);
    expect(can(op(["sales"]), "demand.createForCustomer", defs)).toBe(true);
    expect(can(op(["sales"]), "replenishment.open", defs)).toBe(false);
    expect(can(op(["planner"]), "replenishment.open", defs)).toBe(true);
  });
});

describe("Ver preço de compra (dono, 15/11/2026; docs/LINHA_DE_VISAO.md)", () => {
  it("padrão: Comprador, Gerente de produto, diretorias e Financeiro; o administrador sempre", () => {
    for (const fn of [
      "buyer",
      "product_manager",
      "purchasing_director",
      "executive_director",
      "finance",
    ])
      expect(canSeePurchasePrice(op([fn]))).toBe(true);
    for (const fn of [
      "planner",
      "catalog",
      "designer",
      "comex_internal",
      "quality",
      "sales",
    ])
      expect(canSeePurchasePrice(op([fn]))).toBe(false);
    expect(canSeePurchasePrice({ role: "admin", functions: [] })).toBe(true);
  });

  it("quem tem Ver valores e margem também vê; o administrador tira e dá pela função", () => {
    const defs = resolveFunctions({
      functions: [
        {
          key: "designer",
          actions: ["values.view"],
          knownActions: [...ACTION_KEYS],
        },
        { key: "buyer", actions: [], knownActions: [...ACTION_KEYS] },
        {
          key: "catalog",
          actions: ["purchasePrice.view"],
          knownActions: [...ACTION_KEYS],
        },
      ],
    });
    // O login leva o acesso resolvido da requisição (como no servidor).
    const login = (fn: string) => {
      const user = op([fn]);
      attachAccess(user, accessFromFunctions([fn], defs));
      return user;
    };
    // Designer com "Ver valores e margem" vê o preço de compra.
    expect(canSeePurchasePrice(login("designer"))).toBe(true);
    // Comprador sem a ação: não vê.
    expect(canSeePurchasePrice(login("buyer"))).toBe(false);
    // Cadastro com a ação marcada: vê.
    expect(canSeePurchasePrice(login("catalog"))).toBe(true);
  });

  it("função gravada antes da ação nova recebe o padrão do código", () => {
    const defs = resolveFunctions({
      functions: [
        // Gravadas sem a lista de ações conhecidas (antes de 15/11/2026).
        { key: "buyer", actions: ["receiving.follow"] },
        { key: "planner", actions: ["approval.planner"] },
      ],
    });
    expect(can(op(["buyer"]), "purchasePrice.view", defs)).toBe(true);
    expect(can(op(["planner"]), "purchasePrice.view", defs)).toBe(false);
  });

  it("fora da Wellmix: o fornecedor vê o do pedido dele e o despachante o do pedido; certificadora e cliente nunca", () => {
    const order = { supplierId: "forn-1", brokerId: "desp-1" };
    expect(
      canSeeOrderPurchasePrice(
        { role: "supplier", functions: [], partyId: "forn-1" },
        order,
      ),
    ).toBe(true);
    expect(
      canSeeOrderPurchasePrice(
        { role: "supplier", functions: [], partyId: "forn-2" },
        order,
      ),
    ).toBe(false);
    expect(
      canSeeOrderPurchasePrice(
        { role: "broker", functions: [], partyId: "desp-1" },
        order,
      ),
    ).toBe(true);
    expect(
      canSeeOrderPurchasePrice(
        { role: "broker", functions: [], partyId: "desp-2" },
        order,
      ),
    ).toBe(false);
    for (const role of ["ocp", "customer", "agency", "carrier"])
      expect(
        canSeeOrderPurchasePrice(
          { role, functions: [], partyId: "forn-1" },
          order,
        ),
      ).toBe(false);
    expect(canSeePurchasePrice({ role: "supplier", functions: [] })).toBe(
      false,
    );
    expect(canSeeOrderPurchasePrice(op(["planner"]), order)).toBe(false);
    expect(canSeeOrderPurchasePrice(op(["buyer"]), order)).toBe(true);
  });
});
