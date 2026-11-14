import "server-only";
import { realName } from "@/lib/placeholder-name";

import { randomUUID } from "node:crypto";

import {
  getStore,
  type Order,
  type ProductVariant,
  type Request,
  type RequestOrigin,
  type RequestStatus,
  type User,
  type RequestSchedule,
} from "@/lib/db";
import { variantSnapshot } from "@/lib/variants";
import { getProductVariant, listProductVariants } from "./product-variants";
import { requestProductName, variantSpecification } from "./variant-sales";
import {
  ForbiddenError,
  assertWellmix,
  canViewRequest,
  isWellmix,
  canViewOrder,
} from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { emitProcessEvent } from "./process-engine";
import { isHiddenByBooking } from "./booking-visibility";
import { notifyWellmix } from "./notifications";
import { quoteSlaDeadline } from "@/lib/sla";
import { effectiveMoq, isPieceUnit } from "@/lib/moq";

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
  /** Variação escolhida do produto (docs/PRODUCT_VARIANTS.md). */
  variantId?: string | null;
}

/** Um produto do lote: vira uma solicitação própria. */
export interface RequestBatchItem {
  productId: string | null;
  /** Variação escolhida do produto, quando ele tem variações. */
  variantId?: string | null;
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
  /**
   * Só para chamadas do próprio servidor (nunca vem do formulário): `ids` =
   * o id de cada solicitação, escolhido antes por quem chama, na ordem dos
   * produtos.
   */
  internal: { ids?: string[] } = {},
): Promise<Request[]> {
  if (!items.length) throw new Error("no_products");
  const groupId = items.length > 1 ? randomUUID() : null;
  const created: Request[] = [];
  const store = getStore();
  /* Um número para a solicitação inteira: o 1º produto o reserva (depois das
     checagens de permissão, para não gastar número à toa) e os demais o
     repetem. Sem a coluna no banco ainda, fica sem número. */
  let number: number | undefined;
  for (const [index, item] of items.entries()) {
    try {
      const request = await createRequest(
        user,
        {
          ...base,
          productId: item.productId,
          variantId: item.variantId ?? null,
          productName: item.productName,
          description: item.description,
          specification: item.specification,
          quantity: item.quantity,
          unit: item.unit,
          origin:
            item.sourcingDemand && !item.productId
              ? "sourcing_demand"
              : "manual",
          groupId,
          schedule: item.schedule ?? null,
          number,
        },
        internal.ids?.[index] ? { id: internal.ids[index] } : {},
      );
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
  // Produto sem NCM: o despachante recebe a pendência e um aviso só.
  await (await import("./request-ncm")).notifyNcmPending(created);
  return created;
}

/** Situações em que ainda dá para pôr produto na solicitação (antes do pedido). */
const ADDABLE_STATUSES: readonly RequestStatus[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

/**
 * Wellmix acrescenta produtos a uma solicitação que ainda não virou pedido:
 * cada produto vira uma solicitação do MESMO lote (mesmo número, cliente e
 * solicitante), com a própria cotação, e vira o próprio pedido no sinal, como
 * os demais. Solicitação sozinha passa a ser lote. Se um produto falhar, os
 * que nasceram nesta chamada são cancelados (sem apagar) e o erro segue.
 */
export async function addProductsToRequest(
  user: User,
  requestId: string,
  items: RequestBatchItem[],
): Promise<{ groupId: string; created: Request[] }> {
  assertWellmix(user);
  if (!items.length) throw new Error("no_products");
  const store = getStore();
  const base = await store.get("requests", requestId);
  if (!base) throw new RequestError("not_found");
  if (!ADDABLE_STATUSES.includes(base.status))
    throw new RequestError("invalid_status");
  const groupId = base.groupId ?? randomUUID();
  if (!base.groupId) {
    try {
      await store.update("requests", base.id, { groupId });
    } catch (error) {
      if (
        error instanceof Error &&
        /unknown attribute.*groupId/i.test(error.message)
      )
        throw new Error("schema_outdated");
      throw error;
    }
  }
  const created: Request[] = [];
  try {
    for (const item of items)
      created.push(
        await createRequest(user, {
          customerId: base.customerId,
          requestedForUserId: base.requestedForUserId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          productName: item.productName,
          description: item.description,
          specification: item.specification,
          quantity: item.quantity,
          unit: item.unit,
          origin:
            item.sourcingDemand && !item.productId
              ? "sourcing_demand"
              : "manual",
          groupId,
          schedule: item.schedule ?? null,
          number: base.number ?? undefined,
        }),
      );
  } catch (error) {
    try {
      for (const r of created) {
        await store.update("requests", r.id, { status: "CANCELLED" });
        await audit(
          user,
          "request.batch_rollback",
          "request",
          r.id,
          "Produto acrescentado interrompido: solicitação cancelada",
          { status: r.status },
          { status: "CANCELLED" },
        );
      }
    } catch (rollbackError) {
      console.error("[requests] reversão do acréscimo falhou", rollbackError);
    }
    throw error;
  }
  await audit(
    user,
    "request.add_products",
    "request",
    base.id,
    `Produtos acrescentados à solicitação${base.number ? ` nº ${base.number}` : ""}: ${created.map((r) => r.productName).join(", ")}`,
  );
  return { groupId, created };
}

/** A solicitação ainda aceita produto novo (Wellmix, antes de virar pedido)? */
export function canAddProducts(user: User, request: Request): boolean {
  return isWellmix(user) && ADDABLE_STATUSES.includes(request.status);
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
  /**
   * Só para chamadas do próprio servidor (nunca vem do formulário):
   * `ownOrder` = recompra, o produto é o de um pedido que o cliente já tem;
   * `id` = o id que a solicitação vai ter, escolhido antes.
   */
  internal: { ownOrder?: boolean; id?: string } = {},
): Promise<Request> {
  const store = getStore();
  const settings = await getSettings();
  if (user.role === "customer") {
    if (!settings.customerCanCreateRequest) throw new ForbiddenError();
    if (input.customerId !== user.partyId) throw new ForbiddenError();
  } else if (!isWellmix(user)) {
    throw new ForbiddenError();
  }
  // Cliente só pede produto do catálogo que ele pode ver: existe, está ativo
  // e não está escondido (docs/SUPPLIER_REQUESTS.md). A mesma recusa nos
  // três casos (não dá para descobrir se um produto existe), antes de olhar
  // variação, mínimo ou nome do produto. A Wellmix segue como antes.
  // A recompra de um pedido do próprio cliente (createFollowUpRequest) fica
  // como sempre foi: o produto vem do pedido dele, não do formulário.
  if (user.role === "customer" && input.productId && !internal.ownOrder) {
    const [catalogProduct, hiddenByBooking] = await Promise.all([
      store.get("products", input.productId),
      isHiddenByBooking(input.productId),
    ]);
    if (!catalogProduct?.active || hiddenByBooking)
      throw new RequestError("product_unavailable");
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
  // Produto com variações: a variação é obrigatória, do produto e ativa.
  const variant = await resolveRequestVariant(input.productId, input.variantId);
  // Pedido mínimo do produto do catálogo (da variação, quando há): conferido
  // antes de gastar número.
  await assertProductMoq(
    input.productId,
    input.quantity,
    input.unit,
    variant?.id ?? null,
  );
  // Prazo de resposta = SLA da Wellmix (Configurações). O cliente não escolhe;
  // a Wellmix pode ajustar numa solicitação específica.
  const deadline =
    (isWellmix(user) ? input.deadline : null) ||
    quoteSlaDeadline(settings.quoteSlaBusinessDays);
  // Com variação: nome "Produto · Variação" e especificação da variação quando
  // quem pediu não escreveu uma (docs/PRODUCT_VARIANTS.md, regra 3).
  const product =
    variant && input.productId
      ? await store.get("products", input.productId)
      : null;
  const productName = variant
    ? requestProductName(
        input.productName,
        // Nome de exemplo ("Produto novo XPTO") não vai para a solicitação.
        realName(product?.name) ?? input.productName,
        variant.name,
      )
    : input.productName;
  const specification =
    (input.specification ?? "").trim() ||
    (variant ? variantSpecification(variant) : "") ||
    null;
  const number = input.number ?? (await nextRequestNumber());
  // Analista responsável: o da divisão da linha do produto com menos
  // pendências (docs/SLA_PANEL.md). Sem divisão configurada: sem responsável.
  const { pickOwner } = await import("./team");
  const ownerUserId = await pickOwner(input.productId).catch(() => null);
  const data = {
    requestedForUserId,
    customerId: input.customerId,
    createdByUserId: user.id,
    productId: input.productId ?? null,
    productName,
    description: input.description,
    specification,
    quantity: input.quantity,
    unit: input.unit,
    deadline,
    status: "REQUESTED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    origin: input.origin ?? "manual",
    sourceOrderId: input.sourceOrderId ?? null,
    notes: input.notes ?? null,
    // Só vai ao banco quando há lote (coluna opcional; antes dela existir, nada muda).
    ...(input.groupId ? { groupId: input.groupId } : {}),
    // Variação escolhida e a cópia dos valores dela (colunas opcionais): só
    // vão quando há uma.
    ...(variant
      ? { variantId: variant.id, variant: variantSnapshot(variant) }
      : {}),
    // Idem para a programação de entregas (coluna opcional).
    ...(input.schedule ? { schedule: input.schedule } : {}),
    // Idem para o analista responsável (coluna opcional).
    ...(ownerUserId ? { ownerUserId } : {}),
    // Id escolhido antes por quem chama (só o servidor).
    ...(internal.id ? { id: internal.id } : {}),
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
  // Sourcing em espera (decisão do dono): a solicitação nasce igual, mas não
  // abre item de Sourcing nem o aviso "Sourcing sob demanda".
  if (
    request.origin === "sourcing_demand" &&
    !request.productId &&
    (await getSettings()).sourcingEnabled
  ) {
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
      body: "Cliente pediu um produto fora do catálogo. Localize fornecedores e cadastre opções.",
      link: `/app/sourcing?tab=items&status=draft`,
    });
  }
  await notifyWellmix({
    kind: "action",
    subject: `Nova solicitação${request.number ? ` nº ${request.number}` : ""}: ${request.productName}`,
    body: `${request.quantity.toLocaleString("pt-BR")} ${request.unit}.`,
    link: `/app/requests/${request.id}`,
  });
  return request;
}

/**
 * Variação da solicitação: produto com variações ativas exige uma
 * (`variant_required`); a escolhida tem de ser do produto e estar ativa
 * (`variant_invalid`). Produto sem variações, ou sem produto: nenhuma.
 */
async function resolveRequestVariant(
  productId: string | null | undefined,
  variantId: string | null | undefined,
): Promise<ProductVariant | null> {
  if (!productId) return null;
  const variants = await listProductVariants(productId);
  if (!variantId) {
    if (variants.length) throw new RequestError("variant_required");
    return null;
  }
  const variant = variants.find((v) => v.id === variantId) ?? null;
  if (!variant) throw new RequestError("variant_invalid");
  return variant;
}

/**
 * Pedido mínimo do produto (variação escolhida, senão ficha mestre, senão
 * cadastro), em peças; nulo sem mínimo.
 */
export async function productMoq(
  productId: string,
  variantId?: string | null,
): Promise<number | null> {
  const product = await getStore().get("products", productId);
  if (!product) return null;
  const { getProductSheet } = await import("./product-sheet");
  const [sheet, variant] = await Promise.all([
    getProductSheet(productId),
    variantId ? getProductVariant(variantId) : null,
  ]);
  // Variação de outro produto não conta (a criação já recusa; aqui é só o mínimo).
  const variantMoq =
    variant && variant.productId === productId ? variant.moq : null;
  return effectiveMoq(variantMoq, sheet?.moq, product.moq);
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
  variantId?: string | null,
) {
  if (!productId || !isPieceUnit(unit)) return;
  const moq = await productMoq(productId, variantId);
  if (moq !== null && quantity < moq) throw new RequestError("below_moq");
}

/** Próximo número de solicitação (contador próprio, como o dos pedidos). */
export function nextRequestNumber(): Promise<number> {
  return getStore().nextNumber("request_number");
}

/**
 * Parceiros padrão: quando existe exatamente um parceiro ativo de cada tipo,
 * ele é designado automaticamente. Caso contrário o operador designa no pedido.
 */
export async function assignDefaultPartners(
  order: Order,
  options: { skipAgency?: boolean } = {},
) {
  const store = getStore();
  const patch: Partial<Order> = {};
  // Agência de arte da linha do pedido (dono, 13/11/2026) vem antes da regra
  // "a única agência ativa".
  if (!order.agencyId && !options.skipAgency) {
    const { lineAgencyOf } = await import("./line-agency");
    const agencyId = await lineAgencyOf(order.lineId);
    if (agencyId) patch.agencyId = agencyId;
  }
  for (const [type, field] of [
    ["agency", "agencyId"],
    ["broker", "brokerId"],
    ["shipping_line", "shippingLineId"],
    ["carrier", "carrierId"],
    ["comex", "comexId"],
    ["logistics", "logisticsId"],
    ["ocp", "ocpId"],
  ] as const) {
    // Já designado (ex.: agência do briefing de embalagem) não é sobrescrito.
    if (order[field] || patch[field]) continue;
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
  return createRequest(
    user,
    {
      customerId: order.customerId,
      productId: item.productId,
      // Mesma variação do pedido (a cópia dos valores é refeita com a variação
      // de hoje; desativada, a recompra pede outra).
      variantId: item.variantId ?? previous?.variantId ?? null,
      // Item com nome de exemplo: o nome real do produto, se ele já tiver.
      productName: realName(item.name) ?? realName(product?.name) ?? item.name,
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
    },
    // O produto é o do pedido que o cliente já tem (conferido acima).
    { ownOrder: true },
  );
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
 * no filtro "Excluídas".
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
    await emitProcessEvent(user, "request:CANCELLED", {
      requestId: request.id,
    });
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
