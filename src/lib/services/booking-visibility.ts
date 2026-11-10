import "server-only";

import { getStore } from "@/lib/db";
import { BOOKING_HIDDEN, hidesFromShowcase } from "@/lib/booking";
import { isSchemaMissing } from "./packaging-brief";

/*
 * Booking e a vitrine (docs/BOOKING.md): o produto que chegou pela ficha
 * técnica só aparece para o cliente depois de aprovado no Booking. Enquanto
 * está em Novo, Em análise ou Descartado, fica fora da vitrine, da página do
 * produto, do carrinho e da nova solicitação do cliente. A Wellmix continua
 * vendo tudo. Um lugar só para a regra: quem mostra produto ao cliente
 * pergunta aqui.
 *
 * Tabela `bookings` ainda não publicada no Appwrite: ninguém fica escondido
 * (as telas seguem como antes).
 */

/**
 * Produtos criados por uma solicitação ao fornecedor aprovada que ainda não
 * foram liberados na vitrine (docs/SUPPLIER_REQUESTS.md, "Produto"). Tabela
 * ainda não publicada: nenhum.
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
  let hidden: Set<string>;
  try {
    const rows = await getStore().list("bookings", {
      filter: { status: [...BOOKING_HIDDEN] },
    });
    hidden = new Set(rows.map((row) => row.productId));
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
    hidden = new Set();
  }
  for (const id of await unreleasedFromRequests()) hidden.add(id);
  return hidden;
}

/** Este produto está escondido do cliente pelo Booking (ou pela solicitação ao fornecedor)? */
export async function isHiddenByBooking(productId: string): Promise<boolean> {
  if (!productId) return false;
  try {
    const [row] = await getStore().list("bookings", {
      filter: { productId },
      limit: 1,
    });
    if (row && hidesFromShowcase(row.status)) return true;
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
  }
  return (await unreleasedFromRequests()).has(productId);
}
