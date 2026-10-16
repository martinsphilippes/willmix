import type { PurchaseLot, PurchaseSheet } from "@/lib/db/schema";

/*
 * Contas da ficha de compra (as mesmas da planilha COMPRAS), sem banco:
 * - peças do lote = caixas master × peças por caixa master;
 * - CBM do lote = caixas master × CBM da caixa master;
 * - containers = CBM total ÷ capacidade útil do container escolhido;
 * - saída de cada lote = início da produção + intervalos acumulados.
 */

export const MAX_LOTS = 6;

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

/**
 * Sugestão para fechar o container: com 4,6 containers, quantas caixas
 * (e peças) faltam para fechar 5 sem passar, e quantas tirar para fechar em 4.
 * Caixas são inteiras, então "fechar" é chegar o mais perto possível por baixo.
 */
export interface ContainerFill {
  /** Containers usados hoje (ex.: 4,6). */
  containers: number;
  capacityCbm: number;
  /** Containers inteiros já fechados (4) e o alvo para completar (5). */
  lower: number;
  target: number;
  /** Quanto do último container está ocupado (0–100). */
  lastPct: number;
  /** Já fecha containers inteiros (nada a ajustar). */
  exact: boolean;
  /** Para completar o alvo: caixas, peças e m³ a acrescentar (0 = não cabe mais caixa inteira). */
  addCartons: number;
  addPieces: number | null;
  addCbm: number;
  /** Para fechar no inteiro de baixo: caixas e peças a tirar (null quando lower = 0). */
  removeCartons: number | null;
  removePieces: number | null;
  /**
   * Sempre que der, as duas direções (também quando já fecha exato):
   * `up` = acrescentar caixas até o próximo container que ganha pelo menos uma
   * caixa inteira; `down` = tirar caixas até o container inteiro de baixo
   * (nunca zera a programação).
   */
  up: ContainerStep | null;
  down: ContainerStep | null;
}

/** Um ajuste para fechar o container: alvo e quanto mexer. */
export interface ContainerStep {
  /** Containers depois do ajuste (inteiro de referência: 5, 4…). */
  containers: number;
  cartons: number;
  pieces: number | null;
  cbm: number;
}

export function suggestContainerFill(
  plan: Pick<SheetPlan, "totalCbm" | "containers" | "containerCapacityCbm">,
  cbmPerCarton: number | null | undefined,
  masterCartonQty: number | null | undefined,
): ContainerFill | null {
  if (
    plan.totalCbm === null ||
    plan.containers === null ||
    !positive(plan.containerCapacityCbm) ||
    !positive(cbmPerCarton) ||
    plan.totalCbm <= 0
  )
    return null;
  const cap = plan.containerCapacityCbm;
  const containers = plan.totalCbm / cap;
  const EPS = 1e-6;
  const lower = Math.floor(containers + EPS);
  const exact = Math.abs(containers - lower) < EPS;
  const target = exact ? lower : lower + 1;
  const missingCbm = exact ? 0 : target * cap - plan.totalCbm;
  const addCartons = exact ? 0 : Math.floor(missingCbm / cbmPerCarton + EPS);
  const excessCbm = exact ? 0 : plan.totalCbm - lower * cap;
  const removeCartons =
    exact || lower === 0 ? null : Math.ceil(excessCbm / cbmPerCarton - EPS);
  const pieces = (cartons: number | null) =>
    cartons !== null && positive(masterCartonQty)
      ? cartons * masterCartonQty
      : null;
  // Para cima: o primeiro container acima do atual em que cabe ao menos uma
  // caixa inteira (caixa maior que a sobra do último pula para o seguinte).
  let up: ContainerStep | null = null;
  for (let k = exact ? lower + 1 : target, i = 0; i < 50; k++, i++) {
    const cartons = Math.floor((k * cap - plan.totalCbm) / cbmPerCarton + EPS);
    if (cartons >= 1) {
      up = {
        containers: k,
        cartons,
        pieces: pieces(cartons),
        cbm: round(cartons * cbmPerCarton, 4),
      };
      break;
    }
  }
  // Para baixo: o container inteiro abaixo do atual (exato em 5 → 4), sem
  // tirar todas as caixas.
  const floorTarget = exact ? lower - 1 : lower;
  const totalCartons = plan.totalCbm / cbmPerCarton;
  let down: ContainerStep | null = null;
  if (floorTarget >= 1) {
    const cartons = Math.ceil(
      (plan.totalCbm - floorTarget * cap) / cbmPerCarton - EPS,
    );
    if (cartons >= 1 && cartons < Math.round(totalCartons))
      down = {
        containers: floorTarget,
        cartons,
        pieces: pieces(cartons),
        cbm: round(cartons * cbmPerCarton, 4),
      };
  }
  return {
    containers: round(containers, 4),
    capacityCbm: cap,
    lower,
    target,
    lastPct: exact ? 100 : Math.round((containers - lower) * 100),
    exact,
    addCartons,
    addPieces: pieces(addCartons),
    addCbm: round(addCartons * cbmPerCarton, 4),
    removeCartons,
    removePieces: pieces(removeCartons),
    up,
    down,
  };
}

