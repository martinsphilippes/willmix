import { NO_INNER, checkInner, type InnerCheck } from "@/lib/carton";
import { cartonsFromPieces } from "@/lib/purchase-rounds";

/*
 * Embalagem e cubagem na Estratégia de compra (dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Embalagem e cubagem na Estratégia"). A partir
 * das peças e da embalagem do produto: caixas master, caixas inner e
 * cubagem total. Pura: a tela recalcula ao vivo quando a quantidade muda e o
 * servidor refaz a mesma conta ao gerar o pedido.
 *
 * - Caixas master: peças ÷ peças por master, em caixas inteiras para cima
 *   (`cartonsFromPieces`, a regra do gerador e da ficha completa). Com
 *   programação de entrega, uma conta por programação, cada uma em caixas
 *   inteiras (dono, 18/11/2026: "por programação, igual à ficha completa");
 *   quantidade digitada diferente da programada: uma conta só, pelo total.
 * - Caixas inner: a mesma conta com as peças por inner, quando a inner fecha
 *   a master. 0 gravado = sem caixa inner (0 caixas, diferente de "—", que é
 *   não informado). Inner que não fecha a master (o Sankhya grava às vezes
 *   as peças do conjunto como inner): "—" com o aviso (dono, 18/11/2026).
 * - Cubagem total: caixas master × CBM da caixa master. O CBM do portal é
 *   sempre o da caixa master (o M3 do volume da master no Sankhya; o M3 do
 *   produto, por peça, não é usado). Quem monta a base só passa o CBM da
 *   mesma caixa que foi contada (`cbmOtherBox` quando ele é de outra).
 */

/** Embalagem do produto, já escolhida pelas fontes da ficha (servidor). */
export interface PackingBasis {
  /** Peças por caixa master; nulo = não informado. */
  perMaster: number | null;
  /** Peças por caixa inner; 0 = sem caixa inner (gravado); nulo = não informado. */
  perInner: number | null;
  /** CBM (m³) de uma caixa master, da mesma caixa contada; nulo = não informado. */
  cbmPerMaster: number | null;
  /**
   * O CBM informado é de uma caixa com outra quantidade (as peças por caixa
   * dela): a cubagem total fica "—" com o aviso. Nulo: não é o caso.
   */
  cbmOtherBox: number | null;
}

export type InnerState =
  /** Caixas inner contadas. */
  | "count"
  /** Sem caixa inner (0 gravado): 0 caixas. */
  | "none"
  /** Peças por inner não informadas: "—". */
  | "missing"
  /** A inner não fecha a master: "—" com o aviso. */
  | "mismatch";

export type CbmState =
  | "value"
  /** Sem CBM da caixa master: "—". */
  | "missing"
  /** O CBM é de outra caixa: "—" com o aviso. */
  | "otherBox"
  /** Sem caixas master contadas (falta peças por master): "—". */
  | "noBoxes";

export interface PackingTotals {
  pieces: number;
  /** Caixas master; nulo = sem peças por master (ou quantidade inválida). */
  masterBoxes: number | null;
  /** Uma conta por programação (quando há mais de uma); vazia = pelo total. */
  masterByParcel: number[];
  /** Peças na última caixa master de cada conta que não fecha (vazia = todas fecham). */
  masterIncomplete: number[];
  /** Caixas inner; 0 sem inner; nulo = "—". */
  innerBoxes: number | null;
  inner: InnerState;
  /** Conferência da inner com a master (nula sem as duas). */
  innerCheck: InnerCheck | null;
  innerByParcel: number[];
  /** Peças na última caixa inner de cada conta que não fecha. */
  innerIncomplete: number[];
  /** Cubagem total (m³, 4 casas); nula = "—". */
  cbm: number | null;
  cbmState: CbmState;
}

