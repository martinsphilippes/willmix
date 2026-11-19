import "server-only";

import {
  getStore,
  type Order,
  type PurchaseDecision,
  type PurchaseQuote,
  type Request,
  type User,
} from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { requestDisplayStatus } from "./order-status";
import type { Translate } from "@/i18n";
import { forAllCustomerLogins } from "@/lib/auth/permissions";
import {
  negotiationTurn,
  supplierRequestSlaDue,
} from "@/lib/supplier-requests";
import { samplingDueAt, samplingTurn } from "@/lib/supplier-request-sampling";
import {
  requestNextStep,
  todayBrazil,
  type NextStep,
  type PurchaseProgress,
} from "./request-list";

/*
 * De quem é a vez nas encomendas (dono, 18/11/2026; docs/TURNS.md): o que a
 * regra pura do Próximo passo (`requestNextStep`, request-list.ts) precisa
 * ler das outras tabelas, em lote, para a lista, o CSV, o detalhe e as
 * Pendências usarem a mesma resposta:
 * - a compra da encomenda: a estratégia, a cotação (com a fase pelas
 *   respostas, as mesmas regras das Pendências da cotação) e as
 *   solicitações ao fornecedor da vencedora;
 * - na venda aguardando o cliente, se há login do cliente que pode
 *   confirmar (a mesma regra de `canConfirm`).
 */

const unique = <T>(list: readonly (T | null | undefined)[]): T[] => [
  ...new Set(list.filter((x): x is T => x !== null && x !== undefined)),
];

/** Pode confirmar a venda desta encomenda (a regra de `canConfirm`). */
export function canConfirmAs(
  user: Pick<User, "id" | "role" | "partyId" | "active">,
  request: Pick<
    Request,
    "customerId" | "requestedForUserId" | "orderTerms" | "status"
  >,
): boolean {
  return (
    user.active !== false &&
    user.role === "customer" &&
    request.status === "AWAITING_CUSTOMER" &&
    request.customerId === user.partyId &&
    !!request.orderTerms &&
    (request.requestedForUserId === user.id || forAllCustomerLogins(request))
  );
}

export interface RequestTurnContext {
  purchaseOf(
    request: Pick<Request, "purchaseDecisionId" | "id">,
  ): PurchaseProgress | null;
  /** Venda aguardando o cliente: há login que pode confirmar? Nulo fora dela. */
  customerLoginOf(
    request: Pick<
      Request,
      "status" | "customerId" | "requestedForUserId" | "orderTerms"
    >,
  ): boolean | null;
  /** Logins do cliente que podem confirmar a venda (ativos). */
  confirmersOf(
    request: Pick<
      Request,
      "status" | "customerId" | "requestedForUserId" | "orderTerms"
    >,
  ): string[];
}

