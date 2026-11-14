import { describe, expect, it } from "vitest";
import {
  MENU_HIDDEN,
  flattenNav,
  isActiveHref,
  isNavGroup,
  navFooterFor,
  navFor,
  sidebarNav,
} from "@/lib/nav";
import { ROLES, WELLMIX_FUNCTIONS } from "@/lib/db/schema";

/* Menu lateral (12/11/2026; blocos do mapa desde 14/11/2026,
   docs/FLOW_MENU.md): Control Tower e Pendências no alto, blocos na ordem do
   fluxo, Configurações/Equipe/Auditoria fixos embaixo; grupo com uma tela só
   vira link; grupo vazio some; telas fora do fluxo de hoje (MENU_HIDDEN) não
   aparecem para ninguém. O menu segue as telas do login
   (src/lib/auth/screens.ts): nenhuma tela se repete. */
const ADMIN = { role: "admin" as const };
/** O que a barra lateral desenha (sem Mensagens e Notificações, só no cabeçalho). */
const view = (user: Parameters<typeof navFor>[0]) =>
  sidebarNav(navFor(user)).map((e) =>
    isNavGroup(e)
      ? { group: e.key, items: e.items.map((i) => i.href) }
      : { link: e.href },
  );
const hrefsOf = (user: Parameters<typeof navFor>[0]) =>
  flattenNav(navFor(user)).map((l) => l.href);
const TOP = ["/app", "/app/tasks"];

/** Blocos do fluxo do admin, na ordem do mapa (docs/FLOW_MENU.md). */
const NEW_PRODUCT = [
  "/app/flow/new-product",
  "/app/booking",
  "/app/booking/selection",
  "/app/supplier-requests/invites",
  "/app/supplier-requests",
];
const ORDER = [
  "/app/flow/order",
  "/app/flow/order/orders",
  "/app/flow/order/certification",
  "/app/flow/order/art-material",
  "/app/flow/order/art",
  "/app/reviews",
  "/app/flow/order/contract",
];
const PRODUCTION = [
  "/app/production",
  "/app/flow/production/pre-production",
  "/app/flow/production/inspection",
  "/app/flow/production/sample",
  "/app/flow/production/production",
  "/app/flow/production/booking",
  "/app/flow/production/logistics",
  "/app/flow/production/loading",
  "/app/flow/production/cargo-docs",
  "/app/flow/production/shipment",
];
const DELIVERY = [
  "/app/flow/delivery",
  "/app/flow/delivery/lpco",
  "/app/flow/delivery/cargo-presence",
  "/app/flow/delivery/channel",
  "/app/flow/delivery/logistics",
  "/app/flow/delivery/invoice",
  "/app/flow/delivery/delivery",
  "/app/flow/delivery/return",
  "/app/flow/delivery/storage",
  "/app/containers",
  "/app/freight",
  "/app/freight/tariff",
];
const SALES = [
  "/app/inventory",
  "/app/flow/sales/samples",
  "/app/flow/sales/offers",
  "/app/flow/sales/sale",
];

