import { describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Pontas da revisão da Gestão de telas (docs/PARTNER_ACCESS.md): login sem
 * empresa não casa com pedido que ainda não tem aquele parceiro, e o início
 * do login externo só se chama "Pendências" quando o perfil tem essa tela.
 */
withTempStore();

const { canSubmitRequirement } = await import("@/lib/workflow/engine");
const { isInvolved } = await import("@/lib/services/tasks");
const { attachAccess } = await import("@/lib/auth/access-cache");
const { flattenNav, navFor } = await import("@/lib/nav");
const { canOpen } = await import("@/lib/auth/screens");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;

const login = (over: Partial<User>) =>
  ({ id: "u1", role: "agency", partyId: null, ...over }) as User;
const order = (over: Partial<Order>) =>
  ({
    id: "o1",
    customerId: "c1",
    supplierId: "s1",
    agencyId: null,
    brokerId: null,
    requestedByUserId: "uc",
    ...over,
  }) as Order;

describe("login sem empresa", () => {
  it("não preenche requisito de pedido que ainda não tem o parceiro", () => {
    const requirement = { role: "agency" as const, key: "agency_docs" };
    // Antes: null === null casava com todo pedido sem agência.
    expect(canSubmitRequirement(login({}), order({}), requirement)).toBe(false);
    expect(
      canSubmitRequirement(
        login({ partyId: "a1" }),
        order({ agencyId: "a1" }),
        requirement,
      ),
    ).toBe(true);
    expect(
      canSubmitRequirement(
        login({ partyId: "a2" }),
        order({ agencyId: "a1" }),
        requirement,
      ),
    ).toBe(false);
  });

  it("não entra nas pendências de pedido que ainda não tem o parceiro", () => {
    expect(isInvolved(login({}), order({}))).toBe(false);
    expect(isInvolved(login({ role: "broker" }), order({}))).toBe(false);
    expect(
      isInvolved(login({ partyId: "a1" }), order({ agencyId: "a1" })),
    ).toBe(true);
  });
});

describe("início do login externo", () => {
  const withProfile = (screens: string[]) => {
    const user = login({ role: "supplier", partyId: "p1" });
    attachAccess(user, {
      screens: [],
      actions: [],
      external: screens as never,
      menuHidden: [],
    });
    return user;
  };
  const homeKey = (user: User) =>
    flattenNav(navFor(user)).find((l) => l.href === "/app")?.key;

  it('chama-se "Pendências" com a tela no perfil e "Início" sem ela', () => {
    const full = withProfile(["home", "tasks", "orders", "messages"]);
    expect(canOpen(full, "tasks")).toBe(true);
    expect(homeKey(full)).toBe("nav.tasks");
    const noTasks = withProfile(["home", "orders"]);
    expect(canOpen(noTasks, "tasks")).toBe(false);
    expect(canOpen(noTasks, "messages")).toBe(false);
    expect(homeKey(noTasks)).toBe("nav.home");
  });
});
