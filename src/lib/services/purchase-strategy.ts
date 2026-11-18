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
import { demandKind } from "@/lib/purchase-demand";
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

/*
 * Estratégia de compra (mapa B10?, dono 15/11/2026; docs/PURCHASE_DEMAND.md).
 * Uma fila só do Comprador, com reposições e encomendas. Para uma ou mais
 * demandas do mesmo produto ou da mesma linha, ele escolhe:
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
 * curso; a reposição entra sozinha e a encomenda do cliente só depois do
 * "Enviar para cotação" em Encomendas (dono, 18/11/2026). A compra para
 * estoque aberta na Nova solicitação segue o caminho dela.
 */
export function inStrategyQueue(r: QueueFields): boolean {
  if (r.status !== "REQUESTED" || r.purchaseDecisionId) return false;
  const kind = demandKind(r);
  if (kind === "replenishment") return true;
  if (kind !== "order" || isStockCustomer(r.customerId)) return false;
  return !!r.strategySentAt;
}

/** Encomenda do cliente esperando o "Enviar para cotação" (Encomendas). */
export function awaitingStrategySend(r: QueueFields): boolean {
  return (
    r.status === "REQUESTED" &&
    !r.purchaseDecisionId &&
    demandKind(r) === "order" &&
    !isStockCustomer(r.customerId) &&
    !r.strategySentAt
  );
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
  if (productIds.length > 1 && (lineIds.length > 1 || !lineIds[0]))
    throw new PurchaseStrategyError("strategy_same_line");
  const references = await lastPurchases(productIds);
  if (input.choice === "last_supplier") {
    if (productIds.length > 1)
      throw new PurchaseStrategyError("strategy_last_one_product");
    if (!references.get(productIds[0]))
      throw new PurchaseStrategyError("strategy_no_last_purchase");
  }
  const now = new Date().toISOString();
  const decision = await store.create("purchase_decisions", {
    number: await store.nextNumber("purchase_decision_number"),
    productId: productIds.length === 1 ? productIds[0] : null,
    lineId: lineIds[0] ?? null,
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
    unitPrice: number | null;
    currency: string;
    quantity: number;
    leadTimeDays: number | null;
    incoterm: "EXW" | "FOB" | null;
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
  const reference = decision.reference?.[0];
  if (!reference || !decision.productId)
    throw new PurchaseStrategyError("strategy_no_last_purchase");
  // Sem "Ver preço de compra" (dono, 15/11/2026; docs/LINHA_DE_VISAO.md,
  // seção 7): o pedido sai com o preço e a moeda da última compra gravados
  // na decisão; o que vier no formulário é ignorado.
  if (!canSeePurchasePrice(user))
    input = {
      ...input,
      unitPrice: reference.unitPrice,
      currency: reference.currency ?? "USD",
    };
  const demands = await store.list("requests", {
    filter: { id: decision.demandIds },
  });
  const { createDirectPurchaseOrder } = await import("./purchase-order");
  const order = await createDirectPurchaseOrder(user, {
    supplierId: reference.supplierId,
    currency: input.currency,
    incoterm: input.incoterm,
    leadTimeDays: input.leadTimeDays,
    lines: [
      {
        productId: decision.productId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
      },
    ],
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
  for (const d of decisions) {
    const values = { n: d.number };
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
          link: `/app/purchase-strategy#decision-${d.id}`,
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
          link: `/app/purchase-strategy#decision-${d.id}`,
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
        ownerUserId: send.createdByUserId,
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
 * na fila da Estratégia de Compra. As outras são contadas e ficam como estão.
 */
export async function sendToStrategy(
  user: User,
  ids: readonly string[],
): Promise<{ sent: Request[]; skipped: number }> {
  if (!isWellmix(user)) throw new PurchaseStrategyError("forbidden");
  assertScreen(user, "requests");
  const store = getStore();
  const wanted = unique(ids);
  const rows = wanted.length
    ? await store.list("requests", { filter: { id: wanted } })
    : [];
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
  return { sent, skipped: wanted.length - sent.length };
}

/** Uma linha da Estratégia de Compra: um produto de uma demanda. */
export interface StrategyLine {
  demand: Request;
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
    out.linked.set(l.familyCode, unique([...(out.linked.get(l.familyCode) ?? []), l.partyId]));
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
        ? (families.history.get(family.key) ?? []).slice(
            0,
            FAMILY_SUGGESTIONS,
          )
        : []),
    ]).filter((id) => !linkedIds.includes(id));
    return {
      demand: d,
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
  const { checkRecipients } = await import("./purchase-recipients");
  const checks = await checkRecipients(
    unique(lines.flatMap((l) => [...l.linkedIds, ...l.suggestedIds])),
    t,
  );
  // Sugestão só de quem cota (o fornecedor do produto pode ser de outro tipo).
  for (const line of lines)
    line.suggestedIds = line.suggestedIds.filter((id) =>
      receivesQuote(checks.get(id)?.type),
    );
  return { lines, checks, toSend };
}

export interface StrategySendInput {
  lines: Array<{
    demandId: string;
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
  user: User,
  sendId: string,
  sendNumber: number,
  line: StrategySendLine,
  demand: Request,
  reference: LastPurchase | null,
  checks: Map<string, RecipientCheck>,
  note: string | null,
): Promise<StrategySendLine> {
  const store = getStore();
  const now = new Date();
  const at = now.toISOString();
  const product = demand.productId
    ? await store.get("products", demand.productId)
    : null;
  const quotes = choiceQuotes(line.choice);
  const decision = await store.create("purchase_decisions", {
    number: await store.nextNumber("purchase_decision_number"),
    productId: demand.productId,
    lineId: product?.lineId ?? null,
    demandIds: [demand.id],
    quantity: demand.quantity,
    choice: line.choice,
    reference: reference ? [reference] : [],
    note,
    // Cotar não passa mais pela aprovação (D2): a Diretoria aprova a
    // vencedora. O pedido direto continua com a aprovação de antes.
    status: quotes ? "approved" : "pending",
    chosenByUserId: user.id,
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
  await store.update("requests", demand.id, {
    purchaseDecisionId: decision.id,
  });
  await audit(
    user,
    "purchase_strategy.choose",
    "purchase_decision",
    decision.id,
    `Estratégia nº ${decision.number}: ${choiceLabel(line.choice)} para a demanda nº ${demand.number ?? demand.id} (envio nº ${sendNumber})`,
  );
  if (!quotes) {
    const approvers = await teamHolders("purchaseStrategy.approve");
    if (approvers.length)
      await notify(
        { userIds: approvers.map((u) => u.id) },
        {
          kind: "action",
          link: `/app/purchase-strategy#decision-${decision.id}`,
          subject: `Aprovar estratégia de compra nº ${decision.number}`,
          body: `Pedido direto com o fornecedor da última compra: ${demand.productName}.`,
        },
      );
    return { ...line, decisionId: decision.id, error: null, recipients: [] };
  }
  const okIds = line.recipientIds.filter((id) => checks.get(id)?.ok);
  const { openQuoteWithRecipients } = await import("./purchase-quote");
  let opened: Awaited<ReturnType<typeof openQuoteWithRecipients>>;
  try {
    opened = await openQuoteWithRecipients(user, decision, okIds, now);
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
  const demandIds = input.lines.map((l) => l.demandId);
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
    if (!d.productId)
      throw new PurchaseStrategyError("strategy_product_missing");
  }
  const references = await lastPurchases(
    unique(demands.map((d) => d.productId)),
  );
  const lines: StrategySendLine[] = input.lines.map((l) => {
    const demand = demands.find((d) => d.id === l.demandId)!;
    const ref = references.get(demand.productId!) ?? null;
    if ((l.choice === "quote_last" || l.choice === "last_supplier") && !ref)
      throw new PurchaseStrategyError("strategy_no_last_purchase");
    const recipientIds =
      l.choice === "quote_last"
        ? [ref!.supplierId]
        : l.choice === "quote"
          ? unique(l.recipientIds).slice(0, 30)
          : [];
    if (l.choice === "quote" && !recipientIds.length)
      throw new PurchaseStrategyError("strategy_send_recipients");
    return {
      demandId: demand.id,
      productId: demand.productId!,
      choice: l.choice,
      recipientIds,
      decisionId: null,
      quoteId: null,
      error: null,
      recipients: [],
    };
  });
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
  const now = new Date().toISOString();
  const send = await store.create("purchase_strategy_sends", {
    number: await store.nextNumber("purchase_strategy_send_number"),
    status: "ok",
    lines,
    createdByUserId: user.id,
    lastRunAt: now,
    runs: 0,
  });
  const done: StrategySendLine[] = [];
  for (const line of lines) {
    const demand = demands.find((d) => d.id === line.demandId)!;
    try {
      done.push(
        await runLine(
          user,
          send.id,
          send.number,
          line,
          demand,
          references.get(line.productId) ?? null,
          checks,
          input.note,
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
  await audit(
    user,
    "purchase_strategy.send",
    "purchase_strategy_send",
    send.id,
    `Envio nº ${send.number} da Estratégia de Compra: ${done.length} produto(s), ${sentCount} convite(s) enviado(s), ${pendingRecipients(saved)} parceiro(s) sem receber`,
  );
  return saved;
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
      // A linha não chegou a virar estratégia: refaz, se a demanda ainda espera.
      const demand = await store.get("requests", line.demandId);
      if (!demand || !inStrategyQueue(demand)) {
        lines.push({ ...line, error: "strategy_demand_taken" });
        continue;
      }
      const ref =
        (await lastPurchases([line.productId])).get(line.productId) ?? null;
      try {
        const fresh = await runLine(
          user,
          send.id,
          send.number,
          { ...line, error: null },
          demand,
          ref,
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