describe("menu lateral", () => {
  it("admin: Control Tower e Pendências no alto, os blocos do mapa na ordem; ajustes embaixo", () => {
    expect(view(ADMIN)).toEqual([
      ...TOP.map((link) => ({ link })),
      { group: "nav.group.newProduct", items: NEW_PRODUCT },
      { group: "nav.group.order", items: ORDER },
      { group: "nav.production", items: PRODUCTION },
      { group: "nav.group.arrival", items: DELIVERY },
      { group: "nav.group.sales", items: SALES },
      {
        group: "nav.group.finance",
        items: [
          "/app/finance",
          "/app/payables",
          "/app/dashboards/cashflow",
          "/app/commissions",
          "/app/penalties",
        ],
      },
      {
        group: "nav.group.panels",
        items: ["/app/dashboards/owner", "/app/dashboards", "/app/sla"],
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
    // Superplan foi para Configurações (fora do menu lateral).
    expect(hrefsOf(ADMIN)).not.toContain("/app/superplan");
    const links = flattenNav(navFor(ADMIN));
    expect(links.find((l) => l.href === "/app/parties")?.key).toBe(
      "nav.parties",
    );
    for (const href of ["/app/customers", "/app/suppliers"])
      expect(links.map((l) => l.href)).not.toContain(href);
    // Nenhuma tela se repete; todo grupo e todo link solto têm ícone.
    expect(new Set(hrefsOf(ADMIN)).size).toBe(hrefsOf(ADMIN).length);
    for (const e of navFor(ADMIN)) expect(e.icon).toBeTruthy();
    // Contadores: Pendências com o total; cada passo com o seu.
    expect(links.find((l) => l.href === "/app/tasks")?.badge).toBe("tasks");
    expect(links.find((l) => l.href === "/app/flow/order/art")?.step).toBe(
      "order/art",
    );
    expect(links.find((l) => l.href === "/app/finance")?.step).toBe(
      "finance/finance",
    );
    expect(links.find((l) => l.href === "/app/products")?.step).toBe(
      "registry/products",
    );
  });

  it("Produção: grupo com o Overview (/app/production) e os passos, uma vez só", () => {
    const entries = navFor(ADMIN);
    const prod = entries.find(
      (e) => isNavGroup(e) && e.key === "nav.production",
    );
    expect(prod?.icon).toBe("factory");
    expect(hrefsOf(ADMIN).filter((h) => h === "/app/production")).toHaveLength(
      1,
    );
    // Padrão das funções: quem acompanha a produção (comprador e planner) e
    // as diretorias; as outras recebem em Equipe e acessos → Telas e links.
    for (const fn of [
      "buyer",
      "planner",
      "purchasing_director",
      "executive_director",
    ] as const)
      expect(hrefsOf({ role: "operator", functions: [fn] })).toContain(
        "/app/production",
      );
    for (const fn of [
      "product_manager",
      "catalog",
      "finance",
      "designer",
    ] as const)
      expect(hrefsOf({ role: "operator", functions: [fn] })).not.toContain(
        "/app/production",
      );
    // Tela interna: nenhum login de fora vê.
    for (const role of ROLES.filter((r) => r !== "admin" && r !== "operator"))
      expect(hrefsOf({ role })).not.toContain("/app/production");
    expect(isActiveHref("/app/production", "/app/production")).toBe(true);
    expect(isActiveHref("/app/orders", "/app/production")).toBe(false);
    // Overview do bloco acende só na própria tela, não nos passos.
    expect(isActiveHref("/app/flow/order", "/app/flow/order")).toBe(true);
    expect(isActiveHref("/app/flow/order", "/app/flow/order/art")).toBe(false);
    expect(isActiveHref("/app/flow/order/art", "/app/flow/order/art")).toBe(
      true,
    );
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

  it("operador por função: comprador vê Produto novo e Pedido; financeiro só o admin", () => {
    const buyer = hrefsOf({ role: "operator", functions: ["buyer"] });
    expect(buyer).toContain("/app/booking");
    expect(buyer).toContain("/app/flow/order/orders");
    expect(buyer).toContain("/app/products");
    expect(buyer).not.toContain("/app/lines");
    expect(buyer).not.toContain("/app/finance");
    expect(buyer).not.toContain("/app/payables");
    expect(view({ role: "operator", functions: ["designer"] })).toEqual([
      ...TOP.map((link) => ({ link })),
      {
        group: "nav.group.order",
        items: ORDER.filter((h) => h !== "/app/reviews"),
      },
      { group: "nav.group.sales", items: SALES },
      { link: "/app/sla" },
      { link: "/app/products" },
    ]);
  });

  it("cliente: Pendências e os pedidos (a vitrine ainda não abriu)", () => {
    expect(view({ role: "customer" })).toEqual([
      { link: "/app/tasks" },
      { link: "/app/orders" },
    ]);
  });

  it("fornecedores e parceiros: Pendências e um grupo com a tela do papel", () => {
    const top = [{ link: "/app" }];
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

  it("Mensagens e Notificações fora da barra de todos os papéis (ficam no cabeçalho)", () => {
    for (const role of ROLES)
      for (const functions of [null, [...WELLMIX_FUNCTIONS]]) {
        const bar = flattenNav(sidebarNav(navFor({ role, functions }))).map(
          (l) => l.href,
        );
        expect(bar).not.toContain("/app/messages");
        expect(bar).not.toContain("/app/notifications");
      }
  });

  it("tela atual: /app só na própria página; os demais também nas subpáginas", () => {
    expect(isActiveHref("/app", "/app")).toBe(true);
    expect(isActiveHref("/app", "/app/orders")).toBe(false);
    expect(isActiveHref("/app/orders", "/app/orders/123")).toBe(true);
    expect(isActiveHref("/app/orders", "/app/orders-x")).toBe(false);
    // Seleção de itens tem link próprio: "Booking" não acende junto.
    expect(isActiveHref("/app/booking", "/app/booking/selection")).toBe(false);
    expect(isActiveHref("/app/booking", "/app/booking/abc")).toBe(true);
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

/* Barra lateral sem Mensagens e Notificações (dono, 14/11/2026): as duas
   ficam só nos ícones do cabeçalho. A lista do menu (navFor) continua com
   elas, porque o ícone de mensagens do cabeçalho e o "Voltar" saem dela. */
describe("barra lateral sem Mensagens e Notificações", () => {
  const HIDDEN = ["/app/messages", "/app/notifications"];
  const sidebarHrefs = (user: Parameters<typeof navFor>[0]) =>
    flattenNav(sidebarNav(navFor(user))).map((l) => l.href);

  it("nenhum papel vê as duas linhas na barra; o resto do menu fica igual, na mesma ordem", () => {
    for (const role of ROLES) {
      const user = { role, functions: null };
      const all = hrefsOf(user);
      expect(all).toEqual(expect.arrayContaining(HIDDEN));
      expect(sidebarHrefs(user)).toEqual(
        all.filter((href) => !HIDDEN.includes(href)),
      );
    }
  });

  it("admin: Control Tower e Pendências no alto, depois os mesmos grupos", () => {
    const full = navFor(ADMIN);
    const bar = sidebarNav(full);
    expect(
      bar.slice(0, 2).map((e) => (isNavGroup(e) ? e.key : e.href)),
    ).toEqual(["/app", "/app/tasks"]);
    expect(bar.filter(isNavGroup)).toEqual(full.filter(isNavGroup));
  });

  it("não mexe na lista do menu (cabeçalho e Voltar) e tira as duas também de dentro de um grupo", () => {
    const full = navFor({ role: "supplier" });
    const copy = structuredClone(full);
    sidebarNav(full);
    expect(full).toEqual(copy);
    expect(
      sidebarNav([
        {
          key: "nav.group.orders",
          icon: "box",
          items: [
            { href: "/app/messages", key: "nav.messages" },
            { href: "/app/orders", key: "nav.orders" },
          ],
        },
        {
          key: "nav.group.panels",
          icon: "chart",
          items: [{ href: "/app/notifications", key: "nav.notifications" }],
        },
      ]),
    ).toEqual([
      {
        key: "nav.group.orders",
        icon: "box",
        items: [{ href: "/app/orders", key: "nav.orders" }],
      },
    ]);
    // Item pai (com tela própria) que perde os subitens vira o link da tela.
    expect(
      sidebarNav([
        {
          key: "nav.production",
          icon: "box",
          href: "/app/production",
          items: [{ href: "/app/messages", key: "nav.messages" }],
        },
      ]),
    ).toEqual([
      { href: "/app/production", key: "nav.production", icon: "box" },
    ]);
  });
});
