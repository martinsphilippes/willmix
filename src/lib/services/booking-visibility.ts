import "server-only";

import { isSchemaMissing } from "./packaging-brief";

/*
 * Booking e a vitrine (docs/SUPPLIER_REQUESTS.md, "Produto"): o produto
 * criado por uma solicitação ao fornecedor aprovada só aparece para o
 * cliente depois de liberado. Até lá, fica fora da vitrine, da página do
 * produto, do carrinho e da nova solicitação do cliente. A Wellmix continua
 * vendo tudo. Um lugar só para a regra: quem mostra produto ao cliente
 * pergunta aqui.
 *
 * Tabela ainda não publicada no banco: ninguém fica escondido (as telas
 * seguem como antes).
 */

/**
 * Produtos criados por uma solicitação ao fornecedor aprovada que ainda não
 * foram liberados na vitrine. Tabela ainda não publicada: nenhum.
 */
async function unreleasedFromRequests(): Promise<Set<string>> {
  try {
    const { unreleasedRequestProductIds } =
      await import("./supplier-request-product");
    return await unreleasedRequestProductIds();
  } catch (error) {
    if (isSchemaMissing(error)) return new Set();
    throw error;
  }
}

/** Ids dos produtos que o cliente ainda não pode ver. */
export async function hiddenBookingProductIds(): Promise<Set<string>> {
  return unreleasedFromRequests();
}

/** Este produto está escondido do cliente (solicitação ao fornecedor ainda não liberada)? */
export async function isHiddenByBooking(productId: string): Promise<boolean> {
  if (!productId) return false;
  return (await unreleasedFromRequests()).has(productId);
}
