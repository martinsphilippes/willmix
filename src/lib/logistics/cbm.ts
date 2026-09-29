/**
 * Cálculo determinístico de volume (CBM) e ocupação de container.
 * Sem IA, sem arredondamento escondido: cada função é pura e testável.
 * Valores em centímetros, quilos e metros cúbicos; resultados com 4 casas.
 */

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** m³ de uma unidade/caixa a partir das dimensões em cm. Nulo se faltar dimensão. */
export function cbmFromDimensions(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!lengthCm || !widthCm || !heightCm) return null;
  if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) return null;
  return round4((lengthCm * widthCm * heightCm) / 1_000_000);
}

/** CBM informado tem prioridade; senão calcula das dimensões. */
export function resolveCbm(input: {
  cbm?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}): number | null {
  if (input.cbm && input.cbm > 0) return round4(input.cbm);
  return cbmFromDimensions(input.lengthCm, input.widthCm, input.heightCm);
}

/** CBM por caixa master: informado ou calculado das dimensões da caixa. */
export function boxCbm(input: {
  cbm?: number | null;
  boxLengthCm?: number | null;
  boxWidthCm?: number | null;
  boxHeightCm?: number | null;
}): number | null {
  return resolveCbm({
    cbm: input.cbm,
    lengthCm: input.boxLengthCm,
    widthCm: input.boxWidthCm,
    heightCm: input.boxHeightCm,
  });
}

/** Caixas necessárias para uma quantidade (arredonda para cima). */
export function boxesFor(quantity: number, unitsPerBox: number | null): number {
  if (!unitsPerBox || unitsPerBox <= 0) return 0;
  return Math.ceil(quantity / unitsPerBox);
}

export interface LoadItem {
  boxCount: number;
  cbmPerBox: number;
  weightPerBoxKg?: number | null;
  /** Presença de pedido = mercadoria vendida; ausência = estoque disponível. */
  orderId?: string | null;
}

export interface ContainerUsage {
  boxes: number;
  totalCbm: number;
  remainingCbm: number;
  occupancyPercent: number;
  /** Nulo quando algum item não tem peso por caixa. */
  totalWeightKg: number | null;
  weightPercent: number | null;
  overCapacity: boolean;
  overWeight: boolean;
}

export function containerUsage(
  items: LoadItem[],
  capacityCbm: number,
  maxWeightKg: number | null,
): ContainerUsage {
  const boxes = items.reduce((s, i) => s + i.boxCount, 0);
  const totalCbm = round4(
    items.reduce((s, i) => s + i.boxCount * i.cbmPerBox, 0),
  );
  const allWeighed = items.every(
    (i) => i.weightPerBoxKg !== null && i.weightPerBoxKg !== undefined,
  );
  const totalWeightKg =
    items.length > 0 && allWeighed
      ? round1(
          items.reduce((s, i) => s + i.boxCount * (i.weightPerBoxKg ?? 0), 0),
        )
      : null;
  const occupancyPercent =
    capacityCbm > 0 ? round1((totalCbm / capacityCbm) * 100) : 0;
  const weightPercent =
    totalWeightKg !== null && maxWeightKg && maxWeightKg > 0
      ? round1((totalWeightKg / maxWeightKg) * 100)
      : null;
  return {
    boxes,
    totalCbm,
    remainingCbm: round4(Math.max(0, capacityCbm - totalCbm)),
    occupancyPercent,
    totalWeightKg,
    weightPercent,
    overCapacity: totalCbm > capacityCbm + 1e-9,
    overWeight:
      totalWeightKg !== null && !!maxWeightKg && totalWeightKg > maxWeightKg,
  };
}

export interface CommercialSplit {
  soldCbm: number;
  availableCbm: number;
  soldPercent: number;
  availablePercent: number;
}

/** Vendido × disponível dentro do container, por volume. Sem estoque cadastrado, tudo é vendido. */
export function commercialSplit(items: LoadItem[]): CommercialSplit {
  const total = items.reduce((s, i) => s + i.boxCount * i.cbmPerBox, 0);
  const sold = items
    .filter((i) => !!i.orderId)
    .reduce((s, i) => s + i.boxCount * i.cbmPerBox, 0);
  const soldPercent = total > 0 ? round1((sold / total) * 100) : 0;
  return {
    soldCbm: round4(sold),
    availableCbm: round4(total - sold),
    soldPercent,
    availablePercent: total > 0 ? round1(100 - soldPercent) : 0,
  };
}

/** Divergência relativa (%) entre esperado e encontrado; nulo quando não comparável. */
export function divergencePercent(
  expected: number | null | undefined,
  found: number | null | undefined,
): number | null {
  if (
    expected === null ||
    expected === undefined ||
    found === null ||
    found === undefined ||
    !(expected > 0)
  )
    return null;
  return round1((Math.abs(found - expected) / expected) * 100);
}
