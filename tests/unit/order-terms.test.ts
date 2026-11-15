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
  executeQuery: async () => {
    if (!sankhya.rows) throw new Error("Sankhya fora do ar");
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
  it("país pelo fornecedor; grupo pela linha; a busca só oferece os deles", async () => {
    origin.resetOriginIndex();
    const countries = await origin.originCountries();
    expect(countries.find((c) => c.key === "CHINA")?.products).toBeGreaterThan(
      0,
    );
    const groups = await origin.originGroups("CHINA");
    expect(groups.map((g) => g.id)).toContain("linha-brinquedos");
    expect(
      (await searchProducts({ q: "boneca", scope: "catalog" })).map(
        (p) => p.id,
      ),
    ).toContain("prod-boneca");
    expect(
      (
        await searchProducts({
          q: "boneca",
          scope: "catalog",
          origin: { country: "CHINA", lineId: "linha-utilidades" },
        })
      ).map((p) => p.id),
    ).not.toContain("prod-boneca");
    expect(
      (
        await searchProducts({
          q: "boneca",
          scope: "catalog",
          origin: { country: "CHINA", lineId: "linha-brinquedos" },
        })
      ).map((p) => p.id),
    ).toContain("prod-boneca");
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

  it("confere as condições e recusa produto de outro grupo", async () => {
    const resolved = await orderTerms.resolveOrderTerms({
      operationType: "ts",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      carrier: "portal:transportador",
      redispatch: "sankhya:812",
      originSet: "1",
      originCountry: "CHINA",
      productLineId: "linha-brinquedos",
      noReturnsAccepted: "1",
    });
    expect(resolved).toMatchObject({
      operationType: "ts",
      saleFormat: "wellmix",
      wellmixTier: "mega",
      carrier: { source: "portal", name: "Trans Rodo" },
      redispatch: { source: "sankhya", code: "812", name: "RODONAVES" },
      originCountryName: "CHINA",
      productLineId: "linha-brinquedos",
      noReturnsAccepted: true,
    });
    await expect(
      orderTerms.assertProductsMatchOrigin(["prod-boneca", null], resolved),
    ).resolves.toBeUndefined();
    await expect(
      orderTerms.assertProductsMatchOrigin(["prod-panela"], resolved),
    ).rejects.toThrow("order_terms_mismatch");
    await expect(
      orderTerms.resolveOrderTerms({
        operationType: "sale",
        saleFormat: "wellmix",
        wellmixTier: "",
        carrier: "portal:transportador",
        redispatch: "",
        originSet: "1",
        originCountry: "CHINA",
        productLineId: "linha-brinquedos",
        noReturnsAccepted: "1",
      }),
    ).rejects.toThrow("order_terms_tier");
    await expect(
      orderTerms.resolveOrderTerms({
        operationType: "",
        saleFormat: "wd",
        wellmixTier: "",
        carrier: "",
        redispatch: "",
        originSet: "1",
        originCountry: "CHINA",
        productLineId: "linha-brinquedos",
        noReturnsAccepted: "1",
      }),
    ).rejects.toThrow("order_terms_operation");
  });

  it('transportador e "Li e concordo" obrigatórios; sem país não vende', async () => {
    const base = {
      operationType: "sale",
      saleFormat: "wd",
      wellmixTier: "",
      carrier: "portal:transportador",
      redispatch: "",
      originSet: "1",
      originCountry: "CHINA",
      productLineId: "linha-brinquedos",
      noReturnsAccepted: "1",
    };
    await expect(
      orderTerms.resolveOrderTerms({ ...base, carrier: "" }),
    ).rejects.toThrow("order_terms_carrier_required");
    await expect(
      orderTerms.resolveOrderTerms({ ...base, noReturnsAccepted: "" }),
    ).rejects.toThrow("order_terms_accept");
    await expect(
      orderTerms.resolveOrderTerms({ ...base, originCountry: "" }),
    ).rejects.toThrow("order_terms_origin");
    expect((await origin.originCountries()).every((c) => c.key !== "")).toBe(
      true,
    );
    expect(await origin.originGroups("")).toEqual([]);
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
    expect(body.groups.map((g) => g.id)).toContain("linha-brinquedos");
    current = null;
  });
});
