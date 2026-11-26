import "server-only";

import {
  getStore,
  type Product,
  type PurchaseDecision,
  type PurchaseQuote,
  type PurchaseQuoteItem,
  type PurchaseQuoteResponse,
  type Request,
  type SupplierRequest,
  type User,
} from "@/lib/db";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import { assertCan, can, holdersOf } from "@/lib/auth/function-access";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { listColumns } from "@/lib/db/lookup";
import { getSettings } from "@/lib/settings";
import { audit } from "./audit";
import { servesFamilies } from "@/lib/party-families";
import { notify } from "./notifications";
import { storePhotoDocument, type PhotoSource } from "./documents";
import { clearQuoteDraft } from "./quote-draft";
import type { SupplierStep } from "@/lib/supplier-steps";
import type { TaskText } from "@/lib/task-text";
import { innerFromDemands, quoteInnerState } from "@/lib/quote-inner";
import { AUTO_ACTOR_ID, isBookKey, quoteItemKey } from "@/lib/purchase-demand";
import {
  appendQuoteEvent,
  pendingQuoteProposals,
  quoteProductTerms,
  quoteTermsSummary,
} from "@/lib/quote-negotiation";
import {
  prepareQuoteSheets,
  saveQuoteSheets,
  setQuoteScalePhoto,
  SupplierSheetError,
  type PreparedQuoteSheet,
  type QuoteSheetInput,
  soldBeforeProducts,
} from "./supplier-sheets";
import {
  quoteSamplingReady,
  quoteSamplingToSend,
  skippedSampling,
} from "@/lib/quote-sampling";

/*
 * Cotação de compra (mapa B13; dono, 15/11/2026; docs/PURCHASE_DEMAND.md).
 *
 * - Aberta pelo sistema quando a estratégia "cotar entre fornecedores" é
 *   aprovada, para os fornecedores ativos que atendem as linhas dos
 *   produtos (vínculo fornecedor × linha, `supplierIdsForLines`).
 * - Cada fornecedor tem `purchaseQuoteHours` horas corridas (padrão 24) a
 *   partir do convite, com o prazo gravado em UTC; o vencimento é calculado
 *   na leitura. Responde no portal (preço por item, moeda, incoterm, prazo
 *   de produção, porto, pedido mínimo, observação) ou recusa.
 * - Um fornecedor só lê a própria resposta: nunca quem mais foi convidado,
 *   as outras respostas nem o cliente da encomenda (conferido aqui, no
 *   servidor).
 * - Encerrado o prazo de todos ou respondidos todos, o Comprador escolhe a
 *   vencedora (ação purchaseQuote.choose) e a Diretoria de compras aprova
 *   (purchaseQuote.approve). Aprovada, vira a Solicitação ao fornecedor (B7)
 *   já preenchida com o preço e a condição cotados.
 * - Sem nenhuma resposta: o Comprador reabre por mais um prazo, convida
 *   outros fornecedores ou volta para a estratégia (fornecedor da última
 *   compra).
 */

export class PurchaseQuoteError extends Error {}

const HOUR = 3_600_000;

/** Lembrete antes de vencer: a 1/6 do prazo (4 h num prazo de 24 h). */
export const reminderLeadMs = (hours: number) => (hours * HOUR) / 6;

export type ResponseState = "open" | "answered" | "declined" | "expired";

/** Situação de uma resposta agora (o vencimento é calculado na leitura). */
export function responseState(
  r: Pick<PurchaseQuoteResponse, "status" | "dueAt">,
  now: Date,
): ResponseState {
  if (r.status === "answered") return "answered";
  if (r.status === "declined") return "declined";
  return Date.parse(r.dueAt) <= now.getTime() ? "expired" : "open";
}

/**
 * O fornecedor ainda pode enviar ou corrigir a resposta (dono, 21/11/2026):
 * a cotação aberta e o prazo dele correndo. Enviada, a resposta continua
 * corrigível até o prazo; a escolha da vencedora (ou o cancelamento) trava
 * antes. Vale para a tela e para o servidor.
 */
export function quoteEditable(
  quote: Pick<PurchaseQuote, "status">,
  response: Pick<PurchaseQuoteResponse, "dueAt">,
  now: Date,
): boolean {
  return quote.status === "open" && Date.parse(response.dueAt) > now.getTime();
}

/** Encerrada para escolha: ninguém mais pode responder (todos responderam ou o prazo de todos passou). */
export function quoteClosed(
  responses: Pick<PurchaseQuoteResponse, "status" | "dueAt">[],
  now: Date,
): boolean {
  return responses.every((r) => responseState(r, now) !== "open");
}

/** Sem nenhuma resposta e sem ninguém mais no prazo. */
export function quoteEmpty(
  responses: Pick<PurchaseQuoteResponse, "status" | "dueAt">[],
  now: Date,
): boolean {
  return (
    quoteClosed(responses, now) &&
    !responses.some((r) => r.status === "answered")
  );
}

/**
 * Parceiros ativos que atendem as linhas da cotação, cada um uma vez só:
 * - os que marcaram a família de alguma das linhas ("Grupo de produto
 *   (família)" no cadastro; dono, 18/11/2026; docs/PARTNER_FAMILIES.md);
 * - os vínculos antigos fornecedor × linha (`supplier_lines`, "Linhas
 *   atendidas") ainda não convertidos em família; o convertido segue a
 *   família (desmarcada, o parceiro sai);
 * - o fornecedor principal dos produtos da linha e os fornecedores ligados
 *   aos produtos cotados (`product_suppliers`), como sempre.
 * Entram Fornecedor, Trading, Supplier e Factory (antes, só o Fornecedor).
 */
export async function supplierIdsForLines(
  lineIds: readonly string[],
  productIds: readonly string[] = [],
): Promise<string[]> {
  const store = getStore();
  const lines = [...new Set(lineIds.filter(Boolean))];
  const ids = new Set<string>();
  if (lines.length) {
    const { familyCodesForLines } = await import("./product-families");
    const [explicit, products, families] = await Promise.all([
      store
        .list("supplier_lines", { filter: { lineId: lines } })
        .catch(() => []),
      listColumns(store, "products", ["supplierId", "lineId"], {
        filter: { lineId: lines, active: true },
      }),
      familyCodesForLines(lines).catch(() => [] as string[]),
    ]);
    for (const l of explicit) if (!l.familyConvertedAt) ids.add(l.supplierId);
    for (const p of products) if (p.supplierId) ids.add(p.supplierId);
    if (families.length) {
      const links = await store
        .list("party_families", { filter: { familyCode: families } })
        .catch(() => []);
      for (const l of links) ids.add(l.partyId);
    }
  }
  if (productIds.length) {
    const links = await store
      .list("product_suppliers", { filter: { productId: [...productIds] } })
      .catch(() => []);
    for (const l of links) ids.add(l.supplierId);
  }
  if (!ids.size) return [];
  const parties = await store.list("parties", { filter: { id: [...ids] } });
  return parties
    .filter((p) => servesFamilies(p.type) && p.active)
    .map((p) => p.id)
    .sort();
}

