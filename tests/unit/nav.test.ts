import { describe, expect, it } from "vitest";
import {
  MENU_HIDDEN,
  flattenNav,
  isActiveHref,
  isNavGroup,
  navFooterFor,
  navFor,
} from "@/lib/nav";
import { ROLES, WELLMIX_FUNCTIONS } from "@/lib/db/schema";

/* Menu lateral (12/11/2026): links do dia a dia no alto, grupos na ordem do
   fluxo, Configurações/Equipe/Auditoria fixos embaixo; grupo com uma tela só
   vira link; grupo vazio some; telas fora do fluxo de hoje (MENU_HIDDEN) não
   aparecem para ninguém. O menu segue as telas do login
   (src/lib/auth/screens.ts): nenhuma tela se repete. */
const ADMIN = { role: "admin" as const };
const view = (user: Parameters<typeof navFor>[0]) =>
  navFor(user).map((e) =>
    isNavGroup(e)
      ? { group: e.key, items: e.items.map((i) => i.href) }
      : { link: e.href },
  );
const hrefsOf = (user: Parameters<typeof navFor>[0]) =>
  flattenNav(navFor(user)).map((l) => l.href);
const TOP = ["/app", "/app/tasks", "/app/messages", "/app/notifications"];

describe("menu lateral", () => {
  it("admin: dia a dia no alto e cinco grupos na ordem do fluxo; ajustes embaixo", () => {
    expect(view(ADMIN)).toEqual([
      ...TOP.map((link) => ({ link })),
      {
        group: "nav.group.purchasing",
        items: [
          "/app/booking",
          "/app/booking/selection",
          "/app/supplier-requests/invites",
          "/app/supplier-requests",
        ],
      },
      {
        group: "nav.group.delivery",
        items: [
          "/app/orders",
          "/app/reviews",
          "/app/containers",
          "/app/freight",
          "/app/freight/tariff",
          "/app/inventory",
        ],
      },
      {
        group: "nav.group.finance",
        items: [
          "/app/finance",
          "/app/payables",
          "/app/commissions",
          "/app/penalties",
        ],
      },
      {
        group: "nav.group.panels",
        items: [
          "/app/dashboards/owner",
          "/app/dashboards/cashflow",
          "/app/superplan",
          "/app/dashboards",
          "/app/sla",
        ],
      },
      {
        group: "nav.group.registry",
        items: ["/app/parties", "/app/products", "/app/lines"],
      },
    ]);
    expect(navFooterFor(ADMIN).map((l) => [l.href, l.key])).toEqual([
      ["/app/settings", "nav.settings"],
      ["/app/team", "nav.teamAccess"],
      ["/app/audit", "nav.audit"],
    ]);
    // Pedidos de compra e Parceiros (clientes, fornecedores e demais numa tela só).
    const links = flattenNav(navFor(ADMIN));
    expect(links.find((l) => l.href === "/app/orders")?.key).toBe(
      "nav.purchaseOrders",
    );
    expect(links.find((l) => l.href === "/app/parties")?.key).toBe(
      "nav.parties",
    );
    for (const href of ["/app/customers", "/app/suppliers"])
      expect(links.map((l) => l.href)).not.toContain(href);
    // Todo grupo e todo link solto têm ícone.
    for (const e of navFor(ADMIN)) expect(e.icon).toBeTruthy();
  });

  it("telas fora do fluxo de hoje não aparecem no menu de ninguém", () => {
    expect(MENU_HIDDEN).toEqual([
      "/app/requests",
      "/app/explore",
      "/app/sourcing",
      "/app/marketing",
      "/app/after-sales",
      "/app/history",
    ]);
    for (const role of ROLES)
      for (const functions of [null, [...WELLMIX_FUNCTIONS]]) {
        const hrefs = hrefsOf({ role, functions });
        for (const hidden of MENU_HIDDEN) expect(hrefs).not.toContain(hidden);
      }
  });

  it("operador: sem função, o dia a dia e o SLA; com todas, tudo menos o que é só do admin", () => {
    const none = { role: "operator" as const, functions: null };
    expect(view(none)).toEqual([
      ...TOP.map((link) => ({ link })),
      { link: "/app/sla" },
    ]);
    expect(navFooterFor(none)).toEqual([]);
    const all = hrefsOf({
      role: "operator",
      functions: [...WELLMIX_FUNCTIONS],
    });
    const admin = hrefsOf(ADMIN);
    expect(all).toEqual(
      admin.filter(
        (h) =>
          ![
            "/app/finance",
            "/app/commissions",
            "/app/payables",
            "/app/superplan",
            "/app/dashboards/owner",
            "/app/dashboards/cashflow",
          ].includes(h),
      ),
    );
    expect(
      navFooterFor({ role: "operator", functions: [...WELLMIX_FUNCTIONS] }).map(
        (l) => l.href,
      ),
    ).not.toContain("/app/settings");
  });

  it("operador por função: comprador vê Compras e Pedidos e entrega; financeiro só o admin", () => {
    const buyer = hrefsOf({ role: "operator", functions: ["buyer"] });
    expect(buyer).toContain("/app/booking");
    expect(buyer).toContain("/app/orders");
    expect(buyer).toContain("/app/products");
    expect(buyer).not.toContain("/app/lines");
    expect(buyer).not.toContain("/app/finance");
    expect(buyer).not.toContain("/app/payables");
    expect(view({ role: "operator", functions: ["designer"] })).toEqual([
      ...TOP.map((link) => ({ link })),
      {
        group: "nav.group.delivery",
        items: ["/app/orders", "/app/inventory"],
      },
      { link: "/app/sla" },
      { link: "/app/products" },
    ]);
  });

  it("cliente: o dia a dia e os pedidos (a vitrine ainda não abriu)", () => {
    expect(view({ role: "customer" })).toEqual([
      { link: "/app/tasks" },
      { link: "/app/messages" },
      { link: "/app/notifications" },
      { link: "/app/orders" },
    ]);
  });

  it("fornecedores e parceiros: Pendências, Mensagens, Notificações e um grupo com a tela do papel", () => {
    const top = ["/app", "/app/messages", "/app/notifications"].map((link) => ({
      link,
    }));
    expect(view({ role: "supplier" })).toEqual([
      ...top,
      {
        group: "nav.group.myBookings",
        items: [
          "/app/supplier-requests/invites",
          "/app/supplier-requests",
          "/app/orders",
          "/app/account",
        ],
      },
    ]);
    expect(view({ role: "shipping_line" })).toEqual([
      ...top,
      {
        group: "nav.group.orders",
        items: ["/app/orders", "/app/freight", "/app/freight/tariff"],
      },
    ]);
    expect(view({ role: "legal" })).toEqual([
      ...top,
      { group: "nav.group.orders", items: ["/app/orders", "/app/penalties"] },
    ]);
    // Grupo com uma tela só vira link direto (sem lista de um item).
    for (const role of [
      "carrier",
      "comex",
      "logistics",
      "ocp",
      "agency",
    ] as const)
      expect(view({ role })).toEqual([...top, { link: "/app/orders" }]);
    // O despachante tem também o NCM dos itens de booking (docs/BOOKING.md).
    expect(view({ role: "broker" })).toEqual([
      ...top,
      { group: "nav.group.orders", items: ["/app/orders", "/app/ncm-items"] },
    ]);
    for (const role of ROLES.filter(
      (r) => r !== "admin" && r !== "operator" && r !== "customer",
    )) {
      const hrefs = hrefsOf({ role });
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs[0]).toBe("/app");
      expect(hrefs).toContain("/app/orders");
      expect(navFooterFor({ role })).toEqual([]);
    }
  });

  it("Mensagens e Notificações no menu de todos os papéis, com o selo de não lidas", () => {
    for (const role of ROLES) {
      const links = flattenNav(navFor({ role, functions: null }));
      expect(links.filter((l) => l.href === "/app/messages")).toEqual([
        {
          href: "/app/messages",
          key: "nav.messages",
          badge: "messages",
          icon: "messages",
        },
      ]);
      expect(links.find((l) => l.href === "/app/notifications")?.badge).toBe(
        "notifications",
      );
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
