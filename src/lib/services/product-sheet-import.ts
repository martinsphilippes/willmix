import "server-only";

import {
  PARTY_EXTRA_DEFAULTS,
  PRODUCT_EXTRA_DEFAULTS,
  SHEET_CURRENCIES,
  getStore,
  type ImportBatch,
  type Party,
  type Product,
  type SheetCurrency,
  type SheetIncoterm,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import { saveProductSheet } from "./product-sheet";
import { syncMainSupplierLink } from "./product-suppliers";
import type { SheetInput } from "./purchase-sheet";
import type { SheetMissing } from "./purchase-sheet-calc";
import {
  READING_FIELDS,
  normalizeReading,
  type ReadingField,
  type ReadingValues,
} from "./sheet-reading-calc";
import { addPhotos } from "./sourcing";
import { openWorkbook, type SheetImage } from "./xlsx";

/*
 * Cadastro de produtos pela planilha da ficha técnica (o modelo "SUPPLIER
 * INFO" da visita ao fornecedor: uma linha por cor, fotos coladas na coluna
 * PHOTO e o cartão do fornecedor na coluna dele). Em um passo: lê a aba,
 * agrupa as linhas em produtos, cadastra o fornecedor que faltar, cria (ou
 * atualiza) cada produto com a ficha mestre e as fotos, e devolve o que
 * ainda falta em cada um (a mesma regra da ficha mestre no produto).
 *
 * A leitura é determinística (sem IA): os cabeçalhos são reconhecidos por
 * sinônimos (inglês do modelo, português e chinês), com duas linhas de
 * cabeçalho quando há subcolunas (SIZE → LENGTH, WIDTH, HEIGHT).
 */

export class SheetImportError extends Error {}

/** Entidade do lote em `import_batches` (histórico e evidência do arquivo). */
export const SHEET_IMPORT_ENTITY = "product_sheets";
export const MAX_SHEET_ROWS = 2000;
export const MAX_SHEET_PRODUCTS = 300;
/** Fotos: cada grupo tem no máximo a foto do produto e o cartão. */
const MAX_IMAGES = 2 * MAX_SHEET_PRODUCTS + 50;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type SheetColumn =
  | ReadingField
  | "lengthCm"
  | "widthCm"
  | "heightCm"
  | "sizeText"
  | "description"
  | "name"
  | "photo"
  | "businessCard"
  | "schedule"
  | "interval"
  | "purchaseQty";

/**
 * Sinônimos de cabeçalho por coluna (comparados sem acento, sem caixa e só
 * com letras e números). Primeiro vale a igualdade exata; depois, o
 * cabeçalho que começa com o sinônimo ("PRICE U" começa com "PRICE").
 */
const HEADERS: ReadonlyArray<[SheetColumn, string[]]> = [
  ["photo", ["PHOTO", "FOTO", "PICTURE", "IMAGE", "图片"]],
  ["businessCard", ["SUPPLIER BUSINESS CARD", "BUSINESS CARD", "CARTAO", "CARTAO DO FORNECEDOR", "名片"]],
  ["sheetDate", ["DATE", "DATA", "日期"]],
  ["location", ["LOCAL", "LOCATION", "CITY", "CIDADE", "MARKET", "MERCADO"]],
  ["supplierStore", ["SUPPLIER STORE NO YIWU", "SUPPLIER STORE NO", "STORE NO", "STORE", "LOJA", "BOOTH", "店铺"]],
  ["supplierPhone", ["SUPPLIER PHONE NO", "SUPPLIER PHONE", "PHONE", "TEL", "TELEFONE", "MOBILE", "电话"]],
  ["supplierName", ["SUPPLIER NAME", "SUPPLIER", "FORNECEDOR", "VENDOR", "FACTORY", "供应商"]],
  ["factoryItemCode", ["SKU FACTORY ITEM CODE", "FACTORY ITEM CODE", "ITEM CODE", "ITEM NO", "SKU", "CODIGO", "CODE", "MODEL NO", "型号", "货号"]],
  ["incoterm", ["FOB EXW", "INCOTERM", "FOB", "EXW"]],
  ["price", ["PRICE", "PRECO", "UNIT PRICE", "单价", "价格"]],
  ["currency", ["CURRENCY", "MOEDA", "币种"]],
  ["masterCartonQty", ["QTY BOX", "QTY CTN", "PCS CTN", "QTY CARTON", "PCS BOX", "QTD CAIXA", "QTD POR CAIXA", "装箱数", "外箱装量"]],
  ["innerQty", ["QTY INNER", "INNER", "PCS INNER", "QTD INNER", "INNER BOX", "内盒"]],
  ["netWeightPcKg", ["N W PC", "NW PC", "N W", "NW", "NET WEIGHT", "PESO LIQUIDO", "净重"]],
  ["grossWeightPcKg", ["G W PC", "GW PC", "G W", "GW", "GROSS WEIGHT", "PESO BRUTO", "毛重"]],
  ["cbmPerCarton", ["CBM", "CBM CTN", "CBM BOX", "CBM CAIXA", "体积"]],
  ["lengthCm", ["SIZE LENGTH", "LENGTH", "COMPRIMENTO", "长"]],
  ["widthCm", ["SIZE WIDTH", "WIDTH", "LARGURA", "宽"]],
  ["heightCm", ["SIZE HEIGHT", "HEIGHT", "ALTURA", "高"]],
  ["sizeText", ["SIZE", "TAMANHO", "MEDIDAS", "DIMENSIONS", "尺寸"]],
  ["capacityMl", ["CAPACITY ML", "CAPACITY", "CAPACIDADE", "容量"]],
  ["packageType", ["PACKAGE", "PACKING", "PACKAGING", "EMBALAGEM", "包装"]],
  ["colorAssortment", ["COLOR ASSOLTMENT", "COLOR ASSORTMENT", "COLOUR ASSORTMENT", "COLOR", "COLOUR", "COR", "CORES", "颜色"]],
  ["material", ["MATERIAL", "材质"]],
  ["powerDetail", ["FUNCION BATERRY 110 220", "FUNCTION BATTERY 110 220", "FUNCTION", "FUNCION", "BATTERY", "VOLTAGE", "POWER", "FUNCAO"]],
  ["moq", ["MOQ", "MIN ORDER", "PEDIDO MINIMO", "起订量"]],
  ["description", ["OBS 1 LINHA", "OBS", "DESCRIPTION", "DESCRICAO", "REMARK", "REMARKS", "MODEL", "MODELO", "DESIGN", "备注"]],
  ["name", ["PRODUCT NAME", "NAME", "NOME", "PRODUTO", "ITEM NAME", "产品名称"]],
  ["schedule", ["PURCHASE SCHEDULE", "PROGRAMACAO"]],
  ["interval", ["DEPARTURE INTERVAL IN DAYS", "DEPARTURE INTERVAL"]],
  ["purchaseQty", ["PURCHASE QTY IN PCS", "PURCHASE QTY"]],
];

/** Colunas que, preenchidas, dizem que a linha é um produto. */
const DATA_COLUMNS: SheetColumn[] = [
  "supplierName",
  "factoryItemCode",
  "price",
  "description",
  "name",
  "colorAssortment",
  "masterCartonQty",
  "moq",
];
/** Colunas numéricas (para saber se a 2ª linha é subcabeçalho ou dado). */
const NUMERIC_COLUMNS: SheetColumn[] = [
  "price",
  "masterCartonQty",
  "innerQty",
  "moq",
  "cbmPerCarton",
  "netWeightPcKg",
];
/** Cabeçalhos que abrem um grupo de subcolunas (SIZE → LENGTH, WIDTH, HEIGHT). */
const GROUP_HEADERS = new Set(["SIZE", "TAMANHO", "MEDIDAS", "DIMENSIONS", "尺寸"]);

export function normalizeHeader(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9一-鿿]+/g, " ")
    .trim();
}