async function wellmixHolders(action: Parameters<typeof can>[1]) {
  const users = (
    await getStore().list("users", { filter: { active: true } })
  ).filter((u) => isWellmix(u));
  const { loadFunctionDefs } = await import("./team-functions");
  const holders = holdersOf(users, action, await loadFunctionDefs());
  return holders.length ? holders : users.filter((u) => isAdmin(u));
}

/** O que aconteceu com o convite de um parceiro (Estratégia de Compra). */
export interface InviteResult {
  partyId: string;
  status: "sent" | "already" | "failed";
  /** Logins avisados no portal. */
  logins: number;
  error: string | null;
}

/**
 * Convida um parceiro para a cotação, uma vez só: quem já foi convidado
 * fica como está ("already"; o índice único cotação × parceiro segura o
 * clique duplo). Cada um recebe o convite na língua dele (só a cotação dele).
 */
export async function inviteRecipient(
  quote: PurchaseQuote,
  supplierId: string,
  now: Date,
): Promise<InviteResult> {
  const store = getStore();
  const invited = () =>
    store.list("purchase_quote_responses", {
      filter: { quoteId: quote.id, supplierId },
      limit: 1,
    });
  if ((await invited()).length)
    return { partyId: supplierId, status: "already", logins: 0, error: null };
  const dueAt = new Date(now.getTime() + quote.hours * HOUR).toISOString();
  try {
    await store.create("purchase_quote_responses", {
      quoteId: quote.id,
      supplierId,
      status: "invited",
      invitedAt: now.toISOString(),
      dueAt,
      prices: null,
      currency: null,
      incoterm: null,
      leadTimeDays: null,
      port: null,
      moq: null,
      note: null,
      answeredAt: null,
      answeredByUserId: null,
      reminderSentAt: null,
    });
  } catch (error) {
    // O outro clique (ou a outra aba) convidou antes: não duplica.
    if ((await invited().catch(() => [])).length)
      return { partyId: supplierId, status: "already", logins: 0, error: null };
    return {
      partyId: supplierId,
      status: "failed",
      logins: 0,
      error: error instanceof Error ? error.message.slice(0, 300) : "error",
    };
  }
  let logins = 0;
  try {
    logins =
      (await notify(
        { partyId: supplierId, role: "supplier" },
        {
          kind: "action",
          link: `/app/purchase-quotes/${quote.id}`,
          text: (t) => ({
            subject: t("quote.notify.invite.subject", {
              n: String(quote.number),
            }),
            body: t("quote.notify.invite.body", { hours: String(quote.hours) }),
          }),
        },
      )) ?? 0;
  } catch (error) {
    // O convite está gravado (o parceiro vê a cotação no portal); só o aviso falhou.
    console.error("[quote] aviso do convite", error);
  }
  return { partyId: supplierId, status: "sent", logins, error: null };
}

async function inviteSuppliers(
  quote: PurchaseQuote,
  supplierIds: string[],
  now: Date,
): Promise<InviteResult[]> {
  const out: InviteResult[] = [];
  for (const supplierId of supplierIds)
    out.push(await inviteRecipient(quote, supplierId, now));
  return out;
}

/**
 * Os itens da cotação: os produtos das demandas, somados por produto, com o
 * que o parceiro precisa para cotar (dono, 18/11/2026): a especificação, a
 * programação de entrega (demanda única) e a data desejada. Nunca o cliente.
 * A caixa inner exigida pelo cliente vem das demandas (dono, 21/11/2026;
 * src/lib/quote-inner.ts): sem pedido, o item não tem inner.
 */
export function quoteItemsFor(
  demands: readonly Request[],
  products: readonly Pick<Product, "id" | "name">[],
): PurchaseQuoteItem[] {
  // O item de book enviado pelo parceiro (dono, 26/11/2026) entra pela
  // chave da demanda (`quoteItemKey`), com a cópia do item do book.
  const productIds = [
    ...new Set(demands.map((d) => quoteItemKey(d)).filter(Boolean)),
  ] as string[];
  return productIds.map((id) => {
    const mine = demands.filter((d) => quoteItemKey(d) === id);
    const specs = [
      ...new Set(
        mine
          .map((d) => d.specification?.trim() ?? "")
          .filter((x): x is string => !!x),
      ),
    ];
    const desired = mine
      .map((d) => d.desiredAt ?? null)
      .filter((x): x is string => !!x)
      .sort()[0];
    return {
      productId: id,
      name: products.find((p) => p.id === id)?.name ?? mine[0].productName,
      quantity: mine.reduce((sum, d) => sum + d.quantity, 0),
      unit: mine[0]?.unit ?? "un",
      specification: specs.join(" / ").slice(0, 2000) || null,
      schedule: mine.length === 1 ? (mine[0].schedule ?? null) : null,
      desiredAt: desired ?? null,
      inner: innerFromDemands(mine),
      ...(isBookKey(id) && mine[0].bookingSource
        ? { book: mine[0].bookingSource }
        : {}),
    };
  });
}

/**
 * Cria a cotação de compra da estratégia (sem convidar ninguém): os itens,
 * o prazo de cada parceiro e as demandas em "cotação aberta". Uma cotação só
 * por estratégia: chamada de novo, devolve a que já existe.
 */
