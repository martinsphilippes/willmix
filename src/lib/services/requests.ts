import "server-only";

import { formatAmount } from "@/lib/workflow/money";
import { randomUUID } from "node:crypto";

import { formatNcm } from "@/lib/fiscal";
import {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  PAYMENT_EXTRA_DEFAULTS,
  type Order,
  type Quote,
  type Request,
  type RequestOrigin,
  type RequestStatus,
  type User,
  type RequestSchedule,
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
import { copyQuoteSheetToOrder, getQuoteSheet } from "./quote-sheet";
import { quotedQuantity } from "./purchase-sheet-calc";
import { cancelFreightForRequest } from "./freight";
import {
  assertPackagingAgency,
  cancelPackagingBriefForRequest,
  notifyBriefsOpened,
  openPackagingBriefSafe,
  packagingSupplierSelected,
  transferPackagingBrief,
  briefForRequest,
  type OpenBriefOptions,
} from "./packaging-brief";
import { quoteSlaDeadline } from "@/lib/sla";
import { effectiveMoq, isPieceUnit } from "@/lib/moq";
import { openReview } from "./reviews";
import { runComplianceGate } from "./compliance";
import { runOperationGate } from "./operations";
import {
  linkSupplierFromQuote,
  markSupplierSelected,
} from "./product-suppliers";

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
  /** Lote: várias solicitações criadas juntas (ver createRequestBatch). */
  groupId?: string | null;
  /** Programação de entregas pedida pelo cliente. */
  schedule?: RequestSchedule | null;
  /** Número já reservado (lote: o mesmo para todos os produtos). */
  number?: number | null;
}

/** Um produto do lote: vira uma solicitação própria. */
export interface RequestBatchItem {
  productId: string | null;
  productName: string;
  description: string;
  specification: string | null;
  quantity: number;
  unit: string;
  /** Produto fora do catálogo: sourcing sob demanda. */
  sourcingDemand: boolean;
  schedule?: RequestSchedule | null;
}

/**
 * Vários produtos num formulário só. Cada produto vira uma solicitação própria
 * (cada um pode ter fornecedor, preço, ficha, NCM e inspeção diferentes); com
 * 2 ou mais, todas nascem com o mesmo `groupId` (lote). Com um só produto, é
 * a solicitação comum (sem lote).
 */
export async function createRequestBatch(
  user: User,
  base: Pick<
    CreateRequestInput,
    "customerId" | "deadline" | "notes" | "requestedForUserId"
  >,
  items: RequestBatchItem[],
): Promise<Request[]> {
  if (!items.length) throw new Error("no_products");
  const groupId = items.length > 1 ? randomUUID() : null;
  const created: Request[] = [];
  const store = getStore();
  /* Um número para a solicitação inteira: o 1º produto o reserva (depois das
     checagens de permissão, para não gastar número à toa) e os demais o
     repetem. Sem a coluna no banco ainda, fica sem número. */
  let number: number | undefined;
  for (const item of items) {
    try {
      const request = await createRequest(user, {
        ...base,
        productId: item.productId,
        productName: item.productName,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        origin:
          item.sourcingDemand && !item.productId ? "sourcing_demand" : "manual",
        groupId,
        schedule: item.schedule ?? null,
        number,
      });
      created.push(request);
      number ??= request.number ?? undefined;
    } catch (error) {
      // Banco ainda sem a coluna do lote (esquema não publicado): nada foi criado.
      if (
        groupId &&
        error instanceof Error &&
        /unknown attribute.*groupId/i.test(error.message)
      )
        throw new Error("schema_outdated");
      // Falhou no meio: o que já nasceu deste lote é cancelado (sem apagar) para
      // o usuário reenviar sem duplicar; o erro original segue para a tela.
      // Pelo groupId, para pegar também a solicitação gravada cuja etapa
      // seguinte (auditoria, sourcing, aviso) foi o que falhou.
      try {
        const born = groupId
          ? (await store.list("requests", { filter: { groupId } })).filter(
              (r) => r.status !== "CANCELLED",
            )
          : created;
        for (const r of born) {
          await store.update("requests", r.id, { status: "CANCELLED" });
          await audit(
            user,
            "request.batch_rollback",
            "request",
            r.id,
            `Lote interrompido (${item.productName}): solicitação cancelada`,
            { status: r.status },
            { status: "CANCELLED" },
          );
        }
      } catch (rollbackError) {
        // A reversão falhou também: o erro original é o que importa na tela.
        console.error("[requests] reversão do lote falhou", rollbackError);
      }
      throw error;
    }
  }
  if (groupId)
    await audit(
      user,
      "request.batch",
      "request",
      groupId,
      `Lote com ${items.length} produtos: ${items.map((i) => i.productName).join(", ")}`,
    );
  return created;
}

