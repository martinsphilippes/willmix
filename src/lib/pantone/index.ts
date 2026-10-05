import data from "./colors.json";

/*
 * Tabela Pantone → RGB usada na ficha de compra (cor do produto).
 * Escalas: Solid Coated (C), Solid Uncoated (U), Metallics (M), Pastels &
 * Neons (P) e Fashion, Home + Interiors (TCX). Os valores sRGB são a
 * aproximação em tela publicada por projetos abertos (ver LICENSES.md); a
 * referência oficial continua sendo o leque físico Pantone. PANTONE é marca
 * da Pantone LLC; aqui os códigos servem de referência de compra.
 *
 * `colors.json`: lista de [escala, código, nome, hex], gerada uma vez a
 * partir dos pacotes citados em LICENSES.md (sem chamadas externas).
 */

export type PantoneScale = "C" | "U" | "M" | "P" | "TCX";
export const PANTONE_SCALES: readonly PantoneScale[] = [
  "C",
  "U",
  "M",
  "P",
  "TCX",
];

export interface PantoneColor {
  scale: PantoneScale;
  /** Como aparece no leque: "185 C", "Cool Gray 11 U", "19-4052 TCX". */
  code: string;
  /** Nome (TCX) ou o próprio número/nome da cor. */
  name: string;
  /** sRGB aproximado, "#rrggbb" minúsculo. */
  hex: string;
}

/** O que a ficha guarda por cor escolhida (pequeno e autossuficiente). */
export interface PantoneRef {
  code: string;
  hex: string;
}

type Row = [string, string, string, string];

let all: PantoneColor[] | null = null;
let byCode: Map<string, PantoneColor> | null = null;

export function normalizePantoneCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Todas as cores (memoizado). */
export function allPantone(): PantoneColor[] {
  if (!all)
    all = (data as Row[]).map(([scale, code, name, hex]) => ({
      scale: scale as PantoneScale,
      code,
      name,
      hex,
    }));
  return all;
}

export function findPantone(code: string): PantoneColor | null {
  if (!byCode) {
    byCode = new Map();
    for (const c of allPantone()) byCode.set(normalizePantoneCode(c.code), c);
  }
  return byCode.get(normalizePantoneCode(code)) ?? null;
}

/**
 * Busca por número, nome ou código: "185" acha 185 C/U e 2185 C…; "reflex"
 * acha Reflex Blue; "19-4052" acha o TCX. Números casam pelo início do código.
 */
export function searchPantone(
  query: string,
  scale: PantoneScale | null = null,
  limit = 60,
): PantoneColor[] {
  const q = normalizePantoneCode(query);
  const out: PantoneColor[] = [];
  const pool = allPantone();
  const numeric = /^\d/.test(q);
  const pass = (c: PantoneColor, strict: boolean) => {
    const code = c.code.toUpperCase();
    if (numeric) return strict ? code.startsWith(q) : code.includes(q);
    return strict
      ? code.startsWith(q) || c.name.toUpperCase().startsWith(q)
      : code.includes(q) || c.name.toUpperCase().includes(q);
  };
  // Primeiro quem começa com a busca, depois quem só contém.
  for (const strict of [true, false]) {
    for (const c of pool) {
      if (scale && c.scale !== scale) continue;
      if (q && !pass(c, strict)) continue;
      if (strict === false && pass(c, true)) continue;
      out.push(c);
      if (out.length >= limit) return out;
    }
    if (!q) return out;
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbText(hex: string): string {
  return hexToRgb(hex).join(", ");
}

/** Rótulo como se escreve na ficha: "PANTONE 185 C". */
export function pantoneLabel(ref: { code: string }): string {
  return `PANTONE ${ref.code}`;
}

export const MAX_PANTONE_PER_SHEET = 20;

/**
 * Lê o campo oculto do seletor (JSON de [{code, hex}]) e devolve as cores
 * válidas: código conhecido usa o hex da tabela; código desconhecido (tabela
 * mudou) é aceito se o par código/hex tiver formato válido, para a ficha
 * antiga continuar editável. Vazio → null.
 */
export function parsePantoneRefs(
  raw: string | null | undefined,
): PantoneRef[] | null {
  if (!raw || !raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_input");
  }
  if (!Array.isArray(parsed)) throw new Error("invalid_input");
  const out: PantoneRef[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const code =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && typeof item.code === "string"
          ? item.code
          : null;
    if (!code) throw new Error("invalid_input");
    const known = findPantone(code);
    const hex =
      known?.hex ??
      (item && typeof item === "object" && typeof item.hex === "string"
        ? item.hex.toLowerCase()
        : "");
    const clean = known?.code ?? normalizePantoneCode(code);
    if (
      !known &&
      !(/^#[0-9a-f]{6}$/.test(hex) && /^[A-Z0-9 .\-]{1,40}$/.test(clean))
    )
      throw new Error("invalid_input");
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push({ code: clean, hex });
    if (out.length > MAX_PANTONE_PER_SHEET) throw new Error("pantone_too_many");
  }
  return out.length ? out : null;
}