export async function createQuoteForDecision(
  /** Nulo = o portal sozinho (cotação na confirmação do cliente). */
  user: User | null,
  decision: PurchaseDecision,
): Promise<{ quote: PurchaseQuote; fresh: boolean }> {
  const store = getStore();
  if (decision.choice === "last_supplier" || decision.status !== "approved")
    throw new PurchaseQuoteError("quote_not_ready");
  if (decision.quoteId) {
    const existing = await store.get("purchase_quotes", decision.quoteId);
    if (existing) return { quote: existing, fresh: false };
  }
  const demands = await store.list("requests", {
    filter: { id: decision.demandIds },
  });
  const productIds = [
    ...new Set(demands.map((d) => d.productId).filter(Boolean)),
  ] as string[];
  const products = await store.list("products", {
    filter: { id: productIds },
  });
  const items = quoteItemsFor(demands, products);
  const lineIds = [
    ...new Set(products.map((p) => p.lineId).filter(Boolean)),
  ] as string[];
  const hours = (await getSettings()).purchaseQuoteHours;
  const quote = await store.create("purchase_quotes", {
    number: await store.nextNumber("purchase_quote_number"),
    decisionId: decision.id,
    demandIds: decision.demandIds,
    lineIds,
    items,
    status: "open",
    hours,
    openedByUserId: user?.id ?? AUTO_ACTOR_ID,
    winnerResponseId: null,
    chosenByUserId: null,
    chosenAt: null,
    chosenNote: null,
    approvedByUserId: null,
    approvedAt: null,
    approvalNote: null,
    supplierRequestIds: null,
    emptyNotifiedAt: null,
  });
  await store.update("purchase_decisions", decision.id, { quoteId: quote.id });
  for (const d of demands)
    await store.update("requests", d.id, { status: "RFQ_OPEN" });
  return { quote, fresh: true };
}

/**
 * Cotação da Estratégia de Compra por produto (dono, 18/11/2026): convida só
 * os parceiros escolhidos e devolve o que aconteceu com cada um. Sem nenhum
 * convite que deu certo, o Comprador é avisado (como na cotação sem resposta).
 */
export async function openQuoteWithRecipients(
  /** Nulo = o portal sozinho (a encomenda que vira cotação na hora). */
  user: User | null,
  decision: PurchaseDecision,
  recipientIds: readonly string[],
  now = new Date(),
  /**
   * `quietEmpty`: sem nenhum convite, quem chama já avisa o Comprador com o
   * motivo (a cotação automática da encomenda); o "sem resposta" fica marcado
   * como avisado.
   */
  opts: { quietEmpty?: boolean } = {},
): Promise<{ quote: PurchaseQuote; results: InviteResult[] }> {
  const { quote, fresh } = await createQuoteForDecision(user, decision);
  const results = await inviteSuppliers(quote, [...new Set(recipientIds)], now);
  const sent = results.filter((r) => r.status === "sent").length;
  if (fresh)
    await audit(
      user,
      "purchase_quote.open",
      "purchase_quote",
      quote.id,
      `Cotação de compra nº ${quote.number} aberta pela Estratégia de Compra para ${sent} parceiro(s), ${quote.hours} h cada: ${quote.items.map((i) => i.name).join(", ")}`,
    );
  if (fresh && !results.some((r) => r.status !== "failed")) {
    if (opts.quietEmpty)
      await getStore().update("purchase_quotes", quote.id, {
        emptyNotifiedAt: now.toISOString(),
      });
    else await notifyEmpty(quote, now);
  }
  return { quote, results };
}

/**
 * Abre a cotação de compra da estratégia aprovada (sem ação manual): os
 * produtos das demandas, somados por produto, para todos os fornecedores
 * ativos que atendem as linhas. Sem nenhum fornecedor, a cotação nasce
 * vazia e o Comprador é avisado (convida ou volta à estratégia). É o caminho
 * das estratégias "cotar" de antes da Estratégia de Compra por produto.
 */
