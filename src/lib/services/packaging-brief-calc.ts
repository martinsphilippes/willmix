import type {
  PackagingDims,
  PackagingItemKey,
  PurchaseSheet,
} from "@/lib/db/schema";

/*
 * Regras puras do briefing de embalagem (sem banco): medidas que a faca usa,
 * comparação com tolerância e o que falta. Testáveis sem o store.
 */

/** Coluna do briefing que guarda a versão vigente de cada entregável. */
export const ITEM_COLUMN = {
  dieline: "dielineDocumentId",
  art: "artDocumentId",
  print_ready: "printReadyDocumentId",
  packaging_sample: "sampleDocumentId",
} as const satisfies Record<PackagingItemKey, string>;

export type ItemColumn = (typeof ITEM_COLUMN)[PackagingItemKey];

/** Tipo de documento gravado para cada entregável. */
export const ITEM_DOCUMENT_TYPE = {
  dieline: "dieline",
  art: "art",
  print_ready: "print_ready",
  packaging_sample: "packaging_sample",
} as const satisfies Record<PackagingItemKey, string>;

/**
 * Medidas da embalagem a partir de uma ficha (mestre do produto ou da
 * cotação). Sem as três medidas da caixa master não há o que dar à faca.
 */
export function packagingDimsFor(
  sheet: Partial<PurchaseSheet> | null | undefined,
): PackagingDims | null {
  if (!sheet) return null;
  const { lengthCm, widthCm, heightCm } = sheet;
  if (!(lengthCm && widthCm && heightCm)) return null;
  return {
    lengthCm,
    widthCm,
    heightCm,
    masterCartonQty: sheet.masterCartonQty ?? null,
    innerQty: sheet.innerQty ?? null,
    cbmPerCarton: sheet.cbmPerCarton ?? null,
    packageType: sheet.packageType ?? null,
    material: sheet.material ?? null,
    colorPantones: sheet.colorPantones ?? null,
    capacityMl: sheet.capacityMl ?? null,
  };
}

const outside = (a: number | null, b: number | null, tolerance: number) => {
  if (a === null || b === null) return a !== b;
  if (a === b) return false;
  const base = Math.max(Math.abs(a), Math.abs(b));
  return base === 0 ? false : (Math.abs(a - b) / base) * 100 > tolerance;
};

/**
 * As medidas mudaram além da tolerância (%) de comprimento, largura e altura?
 * Peças por caixa e inner mudam a faca quando mudam (comparação exata).
 */
export function packagingDimsChanged(
  before: PackagingDims | null,
  after: PackagingDims | null,
  tolerancePercent: number,
): boolean {
  if (!before || !after) return !!before !== !!after;
  const t = Math.max(0, tolerancePercent);
  return (
    outside(before.lengthCm, after.lengthCm, t) ||
    outside(before.widthCm, after.widthCm, t) ||
    outside(before.heightCm, after.heightCm, t) ||
    (before.masterCartonQty !== null &&
      after.masterCartonQty !== null &&
      before.masterCartonQty !== after.masterCartonQty) ||
    (before.innerQty !== null &&
      after.innerQty !== null &&
      before.innerQty !== after.innerQty)
  );
}

/** Entregáveis obrigatórios que ainda não têm arquivo. */
export function missingPackagingItems(
  brief: Record<ItemColumn, string | null> & {
    requiredKeys: PackagingItemKey[];
  },
): PackagingItemKey[] {
  return brief.requiredKeys.filter((key) => !brief[ITEM_COLUMN[key]]);
}

/** Lista de obrigatórios válida: só chaves conhecidas, sem repetição, pelo menos uma. */
export function normalizeRequiredKeys(
  keys: readonly string[] | null | undefined,
  fallback: PackagingItemKey[] = ["dieline", "art"],
): PackagingItemKey[] {
  const known = new Set<string>(Object.keys(ITEM_COLUMN));
  const out = [
    ...new Set((keys ?? []).filter((k): k is PackagingItemKey => known.has(k))),
  ];
  return out.length ? out : fallback;
}
