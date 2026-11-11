/*
 * Pedido de teste sem cotação (a RFQ e a cotação saíram em 11/11/2026).
 *
 * Faz o que a criação do pedido fazia a partir da solicitação, sem a cotação:
 * pedido no fluxo clássico (o dos pedidos do Sankhya), item com o preço do
 * fornecedor, condição de pagamento, parceiros padrão e etapas. O sinal do
 * cliente, quando pedido, entra como pagamento confirmado.
 *
 * Importe depois de `withTempStore()` (o store em memória já precisa existir).
 */
import type { Order, Request, User } from "@/lib/db";

export interface TestOrderInput {
  supplierId?: string;
  /** Preço por peça do fornecedor (vira o FOB do pedido). */
  price?: number | null;
  currency?: string;
  sellPrice?: number | null;
  sellCurrency?: string | null;
  /** Sinal do cliente já confirmado (pagamento "customer_in"). */
  downPaymentAmount?: number | null;
}

/** Fecha a solicitação num pedido, como a confirmação do sinal fazia. */
export async function orderFromRequest(
  user: User,
  request: Request,
  input: TestOrderInput = {},
): Promise<Order> {
  const { getStore } = await import("@/lib/db");
  const { ORDER_EXTRA_DEFAULTS } = await import("@/lib/db/schema");
  const store = getStore();
  const supplierId = input.supplierId ?? "fornecedor-a";
  const price = input.price === undefined ? 2 : input.price;
  const currency = input.currency ?? "USD";
  const sellPrice = input.sellPrice === undefined ? 1000 : input.sellPrice;
  const sellCurrency =
    input.sellCurrency === undefined ? "BRL" : input.sellCurrency;
  const product = request.productId
    ? await store.get("products", request.productId)
    : null;
  const fresh = (await store.get("requests", request.id)) ?? request;
  const order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    requestedByUserId: fresh.requestedForUserId,
    ...(fresh.ownerUserId ? { ownerUserId: fresh.ownerUserId } : {}),
    number: await store.nextNumber("order_number"),
    requestId: fresh.id,
    customerId: fresh.customerId,
    supplierId,
    lineId: product?.lineId ?? null,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal: price !== null ? price * fresh.quantity : null,
    fobCurrency: currency,
    sellPrice,
    sellCurrency,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
  });
  await store.create("order_items", {
    orderId: order.id,
    productId: fresh.productId,
    name: fresh.productName,
    quantity: fresh.quantity,
    unit: fresh.unit,
    unitPrice: price,
    ...(fresh.variantId
      ? {
          variantId: fresh.variantId,
          ...(fresh.variant ? { variant: fresh.variant } : {}),
        }
      : {}),
  });
  if (input.downPaymentAmount && sellCurrency)
    await store.create("payments", {
      orderId: order.id,
      requestId: fresh.id,
      direction: "customer_in",
      amount: input.downPaymentAmount,
      currency: sellCurrency,
      fxRate: null,
      method: null,
      status: "confirmed",
      proofDocumentId: null,
      registeredByUserId: user.id,
      confirmedByUserId: user.id,
      confirmedAt: new Date().toISOString(),
      note: "Sinal",
      kitId: null,
      sankhyaCode: null,
      sankhyaRefs: null,
    });
  await store.update("requests", fresh.id, {
    status: "ORDERED",
    orderId: order.id,
    sellPrice,
    sellCurrency,
    downPaymentAmount: input.downPaymentAmount ?? null,
  });
  const { snapshotOrderPaymentTerms } =
    await import("@/lib/services/supplier-terms");
  await snapshotOrderPaymentTerms(order);
  const { assignDefaultPartners } = await import("@/lib/services/requests");
  await assignDefaultPartners(order);
  const { createStagesForOrder } = await import("@/lib/workflow/engine");
  await createStagesForOrder((await store.get("orders", order.id)) ?? order);
  return (await store.get("orders", order.id)) ?? order;
}