export async function openQuoteForDecision(
  user: User,
  decision: PurchaseDecision,
  now = new Date(),
): Promise<PurchaseQuote> {
  if (decision.choice !== "quote" || decision.status !== "approved")
    throw new PurchaseQuoteError("quote_not_ready");
  const { quote, fresh } = await createQuoteForDecision(user, decision);
  if (!fresh) return quote;
  const suppliers = await supplierIdsForLines(
    quote.lineIds,
    quote.items.map((i) => i.productId),
  );
  await inviteSuppliers(quote, suppliers, now);
  await audit(
    user,
    "purchase_quote.open",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number} aberta para ${suppliers.length} fornecedor(es), ${quote.hours} h cada: ${quote.items.map((i) => i.name).join(", ")}`,
  );
  if (!suppliers.length) await notifyEmpty(quote, now);
  return quote;
}

/** Comprador avisado: ninguém respondeu (ou não havia fornecedor da linha). */
async function notifyEmpty(quote: PurchaseQuote, now: Date) {
  const buyers = await wellmixHolders("purchaseQuote.choose");
  if (buyers.length)
    await notify(
      { userIds: buyers.map((u) => u.id) },
      {
        kind: "alert",
        link: `/app/purchase-quotes/${quote.id}`,
        subject: `Cotação de compra nº ${quote.number} sem resposta`,
        body: "Reabra por mais um prazo, convide outros fornecedores ou volte para o fornecedor da última compra.",
      },
    );
  await getStore().update("purchase_quotes", quote.id, {
    emptyNotifiedAt: now.toISOString(),
  });
}

/**
 * Lembretes e avisos que dependem do relógio (rodam no agendamento diário e
 * a cada abertura das telas da cotação): o lembrete ao fornecedor antes de
 * vencer (uma vez) e o aviso ao Comprador quando ninguém respondeu.
 */
export async function sweepQuotes(now = new Date()): Promise<{
  reminded: number;
  empty: number;
}> {
  const store = getStore();
  const quotes = await store
    .list("purchase_quotes", { filter: { status: "open" } })
    .catch(() => [] as PurchaseQuote[]);
  let reminded = 0;
  let empty = 0;
  for (const quote of quotes) {
    const responses = await store.list("purchase_quote_responses", {
      filter: { quoteId: quote.id },
    });
    for (const r of responses) {
      if (r.status !== "invited" || r.reminderSentAt) continue;
      const left = Date.parse(r.dueAt) - now.getTime();
      if (left <= 0 || left > reminderLeadMs(quote.hours)) continue;
      await notify(
        { partyId: r.supplierId, role: "supplier" },
        {
          kind: "action",
          link: `/app/purchase-quotes/${quote.id}`,
          text: (t) => ({
            subject: t("quote.notify.reminder.subject", {
              n: String(quote.number),
            }),
            body: t("quote.notify.reminder.body"),
          }),
        },
      );
      await store.update("purchase_quote_responses", r.id, {
        reminderSentAt: now.toISOString(),
      });
      reminded++;
    }
    if (!quote.emptyNotifiedAt && quoteEmpty(responses, now)) {
      await notifyEmpty(quote, now);
      empty++;
    }
  }
  return { reminded, empty };
}

/* ------------------------------------------------------------------------ */
/* Leitura                                                                  */
/* ------------------------------------------------------------------------ */

/** A resposta do fornecedor logado nesta cotação (nula: não foi convidado). */
export async function ownResponse(
  user: User,
  quoteId: string,
): Promise<PurchaseQuoteResponse | null> {
  if (user.role !== "supplier" || !user.partyId) return null;
  const rows = await getStore().list("purchase_quote_responses", {
    filter: { quoteId, supplierId: user.partyId },
  });
  return rows[0] ?? null;
}

/**
 * O que o fornecedor vê da cotação: só os itens (produto, quantidade) e a
 * resposta dele. Nem as demandas, nem o cliente, nem os outros convidados.
 */
export async function supplierQuoteView(user: User, quoteId: string) {
  const response = await ownResponse(user, quoteId);
  if (!response) return null;
  const quote = await getStore().get("purchase_quotes", quoteId);
  if (!quote) return null;
  return {
    quote: {
      id: quote.id,
      number: quote.number,
      items: quote.items,
      hours: quote.hours,
      status: quote.status,
    },
    response,
  };
}

/** Os convites do fornecedor logado, os em aberto primeiro. */
export async function supplierInvitations(user: User, now = new Date()) {
  if (user.role !== "supplier" || !user.partyId) return [];
  const store = getStore();
  const responses = await store.list("purchase_quote_responses", {
    filter: { supplierId: user.partyId },
    orderBy: "createdAt",
    direction: "desc",
  });
  if (!responses.length) return [];
  const quotes = await store.list("purchase_quotes", {
    filter: { id: [...new Set(responses.map((r) => r.quoteId))] },
  });
  return responses
    .map((response) => {
      const quote = quotes.find((q) => q.id === response.quoteId);
      return quote
        ? {
            response,
            state: responseState(response, now),
            quote: {
              id: quote.id,
              number: quote.number,
              items: quote.items,
              status: quote.status,
            },
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort(
      (a, b) =>
        Number(b.state === "open") - Number(a.state === "open") ||
        b.response.createdAt.localeCompare(a.response.createdAt),
    );
}

/* ------------------------------------------------------------------------ */
/* Resposta do fornecedor                                                   */
/* ------------------------------------------------------------------------ */

export interface QuoteAnswer {
  decline: boolean;
  /**
   * Preço de cada produto e, desde 23/11/2026, o prazo de produção e o
   * pedido mínimo dele. Sem eles no produto, valem os da cotação
   * (`leadTimeDays` e `moq` abaixo: o formato de antes).
   */
  prices: Array<{
    productId: string;
    unitPrice: number;
    leadTimeDays?: number | null;
    moq?: number | null;
  }>;
  currency: string | null;
  incoterm: string | null;
  /** Valor do Incoterm no EXW (dono, 23/11/2026); ignorado nos outros. */
  incotermValue?: number | null;
  leadTimeDays: number | null;
  port: string | null;
  moq: number | null;
  note: string | null;
  /**
   * Ficha técnica de cada produto (dono, 20/11/2026): pedida na primeira vez
   * do par produto × fornecedor; quem já vendeu confirma ou corrige.
   */
  sheets?: QuoteSheetInput[];
}

/** O fornecedor responde (ou recusa) a própria cotação, dentro do prazo. */
export async function answerQuote(
  user: User,
  quoteId: string,
  input: QuoteAnswer,
  now = new Date(),
): Promise<PurchaseQuoteResponse> {
  const response = await ownResponse(user, quoteId);
  if (!response) throw new PurchaseQuoteError("not_found");
  const store = getStore();
  const quote = await store.get("purchase_quotes", quoteId);
  if (!quote || quote.status !== "open")
    throw new PurchaseQuoteError("quote_closed");
  if (Date.parse(response.dueAt) <= now.getTime())
    throw new PurchaseQuoteError("quote_expired");
  let patch: Partial<PurchaseQuoteResponse>;
  let prepared: PreparedQuoteSheet[] = [];
  if (input.decline) {
    patch = {
      status: "declined",
      prices: null,
      note: input.note,
    };
  } else {
    const prices = quote.items.map((item) => {
      const p = input.prices.find((x) => x.productId === item.productId);
      if (!p || !Number.isFinite(p.unitPrice) || p.unitPrice < 0)
        throw new PurchaseQuoteError("quote_price_required");
      // Prazo e pedido mínimo por produto (dono, 23/11/2026); sem eles no
      // produto, os da cotação. Obrigatórios em todo produto.
      const leadTimeDays = p.leadTimeDays ?? input.leadTimeDays;
      const moq = p.moq ?? input.moq;
      if (
        leadTimeDays === null ||
        leadTimeDays === undefined ||
        !Number.isInteger(leadTimeDays) ||
        leadTimeDays < 0
      )
        throw new PurchaseQuoteError("quote_lead_required");
      if (moq === null || moq === undefined || !(moq > 0))
        throw new PurchaseQuoteError("quote_moq_required");
      return {
        productId: item.productId,
        unitPrice: p.unitPrice,
        leadTimeDays,
        moq,
      };
    });
    // O resumo da resposta (o maior prazo e o maior mínimo).
    const summary = quoteTermsSummary(prices);
    if (
      !input.currency ||
      !(SHEET_CURRENCIES as readonly string[]).includes(input.currency)
    )
      throw new PurchaseQuoteError("quote_currency_required");
    if (
      !input.incoterm ||
      !(SHEET_INCOTERMS as readonly string[]).includes(input.incoterm)
    )
      throw new PurchaseQuoteError("quote_incoterm_required");
    // Comercial obrigatório em toda cotação (dono, 20/11/2026): prazo de
    // produção e pedido mínimo (conferidos acima, por produto) e o porto
    // (também no EXW).
    if (!input.port?.trim())
      throw new PurchaseQuoteError("quote_port_required");
    try {
      prepared = await prepareQuoteSheets(quote, response, input.sheets ?? []);
    } catch (error) {
      if (error instanceof SupplierSheetError)
        throw new PurchaseQuoteError(error.message);
      throw error;
    }
    patch = {
      status: "answered",
      prices,
      currency: input.currency,
      incoterm: input.incoterm,
      incotermValue:
        input.incoterm === "EXW" ? (input.incotermValue ?? null) : null,
      leadTimeDays: summary.leadTimeDays,
      port: input.port.trim(),
      moq: summary.moq,
      note: input.note,
      items: prepared.map((p) => p.item),
    };
  }
  const updated = await store.update("purchase_quote_responses", response.id, {
    ...patch,
    answeredAt: now.toISOString(),
    answeredByUserId: user.id,
    // Cada envio fica no histórico de propostas e contrapropostas da
    // cotação (dono, 22/11/2026; docs/QUOTATION.md).
    negotiation: appendQuoteEvent(response, {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      kind: input.decline ? "decline" : "answer",
      side: "supplier",
      byUserId: user.id,
      prices: patch.prices ?? null,
      currency: patch.currency ?? null,
      incoterm: patch.incoterm ?? null,
      moq: patch.moq ?? null,
      leadTimeDays: patch.leadTimeDays ?? null,
      port: patch.port ?? null,
      text: patch.note ?? null,
    }),
  });
  // A ficha de cada par, depois da resposta gravada (uma vez por par).
  if (prepared.length)
    await saveQuoteSheets(user, quote, updated, prepared, now);
  // Enviada ou recusada: o rascunho automático do login acabou (dono,
  // 20/11/2026). Falhar aqui não desfaz a resposta.
  await clearQuoteDraft(user, quote.id).catch(() => undefined);
  await audit(
    user,
    input.decline ? "purchase_quote.decline" : "purchase_quote.answer",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: ${input.decline ? "recusada" : `respondida (${input.currency})`} pelo fornecedor ${response.supplierId}`,
  );
  const buyers = await wellmixHolders("purchaseQuote.choose");
  if (buyers.length)
    await notify(
      { userIds: buyers.map((u) => u.id) },
      {
        kind: "info",
        link: `/app/purchase-quotes/${quote.id}`,
        subject: `Cotação de compra nº ${quote.number}: ${input.decline ? "um fornecedor recusou" : "nova resposta"}`,
        body: "Veja o quadro comparativo.",
      },
    );
  return updated;
}

