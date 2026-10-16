import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Cotação enviada: confirmação nas Pendências só para quem enviou, e a próxima a responder. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const { pendingTasksFor } = await import("@/lib/services/tasks");
type User = import("@/lib/db").User;

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

async function rfq(productName: string) {
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: null,
    productName,
    description: productName,
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a", "fornecedor-b"]);
  const [quote] = await getStore().list("quotes", {
    filter: { requestId: request.id, supplierId: "fornecedor-a" },
  });
  return { request, quote };
}

describe("cotação enviada", () => {
  it("resumo só da própria cotação respondida; a próxima fica nas Pendências", async () => {
    const first = await rfq("Jarra enviada");
    const second = await rfq("Copo pendente");

    // Ainda não respondida: não há o que confirmar.
    expect(await qs.sentQuoteView(supplierA, first.quote.id)).toBeNull();

    await r.answerQuote(supplierA, first.quote.id, {
      price: 2.35,
      currency: "USD",
      leadTimeDays: 30,
      conditions: null,
    });
    const view = await qs.sentQuoteView(supplierA, first.quote.id);
    expect(view).toMatchObject({
      quoteId: first.quote.id,
      productName: "Jarra enviada",
      price: 2.35,
      currency: "USD",
      leadTimeDays: 30,
    });

    // Outro fornecedor e o cliente não veem a cotação pelo link.
    expect(await qs.sentQuoteView(supplierB, first.quote.id)).toBeNull();
    expect(await qs.sentQuoteView(joao, first.quote.id)).toBeNull();
    expect(await qs.sentQuoteView(supplierA, "nao-existe")).toBeNull();

    // A enviada sai das Pendências; a outra continua para responder.
    const links = (await pendingTasksFor(supplierA))
      .filter((t) => t.kind === "quote")
      .map((t) => t.link);
    expect(links).toContain(`/app/quotes/${second.quote.id}`);
    expect(links).not.toContain(`/app/quotes/${first.quote.id}`);
  });
});
