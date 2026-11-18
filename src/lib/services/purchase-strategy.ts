import "server-only";

import {
  getStore,
  type LastPurchase,
  type Order,
  type PurchaseDecision,
  type PurchaseDecisionChoice,
  type Request,
  type User,
} from "@/lib/db";
import {
  assertCan,
  can,
  canSeePurchasePrice,
  holdersOf,
} from "@/lib/auth/function-access";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { demandKind } from "@/lib/purchase-demand";
import { audit } from "./audit";
import { notify } from "./notifications";
import { isStockCustomer } from "./stock-party";
import { listColumns } from "@/lib/db/lookup";
import { countryKey } from "@/lib/order-terms";
import { servesFamilies } from "@/lib/party-families";

/*
 * Estratégia de compra (mapa B10?, dono 15/11/2026; docs/PURCHASE_DEMAND.md).
 * Uma fila só do Comprador, com reposições e encomendas. A estratégia é da
 * solicitação inteira (todos os produtos dela juntos; dono, 18/11/2026), e
 * ele escolhe:
 *
 * - "Fornecedor da última compra": aprovada pela Diretoria de compras, gera
 *   o pedido de compra direto (P2) com as condições da última compra,
 *   editáveis; sem nova solicitação ao fornecedor nem amostragem;
 * - "Cotar entre fornecedores": aprovada, abre a Cotação de compra (B13)
 *   para os fornecedores do País × Família da solicitação marcados na tela
 *   (`strategySuppliers`; o Comprador desmarca quem não deve receber).
 *
 * Produto sem compra anterior: só dá para cotar (o motivo aparece escrito).
 */

export class PurchaseStrategyError extends Error {}

/**
 * A última compra de cada produto: o pedido de compra mais recente com o
 * produto (não cancelado), com o fornecedor, o preço, a moeda, a data e o
 * incoterm do pedido; prazo e pedido mínimo do vínculo produto × fornecedor.
 */
export async function lastPurchases(
  productIds: readonly string[],
): Promise<Map<string, LastPurchase>> {
  const out = new Map<string, LastPurchase>();
  const ids = [...new Set(productIds)];
  if (!ids.length) return out;
  const store = getStore();
  const items = await store.list("order_items", {
    filter: { productId: ids },
  });
  if (!items.length) return out;
  const orders = await store.list("orders", {
    filter: { id: [...new Set(items.map((i) => i.orderId))] },
  });
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const best = new Map<string, { order: Order; unitPrice: number | null }>();
  for (const item of items) {
    const order = orderById.get(item.orderId);
    if (!item.productId || !order || order.status === "CANCELLED") continue;
    if (!order.supplierId) continue;
    const current = best.get(item.productId);
    if (!current || order.createdAt > current.order.createdAt)
      best.set(item.productId, { order, unitPrice: item.unitPrice ?? null });
  }
  if (!best.size) return out;
  const supplierIds = [
    ...new Set([...best.values()].map((b) => b.order.supplierId)),
  ];
  const [suppliers, links] = await Promise.all([
    store.list("parties", { filter: { id: supplierIds } }),
    store
      .list("product_suppliers", { filter: { productId: [...best.keys()] } })
      .catch(() => []),
  ]);
  for (const [productId, { order, unitPrice }] of best) {
    const link = links.find(
      (l) => l.productId === productId && l.supplierId === order.supplierId,
    );
    out.set(productId, {
      productId,
      supplierId: order.supplierId,
      supplierName:
        suppliers.find((p) => p.id === order.supplierId)?.name ?? null,
      unitPrice,
      currency: order.fobCurrency ?? link?.currency ?? null,
      date: order.createdAt,
      orderId: order.id,
      orderNumber: order.number,
      leadTimeDays: link?.leadTimeDays ?? null,
      incoterm: order.incoterm ?? null,
      moq: link?.moq ?? null,
    });
  }
  return out;
}

/** Demandas que esperam a estratégia: abertas e sem estratégia em curso. */
export async function waitingDemands(): Promise<Request[]> {
  const rows = await getStore().list("requests", {
    filter: { status: "REQUESTED" },
    orderBy: "createdAt",
  });
  return rows.filter(
    (r) =>
      !r.purchaseDecisionId &&
      demandKind(r) !== null &&
      // A compra para estoque aberta na Nova solicitação segue o caminho dela.
      (demandKind(r) === "replenishment" || !isStockCustomer(r.customerId)),
  );
}