/** Outras solicitações do mesmo lote (a própria fora), mais antigas primeiro. */
export async function batchSiblings(request: Request): Promise<Request[]> {
  if (!request.groupId) return [];
  const rows = await getStore().list("requests", {
    filter: { groupId: request.groupId },
    orderBy: "createdAt",
  });
  return rows.filter((r) => r.id !== request.id);
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
  // Pedido mínimo do produto do catálogo: conferido antes de gastar número.
  await assertProductMoq(input.productId, input.quantity, input.unit);
  // Prazo de resposta = SLA da Wellmix (Configurações). O cliente não escolhe;
  // a Wellmix pode ajustar numa solicitação específica.
  const deadline =
    (isWellmix(user) ? input.deadline : null) ||
    quoteSlaDeadline(settings.quoteSlaBusinessDays);
  const number = input.number ?? (await nextRequestNumber());
  const data = {
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
    // Só vai ao banco quando há lote (coluna opcional; antes dela existir, nada muda).
    ...(input.groupId ? { groupId: input.groupId } : {}),
    // Idem para a programação de entregas (coluna opcional).
    ...(input.schedule ? { schedule: input.schedule } : {}),
  } as const;
  let request: Request;
  try {
    request = await store.create("requests", { ...data, number });
  } catch (error) {
    // Esquema ainda sem a coluna do número (não publicado): grava sem ele, para
    // a solicitação não deixar de nascer por isso.
    if (!(
      error instanceof Error && /unknown attribute.*number/i.test(error.message)
    ))
      throw error;
    request = await store.create("requests", data);
  }
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
      kind: "action",
      subject: `Sourcing sob demanda: ${request.productName}`,
      body: "Cliente pediu um produto fora do catálogo. Localize fornecedores, cadastre opções e abra a RFQ.",
      link: `/app/sourcing?tab=items&status=draft`,
    });
  }
  await notifyWellmix({
    kind: "action",
    subject: `Nova solicitação${request.number ? ` nº ${request.number}` : ""}: ${request.productName}`,
    body: `${request.quantity.toLocaleString("pt-BR")} ${request.unit}. Abra a RFQ para os fornecedores.`,
    link: `/app/requests/${request.id}`,
  });
  return request;
}

/** Pedido mínimo do produto (ficha mestre, senão cadastro), em peças; nulo sem mínimo. */
export async function productMoq(productId: string): Promise<number | null> {
  const product = await getStore().get("products", productId);
  if (!product) return null;
  const { getProductSheet } = await import("./product-sheet");
  const sheet = await getProductSheet(productId);
  // Sem variação escolhida (a solicitação com variação chega na próxima fase).
  return effectiveMoq(null, sheet?.moq, product.moq);
}

/**
 * Produto do catálogo com pedido mínimo: a quantidade (em peças) não pode
 * ficar abaixo dele, nem pelo cliente nem pela Wellmix. Em outra unidade
 * (caixas, kg) não há como comparar; a tela já sugere o mínimo.
 */
export async function assertProductMoq(
  productId: string | null | undefined,
  quantity: number,
  unit: string,
) {
  if (!productId || !isPieceUnit(unit)) return;
  const moq = await productMoq(productId);
  if (moq !== null && quantity < moq) throw new RequestError("below_moq");
}

/** Próximo número de solicitação (contador próprio, como o dos pedidos). */
export function nextRequestNumber(): Promise<number> {
  return getStore().nextNumber("request_number");
}

