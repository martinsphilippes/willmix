import type { PurchaseLot, PurchaseSheet } from "@/lib/db/schema";

/*
 * Contas da ficha de compra (as mesmas da planilha COMPRAS), sem banco:
 * - peças do lote = caixas master × peças por caixa master;
 * - CBM do lote = caixas master × CBM da caixa master;
 * - containers = CBM total ÷ capacidade útil do container escolhido;
 * - saída de cada lote = início da produção + intervalos acumulados.
 */

export const MAX_LOTS = 3;

export interface LotPlan {
  index: number;
  departureIntervalDays: number | null;
  masterCartons: number | null;
  pieces: number | null;
  cbm: number | null;
  departureAt: string | null;
}

export interface SheetPlan {
  lots: LotPlan[];
  totalCartons: number;
  totalPieces: number | null;
  totalCbm: number | null;
  containers: number | null;
  containerCapacityCbm: number | null;
  /** CBM pela medida da caixa (altura × largura × comprimento), para conferir o informado. */
  cbmFromSize: number | null;
}

const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normalizeLots(lots: PurchaseLot[] | null | undefined) {
  const out: PurchaseLot[] = [];
  for (let i = 0; i < MAX_LOTS; i++) {
    const lot = lots?.[i];
    out.push({
      departureIntervalDays: lot?.departureIntervalDays ?? null,
      masterCartons: lot?.masterCartons ?? null,
    });
  }
  return out;
}

export function planSheet(
  sheet: Pick<
    PurchaseSheet,
    | "lots"
    | "masterCartonQty"
    | "cbmPerCarton"
    | "productionStartAt"
    | "heightCm"
    | "widthCm"
    | "lengthCm"
  >,
  containerCapacityCbm: number | null,
): SheetPlan {
  let cumulativeDays = 0;
  let datesValid = !!sheet.productionStartAt;
  const lots = normalizeLots(sheet.lots).map((lot, index): LotPlan => {
    const cartons = positive(lot.masterCartons) ? lot.masterCartons : null;
    let departureAt: string | null = null;
    if (datesValid && typeof lot.departureIntervalDays === "number") {
      cumulativeDays += lot.departureIntervalDays;
      departureAt = addDays(sheet.productionStartAt!, cumulativeDays);
    } else if (lot.departureIntervalDays === null && cartons) {
      // Lote com quantidade mas sem intervalo: as datas seguintes ficam sem conta.
      datesValid = false;
    }
    return {
      index: index + 1,
      departureIntervalDays: lot.departureIntervalDays,
      masterCartons: cartons,
      pieces:
        cartons && positive(sheet.masterCartonQty)
          ? cartons * sheet.masterCartonQty
          : null,
      cbm:
        cartons && positive(sheet.cbmPerCarton)
          ? round(cartons * sheet.cbmPerCarton, 4)
          : null,
      departureAt: cartons ? departureAt : null,
    };
  });
  const active = lots.filter((l) => l.masterCartons);
  const totalCartons = active.reduce((sum, l) => sum + l.masterCartons!, 0);
  const totalPieces = active.every((l) => l.pieces !== null)
    ? active.reduce((sum, l) => sum + (l.pieces ?? 0), 0)
    : null;
  const totalCbm =
    active.length && active.every((l) => l.cbm !== null)
      ? round(
          active.reduce((sum, l) => sum + (l.cbm ?? 0), 0),
          4,
        )
      : null;
  const cbmFromSize =
    positive(sheet.heightCm) &&
    positive(sheet.widthCm) &&
    positive(sheet.lengthCm)
      ? round((sheet.heightCm * sheet.widthCm * sheet.lengthCm) / 1_000_000, 4)
      : null;
  return {
    lots,
    totalCartons,
    totalPieces: active.length ? totalPieces : null,
    totalCbm,
    containers:
      totalCbm !== null && positive(containerCapacityCbm)
        ? round(totalCbm / containerCapacityCbm, 4)
        : null,
    containerCapacityCbm: positive(containerCapacityCbm)
      ? containerCapacityCbm
      : null,
    cbmFromSize,
  };
}

/** Campos que a ficha precisa ter para a Preparação considerar a ficha completa. */
export const SHEET_REQUIRED_FIELDS = [
  "supplierName",
  "incoterm",
  "currency",
  "price",
  "moq",
  "masterCartonQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "heightCm",
  "widthCm",
  "lengthCm",
  "packageType",
  "colorAssortment",
  "material",
  "productionStartAt",
] as const;
export type SheetRequiredField = (typeof SHEET_REQUIRED_FIELDS)[number];

export type SheetMissing = SheetRequiredField | "lot1" | "scalePhoto";

export function missingForCompletion(
  sheet: Partial<PurchaseSheet> | null,
  hasScalePhoto: boolean,
): SheetMissing[] {
  const missing: SheetMissing[] = [];
  for (const key of SHEET_REQUIRED_FIELDS) {
    const value = sheet?.[key];
    if (value === null || value === undefined || value === "")
      missing.push(key);
  }
  const first = normalizeLots(sheet?.lots)[0];
  if (
    !positive(first.masterCartons) ||
    typeof first.departureIntervalDays !== "number"
  )
    missing.push("lot1");
  if (!hasScalePhoto) missing.push("scalePhoto");
  return missing;
}
