import "server-only";

import { getStore, type Booking, type User } from "@/lib/db";
import { audit } from "./audit";

/*
 * Entrada no Booking (docs/BOOKING.md): a importação da ficha técnica chama
 * aqui para cada produto. Uma linha por produto: quem já está no Booking fica
 * onde está (reimportar a mesma planilha não duplica a linha nem muda a
 * etapa); só a planilha de origem é atualizada quando a linha ainda está em
 * Novo.
 */

export interface BookingIntake {
  productId: string;
  /** Lote da importação (`import_batches`) e o nome do arquivo. */
  importBatchId: string | null;
  sourceFileName: string | null;
  /** Linhas da planilha ("3-5") e a primeira delas. */
  sourceRows: string | null;
  sourceOrder: number | null;
  /**
   * O produto já existia no cadastro antes desta importação (a planilha só o
   * atualizou). Ele já estava na vitrine do cliente: a linha nasce em
   * "Aprovado", para a importação não tirar da vitrine o que já se vende.
   */
  productExisted?: boolean;
}

/**
 * Garante a linha do Booking do produto. `created` diz se ela nasceu agora
 * (responsável = quem importou): em Novo para o produto que a planilha criou
 * (fora da vitrine até ser aprovado); em Aprovado para o produto que já
 * existia no cadastro (continua na vitrine).
 */
export async function ensureBookingForProduct(
  user: User,
  intake: BookingIntake,
): Promise<{ booking: Booking; created: boolean }> {
  const store = getStore();
  const [existing] = await store.list("bookings", {
    filter: { productId: intake.productId },
    limit: 1,
  });
  if (existing) {
    // Ainda em Novo: a planilha mais recente passa a ser a origem.
    if (existing.status !== "new") return { booking: existing, created: false };
    const booking = await store.update("bookings", existing.id, {
      importBatchId: intake.importBatchId,
      sourceFileName: intake.sourceFileName?.slice(0, 200) ?? null,
      sourceRows: intake.sourceRows?.slice(0, 40) ?? null,
      sourceOrder: intake.sourceOrder,
    });
    return { booking, created: false };
  }
  const now = new Date().toISOString();
  const status = intake.productExisted ? "approved" : "new";
  const booking = await store.create("bookings", {
    productId: intake.productId,
    status,
    importBatchId: intake.importBatchId,
    sourceFileName: intake.sourceFileName?.slice(0, 200) ?? null,
    sourceRows: intake.sourceRows?.slice(0, 40) ?? null,
    sourceOrder: intake.sourceOrder,
    customerId: null,
    reservedQty: null,
    ownerUserId: user.id,
    note: null,
    analysis: null,
    requestId: null,
    requestGroupId: null,
    requestNumber: null,
    statusChangedAt: now,
    statusChangedByUserId: user.id,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "booking.create",
    "booking",
    booking.id,
    `Produto entrou no Booking pela ficha técnica${
      intake.sourceFileName ? ` (${intake.sourceFileName.slice(0, 120)})` : ""
    }${intake.productExisted ? ": já estava no cadastro, entra como Aprovado" : ""}`,
    null,
    { productId: intake.productId, status },
  );
  return { booking, created: true };
}
