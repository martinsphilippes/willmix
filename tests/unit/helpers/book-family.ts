/*
 * Família do produto na capa do book (dono, 26/11/2026): o book só fecha
 * com ela. Nos testes que fecham books, a família de utilidades da
 * demonstração ("20000000").
 *
 * Importe depois de `withTempStore()` (o banco é lido só na chamada).
 */
export const TEST_FAMILY = "20000000";

export async function setTestFamily(lotId: string, code = TEST_FAMILY) {
  const { getStore } = await import("@/lib/db");
  await getStore().update("booking_lots", lotId, { familyCode: code });
}
