/*
 * Cotação: negociação e proposta de embalagem (docs/QUOTE_FLOW.md). Regra
 * pura, usada pelo serviço e pela tela.
 *
 * Negociação: a Wellmix devolve a cotação com um comentário (o motivo fica
 * registrado) e, se quiser, uma contraproposta de preço; o fornecedor aceita,
 * manda outro preço ou mantém o dele. Enquanto a devolução espera resposta,
 * a escolha do fornecedor fica parada.
 *
 * Proposta de embalagem: a Wellmix envia a imagem (e o prompt que a gerou);
 * o fornecedor responde OK ou Não. Com proposta enviada, a escolha do
 * fornecedor espera o OK.
 */

/** Contraproposta sugerida: preço da cotação menos este % (a pessoa pode mudar). */
export const NEGOTIATION_DISCOUNT_PCT = 10;
/** Teto de rodadas guardadas por cotação. */
export const NEGOTIATION_MAX_ROUNDS = 30;

/**
 * "offer" e "confirm" são do preço desejado (solicitação que nasce do
 * Booking): a Wellmix já diz quanto quer pagar ("offer") e o fornecedor
 * confirma ("confirm") ou manda o preço dele ("counter").
 */
export type NegotiationKind =
  "return" | "accept" | "counter" | "keep" | "offer" | "confirm";
/** Resposta ao preço desejado: confirma ou manda outro preço. */
export const OFFER_REPLIES = ["confirm", "counter"] as const;
export type OfferReply = (typeof OFFER_REPLIES)[number];

/** O preço desejado enviado ao fornecedor (a rodada "offer"), se houve. */
export function offerRoundOf(
  rounds: NegotiationRound[] | null | undefined,
): NegotiationRound | null {
  return rounds?.find((r) => r.kind === "offer") ?? null;
}

/**
 * Preço que a devolução já sugere: o desejado enviado ao fornecedor, quando
 * ele respondeu com um preço maior; senão, o da cotação menos o desconto.
 */
export function suggestedReturnPrice(
  price: number | null | undefined,
  rounds: NegotiationRound[] | null | undefined,
): { price: number | null; fromOffer: boolean } {
  const wanted = offerRoundOf(rounds)?.targetPrice;
  if (typeof wanted === "number" && typeof price === "number" && wanted < price)
    return { price: wanted, fromOffer: true };
  return { price: suggestedTargetPrice(price), fromOffer: false };
}
export const NEGOTIATION_REPLIES = ["accept", "counter", "keep"] as const;
export type NegotiationReply = (typeof NEGOTIATION_REPLIES)[number];

export interface NegotiationRound {
  at: string;
  byUserId: string;
  byName: string;
  /** Quem escreveu: a Wellmix (devolução) ou o fornecedor (resposta). */
  side: "wellmix" | "supplier";
  kind: NegotiationKind;
  comment: string | null;
  currency: string | null;
  /** Devolução: o preço que a Wellmix propõe (opcional). */
  targetPrice?: number | null;
  /** Preço da cotação antes e depois desta rodada. */
  previousPrice?: number | null;
  price?: number | null;
}

/** A devolução que ainda espera resposta do fornecedor (ou nulo). */
export function pendingReturn(
  rounds: NegotiationRound[] | null | undefined,
): NegotiationRound | null {
  const last = rounds?.length ? rounds[rounds.length - 1] : null;
  return last && last.kind === "return" ? last : null;
}

/** Preço menos o desconto sugerido, com até 4 casas. */
export function suggestedTargetPrice(
  price: number | null | undefined,
  pct: number = NEGOTIATION_DISCOUNT_PCT,
): number | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0)
    return null;
  const target = Math.round(price * (1 - pct / 100) * 10000) / 10000;
  return target > 0 ? target : null;
}

export type PackagingDecision = "ok" | "no";

export interface PackagingProposalVersion {
  version: number;
  prompt: string | null;
  imageDocumentId: string | null;
  sentAt: string;
  sentByUserId: string;
  sentByName: string;
  decision: PackagingDecision | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  decidedByName: string | null;
  comment: string | null;
}

export interface PackagingProposal extends PackagingProposalVersion {
  /** Versões anteriores (a mais antiga primeiro). */
  history?: PackagingProposalVersion[];
}

export type PackagingProposalState = "none" | "waiting" | "ok" | "no";

export function packagingProposalState(
  proposal: PackagingProposal | null | undefined,
): PackagingProposalState {
  if (!proposal) return "none";
  return proposal.decision === "ok"
    ? "ok"
    : proposal.decision === "no"
      ? "no"
      : "waiting";
}