/** Estratégias em curso (pendentes de aprovação ou aprovadas sem pedido). */
export async function openDecisions(): Promise<PurchaseDecision[]> {
  const rows = await getStore().list("purchase_decisions", {
    filter: { status: ["pending", "approved"] },
    orderBy: "createdAt",
  });
  return rows.filter(
    (d) =>
      d.status === "pending" ||
      (d.choice === "last_supplier" ? !d.orderId : !d.quoteId),
  );
}

/**
 * A solicitação de uma demanda: os produtos do mesmo lote (`groupId`, mesmo
 * número) são uma solicitação só; sem lote, a própria demanda.
 */
export const requestKey = (r: Pick<Request, "id" | "groupId" | "number">) =>
  r.groupId ? `g:${r.groupId}` : r.number ? `n:${r.number}` : `r:${r.id}`;

/**
 * "Fornecedor da última compra" para a solicitação: todos os produtos com
 * compra anterior, e todas do mesmo fornecedor (dono, 18/11/2026).
 */
export function sameLastSupplier(
  productIds: readonly string[],
  references: ReadonlyMap<string, Pick<LastPurchase, "supplierId">>,
): boolean {
  if (!productIds.length) return false;
  const suppliers = new Set(
    productIds.map((id) => references.get(id)?.supplierId ?? null),
  );
  return suppliers.size === 1 && !suppliers.has(null);
}

export interface StrategySupplier {
  id: string;
  name: string;
  type: string;
  country: string | null;
  /** family = marcou a família no cadastro; catalog = fornecedor de produto dela. */
  reasons: Array<"family" | "catalog">;
}

export interface StrategyOrigin {
  /** País de origem (chave de `countryKey`); "" = não informado. */
  country: string;
  countryName: string;
  /** Família ("fm:<NOME>" ou "ln:<linha>"); nula = sem família. */
  family: string | null;
  familyName: string | null;
  suppliers: StrategySupplier[];
}

/**
 * Os fornecedores do País × Família da solicitação (dono, 18/11/2026), os
 * que a tela lista para a cotação, cada um uma vez só:
 * - quem marcou a família no cadastro ("Grupo de produto (família)",
 *   `party_families`; docs/PARTNER_FAMILIES.md);
 * - o fornecedor principal dos produtos ativos da família e os ligados aos
 *   produtos da solicitação (`product_suppliers`).
 * Só os ativos dos quatro tipos (Fornecedor, Trading, Supplier e Factory) e
 * do país de origem. País e família vêm das condições do pedido
 * (`orderTerms`); sem elas (reposição, antigas), do produto do catálogo.
 */