/** Lê, em lote, o que o Próximo passo das encomendas dadas precisa. */
export async function requestTurnContext(
  requests: readonly Request[],
  now = new Date(),
): Promise<RequestTurnContext> {
  const store = getStore();
  const decisionIds = unique(requests.map((r) => r.purchaseDecisionId));
  const awaiting = requests.filter((r) => r.status === "AWAITING_CUSTOMER");
  const customerIds = unique(awaiting.map((r) => r.customerId));
  const [decisions, logins] = await Promise.all([
    decisionIds.length
      ? store
          .list("purchase_decisions", { filter: { id: decisionIds } })
          .catch(() => [] as PurchaseDecision[])
      : Promise.resolve([] as PurchaseDecision[]),
    customerIds.length
      ? store.list("users", {
          filter: { partyId: customerIds, role: "customer" },
        })
      : Promise.resolve([] as User[]),
  ]);
  const quoteDecisionIds = decisions
    .filter((d) => d.choice !== "last_supplier")
    .map((d) => d.id);
  const quotes = quoteDecisionIds.length
    ? await store
        .list("purchase_quotes", { filter: { decisionId: quoteDecisionIds } })
        .catch(() => [] as PurchaseQuote[])
    : [];
  const openQuoteIds = quotes
    .filter((q) => q.status === "open")
    .map((q) => q.id);
  const supplierRequestIds = unique(
    quotes
      .filter((q) => q.status === "approved")
      .flatMap((q) => q.supplierRequestIds ?? []),
  );
  const [responses, supplierRequests] = await Promise.all([
    openQuoteIds.length
      ? store.list("purchase_quote_responses", {
          filter: { quoteId: openQuoteIds },
        })
      : Promise.resolve([]),
    supplierRequestIds.length
      ? store.list("supplier_requests", { filter: { id: supplierRequestIds } })
      : Promise.resolve([]),
  ]);
  const { quoteClosed, quoteEmpty, responseState } =
    await import("./purchase-quote");
  /* Prazos das pendências do fornecedor e da Wellmix (dono, 19/11/2026):
     o SLA da negociação e o da amostragem, os mesmos das Pendências. */
  const [slaMinutes, samplingDays] = supplierRequests.length
    ? await Promise.all([
        import("./supplier-request-negotiation").then((m) =>
          m.supplierRequestSlaMinutes(),
        ),
        import("./supplier-request-sampling").then((m) => m.samplingSlaDays()),
      ])
    : [0, 0];
  const decisionById = new Map(decisions.map((d) => [d.id, d]));
  // A cotação que vale para a estratégia: a mais nova que não foi cancelada.
  const quoteOf = (decisionId: string) =>
    quotes
      .filter((q) => q.decisionId === decisionId && q.status !== "cancelled")
      .sort((a, b) => b.number - a.number)[0] ?? null;
  const progress = new Map<string, PurchaseProgress>();
  const purchaseOf: RequestTurnContext["purchaseOf"] = (request) => {
    const id = request.purchaseDecisionId;
    if (!id) return null;
    const cached = progress.get(id);
    if (cached) return cached;
    const d = decisionById.get(id);
    if (!d) return null;
    const q = d.choice === "last_supplier" ? null : quoteOf(d.id);
    const mine = q ? responses.filter((r) => r.quoteId === q.id) : [];
    const out: PurchaseProgress = {
      decision: { status: d.status, choice: d.choice, orderId: d.orderId },
      quote: q
        ? {
            status: q.status,
            phase: quoteEmpty(mine, now)
              ? "empty"
              : quoteClosed(mine, now)
                ? "choose"
                : "answering",
            invites: mine
              .filter((r) => responseState(r, now) === "open")
              .map((r) => ({ supplierId: r.supplierId, dueAt: r.dueAt })),
          }
        : null,
      supplierRequests: q?.supplierRequestIds?.length
        ? supplierRequests
            .filter((s) => q.supplierRequestIds!.includes(s.id))
            .map((s) => ({
              status: s.status,
              negotiation: negotiationTurn(s),
              sampling:
                s.status === "approved"
                  ? samplingTurn(s.sampling ?? null)
                  : null,
              supplierId: s.supplierId,
              negotiationDueAt: supplierRequestSlaDue(s, slaMinutes),
              samplingDueAt:
                s.status === "approved"
                  ? samplingDueAt(s.sampling ?? null, samplingDays)
                  : null,
            }))
        : [],
    };
    progress.set(id, out);
    return out;
  };
  const confirmersOf: RequestTurnContext["confirmersOf"] = (request) =>
    request.status !== "AWAITING_CUSTOMER"
      ? []
      : logins.filter((u) => canConfirmAs(u, request)).map((u) => u.id);
  return {
    purchaseOf,
    confirmersOf,
    customerLoginOf: (request) =>
      request.status === "AWAITING_CUSTOMER"
        ? confirmersOf(request).length > 0
        : null,
  };
}

/** Pendência da vez de uma encomenda (completada pelas Pendências: prazo e grupo). */
export interface TurnTaskDraft {
  kind: "customer_confirm" | "customer_login";
  title: string;
  detail: string;
  text: {
    title: "turn.task.confirm.title" | "turn.task.login.title";
    detail: "turn.task.confirm.detail" | "turn.task.login.detail";
    values: Record<string, string | number>;
  };
  link: string;
  dueAt: string | null;
  sinceAt: string | null;
  requestId: string;
  customerId: string;
  ownerUserId: string | null;
}

