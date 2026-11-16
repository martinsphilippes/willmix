import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Condições do pedido e contatos do cliente na Nova solicitação (dono,
 * 15/11/2026; docs/ORDER_TERMS.md): tipo de operação, formato de venda,
 * entrega (portal + Sankhya), país de origem > grupo de produto e os
 * contatos do cliente (às cegas na primeira vez, nunca iguais aos do
 * vendedor).
 */
withTempStore();

let current: unknown = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => current,
}));
const sankhya: { rows: Array<Record<string, unknown>> | null } = {
  rows: [{ CODPARC: 812, NOMEPARC: "RODONAVES", NOMECID: "JOINVILLE" }],
};
vi.mock("@/lib/integrations/sankhya-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/integrations/sankhya-client")
  >()),
  executeQuery: async (sql: string) => {
    if (!sankhya.rows) throw new Error("Sankhya fora do ar");
    // Grupos de produto (TGFGRU): a família é o grupo pai da linha.
    if (/FROM TGFGRU/.test(sql)) {
      // Dois ramos com uma família de mesmo nome (caixa diferente): a
      // família é o avô da linha e junta os dois.
      const g = (code: number, name: string, parent: number) => ({
        CODGRUPOPROD: code,
        DESCRGRUPOPROD: name,
        CODGRUPAI: parent,
      });
      return {
        columns: ["CODGRUPOPROD", "DESCRGRUPOPROD", "CODGRUPAI"],
        rows: /CODGRUPOPROD > 0\b/.test(sql)
          ? [
              // Duas raízes (1º nível) com o mesmo nome em caixas diferentes.
              g(12, "BRINQUEDOS GERAIS", 0),
              g(14, "Brinquedos Gerais", 0),
              g(1200, "BRINQUEDOS GERAIS", 12),
              g(1400, "Brinquedos Gerais", 14),
              g(12007, "BONECAS", 1200),
              g(14005, "PISCINAS", 1400),
              g(12007001, "BRINQUEDOS", 12007),
              g(14005002, "INFLAVEIS", 14005),
            ]
          : [],
      };
    }
    // Fornecedor de cada produto (TGFPRO.CODPARCFORN), pela API.
    // Família de cada produto (1º nível da árvore; técnico do Sankhya).
    if (/COD_FAMILIA/.test(sql))
      return {
        columns: ["CODPROD", "COD_FAMILIA", "FAMILIA"],
        rows: /CODPROD > 0\b/.test(sql)
          ? [
              { CODPROD: 7429, COD_FAMILIA: 160000000, FAMILIA: "CERAMICA " },
              { CODPROD: 21952, COD_FAMILIA: 90000000, FAMILIA: "WELLCLEAN" },
            ]
          : [],
      };
    if (/FROM TGFPRO/.test(sql))
      return {
        columns: ["CODPROD", "CODPARCFORN"],
        rows: /CODPROD > 0\b/.test(sql)
          ? [{ CODPROD: 9001, CODPARCFORN: 4321 }]
          : [],
      };
    return { columns: ["CODPARC", "NOMEPARC", "NOMECID"], rows: sankhya.rows };
  },
}));

const terms = await import("@/lib/order-terms");
const { seedDemo } = await import("@/lib/seed");
const contacts = await import("@/lib/services/customer-contacts");
const origin = await import("@/lib/services/product-origin");
const carriers = await import("@/lib/services/delivery-carriers");
const orderTerms = await import("@/lib/services/order-terms");
const { searchProducts } = await import("@/lib/services/product-search");
const optionsRoute = await import("@/app/api/requests/order-options/route");
const contactsRoute = await import("@/app/api/customers/contacts/route");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;

