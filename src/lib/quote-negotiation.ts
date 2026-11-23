import type {
  PurchaseQuoteResponse,
  QuoteNegotiationEvent,
  QuoteResponsePrice,
} from "@/lib/db/schema";

/*
 * Negociação dentro da cotação de compra (dono, 22/11/2026;
 * docs/QUOTATION.md): a sequência de respostas do fornecedor e de
 * contrapropostas da Wellmix para um produto, e a conversa do par
 * fornecedor × produto. Regra pura: sem banco, sem tela.
 */

export const QUOTE_NEGOTIATION_MAX = 200;

type Negotiated = Pick<
  PurchaseQuoteResponse,
  | "negotiation"
  | "status"
  | "prices"
  | "currency"
  | "incoterm"
  | "leadTimeDays"
  | "moq"
  | "port"
  | "note"
  | "answeredAt"
  | "answeredByUserId"
>;

/** Um passo do histórico do par fornecedor × produto. */
export interface QuoteHistoryEntry {
  id: string;
  at: string;
  kind: "answer" | "decline" | "proposal";
  side: "wellmix" | "supplier";
  byUserId: string | null;
  price: number | null;
  currency: string | null;
  incoterm: string | null;
  moq: number | null;
  leadTimeDays: number | null;
  port: string | null;
  text: string | null;
}

const priceOf = (
  prices: PurchaseQuoteResponse["prices"] | undefined,
  productId: string,
) => prices?.find((p) => p.productId === productId)?.unitPrice ?? null;

/**
 * Prazo de produção e pedido mínimo de um produto na resposta (dono,
 * 23/11/2026): o do produto; nas respostas antigas, o da cotação inteira.
 */
export function quoteProductTerms(
  source: {
    prices?: readonly QuoteResponsePrice[] | null;
    leadTimeDays?: number | null;
    moq?: number | null;
  },
  productId: string,
): { leadTimeDays: number | null; moq: number | null } {
  const own = source.prices?.find((p) => p.productId === productId);
  return {
    leadTimeDays: own?.leadTimeDays ?? source.leadTimeDays ?? null,
    moq: own?.moq ?? source.moq ?? null,
  };
}

/**
 * Prazo e pedido mínimo da resposta inteira (o resumo gravado na resposta,
 * para as telas e os registros que ainda leem um número só): o maior prazo
 * e o maior mínimo entre os produtos.
 */
export function quoteTermsSummary(prices: readonly QuoteResponsePrice[]): {
  leadTimeDays: number | null;
  moq: number | null;
} {
  const max = (values: Array<number | null | undefined>) => {
    const known = values.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    return known.length ? Math.max(...known) : null;
  };
  return {
    leadTimeDays: max(prices.map((p) => p.leadTimeDays)),
    moq: max(prices.map((p) => p.moq)),
  };
}

/**
 * Propostas e contrapropostas do produto, da mais antiga para a mais nova.
 * Resposta de antes do histórico (sem eventos): a resposta de hoje, uma vez.
 */
export function quoteProductHistory(
  response: Negotiated,
  productId: string,
): QuoteHistoryEntry[] {
  const events = response.negotiation ?? [];
  const out: QuoteHistoryEntry[] = [];
  for (const e of events) {
    if (e.kind === "message") continue;
    if (e.kind === "proposal" && e.productId !== productId) continue;
    out.push({
      id: e.id,
      at: e.at,
      kind: e.kind,
      side: e.side,
      byUserId: e.byUserId,
      price:
        e.kind === "proposal"
          ? (e.price ?? null)
          : priceOf(e.prices, productId),
      currency: e.currency ?? null,
      incoterm: e.incoterm ?? null,
      // Na resposta, o prazo e o mínimo são os do produto.
      ...(e.kind === "proposal"
        ? { moq: e.moq ?? null, leadTimeDays: e.leadTimeDays ?? null }
        : quoteProductTerms(e, productId)),
      port: e.port ?? null,
      text: e.text ?? null,
    });
  }
  const recorded = events.some(
    (e) => e.kind === "answer" || e.kind === "decline",
  );
  if (!recorded && response.status !== "invited" && response.answeredAt)
    out.unshift({
      id: "legacy",
      at: response.answeredAt,
      kind: response.status === "declined" ? "decline" : "answer",
      side: "supplier",
      byUserId: response.answeredByUserId,
      price: priceOf(response.prices, productId),
      currency: response.currency,
      incoterm: response.incoterm,
      ...quoteProductTerms(response, productId),
      port: response.port,
      text: response.note,
    });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Mensagens da conversa do par (as sem produto valem para todos). */
export function quoteProductMessages(
  response: Pick<PurchaseQuoteResponse, "negotiation">,
  productId: string | null,
): QuoteNegotiationEvent[] {
  return (response.negotiation ?? []).filter(
    (e) =>
      e.kind === "message" &&
      (productId === null || !e.productId || e.productId === productId),
  );
}

/**
 * Contrapropostas esperando o fornecedor: as enviadas depois da última
 * resposta dele (uma por produto, a mais nova).
 */
export function pendingQuoteProposals(
  response: Pick<PurchaseQuoteResponse, "negotiation">,
): QuoteNegotiationEvent[] {
  const events = response.negotiation ?? [];
  const lastAnswer = events
    .filter((e) => e.kind === "answer" || e.kind === "decline")
    .map((e) => e.at)
    .sort()
    .at(-1);
  const byProduct = new Map<string, QuoteNegotiationEvent>();
  for (const e of events)
    if (e.kind === "proposal" && (!lastAnswer || e.at > lastAnswer))
      byProduct.set(e.productId ?? "", e);
  return [...byProduct.values()];
}

/** Dá para devolver com contraproposta: cotação aberta e o fornecedor respondeu. */
export const canCounterQuote = (
  quoteStatus: string,
  response: Pick<PurchaseQuoteResponse, "status">,
) => quoteStatus === "open" && response.status === "answered";

/** A conversa segue enquanto a cotação não foi aprovada nem cancelada. */
export const canMessageQuote = (
  quoteStatus: string,
  response: Pick<PurchaseQuoteResponse, "status">,
) =>
  (quoteStatus === "open" || quoteStatus === "chosen") &&
  response.status !== "declined";

export const appendQuoteEvent = (
  response: Pick<PurchaseQuoteResponse, "negotiation">,
  event: QuoteNegotiationEvent,
) => [...(response.negotiation ?? []), event].slice(-QUOTE_NEGOTIATION_MAX);
