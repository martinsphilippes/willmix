import "server-only";

import { getStore, type Booking, type User } from "@/lib/db";
import { audit } from "./audit";
import { isSchemaMissing } from "./packaging-brief";

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
  /** Peças planejadas na planilha (coluna "TT PCS"); nulo: ela não traz. */
  plannedQty?: number | null;
}

/**
 * Grava com o plano; se a coluna `plan` ainda não existe no banco (esquema
 * não publicado), grava sem ele: a linha do Booking nunca deixa de nascer
 * por causa da quantidade planejada.
 */
async function withPlanFallback<T>(
  withPlan: boolean,
  write: (plan: boolean) => Promise<T>,
): Promise<T> {
  if (!withPlan) return write(false);
  try {
    return await write(true);
  } catch (error) {
    if (!isSchemaMissing(error)) throw error;
    return write(false);
  }
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
  const planned =
    typeof intake.plannedQty === "number" && intake.plannedQty > 0
      ? Math.round(intake.plannedQty)
      : null;
  if (existing) {
    // Ainda em Novo: a planilha mais recente passa a ser a origem (e traz a
    // quantidade planejada dela; a previsão digitada fica).
    if (existing.status !== "new") return { booking: existing, created: false };
    const booking = await withPlanFallback(planned !== null, (plan) =>
      store.update("bookings", existing.id, {
        importBatchId: intake.importBatchId,
        sourceFileName: intake.sourceFileName?.slice(0, 200) ?? null,
        sourceRows: intake.sourceRows?.slice(0, 40) ?? null,
        sourceOrder: intake.sourceOrder,
        ...(plan
          ? { plan: { ...(existing.plan ?? {}), plannedQty: planned } }
          : {}),
      }),
    );
    return { booking, created: false };
  }
  const now = new Date().toISOString();
  const status = intake.productExisted ? "approved" : "new";
  const booking = await withPlanFallback(planned !== null, (plan) =>
    store.create("bookings", {
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
      ...(plan ? { plan: { plannedQty: planned } } : {}),
      requestId: null,
      requestGroupId: null,
      requestNumber: null,
      statusChangedAt: now,
      statusChangedByUserId: user.id,
      createdByUserId: user.id,
    }),
  );
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

/**
 * A solicitação que nasceu do Booking foi excluída: a linha deixa de estar
 * em "Virou solicitação" e volta para Reservado (ou Aprovado, sem cliente e
 * quantidade), sem a ligação. Sem isso ela ficaria travada, apontando para
 * uma solicitação que não existe mais, e só quem analisa poderia reabri-la.
 * Quem chama é a exclusão da solicitação (não confere tela: é consequência).
 * Nunca derruba a exclusão: falha aqui fica no log.
 */
export async function releaseBookingsOfRequests(
  user: User,
  requestIds: string[],
): Promise<number> {
  const ids = [...new Set(requestIds.filter(Boolean))];
  if (!ids.length) return 0;
  const store = getStore();
  let released = 0;
  try {
    const rows = await store.list("bookings", { filter: { requestId: ids } });
    for (const row of rows) {
      const status =
        row.status !== "requested"
          ? row.status
          : row.customerId && row.reservedQty
            ? ("reserved" as const)
            : ("approved" as const);
      await store.update("bookings", row.id, {
        status,
        requestId: null,
        requestGroupId: null,
        requestNumber: null,
        ...(status !== row.status
          ? {
              statusChangedAt: new Date().toISOString(),
              statusChangedByUserId: user.id,
            }
          : {}),
      });
      await audit(
        user,
        "booking.release",
        "booking",
        row.id,
        `Booking: a solicitação${
          row.requestNumber ? ` #${row.requestNumber}` : ""
        } foi excluída; a linha voltou para ${
          status === "reserved" ? "Reservado" : "Aprovado"
        }`,
        {
          status: row.status,
          requestId: row.requestId,
          requestNumber: row.requestNumber,
        },
        { status, requestId: null, requestNumber: null },
      );
      released++;
    }
  } catch (error) {
    // Tabela ainda não publicada ou falha passageira: a exclusão segue.
    console.error("[booking] soltar a linha da solicitação excluída", error);
  }
  return released;
}
