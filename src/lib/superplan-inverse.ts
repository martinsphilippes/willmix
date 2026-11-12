import { computeSuperplan, type SuperplanInput } from "@/lib/superplan";

/*
 * Conta inversa do Superplan (docs/SUPPLIER_REQUESTS.md, "Contraproposta com
 * o Superplan"): sem banco nem Intl, roda no navegador (contraproposta) e nos
 * testes.
 */

/**
 * Conta inversa: o preço por peça (na moeda escolhida) que leva ao preço
 * mínimo desejado. O mínimo cresce com o preço: busca binária.
 */
export function priceForMinimum(
  base: SuperplanInput,
  currency: "USD" | "RMB",
  targetMinimum: number,
): number | null {
  const min = (p: number) =>
    computeSuperplan({ ...base, unitPrice: p, currency }).prices?.minimum ??
    null;
  const floor = min(0.0001);
  if (floor === null || targetMinimum <= floor) return null;
  let lo = 0.0001;
  let hi = Math.max(1, base.unitPrice ?? 1);
  for (let i = 0; i < 60; i++) {
    const v = min(hi);
    if (v === null) return null;
    if (v >= targetMinimum) break;
    hi *= 2;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = min(mid);
    if (v === null) return null;
    if (v < targetMinimum) lo = mid;
    else hi = mid;
  }
  // Arredonda para baixo (4 casas): esse preço não passa do mínimo desejado.
  return Math.floor(lo * 10000) / 10000;
}
