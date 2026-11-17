import { describe, expect, it } from "vitest";
import {
  TEAM_SCREENS,
  actionAccessOf,
  screenAccessOf,
  screenCountOf,
} from "@/lib/auth/screen-origin";
import {
  accessFromFunctions,
  can,
  resolveFunctions,
} from "@/lib/auth/function-access";
import { SCREENS, WELLMIX_BASE, screensFor } from "@/lib/auth/screens";

/*
 * Acesso efetivo com a origem de cada tela e ação (Gestão de telas da Equipe
 * Interna; docs/EQUIPE_ACESSOS.md, etapa 5). A conta é a mesma das
 * requisições: o que a Gestão de telas mostra é o que o menu, as páginas e as
 * Server Actions deixam.
 */

const defs = resolveFunctions(null);
const op = (over: Record<string, unknown> = {}) =>
  ({ role: "operator", functions: [], ...over }) as never;
const origin = (user: never, screen: string) =>
  screenAccessOf(user, defs).find((s) => s.screen === screen)!;

describe("telas com a origem", () => {
  it("o catálogo cobre todas as telas", () => {
    expect([...TEAM_SCREENS].sort()).toEqual([...SCREENS].sort());
  });

  it("Abre é o mesmo cálculo das requisições, para vários perfis", () => {
    const people = [
      op(),
      op({ functions: ["buyer"] }),
      op({ functions: ["buyer", "designer"] }),
      op({
        functions: ["buyer"],
        screenExceptions: { added: ["finance"], removed: ["orders"] },
      }),
      op({ functions: ["planner"], screens: ["orders", "settings"] }),
      { role: "admin", functions: [] } as never,
    ];
    for (const user of people) {
      const expected = screensFor(
        user,
        accessFromFunctions((user as { functions: string[] }).functions, defs),
      );
      for (const row of screenAccessOf(user, defs))
        expect(row.opens, row.screen).toBe(expected.has(row.screen));
    }
  });

  it("administrador: todas, pela origem Administrador", () => {
    const admin = { role: "admin", functions: [] } as never;
    expect(screenAccessOf(admin, defs).every((s) => s.opens)).toBe(true);
    expect(origin(admin, "finance").origin).toEqual({ kind: "admin" });
    expect(screenCountOf(admin, defs)).toBeNull();
  });

  it("sem função: só o Início, pelo padrão do portal", () => {
    const user = op();
    expect(origin(user, "home").origin).toEqual({ kind: "base" });
    expect(origin(user, "orders")).toMatchObject({
      opens: false,
      origin: { kind: "none" },
    });
    expect(screenCountOf(user, defs)).toBe(WELLMIX_BASE.length);
  });

  it("várias funções: a tela lista cada função que libera", () => {
    const user = op({ functions: ["buyer", "designer"] });
    const orders = origin(user, "orders").origin;
    expect(orders.kind).toBe("functions");
    expect(orders.kind === "functions" && orders.keys).toContain("buyer");
  });

  it("ajuste individual: marcada e desmarcada à mão; protegida aparece como tal", () => {
    const user = op({
      functions: ["buyer"],
      screenExceptions: { added: ["finance"], removed: ["orders"] },
    });
    expect(origin(user, "finance")).toMatchObject({
      opens: true,
      protected: true,
      origin: { kind: "added" },
    });
    expect(origin(user, "orders")).toMatchObject({
      opens: false,
      origin: { kind: "removed" },
    });
  });

  it("lista antiga marcada uma a uma", () => {
    const user = op({ functions: ["planner"], screens: ["settings"] });
    expect(origin(user, "settings")).toMatchObject({
      opens: true,
      origin: { kind: "legacy" },
    });
    expect(origin(user, "home").origin).toEqual({ kind: "base" });
  });
});

describe("ações com a origem", () => {
  it("o mesmo resultado de can(), com as funções que liberam", () => {
    const people = [
      op({ functions: ["buyer"] }),
      op({ functions: ["designer"] }),
      op({ functions: ["buyer", "designer"] }),
    ];
    for (const user of people)
      for (const row of actionAccessOf(user, defs))
        expect(row.allowed, row.action).toBe(can(user, row.action, defs));
  });

  it("duas pessoas abrem a mesma tela; só uma faz a ação", () => {
    const buyer = op({ functions: ["buyer"] });
    const designer = op({ functions: ["designer"] });
    expect(origin(buyer, "orders").opens).toBe(true);
    expect(origin(designer, "orders").opens).toBe(true);
    const art = (u: never) =>
      actionAccessOf(u, defs).find((a) => a.action === "art.design");
    expect(art(designer)?.allowed).toBe(true);
    expect(art(buyer)?.allowed).toBe(false);
  });
});