/** Uma encomenda por lote (o lote confirma junto); a de número mais baixo abre. */
function byBatch(requests: readonly Request[]): Request[][] {
  const groups = new Map<string, Request[]>();
  for (const r of requests) {
    const key = r.groupId ?? r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((list) =>
    [...list].sort(
      (a, b) =>
        (a.number ?? 0) - (b.number ?? 0) ||
        a.createdAt.localeCompare(b.createdAt),
    ),
  );
}

/**
 * Pendências da venda aguardando o cliente (dono, 18/11/2026; docs/TURNS.md):
 * - o login do cliente que pode confirmar recebe "Confirmar pedido", uma por
 *   encomenda (o lote inteiro confirma junto), levando ao cartão de
 *   confirmação; trocar o login com acesso muda quem recebe;
 * - ninguém pode confirmar (o cliente sem login, ou o login escolhido
 *   inativo): o administrador recebe o caso, com o que falta resolver.
 * Confirmada, a encomenda vira "Solicitado" e as duas somem sozinhas.
 */
export async function turnTaskDrafts(
  user: User,
  ptText: Translate,
): Promise<TurnTaskDraft[]> {
  const store = getStore();
  const customer = user.role === "customer" && !!user.partyId;
  const admin = user.role === "admin";
  if (!customer && !admin) return [];
  const awaiting = await store.list("requests", {
    filter: {
      status: "AWAITING_CUSTOMER",
      ...(customer ? { customerId: user.partyId! } : {}),
    },
  });
  if (!awaiting.length) return [];
  const draft = (
    kind: TurnTaskDraft["kind"],
    batch: Request[],
    link: string,
  ): TurnTaskDraft => {
    const first = batch[0];
    const values = { n: first.number ?? "—", count: batch.length };
    const text =
      kind === "customer_confirm"
        ? ({
            title: "turn.task.confirm.title",
            detail: "turn.task.confirm.detail",
          } as const)
        : ({
            title: "turn.task.login.title",
            detail: "turn.task.login.detail",
          } as const);
    return {
      kind,
      title: ptText(text.title, values),
      detail: ptText(text.detail, values),
      text: { ...text, values },
      link,
      dueAt: null,
      sinceAt: first.createdAt,
      requestId: first.id,
      customerId: first.customerId,
      ownerUserId: first.ownerUserId ?? null,
    };
  };
  if (customer)
    return byBatch(awaiting.filter((r) => canConfirmAs(user, r))).map((batch) =>
      draft("customer_confirm", batch, `/app/requests/${batch[0].id}`),
    );
  const ctx = await requestTurnContext(awaiting);
  const stuck = awaiting.filter((r) => ctx.customerLoginOf(r) === false);
  if (!stuck.length) return [];
  // Com login do cliente: escolher o login com acesso na encomenda; sem
  // nenhum login: criar o acesso no cadastro do cliente.
  const withLogin = new Set(
    (
      await store.list("users", {
        filter: {
          partyId: unique(stuck.map((r) => r.customerId)),
          role: "customer",
          active: true,
        },
      })
    ).map((u) => u.partyId),
  );
  return byBatch(stuck).map((batch) =>
    draft(
      "customer_login",
      batch,
      withLogin.has(batch[0].customerId)
        ? `/app/requests/${batch[0].id}`
        : `/app/parties/${batch[0].customerId}#access`,
    ),
  );
}

/**
 * O Próximo passo das encomendas para quem as abre (detalhe e lote), pela
 * mesma regra da lista. O cliente vê só se a vez é dele ou da Wellmix (a
 * compra e o pedido são internos).
 */
export async function requestStepsFor(
  user: User,
  requests: readonly Request[],
  orders: readonly Order[],
): Promise<Map<string, NextStep>> {
  return (await requestStepsWithContext(user, requests, orders)).steps;
}

/**
 * O Próximo passo de cada encomenda e o contexto lido para ele (a compra,
 * os logins que confirmam): a página da encomenda usa o contexto para dizer
 * quem age, pela mesma regra da lista (dono, 19/11/2026). Nulo para quem não
 * é da Wellmix.
 */
export async function requestStepsWithContext(
  user: User,
  requests: readonly Request[],
  orders: readonly Order[],
): Promise<{
  steps: Map<string, NextStep>;
  ctx: RequestTurnContext | null;
}> {
  const wellmix = isWellmix(user);
  const ctx = wellmix ? await requestTurnContext(requests) : null;
  const { awaitingStrategySend, inStrategyQueue } =
    await import("./purchase-strategy");
  const { orderNextInfoOf } = await import("./request-export");
  const info =
    wellmix && orders.length ? await orderNextInfoOf(orders) : new Map();
  const tradingIds = new Set(
    wellmix && orders.length
      ? (
          await getStore().list("parties", {
            filter: { id: unique(orders.map((o) => o.supplierId)) },
          })
        )
          .filter((p) => p.type === "trading")
          .map((p) => p.id)
      : [],
  );
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const cancelled = new Set(
    orders.filter((o) => o.status === "CANCELLED").map((o) => o.id),
  );
  const today = todayBrazil();
  const out = new Map<string, NextStep>();
  for (const request of requests) {
    const order = request.orderId
      ? (orderById.get(request.orderId) ?? null)
      : null;
    const next = info.get(order?.id ?? "");
    const step = requestNextStep({
      status: request.status,
      display: requestDisplayStatus(request, cancelled),
      strategy: wellmix
        ? awaitingStrategySend(request)
          ? "send"
          : inStrategyQueue(request)
            ? "queue"
            : null
        : null,
      purchase: ctx?.purchaseOf(request) ?? null,
      customerLogin: ctx?.customerLoginOf(request) ?? null,
      order:
        wellmix && order
          ? {
              status: order.status,
              responsibleRole: next?.responsibleRole ?? null,
              dueAt: next?.dueAt ?? null,
              trading: tradingIds.has(order.supplierId),
            }
          : null,
      today,
    });
    // Para o cliente, a contraparte é a Wellmix.
    out.set(
      request.id,
      wellmix || !step.who || step.who === "customer"
        ? step
        : { ...step, who: "wellmix" },
    );
  }
  return { steps: out, ctx };
}

/** O Próximo passo de uma encomenda para quem a abre (detalhe). */
export async function requestStepFor(
  user: User,
  request: Request,
  order: Order | null,
): Promise<NextStep> {
  const steps = await requestStepsFor(user, [request], order ? [order] : []);
  return steps.get(request.id)!;
}
