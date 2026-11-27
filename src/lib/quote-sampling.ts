import type {
  PurchaseQuoteResponse,
  SupplierRequestSampling,
} from "@/lib/db/schema";

/*
 * Amostragem dentro da cotação de compra (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Amostragem desde a cotação"). Regras puras.
 * - Começa junto com a cotação do item: todo fornecedor que respondeu envia
 *   as fotos e os vídeos da amostra de cada produto.
 * - Fornecedor conhecido do produto (já vendeu aquele produto à Wellmix)
 *   pula a amostragem.
 * - Só pode ser a vencedora a resposta com a amostra de todos os produtos
 *   aprovada (ou dispensada).
 */

type Sampled = Pick<PurchaseQuoteResponse, "sampling" | "invitedAt" | "status">;

/**
 * A cotação pede amostragem a este fornecedor? (dono, 27/11/2026): só
 * quando a Wellmix marca "Necessita amostragem" na cotação; o padrão é
 * desmarcado. Na cotação de antes da marca (nula), só quem já começou a
 * enviar (arquivo ou validação em algum produto) segue com a amostragem.
 */
export function quoteNeedsSampling(
  quote: { samplingNeed?: "yes" | "no" | null },
  response: Pick<PurchaseQuoteResponse, "sampling">,
): boolean {
  if (quote.samplingNeed === "yes") return true;
  if (quote.samplingNeed === "no") return false;
  return Object.values(response.sampling ?? {}).some(
    (s) => !!s && !s.skipped && (s.status !== "pending" || s.files.length > 0),
  );
}

/**
 * A amostragem de um produto para este fornecedor: a gravada ou, antes do
 * primeiro arquivo, uma pendente aberta no convite. Nula para o fornecedor
 * conhecido do produto (dispensada) e para quem recusou a cotação.
 */
export function quoteSamplingOf(
  response: Sampled,
  productId: string,
  known: boolean,
): SupplierRequestSampling | null {
  if (known || response.status === "declined") return null;
  return (
    response.sampling?.[productId] ?? {
      status: "pending",
      round: 1,
      openedAt: response.invitedAt,
      files: [],
      history: [],
    }
  );
}

/** Situação da amostra na tela: a da amostragem, "skipped" ou "none" (recusou). */
export function quoteSamplingState(
  response: Sampled,
  productId: string,
  known: boolean,
): SupplierRequestSampling["status"] | "skipped" | "none" {
  if (response.status === "declined") return "none";
  if (known) return "skipped";
  return quoteSamplingOf(response, productId, false)!.status;
}

/** Pode ser a vencedora: a amostra de cada produto aprovada ou dispensada. */
export function quoteSamplingReady(
  response: Sampled,
  productIds: readonly string[],
  known: ReadonlySet<string>,
): boolean {
  return productIds.every(
    (id) =>
      known.has(id) ||
      quoteSamplingOf(response, id, false)?.status === "approved",
  );
}

/** Produtos em que este fornecedor ainda tem amostra a enviar. */
export function quoteSamplingToSend(
  response: Sampled,
  productIds: readonly string[],
  known: ReadonlySet<string>,
): string[] {
  return productIds.filter((id) => {
    const s = quoteSamplingOf(response, id, known.has(id));
    return !!s && (s.status === "pending" || s.status === "rejected");
  });
}

/** Amostragem dispensada: o que a solicitação da vencedora leva (aprovada, sem arquivos). */
export function skippedSampling(at: string): SupplierRequestSampling {
  return {
    status: "approved",
    round: 1,
    openedAt: at,
    files: [],
    history: [],
    reviewedAt: at,
    skipped: true,
  };
}
