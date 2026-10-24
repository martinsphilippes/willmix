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
import { registerUploadedDocument, uploadDocument } from "./documents";
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
/**
 * Produtos por importação: cada um são ~20 gravações no banco (produto,
 * ficha, vínculo, fotos, auditoria); mais que isso não cabe no tempo de uma
 * requisição na Vercel. Planilha maior: dividir.
 */
export const MAX_SHEET_PRODUCTS = 80;
/** Abas examinadas para achar a da ficha. */
const MAX_SHEETS = 12;
/** Fotos lidas: só as colunas de foto e cartão; o Excel grava várias âncoras por célula. */
const MAX_IMAGES = 5000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_TOTAL_BYTES = 120 * 1024 * 1024;
/** Tetos do que se descompacta do arquivo (proteção contra "zip bomb"). */
const WORKBOOK_MAX_BYTES = 192 * 1024 * 1024;
const SHEET_XML_MAX_BYTES = 64 * 1024 * 1024;

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
 * com letras e números). Primeiro vale a igualdade exata; depois, regras
 * especiais (preço, pesos da caixa) e o cabeçalho que começa com o sinônimo.
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
/** Cabeçalhos que abrem um grupo de subcolunas (SIZE → LENGTH, WIDTH, HEIGHT). */
const GROUP_HEADER = /\b(SIZE|TAMANHO|MEDIDAS?|DIMENSIONS?|DIMENSOES)\b|尺寸/;
/** Peso da caixa (não é por peça): fica de fora. */
const CARTON_WORD = /\b(CTN|CARTON|BOX|CX|CAIXA|MASTER)\b/;

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
  // "FOB PRICE", "PRICE USD", "UNIT PRICE RMB": é o preço (o incoterm vem junto).
  if (/\b(PRICE|PRECO)\b|单价|价格/.test(h) && !/\bTOTAL\b/.test(h)) return "price";
  // "N.W/CTN", "G.W BOX": peso da caixa, não da peça: ignorado.
  if (/\b(N ?W|G ?W|NET WEIGHT|GROSS WEIGHT|PESO)\b/.test(h) && CARTON_WORD.test(h))
    return null;
  for (const [column, synonyms] of HEADERS) {
    if (column === "incoterm") continue;
    for (const syn of synonyms)
      if (h.startsWith(`${syn} `)) return column;
  }
  return null;
}

/** Moeda escrita no cabeçalho do preço ("PRICE / U$", "PREÇO R$", "单价 RMB"). */
export function currencyInHeader(header: string): SheetCurrency | null {
  const h = header.toUpperCase();
  if (/BRL|R\$|REAL|REAIS/.test(h)) return "BRL";
  if (/RMB|CNY|¥|元|YUAN/.test(h)) return "RMB";
  if (/EUR|€/.test(h)) return "EUR";
  if (/USD|US\$|U\$|DOLLAR|美元/.test(h) || /(^|[^A-Z])\$/.test(h)) return "USD";
  return null;
}

/** Incoterm escrito no cabeçalho do preço ("FOB PRICE"). */
function incotermInHeader(header: string): SheetIncoterm | null {
  const h = normalizeHeader(header);
  if (/\bFOB\b/.test(h) && !/\bEXW\b/.test(h)) return "FOB";
  if (/\bEXW\b/.test(h) && !/\bFOB\b/.test(h)) return "EXW";
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

/** Data gravada como número de série do Excel (dias desde 1899-12-30) → ISO. */
function excelSerialDate(raw: string): string | null {
  if (!/^\d{5}(\.\d+)?$/.test(raw.trim())) return null;
  const days = Math.floor(Number(raw));
  if (days < 20000 || days > 80000) return null;
  return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).toISOString();
}

