import "server-only";

import {
  getStore,
  type LastPurchase,
  type Order,
  type PurchaseDecision,
  type PurchaseDecisionChoice,
  type PurchaseStrategySend,
  type Request,
  type StrategySendLine,
  type StrategySendRecipient,
  type User,
} from "@/lib/db";
import { listByIds, listColumns } from "@/lib/db/lookup";
import {
  assertCan,
  can,
  canSeePurchasePrice,
  holdersOf,
} from "@/lib/auth/function-access";
import { translator } from "@/i18n";
import { canViewRequest, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  AUTO_ACTOR_ID,
  closedDemands,
  demandKind,
  isBookDemand,
  quoteItemKey,
} from "@/lib/purchase-demand";
import {
  choiceQuotes,
  receivesQuote,
  type RecipientCheck,
  type StrategyLineChoice,
} from "@/lib/purchase-recipients";
import type { Translate } from "@/i18n";
import { taskTextValues, type TaskText } from "@/lib/task-text";
import { audit } from "./audit";
import { notify } from "./notifications";
import { isStockCustomer } from "./stock-party";
import { countryKey } from "@/lib/order-terms";
import { servesFamilies } from "@/lib/party-families";
import { getSettings } from "@/lib/settings";

/*
 * Estratégia de compra (mapa B10?, dono 15/11/2026; docs/PURCHASE_DEMAND.md).
 * Uma fila só do Comprador, com reposições e encomendas. A estratégia é da
 * solicitação inteira, com todos os produtos dela juntos (dono, 18/11/2026);
 * ele escolhe:
 *
 * - "Fornecedor da última compra": aprovada pela Diretoria de compras, gera
 *   o pedido de compra direto (P2) com as condições da última compra,
 *   editáveis; sem nova solicitação ao fornecedor nem amostragem;
 * - "Cotar entre fornecedores": aprovada, abre a Cotação de compra (B13).
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

type QueueFields = Pick<
  Request,
  "status" | "purchaseDecisionId" | "origin" | "customerId" | "strategySentAt"
>;

/**
 * A demanda está na fila da Estratégia de Compra? Aberta e sem estratégia em
 * curso. A reposição e a encomenda do cliente entram sozinhas: a venda pela
 * Wellmix com a confirmação do cliente e a encomenda aberta pelo próprio
 * cliente assim que nasce, sem o "Enviar para cotação" (dono, 22/11/2026;
 * antes, só depois do envio em Encomendas). Vale também para as que ainda
 * esperavam o envio. A compra para estoque aberta na Nova solicitação segue
 * o caminho dela.
 */
export function inStrategyQueue(r: QueueFields): boolean {
  if (r.status !== "REQUESTED" || r.purchaseDecisionId) return false;
  const kind = demandKind(r);
  if (kind === "replenishment") return true;
  return kind === "order" && !isStockCustomer(r.customerId);
}

/**
 * Encomenda esperando o "Enviar para cotação": nenhuma desde 22/11/2026 (a
 * encomenda segue direto para a Estratégia). A função fica para as telas e
 * pendências que ainda perguntam; o envio manual não aparece mais.
 */
export function awaitingStrategySend(r: QueueFields): boolean {
  void r;
  return false;
}

/** Demandas que esperam a estratégia (a fila da Estratégia de Compra). */
export async function waitingDemands(): Promise<Request[]> {
  const rows = await getStore().list("requests", {
    filter: { status: "REQUESTED" },
    orderBy: "createdAt",
  });
  return rows.filter(inStrategyQueue);
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
 * número) são uma solicitação só; sem lote, a própria demanda. A estratégia
 * é da solicitação inteira (dono, 18/11/2026).
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

/**
 * A solicitação vai inteira: as demandas são de uma solicitação só e trazem
 * todas as dela que estão na fila (dono, 18/11/2026).
 */
async function assertWholeRequest(demands: readonly Request[]) {
  const keys = new Set(demands.map(requestKey));
  if (keys.size > 1) throw new PurchaseStrategyError("strategy_same_request");
  const [key] = keys;
  const ids = new Set(demands.map((d) => d.id));
  const left = (await waitingDemands()).filter(
    (r) => requestKey(r) === key && !ids.has(r.id),
  );
  if (left.length) throw new PurchaseStrategyError("strategy_whole_request");
}

export interface StrategyOrigin {
  /** País de origem (chave de `countryKey`); "" = não informado. */
  country: string;
  countryName: string;
  /** Família ("fm:<NOME>" ou "ln:<linha>"); nula = sem família. */
  family: string | null;
  familyName: string | null;
  /** Parceiros do País × Família, por nome. */
  supplierIds: string[];
}

/**
 * Os fornecedores do País × Família da solicitação (dono, 18/11/2026), a
 * lista que a tela mostra marcada para "cotar com outros fornecedores",
 * cada um uma vez só:
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
  const productIds = unique(demands.map((d) => d.productId));
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
  const lineIds = unique<string>([
    ...(familyInfo?.lineIds ?? []),
    ...products.map((p) => p.lineId),
    terms?.productLineId,
  ]);
  const ids = new Set<string>();
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
    for (const l of links) ids.add(l.partyId);
  }
  if (lineIds.length) {
    const ofFamily = await listColumns(store, "products", ["supplierId"], {
      filter: { lineId: lineIds, active: true },
    }).catch(() => []);
    for (const p of ofFamily) if (p.supplierId) ids.add(p.supplierId);
  }
  if (productIds.length) {
    const links = await store
      .list("product_suppliers", { filter: { productId: productIds } })
      .catch(() => []);
    for (const l of links) ids.add(l.supplierId);
  }
  const parties = ids.size
    ? await store.list("parties", { filter: { id: [...ids] } })
    : [];
  const supplierIds = parties
    .filter(
      (p) =>
        p.active &&
        servesFamilies(p.type) &&
        (!country || countryKey(p.country) === country),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt"))
    .map((p) => p.id);
  return { country, countryName, family, familyName, supplierIds };
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
 * O Comprador escolhe a estratégia para as demandas marcadas (mesmo produto
 * ou mesma linha). "Fornecedor da última compra" só com um produto e com
 * compra anterior. A escolha vai para a aprovação da Diretoria de compras.
 */
