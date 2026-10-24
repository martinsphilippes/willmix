import { describe, expect, it } from "vitest";
import {
  flattenNav,
  isActiveHref,
  isNavGroup,
  navFor,
  type NavLink,
} from "@/lib/nav";
import { ROLES } from "@/lib/db/schema";

/* Menu principal: todos os papéis veem grupos (sem links soltos); grupo com
   uma tela só vira link. Nenhuma tela some nem se repete. */
describe("menu principal", () => {
  it("Wellmix: tudo em quatro grupos, sem links soltos na barra", () => {
    const entries = navFor("admin", true);
    const direct = entries
      .filter((e): e is NavLink => !isNavGroup(e))
      .map((e) => e.href);
    expect(direct).toEqual([]);
    const groups = entries.filter(isNavGroup).map((g) => g.key);
    expect(groups).toEqual([
      "nav.group.home",
      "nav.group.orders",
      "nav.group.registry",
      "nav.group.management",
    ]);
    const hrefs = flattenNav(entries).map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    // O dia a dia continua no começo do menu (celular mostra na ordem).
    expect(hrefs.slice(0, 5)).toEqual([
      "/app",
      "/app/tasks",
      "/app/notifications",
      "/app/requests",
      "/app/orders",
    ]);
    for (const href of [
      "/app",
      "/app/tasks",
      "/app/requests",
      "/app/orders",
      "/app/reviews",
      "/app/sourcing",
      "/app/freight",
      "/app/containers",
      "/app/parties",
      "/app/products",
      "/app/lines",
      "/app/finance",
      "/app/payables",
      "/app/history",
      "/app/after-sales",
      "/app/marketing",
      "/app/penalties",
      "/app/notifications",
      "/app/settings",
      // Vitrine como o cliente vê.
      "/app/explore",
    ])
      expect(hrefs).toContain(href);
    // Operador: tudo igual, menos Configurações.
    const operator = flattenNav(navFor("operator", false)).map((l) => l.href);
    expect(operator).toEqual(hrefs.filter((h) => h !== "/app/settings"));
  });

  it('cliente: Explorar (vitrine) no início e o resto em "Meus pedidos"; nenhuma tela some', () => {
    const entries = navFor("customer", false);
    expect(entries[0]).toEqual({ href: "/app/explore", key: "nav.explore" });
    expect(entries.filter(isNavGroup).map((g) => g.key)).toEqual([
      "nav.group.myOrders",
    ]);
    const hrefs = flattenNav(entries).map((l) => l.href);
    expect(hrefs).toEqual([
      "/app/explore",
      "/app/requests",
      "/app/orders",
      "/app/tasks",
      "/app/notifications",
      "/app/history",
      "/app/marketing",
    ]);
  });

  it("fornecedores e parceiros: Início (Pendências, Notificações) e Pedidos com a tela do papel", () => {
    const view = (role: (typeof ROLES)[number]) =>
      navFor(role, false).map((e) =>
        isNavGroup(e)
          ? { group: e.key, items: e.items.map((i) => i.href) }
          : { link: e.href },
      );
    const home = {
      group: "nav.group.home",
      items: ["/app", "/app/notifications"],
    };
    expect(view("supplier")).toEqual([
      home,
      {
        group: "nav.group.orders",
        items: ["/app/quotes", "/app/orders", "/app/account"],
      },
    ]);
    expect(view("shipping_line")).toEqual([
      home,
      {
        group: "nav.group.orders",
        items: ["/app/freight", "/app/freight/tariff", "/app/orders"],
      },
    ]);
    expect(view("legal")).toEqual([
      home,
      { group: "nav.group.orders", items: ["/app/orders", "/app/penalties"] },
    ]);
    // Grupo com uma tela só vira link direto (sem lista de um item).
    for (const role of ["broker", "carrier"] as const)
      expect(view(role)).toEqual([home, { link: "/app/orders" }]);
    // A agência tem os briefings de embalagem (faca e arte na RFQ) e os pedidos.
    expect(view("agency")).toEqual([
      home,
      {
        group: "nav.group.orders",
        items: ["/app/packaging", "/app/orders"],
      },
    ]);
    // Nenhuma tela some nem se repete; o início continua nas pendências.
    for (const role of ROLES.filter(
      (r) => r !== "admin" && r !== "operator" && r !== "customer",
    )) {
      const hrefs = flattenNav(navFor(role, false)).map((l) => l.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs[0]).toBe("/app");
      expect(hrefs).toContain("/app/orders");
      expect(hrefs).toContain("/app/notifications");
    }
  });

  it("tela atual: /app só na própria página; os demais também nas subpáginas", () => {
    expect(isActiveHref("/app", "/app")).toBe(true);
    expect(isActiveHref("/app", "/app/orders")).toBe(false);
    expect(isActiveHref("/app/orders", "/app/orders/123")).toBe(true);
    expect(isActiveHref("/app/orders", "/app/orders-x")).toBe(false);
    // Tarifário tem link próprio: "Fretes" não acende junto.
    expect(isActiveHref("/app/freight", "/app/freight/abc123")).toBe(true);
    expect(isActiveHref("/app/freight", "/app/freight/tariff")).toBe(false);
    expect(isActiveHref("/app/freight/tariff", "/app/freight/tariff")).toBe(
      true,
    );
  });

  it("tarifário de frete no menu da Wellmix e da companhia marítima (a dela); dos outros parceiros, não", () => {
    const wellmix = flattenNav(navFor("operator", false)).map((l) => l.href);
    expect(wellmix).toContain("/app/freight/tariff");
    const shipping = flattenNav(navFor("shipping_line", false));
    expect(shipping.map((l) => l.href)).toContain("/app/freight/tariff");
    expect(shipping.find((l) => l.href === "/app/freight/tariff")?.key).toBe(
      "nav.myFreightTariff",
    );
    for (const role of [
      "supplier",
      "customer",
      "broker",
      "carrier",
      "agency",
    ] as const)
      expect(flattenNav(navFor(role, false)).map((l) => l.href)).not.toContain(
        "/app/freight/tariff",
      );
  });
});