function matchColumn(header: string): SheetColumn | null {
  const h = normalizeHeader(header);
  if (!h) return null;
  for (const [column, synonyms] of HEADERS)
    if (synonyms.includes(h)) return column;
  for (const [column, synonyms] of HEADERS)
    for (const syn of synonyms)
      if (h.startsWith(`${syn} `)) return column;
  return null;
}

/** Moeda escrita no cabeçalho do preço ("PRICE / U$", "单价 RMB"). */
function currencyInHeader(header: string): SheetCurrency | null {
  const h = header.toUpperCase();
  if (/RMB|CNY|¥|元/.test(h)) return "RMB";
  if (/USD|US\$|U\$|\$|DOLLAR|美元/.test(h)) return "USD";
  if (/BRL|R\$|REAL/.test(h)) return "BRL";
  if (/EUR|€/.test(h)) return "EUR";
  return null;
}

const num = (raw: string | undefined): number | null => {
  if (!raw) return null;
  let s = raw.trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else if (s.includes(",") && s.includes("."))
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const text = (raw: string | undefined, max = 200): string | null => {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

export interface ParsedRow {
  /** Linha da aba como no Excel (1 = primeira). */
  row: number;
  values: Partial<Record<SheetColumn, string>>;
}

export interface ProductGroup {
  index: number;
  /** Linhas da aba (como no Excel) que formam o produto. */
  firstRow: number;
  lastRow: number;
  reading: ReadingValues;
  colors: string[];
  name: string | null;
  description: string | null;
  sizeText: string | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  notes: string | null;
  photo: SheetImage | null;
  card: SheetImage | null;
}

export interface ParsedSheet {
  sheetName: string;
  /** Linha do cabeçalho (como no Excel). */
  headerRow: number;
  /** Coluna de cada campo reconhecido (índice do zero). */
  columns: Partial<Record<SheetColumn, number>>;
  /** Cabeçalho original de cada campo reconhecido. */
  headers: Partial<Record<SheetColumn, string>>;
  currency: SheetCurrency | null;
  rows: ParsedRow[];
  groups: ProductGroup[];
  warnings: string[];
}

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0];

/** Excel antigo (.xls, binário OLE): o leitor só abre .xlsx. */
export function isLegacyXls(bytes: Uint8Array): boolean {
  return OLE_SIGNATURE.every((b, i) => bytes[i] === b);
}

/**
 * Lê a aba (a primeira ou a escolhida) e agrupa as linhas em produtos. Linhas
 * seguidas com o mesmo código, descrição, tamanho, preço e embalagem são o
 * mesmo produto em cores diferentes.
 */
export function parseProductSheet(
  bytes: Uint8Array,
  options: { sheet?: string | null; defaultCurrency?: SheetCurrency | null } = {},
): ParsedSheet {
  if (isLegacyXls(bytes)) throw new SheetImportError("xls_format");
  let workbook: ReturnType<typeof openWorkbook>;
  try {
    workbook = openWorkbook(bytes);
  } catch {
    throw new SheetImportError("invalid_file");
  }
  const names = workbook.sheetNames();
  const sheetName = options.sheet && names.includes(options.sheet) ? options.sheet : names[0];
  if (!sheetName) throw new SheetImportError("invalid_file");
  const { cells } = workbook.readCells(sheetName, {
    maxRows: MAX_SHEET_ROWS + 12,
    maxCols: 120,
    maxCellChars: 500,
  });
  const warnings: string[] = [];

  // Cabeçalho: entre as 12 primeiras linhas, a que mais colunas conhecidas tem.
  let headerIndex = -1;
  let best = 0;
  for (let r = 0; r < Math.min(cells.length, 12); r++) {
    const found = new Set<SheetColumn>();
    for (const cell of cells[r] ?? []) {
      const col = cell && matchColumn(cell);
      if (col) found.add(col);
    }
    if (found.size > best) {
      best = found.size;
      headerIndex = r;
    }
  }
  if (headerIndex < 0 || best < 4) throw new SheetImportError("no_header");
  const row1 = cells[headerIndex] ?? [];
  const row2 = cells[headerIndex + 1] ?? [];

  // Colunas: cabeçalho de uma linha ou de duas (grupo + subcoluna).
  const columns: Partial<Record<SheetColumn, number>> = {};
  const headers: Partial<Record<SheetColumn, string>> = {};
  const width = Math.max(row1.length, row2.length);
  const take = (col: SheetColumn | null, index: number, header: string) => {
    if (!col || columns[col] !== undefined) return;
    columns[col] = index;
    headers[col] = header;
  };
  let carry: string | null = null;
  const used2 = new Set<number>();
  for (let c = 0; c < width; c++) {
    const h1 = (row1[c] ?? "").trim();
    const h2 = (row2[c] ?? "").trim();
    if (h1) {
      const opensGroup = !!h2 && GROUP_HEADERS.has(normalizeHeader(h1));
      carry = opensGroup ? h1 : null;
      if (opensGroup) {
        used2.add(c);
        take(matchColumn(`${h1} ${h2}`), c, `${h1} ${h2}`);
      } else take(matchColumn(h1), c, h1);
    } else if (h2 && carry) {
      used2.add(c);
      take(matchColumn(`${carry} ${h2}`), c, `${carry} ${h2}`);
    } else {
      carry = null;
    }
  }
  // A 2ª linha é subcabeçalho quando não traz números nas colunas numéricas
  // (os cabeçalhos da direita, como "WX CBM", ficam nela sem grupo).
  const secondIsHeader =
    row2.some((v) => v && v.trim()) &&
    !NUMERIC_COLUMNS.some((col) => {
      const i = columns[col];
      return i !== undefined && num(row2[i]) !== null;
    });
  if (secondIsHeader)
    for (let c = 0; c < width; c++) {
      const h2 = (row2[c] ?? "").trim();
      if (h2 && !used2.has(c) && !(row1[c] ?? "").trim())
        take(matchColumn(h2), c, h2);
    }
  const dataStart = headerIndex + (secondIsHeader ? 2 : 1);
  const currency =
    (columns.price !== undefined
      ? currencyInHeader(headers.price ?? "")
      : null) ?? null;

  // Linhas de produto.
  const rows: ParsedRow[] = [];
  for (let r = dataStart; r < cells.length && rows.length < MAX_SHEET_ROWS; r++) {
    const line = cells[r] ?? [];
    const values: Partial<Record<SheetColumn, string>> = {};
    for (const [col, index] of Object.entries(columns) as Array<[SheetColumn, number]>) {
      const v = (line[index] ?? "").trim();
      if (v) values[col] = v;
    }
    if (!DATA_COLUMNS.some((col) => values[col])) continue;
    rows.push({ row: r + 1, values });
  }
  if (!rows.length) throw new SheetImportError("no_rows");

  const images = workbook.readImages(sheetName, {
    maxImages: MAX_IMAGES,
    maxImageBytes: MAX_IMAGE_BYTES,
  });
  const groups = groupRows(rows, columns, images, currency ?? options.defaultCurrency ?? null, warnings);
  if (groups.length > MAX_SHEET_PRODUCTS) throw new SheetImportError("too_many");
  return { sheetName, headerRow: headerIndex + 1, columns, headers, currency, rows, groups, warnings };
}

/** "33.5x24.8x1.5", "33,5 X 24,8 X 1,5 cm" → medidas; o resto é texto. */
function parseSize(raw: string | undefined) {
  if (!raw) return null;
  const m =
    /(\d+(?:[.,]\d+)?)\s*[x×X*]\s*(\d+(?:[.,]\d+)?)\s*[x×X*]\s*(\d+(?:[.,]\d+)?)/.exec(
      raw,
    );
  if (!m) return null;
  const [l, w, h] = [m[1], m[2], m[3]].map((s) => num(s));
  return l && w && h ? { lengthCm: l, widthCm: w, heightCm: h } : null;
}

function groupRows(
  rows: ParsedRow[],
  columns: Partial<Record<SheetColumn, number>>,
  images: SheetImage[],
  currency: SheetCurrency | null,
  warnings: string[],
): ProductGroup[] {
  const groups: ProductGroup[] = [];
  let lastKey: string | null = null;
  for (const { row, values } of rows) {
    const raw: Record<string, unknown> = {};
    for (const field of READING_FIELDS)
      if (values[field] !== undefined) raw[field] = values[field];
    // Moeda: coluna própria, cabeçalho do preço ou a escolhida na tela.
    raw.currency = values.currency ?? currency ?? undefined;
    // Capacidade só vale como número; "A4" ou "8X10" é o tamanho (nome).
    const capacity = values.capacityMl;
    const capacityNumber = capacity && num(capacity) !== null && /^\s*[\d.,]+\s*(ML|L)?\s*$/i.test(capacity);
    if (capacity && !capacityNumber) delete raw.capacityMl;
    const reading = normalizeReading(raw);
    if (values.price && reading.price === undefined && !raw.currency)
      warnings.push(`row_${row}:price_without_currency`);
    const dims = parseSize(values.sizeText);
    const lengthCm = num(values.lengthCm) ?? dims?.lengthCm ?? null;
    const widthCm = num(values.widthCm) ?? dims?.widthCm ?? null;
    const heightCm = num(values.heightCm) ?? dims?.heightCm ?? null;
    const sizeText =
      (capacity && !capacityNumber ? text(capacity, 60) : null) ??
      (values.sizeText && !dims ? text(values.sizeText, 60) : null);
    const description = text(values.description, 120);
    const name = text(values.name, 160);
    const color = text(values.colorAssortment, 200);
    const noteParts = [
      values.schedule ? `Purchase schedule: ${text(values.schedule, 80)}` : null,
      values.interval ? `Departure interval (days): ${text(values.interval, 40)}` : null,
      values.purchaseQty ? `Purchase qty (pcs): ${text(values.purchaseQty, 40)}` : null,
    ].filter(Boolean) as string[];
    const key = JSON.stringify([
      reading.factoryItemCode ?? "",
      name ?? "",
      description ?? "",
      sizeText ?? "",
      lengthCm,
      widthCm,
      heightCm,
      reading.price ?? null,
      reading.currency ?? null,
      reading.masterCartonQty ?? null,
      reading.innerQty ?? null,
      reading.cbmPerCarton ?? null,
      reading.netWeightPcKg ?? null,
      reading.grossWeightPcKg ?? null,
      reading.moq ?? null,
      reading.material ?? "",
      reading.packageType ?? "",
      reading.incoterm ?? "",
    ]);
    const last = groups[groups.length - 1];
    if (last && key === lastKey) {
      last.lastRow = row;
      if (color && !last.colors.some((c) => c.toLowerCase() === color.toLowerCase()))
        last.colors.push(color);
      continue;
    }
    lastKey = key;
    groups.push({
      index: groups.length,
      firstRow: row,
      lastRow: row,
      reading,
      colors: color ? [color] : [],
      name,
      description,
      sizeText,
      lengthCm,
      widthCm,
      heightCm,
      notes: noteParts.length ? noteParts.join("; ") : null,
      photo: null,
      card: null,
    });
  }
  // Fotos: a imagem ancorada na coluna PHOTO dentro das linhas do grupo.
  const pick = (g: ProductGroup, col: number | undefined) =>
    col === undefined
      ? null
      : (images.find(
          (img) => img.col === col && img.row + 1 >= g.firstRow && img.row + 1 <= g.lastRow,
        ) ?? null);
  for (const g of groups) {
    g.photo = pick(g, columns.photo);
    g.card = pick(g, columns.businessCard);
    g.reading.colorAssortment = g.colors.length
      ? g.colors.join(" / ").slice(0, 200)
      : g.reading.colorAssortment;
  }
  return groups;
}

/* ------------------------------------------------------------------------ */
/* Importação                                                                */
/* ------------------------------------------------------------------------ */

export interface SheetImportOptions {
  lineId: string;
  /** Entra antes da descrição e do tamanho no nome ("Porta-retrato"). */
  namePrefix?: string | null;
  /** Moeda do preço quando a planilha não diz. */
  defaultCurrency?: SheetCurrency | null;
  sheet?: string | null;
}

export interface SheetImportRowResult {
  index: number;
  rows: string;
  name: string;
  productId: string | null;
  status: "created" | "updated" | "error";
  error: string | null;
  supplierName: string | null;
  photos: number;
  missing: SheetMissing[];
}

export interface SheetImportSummary extends Record<string, number> {
  groups: number;
  rows: number;
  created: number;
  updated: number;
  errors: number;
  suppliersCreated: number;
  photos: number;
}

export interface SheetImportResult {
  batchId: string;
  sheetName: string;
  summary: SheetImportSummary;
  results: SheetImportRowResult[];
  warnings: string[];
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Nome do produto: prefixo + descrição + tamanho; ou a coluna NAME quando existe. */
export function productNameFor(group: ProductGroup, prefix: string | null | undefined): string {
  const base =
    group.name ??
    [prefix?.trim() || null, group.description, group.sizeText ?? dimsText(group)]
      .filter(Boolean)
      .join(" ");
  const fallback = group.reading.factoryItemCode
    ? `${prefix?.trim() || "Item"} ${group.reading.factoryItemCode}`
    : `${prefix?.trim() || "Item"} ${group.firstRow}`;
  return (base.trim() || fallback).slice(0, 160);
}

function dimsText(g: ProductGroup) {
  return g.lengthCm && g.widthCm && g.heightCm
    ? `${g.lengthCm}×${g.widthCm}×${g.heightCm} cm`
    : null;
}

function sheetInputFrom(r: ReadingValues, notes: string | null): SheetInput {
  const n = (k: ReadingField) => (typeof r[k] === "number" ? (r[k] as number) : undefined);
  const s = (k: ReadingField) => (typeof r[k] === "string" ? (r[k] as string) : undefined);
  return {
    sheetDate: s("sheetDate"),
    location: s("location"),
    supplierName: s("supplierName"),
    supplierStore: s("supplierStore"),
    supplierPhone: s("supplierPhone"),
    factoryItemCode: s("factoryItemCode"),
    incoterm: s("incoterm") as SheetIncoterm | undefined,
    currency: s("currency") as SheetCurrency | undefined,
    price: n("price"),
    moq: n("moq"),
    masterCartonQty: n("masterCartonQty"),
    innerQty: n("innerQty"),
    netWeightPcKg: n("netWeightPcKg"),
    grossWeightPcKg: n("grossWeightPcKg"),
    cbmPerCarton: n("cbmPerCarton"),
    capacityMl: n("capacityMl"),
    packageType: s("packageType"),
    colorAssortment: s("colorAssortment"),
    material: s("material"),
    powerDetail: s("powerDetail"),
    ...(notes ? { notes } : {}),
  };
}

/**
 * Fornecedor da linha: o cadastrado com o mesmo nº de loja ou o mesmo nome;
 * senão, cadastra (nome, loja, telefone, cidade). O cadastro que existe
 * ganha o que lhe falta (loja, telefone), sem trocar o que já tem.
 */
async function resolveSupplier(
  user: User,
  reading: ReadingValues,
  suppliers: Party[],
): Promise<{ party: Party; created: boolean } | null> {
  const store = getStore();
  const name = typeof reading.supplierName === "string" ? reading.supplierName : null;
  const code = typeof reading.supplierStore === "string" ? reading.supplierStore : null;
  const phone = typeof reading.supplierPhone === "string" ? reading.supplierPhone : null;
  const city = typeof reading.location === "string" ? reading.location : null;
  const found =
    (code && suppliers.find((p) => norm(p.storeNumber) === norm(code))) ||
    (name && suppliers.find((p) => norm(p.name) === norm(name))) ||
    null;
  if (found) {
    const patch: Partial<Party> = {};
    if (!found.storeNumber && code) patch.storeNumber = code;
    if (!found.phone && phone) patch.phone = phone;
    if (!found.city && city) patch.city = city;
    if (Object.keys(patch).length) {
      const updated = await store.update("parties", found.id, patch);
      Object.assign(found, updated);
    }
    return { party: found, created: false };
  }
  if (!name) return null;
  const party = await store.create("parties", {
    ...PARTY_EXTRA_DEFAULTS,
    type: "supplier",
    name: name.slice(0, 160),
    country: "China",
    email: null,
    phone,
    taxId: null,
    notes: "Cadastrado pela importação da ficha técnica.",
    city,
    address: null,
    contactName: null,
    wechat: null,
    storeNumber: code,
    active: true,
  });
  await audit(user, "party.create", "party", party.id, `${party.name} (importação da ficha técnica)`);
  suppliers.push(party);
  return { party, created: true };
}

async function attachPhoto(
  user: User,
  productId: string,
  image: SheetImage | null,
  kind: "original" | "business_card",
  existingKinds: Set<string>,
): Promise<number> {
  if (!image || existingKinds.has(kind)) return 0;
  const file = new File([new Uint8Array(image.bytes)], image.name, { type: image.mime });
  const photos = await addPhotos(user, { productId }, [file], kind);
  if (photos.length) existingKinds.add(kind);
  return photos.length;
}

/**
 * Importa a planilha: para cada produto da aba, cadastra ou atualiza (mesmo
 * nome na mesma linha de produto), grava a ficha mestre e as fotos, e devolve
 * o que falta em cada um. O arquivo fica guardado como evidência do lote.
 */
export async function importProductSheet(
  user: User,
  file: File,
  options: SheetImportOptions,
): Promise<SheetImportResult> {
  assertWellmix(user);
  const store = getStore();
  const line = options.lineId ? await store.get("product_lines", options.lineId) : null;
  if (!line) throw new SheetImportError("line_required");
  if (file.size === 0) throw new SheetImportError("file_required");
  const currency =
    options.defaultCurrency && (SHEET_CURRENCIES as readonly string[]).includes(options.defaultCurrency)
      ? options.defaultCurrency
      : null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseProductSheet(bytes, { sheet: options.sheet, defaultCurrency: currency });

  const [suppliers, products] = await Promise.all([
    store.list("parties", { filter: { type: "supplier" } }),
    store.list("products"),
  ]);
  const summary: SheetImportSummary = {
    groups: parsed.groups.length,
    rows: parsed.rows.length,
    created: 0,
    updated: 0,
    errors: 0,
    suppliersCreated: 0,
    photos: 0,
  };
  const results: SheetImportRowResult[] = [];
  const decisions: Record<string, string> = {};
  const namesUsed = new Map<string, number>();
  for (const group of parsed.groups) {
    const rowsLabel =
      group.firstRow === group.lastRow ? String(group.firstRow) : `${group.firstRow}–${group.lastRow}`;
    let name = productNameFor(group, options.namePrefix);
    // Dois produtos da planilha com o mesmo nome: o código da fábrica desempata.
    const seen = namesUsed.get(norm(name)) ?? 0;
    namesUsed.set(norm(name), seen + 1);
    if (seen > 0)
      name = `${name} ${group.reading.factoryItemCode ? `· ${group.reading.factoryItemCode}` : `(${seen + 1})`}`.slice(0, 160);
    const result: SheetImportRowResult = {
      index: group.index,
      rows: rowsLabel,
      name,
      productId: null,
      status: "error",
      error: null,
      supplierName: null,
      photos: 0,
      missing: [],
    };
    results.push(result);
    try {
      const supplier = await resolveSupplier(user, group.reading, suppliers);
      if (supplier?.created) summary.suppliersCreated++;
      result.supplierName = supplier?.party.name ?? null;
      const supplierId = supplier?.party.id ?? null;
      const supplierSku =
        typeof group.reading.factoryItemCode === "string" ? group.reading.factoryItemCode.slice(0, 60) : null;
      const sizes = {
        lengthCm: group.lengthCm,
        widthCm: group.widthCm,
        heightCm: group.heightCm,
      };
      const existing = products.find(
        (p) => p.lineId === options.lineId && norm(p.name) === norm(name),
      );
      let product: Product;
      if (existing) {
        const patch: Partial<Product> = {};
        if (supplierId) patch.supplierId = supplierId;
        if (supplierSku) patch.supplierSku = supplierSku;
        for (const [k, v] of Object.entries(sizes) as Array<[keyof typeof sizes, number | null]>)
          if (v !== null) patch[k] = v;
        product = Object.keys(patch).length
          ? await store.update("products", existing.id, patch)
          : existing;
        if (supplierId)
          await syncMainSupplierLink(
            user,
            { supplierId: existing.supplierId, supplierSku: existing.supplierSku },
            { supplierId, supplierSku: supplierSku ?? existing.supplierSku },
            product.id,
          );
        result.status = "updated";
        summary.updated++;
      } else {
        product = await store.create("products", {
          ...PRODUCT_EXTRA_DEFAULTS,
          lineId: options.lineId,
          name,
          sku: null,
          specification: null,
          supplierId,
          supplierSku,
          material:
            typeof group.reading.material === "string" ? group.reading.material.slice(0, 120) : null,
          ...sizes,
          active: true,
          source: "import",
        });
        products.push(product);
        if (supplierId)
          await syncMainSupplierLink(
            user,
            { supplierId: null, supplierSku: null },
            { supplierId, supplierSku },
            product.id,
          );
        await audit(user, "product.create", "product", product.id, `${name} (importação da ficha técnica)`);
        result.status = "created";
        summary.created++;
      }
      result.productId = product.id;
      const saved = await saveProductSheet(
        user,
        product.id,
        sheetInputFrom(group.reading, group.notes),
      );
      // Fotos: a do produto (original) e o cartão do fornecedor; nunca repete em nova importação.
      const kinds = new Set(
        (await store.list("product_photos", { filter: { productId: product.id } })).map((p) => p.kind as string),
      );
      result.photos += await attachPhoto(user, product.id, group.photo, "original", kinds);
      result.photos += await attachPhoto(user, product.id, group.card, "business_card", kinds);
      summary.photos += result.photos;
      // O que falta, com as fotos recém-anexadas.
      result.missing = saved.missing.filter((m) => !(m === "originalPhoto" && kinds.has("original")));
      decisions[String(group.index)] = `${result.status}:${product.id}`;
    } catch (error) {
      result.status = "error";
      result.error = error instanceof Error ? error.message : "unexpected";
      summary.errors++;
      decisions[String(group.index)] = `error:${result.error}`;
    }
  }

  // Lote: evidência (arquivo guardado) e histórico do que entrou.
  const doc = await uploadDocument(user, file, {
    type: "attachment",
    visibility: "internal",
  }).catch(() => null);
  const headers = Object.values(parsed.headers).filter(Boolean) as string[];
  const batch: ImportBatch = await store.create("import_batches", {
    entity: SHEET_IMPORT_ENTITY,
    fileDocumentId: doc?.id ?? null,
    fileName: (file.name || "ficha.xlsx").slice(0, 200),
    sheetName: parsed.sheetName,
    headers,
    rows: parsed.rows.slice(0, 500).map((r) =>
      Object.fromEntries(
        (Object.entries(r.values) as Array<[SheetColumn, string]>).map(([col, v]) => [
          parsed.headers[col] ?? col,
          v,
        ]),
      ),
    ),
    mapping: {
      __lineId: options.lineId,
      __namePrefix: options.namePrefix?.trim() || "",
      __currency: parsed.currency ?? currency ?? "",
      ...Object.fromEntries(
        (Object.entries(parsed.headers) as Array<[SheetColumn, string]>).map(([col, h]) => [h, col]),
      ),
    },
    decisions,
    status: "imported",
    summary,
    rowCount: parsed.rows.length,
    createdByUserId: user.id,
  });
  await audit(
    user,
    "import.sheet",
    "import_batch",
    batch.id,
    `Ficha técnica ${batch.fileName}: ${summary.created} criados, ${summary.updated} atualizados, ${summary.errors} erros, ${summary.suppliersCreated} fornecedor(es) novo(s), ${summary.photos} foto(s)`,
  );
  return { batchId: batch.id, sheetName: parsed.sheetName, summary, results, warnings: parsed.warnings };
}

/** Lote de ficha técnica: produtos (ids) de cada grupo, para a tela de resultado. */
export function batchProductIds(batch: ImportBatch): string[] {
  return Object.values(batch.decisions)
    .map((d) => (d.startsWith("created:") || d.startsWith("updated:") ? d.slice(d.indexOf(":") + 1) : null))
    .filter((id): id is string => !!id);
}