/**
 * Quantidade de peças que a programação compra (caixas × peças por caixa
 * master). Nulo sem caixas ou sem peças por caixa: aí vale a quantidade pedida.
 */
export function sheetTotalPieces(
  sheet: Pick<PurchaseSheet, "lots" | "masterCartonQty"> | null | undefined,
): number | null {
  if (!sheet || !positive(sheet.masterCartonQty)) return null;
  const cartons = normalizeLots(sheet.lots).reduce(
    (sum, l) => sum + (positive(l.masterCartons) ? l.masterCartons : 0),
    0,
  );
  return cartons > 0 ? cartons * sheet.masterCartonQty : null;
}

/**
 * Distribui um ajuste de caixas entre as programações: acrescentar vai para a
 * última com caixas (ou a 1ª); tirar começa pela última e sobe, sem deixar
 * nenhuma negativa. Devolve as novas caixas por programação.
 */
export function spreadCartons(cartons: number[], delta: number): number[] {
  const out = cartons.map((c) => (Number.isFinite(c) && c > 0 ? c : 0));
  if (!delta) return out;
  const last = Math.max(0, out.map((c) => c > 0).lastIndexOf(true));
  if (delta > 0) {
    out[last] += delta;
    return out;
  }
  let left = -delta;
  for (let i = out.length - 1; i >= 0 && left > 0; i--) {
    const take = Math.min(out[i], left);
    out[i] -= take;
    left -= take;
  }
  return out;
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

/**
 * Fotos da ficha: as 5 fotos do produto, todas obrigatórias (balança, régua,
 * lado, ângulo e original). Foto de referência (prompt) e cartão de visita não
 * fazem parte da ficha: são da Wellmix, depois, na conversa com o fornecedor e
 * com o cliente.
 */
export const REQUIRED_SHEET_PHOTOS = {
  weight_scale: "scalePhoto",
  dimension_scale: "rulerPhoto",
  dimension_side: "sidePhoto",
  angle: "anglePhoto",
  original: "originalPhoto",
} as const;

export type SheetMissing =
  | SheetRequiredField
  | "lot1"
  | (typeof REQUIRED_SHEET_PHOTOS)[keyof typeof REQUIRED_SHEET_PHOTOS];

/** `photoKinds`: tipos de foto da ficha que já têm ao menos uma foto. */
export function missingForCompletion(
  sheet: Partial<PurchaseSheet> | null,
  photoKinds: readonly string[],
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
  for (const [kind, field] of Object.entries(REQUIRED_SHEET_PHOTOS))
    if (!photoKinds.includes(kind)) missing.push(field);
  return missing;
}

/** Limites do atalho "Gerar programação". */
export const GENERATE_MAX_CARTONS = 10_000_000;
export const GENERATE_MAX_DAYS = 365;

export type GenerateLotsError = "total" | "interval" | "first";

/**
 * Atalho "Gerar programação": divide o total de caixas master em N
 * programações iguais (o resto vai para as primeiras). A 1ª sai `firstDays`
 * depois do início da produção e as seguintes a cada `intervalDays` (a mesma
 * regra de intervalo das linhas da ficha). Só preenche os campos: tudo continua
 * editável e o servidor valida ao salvar, como se fosse digitado.
 */
export function generateLots(input: {
  totalCartons: number;
  count: number;
  intervalDays: number;
  firstDays: number;
}): { lots: PurchaseLot[] } | { error: GenerateLotsError } {
  const count = Math.max(1, Math.min(MAX_LOTS, Math.floor(input.count) || 1));
  const days = (n: number) =>
    Number.isInteger(n) && n >= 1 && n <= GENERATE_MAX_DAYS;
  const { totalCartons, intervalDays, firstDays } = input;
  if (
    !Number.isInteger(totalCartons) ||
    totalCartons < count ||
    totalCartons > GENERATE_MAX_CARTONS
  )
    return { error: "total" };
  if (!days(intervalDays)) return { error: "interval" };
  if (!days(firstDays)) return { error: "first" };
  const base = Math.floor(totalCartons / count);
  const rest = totalCartons - base * count;
  return {
    lots: Array.from({ length: count }, (_, i) => ({
      departureIntervalDays: i === 0 ? firstDays : intervalDays,
      masterCartons: base + (i < rest ? 1 : 0),
    })),
  };
}