/** Wellmix seleciona fornecedores e abre a RFQ. Fornecedores recebem o link. */
export async function openRfq(
  user: User,
  requestId: string,
  supplierIds: string[],
  options: {
    notify?: boolean;
    /** Recebe cada cotação assim que é criada (RFQ do lote: avisos agrupados). */
    collect?: Quote[];
    /**
     * Briefing de embalagem aberto no mesmo ato (faca e arte para a agência
     * ou o marketing da Wellmix). `enabled: false` adia para o pedido.
     */
    packaging?: OpenBriefOptions & { enabled?: boolean };
  } = {},
): Promise<Quote[]> {
  assertWellmix(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new RequestError("not_found");
  if (!RFQ_OPEN_STATUSES.includes(request.status)) {
    throw new RequestError("invalid_status");
  }
  await validSuppliers(supplierIds);
  const settings = await getSettings();
  // Briefing de embalagem: nasce com a primeira abertura da RFQ ou quando o
  // formulário pede de propósito; convidar mais fornecedores não reabre um
  // briefing adiado ou cancelado.
  const packaging =
    settings.packagingBriefAt === "rfq" &&
    options.packaging?.enabled !== false &&
    (request.status === "REQUESTED" || options.packaging?.enabled === true)
      ? (options.packaging ?? {})
      : null;
  // Agência escolhida no formulário conferida antes de qualquer gravação.
  if (packaging?.agencyId) await assertPackagingAgency(packaging.agencyId);
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + settings.quotationExpirationDays);

  const existing = await store.list("quotes", { filter: { requestId } });
  const invited: Quote[] = [];
  for (const supplierId of new Set(supplierIds)) {
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
    invited.push(quote);
    options.collect?.push(quote);
    if (options.notify !== false)
      await notify(
        { role: "supplier", partyId: supplierId },
        {
          kind: "action",
          link: `/app/quotes/${quote.id}`,
          text: (t) => ({
            subject: t("notif.rfq.subject", {
              product: request.productName,
              ref: "",
            }),
            body: t("notif.rfq.body", {
              qty: request.quantity.toLocaleString(t.intl),
              unit: request.unit,
            }),
          }),
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
  // No mesmo ato, a embalagem: a agência (ou o marketing da Wellmix) recebe
  // a pendência da faca e da arte enquanto os fornecedores cotam.
  if (packaging)
    await openPackagingBriefSafe(user, request, {
      ...packaging,
      notify: options.notify !== false && packaging.notify !== false,
    });
  return invited;
}

/** Situações em que a RFQ pode ser aberta ou receber mais fornecedores. */
export const RFQ_OPEN_STATUSES: RequestStatus[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
];

/** Fornecedores escolhidos: pelo menos um, todos fornecedores ativos no cadastro. */
async function validSuppliers(supplierIds: string[]) {
  const ids = [...new Set(supplierIds.filter(Boolean))];
  if (!ids.length) throw new RequestError("no_suppliers");
  const parties = await getStore().list("parties", { filter: { id: ids } });
  if (
    parties.length !== ids.length ||
    parties.some((p) => p.type !== "supplier" || !p.active)
  )
    throw new RequestError("invalid_supplier");
  return parties;
}

/**
 * RFQ do lote inteiro: os mesmos fornecedores para todos os produtos do lote
 * que ainda estão em cotação. Cada produto ganha a sua cotação (o fornecedor
 * responde produto a produto), mas cada fornecedor recebe um aviso só, com a
 * lista dos produtos.
 */
export async function openBatchRfq(
  user: User,
  groupId: string,
  supplierIds: string[],
  options: { packaging?: OpenBriefOptions & { enabled?: boolean } } = {},
): Promise<{ requests: number; quotes: number }> {
  assertWellmix(user);
  const store = getStore();
  const suppliers = await validSuppliers(supplierIds);
  if (options.packaging?.agencyId)
    await assertPackagingAgency(options.packaging.agencyId);
  const rows = (
    await store.list("requests", { filter: { groupId }, orderBy: "createdAt" })
  ).filter((r) => RFQ_OPEN_STATUSES.includes(r.status));
  if (!rows.length) throw new RequestError("invalid_status");
  /* Cada cotação entra em `created` assim que nasce. Se um produto falhar no
     meio, os fornecedores ainda são avisados do que já foi criado (numa nova
     tentativa a cotação existente é pulada e não seria avisada) e o erro segue. */
  const created: Quote[] = [];
  // Briefings de embalagem criados agora: um aviso só por agência, com a lista.
  const briefs: import("@/lib/db").PackagingBrief[] = [];
  let failure: unknown = null;
  try {
    for (const r of rows)
      await openRfq(user, r.id, supplierIds, {
        notify: false,
        collect: created,
        packaging: { ...options.packaging, notify: false, collect: briefs },
      });
  } catch (error) {
    failure = error;
  }
  const number = rows.find((r) => r.number)?.number;
  try {
    for (const supplier of suppliers) {
      const quotes = created.filter((q) => q.supplierId === supplier.id);
      if (!quotes.length) continue;
      const items = quotes
        .map((q) => rows.find((r) => r.id === q.requestId))
        .filter((r): r is Request => !!r);
      await notify(
        { role: "supplier", partyId: supplier.id },
        {
          kind: "action",
          link: quotes.length === 1 ? `/app/quotes/${quotes[0].id}` : "/app",
          text: (t) => {
            const ref = number ? t("notif.ref", { number }) : "";
            return items.length === 1
              ? {
                  subject: t("notif.rfq.subject", {
                    product: items[0].productName,
                    ref,
                  }),
                  body: t("notif.rfq.body", {
                    qty: items[0].quantity.toLocaleString(t.intl),
                    unit: items[0].unit,
                  }),
                }
              : {
                  subject: t("notif.rfq.many.subject", {
                    count: items.length,
                    ref,
                  }),
                  body: t("notif.rfq.many.body", {
                    items: items
                      .map(
                        (r) =>
                          `${r.productName}: ${r.quantity.toLocaleString(t.intl)} ${r.unit}`,
                      )
                      .join("; "),
                  }),
                };
          },
        },
      );
    }
  } catch (error) {
    // Com falha anterior, ela é o erro que importa; o aviso perdido fica no log.
    if (!failure) throw error;
    console.error("[requests] aviso da RFQ do lote falhou", error);
  }
  if (briefs.length) {
    try {
      await notifyBriefsOpened(briefs, rows);
    } catch (error) {
      if (!failure) throw error;
      console.error("[requests] aviso da embalagem do lote falhou", error);
    }
  }
  if (failure) throw failure;
  const total = created.length;
  await audit(
    user,
    "rfq.open_batch",
    "request",
    groupId,
    `RFQ do lote: ${rows.length} produto(s), ${suppliers.length} fornecedor(es), ${total} cotação(ões) nova(s)`,
  );
  return { requests: rows.length, quotes: total };
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
  // Quem responde a cotação de um produto do catálogo entra na lista de fornecedores dele.
  await linkSupplierFromQuote(user, quoteId, quote.status === "invited");
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
      kind: "action",
      subject: `Cotação recebida: ${request.productName}`,
      body: `${formatAmount(input.price, input.currency)}, prazo ${input.leadTimeDays} dias.`,
      link: `/app/requests/${request.id}`,
    });
  }
}

