import { describe, expect, it } from "vitest";
import {
  ACTION_KEYS,
  accessFromFunctions,
  can,
  canSeeMoney,
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
        { key: "buyer", screens: ["orders"], actions: ["order.cancel"] },
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
