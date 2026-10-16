import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Solicitação de pedido cancelado: continua ORDERED (CANCELLED na solicitação
 * quer dizer "excluída") e fica na lista como histórico, mas a lista e o
 * detalhe mostram "Pedido cancelado" (selo vermelho), não "Pedido criado".
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const c = await import("@/lib/services/order-cancel");
const os = await import("@/lib/services/order-status");
const { canViewOrder } = await import("@/lib/auth/permissions");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

async function newOrder() {
  const store = getStore();
  const request = await r.createRequest(joao, {
    customerId: "cliente-joao",
    productId: "prod-jarra",
    productName: "Jarra",
    description: "Teste solicitação de pedido cancelado",
    specification: null,
    quantity: 100,
    unit: "un",
    deadline: null,
    notes: null,
  });
  await r.openRfq(admin, request.id, ["fornecedor-a"]);
  const [quote] = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  await r.answerQuote(supplierA, quote.id, {
    price: 2,
    currency: "USD",
    leadTimeDays: 10,
    conditions: null,
  });
  await r.selectQuote(admin, quote.id, {
    sellPrice: 1000,
    sellCurrency: "BRL",
    downPaymentAmount: 300,
  });
  const order = await r.confirmDownPayment(admin, request.id);
  return { order, request: (await store.get("requests", request.id))! };
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("solicitação de pedido cancelado", () => {
  it("segue ORDERED na lista, mas aparece como pedido cancelado", async () => {
    const store = getStore();
    const active = await newOrder();
    const cancelled = await newOrder();
    await c.cancelOrder(admin, cancelled.order.id, {
      reason: "customer_withdrew",
      note: "Cliente desistiu",
      settlement: null,
    });

    // A solicitação não vira "excluída": continua na lista principal.
    const request = (await store.get("requests", cancelled.request.id))!;
    expect(request.status).toBe("ORDERED");
    expect(request.orderId).toBe(cancelled.order.id);

    const ids = await os.cancelledOrderIds([
      active.request.orderId,
      request.orderId,
      null,
      undefined,
    ]);
    expect([...ids]).toEqual([cancelled.order.id]);
    expect(os.requestDisplayStatus(request, ids)).toBe("ORDER_CANCELLED");
    expect(os.requestStatusTone("ORDER_CANCELLED")).toBe("danger");
    expect(os.requestDisplayStatus(active.request, ids)).toBe("ORDERED");
    expect(os.requestStatusTone("ORDERED")).toBe("success");

    // Não dá para excluir pela lista (a caixa fica desativada com o selo).
    expect(r.canDeleteRequest(joao, request)).toBe(false);
    // O cliente que pediu vê o aviso com o link do pedido cancelado.
    const order = (await store.get("orders", cancelled.order.id))!;
    expect(canViewOrder(joao, order)).toBe(true);
  });

  it("vale para pedidos cancelados antes da regra nova", async () => {
    const store = getStore();
    const { order, request } = await newOrder();
    // Cancelado direto no banco, como os antigos (sem fechar o resto).
    await store.update("orders", order.id, { status: "CANCELLED" });
    const ids = await os.cancelledOrderIds([request.orderId]);
    expect(os.requestDisplayStatus(request, ids)).toBe("ORDER_CANCELLED");
  });

  it("sem pedido não consulta e não muda a situação", async () => {
    expect((await os.cancelledOrderIds([])).size).toBe(0);
    expect((await os.cancelledOrderIds([null, undefined])).size).toBe(0);
    const ids = new Set(["qualquer"]);
    expect(
      os.requestDisplayStatus(
        { status: "WAITING_DOWN_PAYMENT", orderId: null },
        ids,
      ),
    ).toBe("WAITING_DOWN_PAYMENT");
  });
});
