import "server-only";

import { getStore, type Order, type Request, type User } from "@/lib/db";
import {
  ForbiddenError,
  assertWillmix,
  canViewRequest,
  isWillmix,
} from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { getSankhyaAdapter } from "@/lib/integrations/sankhya";
import { audit } from "./audit";
import { notify, notifyWillmix } from "./notifications";
import { createStagesForOrder } from "@/lib/workflow/engine";

export class RequestError extends Error {}

export interface CreateRequestInput {
  customerId: string;
  productId?: string | null;
  productName: string;
  description: string;
  specification?: string | null;
  quantity: number;
  unit: string;
  deadline?: string | null;
  notes?: string | null;
}

/** Cliente cria para si; Willmix cria em nome de qualquer cliente. Mesmo formulário e fluxo. */
export async function createRequest(
  user: User,
  input: CreateRequestInput,
): Promise<Request> {
  const store = getStore();
  const settings = await getSettings();
  if (user.role === "customer") {
    if (!settings.customerCanCreateRequest) throw new ForbiddenError();
    if (input.customerId !== user.partyId) throw new ForbiddenError();
  } else if (!isWillmix(user)) {
    throw new ForbiddenError();
  }
  const request = await store.create("requests", {
    customerId: input.customerId,
    createdByUserId: user.id,
    productId: input.productId ?? null,
    productName: input.productName,
    description: input.description,
    specification: input.specification ?? null,
    quantity: input.quantity,
    unit: input.unit,
    deadline: input.deadline ?? null,
    status: "REQUESTED",
    selectedQuoteId: null,
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: input.notes ?? null,
  });
  await audit(
    user,
    "request.create",
    "request",
    request.id,
    `Solicitação: ${request.productName}`,
  );
  await notifyWillmix({
    subject: `Nova solicitação: ${request.productName}`,
    body: `${request.quantity} ${request.unit}. Abra a RFQ para os fornecedores.`,
    link: `/app/requests/${request.id}`,
  });
  return request;
}

/** Willmix seleciona fornecedores e abre a RFQ. Fornecedores recebem o link. */
export async function openRfq(
  user: User,
  requestId: string,
  supplierIds: string[],
) {
  assertWillmix(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new RequestError("not_found");
  if (
    !["REQUESTED", "RFQ_OPEN", "QUOTATION_RECEIVED"].includes(request.status)
  ) {
    throw new RequestError("invalid_status");
  }
  if (supplierIds.length === 0) throw new RequestError("no_suppliers");
  const settings = await getSettings();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + settings.quotationExpirationDays);

  const existing = await store.list("quotes", { filter: { requestId } });
  for (const supplierId of supplierIds) {
    if (existing.some((q) => q.supplierId === supplierId)) continue;
    const quote = await store.create("quotes", {
      requestId,
      supplierId,
      status: "invited",
      price: null,
      currency: null,
      leadTimeDays: null,
      conditions: null,
      validUntil: validUntil.toISOString(),
      answeredAt: null,
    });
    await notify(
      { role: "supplier", partyId: supplierId },
      {
        subject: `RFQ: ${request.productName}`,
        body: `Quantidade ${request.quantity} ${request.unit}. Responda com preço, prazo e condições.`,
        link: `/app/quotes/${quote.id}`,
      },
    );
  }
  if (request.status === "REQUESTED") {
    await store.update("requests", requestId, { status: "RFQ_OPEN" });
  }
  await audit(
    user,
    "rfq.open",
    "request",
    requestId,
    `RFQ para ${supplierIds.length} fornecedor(es)`,
  );
}

export interface AnswerQuoteInput {
  price: number;
  currency: string;
  leadTimeDays: number;
  conditions?: string | null;
}

export async function answerQuote(
  user: User,
  quoteId: string,
  input: AnswerQuoteInput,
) {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) throw new RequestError("not_found");
  if (!(
    isWillmix(user) ||
    (user.role === "supplier" && quote.supplierId === user.partyId)
  )) {
    throw new ForbiddenError();
  }
  if (quote.status === "selected" || quote.status === "rejected")
    throw new RequestError("closed");
  await store.update("quotes", quoteId, {
    ...input,
    conditions: input.conditions ?? null,
    status: "answered",
    answeredAt: new Date().toISOString(),
  });
  const request = await store.get("requests", quote.requestId);
  if (request && request.status === "RFQ_OPEN") {
    await store.update("requests", request.id, {
      status: "QUOTATION_RECEIVED",
    });
  }
  await audit(
    user,
    "quote.answer",
    "quote",
    quoteId,
    `${input.currency} ${input.price}, ${input.leadTimeDays} dias`,
  );
  if (request) {
    await notifyWillmix({
      subject: `Cotação recebida: ${request.productName}`,
      body: `${input.currency} ${input.price.toFixed(2)}, prazo ${input.leadTimeDays} dias.`,
      link: `/app/requests/${request.id}`,
    });
  }
}

export interface SelectQuoteInput {
  sellPrice: number;
  sellCurrency: string;
  downPaymentAmount?: number | null;
}

