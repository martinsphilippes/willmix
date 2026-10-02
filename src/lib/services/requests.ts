import "server-only";

import { formatNcm } from "@/lib/fiscal";
import {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  PAYMENT_EXTRA_DEFAULTS,
  type Order,
  type Request,
  type RequestOrigin,
  type User,
} from "@/lib/db";
import {
  ForbiddenError,
  assertWellmix,
  canViewRequest,
  isWellmix,
  canViewOrder,
} from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { getSankhyaAdapter } from "@/lib/integrations/sankhya";
import { audit } from "./audit";
import { notify, notifyWellmix, requesterTarget } from "./notifications";
import { createStagesForOrder } from "@/lib/workflow/engine";
import { createPurchaseSnapshot } from "./snapshots";
import { copyQuoteSheetToOrder } from "./quote-sheet";
import { cancelFreightForRequest } from "./freight";
import { quoteSlaDeadline } from "@/lib/sla";
import { openReview } from "./reviews";
import { runComplianceGate } from "./compliance";
import { runOperationGate } from "./operations";

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
  /** Segunda Onda: recompra, nova proposta ou sourcing sob demanda (padrão manual). */
  origin?: RequestOrigin | null;
  sourceOrderId?: string | null;
  /** Wellmix criando em nome do cliente: o login do cliente que solicitou. */
  requestedForUserId?: string | null;
}

/** Login ativo de cliente daquela empresa; senão "invalid_requester". */
async function validRequester(userId: string, customerId: string) {
  const requester = await getStore().get("users", userId);
  if (
    !requester ||
    !requester.active ||
    requester.role !== "customer" ||
    requester.partyId !== customerId
  )
    throw new RequestError("invalid_requester");
  return requester.id;
}

/**
 * Wellmix define ou troca o login solicitante de uma solicitação (e do pedido
 * dela): só esse login do cliente passa a vê-los. Nulo = nenhum login do cliente.
 */
export async function setRequester(
  user: User,
  requestId: string,
  requestedForUserId: string | null,
) {
  if (!isWellmix(user)) throw new ForbiddenError();
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new RequestError("not_found");
  const value = requestedForUserId
    ? await validRequester(requestedForUserId, request.customerId)
    : null;
  await store.update("requests", request.id, { requestedForUserId: value });
  if (request.orderId)
    await store.update("orders", request.orderId, { requestedByUserId: value });
  await audit(
    user,
    "request.requester",
    "request",
    request.id,
    value ? `Solicitante: ${value}` : "Sem solicitante do cliente",
    { requestedForUserId: request.requestedForUserId },
    { requestedForUserId: value },
  );
  return value;
}

/** Cliente cria para si; Wellmix cria em nome de qualquer cliente. Mesmo formulário e fluxo. */
export async function createRequest(
  user: User,
  input: CreateRequestInput,
): Promise<Request> {
  const store = getStore();
  const settings = await getSettings();
  if (user.role === "customer") {
    if (!settings.customerCanCreateRequest) throw new ForbiddenError();
    if (input.customerId !== user.partyId) throw new ForbiddenError();
  } else if (!isWellmix(user)) {
    throw new ForbiddenError();
  }
  // Solicitante: o próprio cliente; ou, pela Wellmix, um login daquele cliente.
  let requestedForUserId: string | null =
    user.role === "customer" ? user.id : null;
  if (user.role !== "customer" && input.requestedForUserId) {
    requestedForUserId = await validRequester(
      input.requestedForUserId,
      input.customerId,
    );
  }
  // Prazo de resposta = SLA da Wellmix (Configurações). O cliente não escolhe;
  // a Wellmix pode ajustar numa solicitação específica.
  const deadline =
    (isWellmix(user) ? input.deadline : null) ||
    quoteSlaDeadline(settings.quoteSlaBusinessDays);
  const request = await store.create("requests", {
    requestedForUserId,
    customerId: input.customerId,
    createdByUserId: user.id,
    productId: input.productId ?? null,
    productName: input.productName,
    description: input.description,
    specification: input.specification ?? null,
    quantity: input.quantity,
    unit: input.unit,
    deadline,
    status: "REQUESTED",
    selectedQuoteId: null,
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    origin: input.origin ?? "manual",
    sourceOrderId: input.sourceOrderId ?? null,
    notes: input.notes ?? null,
  });
  await audit(
    user,
    "request.create",
    "request",
    request.id,
    `Solicitação: ${request.productName}`,
  );
  // Sourcing sob demanda: produto ainda não catalogado vira item de sourcing para o time na China.
  if (request.origin === "sourcing_demand" && !request.productId) {
    const customer = await store.get("parties", request.customerId);
    await store.create("sourcing_items", {
      visitId: null,
      supplierId: null,
      supplierName: null,
      productId: null,
      lineId: null,
      category: null,
      name: request.productName,
      description: [request.description, request.specification]
        .filter(Boolean)
        .join("\n"),
      supplierSku: null,
      material: null,
      color: null,
      pantone: null,
      price: null,
      currency: null,
      moq: null,
      masterBoxQty: null,
      innerBoxQty: null,
      netWeightKg: null,
      grossWeightKg: null,
      widthCm: null,
      heightCm: null,
      lengthCm: null,
      boxLengthCm: null,
      boxWidthCm: null,
      boxHeightCm: null,
      cbm: null,
      conditions: null,
      notes: `Demanda do cliente ${customer?.name ?? request.customerId}: ${request.quantity} ${request.unit}${request.deadline ? ` até ${request.deadline}` : ""}.`,
      foundAt: null,
      city: null,
      location: null,
      status: "draft",
      primaryPhotoDocumentId: null,
      createdByUserId: user.id,
      requestId: request.id,
      priceTiers: null,
    });
    await notifyWellmix({
      subject: `Sourcing sob demanda: ${request.productName}`,
      body: "Cliente pediu um produto fora do catálogo. Localize fornecedores, cadastre opções e abra a RFQ.",
      link: `/app/sourcing?tab=items&status=draft`,
    });
  }
  await notifyWellmix({
    subject: `Nova solicitação: ${request.productName}`,
    body: `${request.quantity} ${request.unit}. Abra a RFQ para os fornecedores.`,
    link: `/app/requests/${request.id}`,
  });
  return request;
}

