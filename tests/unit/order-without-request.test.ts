import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Pedido sem solicitação de cliente (D1 de docs/SANKHYA_INTEGRACAO.md, seção
 * 4.4): o pedido de compra de reposição que vem do Sankhya entra com
 * `requestId` vazio. As leituras da solicitação devolvem nulo e o financeiro
 * não puxa pagamentos de outros pedidos.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { orderRequest, orderRequestIds } =
  await import("@/lib/services/order-request");
const { financialSummary } = await import("@/lib/services/receiving");
const { loadOrderFinance } = await import("@/lib/services/finance");
type Order = import("@/lib/db").Order;

let order: Order;
let requestId: string;

beforeAll(async () => {
  await seedDemo();
  const store = getStore();
  const { ORDER_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
  requestId = (await store.create("requests", { quantity: 1 } as never)).id;
  order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: 990001,
    requestId: null,
    customerId: "wellmix",
    supplierId: "fornecedor-a",
    lineId: null,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal: null,
    fobCurrency: "USD",
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
    sankhyaCode: "1153105",
    sankhyaSituation: "in_progress",
    shipmentState: "partial",
    sankhyaChain: [
      { nunota: 1100001, top: 1100 },
      { nunota: 1153105, top: 1104, pending: true },
    ],
  });
  // Pagamento solto (sem pedido nem solicitação): não pode cair neste pedido.
  await store.create("payments", {
    orderId: null,
    requestId: null,
    direction: "customer_in",
    amount: 123,
    currency: "BRL",
    status: "confirmed",
  } as never);
});

describe("pedido sem solicitação (Sankhya, D1)", () => {
  it("grava e lê o pedido com requestId vazio e os campos do Sankhya", async () => {
    const back = await getStore().get("orders", order.id);
    expect(back?.requestId).toBeNull();
    expect(back?.sankhyaChain?.map((d) => d.top)).toEqual([1100, 1104]);
    expect(back?.shipmentState).toBe("partial");
  });

  it("a solicitação do pedido é nula sem ir ao banco", async () => {
    expect(await orderRequest(order)).toBeNull();
    expect((await orderRequest({ requestId }))?.id).toBe(requestId);
    expect(
      orderRequestIds([order, { requestId }, { requestId }, { requestId: "" }]),
    ).toEqual([requestId]);
  });

  it("o financeiro não puxa pagamentos de outros pedidos", async () => {
    const summary = await financialSummary(order);
    expect(JSON.stringify(summary)).not.toContain("123");
    await expect(
      loadOrderFinance(order, { estimate: false }),
    ).resolves.toBeTruthy();
  });
});