/**
 * Foto na balança de um produto (opcional; dono, 20/11/2026): sobe na hora,
 * antes ou depois da resposta, enquanto o prazo corre. Só a Wellmix e quem
 * enviou abrem (documento sem pedido nem solicitação).
 */
export async function addQuoteScalePhoto(
  user: User,
  quoteId: string,
  productId: string,
  source: PhotoSource,
  now = new Date(),
): Promise<void> {
  const response = await ownResponse(user, quoteId);
  if (!response) throw new PurchaseQuoteError("not_found");
  const quote = await getStore().get("purchase_quotes", quoteId);
  if (!quote || quote.status !== "open")
    throw new PurchaseQuoteError("quote_closed");
  if (Date.parse(response.dueAt) <= now.getTime())
    throw new PurchaseQuoteError("quote_expired");
  if (!quote.items.some((i) => i.productId === productId))
    throw new PurchaseQuoteError("not_found");
  const doc = await storePhotoDocument(user, source, { type: "photo" });
  await setQuoteScalePhoto(response, productId, doc.id);
  await audit(
    user,
    "purchase_quote.scale_photo",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: foto na balança do produto ${productId} pelo fornecedor ${response.supplierId}`,
  );
}

/* ------------------------------------------------------------------------ */
/* Escolha, aprovação e o que fazer sem resposta                            */
/* ------------------------------------------------------------------------ */

async function loadOpen(quoteId: string) {
  const store = getStore();
  const quote = await store.get("purchase_quotes", quoteId);
  if (!quote) throw new PurchaseQuoteError("not_found");
  const responses = await store.list("purchase_quote_responses", {
    filter: { quoteId },
  });
  return { quote, responses };
}

/** O Comprador escolhe a vencedora (encerrado o prazo ou respondidos todos). */
export async function chooseWinner(
  user: User,
  quoteId: string,
  responseId: string,
  note: string | null,
  now = new Date(),
): Promise<PurchaseQuote> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  const { quote, responses } = await loadOpen(quoteId);
  if (quote.status !== "open") throw new PurchaseQuoteError("quote_closed");
  if (!quoteClosed(responses, now))
    throw new PurchaseQuoteError("quote_still_open");
  const winner = responses.find((r) => r.id === responseId);
  if (!winner || winner.status !== "answered")
    throw new PurchaseQuoteError("quote_winner_invalid");
  // Só vence quem tem a amostra de todos os produtos aprovada, ou é
  // conhecido do produto (dono, 22/11/2026; docs/SUPPLIER_SAMPLING.md).
  const productIds = quote.items.map((i) => i.productId);
  const known = await soldBeforeProducts(winner.supplierId, productIds);
  if (!quoteSamplingReady(winner, productIds, known))
    throw new PurchaseQuoteError("quote_winner_sampling");
  const updated = await getStore().update("purchase_quotes", quote.id, {
    status: "chosen",
    winnerResponseId: winner.id,
    chosenByUserId: user.id,
    chosenAt: now.toISOString(),
    chosenNote: note,
  });
  await audit(
    user,
    "purchase_quote.choose",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: vencedora ${winner.supplierId}`,
  );
  const approvers = await wellmixHolders("purchaseQuote.approve");
  if (approvers.length)
    await notify(
      { userIds: approvers.map((u) => u.id) },
      {
        kind: "action",
        link: `/app/purchase-quotes/${quote.id}`,
        subject: `Aprovar a vencedora da cotação de compra nº ${quote.number}`,
        body: "O Comprador escolheu a cotação vencedora.",
      },
    );
  return updated;
}

/**
 * A Diretoria de compras aprova a vencedora (vira a Solicitação ao
 * fornecedor, B7) ou recusa (a cotação volta para a escolha, com o motivo).
 */
