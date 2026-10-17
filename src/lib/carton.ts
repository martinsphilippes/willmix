/*
 * Caixa master, caixa inner e embalagem: regras puras usadas pelos avisos ao
 * vivo da ficha de compra, do cadastro do produto e do sourcing (e pelos
 * testes). Nada aqui bloqueia o envio: são conferências para quem digita.
 */

/**
 * "Sem caixa inner": as peças vão direto na caixa master. Gravado como 0 peças
 * por inner (vazio continua sendo "não informado").
 */
export const NO_INNER = 0;

/** Máximo de atalhos de inner na tela (master com muitos divisores, ex.: 240). */
const MAX_INNER_OPTIONS = 12;

/**
 * Peças por caixa inner que fecham a master: os divisores de 1 até a master − 1
 * (com 10 na master: 1, 2 e 5). Inner igual à master é o mesmo que sem inner,
 * então não entra. Muitos divisores: fica o 1 (uma peça por caixinha) e os
 * maiores (menos caixinhas por master, o comum).
 */
export function innerOptions(master: number | null | undefined): number[] {
  if (!master || !Number.isInteger(master) || master < 2) return [];
  const divisors: number[] = [];
  for (let d = 1; d * d <= master; d++) {
    if (master % d !== 0) continue;
    divisors.push(d);
    if (d !== master / d) divisors.push(master / d);
  }
  const proper = divisors.filter((d) => d < master).sort((a, b) => a - b);
  if (proper.length <= MAX_INNER_OPTIONS) return proper;
  return [1, ...proper.slice(proper.length - (MAX_INNER_OPTIONS - 1))];
}

export type InnerCheck =
  /** 0: sem caixa inner. */
  | { kind: "none" }
  /** Fecha: `boxes` caixas inner em cada master. */
  | { kind: "fits"; boxes: number }
  /** Inner igual à master: na prática, sem inner. */
  | { kind: "same" }
  /** Inner com mais peças que a master. */
  | { kind: "bigger" }
  /** Não divide: sobram `rest` peças na master. */
  | { kind: "rest"; rest: number };

/** Confere a inner com a master; nulo quando não há o que dizer. */
export function checkInner(
  master: number | null | undefined,
  inner: number | null | undefined,
): InnerCheck | null {
  if (inner === null || inner === undefined) return null;
  if (!Number.isInteger(inner) || inner < 0) return null;
  if (inner === NO_INNER) return { kind: "none" };
  if (!master || !Number.isInteger(master) || master <= 0) return null;
  if (inner === master) return { kind: "same" };
  if (inner > master) return { kind: "bigger" };
  const rest = master % inner;
  return rest === 0
    ? { kind: "fits", boxes: master / inner }
    : { kind: "rest", rest };
}

/** Lado a partir do qual a caixa master é conferida (cm): costuma ter até ~60. */
export const CARTON_SIDE_WARN_CM = 120;
/** Volume a partir do qual a caixa master é conferida (m³): costuma ter até 0,3. */
export const CARTON_CBM_WARN = 0.4;

export type CartonSizeCheck =
  /** Três medidas: a caixa inteira (com o volume que dão). */
  | { kind: "size"; sides: [number, number, number]; cbm: number }
  /** Um lado grande demais, ainda sem as três medidas. */
  | { kind: "side"; side: number }
  /** Só o CBM digitado (sem medidas). */
  | { kind: "cbm"; cbm: number };

const positive = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Caixa master improvável (lado ≥ 120 cm ou ≥ 0,4 m³): costuma ser medida em
 * mm ou erro de digitação. Com as três medidas, a conta é pelas medidas (como
 * o servidor grava o CBM); sem elas, pelo CBM digitado.
 */
export function oversizedCarton(
  sides: ReadonlyArray<number | null | undefined>,
  typedCbm: number | null | undefined,
): CartonSizeCheck | null {
  const known = sides.filter(positive);
  if (known.length === 3) {
    const [a, b, c] = known as [number, number, number];
    const cbm = Math.round(((a * b * c) / 1_000_000) * 10_000) / 10_000;
    if (Math.max(a, b, c) >= CARTON_SIDE_WARN_CM || cbm >= CARTON_CBM_WARN)
      return { kind: "size", sides: [a, b, c], cbm };
    return null;
  }
  const side = known.length ? Math.max(...known) : 0;
  if (side >= CARTON_SIDE_WARN_CM) return { kind: "side", side };
  if (positive(typedCbm) && typedCbm >= CARTON_CBM_WARN)
    return { kind: "cbm", cbm: typedCbm };
  return null;
}

/** Quantas caixas cabem num container (para dar a dimensão do problema). */
export function cartonsPerContainer(
  capacityCbm: number | null | undefined,
  cbm: number | null | undefined,
): number | null {
  if (!positive(capacityCbm) || !positive(cbm)) return null;
  return Math.floor(capacityCbm / cbm);
}

/**
 * Tipos de embalagem mais comuns, no termo que as fábricas usam (é o que fica
 * gravado e vai para a especificação; o nome traduzido aparece na dica).
 */
export const PACKAGE_TYPES = [
  "COLOR BOX",
  "WHITE BOX",
  "BROWN BOX",
  "GIFT BOX",
  "PVC BOX",
  "BLISTER",
  "OPP BAG",
  "PE BAG",
] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

/** Chave do nome traduzido de cada tipo ("COLOR BOX" → "colorBox"). */
export const packageTypeKey = (type: PackageType) =>
  type
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w))
    .join("");

/** Mesmo tipo, sem diferença de maiúsculas e espaços ("color  box" = "COLOR BOX"). */
export const samePackageType = (a: string | null | undefined, b: string) =>
  (a ?? "").replace(/\s+/g, " ").trim().toUpperCase() === b;

const COLOR_WORDS = new Set([
  // pt
  "preto",
  "preta",
  "branco",
  "branca",
  "vermelho",
  "vermelha",
  "azul",
  "verde",
  "amarelo",
  "amarela",
  "rosa",
  "roxo",
  "roxa",
  "lilás",
  "lilas",
  "cinza",
  "laranja",
  "marrom",
  "bege",
  "dourado",
  "dourada",
  "prateado",
  "prateada",
  "colorido",
  "colorida",
  // en
  "black",
  "white",
  "red",
  "blue",
  "green",
  "yellow",
  "pink",
  "purple",
  "grey",
  "gray",
  "orange",
  "brown",
  "beige",
  "gold",
  "silver",
  "colorful",
  // zh
  "黑",
  "白",
  "红",
  "蓝",
  "绿",
  "黄",
  "粉",
  "紫",
  "灰",
  "橙",
  "棕",
  "金",
  "银",
  "彩色",
]);
const COLOR_SHADES = new Set([
  "claro",
  "clara",
  "escuro",
  "escura",
  "light",
  "dark",
]);

/**
 * O texto é só uma cor ("preto", "azul claro", "黑色")? No campo de
 * embalagem, quase sempre a cor foi digitada no lugar errado. "BROWN BOX" ou
 * "caixa preta" não são só cor e não contam.
 */
export function looksLikeColor(text: string | null | undefined): boolean {
  const words = (text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;!]+$/, "")
    .split(/\s+/)
    .filter((w) => w && !COLOR_SHADES.has(w));
  if (words.length !== 1) return false;
  // Chinês: "黑色", "浅蓝色", "深灰" → a cor sem 色 e sem tom.
  const word = /\p{Script=Han}/u.test(words[0])
    ? words[0].replace(/^[浅深]/, "").replace(/色$/, "") || words[0]
    : words[0];
  return COLOR_WORDS.has(word) || COLOR_WORDS.has(words[0]);
}
