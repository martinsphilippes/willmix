import type {
  BookingInvite,
  PurchaseQuote,
  PurchaseQuoteResponse,
  SupplierRequest,
} from "@/lib/db/schema";
import { quoteNeedsSampling, quoteSamplingOf } from "@/lib/quote-sampling";
import { samplingOf, samplingRequired } from "@/lib/supplier-request-sampling";

/*
 * Completude de cada linha da lista de Consultas (dono, 27/11/2026): quanto
 * do que a consulta pede já foi resolvido, em etapas. Regras puras, sem
 * banco. A consulta encerrada (recusada, cancelada) conta como resolvida.
 *
 * - Solicitação ao fornecedor: por produto, a resposta do fornecedor, a
 *   decisão da Wellmix e, com "Necessita amostragem", a amostra aprovada.
 * - Cotação de compra (a resposta de um fornecedor): por produto, o preço
 *   enviado e, com "Necessita amostragem" (sem o conhecido do produto), a
 *   amostra aprovada.
 * - Cotação de compra na visão da Wellmix: cada convidado respondido (ou que
 *   recusou) e a escolha da vencedora.
 * - Convite de book: o book enviado.
 */

export interface Completion {
  done: number;
  total: number;
  /** 0 a 100, arredondado para baixo (só 100 com tudo resolvido). */
  percent: number;
}

export function completion(done: number, total: number): Completion {
  const d = Math.max(0, Math.min(done, total));
  return {
    done: d,
    total,
    percent: total > 0 ? Math.floor((d / total) * 100) : 0,
  };
}

const CLOSED: readonly string[] = ["declined", "cancelled"];

type RequestLine = Pick<
  SupplierRequest,
  | "status"
  | "supplierCanDo"
  | "decidedAt"
  | "updatedAt"
  | "sampling"
  | "samplingNeed"
>;

/** Solicitação ao fornecedor (os produtos da mesma solicitação). */
export function requestCompletion(
  products: readonly RequestLine[],
): Completion {
  let done = 0;
  let total = 0;
  for (const p of products) {
    const needs = samplingRequired(p);
    const steps = needs ? 3 : 2;
    total += steps;
    if (CLOSED.includes(p.status)) {
      done += steps;
      continue;
    }
    if (p.supplierCanDo) done += 1;
    if (p.status === "approved") {
      done += 1;
      if (needs && samplingOf(p)?.status === "approved") done += 1;
    }
  }
  return completion(done, total);
}

/** A resposta de um fornecedor à cotação de compra (a visão dele). */
export function quoteResponseCompletion(
  quote: Pick<PurchaseQuote, "items" | "status"> & {
    samplingNeed?: PurchaseQuote["samplingNeed"];
  },
  response: Pick<
    PurchaseQuoteResponse,
    "status" | "prices" | "sampling" | "invitedAt"
  >,
  known: ReadonlySet<string> = new Set(),
): Completion {
  const productIds = [...new Set(quote.items.map((i) => i.productId))];
  const needs = quoteNeedsSampling(quote, response);
  let done = 0;
  let total = 0;
  for (const id of productIds) {
    const sample = needs && !known.has(id);
    const steps = sample ? 2 : 1;
    total += steps;
    if (response.status === "declined" || quote.status === "cancelled") {
      done += steps;
      continue;
    }
    if (
      response.status === "answered" &&
      (response.prices ?? []).some((p) => p.productId === id)
    )
      done += 1;
    if (sample && quoteSamplingOf(response, id, false)?.status === "approved")
      done += 1;
  }
  return completion(done, total);
}

/** A cotação de compra na visão da Wellmix: respostas e a escolha. */
export function quoteCompletion(
  quote: Pick<PurchaseQuote, "status">,
  responses: ReadonlyArray<Pick<PurchaseQuoteResponse, "status">>,
): Completion {
  const total = responses.length + 1;
  if (quote.status === "cancelled" || quote.status === "approved")
    return completion(total, total);
  const answered = responses.filter(
    (r) => r.status === "answered" || r.status === "declined",
  ).length;
  return completion(answered + (quote.status === "chosen" ? 1 : 0), total);
}

/** Convite de book: o book enviado (ou o convite cancelado). */
export function inviteCompletion(
  invite: Pick<BookingInvite, "status">,
): Completion {
  return completion(invite.status === "open" ? 0 : 1, 1);
}