export async function decideWinner(
  user: User,
  quoteId: string,
  input: { approve: boolean; note: string | null },
  now = new Date(),
): Promise<PurchaseQuote> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.approve");
  const { quote, responses } = await loadOpen(quoteId);
  if (quote.status !== "chosen")
    throw new PurchaseQuoteError("quote_not_chosen");
  const store = getStore();
  if (!input.approve) {
    if (!input.note?.trim()) throw new PurchaseQuoteError("quote_reject_note");
    const back = await store.update("purchase_quotes", quote.id, {
      status: "open",
      winnerResponseId: null,
      approvalNote: input.note.trim(),
    });
    await audit(
      user,
      "purchase_quote.reject",
      "purchase_quote",
      quote.id,
      `Cotação de compra nº ${quote.number}: vencedora recusada (${input.note})`,
    );
    if (quote.chosenByUserId)
      await notify(
        { userIds: [quote.chosenByUserId] },
        {
          kind: "alert",
          link: `/app/purchase-quotes/${quote.id}`,
          subject: `Vencedora da cotação nº ${quote.number} recusada`,
          body: `Motivo: ${input.note}`,
        },
      );
    return back;
  }
  const winner = responses.find((r) => r.id === quote.winnerResponseId);
  if (!winner) throw new PurchaseQuoteError("quote_winner_invalid");
  const requests = await supplierRequestsFromWinner(user, quote, winner, now);
  const updated = await store.update("purchase_quotes", quote.id, {
    status: "approved",
    approvedByUserId: user.id,
    approvedAt: now.toISOString(),
    approvalNote: input.note?.trim() || null,
    supplierRequestIds: requests.map((r) => r.id),
  });
  for (const id of quote.demandIds)
    await store.update("requests", id, { status: "SUPPLIER_SELECTED" });
  await audit(
    user,
    "purchase_quote.approve",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: vencedora ${winner.supplierId} aprovada; solicitação ao fornecedor nº ${requests[0]?.number ?? "—"}`,
  );
  await notify(
    { partyId: winner.supplierId, role: "supplier" },
    {
      kind: "info",
      link: `/app/supplier-requests/${requests[0]?.id ?? ""}`,
      text: (t) => ({
        subject: t("quote.notify.won.subject", { n: String(quote.number) }),
        body: t("quote.notify.won.body"),
      }),
    },
  );
  if (quote.chosenByUserId)
    await notify(
      { userIds: [quote.chosenByUserId] },
      {
        kind: "action",
        link: `/app/supplier-requests/${requests[0]?.id ?? ""}`,
        subject: `Cotação nº ${quote.number} aprovada: solicitação ao fornecedor criada`,
        body: "Siga com a decisão e a amostragem na Solicitação ao fornecedor.",
      },
    );
  return updated;
}

/**
 * A vencedora vira a Solicitação ao fornecedor (B7), uma por produto (mesmo
 * número, mesmo lote), já respondida com o preço e a condição cotados e com
 * o produto do catálogo ligado. Sem item de book: o produto já existe.
 */
async function supplierRequestsFromWinner(
  user: User,
  quote: PurchaseQuote,
  winner: PurchaseQuoteResponse,
  now: Date,
): Promise<SupplierRequest[]> {
  const store = getStore();
  const number = await store.nextNumber("supplier_request_number");
  const batchId = crypto.randomUUID();
  const out: SupplierRequest[] = [];
  const currency = SHEET_CURRENCIES.find((c) => c === winner.currency) ?? null;
  const incoterm = SHEET_INCOTERMS.find((c) => c === winner.incoterm) ?? null;
  // A amostragem vai com a vencedora: a aprovada na cotação ou, para o
  // fornecedor conhecido do produto, a dispensada (dono, 22/11/2026). Assim
  // a solicitação não pede a amostra de novo.
  const known = await soldBeforeProducts(
    winner.supplierId,
    quote.items.map((i) => i.productId),
  );
  for (const item of quote.items) {
    const sampled = winner.sampling?.[item.productId];
    const sampling =
      sampled?.status === "approved"
        ? sampled
        : known.has(item.productId)
          ? skippedSampling(now.toISOString())
          : null;
    const price =
      winner.prices?.find((p) => p.productId === item.productId)?.unitPrice ??
      null;
    // A ficha técnica que a vencedora informou (dono, 20/11/2026): a
    // solicitação já nasce com a embalagem e o peso dela.
    const sheet =
      winner.items?.find((i) => i.productId === item.productId)?.sheet ?? null;
    const inner = quoteInnerState(item.inner);
    // Item de book sem produto (dono, 26/11/2026): a solicitação nasce
    // ligada ao item do book, com a cópia dele e as condições da vencedora;
    // o produto nasce depois da aprovação, como na solicitação do book.
    if (item.book) {
      const book = item.book;
      const terms = quoteProductTerms(winner, item.productId);
      const request = await store.create("supplier_requests", {
        number,
        batchId,
        status: "answered",
        supplierId: winner.supplierId,
        bookingItemId: book.bookingItemId,
        bookingLotId: book.bookingLotId,
        alternativeItemIds: null,
        item: {
          ...book.snapshot,
          incoterm: incoterm ?? book.snapshot.incoterm,
          currency: currency ?? book.snapshot.currency,
          price: price ?? book.snapshot.price,
          moq: terms.moq ?? book.snapshot.moq,
        },
        ...(book.variant ? { variant: book.variant } : {}),
        ...(item.schedule ? { schedule: item.schedule } : {}),
        quantity: Math.round(item.quantity),
        unit: "pcs",
        needs: [
          `Cotação de compra nº ${quote.number}${winner.port ? ` · porto ${winner.port}` : ""}`,
          item.specification,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 4000),
        searchQuery: null,
        supplierCanDo: "yes",
        supplierPrice: price,
        supplierCurrency: currency,
        supplierMoq: terms.moq,
        supplierLeadTimeDays: terms.leadTimeDays,
        supplierIncoterm: incoterm,
        supplierNote: winner.note,
        respondedAt: winner.answeredAt ?? now.toISOString(),
        respondedByUserId: winner.answeredByUserId,
        decidedAt: null,
        decidedByUserId: null,
        decisionNote: null,
        createdByUserId: user.id,
        quoteResponseId: winner.id,
        demandIds: quote.demandIds,
        ...(sampling ? { sampling } : {}),
      });
      out.push(request);
      continue;
    }
    const request = await store.create("supplier_requests", {
      number,
      batchId,
      status: "answered",
      supplierId: winner.supplierId,
      // Sem book: a solicitação nasce da cotação, com o produto do catálogo.
      bookingItemId: "",
      bookingLotId: "",
      alternativeItemIds: null,
      item: {
        itemNumber: null,
        factoryItemCode: sheet?.factoryItemCode ?? null,
        productName: item.name,
        description: null,
        incoterm,
        currency,
        price,
        masterCartonQty: sheet?.masterBoxQty ?? null,
        // O inner é o exigido pelo cliente (dono, 21/11/2026); nas fichas
        // antigas, o que ele informava.
        innerQty:
          (inner.kind === "required" ? inner.qty : null) ??
          (sheet?.innerBoxQty || null),
        netWeightPcKg: sheet?.netWeightKg ?? null,
        // "Sem peso": a solicitação nasce sem o peso bruto.
        grossWeightPcKg:
          sheet && sheet.grossWeightBoxKg !== null
            ? sheet.grossWeightBoxKg / sheet.masterBoxQty
            : null,
        cbmPerCarton: sheet?.cbm ?? null,
        // Medidas da solicitação são do produto (as do Book); as da ficha
        // técnica são da caixa master: não entram aqui.
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        capacityMl: null,
        packageType: null,
        material: sheet?.material ?? null,
        moq: quoteProductTerms(winner, item.productId).moq,
        colorAssortment: null,
        powerDetail: null,
        photoDocumentId: null,
      },
      quantity: Math.round(item.quantity),
      unit: "pcs",
      needs: `Cotação de compra nº ${quote.number}${winner.port ? ` · porto ${winner.port}` : ""}`,
      searchQuery: null,
      supplierCanDo: "yes",
      supplierPrice: price,
      supplierCurrency: currency,
      // Prazo e mínimo do produto (dono, 23/11/2026).
      supplierMoq: quoteProductTerms(winner, item.productId).moq,
      supplierLeadTimeDays: quoteProductTerms(winner, item.productId)
        .leadTimeDays,
      supplierIncoterm: incoterm,
      supplierNote: winner.note,
      respondedAt: winner.answeredAt ?? now.toISOString(),
      respondedByUserId: winner.answeredByUserId,
      decidedAt: null,
      decidedByUserId: null,
      decisionNote: null,
      createdByUserId: user.id,
      productId: item.productId,
      productAction: "linked",
      productLinkedAt: now.toISOString(),
      productLinkedByUserId: user.id,
      quoteResponseId: winner.id,
      demandIds: quote.demandIds,
      ...(sampling ? { sampling } : {}),
    });
    out.push(request);
  }
  return out;
}

/** Sem resposta: o Comprador reabre por mais um prazo para quem não respondeu. */
export async function reopenQuote(
  user: User,
  quoteId: string,
  now = new Date(),
): Promise<number> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  const { quote, responses } = await loadOpen(quoteId);
  if (quote.status !== "open") throw new PurchaseQuoteError("quote_closed");
  const store = getStore();
  const dueAt = new Date(now.getTime() + quote.hours * HOUR).toISOString();
  const expired = responses.filter((r) => responseState(r, now) === "expired");
  if (!expired.length) throw new PurchaseQuoteError("quote_nothing_to_reopen");
  for (const r of expired) {
    await store.update("purchase_quote_responses", r.id, {
      dueAt,
      reminderSentAt: null,
    });
    await notify(
      { partyId: r.supplierId, role: "supplier" },
      {
        kind: "action",
        link: `/app/purchase-quotes/${quote.id}`,
        text: (t) => ({
          subject: t("quote.notify.reopen.subject", {
            n: String(quote.number),
          }),
          body: t("quote.notify.invite.body", { hours: String(quote.hours) }),
        }),
      },
    );
  }
  await store.update("purchase_quotes", quote.id, { emptyNotifiedAt: null });
  await audit(
    user,
    "purchase_quote.reopen",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number} reaberta por ${quote.hours} h para ${expired.length} fornecedor(es)`,
  );
  return expired.length;
}

