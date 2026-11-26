import type { SelectionPacking, SupplierRequestItem } from "@/lib/db/schema";
import { splitByColor, type ColorSplitResult } from "@/lib/color-split";

/*
 * Embalagens e variações do item escolhido na Seleção de itens (dono,
 * 26/11/2026; docs/SUPPLIER_REQUESTS.md, "Embalagens e variações"). Regras
 * puras: a tela, a gravação e a abertura das cotações usam as mesmas.
 *
 * - "Alterar": a mesma caixa master com outra quantidade de peças (x1 no
 *   lugar de x0). O CBM acompanha na proporção: CBM × x1 ÷ x0.
 * - Embalagens novas: N peças por embalagem (N divide a Qtd/caixa final).
 *   O preço (nas duas moedas) vira preço × N, a Qtd/caixa vira caixa ÷ N e
 *   o MOQ vira MOQ ÷ N, arredondado para cima.
 * - A tabela pai (a alterada, ou o item escolhido sem a alteração) conta ou
 *   não como mais uma opção de embalagem (toggle). Sem embalagem nova, ela é
 *   a única opção.
 * - Cada variação (cor do Book ou texto livre) × cada embalagem é um SKU e
 *   vira uma cotação separada, com o Mix de cores ligado ou não (o Mix só
 *   muda a imagem: uma por embalagem).
 */

/** Embalagens novas por item. */
export const MAX_PACKS = 10;
/** Variações (cores do Book e digitadas) por item. */
export const MAX_VARIATIONS = 30;
/** Combinações (cotações) por gravação. */
export const MAX_COMBOS = 60;
/** Tamanho do texto de uma variação digitada. */
export const VARIATION_MAX = 60;

/** Uma opção de embalagem: N peças por embalagem (1 = a unitária, a tabela pai). */
export interface PackOption {
  units: number;
  /** A tabela pai (a caixa do item, alterada ou não). */
  parent: boolean;
}

/** Uma combinação variação × embalagem (um SKU, uma cotação). */
export interface PackCombo {
  /** "variação|N": a chave da combinação no formulário e no plano. */
  key: string;
  /** A variação; nula quando o item não tem nenhuma (uma linha só). */
  variation: string | null;
  units: number;
}

/** Variação marcada na tela: cor do Book ou texto livre. */
export interface PackVariation {
  label: string;
  custom: boolean;
}

/** O que a tela manda (JSON `packing.<item>`). */
export interface PackingInput {
  /** Qtd/caixa digitada em "Alterar" (x1); nula = a do item. */
  carton: number | null;
  /** Peças de cada embalagem nova (Qtd/Embalagem). */
  packs: number[];
  /** A tabela pai também é uma opção de embalagem. */
  parentOption: boolean;
  mix: boolean;
  /** As variações incluídas, na ordem da tela. */
  variations: PackVariation[];
}

/** CBM da caixa alterada: CBM × x1 ÷ x0 (nulo sem CBM ou sem a caixa original). */
export function alteredCbm(
  cbm: number | null | undefined,
  from: number | null | undefined,
  to: number | null | undefined,
): number | null {
  if (
    cbm === null ||
    cbm === undefined ||
    !Number.isFinite(cbm) ||
    !from ||
    from <= 0 ||
    !to ||
    to <= 0
  )
    return cbm ?? null;
  return Math.round(((cbm * to) / from) * 1e6) / 1e6;
}

/** As opções de embalagem: a pai (quando conta ou não há outra) e as novas. */
export function packOptions(input: {
  packs: readonly number[];
  parentOption: boolean;
}): PackOption[] {
  const out: PackOption[] = [];
  if (input.parentOption || !input.packs.length)
    out.push({ units: 1, parent: true });
  for (const units of input.packs) out.push({ units, parent: false });
  return out;
}

/** A chave da combinação (variação vazia quando o item não tem variação). */
export const comboKey = (variation: string | null, units: number) =>
  `${variation ?? ""}|${units}`;

/** A chave da imagem: a combinação ou, com o Mix de cores, a embalagem. */
export const artKey = (
  mix: boolean,
  variation: string | null,
  units: number,
) => (mix ? comboKey(null, units) : comboKey(variation, units));

/** As combinações variação × embalagem, na ordem da tela (variação por variação). */
export function packCombos(
  variations: readonly PackVariation[],
  options: readonly PackOption[],
): PackCombo[] {
  const labels: Array<string | null> = variations.length
    ? variations.map((v) => v.label)
    : [null];
  return labels.flatMap((variation) =>
    options.map((o) => ({
      key: comboKey(variation, o.units),
      variation,
      units: o.units,
    })),
  );
}

/** Texto digitado de uma variação: sem espaços sobrando e sem "|" (o separador da chave). */
export function cleanVariation(text: string): string {
  return text.replace(/\|/g, "/").trim().replace(/\s+/g, " ").slice(0, 60);
}

/** Os números de um SKU (uma embalagem de N peças da caixa final). */
export interface PackSku {
  /** Preço da embalagem: preço × N (nulo sem preço). */
  price: number | null;
  /** Embalagens por caixa master: caixa ÷ N. */
  cartonQty: number | null;
  /** MOQ em embalagens: MOQ ÷ N, para cima. */
  moq: number | null;
  /** CBM da caixa (a mesma caixa, com a alteração). */
  cbm: number | null;
}

