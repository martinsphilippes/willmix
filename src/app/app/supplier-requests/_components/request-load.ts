import type { SupplierRequest } from "@/lib/db/schema";
import { containerComposition } from "@/lib/container-composition";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { requestItemSpecs } from "@/lib/supplier-request-specs";

/*
 * Lista de Solicitações ao fornecedor no nível da solicitação (dono,
 * 18/11/2026): quantas programações e quantos containers cada programação
 * ocupa, somando os produtos da solicitação. Só a conta, sem banco.
 */

type Line = Pick<SupplierRequest, "id" | "item" | "quantity" | "schedule">;

/** Programações da solicitação: a maior entre os produtos (sem programação, 1). */
export function requestRounds(products: readonly Line[]): number {
  return Math.max(1, ...products.map((p) => p.schedule?.items.length ?? 0));
}

/**
 * Containers de cada programação (menor e maior), enchidos produto a
 * produto pela caixa master e o CBM (o das medidas quando não há CBM).
 * Nulo quando algum produto não tem caixa master ou CBM: a conta sem ele
 * daria um número errado.
 */
export function requestContainersPerRound(
  products: readonly Line[],
  capacityCbm: number | null,
): { min: number; max: number } | null {
  if (!capacityCbm || capacityCbm <= 0 || !products.length) return null;
  const rounds = requestRounds(products);
  const items = products.map((p) => {
    const specs = requestItemSpecs(p);
    const cbm =
      specs.cbmPerCarton ||
      cbmFromDimensions(specs.lengthCm, specs.widthCm, specs.heightCm);
    const pieces = p.schedule?.items.length
      ? p.schedule.items.map((i) => i.quantity)
      : [p.quantity];
    return {
      key: p.id,
      name: p.id,
      masterCartonQty: specs.masterCartonQty,
      cbmPerCarton: cbm || null,
      pieces,
    };
  });
  const composition = containerComposition(items, rounds, capacityCbm);
  if (composition.missing.length || composition.tooBig.length) return null;
  const perRound = Array.from(
    { length: rounds },
    (_, r) => composition.rows.filter((row) => row.cells[r]).length,
  ).filter((n) => n > 0);
  if (!perRound.length) return null;
  return { min: Math.min(...perRound), max: Math.max(...perRound) };
}
