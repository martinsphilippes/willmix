import "server-only";

import { getStore, type Quote, type Request, type User } from "@/lib/db";
import {
  ForbiddenError,
  assertWellmix,
  isWellmix,
} from "@/lib/auth/permissions";
import {
  NEGOTIATION_MAX_ROUNDS,
  packagingProposalState,
  pendingReturn,
  type NegotiationReply,
  type NegotiationRound,
  type OfferReply,
  type PackagingDecision,
  type PackagingProposal,
  type PackagingProposalVersion,
} from "@/lib/quote-flow";
import { formatAmount } from "@/lib/workflow/money";
import { audit } from "./audit";
import { notify, notifyWellmix } from "./notifications";

/*
 * Cotação: negociação e proposta de embalagem (docs/QUOTE_FLOW.md).
 * - Devolver com comentário (Wellmix) e responder (fornecedor da cotação, ou
 *   a Wellmix registrando a resposta dele).
 * - Enviar a proposta de embalagem (Wellmix) e dar o OK ou o Não (fornecedor
 *   da cotação, ou a Wellmix registrando).
 * Cada passo fica na auditoria, com antes e depois, e avisa o outro lado.
 */

export class QuoteFlowError extends Error {}

const COMMENT_MIN = 3;
const COMMENT_MAX = 1000;
const PROMPT_MAX = 2000;
const PRICE_MAX = 1_000_000_000;

const validPrice = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 && n <= PRICE_MAX;

function cleanComment(raw: string | null | undefined, required: boolean) {
  const text = (raw ?? "").trim();
  if (text.length > COMMENT_MAX) throw new QuoteFlowError("comment_too_long");
  if (required && text.length < COMMENT_MIN)
    throw new QuoteFlowError("comment_required");
  return text || null;
}

/** Fornecedor da cotação, ou a Wellmix (que pode registrar no lugar dele). */
function assertSupplierSide(user: User, quote: Quote) {
  if (isWellmix(user)) return;
  if (
    user.role === "supplier" &&
    !!user.partyId &&
    quote.supplierId === user.partyId
  )
    return;
  throw new ForbiddenError();
}

async function loadQuote(quoteId: string) {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) throw new QuoteFlowError("not_found");
  const request = await store.get("requests", quote.requestId);
  if (!request) throw new QuoteFlowError("not_found");
  return { store, quote, request };
}

const money = (price: number | null | undefined, currency: string | null) =>
  typeof price === "number" ? formatAmount(price, currency || "USD") : "—";

/* ------------------------------------------------------------------------ */
/* Negociação                                                                 */
/* ------------------------------------------------------------------------ */

export interface ReturnQuoteInput {
  comment: string;
  /** Contraproposta de preço (opcional), na moeda da cotação. */
  targetPrice: number | null;
}

/**
 * A Wellmix não aceita a cotação como está: devolve com o motivo e, se
 * quiser, o preço que propõe. Só cotação respondida, com preço, e sem outra
 * devolução esperando resposta.
 */
