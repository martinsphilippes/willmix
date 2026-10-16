import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Página do pedido: em "Comprar de novo / nova proposta", a solicitação
 * derivada cujo pedido foi cancelado aparece como "Pedido cancelado" (selo
 * vermelho), sem mudar o status dela; as outras continuam como estão. E o
 * pedido cancelado sem número no ERP fica com a sincronização "pendente" (a
 * página esconde o aviso de lançar no ERP nesse caso).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const c = await import("@/lib/services/order-cancel");
const os = await import("@/lib/services/order-status");
type User = import("@/lib/db").User;
type Order = import("@/lib/db").Order;
type Request = import("@/lib/db").Request;

let admin: User;
let joao: User;
let supplierA: User;

/** Leva a solicitação até virar pedido (sinal confirmado). */
async function toOrder(request: Request): Promise<Order> {
  const store = getStore();
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
  return r.confirmDownPayment(admin, request.id);
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
});

describe("página do pedido com pedido cancelado", () => {
  it("solicitação derivada com pedido cancelado aparece como Pedido cancelado", async () => {
    const store = getStore();
    const source = await toOrder(
      await r.createRequest(joao, {
        customerId: "cliente-joao",
        productId: "prod-jarra",
        productName: "Jarra",
        description: "Pedido de origem",
        specification: null,
        quantity: 100,
        unit: "un",
        deadline: null,
        notes: null,
      }),
    );
    const repurchase = await r.createFollowUpRequest(joao, source.id, {
      quantity: 50,
      origin: "replenishment",
    });
    const proposal = await r.createFollowUpRequest(joao, source.id, {
      quantity: 80,
      origin: "proposal",
    });
    const repurchaseOrder = await toOrder(repurchase);
    await c.cancelOrder(admin, repurchaseOrder.id, {
      reason: "other",
      note: null,
      settlement: null,
    });

    // Mesma leitura da página: derivadas do pedido de origem.
    const derived = await store.list("requests", {
      filter: { sourceOrderId: source.id },
    });
    expect(derived.map((d) => d.id).sort()).toEqual(
      [repurchase.id, proposal.id].sort(),
    );
    const cancelled = await os.cancelledOrderIds(derived.map((d) => d.orderId));
    expect([...cancelled]).toEqual([repurchaseOrder.id]);

    const shown = derived.find((d) => d.id === repurchase.id)!;
    expect(shown.status).toBe("ORDERED"); // a solicitação não vira "excluída"
    const status = os.requestDisplayStatus(shown, cancelled);
    expect(status).toBe("ORDER_CANCELLED");
    expect(os.requestStatusTone(status)).toBe("danger");

    // A nova proposta (sem pedido) segue com a situação dela.
    const open = derived.find((d) => d.id === proposal.id)!;
    expect(os.requestDisplayStatus(open, cancelled)).toBe(open.status);
    expect(os.requestStatusTone(open.status)).not.toBe("danger");

    // Cancelado sem número no ERP: a sincronização continua "pendente".
    const after = (await store.get("orders", repurchaseOrder.id))!;
    expect(after.status).toBe("CANCELLED");
    expect(after.erpNumber).toBe(null);
    expect(after.erpSyncStatus).toBe("pending");
  });
});
