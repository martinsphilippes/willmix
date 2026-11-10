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

/** Ids dos produtos que o cliente ainda não pode ver. */
export async function hiddenBookingProductIds(): Promise<Set<string>> {
  try {
    const rows = await getStore().list("bookings", {
      filter: { status: [...BOOKING_HIDDEN] },
    });
    return new Set(rows.map((row) => row.productId));
  } catch (error) {
    if (isSchemaMissing(error)) return new Set();
    throw error;
  }
}

/** Este produto está escondido do cliente pelo Booking? */
export async function isHiddenByBooking(productId: string): Promise<boolean> {
  if (!productId) return false;
  try {
    const [row] = await getStore().list("bookings", {
      filter: { productId },
      limit: 1,
    });
    return !!row && hidesFromShowcase(row.status);
  } catch (error) {
    if (isSchemaMissing(error)) return false;
    throw error;
  }
}
