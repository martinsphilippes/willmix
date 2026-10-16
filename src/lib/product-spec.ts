import type { Translate } from "@/i18n";
import { parseNumberInput } from "./number-input";

/*
 * Especificação do produto montada com os dados do cadastro (e da ficha
 * mestre): um texto curto, uma informação por linha, fácil de ler na
 * solicitação, na cotação do fornecedor e no catálogo. Só dados do produto:
 * nada comercial (preço, MOQ, fornecedor, código) entra aqui, porque a
 * especificação vai para a cotação de qualquer fornecedor e para o cliente.
 * Sem banco nem servidor: roda no navegador (ao vivo no formulário) e no
 * servidor (ao salvar), com o mesmo resultado.
 */

export interface ProductSpecData {
  material?: string | null;
  color?: string | null;
  colorPantones?: ReadonlyArray<{ code: string }> | null;
  capacityMl?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  powerSource?: string | null;
  powerDetail?: string | null;
  packageType?: string | null;
  masterBoxQty?: number | null;
  innerBoxQty?: number | null;
  boxLengthCm?: number | null;
  boxWidthCm?: number | null;
  boxHeightCm?: number | null;
  cbm?: number | null;
}

/** Textos da especificação (do dicionário, para a mesma língua do cadastro). */
export interface ProductSpecLabels {
  intl: string;
  material: string;
  color: string;
  capacity: string;
  size: string;
  sizeOrder: string;
  weight: string;
  net: string;
  gross: string;
  power: string;
  powerSources: Record<string, string>;
  packaging: string;
  masterBox: string;
  piece: string;
  pieces: string;
  inner: string;
}

const POWER_SOURCES = [
  "none",
  "battery",
  "110v",
  "220v",
  "bivolt",
  "usb",
] as const;

export function productSpecLabels(t: Translate): ProductSpecLabels {
  return {
    intl: t.intl,
    material: t("productSpec.material"),
    color: t("productSpec.color"),
    capacity: t("productSpec.capacity"),
    size: t("productSpec.size"),
    sizeOrder: t("productSpec.sizeOrder"),
    weight: t("productSpec.weight"),
    net: t("productSpec.net"),
    gross: t("productSpec.gross"),
    power: t("productSpec.power"),
    powerSources: Object.fromEntries(
      POWER_SOURCES.map((p) => [p, t(`sheet.power.${p}`)]),
    ),
    packaging: t("productSpec.packaging"),
    masterBox: t("productSpec.masterBox"),
    piece: t("productSpec.piece"),
    pieces: t("productSpec.pieces"),
    inner: t("productSpec.inner"),
  };
}

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Siglas de material, energia e embalagem que ficam em maiúsculas. */
const ACRONYMS = new Set(
  "PVC ABS PP PE PET PS PU PC PA EVA TPR TPE TPU PMMA NBR PBT POM HDPE LDPE BPA SS LED USB AC DC AA AAA UV RGB CE FDA MDF OPP BOPP EPE EPS TNT AISI HIPS PEVA PPS PVA ECO".split(
    " ",
  ),
);
const VOWEL = /[AEIOUYÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÄËÏÖÜ]/;

/**
 * Uma sequência de letras em maiúsculas: sigla (lista, ou curta sem vogal
 * como "TPR", "MDF") fica; o resto vai para minúsculas.
 */
const caseRun = (run: string) =>
  ACRONYMS.has(run) || (run.length <= 5 && !VOWEL.test(run))
    ? run
    : run.toLowerCase();

/**
 * Texto todo em maiúsculas ("AÇO INOX 304", "COLOR BOX") vira frase
 * ("Aço inox 304", "Color box"); siglas ("PVC", "PP+TPR"), números e
 * referências Pantone ("PANTONE 11-0601 TCX") ficam. Texto com minúsculas
 * (ou sem letras latinas, como chinês) fica como foi escrito.
 */
export function readableText(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text !== text.toUpperCase() || !/\p{Lu}/u.test(text))
    return text;
  // Referências Pantone ficam intactas (até a próxima barra, vírgula ou parêntese).
  const kept: string[] = [];
  const masked = text.replace(/PANTONE\s+[^/(),;]+/g, (m) => {
    kept.push(m.trim());
    return `\u0000${kept.length - 1}\u0000${m.endsWith(" ") ? " " : ""}`;
  });
  let first = true;
  const cased = masked.replace(/\p{L}+/gu, (run) => {
    const out = caseRun(run);
    if (first && out !== run) {
      first = false;
      return out.charAt(0).toUpperCase() + out.slice(1);
    }
    first = false;
    return out;
  });
  return cased.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)]);
}