export async function strategySuppliers(
  demands: readonly Request[],
): Promise<StrategyOrigin> {
  const store = getStore();
  const origin = await import("./product-origin");
  const terms = demands.find((d) => d.orderTerms?.originCountry)?.orderTerms;
  const productIds = [
    ...new Set(demands.map((d) => d.productId).filter(Boolean)),
  ] as string[];
  const fromProduct = productIds[0]
    ? await origin.productOrigin(productIds[0]).catch(() => null)
    : null;
  const country = terms?.originCountry || fromProduct?.country || "";
  const family = terms
    ? terms.productFamily || null
    : (fromProduct?.family ?? null);
  const familyInfo = family
    ? await origin.originFamily(family).catch(() => null)
    : null;
  const countryName =
    terms?.originCountryName ||
    (await origin.originCountryName(country).catch(() => country));
  const familyName =
    terms?.productFamilyName ||
    familyInfo?.name ||
    terms?.productLineName ||
    null;
  const products = productIds.length
    ? await listColumns(store, "products", ["id", "lineId"], {
        filter: { id: productIds },
      })
    : [];
  const lineIds = [
    ...new Set(
      [
        ...(familyInfo?.lineIds ?? []),
        ...products.map((p) => p.lineId),
        terms?.productLineId,
      ].filter(Boolean),
    ),
  ] as string[];
  const reasons = new Map<string, Set<"family" | "catalog">>();
  const add = (id: string | null | undefined, why: "family" | "catalog") => {
    if (!id) return;
    const set = reasons.get(id) ?? new Set();
    set.add(why);
    reasons.set(id, set);
  };
  const { familyCodesForLines } = await import("./product-families");
  const codes = new Set(await familyCodesForLines(lineIds).catch(() => []));
  if (family?.startsWith("fm:")) {
    const named = await store
      .list("product_families", { filter: { nameKey: family } })
      .catch(() => []);
    for (const f of named) codes.add(f.code);
  }
  if (codes.size) {
    const links = await store
      .list("party_families", { filter: { familyCode: [...codes] } })
      .catch(() => []);
    for (const l of links) add(l.partyId, "family");
  }
  if (lineIds.length) {
    const ofFamily = await listColumns(store, "products", ["supplierId"], {
      filter: { lineId: lineIds, active: true },
    }).catch(() => []);
    for (const p of ofFamily) add(p.supplierId, "catalog");
  }
  if (productIds.length) {
    const links = await store
      .list("product_suppliers", { filter: { productId: productIds } })
      .catch(() => []);
    for (const l of links) add(l.supplierId, "catalog");
  }
  const parties = reasons.size
    ? await store.list("parties", { filter: { id: [...reasons.keys()] } })
    : [];
  const suppliers = parties
    .filter(
      (p) =>
        p.active &&
        servesFamilies(p.type) &&
        (!country || countryKey(p.country) === country),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      country: p.country,
      reasons: [...(reasons.get(p.id) ?? [])].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return { country, countryName, family, familyName, suppliers };
}

async function teamHolders(action: Parameters<typeof can>[1]) {
  const users = (
    await getStore().list("users", { filter: { active: true } })
  ).filter((u) => isWellmix(u));
  const { loadFunctionDefs } = await import("./team-functions");
  const holders = holdersOf(users, action, await loadFunctionDefs());
  return holders.length ? holders : users.filter((u) => isAdmin(u));
}

/**
 * O Comprador escolhe a estratégia da solicitação inteira: todas as demandas
 * dela que esperam a escolha, juntas (dono, 18/11/2026). "Fornecedor da
 * última compra" só com um produto e com compra anterior. Em "cotar",
 * `supplierIds` são os fornecedores marcados da lista do País × Família
 * (`strategySuppliers`); sem a lista (chamada antiga), a cotação convida
 * pelas linhas, como antes. A escolha vai para a aprovação da Diretoria.
 */
export async function chooseStrategy(
  user: User,
  input: {
    demandIds: string[];
    choice: PurchaseDecisionChoice;
    note: string | null;
    supplierIds?: string[];
  },
): Promise<PurchaseDecision> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  assertCan(user, "purchaseStrategy.choose");
  const ids = [...new Set(input.demandIds)];
  if (!ids.length) throw new PurchaseStrategyError("strategy_choose_demands");
  const store = getStore();
  const demands = await store.list("requests", { filter: { id: ids } });
  if (demands.length !== ids.length)
    throw new PurchaseStrategyError("not_found");
  for (const d of demands)
    if (d.status !== "REQUESTED" || d.purchaseDecisionId || !demandKind(d))
      throw new PurchaseStrategyError("strategy_demand_taken");
  if (demands.some((d) => !d.productId))
    throw new PurchaseStrategyError("strategy_product_missing");
  // Uma solicitação só, com todos os produtos dela que esperam a escolha.
  const keys = new Set(demands.map(requestKey));
  if (keys.size > 1) throw new PurchaseStrategyError("strategy_same_request");
  const [key] = keys;
  const left = (await waitingDemands()).filter(
    (r) => requestKey(r) === key && !ids.includes(r.id),
  );
  if (left.length) throw new PurchaseStrategyError("strategy_whole_request");
  const productIds = [...new Set(demands.map((d) => d.productId!))];
  const products = await store.list("products", {
    filter: { id: productIds },
  });
  const lineIds = [...new Set(products.map((p) => p.lineId ?? null))];
  let supplierIds: string[] | null = null;
  if (input.choice === "quote" && input.supplierIds) {
    const eligible = new Set(
      (await strategySuppliers(demands)).suppliers.map((s) => s.id),
    );
    supplierIds = [...new Set(input.supplierIds)];
    if (supplierIds.some((id) => !eligible.has(id)))
      throw new PurchaseStrategyError("strategy_supplier_invalid");
    if (eligible.size && !supplierIds.length)
      throw new PurchaseStrategyError("strategy_suppliers_none");
  }
  const references = await lastPurchases(productIds);
  if (input.choice === "last_supplier") {
    // Vale para a solicitação toda quando todos os produtos têm compra
    // anterior do mesmo fornecedor (dono, 18/11/2026).
    if (productIds.some((id) => !references.get(id)))
      throw new PurchaseStrategyError("strategy_no_last_purchase");
    if (!sameLastSupplier(productIds, references))
      throw new PurchaseStrategyError("strategy_last_same_supplier");
  }
  const now = new Date().toISOString();
  const decision = await store.create("purchase_decisions", {
    number: await store.nextNumber("purchase_decision_number"),
    productId: productIds.length === 1 ? productIds[0] : null,
    lineId: lineIds.length === 1 ? lineIds[0] : null,
    demandIds: ids,
    quantity: demands.reduce((sum, d) => sum + d.quantity, 0),
    choice: input.choice,
    reference: [...references.values()],
    note: input.note,
    status: "pending",
    chosenByUserId: user.id,
    chosenAt: now,
    approvedByUserId: null,
    approvedAt: null,
    approvalNote: null,
    orderId: null,
    quoteId: null,
    ...(supplierIds ? { supplierIds } : {}),
  });
  for (const d of demands)
    await store.update("requests", d.id, { purchaseDecisionId: decision.id });
  const label =
    input.choice === "last_supplier"
      ? "fornecedor da última compra"
      : "cotar entre fornecedores";
  await audit(
    user,
    "purchase_strategy.choose",
    "purchase_decision",
    decision.id,
    `Estratégia nº ${decision.number}: ${label} para a solicitação nº ${demands[0].number ?? demands[0].id} (${demands.length} produto(s))${supplierIds ? `, ${supplierIds.length} fornecedor(es) marcados` : ""}`,
  );
  const approvers = await teamHolders("purchaseStrategy.approve");
  if (approvers.length)
    await notify(
      { userIds: approvers.map((u) => u.id) },
      {
        kind: "action",
        link: `/app/purchase-strategy#decision-${decision.id}`,
        subject: `Aprovar estratégia de compra nº ${decision.number}`,
        body: `${label} para ${demands.length} demanda(s).`,
      },
    );
  return decision;
}