/** Willmix escolhe o fornecedor, define o valor ao cliente e o sinal. */
export async function selectQuote(
  user: User,
  quoteId: string,
  input: SelectQuoteInput,
) {
  assertWillmix(user);
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote || quote.status !== "answered")
    throw new RequestError("invalid_quote");
  const request = await store.get("requests", quote.requestId);
  if (!request) throw new RequestError("not_found");
  const settings = await getSettings();
  const downPayment =
    input.downPaymentAmount ??
    Math.round(input.sellPrice * (settings.downPaymentPercent / 100) * 100) /
      100;

  const others = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  for (const other of others) {
    await store.update("quotes", other.id, {
      status: other.id === quote.id ? "selected" : "rejected",
    });
  }
  await store.update("requests", request.id, {
    status: "WAITING_DOWN_PAYMENT",
    selectedQuoteId: quote.id,
    sellPrice: input.sellPrice,
    sellCurrency: input.sellCurrency,
    downPaymentAmount: downPayment,
  });
  await store.create("payments", {
    orderId: null,
    requestId: request.id,
    direction: "customer_in",
    amount: downPayment,
    currency: input.sellCurrency,
    fxRate: null,
    method: settings.paymentMode,
    status: "pending",
    proofDocumentId: null,
    registeredByUserId: user.id,
    confirmedByUserId: null,
    confirmedAt: null,
    note: "Sinal",
  });
  await audit(
    user,
    "quote.select",
    "request",
    request.id,
    `Fornecedor selecionado; sinal ${input.sellCurrency} ${downPayment}`,
  );
  await notify(
    { role: "customer", partyId: request.customerId },
    {
      subject: `Proposta disponível: ${request.productName}`,
      body: `Valor ${input.sellCurrency} ${input.sellPrice.toFixed(2)}. Sinal de ${input.sellCurrency} ${downPayment.toFixed(2)} para iniciar o pedido.`,
      link: `/app/requests/${request.id}`,
    },
  );
  await notify(
    { role: "supplier", partyId: quote.supplierId },
    {
      subject: `Cotação selecionada: ${request.productName}`,
      body: "Sua cotação foi escolhida. O pedido será criado após a confirmação do sinal.",
      link: `/app/quotes/${quote.id}`,
    },
  );
}

/** MANUAL MODE: operador confirma o sinal (com comprovante opcional). Cria o pedido. */
export async function confirmDownPayment(
  user: User,
  requestId: string,
  proofDocumentId?: string | null,
) {
  assertWillmix(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (
    !request ||
    request.status !== "WAITING_DOWN_PAYMENT" ||
    !request.selectedQuoteId
  ) {
    throw new RequestError("invalid_status");
  }
  const [payment] = await store.list("payments", {
    filter: { requestId, direction: "customer_in", status: "pending" },
  });
  const now = new Date().toISOString();
  if (payment) {
    await store.update("payments", payment.id, {
      status: "confirmed",
      confirmedByUserId: user.id,
      confirmedAt: now,
      proofDocumentId: proofDocumentId ?? payment.proofDocumentId,
    });
  }
  await audit(
    user,
    "payment.confirm",
    "request",
    requestId,
    "Sinal confirmado (manual)",
  );
  return createOrderFromRequest(user, request);
}

async function createOrderFromRequest(
  user: User,
  request: Request,
): Promise<Order> {
  const store = getStore();
  const quote = await store.get("quotes", request.selectedQuoteId!);
  if (!quote) throw new RequestError("invalid_quote");
  const product = request.productId
    ? await store.get("products", request.productId)
    : null;
  const number = await store.nextNumber("order_number");
  const fobTotal = quote.price !== null ? quote.price * request.quantity : null;

  const order = await store.create("orders", {
    number,
    requestId: request.id,
    customerId: request.customerId,
    supplierId: quote.supplierId,
    lineId: product?.lineId ?? null,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal,
    fobCurrency: quote.currency,
    sellPrice: request.sellPrice,
    sellCurrency: request.sellCurrency,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
  });
  const item = await store.create("order_items", {
    orderId: order.id,
    productId: request.productId,
    name: request.productName,
    quantity: request.quantity,
    unit: request.unit,
    unitPrice: quote.price,
  });
  await assignDefaultPartners(order);
  await createStagesForOrder(
    await store.get("orders", order.id).then((o) => o ?? order),
  );

  const [payment] = await store.list("payments", {
    filter: { requestId: request.id, direction: "customer_in" },
  });
  if (payment)
    await store.update("payments", payment.id, { orderId: order.id });

  const sync = await getSankhyaAdapter().createOrder(order, [item]);
  await store.update("orders", order.id, {
    erpSyncStatus: sync.status === "synced" ? "synced" : "pending",
    erpNumber: sync.status === "synced" ? sync.erpNumber : null,
  });
  await store.update("requests", request.id, {
    status: "ORDERED",
    orderId: order.id,
  });
  await audit(
    user,
    "order.create",
    "order",
    order.id,
    `Pedido #${number} criado a partir da solicitação`,
  );
  await notify(
    { role: "customer", partyId: request.customerId },
    {
      subject: `Pedido #${number} criado`,
      body: "Acompanhe a timeline do seu pedido.",
      link: `/app/orders/${order.id}`,
    },
  );
  await notify(
    { role: "supplier", partyId: quote.supplierId },
    {
      subject: `Order #${number} created`,
      body: "Complete the preparation checklist.",
      link: `/app/orders/${order.id}`,
    },
  );
  return (await store.get("orders", order.id)) ?? order;
}

/**
 * Parceiros padrão: quando existe exatamente um parceiro ativo de cada tipo,
 * ele é designado automaticamente. Caso contrário o operador designa no pedido.
 */
async function assignDefaultPartners(order: Order) {
  const store = getStore();
  const patch: Partial<Order> = {};
  for (const [type, field] of [
    ["agency", "agencyId"],
    ["broker", "brokerId"],
    ["shipping_line", "shippingLineId"],
    ["carrier", "carrierId"],
  ] as const) {
    const parties = await store.list("parties", {
      filter: { type, active: true },
    });
    if (parties.length === 1) patch[field] = parties[0].id;
  }
  if (Object.keys(patch).length) await store.update("orders", order.id, patch);
}

export async function getRequestForUser(user: User, requestId: string) {
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request || !canViewRequest(user, request)) return null;
  return request;
}