/** Convida outros fornecedores ativos (cada um com o prazo cheio). */
export async function inviteMore(
  user: User,
  quoteId: string,
  supplierIds: string[],
  now = new Date(),
): Promise<number> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  const { quote, responses } = await loadOpen(quoteId);
  if (quote.status !== "open") throw new PurchaseQuoteError("quote_closed");
  const already = new Set(responses.map((r) => r.supplierId));
  const parties = supplierIds.length
    ? await getStore().list("parties", {
        filter: { id: [...new Set(supplierIds)] },
      })
    : [];
  // Fornecedor, Trading, Supplier e Factory (dono, 18/11/2026).
  const fresh = parties
    .filter((p) => servesFamilies(p.type) && p.active && !already.has(p.id))
    .map((p) => p.id);
  if (!fresh.length) throw new PurchaseQuoteError("quote_invite_none");
  await inviteSuppliers(quote, fresh, now);
  await getStore().update("purchase_quotes", quote.id, {
    emptyNotifiedAt: null,
  });
  await audit(
    user,
    "purchase_quote.invite",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: ${fresh.length} fornecedor(es) convidado(s)`,
  );
  return fresh.length;
}

/**
 * Volta para a estratégia de compra (para escolher o fornecedor da última
 * compra): a cotação é cancelada e as demandas voltam para a fila.
 */
export async function backToStrategy(
  user: User,
  quoteId: string,
): Promise<void> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  const { quote } = await loadOpen(quoteId);
  if (quote.status !== "open") throw new PurchaseQuoteError("quote_closed");
  const store = getStore();
  await store.update("purchase_quotes", quote.id, { status: "cancelled" });
  await store.update("purchase_decisions", quote.decisionId, {
    status: "rejected",
    approvalNote: "Cotação de compra cancelada: voltou para a estratégia.",
  });
  for (const id of quote.demandIds)
    await store.update("requests", id, {
      status: "REQUESTED",
      purchaseDecisionId: null,
    });
  await audit(
    user,
    "purchase_quote.back_to_strategy",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number} cancelada: as demandas voltaram para a estratégia de compra`,
  );
}

/**
 * A Wellmix define a caixa inner do item (dono, 21/11/2026): o produto
 * pedido sem o número, ou com exigências diferentes entre as demandas.
 * `qty` nulo = não exigir inner. Só com a cotação aberta; os fornecedores
 * passam a ver a exigência (quem já respondeu corrige no prazo).
 */