export async function returnQuote(
  user: User,
  quoteId: string,
  input: ReturnQuoteInput,
): Promise<Quote> {
  assertWellmix(user);
  const { store, quote, request } = await loadQuote(quoteId);
  if (quote.status !== "answered" || !validPrice(quote.price))
    throw new QuoteFlowError("negotiation_not_answered");
  const rounds = quote.negotiation ?? [];
  if (pendingReturn(rounds)) throw new QuoteFlowError("negotiation_pending");
  if (rounds.length >= NEGOTIATION_MAX_ROUNDS)
    throw new QuoteFlowError("negotiation_too_many");
  const comment = cleanComment(input.comment, true);
  const target = input.targetPrice;
  if (target !== null && (!validPrice(target) || target >= quote.price))
    throw new QuoteFlowError("negotiation_target_invalid");
  const round: NegotiationRound = {
    at: new Date().toISOString(),
    byUserId: user.id,
    byName: user.name,
    side: "wellmix",
    kind: "return",
    comment,
    currency: quote.currency,
    targetPrice: target,
    previousPrice: quote.price,
    price: quote.price,
  };
  const updated = await store.update("quotes", quote.id, {
    negotiation: [...rounds, round],
  });
  await audit(
    user,
    "quote.return",
    "quote",
    quote.id,
    `Cotação devolvida com comentário${
      target !== null
        ? ` (contraproposta ${money(target, quote.currency)}; preço ${money(quote.price, quote.currency)})`
        : ""
    }: ${comment}`,
    { price: quote.price },
    { targetPrice: target, comment },
  );
  await notify(
    { role: "supplier", partyId: quote.supplierId },
    {
      kind: "action",
      actor: "recipient",
      link: `/app/quotes/${quote.id}#negotiation`,
      text: (t) => ({
        subject: t("notif.quoteReturned.subject", {
          product: request.productName,
        }),
        body:
          target !== null
            ? t("notif.quoteReturned.bodyTarget", {
                comment: comment ?? "",
                target: money(target, quote.currency),
              })
            : t("notif.quoteReturned.body", { comment: comment ?? "" }),
      }),
    },
  );
  return updated;
}

export interface ReplyNegotiationInput {
  decision: NegotiationReply;
  /** Novo preço (só em "counter"). */
  price: number | null;
  comment: string | null;
}

/**
 * Resposta do fornecedor à devolução: aceita a contraproposta, manda outro
 * preço (a tréplica) ou mantém o dele (com o motivo). O preço novo vale na
 * cotação e na ficha da cotação.
 */