const full = (
  over: Partial<Record<string, { phone: string; email: string }>> = {},
) =>
  ({
    partner: { phone: "(47) 99999-0001", email: "socio@loja.com" },
    buyer: { phone: "(47) 99999-0002", email: "compras@loja.com" },
    finance: { phone: "(47) 99999-0003", email: "fin@loja.com" },
    logistics: { phone: "(47) 99999-0004", email: "log@loja.com" },
    ...over,
  }) as import("@/lib/order-terms").CustomerContacts;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("regras puras", () => {
  it("país: sigla, caixa e acento dão a mesma chave", () => {
    expect(terms.countryKey("CN")).toBe("CHINA");
    expect(terms.countryKey("China")).toBe("CHINA");
    expect(terms.countryKey("ÍNDIA")).toBe("INDIA");
    expect(terms.countryName("BR")).toBe("BRASIL");
    expect(terms.countryKey(null)).toBe("");
  });

  it("VIP da cotação V2: WD = 5; Wellmix pelo nível; sem formato, nenhum", () => {
    expect(terms.saleVip("wd", null)).toBe(5);
    expect(terms.saleVip("wellmix", "hiper")).toBe(3);
    expect(terms.saleVip("wellmix", "evo")).toBe(1.42857143);
    expect(terms.saleVip("wellmix", null)).toBeNull();
    expect(terms.saleVip(null, null)).toBeNull();
    expect(terms.DELIVERY_ROUTE.customer).toBe("PORTO_CLIENTE");
    expect(terms.DELIVERY_ROUTE.wellmix).toBe("VIA_DEPOSITO");
  });

  it("transportadora: o valor do campo vai e volta", () => {
    const v = terms.carrierValue({ source: "sankhya", code: "812" });
    expect(terms.parseCarrierValue(v)).toEqual({
      source: "sankhya",
      code: "812",
    });
    expect(terms.parseCarrierValue("x:1")).toBeNull();
  });

  it("contatos: todos obrigatórios, válidos e diferentes dos do vendedor", () => {
    expect(terms.contactIssues(full(), [])).toEqual([]);
    const missing = terms.contactIssues(
      full({ buyer: { phone: "", email: "" } }),
      [],
    );
    expect(missing.map((i) => `${i.role}.${i.field}.${i.code}`)).toEqual([
      "buyer.phone.required",
      "buyer.email.required",
    ]);
    const bad = terms.contactIssues(
      full({ finance: { phone: "123", email: "fin@" } }),
      [],
    );
    expect(bad.map((i) => i.code)).toEqual(["invalid_phone", "invalid_email"]);
    const seller = terms.contactIssues(
      full({
        partner: { phone: "+55 47 3333-4444", email: "Vendedor@Wellmix.com" },
      }),
      [{ email: "vendedor@wellmix.com", phone: "4733334444" }],
    );
    expect(seller.map((i) => `${i.field}.${i.code}`)).toEqual([
      "phone.same_as_seller",
      "email.same_as_seller",
    ]);
  });
});

describe("contatos do cliente", () => {
  it("primeira vez às cegas; depois de gravados, aparecem", async () => {
    expect(await contacts.customerContactsView(admin, "cliente-joao")).toEqual({
      state: "blind",
    });
    expect(await contacts.hasPortalContacts("cliente-joao")).toBe(false);
    await contacts.saveCustomerContacts(admin, "cliente-joao", full());
    const view = await contacts.customerContactsView(admin, "cliente-joao");
    expect(view?.state).toBe("known");
    expect(view && view.state === "known" && view.contacts.buyer.email).toBe(
      "compras@loja.com",
    );
    expect(await contacts.hasPortalContacts("cliente-joao")).toBe(true);
  });

  it("recusa o e-mail de quem preenche (o vendedor)", async () => {
    await expect(
      contacts.saveCustomerContacts(
        admin,
        "cliente-joao",
        full({ logistics: { phone: "4799990009", email: admin.email } }),
      ),
    ).rejects.toThrow("contacts_same_as_seller");
  });

  it("só a Wellmix; a rota não abre para o cliente", async () => {
    await expect(
      contacts.customerContactsView(joao, "cliente-joao"),
    ).rejects.toThrow();
    current = joao;
    const res = await contactsRoute.GET(
      new Request("http://x/api/customers/contacts?customer=cliente-joao"),
    );
    expect(res.status).toBe(404);
    current = null;
  });
});