/**
 * A Diretoria de compras aprova ou recusa a estratégia. Recusada, as
 * demandas voltam para a fila do Comprador (com o motivo).
 */
export async function decideStrategy(
  user: User,
  decisionId: string,
  input: { approve: boolean; note: string | null },
): Promise<PurchaseDecision> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  assertCan(user, "purchaseStrategy.approve");
  const store = getStore();
  const decision = await store.get("purchase_decisions", decisionId);
  if (!decision) throw new PurchaseStrategyError("not_found");
  if (decision.status !== "pending")
    throw new PurchaseStrategyError("strategy_decided");
  if (!input.approve && !input.note?.trim())
    throw new PurchaseStrategyError("strategy_reject_note");
  const now = new Date().toISOString();
  const updated = await store.update("purchase_decisions", decision.id, {
    status: input.approve ? "approved" : "rejected",
    approvedByUserId: user.id,
    approvedAt: now,
    approvalNote: input.note?.trim() || null,
  });
  if (!input.approve)
    for (const id of decision.demandIds)
      await store.update("requests", id, { purchaseDecisionId: null });
  await audit(
    user,
    input.approve ? "purchase_strategy.approve" : "purchase_strategy.reject",
    "purchase_decision",
    decision.id,
    `Estratégia nº ${decision.number} ${input.approve ? "aprovada" : `recusada: ${input.note}`}`,
  );
  await notify(
    { userIds: [decision.chosenByUserId] },
    {
      kind: input.approve ? "action" : "alert",
      link: `/app/purchase-strategy#decision-${decision.id}`,
      subject: `Estratégia de compra nº ${decision.number} ${input.approve ? "aprovada" : "recusada"}`,
      body: input.approve
        ? decision.choice === "last_supplier"
          ? "Gere o pedido de compra com as condições da última compra."
          : "A cotação de compra entre fornecedores pode seguir."
        : `Motivo: ${input.note}`,
    },
  );
  // "Cotar entre fornecedores" aprovada: o sistema abre a Cotação de compra
  // (B13), sem ação manual (docs/PURCHASE_DEMAND.md).
  if (input.approve && decision.choice === "quote") {
    const { openQuoteForDecision } = await import("./purchase-quote");
    await openQuoteForDecision(user, updated);
  }
  return updated;
}

