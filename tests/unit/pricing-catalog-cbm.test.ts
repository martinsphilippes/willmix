import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Valor ao cliente sem a ficha do fornecedor: o volume do frete por CBM vem do
 * cadastro do produto (peças por caixa master e CBM da caixa), para o frete da
 * tabela sair sem digitar nada; sem volume em lugar nenhum, falta "cbm".
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const { quotePricing } = await import("@/lib/services/quote-pricing");
const { setSetting } = await import("@/lib/settings");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  await setSetting("freightPerCbm", 100);
  await setSetting("freightCurrency", "USD");
});

const fx = {
  rates: { USD: 5, CNY: 0.7, EUR: 6, BRL: 1 },
  status: "fresh" as const,
  day: "2026-10-24",
};

async function answeredQuote(productId: string) {
  const store = getStore();
  const product = (await store.get("products", productId))!;
  const request = await r.createRequest(joao, {
    customerId: joao.partyId!,
    productId,
    productName: product.name,
    description: "teste",
    quantity: Math.max(product.moq ?? 0, 600),
    unit: "un",
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 14,
  });
  return {
    request: (await store.get("requests", request.id))!,
    quote: (await store.get("quotes", quote.id))!,
  };
}

describe("frete por CBM sem a ficha do fornecedor", () => {
  it("usa o volume do cadastro do produto e avisa a origem", async () => {
    const store = getStore();
    const [product] = await store.list("products", {
      filter: { active: true },
      limit: 1,
    });
    await store.update("products", product.id, {
      masterBoxQty: 12,
      cbm: 0.0183,
    });
    const { request, quote } = await answeredQuote(product.id);
    const { quotes } = await quotePricing(request, [quote], {
      fx: fx as never,
    });
    const [p] = quotes;
    expect(p.hasSheet).toBe(false);
    expect(p.cbm).toEqual({
      source: "product",
      perCarton: 12,
      cbmPerCarton: 0.0183,
    });
    expect(p.input.totalCbm).toBeGreaterThan(0);
    expect(p.result.missing).not.toContain("cbm");
    expect(p.result.freightSource).toBe("cbm");
    expect(p.result.freightBrl).toBeGreaterThan(0);
  });

  it("sem volume na ficha nem no cadastro: falta o volume", async () => {
    const store = getStore();
    const [product] = await store.list("products", {
      filter: { active: true },
      limit: 1,
    });
    await store.update("products", product.id, {
      masterBoxQty: null,
      cbm: null,
      boxLengthCm: null,
      boxWidthCm: null,
      boxHeightCm: null,
    });
    const { request, quote } = await answeredQuote(product.id);
    const { quotes } = await quotePricing(request, [quote], {
      fx: fx as never,
    });
    expect(quotes[0].cbm.source).toBeNull();
    expect(quotes[0].result.missing).toContain("cbm");
  });
});