/** A especificação, uma linha por informação; vazia quando não há dados. */
export function buildProductSpec(
  d: ProductSpecData,
  labels: ProductSpecLabels,
): string {
  const n = (v: number, digits: number) =>
    new Intl.NumberFormat(labels.intl, {
      maximumFractionDigits: digits,
    }).format(v);
  const fill = (text: string, vars: Record<string, string>) =>
    text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
  const dims = (
    a: number | null | undefined,
    b: number | null | undefined,
    c: number | null | undefined,
  ) =>
    positive(a) && positive(b) && positive(c)
      ? `${n(a, 1)} × ${n(b, 1)} × ${n(c, 1)} cm`
      : null;
  const lines: string[] = [];
  const line = (label: string, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (v) lines.push(`${label}: ${v}`);
  };

  if (d.material) line(labels.material, readableText(d.material));

  // Cor escrita e cores Pantone, sem repetir o código que já está no texto.
  const colorText = d.color ? readableText(d.color) : "";
  const missingCodes = (d.colorPantones ?? [])
    .map((c) => `PANTONE ${c.code}`)
    .filter((code) => !colorText.toUpperCase().includes(code.toUpperCase()));
  line(labels.color, [colorText, ...missingCodes].filter(Boolean).join(" / "));

  if (positive(d.capacityMl)) line(labels.capacity, `${n(d.capacityMl, 1)} ml`);

  const size = dims(d.lengthCm, d.widthCm, d.heightCm);
  if (size) line(labels.size, `${size} (${labels.sizeOrder})`);

  const weights = [
    positive(d.netWeightKg) ? `${n(d.netWeightKg, 3)} kg ${labels.net}` : null,
    positive(d.grossWeightKg)
      ? `${n(d.grossWeightKg, 3)} kg ${labels.gross}`
      : null,
  ].filter(Boolean);
  line(labels.weight, weights.join(" · "));

  const power = d.powerSource
    ? (labels.powerSources[d.powerSource] ?? d.powerSource)
    : "";
  const powerDetail = d.powerDetail ? readableText(d.powerDetail) : "";
  if (d.powerSource !== "none" || powerDetail)
    line(
      labels.power,
      power && powerDetail ? `${power} (${powerDetail})` : power || powerDetail,
    );

  if (d.packageType) line(labels.packaging, readableText(d.packageType));

  const box = dims(d.boxLengthCm, d.boxWidthCm, d.boxHeightCm);
  // CBM das medidas da caixa quando existem (como o cadastro grava); senão o informado.
  const cbm =
    positive(d.boxLengthCm) && positive(d.boxWidthCm) && positive(d.boxHeightCm)
      ? Math.round(
          ((d.boxLengthCm * d.boxWidthCm * d.boxHeightCm) / 1_000_000) * 10_000,
        ) / 10_000
      : positive(d.cbm)
        ? d.cbm
        : null;
  line(
    labels.masterBox,
    [
      positive(d.masterBoxQty)
        ? fill(d.masterBoxQty === 1 ? labels.piece : labels.pieces, {
            n: n(d.masterBoxQty, 0),
          })
        : null,
      // Caixa interna só quando agrupa (mais de 1 peça e menos que a master).
      positive(d.innerBoxQty) &&
      d.innerBoxQty > 1 &&
      !(positive(d.masterBoxQty) && d.innerBoxQty >= d.masterBoxQty)
        ? fill(labels.inner, { n: n(d.innerBoxQty, 0) })
        : null,
      box,
      cbm ? `${n(cbm, 4)} m³` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  return lines.join("\n");
}

/** Mesmo texto, ignorando espaços e quebras (para saber se ainda é o automático). */
export function sameSpec(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const norm = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/** Número de um campo do formulário (como a ficha lê), ou nulo. */
export function specNumber(raw: string | null | undefined): number | null {
  const v = parseNumberInput(raw ?? "");
  return v !== null && Number.isFinite(v) ? v : null;
}