export async function setQuoteItemInner(
  user: User,
  quoteId: string,
  productId: string,
  qty: number | null,
  now = new Date(),
): Promise<PurchaseQuote> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  if (qty !== null && (!Number.isInteger(qty) || qty <= 0 || qty > 1_000_000))
    throw new PurchaseQuoteError("quote_inner_invalid");
  const { quote } = await loadOpen(quoteId);
  if (quote.status !== "open") throw new PurchaseQuoteError("quote_closed");
  const item = quote.items.find((i) => i.productId === productId);
  if (!item) throw new PurchaseQuoteError("quote_item_not_found");
  const before = item.inner ?? null;
  const items = quote.items.map((i) =>
    i.productId === productId
      ? {
          ...i,
          inner: {
            qty,
            issue: null,
            requested: before?.requested ?? null,
            setByUserId: user.id,
            setAt: now.toISOString(),
          },
        }
      : i,
  );
  const saved = await getStore().update("purchase_quotes", quote.id, {
    items,
  });
  await audit(
    user,
    "purchase_quote.inner",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}, ${item.name}: ${
      qty === null ? "sem inner exigido" : `inner exigido de ${qty} peças`
    }`,
    before,
    { qty },
  );
  return saved;
}

/**
 * Pendências da cotação de compra (passo "Cotação de compra" do menu): o
 * fornecedor responde a dele no prazo; o Comprador escolhe a vencedora (ou
 * decide o que fazer sem resposta) e define o inner que ficou a definir; a
 * Diretoria aprova a vencedora. As portas por ação ficam em
 * src/lib/task-owner.ts (kindGate).
 */
export async function quoteTaskDrafts(user: User, now = new Date()) {
  type Draft = {
    kind:
      | "purchase_quote_answer"
      | "purchase_quote_choose"
      | "purchase_quote_inner"
      | "purchase_quote_empty"
      | "purchase_quote_approve";
    title: string;
    detail: string;
    link: string;
    dueAt: string | null;
    /** Etapa do fornecedor (a cotação acende "Responder a solicitação"). */
    supplierStep?: SupplierStep;
    sinceAt?: string | null;
    text?: TaskText;
  };
  const drafts: Draft[] = [];
  const store = getStore();
  if (user.role === "supplier") {
    for (const { quote, response, state } of await supplierInvitations(
      user,
      now,
    ))
      if (
        quote.status === "open" &&
        (state === "open" ||
          // Contraproposta da Wellmix esperando: ele corrige a resposta
          // dentro do prazo novo (dono, 22/11/2026; docs/QUOTATION.md).
          (state === "answered" &&
            pendingQuoteProposals(response).length > 0 &&
            Date.parse(response.dueAt) > now.getTime()) ||
          // Amostra a enviar (ou reprovada): a cotação continua nas
          // Pendências dele até a Wellmix ter o que validar.
          (state === "answered" &&
            quoteSamplingToSend(
              response,
              quote.items.map((i) => i.productId),
              await soldBeforeProducts(
                response.supplierId,
                quote.items.map((i) => i.productId),
              ),
            ).length > 0))
      ) {
        // Nas Pendências do fornecedor, a cotação acende a etapa "Responder
        // a solicitação" (amarelo no prazo, vermelho atrasada) e, ao tocar
        // nela, a lista mostra a cotação (dono, 21/11/2026). Desde: o
        // convite; o texto no idioma de quem lê, com a quantidade.
        const first = quote.items[0];
        const more = quote.items.length - 1;
        drafts.push({
          kind: "purchase_quote_answer",
          title: `Cotação de compra nº ${quote.number}`,
          detail: quote.items.map((i) => i.name).join(", "),
          link: `/app/purchase-quotes/${quote.id}`,
          dueAt: response.dueAt,
          supplierStep: "request",
          sinceAt: response.invitedAt ?? null,
          text: {
            title: "quote.one",
            detail:
              more > 0
                ? "quote.task.answer.detailMore"
                : "quote.task.answer.detail",
            values: {
              n: quote.number,
              product: first?.name ?? "",
              unit: first?.unit ?? "",
              more,
            },
            numbers: { qty: first?.quantity ?? 0 },
          },
        });
      }
    return drafts;
  }
  if (!isWellmix(user)) return drafts;
  const quotes = await store
    .list("purchase_quotes", { filter: { status: ["open", "chosen"] } })
    .catch(() => [] as PurchaseQuote[]);
  if (!quotes.length) return drafts;
  const responses = await store.list("purchase_quote_responses", {
    filter: { quoteId: quotes.map((q) => q.id) },
  });
  for (const q of quotes) {
    const mine = responses.filter((r) => r.quoteId === q.id);
    const base = {
      title: `Cotação de compra nº ${q.number}`,
      detail: q.items.map((i) => i.name).join(", "),
      link: `/app/purchase-quotes/${q.id}`,
      dueAt: null,
    };
    // Inner do cliente a definir (dono, 21/11/2026): uma pendência por
    // produto, enquanto a cotação está aberta.
    if (q.status === "open")
      for (const item of q.items)
        if (quoteInnerState(item.inner).kind === "pending")
          drafts.push({
            ...base,
            kind: "purchase_quote_inner",
            detail: item.name,
          });
    if (q.status === "chosen")
      drafts.push({ ...base, kind: "purchase_quote_approve" });
    else if (quoteEmpty(mine, now))
      drafts.push({ ...base, kind: "purchase_quote_empty" });
    else if (quoteClosed(mine, now))
      drafts.push({ ...base, kind: "purchase_quote_choose" });
  }
  return drafts;
}

/* ------------------------------------------------------------------------ */
/* Fornecedor × linha (cadastro)                                            */
/* ------------------------------------------------------------------------ */

/** As linhas que o fornecedor atende (cadastro explícito). */
export async function supplierLineIds(supplierId: string): Promise<string[]> {
  const rows = await getStore()
    .list("supplier_lines", { filter: { supplierId } })
    .catch(() => []);
  return rows.map((r) => r.lineId).sort();
}

/**
 * Grava as linhas que o fornecedor atende (Cadastros → fornecedor): quem
 * entra na cotação de compra de cada linha. Troca a lista inteira.
 */
export async function setSupplierLines(
  user: User,
  supplierId: string,
  lineIds: string[],
): Promise<void> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  const { assertScreen } = await import("@/lib/auth/screens");
  assertScreen(user, "parties");
  const store = getStore();
  const supplier = await store.get("parties", supplierId);
  if (!supplier || supplier.type !== "supplier")
    throw new PurchaseQuoteError("not_found");
  const wanted = new Set(lineIds);
  const current = await store.list("supplier_lines", {
    filter: { supplierId },
  });
  for (const row of current)
    if (!wanted.has(row.lineId)) await store.remove("supplier_lines", row.id);
  const have = new Set(current.map((r) => r.lineId));
  for (const lineId of wanted)
    if (!have.has(lineId))
      await store.create("supplier_lines", {
        supplierId,
        lineId,
        createdByUserId: user.id,
      });
  await audit(
    user,
    "supplier.lines",
    "party",
    supplierId,
    `Linhas atendidas por ${supplier.name}: ${[...wanted].join(", ") || "nenhuma"}`,
  );
}