export async function replyNegotiation(
  user: User,
  quoteId: string,
  input: ReplyNegotiationInput,
): Promise<Quote> {
  const { store, quote, request } = await loadQuote(quoteId);
  assertSupplierSide(user, quote);
  if (quote.status !== "answered")
    throw new QuoteFlowError("negotiation_not_answered");
  const rounds = quote.negotiation ?? [];
  const pending = pendingReturn(rounds);
  if (!pending) throw new QuoteFlowError("negotiation_none");
  let price = quote.price;
  if (input.decision === "accept") {
    if (!validPrice(pending.targetPrice))
      throw new QuoteFlowError("negotiation_no_target");
    price = pending.targetPrice;
  } else if (input.decision === "counter") {
    if (!validPrice(input.price))
      throw new QuoteFlowError("negotiation_price_invalid");
    price = input.price;
  }
  const comment = cleanComment(input.comment, input.decision === "keep");
  const round: NegotiationRound = {
    at: new Date().toISOString(),
    byUserId: user.id,
    byName: user.name,
    side: "supplier",
    kind: input.decision,
    comment,
    currency: quote.currency,
    previousPrice: quote.price,
    price,
  };
  const changed = price !== quote.price;
  const updated = await store.update("quotes", quote.id, {
    negotiation: [...rounds, round],
    ...(changed ? { price, answeredAt: round.at } : {}),
  });
  if (changed) {
    // A ficha da cotação acompanha (é dela que a conta do valor ao cliente lê).
    const [sheet] = await store.list("purchase_sheets", {
      filter: { orderId: quote.id },
      limit: 1,
    });
    if (sheet && sheet.price !== price)
      await store.update("purchase_sheets", sheet.id, { price });
  }
  await audit(
    user,
    "quote.negotiation_reply",
    "quote",
    quote.id,
    `Resposta à devolução (${input.decision}): ${money(quote.price, quote.currency)} → ${money(price, quote.currency)}${
      comment ? `: ${comment}` : ""
    }${isWellmix(user) ? " (registrada pela Wellmix)" : ""}`,
    { price: quote.price },
    { price, decision: input.decision },
  );
  await notifyWellmix({
    kind: "action",
    subject: `Negociação respondida: ${request.productName}`,
    body:
      input.decision === "keep"
        ? `O fornecedor manteve ${money(price, quote.currency)}. ${comment ?? ""}`.trim()
        : `Preço novo: ${money(price, quote.currency)} (antes ${money(quote.price, quote.currency)}). ${comment ?? ""}`.trim(),
    link: `/app/requests/${request.id}`,
  });
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Preço desejado (solicitação que nasce do Booking)                         */
/* ------------------------------------------------------------------------ */

/** O preço que a Wellmix quer pagar, na moeda da cotação. */
export interface QuoteOffer {
  price: number;
  currency: string;
  /** Prazo de produção que já se conhece deste fornecedor (ele confirma). */
  leadTimeDays: number | null;
}

const LEAD_TIME_MAX = 3650;

/** Moeda da ficha ("RMB") na moeda da cotação ("CNY"). */
const quoteCurrency = (c: string | null | undefined) => {
  const v = (c ?? "").toUpperCase();
  if (v === "RMB" || v === "CNY") return "CNY";
  return v === "USD" || v === "EUR" || v === "BRL" ? v : null;
};

/**
 * Solicitação gerada pelo Booking: o lançamento já tem o preço que a Wellmix
 * quer pagar (o da ficha do produto, que a equipe ajusta na tabela do
 * Booking). O fornecedor do produto, em vez de preencher a cotação inteira,
 * recebe esse preço e confirma ou manda o dele.
 *
 * Vale só enquanto a cotação espera a primeira resposta, e só para o
 * fornecedor principal do produto: o preço é o da ficha dele, e não é
 * mostrado aos outros convidados (isolamento entre fornecedores). É lido na
 * hora (nada é gravado até ele responder), então a RFQ aberta antes desta
 * regra também ganha o preço.
 */
export async function quoteOfferFor(
  quote: Pick<Quote, "status" | "supplierId" | "negotiation">,
  request: Pick<Request, "id" | "productId">,
): Promise<QuoteOffer | null> {
  if (quote.status !== "invited" || !request.productId) return null;
  if (quote.negotiation?.length) return null;
  const store = getStore();
  const [product, bookings] = await Promise.all([
    store.get("products", request.productId),
    store.list("bookings", { filter: { requestId: request.id }, limit: 1 }),
  ]);
  if (!product || !bookings.length) return null;
  if (!product.supplierId || product.supplierId !== quote.supplierId)
    return null;
  const { getProductSheet } = await import("./product-sheet");
  const sheet = await getProductSheet(product.id);
  const price = sheet?.price ?? product.price ?? null;
  const currency = quoteCurrency(sheet?.currency ?? product.currency);
  if (!validPrice(price) || !currency) return null;
  const { listProductSuppliers } = await import("./product-suppliers");
  const link = (await listProductSuppliers(product.id)).find(
    (l) => l.supplierId === quote.supplierId,
  );
  return { price, currency, leadTimeDays: link?.leadTimeDays ?? null };
}

export interface ReplyQuoteOfferInput {
  decision: OfferReply;
  /** O preço do fornecedor (só em "counter"). */
  price: number | null;
  /** Prazo de produção, em dias. */
  leadTimeDays: number;
  comment: string | null;
}

/**
 * Resposta do fornecedor ao preço desejado: confirma (a cotação fica
 * respondida com esse preço, sem a ficha inteira) ou manda o preço dele (a
 * cotação fica respondida com o dele e a Wellmix é avisada para conversar e
 * negociar: chat e "devolver com comentário"). O fornecedor da cotação, ou a
 * Wellmix registrando por ele.
 */
export async function replyQuoteOffer(
  user: User,
  quoteId: string,
  input: ReplyQuoteOfferInput,
): Promise<Quote> {
  const { store, quote, request } = await loadQuote(quoteId);
  assertSupplierSide(user, quote);
  const offer = await quoteOfferFor(quote, request);
  if (!offer) throw new QuoteFlowError("offer_none");
  if (
    !Number.isInteger(input.leadTimeDays) ||
    input.leadTimeDays < 1 ||
    input.leadTimeDays > LEAD_TIME_MAX
  )
    throw new QuoteFlowError("offer_lead_time_required");
  let price = offer.price;
  if (input.decision === "counter") {
    if (!validPrice(input.price))
      throw new QuoteFlowError("offer_price_required");
    price = input.price;
  }
  // Outro preço igual ao desejado é uma confirmação.
  const decision: OfferReply = price === offer.price ? "confirm" : "counter";
  const comment = cleanComment(input.comment, false);
  // A resposta da cotação pelos caminhos de sempre (situação, vínculo do
  // fornecedor com o produto, auditoria e aviso à Wellmix).
  const { answerQuote } = await import("./requests");
  await answerQuote(user, quote.id, {
    price,
    currency: offer.currency,
    leadTimeDays: input.leadTimeDays,
    conditions: comment,
  });
  const at = new Date().toISOString();
  const rounds: NegotiationRound[] = [
    {
      at,
      byUserId: "",
      byName: "Wellmix",
      side: "wellmix",
      kind: "offer",
      comment: null,
      currency: offer.currency,
      targetPrice: offer.price,
      previousPrice: null,
      price: null,
    },
    {
      at,
      byUserId: user.id,
      byName: user.name,
      side: "supplier",
      kind: decision,
      comment,
      currency: offer.currency,
      previousPrice: offer.price,
      price,
    },
  ];
  const updated = await store.update("quotes", quote.id, {
    negotiation: rounds,
  });
  await audit(
    user,
    "quote.offer_reply",
    "quote",
    quote.id,
    `Preço desejado ${money(offer.price, offer.currency)}: ${
      decision === "confirm"
        ? "confirmado pelo fornecedor"
        : `o fornecedor mandou ${money(price, offer.currency)}`
    }, prazo ${input.leadTimeDays} dias${comment ? `: ${comment}` : ""}${
      isWellmix(user) ? " (registrado pela Wellmix)" : ""
    }`,
    { offered: offer.price },
    { price, decision, leadTimeDays: input.leadTimeDays },
  );
  if (decision === "counter")
    await notifyWellmix({
      kind: "action",
      subject: `Preço diferente do desejado: ${request.productName}`,
      body: `O fornecedor mandou ${money(price, offer.currency)} (o desejado era ${money(offer.price, offer.currency)}). ${comment ?? ""} Converse com ele pelas mensagens ou devolva a cotação com o preço que propõe.`
        .replace(/\s+/g, " ")
        .trim(),
      link: `/app/quotes/${quote.id}#negotiation`,
    });
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Proposta de embalagem                                                      */
/* ------------------------------------------------------------------------ */

export interface SendPackagingProposalInput {
  prompt: string | null;
  /** A imagem da proposta (arquivo enviado agora). */
  image: File;
}

/**
 * A Wellmix envia a proposta de embalagem ao fornecedor da cotação: a imagem
 * (gerada fora do portal) e o prompt que a gerou. Uma proposta nova guarda a
 * anterior no histórico e volta a esperar a resposta.
 */
export async function sendPackagingProposal(
  user: User,
  quoteId: string,
  input: SendPackagingProposalInput,
): Promise<Quote> {
  assertWellmix(user);
  const { store, quote, request } = await loadQuote(quoteId);
  if (quote.status !== "invited" && quote.status !== "answered")
    throw new QuoteFlowError("proposal_closed");
  const prompt = (input.prompt ?? "").trim();
  if (prompt.length > PROMPT_MAX) throw new QuoteFlowError("prompt_too_long");
  if (!input.image.type.startsWith("image/"))
    throw new QuoteFlowError("proposal_image_required");
  const { uploadDocument } = await import("./documents");
  const doc = await uploadDocument(user, input.image, {
    quoteId: quote.id,
    type: "art",
    visibility: "supplier",
  });
  const before = quote.packagingProposal ?? null;
  const { history: _history, ...previous } = before ?? { history: [] };
  void _history;
  const history: PackagingProposalVersion[] = before
    ? [...(before.history ?? []), previous as PackagingProposalVersion].slice(
        -20,
      )
    : [];
  const proposal: PackagingProposal = {
    version: (before?.version ?? 0) + 1,
    prompt: prompt || null,
    imageDocumentId: doc.id,
    sentAt: new Date().toISOString(),
    sentByUserId: user.id,
    sentByName: user.name,
    decision: null,
    decidedAt: null,
    decidedByUserId: null,
    decidedByName: null,
    comment: null,
    history,
  };
  const updated = await store.update("quotes", quote.id, {
    packagingProposal: proposal,
  });
  await audit(
    user,
    "quote.packaging_proposal",
    "quote",
    quote.id,
    `Proposta de embalagem v${proposal.version} enviada ao fornecedor`,
    before ? { version: before.version, decision: before.decision } : null,
    { version: proposal.version, imageDocumentId: doc.id },
  );
  await notify(
    { role: "supplier", partyId: quote.supplierId },
    {
      kind: "action",
      actor: "recipient",
      link: `/app/quotes/${quote.id}#packaging-proposal`,
      text: (t) => ({
        subject: t("notif.packagingProposal.subject", {
          product: request.productName,
        }),
        body: t("notif.packagingProposal.body"),
      }),
    },
  );
  return updated;
}

export interface DecidePackagingProposalInput {
  decision: PackagingDecision;
  comment: string | null;
}

/** O fornecedor dá o OK ou diz Não (com o motivo) à proposta de embalagem. */
export async function decidePackagingProposal(
  user: User,
  quoteId: string,
  input: DecidePackagingProposalInput,
): Promise<Quote> {
  const { store, quote, request } = await loadQuote(quoteId);
  assertSupplierSide(user, quote);
  const proposal = quote.packagingProposal ?? null;
  if (packagingProposalState(proposal) !== "waiting" || !proposal)
    throw new QuoteFlowError("proposal_not_waiting");
  if (quote.status === "selected" || quote.status === "rejected")
    throw new QuoteFlowError("proposal_closed");
  const comment = cleanComment(input.comment, input.decision === "no");
  const next: PackagingProposal = {
    ...proposal,
    decision: input.decision,
    decidedAt: new Date().toISOString(),
    decidedByUserId: user.id,
    decidedByName: user.name,
    comment,
  };
  const updated = await store.update("quotes", quote.id, {
    packagingProposal: next,
  });
  await audit(
    user,
    "quote.packaging_decision",
    "quote",
    quote.id,
    `Proposta de embalagem v${proposal.version}: ${
      input.decision === "ok" ? "OK do fornecedor" : "fornecedor disse não"
    }${comment ? `: ${comment}` : ""}${
      isWellmix(user) ? " (registrado pela Wellmix)" : ""
    }`,
    { decision: null },
    { decision: input.decision, comment },
  );
  await notifyWellmix(
    input.decision === "ok"
      ? {
          kind: "done",
          subject: `Embalagem aprovada pelo fornecedor: ${request.productName}`,
          body: comment ?? "O fornecedor deu o OK na proposta de embalagem.",
          link: `/app/requests/${request.id}`,
        }
      : {
          kind: "alert",
          subject: `Fornecedor recusou a embalagem: ${request.productName}`,
          body: `${comment ?? ""} Reveja a seleção: envie outra proposta ou escolha outro fornecedor.`.trim(),
          link: `/app/quotes/${quote.id}#packaging-proposal`,
        },
  );
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Travas da escolha do fornecedor                                            */
/* ------------------------------------------------------------------------ */

/**
 * Escolher o fornecedor (seleção direta ou envio para aprovação) espera: a
 * resposta de uma devolução em aberto e, quando há proposta de embalagem
 * enviada, o OK do fornecedor. Cotação sem negociação nem proposta segue
 * como sempre.
 */
export async function assertQuoteFlowSettled(
  _request: Pick<Request, "id">,
  quote: Pick<Quote, "negotiation" | "packagingProposal">,
) {
  const { RequestError } = await import("./requests");
  if (pendingReturn(quote.negotiation))
    throw new RequestError("negotiation_pending");
  const state = packagingProposalState(quote.packagingProposal);
  if (state === "waiting") throw new RequestError("packaging_ok_waiting");
  if (state === "no") throw new RequestError("packaging_ok_refused");
}
