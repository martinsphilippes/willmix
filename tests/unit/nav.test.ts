import { describe, expect, it } from "vitest";
import {
  flattenNav,
  isActiveHref,
  isNavGroup,
  navFor,
  type NavLink,
} from "@/lib/nav";
import { ROLES } from "@/lib/db/schema";

/* Menu principal: Wellmix vê o dia a dia em linha e o resto em grupos; os
   outros papéis veem tudo em linha. Nenhuma tela some nem se repete. */
describe("menu principal", () => {
  it("Wellmix: quatro telas à vista e três grupos com todas as outras", () => {
    const entries = navFor("admin", true);
    const direct = entries
      .filter((e): e is NavLink => !isNavGroup(e))
      .map((e) => e.href);
    expect(direct).toEqual([
      "/app",
      "/app/tasks",
      "/app/requests",
      "/app/orders",
    ]);
    const groups = entries.filter(isNavGroup).map((g) => g.key);
    expect(groups).toEqual([
      "nav.group.operations",
      "nav.group.registry",
      "nav.group.management",
    ]);
    const hrefs = flattenNav(entries).map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of [
      "/app/reviews",
      "/app/sourcing",
      "/app/freight",
      "/app/containers",
      "/app/parties",
      "/app/products",
      "/app/lines",
      "/app/finance",
      "/app/history",
      "/app/after-sales",
      "/app/marketing",
      "/app/penalties",
      "/app/notifications",
      "/app/settings",
    ])
      expect(hrefs).toContain(href);
    // Operador: tudo igual, menos Configurações.
    const operator = flattenNav(navFor("operator", false)).map((l) => l.href);
    expect(operator).toEqual(hrefs.filter((h) => h !== "/app/settings"));
  });

  it("outros papéis: menu em linha, sem grupos, começando pelas pendências", () => {
    for (const role of ROLES.filter((r) => r !== "admin" && r !== "operator")) {
      const entries = navFor(role, false);
      expect(entries.some(isNavGroup)).toBe(false);
      const hrefs = flattenNav(entries).map((l) => l.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs).toContain("/app/orders");
      expect(hrefs).toContain("/app/notifications");
      expect(hrefs[0]).toBe(role === "customer" ? "/app/requests" : "/app");
    }
    expect(flattenNav(navFor("supplier", false)).map((l) => l.href)).toContain(
      "/app/account",
    );
    expect(
      flattenNav(navFor("shipping_line", false)).map((l) => l.href),
    ).toContain("/app/freight");
  });

  it("tela atual: /app só na própria página; os demais também nas subpáginas", () => {
    expect(isActiveHref("/app", "/app")).toBe(true);
    expect(isActiveHref("/app", "/app/orders")).toBe(false);
    expect(isActiveHref("/app/orders", "/app/orders/123")).toBe(true);
    expect(isActiveHref("/app/orders", "/app/orders-x")).toBe(false);
  });
});