export async function chooseStrategy(
  user: User,
  input: {
    demandIds: string[];
    choice: PurchaseDecisionChoice;
    note: string | null;
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
  for (const d of demands) {
    if (awaitingStrategySend(d))
      throw new PurchaseStrategyError("strategy_demand_not_sent");
    if (!inStrategyQueue(d))
      throw new PurchaseStrategyError("strategy_demand_taken");
  }
  if (demands.some((d) => !d.productId))
    throw new PurchaseStrategyError("strategy_product_missing");
  const productIds = [...new Set(demands.map((d) => d.productId!))];
  const products = await store.list("products", {
    filter: { id: productIds },
  });
  const lineIds = [...new Set(products.map((p) => p.lineId ?? null))];
  // Uma solicitação só, com todos os produtos dela (dono, 18/11/2026).
  await assertWholeRequest(demands);
  const references = await lastPurchases(productIds);
  if (input.choice === "last_supplier") {
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
    `Estratégia nº ${decision.number}: ${label} para ${demands.length} demanda(s) (${demands.map((d) => d.number ?? d.id).join(", ")})`,
  );
  const approvers = await teamHolders("purchaseStrategy.approve");
  if (approvers.length)
    await notify(
      { userIds: approvers.map((u) => u.id) },
      {
        kind: "action",
        link: `/app/purchase-strategy?tab=open#decision-${decision.id}`,
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
  // Encomenda cancelada ou já em outro pedido (dono, 18/11/2026): não
  // aprova; recusar continua valendo (é como a estratégia sai do caminho).
  if (input.approve) await assertDemandsOpen(decision);
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
      link: `/app/purchase-strategy?tab=open#decision-${decision.id}`,
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

/** Encerrar a estratégia parada: o Comprador e a Diretoria de compras (dono, 19/11/2026). */
export const canCloseStrategy = (user: User) =>
  isWellmix(user) &&
  (can(user, "purchaseStrategy.choose") ||
    can(user, "purchaseStrategy.approve"));

/**
 * Encerrar a estratégia (dono, 19/11/2026; docs/PURCHASE_DEMAND.md,
 * "Encerrar a estratégia parada"): a estratégia aprovada que parou porque
 * alguma encomenda foi cancelada ou já está em outro pedido sai de Em
 * andamento sem gerar pedido (situação "closed", Encerrada). As encomendas
 * dela deixam de apontar para a estratégia: a cancelada segue cancelada, a
 * que já está em outro pedido segue nele e as que continuam abertas voltam
 * para a fila da Estratégia, para uma nova escolha (como na recusa). A
 * Auditoria guarda quem encerrou, quando e por quê.
 */
export async function closeStrategy(
  user: User,
  decisionId: string,
  note: string | null,
): Promise<{ decision: PurchaseDecision; reopened: number }> {
  if (!canCloseStrategy(user)) throw new PurchaseStrategyError("forbidden");
  const store = getStore();
  const decision = await store.get("purchase_decisions", decisionId);
  if (!decision) throw new PurchaseStrategyError("not_found");
  // Só a aprovada que ainda não gerou pedido nem abriu a cotação.
  const open =
    decision.status === "approved" &&
    (decision.choice === "last_supplier"
      ? !decision.orderId
      : !decision.quoteId);
  if (!open) throw new PurchaseStrategyError("strategy_not_stopped");
  const demands = await store.list("requests", {
    filter: { id: decision.demandIds },
  });
  const closed = closedDemands(decision, demands);
  // Só a parada: com todas as encomendas abertas, ela segue o caminho dela.
  if (!closed.size) throw new PurchaseStrategyError("strategy_not_stopped");
  const updated = await store.update("purchase_decisions", decision.id, {
    status: "closed",
  });
  let reopened = 0;
  for (const d of demands) {
    if (d.purchaseDecisionId !== decision.id) continue;
    await store.update("requests", d.id, { purchaseDecisionId: null });
    if (!closed.has(d.id)) reopened++;
  }
  const reasons = [...closed.entries()]
    .map(([id, reason]) => {
      const n = demands.find((d) => d.id === id)?.number ?? "—";
      return reason === "cancelled"
        ? `encomenda nº ${n} cancelada`
        : reason === "ordered"
          ? `encomenda nº ${n} já em outro pedido`
          : "encomenda não encontrada";
    })
    .join(", ");
  await audit(
    user,
    "purchase_strategy.close",
    "purchase_decision",
    decision.id,
    `Estratégia nº ${decision.number} encerrada sem pedido: ${reasons}${reopened ? `; ${reopened} encomenda(s) de volta à fila` : ""}${note ? `. Observação: ${note}` : ""}`,
    { status: decision.status },
    { status: "closed" },
  );
  if (decision.chosenByUserId !== user.id)
    await notify(
      { userIds: [decision.chosenByUserId] },
      {
        kind: "alert",
        link: "/app/purchase-strategy",
        subject: `Estratégia de compra nº ${decision.number} encerrada`,
        body: `Encerrada sem pedido: ${reasons}.${note ? ` ${note}` : ""}`,
      },
    );
  return { decision: updated, reopened };
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
    /**
     * O que a tela mostrou por produto (caixas master, inner e cubagem;
     * `packingSeal`). Ausente: não confere (chamadas sem a tela).
     */
    seals?: Record<string, string>;
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
  // Encomenda cancelada ou já em outro pedido (dono, 18/11/2026): o pedido
  // não sai (nem volta a encomenda cancelada para "pedido" nem reserva).
  await assertDemandsOpen(decision, demands);
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
  // Embalagem conferida no servidor (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
  // "Embalagem e cubagem na Estratégia"): a mesma conta da tela, com a
  // embalagem de agora. Se o que a tela mostrou mudou, nada é criado.
  const packing = await import("./strategy-packing");
  const packed = packing.linePackings(
    demands,
    await packing.demandPackings(user, demands),
  );
  const packingNotes: string[] = [];
  for (const line of lines) {
    const pack = packed.find((p) => p.productId === line.productId);
    if (!pack) continue;
    const seen = input.seals?.[line.productId];
    if (seen !== undefined && seen !== packing.lineSeal(pack, line.quantity))
      throw new PurchaseStrategyError("strategy_packing_changed");
    const totals = packing.lineTotals(pack, line.quantity);
    packingNotes.push(
      `${line.quantity} peças: ${totals?.masterBoxes ?? "—"} caixas master, ${totals?.innerBoxes ?? "—"} caixas inner, ${totals?.cbm ?? "—"} m³`,
    );
  }
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
    `Estratégia nº ${decision.number}: pedido de compra #${order.number}${packingNotes.length ? ` (${packingNotes.join("; ")})` : ""}`,
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

/**
 * A estratégia segue só com todas as encomendas abertas (dono, 18/11/2026):
 * encomenda cancelada ou já em outro pedido barra a aprovação e o pedido.
 */
async function assertDemandsOpen(
  decision: PurchaseDecision,
  demands?: readonly Request[],
): Promise<void> {
  const rows =
    demands ??
    (await getStore().list("requests", {
      filter: { id: decision.demandIds },
    }));
  if (closedDemands(decision, rows).size)
    throw new PurchaseStrategyError("strategy_demand_closed");
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
  const waiting = openRequests.filter(inStrategyQueue);
  const decisions = await getStore()
    .list("purchase_decisions", { filter: { status: ["pending", "approved"] } })
    .catch(() => [] as PurchaseDecision[]);
  type Draft = {
    kind:
      | "purchase_strategy"
      | "purchase_strategy_approve"
      | "purchase_strategy_order"
      | "purchase_strategy_send";
    title: string;
    detail: string;
    text: TaskText;
    link: string;
    dueAt: string | null;
    customerId?: string | null;
    ownerUserId?: string | null;
  };
  // Título e detalhe por chave e valores: a tela traduz no idioma de quem lê
  // (`Task.text`); `title` e `detail` ficam em português para quem não traduz.
  const ptText = translator("pt");
  const draft = (d: Omit<Draft, "title" | "detail">): Draft => {
    const values = taskTextValues(ptText, d.text);
    return {
      ...d,
      title: ptText(d.text.title, values),
      detail: ptText(d.text.detail, values),
    };
  };
  const drafts: Draft[] = waiting.map((r) =>
    draft({
      kind: "purchase_strategy",
      text: {
        title: "strategy.task.choose.title",
        detail:
          demandKind(r) === "replenishment"
            ? "strategy.task.choose.detail.replenishment"
            : "strategy.task.choose.detail.order",
        values: { product: r.productName, unit: r.unit },
        numbers: { quantity: r.quantity },
      },
      link: "/app/purchase-strategy",
      dueAt: null,
      customerId: r.customerId,
      ownerUserId: r.ownerUserId ?? null,
    }),
  );
  // Estratégia com encomenda cancelada ou já em outro pedido (dono,
  // 18/11/2026): não gera o pedido, então a pendência "Gerar pedido" some.
  const toOrder = decisions.filter(
    (d) => d.status !== "pending" && d.choice === "last_supplier" && !d.orderId,
  );
  const orderDemandIds = unique(toOrder.flatMap((d) => d.demandIds));
  const orderDemands = orderDemandIds.length
    ? await listColumns(getStore(), "requests", ["status", "orderId"], {
        filter: { id: orderDemandIds },
      }).catch(() => null)
    : [];
  for (const d of decisions) {
    const values = { n: d.number };
    if (
      toOrder.includes(d) &&
      orderDemands &&
      closedDemands(d, orderDemands).size
    )
      continue;
    if (d.status === "pending")
      drafts.push(
        draft({
          kind: "purchase_strategy_approve",
          text: {
            title: "strategy.task.approve.title",
            detail:
              d.choice === "last_supplier"
                ? "strategy.choice.last_supplier"
                : "strategy.choice.quote",
            values,
          },
          link: `/app/purchase-strategy?tab=open#decision-${d.id}`,
          dueAt: null,
        }),
      );
    else if (d.choice === "last_supplier" && !d.orderId)
      drafts.push(
        draft({
          kind: "purchase_strategy_order",
          text: {
            title: "strategy.task.order.title",
            detail: "strategy.choice.last_supplier",
            values,
          },
          link: `/app/purchase-strategy?tab=open#decision-${d.id}`,
          dueAt: null,
        }),
      );
  }
  // Envio com parceiro sem receber (dono, 18/11/2026): regularizar e "Tentar
  // de novo" no resultado do envio.
  for (const send of await sendsWithFailures())
    drafts.push(
      draft({
        kind: "purchase_strategy_send",
        text: {
          title: "strategy.task.send.title",
          detail: "strategy.task.send.detail",
          values: { n: send.number, count: pendingRecipients(send) },
        },
        link: `/app/purchase-strategy/sends/${send.id}`,
        dueAt: null,
        // Envio automático (cliente confirmou): de quem escolhe a estratégia.
        ownerUserId:
          send.createdByUserId === AUTO_ACTOR_ID ? null : send.createdByUserId,
      }),
    );
  return drafts;
}

/* ------------------------------------------------------------------------ */
/* Estratégia de Compra por produto (dono, 18/11/2026)                      */
/* docs/PURCHASE_DEMAND.md, "Estratégia de Compra por produto"              */
/* ------------------------------------------------------------------------ */

const unique = <T>(list: readonly (T | null | undefined)[]): T[] => [
  ...new Set(list.filter((x): x is T => x !== null && x !== undefined)),
];

/**
 * Encomendas → "Enviar para cotação": as encomendas marcadas que podem ir
 * (situação Solicitado, ainda não enviadas, visíveis para quem envia) entram
 * na fila da Estratégia de Compra, com os outros produtos da mesma
 * solicitação (dono, 18/11/2026). As outras são contadas e ficam como estão.
 */
export async function sendToStrategy(
  user: User,
  ids: readonly string[],
): Promise<{ sent: Request[]; skipped: number }> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  assertScreen(user, "requests");
  const store = getStore();
  const wanted = unique(ids);
  const picked = wanted.length
    ? await store.list("requests", { filter: { id: wanted } })
    : [];
  // A solicitação vai inteira (dono, 18/11/2026): um produto marcado leva
  // os outros do mesmo lote que ainda esperam o envio.
  const groupIds = unique(picked.map((r) => r.groupId));
  const siblings = groupIds.length
    ? await store.list("requests", { filter: { groupId: groupIds } })
    : [];
  const rows = [
    ...picked,
    ...siblings.filter((r) => !picked.some((p) => p.id === r.id)),
  ];
  const now = new Date().toISOString();
  const sent: Request[] = [];
  for (const r of rows) {
    if (!canViewRequest(user, r) || !awaitingStrategySend(r)) continue;
    const updated = await store.update("requests", r.id, {
      strategySentAt: now,
      strategySentByUserId: user.id,
    });
    await audit(
      user,
      "purchase_strategy.send_request",
      "request",
      r.id,
      `Encomenda nº ${r.number ?? "—"} (${r.productName}) enviada para cotação: entrou na Estratégia de Compra`,
      { strategySentAt: null },
      { strategySentAt: now },
    );
    sent.push(updated);
  }
  if (sent.length) {
    const strategists = (await teamHolders("purchaseStrategy.choose")).filter(
      (u) => u.id !== user.id,
    );
    if (strategists.length)
      await notify(
        { userIds: strategists.map((u) => u.id) },
        {
          kind: "action",
          link: "/app/purchase-strategy",
          subject: `${sent.length} produto(s) enviado(s) para a Estratégia de Compra`,
          body: sent
            .map((r) => `nº ${r.number ?? "—"} ${r.productName}`)
            .join(", ")
            .slice(0, 500),
        },
      );
  }
  return {
    sent,
    skipped: picked.filter((r) => !sent.some((x) => x.id === r.id)).length,
  };
}

/**
 * Pedido confirmado pelo cliente (venda pela Wellmix): entra na fila da
 * Estratégia de Compra na hora, sem o "Enviar para cotação" (dono,
 * 22/11/2026), e a cotação sai sozinha para o fornecedor da última compra e
 * os parceiros da família (`autoQuoteConfirmed`, dono, 22/11/2026), que grava
 * a entrada e avisa o Comprador. O que ela não trata (produto fora do
 * catálogo, ou erro antes de começar) só entra na fila: grava a data da
 * entrada e avisa quem escolhe a estratégia, como antes.
 */
export async function enterStrategyOnConfirm(
  user: User,
  confirmed: readonly Request[],
): Promise<Request[]> {
  const store = getStore();
  const outcomes = await autoQuoteConfirmed(confirmed).catch((error) => {
    console.error("[strategy] cotação na confirmação do cliente", error);
    return [] as AutoQuoteOutcome[];
  });
  const handled = new Set(
    outcomes.flatMap((o) =>
      o.state === "sent"
        ? o.send.lines.flatMap((l) => l.demandIds ?? [l.demandId])
        : o.demandIds,
    ),
  );
  const now = new Date().toISOString();
  const entered: Request[] = [];
  for (const confirmedRow of confirmed) {
    if (handled.has(confirmedRow.id)) continue;
    // Lida de novo: a cotação automática pode ter gravado a entrada.
    const r = (await store.get("requests", confirmedRow.id)) ?? confirmedRow;
    if (r.strategySentAt || !inStrategyQueue(r)) continue;
    const updated = await store.update("requests", r.id, {
      strategySentAt: now,
      strategySentByUserId: user.id,
    });
    await audit(
      user,
      "purchase_strategy.send_request",
      "request",
      r.id,
      `Encomenda nº ${r.number ?? "—"} (${r.productName}) confirmada pelo cliente: entrou direto na Estratégia de Compra`,
      { strategySentAt: null },
      { strategySentAt: now },
    );
    entered.push(updated);
  }
  if (entered.length) {
    const strategists = await teamHolders("purchaseStrategy.choose");
    if (strategists.length)
      await notify(
        { userIds: strategists.map((u) => u.id) },
        {
          kind: "action",
          link: "/app/purchase-strategy",
          subject: `${entered.length} produto(s) confirmado(s) pelo cliente na Estratégia de Compra`,
          body: entered
            .map((r) => `nº ${r.number ?? "—"} ${r.productName}`)
            .join(", ")
            .slice(0, 500),
        },
      );
  }
  return entered;
}

/**
 * A encomenda entra na fila da Estratégia de Compra na hora em que chega à
 * Wellmix (criada pelo cliente ou confirmada por ele), sem o "Enviar para
 * cotação" (dono, 22/11/2026). Grava a data da entrada; o aviso à Wellmix é
 * o da encomenda nova (`releaseRequest`).
 */
export async function enterStrategy(
  user: User,
  request: Request,
): Promise<Request> {
  // Encomenda que vira cotação na hora (dono, 22/11/2026): quem grava a
  // entrada é a cotação automática (`quoteNewDemands`, "Virou cotação
  // sozinha"); aqui fica só a de produto fora do catálogo.
  if (request.productId && (await getSettings()).autoQuoteOrders)
    return request;
  if (
    request.strategySentAt ||
    // A confirmada pelo cliente segue pela cotação automática
    // (`enterStrategyOnConfirm`), que grava a entrada.
    request.orderTerms?.confirmation ||
    demandKind(request) !== "order" ||
    !inStrategyQueue(request)
  )
    return request;
  const now = new Date().toISOString();
  const updated = await getStore().update("requests", request.id, {
    strategySentAt: now,
    strategySentByUserId: user.id,
  });
  await audit(
    user,
    "purchase_strategy.send_request",
    "request",
    request.id,
    `Encomenda nº ${request.number ?? "—"} (${request.productName}): entrou direto na Estratégia de Compra`,
    { strategySentAt: null },
    { strategySentAt: now },
  );
  return updated;
}

/** Uma linha da Estratégia de Compra: um produto de uma demanda. */
export interface StrategyLine {
  demand: Request;
  /** A solicitação da demanda (`requestKey`): a estratégia é dela inteira. */
  groupKey: string;
  kind: "order" | "replenishment";
  customerName: string | null;
  /** Produtos do mesmo lote (encomenda com vários produtos). */
  batchSize: number;
  /** A família da linha do produto, pelo código do Sankhya (docs/PARTNER_FAMILIES.md). */
  family: { key: string; name: string } | null;
  last: LastPurchase | null;
  /** Parceiros que marcaram a família no cadastro ("Grupo de produto (família)"). */
  linkedIds: string[];
  /** Sugeridos pelo histórico (sem vínculo): a última compra, o fornecedor do produto e quem mais forneceu a família. */
  suggestedIds: string[];
}

/**
 * Uma solicitação da fila (dono, 18/11/2026): todos os produtos dela, a
 * escolha é uma só e os destinatários são os do País × Família.
 */
export interface StrategyGroup {
  key: string;
  demandIds: string[];
  countryName: string;
  familyName: string | null;
  /** A última compra comum (todos os produtos do mesmo fornecedor); nula = não vale. */
  last: LastPurchase | null;
  /** Algum produto sem compra anterior (o motivo de não valer a última compra). */
  missingLast: boolean;
  /** Os parceiros do País × Família (`strategySuppliers`), marcados quando aptos. */
  linkedIds: string[];
  /** Sugeridos pelo histórico, fora da lista do País × Família. */
  suggestedIds: string[];
}

/** Destinatários por solicitação (a lista do País × Família pode ser longa). */
export const MAX_RECIPIENTS = 200;

/** Quantos sugeridos do histórico da família cada linha mostra (o resto, pela busca). */
const FAMILY_SUGGESTIONS = 8;

/**
 * A família de cada linha (o "Grupo de produto (família)" do cadastro,
 * docs/PARTNER_FAMILIES.md): o código gravado na linha (calculado pela árvore
 * do Sankhya quando falta), o nome do cadastro de famílias, quem marcou a
 * família e quem mais forneceu produtos das linhas dela.
 */
async function familiesForLines(lineIds: readonly string[]): Promise<{
  ofLine: Map<string, { key: string; name: string }>;
  linked: Map<string, string[]>;
  history: Map<string, string[]>;
}> {
  const store = getStore();
  const ids = unique(lineIds);
  const out = {
    ofLine: new Map<string, { key: string; name: string }>(),
    linked: new Map<string, string[]>(),
    history: new Map<string, string[]>(),
  };
  if (!ids.length) return out;
  const { familyCodesForLines, listProductFamilies } =
    await import("./product-families");
  // Linha ainda sem a família gravada: calculada e gravada (autocorreção).
  await familyCodesForLines(ids).catch(() => [] as string[]);
  const [lines, registry] = await Promise.all([
    listByIds(store, "product_lines", ids),
    listProductFamilies({ includeInactive: true }).catch(() => []),
  ]);
  for (const l of lines)
    if (l.familyCode)
      out.ofLine.set(l.id, {
        key: l.familyCode,
        name:
          registry.find((f) => f.code === l.familyCode)?.name ?? l.familyCode,
      });
  const codes = unique([...out.ofLine.values()].map((f) => f.key));
  if (!codes.length) return out;
  const [links, familyLines] = await Promise.all([
    store
      .list("party_families", { filter: { familyCode: codes } })
      .catch(() => []),
    listColumns(store, "product_lines", ["familyCode"], {
      filter: { familyCode: codes },
    }).catch(() => [] as Array<{ id: string; familyCode?: string | null }>),
  ]);
  for (const l of links)
    out.linked.set(
      l.familyCode,
      unique([...(out.linked.get(l.familyCode) ?? []), l.partyId]),
    );
  // Quem mais forneceu a família: o fornecedor dos produtos ativos das linhas dela.
  const lineFamily = new Map(
    familyLines.map((l) => [l.id, l.familyCode ?? null] as const),
  );
  const products = lineFamily.size
    ? await listColumns(store, "products", ["supplierId", "lineId"], {
        filter: { lineId: [...lineFamily.keys()], active: true },
      }).catch(() => [])
    : [];
  const counts = new Map<string, Map<string, number>>();
  for (const p of products) {
    const code = lineFamily.get(p.lineId);
    if (!code || !p.supplierId) continue;
    const byParty = counts.get(code) ?? new Map<string, number>();
    byParty.set(p.supplierId, (byParty.get(p.supplierId) ?? 0) + 1);
    counts.set(code, byParty);
  }
  for (const [code, byParty] of counts)
    out.history.set(
      code,
      [...byParty]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([id]) => id),
    );
  return out;
}

/**
 * A fila da Estratégia de Compra por produto: cada demanda com o produto, o
 * cliente, a família, a última compra e os parceiros candidatos, mais a
 * conferência de cada candidato (quem recebe e responde; o que falta a quem
 * não pode). `toSend`: encomendas ainda não enviadas para cotação.
 */
export async function strategyBoard(t: Translate): Promise<{
  lines: StrategyLine[];
  groups: StrategyGroup[];
  checks: Map<string, RecipientCheck>;
  toSend: number;
}> {
  const store = getStore();
  const requested = await store.list("requests", {
    filter: { status: "REQUESTED" },
    orderBy: "createdAt",
  });
  const waiting = requested.filter(inStrategyQueue);
  const toSend = requested.filter(awaitingStrategySend).length;
  const productIds = unique(waiting.map((d) => d.productId));
  const [products, customers, references, productLinks] = await Promise.all([
    listByIds(store, "products", productIds),
    listByIds(store, "parties", unique(waiting.map((d) => d.customerId))),
    lastPurchases(productIds),
    productIds.length
      ? store
          .list("product_suppliers", { filter: { productId: productIds } })
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const families = await familiesForLines(products.map((p) => p.lineId));
  const groupIds = unique(waiting.map((d) => d.groupId));
  const groupRows = groupIds.length
    ? await listColumns(store, "requests", ["groupId"], {
        filter: { groupId: groupIds },
      })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const lines: StrategyLine[] = waiting.map((d) => {
    const product = d.productId ? productById.get(d.productId) : null;
    const family = product
      ? (families.ofLine.get(product.lineId) ?? null)
      : null;
    const last = d.productId ? (references.get(d.productId) ?? null) : null;
    const linkedIds = family ? (families.linked.get(family.key) ?? []) : [];
    const suggestedIds = unique([
      last?.supplierId,
      product?.supplierId,
      ...productLinks
        .filter((l) => l.productId === d.productId)
        .map((l) => l.supplierId),
      ...(family
        ? (families.history.get(family.key) ?? []).slice(0, FAMILY_SUGGESTIONS)
        : []),
    ]).filter((id) => !linkedIds.includes(id));
    return {
      demand: d,
      groupKey: requestKey(d),
      kind: demandKind(d) === "replenishment" ? "replenishment" : "order",
      customerName: customers.find((c) => c.id === d.customerId)?.name ?? null,
      batchSize: d.groupId
        ? groupRows.filter((g) => g.groupId === d.groupId).length
        : 1,
      family,
      last,
      linkedIds,
      suggestedIds,
    };
  });
  // Item de book (dono, 26/11/2026): a Família do produto da capa do book
  // dá o nome no cartão e sugere os parceiros da família (sem marcar).
  const bookLotIds = unique(
    waiting.map((d) => d.bookingSource?.bookingLotId ?? null),
  );
  const bookLots = bookLotIds.length
    ? await listByIds(store, "booking_lots", bookLotIds)
    : [];
  const bookFamilyCodes = unique(bookLots.map((l) => l.familyCode ?? null));
  const [bookFamilies, bookFamilyLinks] = bookFamilyCodes.length
    ? await Promise.all([
        store
          .list("product_families", { filter: { code: bookFamilyCodes } })
          .catch(() => []),
        store
          .list("party_families", { filter: { familyCode: bookFamilyCodes } })
          .catch(() => []),
      ])
    : [[], []];
  const bookFamilyOf = (d: Request) => {
    const code =
      bookLots.find((l) => l.id === d.bookingSource?.bookingLotId)
        ?.familyCode ?? null;
    return code
      ? {
          code,
          name: bookFamilies.find((f) => f.code === code)?.name ?? code,
          partyIds: bookFamilyLinks
            .filter((l) => l.familyCode === code)
            .map((l) => l.partyId),
        }
      : null;
  };
  // Por solicitação (dono, 18/11/2026): os produtos juntos, a última compra
  // comum e os parceiros do País × Família.
  const byKey = new Map<string, StrategyLine[]>();
  for (const line of lines)
    byKey.set(line.groupKey, [...(byKey.get(line.groupKey) ?? []), line]);
  const groups: StrategyGroup[] = await Promise.all(
    [...byKey.entries()].map(async ([key, members]) => {
      const demands = members.map((m) => m.demand);
      const productIdsHere = unique(demands.map((d) => d.productId));
      const origin = demands.every((d) => d.productId)
        ? await strategySuppliers(demands).catch(() => null)
        : null;
      // Item de book enviado pelo parceiro (dono, 26/11/2026): quem mandou
      // o book já vem marcado (a busca acrescenta outros).
      const bookPartners = unique(
        demands.map((d) => d.bookingSource?.partnerId ?? null),
      );
      const linkedIds = unique([
        ...bookPartners,
        ...(origin?.supplierIds ?? []),
      ]);
      const bookFamily = demands
        .map(bookFamilyOf)
        .find((f): f is NonNullable<ReturnType<typeof bookFamilyOf>> => !!f);
      const same = sameLastSupplier(productIdsHere, references);
      return {
        key,
        demandIds: demands.map((d) => d.id),
        countryName: origin?.countryName ?? "",
        familyName:
          origin?.familyName ??
          members.find((m) => m.family)?.family?.name ??
          (bookFamily
            ? `${bookFamily.name} · ${t("partyFamilies.code", { code: bookFamily.code })}`
            : null),
        last: same ? (references.get(productIdsHere[0]) ?? null) : null,
        // Item de book (sem produto): não há compra anterior.
        missingLast:
          demands.some((d) => !d.productId) ||
          productIdsHere.some((id) => !references.get(id)),
        linkedIds,
        suggestedIds: unique([
          ...members.flatMap((m) => [...m.linkedIds, ...m.suggestedIds]),
          ...(bookFamily?.partyIds ?? []),
        ]).filter((id) => !linkedIds.includes(id)),
      };
    }),
  );
  const { checkRecipients } = await import("./purchase-recipients");
  const checks = await checkRecipients(
    unique([
      ...lines.flatMap((l) => [...l.linkedIds, ...l.suggestedIds]),
      ...groups.flatMap((g) => [...g.linkedIds, ...g.suggestedIds]),
    ]),
    t,
  );
  // Sugestão só de quem cota (o fornecedor do produto pode ser de outro tipo).
  for (const line of lines)
    line.suggestedIds = line.suggestedIds.filter((id) =>
      receivesQuote(checks.get(id)?.type),
    );
  for (const group of groups)
    group.suggestedIds = group.suggestedIds.filter((id) =>
      receivesQuote(checks.get(id)?.type),
    );
  return { lines, groups, checks, toSend };
}

export interface StrategySendInput {
  lines: Array<{
    /** As demandas da solicitação (todas; dono, 18/11/2026). */
    demandIds?: string[];
    /** Antes: uma demanda por linha (vale como solicitação de um produto). */
    demandId?: string;
    choice: StrategyLineChoice;
    recipientIds: string[];
  }>;
  note: string | null;
}

/**
 * Erros que não têm mais o que tentar: a cotação já foi encerrada (vencedora
 * escolhida, cancelada) ou a demanda já está em outra estratégia.
 */
const FINAL_ERRORS = new Set(["quote_closed", "strategy_demand_taken"]);

/** Ainda dá para receber: ficou de fora ou deu erro, com a cotação em aberto. */
const actionable = (r: StrategySendRecipient) =>
  r.status === "blocked" ||
  (r.status === "failed" && !FINAL_ERRORS.has(r.error ?? ""));

/** A linha que nem virou estratégia e ainda pode ser refeita. */
const lineRetryable = (l: StrategySendLine) =>
  !!l.error && !l.decisionId && !FINAL_ERRORS.has(l.error);

const sendStatus = (lines: readonly StrategySendLine[]) =>
  lines.some(
    (l) =>
      lineRetryable(l) ||
      (!!l.error && !FINAL_ERRORS.has(l.error)) ||
      l.recipients.some(actionable),
  )
    ? ("failures" as const)
    : ("ok" as const);

/** Parceiros que ainda podem receber (ficaram de fora ou deram erro). */
export const pendingRecipients = (send: Pick<PurchaseStrategySend, "lines">) =>
  send.lines.reduce(
    (sum, l) => sum + l.recipients.filter(actionable).length,
    0,
  );

/** Alguém ficou sem receber de vez (a cotação encerrou antes)? */
export const closedRecipients = (send: Pick<PurchaseStrategySend, "lines">) =>
  send.lines.reduce(
    (sum, l) =>
      sum +
      l.recipients.filter(
        (r) => r.status === "failed" && FINAL_ERRORS.has(r.error ?? ""),
      ).length,
    0,
  );

/** O envio ainda tem o que tentar de novo ("Tentar de novo" e a pendência)? */
export const sendRetryable = (send: Pick<PurchaseStrategySend, "lines">) =>
  send.lines.some((l) => lineRetryable(l) || l.recipients.some(actionable));

const choiceLabel = (choice: PurchaseDecisionChoice) =>
  choice === "last_supplier"
    ? "pedido direto com o fornecedor da última compra"
    : choice === "quote_last"
      ? "cotar com o fornecedor da última compra"
      : "cotar com outros fornecedores";

const blockedResult = (
  check: RecipientCheck | undefined,
  partyId: string,
  at: string,
): StrategySendRecipient => ({
  partyId,
  status: "blocked",
  reasons: check ? [...check.issues] : ["not_quote_type"],
  error: null,
  logins: 0,
  at,
});

/**
 * Executa uma linha do envio: a estratégia (uma por produto), a cotação com
 * os parceiros aptos e o resultado de cada destinatário. O pedido direto vai
 * para a aprovação da Diretoria de compras, como antes.
 */
async function runLine(
  /** Nulo = o portal sozinho (cotação na confirmação do cliente). */
  actor: User | null,
  sendId: string,
  sendNumber: number,
  line: StrategySendLine,
  demands: readonly Request[],
  references: ReadonlyMap<string, LastPurchase>,
  checks: Map<string, RecipientCheck>,
  note: string | null,
): Promise<StrategySendLine> {
  const store = getStore();
  const now = new Date();
  const at = now.toISOString();
  // A solicitação inteira numa estratégia só (dono, 18/11/2026).
  const productIds = unique(demands.map((d) => d.productId));
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const lineIds = unique(products.map((p) => p.lineId));
  const first = demands[0];
  const reference = productIds
    .map((id) => references.get(id))
    .filter((r): r is LastPurchase => !!r);
  const quotes = choiceQuotes(line.choice);
  const decision = await store.create("purchase_decisions", {
    number: await store.nextNumber("purchase_decision_number"),
    productId: productIds.length === 1 ? productIds[0] : null,
    lineId: lineIds.length === 1 ? lineIds[0] : null,
    demandIds: demands.map((d) => d.id),
    quantity: demands.reduce((sum, d) => sum + d.quantity, 0),
    choice: line.choice,
    reference,
    note,
    // Cotar não passa mais pela aprovação (D2): a Diretoria aprova a
    // vencedora. O pedido direto continua com a aprovação de antes.
    status: quotes ? "approved" : "pending",
    chosenByUserId: actor?.id ?? AUTO_ACTOR_ID,
    chosenAt: at,
    approvedByUserId: null,
    approvedAt: quotes ? at : null,
    approvalNote: quotes
      ? "Sem aprovação antes da cotação (dono, 18/11/2026)."
      : null,
    orderId: null,
    quoteId: null,
    recipientIds: quotes ? line.recipientIds : null,
    sendId,
  });
  for (const d of demands)
    await store.update("requests", d.id, {
      purchaseDecisionId: decision.id,
    });
  await audit(
    actor,
    "purchase_strategy.choose",
    "purchase_decision",
    decision.id,
    `Estratégia nº ${decision.number}: ${choiceLabel(line.choice)} para a solicitação nº ${first.number ?? first.id}, ${demands.length} produto(s) (envio nº ${sendNumber})`,
  );
  if (!quotes) {
    const approvers = await teamHolders("purchaseStrategy.approve");
    if (approvers.length)
      await notify(
        { userIds: approvers.map((u) => u.id) },
        {
          kind: "action",
          link: `/app/purchase-strategy?tab=open#decision-${decision.id}`,
          subject: `Aprovar estratégia de compra nº ${decision.number}`,
          body: `Pedido direto com o fornecedor da última compra: ${demands.map((d) => d.productName).join(", ")}.`,
        },
      );
    return { ...line, decisionId: decision.id, error: null, recipients: [] };
  }
  const okIds = line.recipientIds.filter((id) => checks.get(id)?.ok);
  const { openQuoteWithRecipients } = await import("./purchase-quote");
  let opened: Awaited<ReturnType<typeof openQuoteWithRecipients>>;
  try {
    // Envio automático: o aviso da cotação sem convite é o da encomenda
    // (`notifyAutoQuote`), com o motivo; o "sem resposta" genérico fica.
    opened = await openQuoteWithRecipients(actor, decision, okIds, now, {
      quietEmpty: !actor,
    });
  } catch (error) {
    // A estratégia ficou gravada; a cotação, não: o "Tentar de novo" retoma.
    console.error("[strategy] cotação do envio", error);
    return {
      ...line,
      decisionId: decision.id,
      error: "strategy_send_failed",
      recipients: line.recipientIds.map((id) =>
        checks.get(id)?.ok
          ? {
              partyId: id,
              status: "failed" as const,
              reasons: [],
              error: "strategy_send_failed",
              logins: 0,
              at,
            }
          : blockedResult(checks.get(id), id, at),
      ),
    };
  }
  const { quote, results } = opened;
  const recipients = line.recipientIds.map((id): StrategySendRecipient => {
    const result = results.find((r) => r.partyId === id);
    if (!result) return blockedResult(checks.get(id), id, at);
    return {
      partyId: id,
      status: result.status,
      reasons: [],
      error: result.error,
      logins: result.logins,
      at,
    };
  });
  return {
    ...line,
    decisionId: decision.id,
    quoteId: quote.id,
    error: null,
    recipients,
  };
}

/**
 * Confirma o envio da Estratégia de Compra: por produto, a escolha e os
 * destinatários. Cada cotação precisa de pelo menos um parceiro apto; quem
 * tem pendência fica de fora (aparece no resultado e pode receber depois com
 * "Tentar de novo").
 */
export async function sendStrategy(
  user: User,
  input: StrategySendInput,
  t: Translate,
): Promise<PurchaseStrategySend> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  assertCan(user, "purchaseStrategy.choose");
  assertScreen(user, "purchaseStrategy");
  if (!input.lines.length)
    throw new PurchaseStrategyError("strategy_send_empty");
  const idsOf = (l: StrategySendInput["lines"][number]) =>
    unique(l.demandIds?.length ? l.demandIds : [l.demandId]);
  const demandIds = input.lines.flatMap(idsOf);
  if (!demandIds.length) throw new PurchaseStrategyError("strategy_send_empty");
  if (new Set(demandIds).size !== demandIds.length)
    throw new PurchaseStrategyError("strategy_line_duplicated");
  const store = getStore();
  const demands = await store.list("requests", { filter: { id: demandIds } });
  if (demands.length !== demandIds.length)
    throw new PurchaseStrategyError("not_found");
  for (const d of demands) {
    if (awaitingStrategySend(d))
      throw new PurchaseStrategyError("strategy_demand_not_sent");
    if (!inStrategyQueue(d))
      throw new PurchaseStrategyError("strategy_demand_taken");
    // Sem produto, só o item de book enviado pelo parceiro (dono,
    // 26/11/2026): a cotação de compra o aceita pela chave da demanda.
    if (!d.productId && !isBookDemand(d))
      throw new PurchaseStrategyError("strategy_product_missing");
  }
  const references = await lastPurchases(
    unique(demands.map((d) => d.productId)),
  );
  const demandsOf = (ids: readonly string[]) =>
    ids.map((id) => demands.find((d) => d.id === id)!);
  const lines: StrategySendLine[] = [];
  for (const l of input.lines) {
    const mine = demandsOf(idsOf(l));
    // A solicitação vai inteira, numa escolha só (dono, 18/11/2026).
    await assertWholeRequest(mine);
    const productIds = unique(mine.map((d) => d.productId));
    // Item de book: não há última compra nem pedido direto; só cotar.
    if (mine.some(isBookDemand) && l.choice !== "quote")
      throw new PurchaseStrategyError("strategy_book_quote_only");
    if (l.choice === "quote_last" || l.choice === "last_supplier") {
      if (productIds.some((id) => !references.get(id)))
        throw new PurchaseStrategyError("strategy_no_last_purchase");
      if (!sameLastSupplier(productIds, references))
        throw new PurchaseStrategyError("strategy_last_same_supplier");
    }
    const ref = references.get(productIds[0]) ?? null;
    const recipientIds =
      l.choice === "quote_last"
        ? [ref!.supplierId]
        : l.choice === "quote"
          ? unique(l.recipientIds).slice(0, MAX_RECIPIENTS)
          : [];
    if (l.choice === "quote" && !recipientIds.length)
      throw new PurchaseStrategyError("strategy_send_recipients");
    lines.push({
      demandId: mine[0].id,
      demandIds: mine.map((d) => d.id),
      productId: productIds[0] ?? quoteItemKey(mine[0]) ?? "",
      choice: l.choice,
      recipientIds,
      decisionId: null,
      quoteId: null,
      error: null,
      recipients: [],
    });
  }
  const { checkRecipients } = await import("./purchase-recipients");
  const checks = await checkRecipients(
    unique(lines.flatMap((l) => l.recipientIds)),
    t,
  );
  for (const line of lines) {
    if (!choiceQuotes(line.choice)) continue;
    if (line.recipientIds.some((id) => !receivesQuote(checks.get(id)?.type)))
      throw new PurchaseStrategyError("strategy_recipient_type");
    if (!line.recipientIds.some((id) => checks.get(id)?.ok))
      throw new PurchaseStrategyError("strategy_send_no_ok_recipient");
  }
  return executeSend(user, lines, demands, references, checks, input.note);
}

/**
 * Grava o envio e executa cada linha (a estratégia, a cotação e o resultado
 * de cada destinatário). As linhas já vêm conferidas: pelo `sendStrategy`
 * (o Comprador) ou pela cotação da confirmação do cliente (o portal sozinho,
 * `actor` nulo).
 */
async function executeSend(
  actor: User | null,
  lines: StrategySendLine[],
  demands: readonly Request[],
  references: ReadonlyMap<string, LastPurchase>,
  checks: Map<string, RecipientCheck>,
  note: string | null,
): Promise<PurchaseStrategySend> {
  const store = getStore();
  const demandsOf = (ids: readonly string[]) =>
    ids.map((id) => demands.find((d) => d.id === id)!);
  const now = new Date().toISOString();
  const send = await store.create("purchase_strategy_sends", {
    number: await store.nextNumber("purchase_strategy_send_number"),
    status: "ok",
    lines,
    createdByUserId: actor?.id ?? AUTO_ACTOR_ID,
    lastRunAt: now,
    runs: 0,
  });
  const done: StrategySendLine[] = [];
  for (const line of lines) {
    try {
      done.push(
        await runLine(
          actor,
          send.id,
          send.number,
          line,
          demandsOf(line.demandIds ?? [line.demandId]),
          references,
          checks,
          note,
        ),
      );
    } catch (error) {
      console.error("[strategy] envio", error);
      done.push({
        ...line,
        error:
          error instanceof PurchaseStrategyError
            ? error.message
            : "strategy_send_failed",
      });
    }
  }
  const saved = await store.update("purchase_strategy_sends", send.id, {
    lines: done,
    status: sendStatus(done),
    runs: 1,
    lastRunAt: new Date().toISOString(),
  });
  const sentCount = done.reduce(
    (sum, l) => sum + l.recipients.filter((r) => r.status === "sent").length,
    0,
  );
  const products = done.reduce(
    (sum, l) => sum + (l.demandIds ?? [l.demandId]).length,
    0,
  );
  await audit(
    actor,
    "purchase_strategy.send",
    "purchase_strategy_send",
    send.id,
    `Envio nº ${send.number} da Estratégia de Compra${actor ? "" : " (automático: a encomenda virou cotação sozinha)"}: ${done.length} solicitação(ões), ${products} produto(s), ${sentCount} convite(s) enviado(s), ${pendingRecipients(saved)} parceiro(s) sem receber`,
  );
  return saved;
}

/* ------------------------------------------------------------------------ */
/* Cotação na confirmação do cliente (dono, 22/11/2026)                     */
/* docs/PURCHASE_DEMAND.md, "Cotação na confirmação do cliente"             */
/* ------------------------------------------------------------------------ */

/** A observação da estratégia que o portal escolhe sozinho. */
export const AUTO_QUOTE_NOTE =
  "Envio automático: a encomenda virou cotação sozinha (dono, 22/11/2026).";

/** O que aconteceu com cada solicitação confirmada pelo cliente. */
export type AutoQuoteOutcome =
  | { state: "sent"; requestKey: string; send: PurchaseStrategySend }
  | {
      state: "queued";
      requestKey: string;
      /** Por que a cotação não saiu sozinha (código de `autoQuote.reason.*`). */
      reason: string;
      demandIds: string[];
    };

/**
 * Os destinatários da cotação automática (dono, 22/11/2026): o fornecedor da
 * última compra de cada produto, primeiro, e todos os parceiros da família
 * (a lista do País × Família da tela, `strategySuppliers`), cada um uma vez
 * só e só dos tipos que cotam. Quem não está apto (sem login, inativo)
 * continua na lista: fica de fora no resultado do envio, com o motivo, e
 * recebe depois com "Tentar de novo".
 */
export function autoQuoteRecipients(
  lastSupplierIds: readonly (string | null | undefined)[],
  familyIds: readonly string[],
  checks: ReadonlyMap<string, Pick<RecipientCheck, "type">>,
): string[] {
  return unique([...lastSupplierIds, ...familyIds])
    .filter((id) => receivesQuote(checks.get(id)?.type))
    .slice(0, MAX_RECIPIENTS);
}

/**
 * A encomenda vira cotação na hora (dono, 22/11/2026: "quero que já vire
 * cotação, para vários fornecedores... baseado na família, linha, produto",
 * sem a etapa da Wellmix na Estratégia de compra). Vale para a encomenda
 * aberta pelo cliente (a solicitação inteira, `quoteNewDemands`) e para a
 * venda pela Wellmix confirmada por ele (`enterStrategyOnConfirm`). A
 * cotação sai pelo mesmo caminho do envio do Comprador (o resultado por
 * destinatário e o "Tentar de novo") para o fornecedor da última compra e
 * todos os parceiros da família, da linha e do produto. Sem nenhum parceiro
 * apto, a cotação nasce sem convite: o Comprador gera os logins e usa
 * "Tentar de novo", ou convida outros na cotação. Fica na fila da Estratégia
 * só a de produto fora do catálogo (não há o que cotar) e a que deu erro.
 * Desligada nas Configurações (`autoQuoteOrders`), nada sai sozinho e a
 * encomenda espera na Estratégia, como antes. Erro aqui não desfaz a
 * encomenda nem a confirmação.
 */
export async function autoQuoteConfirmed(
  released: readonly Request[],
): Promise<AutoQuoteOutcome[]> {
  const store = getStore();
  if (!(await getSettings()).autoQuoteOrders) return [];
  // Encomenda do cliente ainda sem estratégia, com ou sem a entrada na fila
  // já gravada por outro caminho: a cotação sai do mesmo jeito.
  const candidates = released.filter(
    (r) =>
      r.status === "REQUESTED" &&
      !r.purchaseDecisionId &&
      demandKind(r) === "order" &&
      !isStockCustomer(r.customerId),
  );
  const byKey = new Map<string, Request[]>();
  for (const r of candidates)
    byKey.set(requestKey(r), [...(byKey.get(requestKey(r)) ?? []), r]);
  const t = translator("pt");
  const outcomes: AutoQuoteOutcome[] = [];
  for (const [key, group] of byKey) {
    // Produto fora do catálogo (as antigas): a cotação não tem o que cotar;
    // a encomenda só entra na fila (`enterStrategyOnConfirm`).
    if (group.some((d) => !d.productId)) continue;
    const now = new Date().toISOString();
    // O "Enviar para cotação" sozinho: entra na fila da Estratégia (a que já
    // entrou fica como está).
    const current = await store.list("requests", {
      filter: { id: group.map((d) => d.id) },
    });
    const stamped: Request[] = [];
    for (const r of group) {
      const row = current.find((c) => c.id === r.id) ?? r;
      if (row.strategySentAt) {
        stamped.push(row);
        continue;
      }
      stamped.push(
        await store.update("requests", r.id, {
          strategySentAt: now,
          strategySentByUserId: AUTO_ACTOR_ID,
        }),
      );
      await audit(
        null,
        "purchase_strategy.send_request",
        "request",
        r.id,
        `Encomenda nº ${r.number ?? "—"} (${r.productName}): virou cotação sozinha, sem a Estratégia de Compra`,
        { strategySentAt: null },
        { strategySentAt: now },
      );
    }
    const queued = (reason: string): AutoQuoteOutcome => ({
      state: "queued",
      requestKey: key,
      reason,
      demandIds: stamped.map((d) => d.id),
    });
    try {
      // Lido de novo: outra estratégia pode ter pegado a encomenda.
      const rows = await store.list("requests", {
        filter: { id: stamped.map((d) => d.id) },
      });
      const demands = stamped
        .map((d) => rows.find((r) => r.id === d.id))
        .filter((r): r is Request => !!r);
      if (
        demands.length !== stamped.length ||
        demands.some((d) => !inStrategyQueue(d))
      ) {
        outcomes.push(queued("strategy_demand_taken"));
        continue;
      }
      await assertWholeRequest(demands);
      const productIds = unique(demands.map((d) => d.productId));
      const [references, origin] = await Promise.all([
        lastPurchases(productIds),
        strategySuppliers(demands),
      ]);
      const lastIds = productIds.map((id) => references.get(id)?.supplierId);
      const { checkRecipients } = await import("./purchase-recipients");
      const checks = await checkRecipients(
        unique([...lastIds, ...origin.supplierIds]),
        t,
      );
      const recipientIds = autoQuoteRecipients(
        lastIds,
        origin.supplierIds,
        checks,
      );
      // Sem nenhum apto, a cotação nasce do mesmo jeito, sem convite: quem
      // ficou de fora aparece no resultado e recebe com "Tentar de novo".
      const line: StrategySendLine = {
        demandId: demands[0].id,
        demandIds: demands.map((d) => d.id),
        productId: productIds[0],
        choice: "quote",
        recipientIds,
        decisionId: null,
        quoteId: null,
        error: null,
        recipients: [],
      };
      const send = await executeSend(
        null,
        [line],
        demands,
        references,
        checks,
        AUTO_QUOTE_NOTE,
      );
      outcomes.push({ state: "sent", requestKey: key, send });
    } catch (error) {
      console.error("[strategy] cotação automática da encomenda", error);
      outcomes.push(
        queued(
          error instanceof PurchaseStrategyError
            ? error.message
            : "strategy_send_failed",
        ),
      );
    }
  }
  if (outcomes.length)
    await notifyAutoQuote(outcomes, candidates).catch((error) =>
      console.error("[strategy] aviso da cotação automática", error),
    );
  return outcomes;
}

/**
 * A encomenda aberta pelo cliente vira cotação na hora em que chega à
 * Wellmix (dono, 22/11/2026): a solicitação inteira de uma vez (o lote, no
 * fim da criação; a de um produto só, no `releaseRequest`). A confirmada
 * pelo cliente segue pela `enterStrategyOnConfirm`.
 */
export async function quoteNewDemands(
  requests: readonly Request[],
): Promise<AutoQuoteOutcome[]> {
  const fresh = requests.filter((r) => !r.orderTerms?.confirmation);
  if (!fresh.length) return [];
  return autoQuoteConfirmed(fresh).catch((error) => {
    console.error("[strategy] cotação automática da encomenda", error);
    return [] as AutoQuoteOutcome[];
  });
}

/** Motivos com texto próprio no aviso; os outros saem como erro. */
const AUTO_QUOTE_REASON_KEY = {
  strategy_whole_request: "autoQuote.reason.strategy_whole_request",
} as const;

/**
 * Avisa quem cuida da Estratégia e da cotação (Comprador): a cotação que
 * saiu sozinha (com quantos receberam e quantos ficaram de fora) ou a
 * encomenda que ficou na fila, com o motivo.
 */
async function notifyAutoQuote(
  outcomes: readonly AutoQuoteOutcome[],
  demands: readonly Request[],
) {
  const [strategists, buyers] = await Promise.all([
    teamHolders("purchaseStrategy.choose"),
    teamHolders("purchaseQuote.choose"),
  ]);
  const userIds = unique([...strategists, ...buyers].map((u) => u.id));
  if (!userIds.length) return;
  const customers = await listByIds(
    getStore(),
    "parties",
    unique(demands.map((d) => d.customerId)),
  );
  for (const outcome of outcomes) {
    const mine = demands.filter((d) => requestKey(d) === outcome.requestKey);
    const first = mine[0];
    if (!first) continue;
    const values = {
      n: first.number ?? "—",
      customer: customers.find((c) => c.id === first.customerId)?.name ?? "—",
      products: mine.length,
    };
    if (outcome.state === "sent") {
      const sent = outcome.send.lines.reduce(
        (sum, l) =>
          sum + l.recipients.filter((r) => r.status === "sent").length,
        0,
      );
      const out = pendingRecipients(outcome.send);
      const quoteNumber = outcome.send.lines[0]?.quoteId
        ? (
            await getStore()
              .get("purchase_quotes", outcome.send.lines[0].quoteId)
              .catch(() => null)
          )?.number
        : null;
      // Ninguém pôde receber: a cotação nasceu sem convite (o Comprador gera
      // os logins e usa "Tentar de novo", ou convida outros na cotação).
      const empty = sent === 0;
      await notify(
        { userIds },
        {
          kind: out || empty ? "action" : "info",
          link: `/app/purchase-strategy/sends/${outcome.send.id}`,
          text: (tr) => ({
            subject: tr(
              empty
                ? "autoQuote.notify.empty.subject"
                : "autoQuote.notify.sent.subject",
              { ...values, quote: quoteNumber ?? "—" },
            ),
            body: tr(
              empty
                ? out
                  ? "autoQuote.notify.empty.body"
                  : "autoQuote.notify.empty.bodyNone"
                : out
                  ? "autoQuote.notify.sent.bodyOut"
                  : "autoQuote.notify.sent.body",
              { ...values, sent, out },
            ),
          }),
        },
      );
      continue;
    }
    // Já em outra estratégia: o Comprador não tem o que escolher.
    if (outcome.reason === "strategy_demand_taken") continue;
    const reasonKey =
      AUTO_QUOTE_REASON_KEY[
        outcome.reason as keyof typeof AUTO_QUOTE_REASON_KEY
      ] ?? "autoQuote.reason.other";
    await notify(
      { userIds: strategists.map((u) => u.id) },
      {
        kind: "action",
        link: "/app/purchase-strategy",
        text: (tr) => ({
          subject: tr("autoQuote.notify.queued.subject", values),
          body: tr("autoQuote.notify.queued.body", {
            ...values,
            reason: tr(reasonKey),
          }),
        }),
      },
    );
  }
}

/** O envio (resultado por destinatário); antes do esquema, nenhum. */
export async function getStrategySend(
  id: string,
): Promise<PurchaseStrategySend | null> {
  try {
    return await getStore().get("purchase_strategy_sends", id);
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
}

/** Os envios mais recentes (a tela da Estratégia mostra os últimos). */
export async function recentStrategySends(
  limit = 8,
): Promise<PurchaseStrategySend[]> {
  try {
    return await getStore().list("purchase_strategy_sends", {
      orderBy: "createdAt",
      direction: "desc",
      limit,
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/**
 * Envios com parceiro que ainda pode receber (a pendência "Tentar de novo"):
 * só as linhas com a cotação em aberto (ou ainda por abrir) contam.
 */
async function sendsWithFailures(): Promise<PurchaseStrategySend[]> {
  try {
    const store = getStore();
    const sends = await store.list("purchase_strategy_sends", {
      filter: { status: "failures" },
      orderBy: "createdAt",
      direction: "desc",
      limit: 50,
    });
    const quoteIds = unique(
      sends.flatMap((s) => s.lines.map((l) => l.quoteId)),
    );
    const open = new Set(
      (quoteIds.length
        ? await store.list("purchase_quotes", { filter: { id: quoteIds } })
        : []
      )
        .filter((q) => q.status === "open")
        .map((q) => q.id),
    );
    return sends.filter((s) =>
      s.lines.some(
        (l) =>
          lineRetryable(l) ||
          (l.recipients.some(actionable) &&
            (!l.quoteId || open.has(l.quoteId))),
      ),
    );
  } catch {
    return [];
  }
}

/**
 * "Tentar de novo" no resultado do envio: para quem ficou de fora ou deu
 * erro, confere de novo e convida quem agora está apto. Quem já recebeu não
 * recebe de novo (o convite é um só por cotação e parceiro). A linha que nem
 * chegou a virar estratégia é refeita, se a demanda ainda está na fila.
 */
export async function retryStrategySend(
  user: User,
  sendId: string,
  t: Translate,
): Promise<{ send: PurchaseStrategySend; sentNow: number }> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  assertCan(user, "purchaseStrategy.choose");
  assertScreen(user, "purchaseStrategy");
  const store = getStore();
  const send = await getStrategySend(sendId);
  if (!send) throw new PurchaseStrategyError("strategy_send_not_found");
  const pendingIds = (l: StrategySendLine) =>
    l.recipients.filter(actionable).map((r) => r.partyId);
  if (!sendRetryable(send))
    throw new PurchaseStrategyError("strategy_nothing_to_retry");
  const { checkRecipients } = await import("./purchase-recipients");
  const checks = await checkRecipients(
    unique(send.lines.flatMap((l) => l.recipientIds)),
    t,
  );
  const { createQuoteForDecision, inviteRecipient } =
    await import("./purchase-quote");
  const now = new Date();
  const at = now.toISOString();
  let sentNow = 0;
  const lines: StrategySendLine[] = [];
  for (const line of send.lines) {
    if (lineRetryable(line)) {
      // A linha não chegou a virar estratégia: refaz, se as demandas da
      // solicitação ainda esperam.
      const ids = line.demandIds ?? [line.demandId];
      const demands = await store.list("requests", { filter: { id: ids } });
      if (
        demands.length !== ids.length ||
        demands.some((d) => !inStrategyQueue(d))
      ) {
        lines.push({ ...line, error: "strategy_demand_taken" });
        continue;
      }
      const refs = await lastPurchases(unique(demands.map((d) => d.productId)));
      try {
        const fresh = await runLine(
          user,
          send.id,
          send.number,
          { ...line, error: null },
          ids.map((id) => demands.find((d) => d.id === id)!),
          refs,
          checks,
          null,
        );
        sentNow += fresh.recipients.filter((r) => r.status === "sent").length;
        lines.push(fresh);
      } catch (error) {
        lines.push({
          ...line,
          error:
            error instanceof PurchaseStrategyError
              ? error.message
              : "strategy_send_failed",
        });
      }
      continue;
    }
    const pending = pendingIds(line);
    if (!pending.length || !choiceQuotes(line.choice)) {
      lines.push(line);
      continue;
    }
    let quote = line.quoteId
      ? await store.get("purchase_quotes", line.quoteId)
      : null;
    // A estratégia foi gravada e a cotação não chegou a abrir: abre agora.
    if (!quote && !line.quoteId && line.decisionId) {
      const decision = await store.get("purchase_decisions", line.decisionId);
      if (decision?.status === "approved")
        quote = await createQuoteForDecision(user, decision)
          .then((r) => r.quote)
          .catch(() => null);
    }
    const recipients: StrategySendRecipient[] = [];
    for (const r of line.recipients) {
      if (!pending.includes(r.partyId)) {
        recipients.push(r);
        continue;
      }
      if (!quote || quote.status !== "open") {
        recipients.push({
          ...r,
          status: "failed",
          error: "quote_closed",
          at,
        });
        continue;
      }
      const check = checks.get(r.partyId);
      if (!check?.ok) {
        recipients.push(blockedResult(check, r.partyId, at));
        continue;
      }
      const result = await inviteRecipient(quote, r.partyId, now);
      if (result.status === "sent") sentNow++;
      recipients.push({
        partyId: r.partyId,
        status: result.status,
        reasons: [],
        error: result.error,
        logins: result.logins,
        at,
      });
    }
    lines.push({
      ...line,
      quoteId: quote?.id ?? line.quoteId,
      error: quote ? null : line.error,
      recipients,
    });
  }
  const saved = await store.update("purchase_strategy_sends", send.id, {
    lines,
    status: sendStatus(lines),
    runs: (send.runs ?? 0) + 1,
    lastRunAt: at,
  });
  await audit(
    user,
    "purchase_strategy.retry",
    "purchase_strategy_send",
    send.id,
    `Envio nº ${send.number} da Estratégia de Compra: tentado de novo, ${sentNow} parceiro(s) receberam agora; ${pendingRecipients(saved)} ainda sem receber`,
  );
  return { send: saved, sentNow };
}