/** "350", "350 ml" → 350; "1.5L", "1,5 l" → 1500; texto ("A4") → null. */
function capacityMl(raw: string): number | null {
  const s = raw.trim();
  if (/^[\d.,]+\s*ML$/i.test(s) || /^[\d.,]+$/.test(s)) return num(s);
  if (/^[\d.,]+\s*L$/i.test(s)) {
    const l = num(s);
    return l === null ? null : Math.round(l * 1000);
  }
  return null;
}

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

type Cells = string[][];

/** Quantas colunas conhecidas a linha tem (para achar o cabeçalho). */
function headerScore(line: string[] | undefined) {
  const found = new Set<SheetColumn>();
  for (const cell of line ?? []) {
    const col = cell && matchColumn(cell);
    if (col) found.add(col);
  }
  return found.size;
}

/** Linha do cabeçalho entre as 12 primeiras (a que mais colunas conhecidas tem). */
function findHeader(cells: Cells) {
  let index = -1;
  let best = 0;
  for (let r = 0; r < Math.min(cells.length, 12); r++) {
    const score = headerScore(cells[r]);
    if (score > best) {
      best = score;
      index = r;
    }
  }
  return { index, score: best };
}

/**
 * Lê a aba da ficha (a escolhida, ou a que tem o cabeçalho mais parecido) e
 * agrupa as linhas em produtos. Linhas seguidas com o mesmo código, descrição,
 * tamanho, preço e embalagem são o mesmo produto em cores diferentes.
 */