export interface SelectQuoteInput {
  sellPrice: number;
  sellCurrency: string;
  downPaymentAmount?: number | null;
  /** Sinal em % do valor ao cliente (0 a 100); sem ele, o das configurações. */
  downPaymentPercent?: number | null;
  /** Memória do cálculo do valor ao cliente (fica na auditoria). */
  pricing?: unknown;
  /**
   * Quantidade que a conta da tela usou (a da programação da ficha). Se a
   * ficha mudou depois, a seleção é recusada (sheet_changed) para refazer.
   */
  pricedQuantity?: number | null;
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
  // Antes de qualquer gravação: a ficha não pode ter mudado depois da conta.
  const current = quotedQuantity(request, await getQuoteSheet(quote.id));
  if (
    input.pricedQuantity !== undefined &&
    input.pricedQuantity !== null &&
    input.pricedQuantity !== current
  )
    throw new RequestError("sheet_changed");
  const settings = await getSettings();
  const percent = input.downPaymentPercent ?? settings.downPaymentPercent;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    throw new RequestError("invalid_down_payment");
  // Valor informado (quem chama já calculou) ou a % do valor ao cliente.
  const downPayment =
    input.downPaymentAmount ?? Math.round(input.sellPrice * percent) / 100;

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
  // Histórico do fornecedor no produto: mais uma cotação escolhida.
  await markSupplierSelected(user, quote.id);
  // Embalagem: as medidas da cotação escolhida passam a valer para a faca
  // (alerta à agência se mudaram); com `packagingBriefAt = selection`, o
  // briefing nasce aqui.
  try {
    if (settings.packagingBriefAt === "selection") {
      const { openPackagingBriefSafe: open } = await import("./packaging-brief");
      await open(user, request);
    }
    await packagingSupplierSelected(user, request, quote);
  } catch (error) {
    console.error("[requests] embalagem na escolha do fornecedor", error);
  }
  // NCM, II e IPI usados na proposta vão para a ficha escolhida (e dela para o pedido).
  await stampTaxesOnSheet(quote.id, input.pricing ?? null);
  // A proposta vale para a quantidade da programação da cotação escolhida
  // (caixas × peças por caixa, a que fecha o container); sem programação,
  // continua a pedida. O pedido nasce com ela.
  const quantity = current !== request.quantity ? current : null;
  await store.update("requests", request.id, {
    status: "WAITING_DOWN_PAYMENT",
    selectedQuoteId: quote.id,
    sellPrice: input.sellPrice,
    sellCurrency: input.sellCurrency,
    downPaymentAmount: downPayment,
    ...(quantity !== null ? { quantity } : {}),
  });
  if (quantity !== null)
    await audit(
      user,
      "request.quantity_from_sheet",
      "request",
      request.id,
      `Quantidade ajustada à programação da cotação: ${request.quantity} → ${quantity} ${request.unit}`,
      { quantity: request.quantity },
      { quantity },
    );
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
    kind: "action",
    link: `/app/requests/${request.id}`,
    text: (t) => ({
      subject: t("notif.proposal.subject", { product: request.productName }),
      body: t("notif.proposal.body", {
        qty: (quantity ?? request.quantity).toLocaleString(t.intl),
        unit: request.unit,
        total: formatAmount(input.sellPrice, input.sellCurrency, t.intl),
        down: formatAmount(downPayment, input.sellCurrency, t.intl),
      }),
    }),
  });
  await notify(
    { role: "supplier", partyId: quote.supplierId },
    {
      kind: "info",
      actor: "customer",
      link: `/app/quotes/${quote.id}`,
      text: (t) => ({
        subject: t("notif.quoteSelected.subject", {
          product: request.productName,
        }),
        body: t("notif.quoteSelected.body"),
      }),
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
  // Briefing de embalagem da RFQ: a agência dele é a agência do pedido.
  const brief = await briefForRequest(request.id);
  const briefLive =
    brief && (brief.status === "open" || brief.status === "ready")
      ? brief
      : null;

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
    agencyId: briefLive?.agencyId ?? null,
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
  // Condição de pagamento combinada com o fornecedor vale como estava hoje.
  const { snapshotOrderPaymentTerms } = await import("./supplier-terms");
  await snapshotOrderPaymentTerms(order);
  await assignDefaultPartners(order, {
    // "Marketing Wellmix" escolhido de propósito na RFQ: nenhuma agência é designada.
    skipAgency:
      !!briefLive &&
      briefLive.ownerSource === "chosen" &&
      briefLive.agencyId === null,
  });
  await createStagesForOrder(
    await store.get("orders", order.id).then((o) => o ?? order),
  );
  // Snapshot da negociação: o que foi comprado fica congelado neste pedido.
  await createPurchaseSnapshot(user, order, item, quote, product);
  // A ficha preenchida na cotação vira a ficha do pedido (Preparação já preenchida).
  await copyQuoteSheetToOrder(quote.id, order.id);
  // Embalagem preparada na RFQ: arquivos ao pedido (fornecedor vê), arte já
  // enviada conclui o item "Arte"; o fornecedor só aprova.
  if (briefLive) {
    try {
      await transferPackagingBrief(user, request, order);
    } catch (error) {
      console.error("[requests] transferência do briefing de embalagem", error);
    }
  }
  // Pedido fechado: a ficha da compra atualiza o cadastro do produto (a próxima
  // venda já vem preenchida). Produto fora do catálogo: a ficha do pedido
  // oferece cadastrar.
  if (request.productId) {
    const [orderSheet] = await store.list("purchase_sheets", {
      filter: { orderId: order.id },
      limit: 1,
    });
    if (orderSheet) {
      const { completeMasterFromSheet } = await import("./product-sheet");
      await completeMasterFromSheet(
        user,
        request.productId,
        orderSheet,
        quote.supplierId,
        "adopt",
      );
    }
  }
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
    kind: "info",
    actor: "supplier",
    link: `/app/orders/${order.id}`,
    text: (t) => ({
      subject: t("notif.orderCreated.customer.subject", { n: number }),
      body: t("notif.orderCreated.customer.body"),
    }),
  });
  await notify(
    { role: "supplier", partyId: quote.supplierId },
    {
      kind: "action",
      link: `/app/orders/${order.id}`,
      text: (t) => ({
        subject: t("notif.orderCreated.supplier.subject", { n: number }),
        body: t("notif.orderCreated.supplier.body"),
      }),
    },
  );
  return (await store.get("orders", order.id)) ?? order;
}

/**
 * Parceiros padrão: quando existe exatamente um parceiro ativo de cada tipo,
 * ele é designado automaticamente. Caso contrário o operador designa no pedido.
 */
async function assignDefaultPartners(
  order: Order,
  options: { skipAgency?: boolean } = {},
) {
  const store = getStore();
  const patch: Partial<Order> = {};
  for (const [type, field] of [
    ["agency", "agencyId"],
    ["broker", "brokerId"],
    ["shipping_line", "shippingLineId"],
    ["carrier", "carrierId"],
  ] as const) {
    // Já designado (ex.: agência do briefing de embalagem) não é sobrescrito.
    if (order[field]) continue;
    if (field === "agencyId" && options.skipAgency) continue;
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
    // Embalagem em preparação: a agência é avisada para parar.
    await cancelPackagingBriefForRequest(user, request.id, "request_deleted");
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