/** Wellmix seleciona fornecedores e abre a RFQ. Fornecedores recebem o link. */
export async function openRfq(
  user: User,
  requestId: string,
  supplierIds: string[],
) {
  assertWellmix(user);
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
    isWellmix(user) ||
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
    await notifyWellmix({
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
  /** Memória do cálculo do valor ao cliente (fica na auditoria). */
  pricing?: unknown;
}

/** Completa a ficha da cotação com o que a conta usou, sem sobrescrever o que já foi digitado. */
async function stampTaxesOnSheet(quoteId: string, raw: unknown) {
  const pricing = raw as {
    ncm?: string | null;
    input?: { importTaxPercent?: number | null; ipiPercent?: number | null };
  } | null;
  if (!pricing?.input) return;
  const store = getStore();
  const [sheet] = await store.list("purchase_sheets", {
    filter: { orderId: quoteId },
    limit: 1,
  });
  if (!sheet) return;
  const patch: Record<string, unknown> = {};
  if (sheet.importTaxPercent === null && pricing.input.importTaxPercent != null)
    patch.importTaxPercent = pricing.input.importTaxPercent;
  if (sheet.ipiPercent === null && pricing.input.ipiPercent != null)
    patch.ipiPercent = pricing.input.ipiPercent;
  if (!sheet.ncm && pricing.ncm) patch.ncm = formatNcm(pricing.ncm);
  if (Object.keys(patch).length)
    await store.update("purchase_sheets", sheet.id, patch);
}

/** Wellmix escolhe o fornecedor, define o valor ao cliente e o sinal. */
export async function selectQuote(
  user: User,
  quoteId: string,
  input: SelectQuoteInput,
) {
  assertWellmix(user);
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
  // Frete das cotações não escolhidas deixa de valer.
  await cancelFreightForRequest(request.id, quote.id);
  // NCM, II e IPI usados na proposta vão para a ficha escolhida (e dela para o pedido).
  await stampTaxesOnSheet(quote.id, input.pricing ?? null);
  await store.update("requests", request.id, {
    status: "WAITING_DOWN_PAYMENT",
    selectedQuoteId: quote.id,
    sellPrice: input.sellPrice,
    sellCurrency: input.sellCurrency,
    downPaymentAmount: downPayment,
  });
  await store.create("payments", {
    ...PAYMENT_EXTRA_DEFAULTS,
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
    null,
    {
      sellPrice: input.sellPrice,
      sellCurrency: input.sellCurrency,
      downPaymentAmount: downPayment,
      pricing: input.pricing ?? null,
    },
  );
  await notify(requesterTarget(request.requestedForUserId), {
    subject: `Proposta disponível: ${request.productName}`,
    body: `Valor ${input.sellCurrency} ${input.sellPrice.toFixed(2)}. Sinal de ${input.sellCurrency} ${downPayment.toFixed(2)} para iniciar o pedido.`,
    link: `/app/requests/${request.id}`,
  });
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
  assertWellmix(user);
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
    ...ORDER_EXTRA_DEFAULTS,
    // Só o login solicitante do cliente vê o pedido.
    requestedByUserId: request.requestedForUserId,
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
  // Snapshot da negociação: o que foi comprado fica congelado neste pedido.
  await createPurchaseSnapshot(user, order, item, quote, product);
  // A ficha preenchida na cotação vira a ficha do pedido (Preparação já preenchida).
  await copyQuoteSheetToOrder(quote.id, order.id);
  // Gate de conformidade: linha com certificação obrigatória sem certificação válida.
  await runComplianceGate(user, order, product);
  // Modalidade da operação (RADAR): copia do cliente e revisa importação própria sem RADAR.
  await runOperationGate(user, order);
  // Gate: FOB zerado ou ausente vai para a fila de revisão (não bloqueia o pedido).
  const gates = await getSettings();
  if (gates.reviewOnZeroPrice && !(fobTotal && fobTotal > 0)) {
    await openReview(user, {
      orderId: order.id,
      entity: "order",
      entityId: order.id,
      rule: "order.zeroPrice",
      problem:
        "Pedido criado sem valor FOB (preço zerado ou cotação sem preço)",
      expected: "> 0",
      found: fobTotal ?? "—",
      responsibleRole: "operator",
      action: "Informar o preço negociado antes do pagamento ao fornecedor.",
      link: `/app/orders/${order.id}`,
    });
  }

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
  // Programação de compra ligada à solicitação passa a "ordered".
  for (const schedule of await store.list("purchase_schedules", {
    filter: { requestId: request.id },
  })) {
    await store.update("purchase_schedules", schedule.id, {
      orderId: order.id,
      status: "ordered",
    });
  }
  await audit(
    user,
    "order.create",
    "order",
    order.id,
    `Pedido #${number} criado a partir da solicitação`,
  );
  await notify(requesterTarget(request.requestedForUserId), {
    subject: `Pedido #${number} criado`,
    body: "Acompanhe a timeline do seu pedido.",
    link: `/app/orders/${order.id}`,
  });
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

/**
 * Recompra ("comprar de novo") ou nova proposta a partir de um pedido anterior:
 * reaproveita a solicitação/RFQ existente, pré-preenchida com o produto do pedido.
 * Cliente só para os próprios pedidos; Wellmix para qualquer um.
 */
export async function createFollowUpRequest(
  user: User,
  orderId: string,
  input: {
    quantity: number;
    origin: "replenishment" | "proposal";
    notes?: string | null;
    deadline?: string | null;
  },
): Promise<Request> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !canViewOrder(user, order)) throw new ForbiddenError();
  if (!(isWellmix(user) || user.role === "customer"))
    throw new ForbiddenError();
  const [item] = await store.list("order_items", { filter: { orderId } });
  if (!item) throw new RequestError("order_item_missing");
  const previous = await store.get("requests", order.requestId);
  const product = item.productId
    ? await store.get("products", item.productId)
    : null;
  return createRequest(user, {
    customerId: order.customerId,
    productId: item.productId,
    productName: item.name,
    description:
      previous?.description ??
      `${input.origin === "replenishment" ? "Reposição" : "Nova proposta"} do pedido #${order.number}`,
    specification: previous?.specification ?? product?.specification ?? null,
    quantity: input.quantity,
    unit: item.unit,
    deadline: input.deadline ?? null,
    notes:
      [
        `${input.origin === "replenishment" ? "Reposição" : "Nova proposta"} a partir do pedido #${order.number} (última quantidade ${item.quantity} ${item.unit}).`,
        input.notes,
      ]
        .filter(Boolean)
        .join("\n") || null,
    origin: input.origin,
    // Recompra aberta pela Wellmix continua do mesmo login solicitante.
    requestedForUserId: order.requestedByUserId,
    sourceOrderId: order.id,
  });
}

/** Solicitações que ainda podem ser excluídas: não viraram pedido nem foram excluídas. */
export const DELETABLE_REQUEST_STATUSES = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
] as const;

export function canDeleteRequest(user: User, request: Request) {
  return (
    canViewRequest(user, request) &&
    (DELETABLE_REQUEST_STATUSES as readonly string[]).includes(request.status)
  );
}

/**
 * Excluir solicitações = cancelar (status CANCELLED), sem apagar dados: a
 * solicitação sai da lista e das pendências, fica na auditoria e pode ser vista
 * no filtro "Excluídas". Cotações em aberto são encerradas para o fornecedor.
 * Solicitação que virou pedido não é excluída por aqui (o pedido segue).
 */
export async function deleteRequests(
  user: User,
  ids: string[],
): Promise<{ deleted: number; skipped: number }> {
  if (!(isWellmix(user) || user.role === "customer"))
    throw new ForbiddenError();
  const store = getStore();
  const unique = [...new Set(ids)];
  const rows = unique.length
    ? await store.list("requests", { filter: { id: unique } })
    : [];
  let deleted = 0;
  for (const request of rows) {
    if (!canDeleteRequest(user, request)) continue;
    await store.update("requests", request.id, { status: "CANCELLED" });
    const quotes = await store.list("quotes", {
      filter: { requestId: request.id, status: ["invited", "answered"] },
    });
    for (const q of quotes)
      await store.update("quotes", q.id, { status: "rejected" });
    await cancelFreightForRequest(request.id);
    await audit(
      user,
      "request.delete",
      "request",
      request.id,
      `Solicitação excluída: ${request.productName}`,
      { status: request.status },
      { status: "CANCELLED" },
    );
    deleted++;
  }
  return { deleted, skipped: unique.length - deleted };
}