describe("país de origem, grupo e entrega", () => {
  it("país pelo fornecedor; grupo = família (1º nível do Sankhya); a busca só oferece os deles", async () => {
    const { getStore } = await import("@/lib/db");
    const families = await import("@/lib/services/sankhya-product-families");
    // Sem código do Sankhya nas linhas: cada linha é a própria família.
    origin.resetOriginIndex();
    families.resetSankhyaProductFamilies();
    expect((await origin.originGroups("CHINA")).map((g) => g.id)).toContain(
      "fm:BRINQUEDOS",
    );
    // Com o código da linha: a raiz da árvore ("BRINQUEDOS GERAIS" nas duas).
    await getStore().update("product_lines", "linha-brinquedos", {
      sankhyaCode: "12007001",
    });
    await getStore().update("product_lines", "linha-inflaveis", {
      sankhyaCode: "14005002",
    });
    origin.resetOriginIndex();
    families.resetSankhyaProductFamilies();
    const countries = await origin.originCountries();
    expect(countries.find((c) => c.key === "CHINA")?.products).toBeGreaterThan(
      0,
    );
    const groups = await origin.originGroups("CHINA");
    expect(groups.find((g) => g.id === "fm:BRINQUEDOS_GERAIS")).toMatchObject({
      name: "BRINQUEDOS GERAIS",
    });
    expect(groups.map((g) => g.id)).not.toContain("fm:BRINQUEDOS");
    const search = (q: string, family: string) =>
      searchProducts({
        q,
        scope: "catalog",
        origin: { country: "CHINA", family },
      }).then((hits) => hits.map((p) => p.id));
    expect(await search("boneca", "fm:BRINQUEDOS_GERAIS")).toContain(
      "prod-boneca",
    );
    expect(await search("piscina", "fm:BRINQUEDOS_GERAIS")).toContain(
      "prod-piscina",
    );
    expect(await search("boneca", "fm:UTILIDADES_DOMESTICAS")).not.toContain(
      "prod-boneca",
    );
    // Mesmo nome em ramos diferentes = uma família só, com os dois.
    expect(
      groups.filter((g) => g.name.toUpperCase() === "BRINQUEDOS GERAIS"),
    ).toHaveLength(1);
    expect(origin.familyKey("Utilidades Domésticas")).toBe(
      "fm:UTILIDADES_DOMESTICAS",
    );
    // Seletor de produtos (lupa; docs/ORDER_TERMS.md 11.5): Grupo, Sub
    // grupo e Coleção do grupo abaixo da família, com as contas andando juntas.
    const browse = (
      filters: [string | null, string | null, string | null],
      seen: Array<[string | null, string | null, string | null]> = [],
    ) =>
      origin.browseOrigin({
        country: "CHINA",
        family: "fm:BRINQUEDOS_GERAIS",
        filters,
        seen,
        page: 1,
        perPage: 12,
      });
    const all = await browse([null, null, null]);
    expect(all.items.map((p) => p.id)).toEqual(
      expect.arrayContaining(["prod-boneca", "prod-piscina"]),
    );
    expect(all.facets[0].map((o) => o.key)).toEqual(["lv:BRINQUEDOS_GERAIS"]);
    expect(all.facets[1].map((o) => o.name).sort()).toEqual([
      "BONECAS",
      "PISCINAS",
    ]);
    expect(all.facets[2].map((o) => o.name).sort()).toEqual([
      "BRINQUEDOS",
      "INFLAVEIS",
    ]);
    // Sub grupo escolhido: a coleção e a lista acompanham.
    const bonecas = await browse([null, "lv:BONECAS", null]);
    expect(bonecas.items.map((p) => p.id)).toContain("prod-boneca");
    expect(bonecas.items.map((p) => p.id)).not.toContain("prod-piscina");
    expect(bonecas.facets[2].map((o) => o.key)).toEqual(["lv:BRINQUEDOS"]);
    // O próprio nível continua com as outras opções (para trocar).
    expect(bonecas.facets[1]).toHaveLength(2);
    // Filtro visto: as bonecas contam como vistas; as piscinas, não.
    const seen = await browse([null, null, null], [[null, "lv:BONECAS", null]]);
    expect(seen.items.find((p) => p.id === "prod-boneca")?.seen).toBe(true);
    expect(seen.items.find((p) => p.id === "prod-piscina")?.seen).toBe(false);
    const sub = seen.facets[1].find((o) => o.key === "lv:BONECAS")!;
    expect(sub.seen).toBe(sub.products);
    expect(seen.family.seen).toBe(bonecas.total);
    expect(seen.family.products).toBe(all.total);
    // Família do próprio produto pelo Sankhya (o 1º nível pela consulta do
    // técnico) vale por cima da linha; o histórico liga o código ao produto.
    await getStore().update("products", "prod-boneca", {
      sankhyaCode: "7429",
    });
    origin.resetOriginIndex();
    families.resetSankhyaFamiliesByProduct();
    const byCode = await origin.originsByCode([7429, 999, null]);
    expect(byCode.get(7429)).toMatchObject({
      productId: "prod-boneca",
      family: "fm:CERAMICA",
    });
    expect(
      (await origin.originGroups("CHINA")).find((g) => g.id === "fm:CERAMICA"),
    ).toMatchObject({ name: "CERAMICA" });
    expect(await search("boneca", "fm:CERAMICA")).toContain("prod-boneca");
    // De volta: a boneca sem código do Sankhya (os testes seguintes).
    await getStore().update("products", "prod-boneca", { sankhyaCode: null });
    origin.resetOriginIndex();
    expect(byCode.has(999)).toBe(false);
    expect(await origin.productOrigin("prod-piscina")).toMatchObject({
      family: "fm:BRINQUEDOS_GERAIS",
    });
  });

  it("produto sem fornecedor no portal: o país pelo fornecedor do Sankhya (API)", async () => {
    const { getStore } = await import("@/lib/db");
    const store = getStore();
    // A jarra não tem fornecedor no portal; no Sankhya, o 4321 (Guangzhou B).
    await store.update("products", "prod-jarra", {
      supplierId: null,
      sankhyaCode: "9001",
    });
    await store.update("parties", "fornecedor-b", { sankhyaCode: "4321" });
    origin.resetOriginIndex();
    (
      await import("@/lib/services/sankhya-product-suppliers")
    ).resetSankhyaProductSuppliers();
    expect(await origin.productOrigin("prod-jarra")).toMatchObject({
      country: "CHINA",
      lineId: "linha-utilidades",
    });
    // Sem o Sankhya, a jarra fica sem país (e fora da venda).
    sankhya.rows = null;
    origin.resetOriginIndex();
    (
      await import("@/lib/services/sankhya-product-suppliers")
    ).resetSankhyaProductSuppliers();
    expect((await origin.productOrigin("prod-jarra"))?.country).toBe("");
    sankhya.rows = [
      { CODPARC: 812, NOMEPARC: "RODONAVES", NOMECID: "JOINVILLE" },
    ];
    origin.resetOriginIndex();
    (
      await import("@/lib/services/sankhya-product-suppliers")
    ).resetSankhyaProductSuppliers();
  });

  it("transportadoras do portal e do Sankhya; sem o Sankhya, só as do portal", async () => {
    carriers.resetCarrierCache();
    const list = await carriers.deliveryCarriers();
    expect(list.sankhya).toBe("ok");
    expect(list.carriers.map((c) => `${c.source}:${c.code}`)).toEqual(
      expect.arrayContaining(["portal:transportador", "sankhya:812"]),
    );
    carriers.resetCarrierCache();
    sankhya.rows = null;
    const off = await carriers.deliveryCarriers();
    expect(off.sankhya).toBe("error");
    expect(off.carriers.every((c) => c.source === "portal")).toBe(true);
    sankhya.rows = [{ CODPARC: 812, NOMEPARC: "RODONAVES", NOMECID: null }];
    carriers.resetCarrierCache();
  });

  it("forma de pagamento da solicitação: uma das formas ativas, copiada (16/11/2026)", async () => {
    const { listPaymentPlans } =
      await import("@/lib/services/customer-payment");
    const { getStore } = await import("@/lib/db");
    const [first, second] = await listPaymentPlans();
    const copy = await orderTerms.resolveRequestPaymentPlan(first.id);
    expect(copy).toEqual({
      planId: first.id,
      name: "10% no pedido; 90% no embarque",
      installments: [
        { percent: 10, event: "order", days: 0 },
        { percent: 90, event: "shipment", days: 0 },
      ],
      monthlyInterestPercent: null,
      requiresApproval: false,
    });
    // Sem forma, forma que não existe ou inativa: recusada.
    for (const id of ["", "nao-existe", "../x"])
      await expect(orderTerms.resolveRequestPaymentPlan(id)).rejects.toThrow(
        "order_terms_payment_plan",
      );
    await getStore().update("payment_plans", second.id, { active: false });
    await expect(
      orderTerms.resolveRequestPaymentPlan(second.id),
    ).rejects.toThrow("order_terms_payment_plan");
    await getStore().update("payment_plans", second.id, { active: true });
  });

  it("confere as condições: só TS, BRASIL fora, re-despacho Sim/Não, transportador obrigatório", async () => {
    const base = {
      operationType: "ts",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      carrierCaller: "wellmix",
      carrier: "portal:transportador",
      redispatchCarrier: "portal:transportador",
      redispatch: "yes",
      originCountry: "CHINA",
      productFamily: "fm:BRINQUEDOS_GERAIS",
    };
    const resolved = await orderTerms.resolveOrderTerms(base);
    expect(resolved).toMatchObject({
      operationType: "ts",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      carrierCaller: "wellmix",
      carrier: { source: "portal", name: "Trans Rodo" },
      // A Wellmix chama, com re-despacho: as duas transportadoras.
      redispatch: { source: "portal", name: "Trans Rodo" },
      redispatchRequired: true,
      originCountryName: "CHINA",
      productFamily: "fm:BRINQUEDOS_GERAIS",
      productFamilyName: "BRINQUEDOS GERAIS",
      confirmation: null,
    });
    await expect(
      orderTerms.assertProductsMatchOrigin(
        ["prod-boneca", "prod-piscina", null],
        resolved,
      ),
    ).resolves.toBeUndefined();
    await expect(
      orderTerms.assertProductsMatchOrigin(["prod-panela"], resolved),
    ).rejects.toThrow("order_terms_mismatch");
    const fails = async (over: Record<string, string>, code: string) =>
      expect(
        orderTerms.resolveOrderTerms({ ...base, ...over }),
      ).rejects.toThrow(code);
    await fails({ operationType: "sale" }, "order_terms_operation_disabled");
    await fails({ originCountry: "BRASIL" }, "order_terms_country_disabled");
    await fails({ redispatch: "" }, "order_terms_redispatch");
    await fails({ carrier: "" }, "order_terms_carrier_required");
    await fails({ carrierCaller: "" }, "order_terms_carrier_caller");
    // Valor do transporte digitado (Wellmix chama): grava em reais.
    expect(
      (
        await orderTerms.resolveOrderTerms({
          ...base,
          deliveryFreightBrl: "1.500,50",
        })
      ).deliveryFreightBrl,
    ).toBe(1500.5);
    expect(resolved.deliveryFreightBrl).toBeNull();
    await fails({ deliveryFreightBrl: "abc" }, "order_terms_freight");
    await fails(
      { redispatchCarrier: "" },
      "order_terms_redispatch_carrier_required",
    );
    // O cliente chama: nenhuma transportadora aqui (ele informa).
    expect(
      await orderTerms.resolveOrderTerms({
        ...base,
        carrierCaller: "customer",
        carrier: "",
        redispatchCarrier: "",
      }),
    ).toMatchObject({
      carrierCaller: "customer",
      carrier: null,
      redispatch: null,
      redispatchRequired: true,
    });
    await fails({ wellmixTier: "" }, "order_terms_tier");
    await fails({ originCountry: "" }, "order_terms_origin");
    await fails({ productFamily: "sk:999" }, "order_terms_origin");
    expect(terms.countryAllowed("ts", "BRASIL")).toBe(false);
    expect(terms.countryAllowed("sale", "BRASIL")).toBe(true);
    expect(await origin.originGroups("")).toEqual([]);
  });

  it("telas de TS e de Venda (docs/REQUEST_SCREENS.md): o tipo é o da tela; Venda aceita BRASIL", async () => {
    const base = {
      operationType: "sale",
      saleFormat: "wd",
      wellmixTier: "",
      carrierCaller: "customer",
      carrier: "",
      redispatchCarrier: "",
      redispatch: "no",
      originCountry: "CHINA",
      productFamily: "fm:BRINQUEDOS_GERAIS",
    };
    // A tela de TS grava TS, mesmo com Venda (ou nada) no formulário.
    expect(
      (await orderTerms.resolveOrderTerms(base, { operationType: "ts" }))
        .operationType,
    ).toBe("ts");
    expect(
      (
        await orderTerms.resolveOrderTerms(
          { ...base, operationType: "" },
          { operationType: "ts" },
        )
      ).operationType,
    ).toBe("ts");
    // A de Venda grava Venda (liberada pela própria tela).
    expect(
      (
        await orderTerms.resolveOrderTerms(
          { ...base, operationType: "ts" },
          { operationType: "sale" },
        )
      ).operationType,
    ).toBe("sale");
    // BRASIL: vale na Venda, não no TS (a regra de sempre).
    const brazil = { ...base, originCountry: "BRASIL" };
    await expect(
      orderTerms.resolveOrderTerms(brazil, { operationType: "sale" }),
    ).resolves.toMatchObject({
      operationType: "sale",
      originCountry: "BRASIL",
    });
    await expect(
      orderTerms.resolveOrderTerms(brazil, { operationType: "ts" }),
    ).rejects.toThrow("order_terms_country_disabled");
    // Sem a tela (Encomendas): Venda continua desligada.
    await expect(orderTerms.resolveOrderTerms(base)).rejects.toThrow(
      "order_terms_operation_disabled",
    );
  });

  it("a rota das opções é só da Wellmix", async () => {
    current = joao;
    expect(
      (
        await optionsRoute.GET(
          new Request("http://x/api/requests/order-options"),
        )
      ).status,
    ).toBe(404);
    current = admin;
    const res = await optionsRoute.GET(
      new Request("http://x/api/requests/order-options?country=CHINA"),
    );
    const body = (await res.json()) as { groups: Array<{ id: string }> };
    expect(body.groups.map((g) => g.id)).toContain("fm:BRINQUEDOS_GERAIS");
    current = null;
  });
});