export function parseProductSheet(
  bytes: Uint8Array,
  options: { sheet?: string | null; defaultCurrency?: SheetCurrency | null } = {},
): ParsedSheet {
  if (isLegacyXls(bytes)) throw new SheetImportError("xls_format");
  let workbook: ReturnType<typeof openWorkbook>;
  try {
    workbook = openWorkbook(bytes, { maxTotalBytes: WORKBOOK_MAX_BYTES });
  } catch {
    throw new SheetImportError("invalid_file");
  }
  const names = workbook.sheetNames();
  if (!names.length) throw new SheetImportError("invalid_file");
  const limits = {
    maxRows: MAX_SHEET_ROWS + 12,
    maxCols: 120,
    maxCellChars: 500,
    maxXmlBytes: SHEET_XML_MAX_BYTES,
  };
  const read = (name: string): Cells => {
    try {
      return workbook.readCells(name, limits).cells;
    } catch (error) {
      if (error instanceof Error && error.message === "xlsx_too_large")
        throw new SheetImportError("too_large");
      throw new SheetImportError("invalid_file");
    }
  };
  // Aba: a pedida; senão, entre as primeiras, a de cabeçalho mais parecido.
  let sheetName: string | null = null;
  let cells: Cells = [];
  let header = { index: -1, score: 0 };
  if (options.sheet && names.includes(options.sheet)) {
    sheetName = options.sheet;
    cells = read(sheetName);
    header = findHeader(cells);
  } else {
    for (const name of names.slice(0, MAX_SHEETS)) {
      const candidate = read(name);
      const found = findHeader(candidate);
      if (found.score > header.score) {
        sheetName = name;
        cells = candidate;
        header = found;
      }
      if (found.score >= 8) break;
    }
  }
  if (!sheetName || header.index < 0 || header.score < 4)
    throw new SheetImportError("no_header");
  const headerIndex = header.index;
  const row1 = cells[headerIndex] ?? [];
  const row2 = cells[headerIndex + 1] ?? [];
  const warnings: string[] = [];

  // Colunas: cabeçalho de uma linha ou de duas (grupo + subcoluna).
  const columns: Partial<Record<SheetColumn, number>> = {};
  const headers: Partial<Record<SheetColumn, string>> = {};
  const width = Math.max(row1.length, row2.length);
  const take = (col: SheetColumn | null, index: number, header: string) => {
    if (!col || columns[col] !== undefined) return false;
    columns[col] = index;
    headers[col] = header;
    return true;
  };
  // Colunas reconhecidas pelo cabeçalho da 1ª linha (sem grupo): se a 2ª linha
  // tiver valor numa delas, a 2ª linha é dado, não subcabeçalho. Rótulos
  // soltos que não são coluna ("45 DAYS") não contam.
  const plainRow1 = new Set<number>();
  let carry: string | null = null;
  for (let c = 0; c < width; c++) {
    const h1 = (row1[c] ?? "").trim();
    const h2 = (row2[c] ?? "").trim();
    if (h1) {
      const opensGroup = !!h2 && GROUP_HEADER.test(normalizeHeader(h1));
      carry = opensGroup ? h1 : null;
      if (opensGroup) {
        if (!take(matchColumn(`${h1} ${h2}`), c, `${h1} ${h2}`))
          take(matchColumn(h2), c, h2);
      } else {
        const own = matchColumn(h1);
        if (own) plainRow1.add(c);
        // Rótulo na 1ª linha e subcoluna na 2ª ("PRODUCT SIZE (CM)" / LENGTH).
        if (!take(own, c, h1) && h2) {
          if (!take(matchColumn(`${h1} ${h2}`), c, `${h1} ${h2}`))
            take(matchColumn(h2), c, h2);
        }
      }
    } else if (h2 && carry) {
      if (!take(matchColumn(`${carry} ${h2}`), c, `${carry} ${h2}`))
        take(matchColumn(h2), c, h2);
    } else {
      carry = null;
    }
  }
  const secondIsHeader =
    row2.some((v) => v && v.trim()) &&
    !row2.some((v, c) => !!(v && v.trim()) && plainRow1.has(c));
  if (secondIsHeader)
    for (let c = 0; c < width; c++) {
      const h2 = (row2[c] ?? "").trim();
      if (h2 && !(row1[c] ?? "").trim()) take(matchColumn(h2), c, h2);
    }
  const dataStart = headerIndex + (secondIsHeader ? 2 : 1);
  const priceHeader = headers.price ?? "";
  const currency = currencyInHeader(priceHeader);
  const incoterm = incotermInHeader(priceHeader);

  // Linhas de produto.
  const rows: ParsedRow[] = [];
  let truncated = false;
  for (let r = dataStart; r < cells.length; r++) {
    const line = cells[r] ?? [];
    const values: Partial<Record<SheetColumn, string>> = {};
    for (const [col, index] of Object.entries(columns) as Array<[SheetColumn, number]>) {
      const v = (line[index] ?? "").trim();
      if (v) values[col] = v;
    }
    if (!DATA_COLUMNS.some((col) => values[col])) continue;
    if (rows.length >= MAX_SHEET_ROWS) {
      truncated = true;
      break;
    }
    rows.push({ row: r + 1, values });
  }
  if (!rows.length) throw new SheetImportError("no_rows");
  if (truncated) warnings.push(`rows_truncated:${MAX_SHEET_ROWS}`);

  const imageCols = [columns.photo, columns.businessCard].filter(
    (c): c is number => c !== undefined,
  );
  const images = imageCols.length
    ? workbook.readImages(sheetName, {
        maxImages: MAX_IMAGES,
        maxImageBytes: MAX_IMAGE_BYTES,
        maxTotalBytes: MAX_IMAGES_TOTAL_BYTES,
        cols: imageCols,
      })
    : [];
  const groups = groupRows(
    rows,
    columns,
    images,
    currency ?? options.defaultCurrency ?? null,
    incoterm,
    warnings,
  );
  if (groups.length > MAX_SHEET_PRODUCTS) throw new SheetImportError("too_many");
  return {
    sheetName,
    headerRow: headerIndex + 1,
    columns,
    headers,
    currency,
    rows,
    groups,
    warnings,
  };
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
  incoterm: SheetIncoterm | null,
  warnings: string[],
): ProductGroup[] {
  const groups: ProductGroup[] = [];
  let lastKey: string | null = null;
  for (const { row, values } of rows) {
    const raw: Record<string, unknown> = {};
    for (const field of READING_FIELDS)
      if (values[field] !== undefined) raw[field] = values[field];
    // Moeda e incoterm: coluna própria, cabeçalho do preço ou a escolhida na
    // tela (só acompanham um preço; sem preço, a moeda não entra).
    raw.currency = values.price ? (values.currency ?? currency ?? undefined) : values.currency;
    if (!values.incoterm && incoterm) raw.incoterm = incoterm;
    // Data gravada como número de série do Excel.
    if (values.sheetDate) raw.sheetDate = excelSerialDate(values.sheetDate) ?? values.sheetDate;
    // Capacidade: ml (ou litros); "A4" / "8X10" é o tamanho (vai para o nome).
    const capacity = values.capacityMl;
    const ml = capacity ? capacityMl(capacity) : null;
    if (capacity) {
      if (ml !== null) raw.capacityMl = ml;
      else delete raw.capacityMl;
    }
    const reading = normalizeReading(raw);
    if (values.price && reading.price === undefined && !raw.currency)
      warnings.push(`row_${row}:price_without_currency`);
    const dims = parseSize(values.sizeText);
    const lengthCm = num(values.lengthCm) ?? dims?.lengthCm ?? null;
    const widthCm = num(values.widthCm) ?? dims?.widthCm ?? null;
    const heightCm = num(values.heightCm) ?? dims?.heightCm ?? null;
    const sizeText =
      (capacity && ml === null ? text(capacity, 60) : null) ??
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

/** Planilha enviada no formulário ou já subida direto ao armazenamento. */
export type SheetSource =
  | File
  | { fileKey: string; fileName?: string | null }
  /** Link de uma planilha do Google Sheets compartilhada com o link. */
  | { url: string };

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
    if (!found.storeNumber && code) patch.storeNumber = code.slice(0, 60);
    if (!found.phone && phone) patch.phone = phone.slice(0, 40);
    if (!found.city && city) patch.city = city.slice(0, 80);
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
    phone: phone?.slice(0, 40) ?? null,
    taxId: null,
    notes: "Cadastrado pela importação da ficha técnica.",
    city: city?.slice(0, 80) ?? null,
    address: null,
    contactName: null,
    wechat: null,
    storeNumber: code?.slice(0, 60) ?? null,
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

/** Bytes e nome da planilha: do formulário ou do arquivo já subido direto. */
async function sheetBytes(source: SheetSource) {
  if (source instanceof File) {
    if (source.size === 0) throw new SheetImportError("file_required");
    return {
      bytes: new Uint8Array(await source.arrayBuffer()),
      name: source.name || "ficha.xlsx",
    };
  }
  if ("url" in source) {
    const { fetchGoogleSheetXlsx, GoogleSheetError } = await import("./google-sheet");
    try {
      return await fetchGoogleSheetXlsx(source.url);
    } catch (error) {
      if (error instanceof GoogleSheetError) throw new SheetImportError(error.message);
      throw new SheetImportError("sheet_fetch_failed");
    }
  }
  const stored = await getStore().getFile(source.fileKey);
  if (!stored || stored.bytes.length === 0) throw new SheetImportError("file_required");
  return { bytes: stored.bytes, name: source.fileName || stored.name || "ficha.xlsx" };
}

/**
 * Importa a planilha: para cada produto da aba, cadastra ou atualiza (mesmo
 * nome na mesma linha de produto e mesmo fornecedor), grava a ficha mestre e
 * as fotos, e devolve o que falta em cada um. O arquivo fica guardado como
 * evidência do lote.
 */
export async function importProductSheet(
  user: User,
  source: SheetSource,
  options: SheetImportOptions,
): Promise<SheetImportResult> {
  assertWellmix(user);
  const store = getStore();
  const line = options.lineId ? await store.get("product_lines", options.lineId) : null;
  if (!line) throw new SheetImportError("line_required");
  const currency =
    options.defaultCurrency && (SHEET_CURRENCIES as readonly string[]).includes(options.defaultCurrency)
      ? options.defaultCurrency
      : null;
  const file = await sheetBytes(source);
  const parsed = parseProductSheet(file.bytes, { sheet: options.sheet, defaultCurrency: currency });

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
  const namesUsed = new Set<string>();
  for (const group of parsed.groups) {
    const rowsLabel =
      group.firstRow === group.lastRow ? String(group.firstRow) : `${group.firstRow}–${group.lastRow}`;
    const result: SheetImportRowResult = {
      index: group.index,
      rows: rowsLabel,
      name: productNameFor(group, options.namePrefix),
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
      // Mesmo nome na mesma linha: só do mesmo fornecedor (ou sem fornecedor).
      // Nome igual de outro fornecedor: produto novo, com o fornecedor no nome.
      const sameName = products.filter(
        (p) => p.lineId === options.lineId && norm(p.name) === norm(result.name),
      );
      let existing = sameName.find(
        (p) => !p.supplierId || !supplierId || p.supplierId === supplierId,
      );
      let name = result.name;
      if (!existing && sameName.length && supplier)
        name = `${name} · ${supplier.party.name}`.slice(0, 160);
      // Dois grupos da planilha com o mesmo nome: código da fábrica, depois um contador.
      if (namesUsed.has(norm(name))) {
        const code = group.reading.factoryItemCode;
        const withCode = code ? `${name} · ${code}`.slice(0, 160) : null;
        if (withCode && !namesUsed.has(norm(withCode))) name = withCode;
        else {
          const base = withCode ?? name;
          let n = 2;
          while (namesUsed.has(norm(`${base} (${n})`))) n++;
          name = `${base} (${n})`.slice(0, 160);
        }
        existing = undefined;
      }
      namesUsed.add(norm(name));
      result.name = name;
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
      // Falha depois de criar o produto: ele existe (fica no resultado), mas
      // o grupo conta como erro, não duas vezes.
      if (result.status === "created") summary.created--;
      if (result.status === "updated") summary.updated--;
      result.status = "error";
      result.error = (error instanceof Error ? error.message : "unexpected").slice(0, 120);
      summary.errors++;
      decisions[String(group.index)] = `error:${result.productId ?? "-"}:${result.error}`;
    }
  }

  // Lote: evidência (arquivo guardado) e histórico do que entrou. A planilha
  // baixada do Google fica guardada como se tivesse sido enviada.
  const doc = await (source instanceof File
    ? uploadDocument(user, source, { type: "attachment", visibility: "internal" })
    : "url" in source
      ? uploadDocument(
          user,
          new File([new Uint8Array(file.bytes)], file.name, {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          { type: "attachment", visibility: "internal" },
        )
      : registerUploadedDocument(user, source.fileKey, {
          type: "attachment",
          visibility: "internal",
        })
  ).catch(() => null);
  const headers = Object.values(parsed.headers).filter(Boolean) as string[];
  const batch: ImportBatch = await store.create("import_batches", {
    entity: SHEET_IMPORT_ENTITY,
    fileDocumentId: doc?.id ?? null,
    fileName: file.name.slice(0, 255),
    sheetName: parsed.sheetName.slice(0, 120),
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

/** Decisão de um grupo do lote: situação, produto (se existe) e erro. */
export function batchDecision(decision: string): {
  status: "created" | "updated" | "error";
  productId: string | null;
  error: string | null;
} {
  const [status, ...rest] = decision.split(":");
  if (status === "created" || status === "updated")
    return { status, productId: rest.join(":") || null, error: null };
  const [productId, ...message] = rest;
  return {
    status: "error",
    productId: productId && productId !== "-" ? productId : null,
    error: message.join(":") || null,
  };
}

/** Lote de ficha técnica: produtos (ids) de cada grupo, para a tela de resultado. */
export function batchProductIds(batch: ImportBatch): string[] {
  return Object.values(batch.decisions)
    .map((d) => batchDecision(d).productId)
    .filter((id): id is string => !!id);
}
