import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Sinal da proposta em % do valor ao cliente (0 a 100), conta no servidor. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

async function answered() {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName: "Jarra sinal",
    description: "Jarra",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 30,
    conditions: null,
  });
  return { request, quote };
}

describe("sinal em porcentagem", () => {
  it("o sinal é a % do valor ao cliente, não um valor digitado", async () => {
    const { request, quote } = await answered();
    await r.selectQuote(admin, quote.id, {
      sellPrice: 28000,
      sellCurrency: "BRL",
      downPaymentPercent: 40,
    });
    const updated = await getStore().get("requests", request.id);
    expect(updated?.downPaymentAmount).toBe(11200);
    const [payment] = await getStore().list("payments", {
      filter: { requestId: request.id, direction: "customer_in" },
    });
    expect(payment.amount).toBe(11200);
  });

  it("sem % vale a das configurações; fora de 0 a 100 é recusado", async () => {
    const first = await answered();
    await r.selectQuote(admin, first.quote.id, {
      sellPrice: 10000,
      sellCurrency: "BRL",
    });
    expect(
      (await getStore().get("requests", first.request.id))?.downPaymentAmount,
    ).toBe(3000);
    const second = await answered();
    await expect(
      r.selectQuote(admin, second.quote.id, {
        sellPrice: 10000,
        sellCurrency: "BRL",
        downPaymentPercent: 150,
      }),
    ).rejects.toThrow("invalid_down_payment");
  });
});