describe("confirmação do cliente e rascunho", () => {
  it("CNPJ: dígitos verificadores", () => {
    expect(terms.validCnpj("11.222.333/0001-81")).toBe(true);
    expect(terms.validCnpj("11.222.333/0001-82")).toBe(false);
    expect(terms.validCnpj("11111111111111")).toBe(false);
    expect(terms.formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("a venda nasce aguardando o cliente; ele confirma e informa a transportadora do re-despacho", async () => {
    const { getStore } = await import("@/lib/db");
    const { createRequestBatch } = await import("@/lib/services/requests");
    const confirmation = await import("@/lib/services/customer-confirmation");
    const store = getStore();
    const resolved = await orderTerms.resolveOrderTerms({
      operationType: "ts",
      saleFormat: "wd",
      wellmixTier: "",
      // O cliente chama o transportador (16/11/2026): ele informa as duas.
      carrierCaller: "customer",
      carrier: "",
      redispatch: "yes",
      originCountry: "CHINA",
      productFamily: "fm:BRINQUEDOS_GERAIS",
    });
    const [request] = await createRequestBatch(
      admin,
      {
        customerId: "cliente-joao",
        deadline: null,
        notes: null,
        requestedForUserId: joao.id,
        orderTerms: resolved,
      },
      [
        {
          productId: null,
          productName: "Pote de teste",
          description: "Pote de teste",
          specification: null,
          quantity: 100,
          unit: "un",
          sourcingDemand: false,
        },
      ],
    );
    expect(request.status).toBe("AWAITING_CUSTOMER");
    // Só o login do cliente com acesso confirma; o aviso é obrigatório.
    expect(confirmation.canConfirm(admin, request)).toBe(false);
    expect(confirmation.canConfirm(joao, request)).toBe(true);
    await expect(
      confirmation.confirmCustomerOrder(joao, request.id, {
        accept: false,
        cnpj: "",
        carrierName: "",
      }),
    ).rejects.toThrow("confirm_accept_required");
    await expect(
      confirmation.confirmCustomerOrder(joao, request.id, {
        accept: true,
        cnpj: "123",
        carrierName: "",
        mainCnpj: "123",
      }),
    ).rejects.toThrow("cnpj_invalid");
    // Sem a transportadora do pedido (o cliente chama): recusa.
    await expect(
      confirmation.confirmCustomerOrder(joao, request.id, {
        accept: true,
        cnpj: "11.222.333/0001-81",
        carrierName: "Rodo Sul Transportes",
      }),
    ).rejects.toThrow("cnpj_required");
    // Modo memória: sem a consulta, o nome se digita; a transportadora é
    // cadastrada pelo CNPJ.
    const [done] = await confirmation.confirmCustomerOrder(joao, request.id, {
      accept: true,
      cnpj: "11.222.333/0001-81",
      carrierName: "Rodo Sul Transportes",
      mainCnpj: "11.444.777/0001-61",
      mainCarrierName: "Trans Norte Cargas",
    });
    expect(done.status).toBe("REQUESTED");
    expect(done.orderTerms?.confirmation).toMatchObject({
      userId: joao.id,
      noReturnsAccepted: true,
      redispatchCarrier: {
        cnpj: "11222333000181",
        name: "Rodo Sul Transportes",
        source: "manual",
      },
      carrier: { cnpj: "11444777000161", name: "Trans Norte Cargas" },
    });
    const carrier = await store.get(
      "parties",
      done.orderTerms!.confirmation!.redispatchCarrier!.partyId,
    );
    expect(carrier).toMatchObject({ type: "carrier", taxId: "11222333000181" });
    // Confirmado: não confirma de novo.
    await expect(
      confirmation.confirmCustomerOrder(joao, request.id, {
        accept: true,
        cnpj: "",
        carrierName: "",
      }),
    ).rejects.toThrow("confirm_not_allowed");
  });

  it("rascunho: só de quem criou, volta como foi salvo e some ao apagar", async () => {
    const drafts = await import("@/lib/services/request-drafts");
    const form = new FormData();
    form.append("customerId", "cliente-joao");
    form.append("p0.productId", "prod-boneca");
    form.append("p0.productName", "Boneca articulada 30 cm");
    form.append("p0.quantity", "480");
    form.append("p1.productName", "Copo");
    form.append("p1.quantity", "10");
    form.append("$ACTION_ID_abc", "");
    const draft = await drafts.saveRequestDraft(admin, form, null);
    expect(draft).toMatchObject({
      customerId: "cliente-joao",
      customerName: "Loja do João Ltda",
      title: "Boneca articulada 30 cm + 1",
      itemCount: 2,
    });
    expect(draft.payload.some(([k]) => k.startsWith("$ACTION"))).toBe(false);
    expect(drafts.draftForm(draft).get("p0.quantity")).toBe("480");
    const operador = (
      await (
        await import("@/lib/db")
      )
        .getStore()
        .list("users", { filter: { email: "operador@wellmix.com" } })
    )[0];
    expect(await drafts.getRequestDraft(operador, draft.id)).toBeNull();
    expect((await drafts.listRequestDrafts(admin)).map((d) => d.id)).toContain(
      draft.id,
    );
    await expect(drafts.saveRequestDraft(joao, form, null)).rejects.toThrow();
    await drafts.deleteRequestDraft(admin, draft.id);
    expect(await drafts.getRequestDraft(admin, draft.id)).toBeNull();
  });
});
