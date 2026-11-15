import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Última compra na Nova solicitação (dono, 15/11/2026, opção C;
 * docs/PURCHASE_HISTORY.md e docs/LINHA_DE_VISAO.md, seção 8): quem tem
 * "Ver preço de compra" vê o preço; quem não tem (Vendas, por padrão) vê a
 * mesma linha sem o preço. Sem pedido, o preço do cadastro só para quem vê.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const requests = await import("@/lib/services/requests");
const { orderFromRequest } = await import("./helpers/order");
const { lastPurchaseTexts } = await import("@/lib/services/last-purchase");
const { requestProductFills } =
  await import("@/lib/services/request-product-fill");
const { translator } = await import("@/i18n");
type User = import("@/lib/db").User;

const t = translator("pt");
let admin: User;
let vendas: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  const by = (email: string) => users.find((u) => u.email === email)!;
  admin = by("admin@wellmix.com");
  vendas = by("vendas@wellmix.com");
  const joao = by("joao@lojista.com");
  const previous = await requests.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-panela",
    productName: "prod-panela",
    description: "Compra anterior",
    quantity: 2000,
    unit: "un",
  });
  await orderFromRequest(admin, previous, {
    supplierId: "fornecedor-a",
    price: 3.5,
    currency: "USD",
  });
});

const product = async (id: string) => (await getStore().get("products", id))!;

describe("última compra na Nova solicitação", () => {
  it("com a permissão: preço, quantidade, pedido e fornecedor", async () => {
    const panela = await product("prod-panela");
    const text = (await lastPurchaseTexts(t, [panela])).get(panela.id)!;
    expect(text).toMatch(/^Última compra: US\$\s?3,5/);
    expect(text).toContain("2.000 un");
    expect(text).toMatch(/pedido \d+/);
  });

  it("sem a permissão (opção C): a mesma linha, sem o preço", async () => {
    const panela = await product("prod-panela");
    const text = (
      await lastPurchaseTexts(t, [panela], { withPrice: false })
    ).get(panela.id)!;
    expect(text).toMatch(/^Última compra: 2\.000 un · pedido \d+ · /);
    expect(text).not.toContain("3,5");
    expect(text).not.toContain("US$");
  });

  it("sem pedido: o preço do cadastro só para quem vê", async () => {
    const piscina = await product("prod-piscina");
    expect((await lastPurchaseTexts(t, [piscina])).get(piscina.id)).toMatch(
      /^Preço da última compra \(cadastro\): US\$\s?14,8/,
    );
    expect(
      (await lastPurchaseTexts(t, [piscina], { withPrice: false })).has(
        piscina.id,
      ),
    ).toBe(false);
  });

  it("a ficha da Nova solicitação segue o login: Vendas sem o preço, administrador com", async () => {
    const panela = await product("prod-panela");
    const [forSales] = await requestProductFills(vendas, t, [panela]);
    const [forAdmin] = await requestProductFills(admin, t, [panela]);
    expect(forSales.lastPurchase).toMatch(/^Última compra: 2\.000 un/);
    expect(forSales.lastPurchase).not.toContain("US$");
    expect(forAdmin.lastPurchase).toContain("US$");
  });
});
