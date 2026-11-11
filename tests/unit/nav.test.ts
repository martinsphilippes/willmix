import { describe, expect, it } from "vitest";
import {
  flattenNav,
  isActiveHref,
  isNavGroup,
  navFor,
  type NavLink,
} from "@/lib/nav";
import { ROLES, WELLMIX_FUNCTIONS } from "@/lib/db/schema";

/* Menu principal: todos os papéis veem grupos (sem links soltos); grupo com
   uma tela só vira link; grupo vazio some. O menu segue as telas do login
   (src/lib/auth/screens.ts): nenhuma tela some do admin nem se repete. */
const ADMIN = { role: "admin" as const };
const view = (user: Parameters<typeof navFor>[0]) =>
  navFor(user).map((e) =>
    isNavGroup(e)
      ? { group: e.key, items: e.items.map((i) => i.href) }
      : { link: e.href },
  );
/** Telas que saem com a RFQ e a cotação (11/11/2026): fora das comparações. */
const GONE = ["/app/rfq", "/app/quotes", "/app/packaging"];
const hrefsOf = (user: Parameters<typeof navFor>[0]) =>
  flattenNav(navFor(user))
    .map((l) => l.href)
    .filter((h) => !GONE.includes(h));

describe("menu principal", () => {
  it("admin: tudo em quatro grupos, sem links soltos na barra", () => {
    const entries = navFor(ADMIN);
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
    // Em Pedidos, o Booking vem antes de Solicitações (acontece antes dela).
    expect(hrefs.slice(0, 7)).toEqual([
      "/app",
      "/app/tasks",
      "/app/sla",
      "/app/notifications",
      "/app/messages",
      "/app/booking",
      "/app/requests",
    ]);
    // Sourcing (em espera) fica depois do Superplan.
    expect(hrefs.indexOf("/app/superplan")).toBeLessThan(
      hrefs.indexOf("/app/sourcing"),
    );
    for (const href of [
      "/app",
      "/app/tasks",
      "/app/requests",
      "/app/orders",
      "/app/reviews",
      "/app/sourcing",
      "/app/freight",
      "/app/freight/tariff",
      "/app/containers",
      "/app/superplan",
      "/app/parties",
      "/app/products",
      "/app/lines",
      "/app/explore",
      "/app/dashboards",
      "/app/finance",
      "/app/payables",
      "/app/penalties",
      "/app/after-sales",
      "/app/marketing",
      "/app/history",
      "/app/notifications",
      "/app/settings",
      "/app/sla",
      "/app/team",
      "/app/audit",
    ])
      expect(hrefs).toContain(href);
  });

  it("operador sem função: só o grupo Início; com todas as funções, tudo menos o que é só do admin", () => {
    const none = navFor({ role: "operator", functions: null });
    expect(none.map((e) => (isNavGroup(e) ? e.key : e.href))).toEqual([
      "nav.group.home",
    ]);
    expect(flattenNav(none).map((l) => l.href)).toEqual([
      "/app",
      "/app/tasks",
      "/app/sla",
      "/app/notifications",
      "/app/messages",
    ]);
    const all = flattenNav(
      navFor({ role: "operator", functions: [...WELLMIX_FUNCTIONS] }),
    ).map((l) => l.href);
    const admin = flattenNav(navFor(ADMIN)).map((l) => l.href);
    expect(all).toEqual(
      admin.filter(
        (h) =>
          ![
            "/app/finance",
            // Acordos e comissões: quem abre o Financeiro (só o admin).
            "/app/commissions",
            "/app/payables",
            "/app/settings",
            "/app/team",
            // Superplan: custo e margem de cada produto, só do admin.
            "/app/superplan",
            // Painel do dono: números de Finanças, só do admin.
            "/app/dashboards/owner",
            "/app/dashboards/cashflow",
          ].includes(h),
      ),
    );
  });

  it("operador por função: comprador vê compras; financeiro não aparece para ninguém além do admin", () => {
    const buyer = flattenNav(
      navFor({ role: "operator", functions: ["buyer"] }),
    ).map((l) => l.href);
    expect(buyer).toContain("/app/requests");
    expect(buyer).toContain("/app/orders");
    expect(buyer).toContain("/app/products");
    expect(buyer).not.toContain("/app/lines");
    expect(buyer).not.toContain("/app/finance");
    expect(buyer).not.toContain("/app/payables");
    // Designer: Início, Pedidos, Cadastros com Produtos e Vitrine e Marketing.
    expect(hrefsOf({ role: "operator", functions: ["designer"] })).toEqual([
      "/app",
      "/app/tasks",
      "/app/sla",
      "/app/notifications",
      "/app/messages",
      "/app/orders",
      "/app/products",
      "/app/inventory",
      "/app/explore",
      "/app/marketing",
    ]);
  });

  it('cliente: Explorar (vitrine) no início e o resto em "Meus pedidos"; nenhuma tela some', () => {
    const entries = navFor({ role: "customer" });
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
      "/app/messages",
      "/app/history",
      "/app/marketing",
    ]);
  });

  it("fornecedores e parceiros: Início (Pendências, Notificações) e Pedidos com a tela do papel", () => {
    const home = {
      group: "nav.group.home",
      items: ["/app", "/app/notifications", "/app/messages"],
    };
    expect(hrefsOf({ role: "supplier" })).toEqual([
      ...home.items,
      "/app/supplier-requests",
      "/app/supplier-requests/invites",
      "/app/orders",
      "/app/account",
    ]);
    expect(view({ role: "shipping_line" })).toEqual([
      home,
      {
        group: "nav.group.orders",
        items: ["/app/freight", "/app/freight/tariff", "/app/orders"],
      },
    ]);
    expect(view({ role: "legal" })).toEqual([
      home,
      { group: "nav.group.orders", items: ["/app/orders", "/app/penalties"] },
    ]);
    // Grupo com uma tela só vira link direto (sem lista de um item).
    for (const role of ["carrier", "comex", "logistics", "ocp"] as const)
      expect(view({ role })).toEqual([home, { link: "/app/orders" }]);
    // O despachante tem também o NCM dos itens de booking (docs/BOOKING.md).
    expect(view({ role: "broker" })).toEqual([
      home,
      { group: "nav.group.orders", items: ["/app/orders", "/app/ncm-items"] },
    ]);
    // A agência tem os pedidos.
    expect(hrefsOf({ role: "agency" })).toEqual([...home.items, "/app/orders"]);
    // Nenhuma tela some nem se repete; o início continua nas pendências.
    for (const role of ROLES.filter(
      (r) => r !== "admin" && r !== "operator" && r !== "customer",
    )) {
      const hrefs = flattenNav(navFor({ role })).map((l) => l.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs[0]).toBe("/app");
      expect(hrefs).toContain("/app/orders");
      expect(hrefs).toContain("/app/notifications");
    }
  });

  it("Mensagens no menu de todos os papéis, com o selo de não lidas", () => {
    for (const role of ROLES) {
      const links = flattenNav(navFor({ role, functions: null }));
      const messages = links.filter((l) => l.href === "/app/messages");
      expect(messages).toEqual([
        { href: "/app/messages", key: "nav.messages", badge: "messages" },
      ]);
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

  it("tarifário de frete no menu do admin, do comprador e da companhia marítima (a dela); dos outros parceiros, não", () => {
    expect(flattenNav(navFor(ADMIN)).map((l) => l.href)).toContain(
      "/app/freight/tariff",
    );
    expect(
      flattenNav(navFor({ role: "operator", functions: ["buyer"] })).map(
        (l) => l.href,
      ),
    ).toContain("/app/freight/tariff");
    const shipping = flattenNav(navFor({ role: "shipping_line" }));
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
      expect(flattenNav(navFor({ role })).map((l) => l.href)).not.toContain(
        "/app/freight/tariff",
      );
  });
});
