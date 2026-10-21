import type {
  PurchaseSheet,
  SheetCurrency,
  SheetIncoterm,
  SheetReading,
} from "@/lib/db/schema";

/*
 * Ficha pela foto do quadro, sem banco nem IA: quais campos o quadro tem,
 * como o valor lido vira valor da ficha e quando a ficha diverge da foto.
 */

/** Campos do quadro (a placa que o fornecedor preenche à mão), na ordem dele. */
export const READING_FIELDS = [
  "sheetDate",
  "location",
  "supplierName",
  "supplierStore",
  "supplierPhone",
  "factoryItemCode",
  "incoterm",
  "currency",
  "price",
  "masterCartonQty",
  "innerQty",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "capacityMl",
  "packageType",
  "colorAssortment",
  "material",
  "powerDetail",
  "moq",
] as const satisfies readonly (keyof PurchaseSheet)[];
export type ReadingField = (typeof READING_FIELDS)[number];

export type ReadingValues = Partial<
  Record<ReadingField, string | number | null>
>;

const TEXT_LIMITS: Partial<Record<ReadingField, number>> = {
  location: 80,
  supplierName: 160,
  supplierStore: 60,
  supplierPhone: 40,
  factoryItemCode: 60,
  packageType: 120,
  colorAssortment: 200,
  material: 200,
  powerDetail: 60,
};
const INT_FIELDS = new Set<ReadingField>([
  "masterCartonQty",
  "innerQty",
  "moq",
]);
const NUMBER_FIELDS = new Set<ReadingField>([
  "price",
  "netWeightPcKg",
  "grossWeightPcKg",
  "cbmPerCarton",
  "capacityMl",
]);

/** "4", "4,5", "12.000", "0.225 kg", "RMB 4" → número; o resto → null. */
function toNumber(raw: unknown, int: boolean): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(".") && s.includes(","))
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  else if (s.includes(","))
    s = /^\d{1,3}(,\d{3})+$/.test(s)
      ? s.replace(/,/g, "")
      : s.replace(",", ".");
  else if (int && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toCurrency(raw: unknown): SheetCurrency | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!v) return null;
  if (/RMB|CNY|YUAN|¥|元/.test(v)) return "RMB";
  if (/USD|US\$|U\$|DOLLAR|^\$/.test(v)) return "USD";
  if (/BRL|R\$|REAL/.test(v)) return "BRL";
  if (/EUR|€/.test(v)) return "EUR";
  return null;
}

function toIncoterm(raw: unknown): SheetIncoterm | null {
  const v = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (v === "FOB") return "FOB";
  if (v === "EXW" || v === "EXWORKS") return "EXW";
  return null;
}

/** "2026.10.13", "2026-10-13", "2026/10/13" → data ISO (meia-noite UTC). */
function toDate(raw: unknown): string | null {
  const m = String(raw ?? "").match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Resposta da IA → valores da ficha. Campo ilegível, vazio ou fora do
 * formato fica de fora (nunca vira 0 nem texto inventado).
 */
export function normalizeReading(raw: Record<string, unknown>): ReadingValues {
  const out: ReadingValues = {};
  for (const field of READING_FIELDS) {
    const value = raw[field];
    if (value === null || value === undefined || value === "") continue;
    if (field === "sheetDate") {
      const d = toDate(value);
      if (d) out[field] = d;
    } else if (field === "currency") {
      const c = toCurrency(value);
      if (c) out[field] = c;
    } else if (field === "incoterm") {
      const i = toIncoterm(value);
      if (i) out[field] = i;
    } else if (INT_FIELDS.has(field)) {
      const n = toNumber(value, true);
      if (n !== null && Number.isInteger(n) && n > 0) out[field] = n;
    } else if (NUMBER_FIELDS.has(field)) {
      const n = toNumber(value, false);
      if (n !== null && n > 0) out[field] = n;
    } else {
      const text = String(value).replace(/\s+/g, " ").trim();
      if (text) out[field] = text.slice(0, TEXT_LIMITS[field] ?? 200);
    }
  }
  // Preço sem moeda não entra: "4" pode ser yuan ou dólar (7× de diferença).
  if (out.price !== undefined && !out.currency) delete out.price;
  return out;
}

const empty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim());

/** Mesmo valor para a ficha: número com folga de arredondamento, data pelo dia, texto sem caixa/espaços. */
export function sameValue(field: ReadingField, a: unknown, b: unknown) {
  if (empty(a) || empty(b)) return empty(a) && empty(b);
  if (INT_FIELDS.has(field) || NUMBER_FIELDS.has(field)) {
    const x = Number(a);
    const y = Number(b);
    return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
  }
  if (field === "sheetDate")
    return String(a).slice(0, 10) === String(b).slice(0, 10);
  const norm = (v: unknown) =>
    String(v).toLowerCase().replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

export interface ReadingDivergence {
  field: ReadingField;
  /** O que o fornecedor escreveu no quadro. */
  photo: string | number;
  /** O que a ficha tem agora. */
  sheet: string | number;
}

/**
 * Campos em que a ficha tem um valor diferente do quadro e a Wellmix ainda
 * não disse qual vale (a decisão vale para o valor que a ficha tinha quando
 * foi tomada: se a ficha mudar de novo, volta a divergir).
 */
export function readingDivergences(
  sheet: Partial<PurchaseSheet> | null | undefined,
  reading: Pick<SheetReading, "fields" | "resolutions"> | null | undefined,
): ReadingDivergence[] {
  if (!reading) return [];
  const out: ReadingDivergence[] = [];
  for (const field of READING_FIELDS) {
    const photo = reading.fields?.[field];
    const current = sheet?.[field];
    if (empty(photo) || empty(current)) continue;
    if (sameValue(field, photo, current)) continue;
    const decided = reading.resolutions?.[field];
    if (decided && sameValue(field, decided.value, current)) continue;
    out.push({
      field,
      photo: photo as string | number,
      sheet: current as string | number,
    });
  }
  return out;
}

/** O que a foto preenche: campos lidos que a ficha ainda não tem. */
export function fillFromReading(
  sheet: Partial<PurchaseSheet> | null | undefined,
  values: ReadingValues,
): ReadingValues {
  const patch: ReadingValues = {};
  for (const field of READING_FIELDS) {
    const v = values[field];
    if (v === undefined || v === null) continue;
    if (!empty(sheet?.[field])) continue;
    patch[field] = v;
  }
  // Preço só vai na moeda em que foi escrito: ficha em US$ e quadro com
  // "RMB 4" não vira US$ 4 (a moeda fica divergente para a Wellmix decidir).
  if (
    patch.price !== undefined &&
    sheet?.currency &&
    values.currency &&
    sheet.currency !== values.currency
  )
    delete patch.price;
  return patch;
}
