/*
 * Pesos por peça (docs/BOOKING.md e docs/SUPERPLAN.md). A ficha técnica traz
 * o peso líquido (N.W) e o peso bruto (G.W) em colunas separadas; muitas
 * planilhas só trazem o líquido. O líquido nunca é lido como bruto: quando o
 * bruto falta, a conta usa um peso bruto ESTIMADO (líquido + folga da
 * embalagem), sempre marcado como estimado e nunca gravado no produto.
 */

/**
 * Peso bruto estimado por peça: o bruto informado ou, sem ele, o líquido mais
 * a folga da embalagem (%). `estimated` diz que veio da conta.
 */
export function estimatedGrossKg(
  netKg: number | null | undefined,
  grossKg: number | null | undefined,
  allowancePct: number,
): { kg: number | null; estimated: boolean } {
  const ok = (n: number | null | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0;
  if (ok(grossKg)) return { kg: grossKg, estimated: false };
  if (!ok(netKg)) return { kg: null, estimated: false };
  const pct =
    Number.isFinite(allowancePct) && allowancePct >= 0 ? allowancePct : 0;
  return {
    kg: Math.round(netKg * (1 + pct / 100) * 10000) / 10000,
    estimated: true,
  };
}
