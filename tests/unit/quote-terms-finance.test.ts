import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Prazo e condições do rascunho da cotação ficam guardados (antes se perdiam
 * ao salvar e o envio voltava sem prazo); valor a receber em centavos (duas
 * parcelas não deixam 0,00000000000005 em aberto).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const { computeOrderFinance } = await import("@/lib/services/finance");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Payment = import("@/lib/db").Payment;

let admin: User;
let joao: User;
let supplierA: User;
let supplierB: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  supplierB = users.find((u) => u.email === "supplier.b@china.com")!;
});

describe("prazo e condições no rascunho da cotação", () => {
  it("guarda na cotação não enviada; outro fornecedor não mexe; respondida só muda ao enviar", async () => {
    const store = getStore();
    const request = await r.createRequest(joao, {
      customerId: "cliente-joao",
      productName: "Copo",
      description: "Copo de vidro",
      quantity: 500,
      unit: "un",
    });
    await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
    const quotes = await store.list("quotes", {
      filter: { requestId: request.id },
    });
    const qa = quotes.find((q) => q.supplierId === "fornecedor-a")!;
    await qs.saveQuoteTermsDraft(supplierA, qa.id, {
      leadTimeDays: 33,
      conditions: "30% sinal",
    });
    expect(await store.get("quotes", qa.id)).toMatchObject({
      status: "invited",
      leadTimeDays: 33,
      conditions: "30% sinal",
    });
    // Isolamento entre fornecedores.
    await expect(
      qs.saveQuoteTermsDraft(supplierB, qa.id, {
        leadTimeDays: 1,
        conditions: null,
      }),
    ).rejects.toThrow();
    // Respondida: o rascunho não muda os termos enviados.
    await r.answerQuote(supplierA, qa.id, {
      price: 2,
      currency: "USD",
      leadTimeDays: 40,
    });
    await qs.saveQuoteTermsDraft(supplierA, qa.id, {
      leadTimeDays: 99,
      conditions: "outra",
    });
    expect((await store.get("quotes", qa.id))!.leadTimeDays).toBe(40);
  });
});

describe("valor a receber em centavos", () => {
  it("30% de sinal + saldo pré-preenchido zera o que falta receber", () => {
    const order = {
      status: "PREPARATION",
      sellPrice: 500.56,
      sellCurrency: "BRL",
      fobTotal: 100.1,
      fobCurrency: "USD",
    } as unknown as Order;
    const pay = (amount: number, direction: Payment["direction"]) =>
      ({ amount, direction, status: "confirmed", fxRate: null }) as Payment;
    const down = Math.round(500.56 * 0.3 * 100) / 100; // 150.17
    const first = computeOrderFinance(order, [pay(down, "customer_in")], {
      customer: "",
      supplier: "",
      product: "",
    });
    expect(first.receivable).toBe(350.39);
    const done = computeOrderFinance(
      order,
      [pay(down, "customer_in"), pay(first.receivable, "customer_in")],
      { customer: "", supplier: "", product: "" },
    );
    expect(done.receivable).toBe(0);
    const paid = computeOrderFinance(
      order,
      [pay(30.03, "supplier_out"), pay(70.07, "supplier_out")],
      { customer: "", supplier: "", product: "" },
    );
    expect(paid.payable).toBe(0);
  });
});