export function packSku(
  base: {
    price: number | null;
    moq: number | null;
    cbm: number | null;
  },
  carton: number | null,
  units: number,
): PackSku {
  const n = Math.max(1, Math.round(units));
  return {
    price:
      base.price === null || !Number.isFinite(base.price)
        ? null
        : Math.round(base.price * n * 1e6) / 1e6,
    cartonQty: carton ? carton / n : null,
    moq:
      base.moq === null || !Number.isFinite(base.moq)
        ? null
        : Math.ceil(base.moq / n),
    cbm: base.cbm,
  };
}

export type PackingError =
  | "selection_pack_carton"
  | "selection_pack_units"
  | "selection_pack_divide"
  | "selection_pack_repeat"
  | "selection_pack_many"
  | "selection_variation_repeat"
  | "selection_colors_none";

/**
 * Confere o que a tela mandou: a caixa alterada (inteira, ≥ 1), cada
 * embalagem nova (inteira, ≥ 2, divide a caixa final, sem repetir), as
 * variações (sem repetir, até 30) e o número de combinações (até 60).
 */
export function checkPacking(
  input: PackingInput,
  itemCarton: number | null,
): { ok: true; carton: number | null } | { ok: false; error: PackingError } {
  const carton = input.carton ?? itemCarton;
  if (
    input.carton !== null &&
    (!Number.isInteger(input.carton) || input.carton < 1 || input.carton > 1e6)
  )
    return { ok: false, error: "selection_pack_carton" };
  if (input.packs.length > MAX_PACKS)
    return { ok: false, error: "selection_pack_many" };
  const seen = new Set<number>();
  for (const units of input.packs) {
    if (!Number.isInteger(units) || units < 2 || units > 1e6)
      return { ok: false, error: "selection_pack_units" };
    if (!carton || carton % units !== 0)
      return { ok: false, error: "selection_pack_divide" };
    if (seen.has(units)) return { ok: false, error: "selection_pack_repeat" };
    seen.add(units);
  }
  if (input.variations.length > MAX_VARIATIONS)
    return { ok: false, error: "selection_pack_many" };
  const names = new Set<string>();
  for (const v of input.variations) {
    const key = v.label.toLocaleLowerCase("pt-BR");
    if (!v.label || names.has(key))
      return { ok: false, error: "selection_variation_repeat" };
    names.add(key);
  }
  const combos = packCombos(input.variations, packOptions(input));
  if (combos.length > MAX_COMBOS)
    return { ok: false, error: "selection_pack_many" };
  return { ok: true, carton };
}

/**
 * Divide as peças de cada data entre as combinações, em caixas master
 * inteiras da caixa final (a mesma regra das cores, `splitByColor`): com
 * caixas digitadas por combinação, cada uma fica com as suas.
 */
export function splitPacking(input: {
  rounds: number[];
  combos: readonly PackCombo[];
  carton: number | null;
  cartons?: Record<string, number> | null;
}): ColorSplitResult {
  return splitByColor({
    rounds: input.rounds,
    colors: input.combos.map((c) => c.key),
    carton: input.carton,
    cartons: input.cartons ?? null,
  });
}

/**
 * A cópia do item que vai na cotação de um SKU: a caixa em embalagens, o
 * preço e o MOQ da embalagem, o CBM da caixa final e os pesos da embalagem
 * (o Book traz por peça); a cor é a da variação.
 */
export function skuItemOf(
  item: SupplierRequestItem,
  packing: Pick<SelectionPacking, "carton" | "cbm">,
  combo: Pick<PackCombo, "variation" | "units">,
): SupplierRequestItem {
  const carton = packing.carton ?? item.masterCartonQty;
  const cbm = packing.carton ? packing.cbm : item.cbmPerCarton;
  const n = Math.max(1, combo.units);
  const sku = packSku(
    { price: item.price, moq: item.moq, cbm: cbm ?? null },
    carton ?? null,
    n,
  );
  const times = (v: number | null) =>
    v === null ? null : Math.round(v * n * 1e6) / 1e6;
  return {
    ...item,
    price: sku.price,
    masterCartonQty: sku.cartonQty,
    moq: sku.moq,
    cbmPerCarton: sku.cbm,
    innerQty:
      item.innerQty && n > 1
        ? item.innerQty % n === 0
          ? item.innerQty / n
          : null
        : item.innerQty,
    netWeightPcKg: times(item.netWeightPcKg),
    grossWeightPcKg: times(item.grossWeightPcKg),
    colorAssortment: combo.variation ?? item.colorAssortment,
  };
}

/** Peças de uma linha do plano em embalagens (a quantidade da cotação do SKU). */
export const piecesToPacks = (pieces: number, units: number) =>
  Math.round(pieces / Math.max(1, units));

/**
 * A combinação trivial (uma embalagem só, a do item, sem alteração, sem
 * imagem e com a cor do Book quando ele tem uma só, ou nenhuma) é o fluxo de
 * sempre: a cotação sai sem o selo de variação. Com duas ou mais cores no
 * Book, a variação escolhida diz qual cor é (não é trivial).
 */
export function trivialPacking(
  p: SelectionPacking,
  bookColors: number,
): boolean {
  return (
    p.lines.length === 1 &&
    p.lines[0].units === 1 &&
    !p.carton &&
    !p.lines[0].artDocumentId &&
    !p.variations.some((v) => v.custom) &&
    p.variations.length <= 1 &&
    (p.variations.length === 0 || bookColors <= 1)
  );
}