/**
 * Gera o pedido de compra da estratégia aprovada "fornecedor da última
 * compra", com as condições conferidas pelo Comprador. As demandas viram
 * "pedido"; a encomenda reserva a mercadoria para o cliente, valendo na
 * chegada (a reserva conta só no que chegou ao Brasil).
 */
export async function orderFromStrategy(
  user: User,
  decisionId: string,
  input: {
    currency: string;
    leadTimeDays: number | null;
    incoterm: "EXW" | "FOB" | null;
    /** Um produto (estratégias de um produto só): quantidade e preço. */
    unitPrice?: number | null;
    quantity?: number;
    /** Vários produtos: quantidade e preço de cada um (ausente = o somado e o da última compra). */
    lines?: Array<{
      productId: string;
      quantity: number;
      unitPrice: number | null;
    }>;
  },
): Promise<Order> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  const store = getStore();
  const decision = await store.get("purchase_decisions", decisionId);
  if (!decision) throw new PurchaseStrategyError("not_found");
  if (
    decision.status !== "approved" ||
    decision.choice !== "last_supplier" ||
    decision.orderId
  )
    throw new PurchaseStrategyError("strategy_not_ready");
  const demands = await store.list("requests", {
    filter: { id: decision.demandIds },
  });
  const productIds = [
    ...new Set(demands.map((d) => d.productId).filter(Boolean)),
  ] as string[];
  const refs = new Map(
    (decision.reference ?? []).map((r) => [r.productId, r] as const),
  );
  if (!productIds.length || !sameLastSupplier(productIds, refs))
    throw new PurchaseStrategyError("strategy_no_last_purchase");
  const reference = refs.get(productIds[0])!;
  // Sem "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md,
  // seção 7): o pedido sai com o preço e a moeda da última compra gravados
  // na decisão; o que vier no formulário é ignorado.
  const seesPrice = canSeePurchasePrice(user);
  const single = productIds.length === 1;
  const lines = productIds.map((productId) => {
    const ref = refs.get(productId)!;
    const sent = input.lines?.find((l) => l.productId === productId);
    const summed = demands
      .filter((d) => d.productId === productId)
      .reduce((sum, d) => sum + d.quantity, 0);
    const quantity =
      sent?.quantity ?? (single ? input.quantity : undefined) ?? summed;
    const typed = sent ? sent.unitPrice : single ? input.unitPrice : undefined;
    return {
      productId,
      quantity,
      unitPrice: seesPrice && typed !== undefined ? typed : ref.unitPrice,
    };
  });
  const currency = seesPrice ? input.currency : (reference.currency ?? "USD");
  const { createDirectPurchaseOrder } = await import("./purchase-order");
  const order = await createDirectPurchaseOrder(user, {
    supplierId: reference.supplierId,
    currency,
    incoterm: input.incoterm,
    leadTimeDays: input.leadTimeDays,
    lines,
    demandIds: decision.demandIds,
    summary: `estratégia nº ${decision.number}, demandas ${demands.map((d) => `nº ${d.number ?? "—"}`).join(", ")}`,
  });
  await store.update("purchase_decisions", decision.id, {
    status: "done",
    orderId: order.id,
  });
  for (const d of demands) {
    await store.update("requests", d.id, {
      status: "ORDERED",
      orderId: order.id,
    });
    // Encomenda do cliente: a mercadoria fica reservada para ele na chegada.
    if (demandKind(d) === "order" && !isStockCustomer(d.customerId))
      await reserveOnArrival(user, d, order);
  }
  await audit(
    user,
    "purchase_strategy.order",
    "purchase_decision",
    decision.id,
    `Estratégia nº ${decision.number}: pedido de compra #${order.number}`,
  );
  return order;
}

/**
 * Reserva da encomenda (docs/PURCHASE_DEMAND.md, "Vínculo até o fim"): sem
 * validade, para o cliente que encomendou; conta só no que chegou ao Brasil,
 * então vale quando a mercadoria chega. Vendas fica sabendo pelo aviso do
 * pedido de compra (V1).
 */