const pos = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Caixas de cada conta e as peças da última caixa que não fecha. */
function boxesOf(parcels: readonly number[], perBox: number) {
  const byParcel = parcels.map((p) => cartonsFromPieces(p, perBox) ?? 0);
  const incomplete = parcels
    .map((p) => {
      const rest = Math.round(p) % perBox;
      return rest > 0 ? rest : 0;
    })
    .filter((rest) => rest > 0);
  return {
    total: byParcel.reduce((s, n) => s + n, 0),
    byParcel: parcels.length > 1 ? byParcel : [],
    incomplete,
  };
}

/**
 * As contas de caixas: as programações quando a quantidade é a programada
 * (a soma delas); senão uma conta só com a quantidade (dono, 18/11/2026).
 */
export function packingParcels(
  quantity: number,
  planned: readonly number[] | null | undefined,
): number[] {
  const list = (planned ?? []).filter(pos);
  const total = list.reduce((s, n) => s + n, 0);
  return list.length > 1 && Math.abs(total - quantity) < 1e-9
    ? [...list]
    : [quantity];
}

/** Caixas master, inner e cubagem das peças (uma conta por programação). */
export function packingTotals(
  parcels: readonly number[],
  basis: PackingBasis,
): PackingTotals {
  const valid = parcels.length > 0 && parcels.every(pos);
  const pieces = valid ? parcels.reduce((s, n) => s + n, 0) : 0;
  const master =
    valid && pos(basis.perMaster) ? boxesOf(parcels, basis.perMaster) : null;

  const innerCheck =
    basis.perInner !== null && pos(basis.perMaster)
      ? checkInner(basis.perMaster, basis.perInner)
      : null;
  let inner: InnerState;
  let innerBoxes: number | null = null;
  let innerByParcel: number[] = [];
  let innerIncomplete: number[] = [];
  if (basis.perInner === null || basis.perInner < 0) inner = "missing";
  else if (basis.perInner === NO_INNER) {
    inner = "none";
    innerBoxes = 0;
  } else if (
    innerCheck &&
    (innerCheck.kind === "rest" || innerCheck.kind === "bigger")
  )
    inner = "mismatch";
  else if (!valid) inner = "missing";
  else {
    const counted = boxesOf(parcels, basis.perInner);
    inner = "count";
    innerBoxes = counted.total;
    innerByParcel = counted.byParcel;
    innerIncomplete = counted.incomplete;
  }

  let cbm: number | null = null;
  let cbmState: CbmState;
  if (pos(basis.cbmOtherBox) && !pos(basis.cbmPerMaster)) cbmState = "otherBox";
  else if (!pos(basis.cbmPerMaster)) cbmState = "missing";
  else if (!master) cbmState = "noBoxes";
  else {
    cbmState = "value";
    cbm = r4(master.total * basis.cbmPerMaster);
  }

  return {
    pieces,
    masterBoxes: master ? master.total : null,
    masterByParcel: master ? master.byParcel : [],
    masterIncomplete: master ? master.incomplete : [],
    innerBoxes,
    inner,
    innerCheck,
    innerByParcel,
    innerIncomplete,
    cbm,
    cbmState,
  };
}

/**
 * O que a tela mostrou (caixas master, inner e cubagem), para o servidor
 * conferir ao gerar o pedido: a mesma conta com a embalagem de agora. "-" é
 * "—" (sem o dado).
 */
export function packingSeal(totals: PackingTotals): string {
  const n = (v: number | null) => (v === null ? "-" : String(v));
  return `${n(totals.masterBoxes)}|${n(totals.innerBoxes)}|${n(totals.cbm)}`;
}

/** Mesma embalagem (para juntar encomendas do mesmo produto numa linha só)? */
export function sameBasis(a: PackingBasis, b: PackingBasis): boolean {
  return (
    a.perMaster === b.perMaster &&
    a.perInner === b.perInner &&
    a.cbmPerMaster === b.cbmPerMaster &&
    a.cbmOtherBox === b.cbmOtherBox
  );
}