export async function linkDemandsToOrder(
  user: User,
  order: Order,
  demandIds: readonly string[],
): Promise<void> {
  if (!demandIds.length) return;
  const store = getStore();
  const demands = await store.list("requests", {
    filter: { id: [...demandIds] },
  });
  await store.update("orders", order.id, { demandIds: [...demandIds] });
  for (const d of demands) {
    await store.update("requests", d.id, {
      status: "ORDERED",
      orderId: order.id,
    });
    if (demandKind(d) === "order" && !isStockCustomer(d.customerId))
      await reserveOnArrival(user, d, order);
  }
}

async function reserveOnArrival(user: User, demand: Request, order: Order) {
  if (!demand.productId) return;
  const store = getStore();
  await store.create("stock_reservations", {
    productId: demand.productId,
    customerId: demand.customerId,
    quantity: demand.quantity,
    unit: demand.unit,
    status: "active",
    expiresAt: null,
    note: `Encomenda nº ${demand.number ?? "—"}: pedido de compra #${order.number} (reservada na chegada)`,
    createdByUserId: user.id,
    movementId: null,
    closedByUserId: null,
    closedAt: null,
    requestId: demand.id,
  });
  await audit(
    user,
    "stock.reserve_on_arrival",
    "request",
    demand.id,
    `Reserva na chegada: ${demand.quantity} ${demand.unit} para o cliente da encomenda nº ${demand.number ?? "—"} (pedido #${order.number})`,
  );
}

export const canChooseStrategy = (user: User) =>
  isWellmix(user) && can(user, "purchaseStrategy.choose");
export const canApproveStrategy = (user: User) =>
  isWellmix(user) && can(user, "purchaseStrategy.approve");

/**
 * Pendências da estratégia de compra (passo Estratégia de compra do menu):
 * cada demanda esperando a escolha (Comprador), cada estratégia esperando a
 * aprovação (Diretoria de compras) e cada aprovada "fornecedor da última
 * compra" sem pedido (quem gera o pedido de compra). As portas por ação
 * ficam em src/lib/task-owner.ts (kindGate).
 */
export async function strategyTaskDrafts(openRequests: Request[]) {
  const waiting = openRequests.filter(
    (r) =>
      r.status === "REQUESTED" &&
      !r.purchaseDecisionId &&
      demandKind(r) !== null &&
      (demandKind(r) === "replenishment" || !isStockCustomer(r.customerId)),
  );
  const decisions = await getStore()
    .list("purchase_decisions", { filter: { status: ["pending", "approved"] } })
    .catch(() => [] as PurchaseDecision[]);
  type Draft = {
    kind:
      | "purchase_strategy"
      | "purchase_strategy_approve"
      | "purchase_strategy_order";
    title: string;
    detail: string;
    link: string;
    dueAt: string | null;
    customerId?: string | null;
    ownerUserId?: string | null;
  };
  const drafts: Draft[] = waiting.map((r) => ({
    kind: "purchase_strategy",
    title: `Estratégia de compra: ${r.productName}`,
    detail: `${demandKind(r) === "replenishment" ? "Reposição" : "Encomenda"} · ${r.quantity.toLocaleString("pt-BR")} ${r.unit}`,
    link: "/app/purchase-strategy",
    dueAt: null,
    customerId: r.customerId,
    ownerUserId: r.ownerUserId ?? null,
  }));
  for (const d of decisions) {
    if (d.status === "pending")
      drafts.push({
        kind: "purchase_strategy_approve",
        title: `Aprovar estratégia de compra nº ${d.number}`,
        detail:
          d.choice === "last_supplier"
            ? "Fornecedor da última compra"
            : "Cotar entre fornecedores",
        link: `/app/purchase-strategy#decision-${d.id}`,
        dueAt: null,
      });
    else if (d.choice === "last_supplier" && !d.orderId)
      drafts.push({
        kind: "purchase_strategy_order",
        title: `Gerar pedido de compra da estratégia nº ${d.number}`,
        detail: "Fornecedor da última compra",
        link: `/app/purchase-strategy#decision-${d.id}`,
        dueAt: null,
      });
  }
  return drafts;
}
