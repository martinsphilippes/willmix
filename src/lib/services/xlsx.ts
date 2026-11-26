import { inflateRawSync } from "node:zlib";
import {
  cellsOfRect,
  MAX_SHEET_COLS_INDEX,
  MAX_SHEET_ROWS_INDEX,
  pointOf,
  SheetAxis,
  type ImageCells,
} from "./sheet-geometry";

/**
 * Leitor mínimo de XLSX sem dependências: abre o ZIP, lê a planilha escolhida
 * (ou a primeira) e devolve linhas como texto. Cobre o que as exportações do
 * sistema chinês trazem: texto (shared strings, inline) e números.
 * Limitações conhecidas: datas chegam como número serial do Excel; fórmulas
 * trazem o último valor calculado; células mescladas valem só na 1ª célula.
 *
 * Arquivo vindo de fora: só as partes usadas são descompactadas, com teto de
 * tamanho no total (proteção contra "zip bomb"), e o XML é percorrido em
 * tempo linear (sem expressão regular que volta atrás em XML malformado).
 */

export interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

/** Colunas lidas por linha nas importações (planilhas reais usam poucas dezenas). */
const MAX_GRID_COLUMNS = 256;

/** Teto padrão do que se descompacta de um arquivo (planilhas fiscais grandes cabem com folga). */
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

interface ZipRecord {
  method: number;
  compressedSize: number;
  localOffset: number;
}

interface Zip {
  get(name: string): Uint8Array | null;
}

/**
 * Índice do ZIP (diretório central); cada parte só é descompactada quando
 * pedida, uma vez, e a soma do que foi descompactado não passa de `budget`.
 */
function openZip(bytes: Uint8Array, budget = MAX_TOTAL_BYTES): Zip {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Fim do diretório central (assinatura 0x06054b50), procurado do fim para o início.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 70000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("xlsx_invalid");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const records = new Map<string, ZipRecord>();
  const offsets = new Set<number>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameLen),
    );
    // Duas entradas apontando para os mesmos bytes: só a primeira vale.
    if (!records.has(name) && !offsets.has(localOffset)) {
      records.set(name, { method, compressedSize, localOffset });
      offsets.add(localOffset);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  const cache = new Map<string, Uint8Array>();
  let used = 0;
  return {
    get(name) {
      const cached = cache.get(name);
      if (cached) return cached;
      const rec = records.get(name);
      if (!rec || rec.localOffset + 30 > bytes.length) return null;
      // Cabeçalho local: tamanhos de nome e extra podem diferir do diretório central.
      const localNameLen = view.getUint16(rec.localOffset + 26, true);
      const localExtraLen = view.getUint16(rec.localOffset + 28, true);
      const start = rec.localOffset + 30 + localNameLen + localExtraLen;
      const raw = bytes.subarray(start, start + rec.compressedSize);
      const remaining = budget - used;
      if (remaining <= 0) throw new Error("xlsx_too_large");
      let data: Uint8Array;
      if (rec.method === 0) {
        if (raw.length > remaining) throw new Error("xlsx_too_large");
        data = raw;
      } else if (rec.method === 8) {
        try {
          data = new Uint8Array(
            inflateRawSync(Buffer.from(raw), { maxOutputLength: remaining }),
          );
        } catch (error) {
          throw new Error(
            (error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" ||
              error instanceof RangeError
              ? "xlsx_too_large"
              : "xlsx_invalid",
          );
        }
      } else return null;
      used += data.length;
      cache.set(name, data);
      return data;
    },
  };
}

const decode = (u: Uint8Array) => new TextDecoder("utf-8").decode(u);

function unescapeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/**
 * Tags `<nome ...>conteúdo</nome>` (ou `<nome .../>`) em tempo linear:
 * devolve [atributos, conteúdo]. Tag sem fechamento encerra a leitura (XML
 * truncado ou malicioso), em vez de varrer o resto do texto a cada tag.
 */
function* tags(xml: string, name: string): Generator<[string, string]> {
  const open = `<${name}`;
  const close = `</${name}>`;
  let i = 0;
  // Depois de aspas sem fechamento, o resto do texto é lido sem tratar aspas
  // (como antes): uma aspa solta não esvazia a planilha.
  let plain = false;
  while (i < xml.length) {
    const start = xml.indexOf(open, i);
    if (start < 0) return;
    const next = xml.charCodeAt(start + open.length);
    // "<c" também começa "<cols>": só vale com espaço, ">" ou "/" depois do nome.
    if (
      next !== 32 &&
      next !== 9 &&
      next !== 10 &&
      next !== 13 &&
      next !== 62 &&
      next !== 47
    ) {
      i = start + open.length;
      continue;
    }
    let gt = plain ? xml.indexOf(">", start) : tagEnd(xml, start + open.length);
    if (gt === -2) {
      plain = true;
      gt = xml.indexOf(">", start);
    }
    if (gt < 0) return;
    if (xml.charCodeAt(gt - 1) === 47) {
      yield [xml.slice(start + open.length, gt - 1), ""];
      i = gt + 1;
      continue;
    }
    const end = xml.indexOf(close, gt + 1);
    if (end < 0) return;
    yield [xml.slice(start + open.length, gt), xml.slice(gt + 1, end)];
    i = end + close.length;
  }
}

/**
 * Fim da tag de abertura (o ">"), pulando valores de atributo entre aspas,
 * que podem conter ">" (XML válido). Tempo linear; -1 se não houver ">" e
 * -2 se o texto acabou dentro de aspas.
 */
function tagEnd(xml: string, from: number): number {
  // Só os caracteres da própria tag são lidos (tempo linear no total).
  let quote = 0;
  for (let i = from; i < xml.length; i++) {
    const ch = xml.charCodeAt(i);
    if (quote) {
      if (ch === quote) quote = 0;
    } else if (ch === 34 || ch === 39) quote = ch;
    else if (ch === 62) return i;
  }
  // Aspas sem fechamento (XML malformado): quem chamou procura o ">" sem aspas.
  return quote ? -2 : -1;
}

/** Texto de um <si> ou <is>: concatena todos os <t> (texto rico vira texto simples). */
function textRuns(xml: string) {
  let out = "";
  for (const [, inner] of tags(xml, "t")) out += inner;
  return unescapeXml(out);
}

function sharedStrings(zip: Zip, maxBytes = Infinity): string[] {
  const entry = zip.get("xl/sharedStrings.xml");
  if (!entry) return [];
  if (entry.length > maxBytes) throw new Error("xlsx_too_large");
  const out: string[] = [];
  for (const [, inner] of tags(decode(entry), "si")) out.push(textRuns(inner));
  return out;
}

/** Lista as planilhas do arquivo na ordem do workbook. */
export function listSheets(bytes: Uint8Array): string[] {
  return workbookSheets(openZip(bytes)).map((s) => s.name);
}

function workbookSheets(zip: Zip) {
  const wb = zip.get("xl/workbook.xml");
  const rels = zip.get("xl/_rels/workbook.xml.rels");
  if (!wb) throw new Error("xlsx_invalid");
  const relMap = new Map<string, string>();
  if (rels) {
    for (const [attrs] of tags(decode(rels), "Relationship")) {
      const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
      const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
      if (id && target)
        relMap.set(
          id,
          target.replace(/^\/?(xl\/)?/, "xl/").replace(/^xl\/xl\//, "xl/"),
        );
    }
  }
  const sheets: Array<{ name: string; path: string }> = [];
  const paths = new Set<string>();
  for (const [attrs] of tags(decode(wb), "sheet")) {
    const name = unescapeXml(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const path =
      relMap.get(rid) ?? `xl/worksheets/sheet${sheets.length + 1}.xml`;
    // Duas abas apontando para a mesma parte (arquivo forjado): só a primeira.
    if (paths.has(path)) continue;
    paths.add(path);
    sheets.push({ name, path });
  }
  return sheets;
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function columnName(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function formatNumber(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  // Evita "1.0000000000000002" e notação científica em valores comuns.
  return String(Math.round(n * 1e10) / 1e10);
}

const cellType = (attrs: string) => /\bt="([^"]+)"/.exec(attrs)?.[1];

/** Conteúdo do `<v>` da célula (indexOf: tempo linear mesmo com XML malformado). */
function valueOf(inner: string): string | undefined {
  const a = inner.indexOf("<v>");
  if (a < 0) return undefined;
  const b = inner.indexOf("</v>", a + 3);
  return b < 0 ? undefined : inner.slice(a + 3, b);
}

/** Valor de uma célula como texto (o último valor calculado, se for fórmula). */
function cellValue(attrs: string, inner: string, strings: string[]): string {
  const type = cellType(attrs);
  let value = "";
  if (type === "s") {
    const idx = Number(valueOf(inner) ?? "-1");
    value = strings[idx] ?? "";
  } else if (type === "inlineStr") {
    value = textRuns(inner);
  } else if (type === "b") {
    value = valueOf(inner) === "1" ? "true" : "false";
  } else {
    const v = valueOf(inner);
    value =
      v === undefined
        ? ""
        : type === "str" || type === "e"
          ? unescapeXml(v)
          : formatNumber(v);
  }
  return value.trim();
}

/**
 * Linhas cruas da planilha (sem cabeçalho), para arquivos com títulos acima do
 * cabeçalho (ex.: TEC e TIPI). Linhas totalmente vazias são ignoradas.
 */
export function readGrid(
  bytes: Uint8Array,
  sheet?: string | number,
  maxRows = 2000,
  maxCols = MAX_GRID_COLUMNS,
): { name: string; grid: string[][] } {
  const zip = openZip(bytes);
  const sheets = workbookSheets(zip);
  if (sheets.length === 0) throw new Error("xlsx_no_sheets");
  const chosen =
    typeof sheet === "number"
      ? sheets[sheet]
      : typeof sheet === "string"
        ? sheets.find((s) => s.name === sheet)
        : sheets[0];
  const target = chosen ?? sheets[0];
  const entry = zip.get(target.path);
  if (!entry) throw new Error("xlsx_sheet_missing");
  const strings = sharedStrings(zip);
  const xml = decode(entry);

  const grid: string[][] = [];
  for (const [, rowXml] of tags(xml, "row")) {
    const cells: string[] = [];
    for (const [attrs, inner] of tags(rowXml, "c")) {
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      // Referência além da última coluna do Excel (XFD): arquivo forjado.
      if (ref && ref.length > 3) continue;
      const col = ref ? columnIndex(ref) : cells.length;
      // Coluna além do limite (arquivo forjado com "ZZZZ1"): ignorada.
      if (col >= maxCols) continue;
      const value = cellValue(attrs, inner, strings);
      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    if (cells.some((c) => c !== "")) grid.push(cells);
    if (grid.length > maxRows + 1) break;
  }
  return { name: target.name, grid };
}

/**
 * Lê uma planilha. A primeira linha não vazia é o cabeçalho; cabeçalhos vazios
 * ganham a letra da coluna. Linhas totalmente vazias são ignoradas.
 */
export function readSheet(
  bytes: Uint8Array,
  sheet?: string | number,
  maxRows = 2000,
): SheetData {
  const { name, grid } = readGrid(bytes, sheet, maxRows);
  if (grid.length === 0) return { name: name, headers: [], rows: [] };

  const width = Math.max(...grid.map((r) => r.length));
  const headerRow = grid[0];
  const headers: string[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < width; i++) {
    let h = (headerRow[i] ?? "").trim() || columnName(i);
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    if (n > 1) h = `${h} (${n})`;
    headers.push(h);
  }
  const rows = grid
    .slice(1, maxRows + 1)
    .map((cells) =>
      Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])),
    );
  return { name: name, headers, rows };
}

/** Aba lida na posição exata; `text` marca as células de texto ("linha:coluna"). */
export interface CellSheet {
  name: string;
  cells: string[][];
  text: Set<string>;
}

export interface CellLimits {
  maxRows?: number;
  maxCols?: number;
  /** Texto mais longo guardado por célula (o resto é cortado). */
  maxCellChars?: number;
  /** Maior XML aceito por aba (e para o texto compartilhado). */
  maxXmlBytes?: number;
}

/**
 * Imagem ancorada numa aba: a célula onde começa (linha e coluna, do zero) e
 * os bytes. `toRow`/`toCol` são a última célula que ela cobre e
 * `centerRow`/`centerCol` a do centro: é a linha (e a coluna) a que a foto
 * pertence (docs/BOOKING.md, "Fotos da planilha"). Sem elas, a de começo.
 */
export interface SheetImage {
  row: number;
  col: number;
  toRow?: number;
  toCol?: number;
  centerRow?: number;
  centerCol?: number;
  /** Foto dentro da célula ("Colocar na célula" do Excel ou DISPIMG do WPS). */
  inCell?: boolean;
  name: string;
  mime: string;
  bytes: Uint8Array;
}

/** Linha a que a imagem pertence (a do centro; antigas: a do começo). */
export const imageRow = (img: Pick<SheetImage, "row" | "centerRow">) =>
  img.centerRow ?? img.row;
/** Coluna a que a imagem pertence (a do centro; antigas: a do começo). */
export const imageCol = (img: Pick<SheetImage, "col" | "centerCol">) =>
  img.centerCol ?? img.col;

/** A imagem cobre alguma destas colunas (do começo ao fim dela)? */
export function imageInCols(
  img: Pick<SheetImage, "col" | "toCol" | "centerCol">,
  cols: ReadonlySet<number>,
) {
  const last = Math.max(img.col, img.toCol ?? img.col);
  if (last - img.col > 64) return cols.has(imageCol(img));
  for (let c = img.col; c <= last; c++) if (cols.has(c)) return true;
  return false;
}

export interface ImageLimits {
  /** Máximo de imagens devolvidas (as demais ficam de fora). */
  maxImages?: number;
  /** Maior imagem aceita em bytes (maiores ficam de fora). */
  maxImageBytes?: number;
  /** Soma dos bytes das imagens devolvidas (depois disso, as demais ficam de fora). */
  maxTotalBytes?: number;
  /**
   * Só as imagens que cobrem estas colunas (do zero; da coluna em que
   * começam à em que terminam); as outras nem são lidas.
   */
  cols?: readonly number[];
}

/** Planilha aberta uma vez para ler várias abas (cada parte descompactada uma vez). */
export interface Workbook {
  sheetNames(): string[];
  readCells(sheet: string, limits?: CellLimits): CellSheet;
  /**
   * Imagens da aba: as flutuantes (fotos coladas sobre as células: a âncora
   * diz onde começam e terminam) e as de dentro da célula ("Colocar na
   * célula" do Excel e DISPIMG do WPS). Só PNG, JPEG e WebP; o resto (EMF,
   * GIF…) fica de fora. Na ordem da aba: de cima para baixo.
   */
  readImages(sheet: string, limits?: ImageLimits): SheetImage[];
}

export function openWorkbook(
  bytes: Uint8Array,
  options: { maxTotalBytes?: number } = {},
): Workbook {
  const zip = openZip(bytes, options.maxTotalBytes ?? MAX_TOTAL_BYTES);
  const sheets = workbookSheets(zip);
  let strings: string[] | null = null;
  return {
    sheetNames: () => sheets.map((s) => s.name),
    readCells(sheet, limits = {}) {
      const maxRows = limits.maxRows ?? 500;
      const maxCols = limits.maxCols ?? 60;
      const maxXml = limits.maxXmlBytes ?? Infinity;
      const maxChars = limits.maxCellChars ?? 1000;
      const target = sheets.find((s) => s.name === sheet);
      if (!target) throw new Error("xlsx_sheet_missing");
      const entry = zip.get(target.path);
      if (!entry) throw new Error("xlsx_sheet_missing");
      if (entry.length > maxXml) throw new Error("xlsx_too_large");
      strings ??= sharedStrings(zip, maxXml);
      const cells: string[][] = [];
      const text = new Set<string>();
      for (const [attrs, inner] of tags(decode(entry), "c")) {
        const ref = /\br="([A-Z]{1,3})(\d{1,7})"/.exec(attrs);
        if (!ref) continue;
        const row = Number(ref[2]) - 1;
        const col = columnIndex(ref[1]);
        if (row < 0 || row >= maxRows || col < 0 || col >= maxCols) continue;
        const full = cellValue(attrs, inner, strings);
        if (full === "") continue;
        const value = full.length > maxChars ? full.slice(0, maxChars) : full;
        while (cells.length <= row) cells.push([]);
        const line = cells[row];
        while (line.length < col) line.push("");
        line[col] = value;
        const type = cellType(attrs);
        if (type === "s" || type === "inlineStr" || type === "str")
          text.add(`${row}:${col}`);
      }
      return { name: target.name, cells, text };
    },
    readImages(sheet, limits = {}) {
      const maxImages = limits.maxImages ?? 200;
      const maxBytes = limits.maxImageBytes ?? 8 * 1024 * 1024;
      const maxTotal = limits.maxTotalBytes ?? Infinity;
      const cols = limits.cols ? new Set(limits.cols) : null;
      let total = 0;
      const target = sheets.find((s) => s.name === sheet);
      if (!target) throw new Error("xlsx_sheet_missing");
      const placed = placedImages(zip, target.path)
        .filter((p) => !cols || imageInCols(p, cols))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const out: SheetImage[] = [];
      const cache = new Map<string, Uint8Array | null>();
      for (const p of placed) {
        if (out.length >= maxImages) break;
        const mime = imageMime(p.path);
        if (!mime) continue;
        let bytes = cache.get(p.path);
        if (bytes === undefined) {
          bytes = zip.get(p.path);
          cache.set(p.path, bytes);
        }
        if (!bytes || bytes.length === 0 || bytes.length > maxBytes) continue;
        if (total + bytes.length > maxTotal) break;
        total += bytes.length;
        out.push({
          row: p.row,
          col: p.col,
          toRow: p.toRow,
          toCol: p.toCol,
          centerRow: p.centerRow,
          centerCol: p.centerCol,
          ...(p.inCell ? { inCell: true } : {}),
          name: p.path.slice(p.path.lastIndexOf("/") + 1),
          mime,
          bytes,
        });
      }
      return out;
    },
  };
}

/**
 * As imagens da aba no lugar (flutuantes e de dentro da célula), antes de
 * ler os bytes. A grade (alturas e larguras) só é lida quando há imagem.
 */
function placedImages(zip: Zip, sheetPath: string): PlacedImage[] {
  const drawingPath = partsOfType(zip, sheetPath, "/drawing")[0];
  const drawing = drawingPath ? zip.get(drawingPath) : null;
  const wps = wpsCellImages(zip);
  const rich = richValueImages(zip);
  if (!drawing && !wps.size && !rich) return [];
  const entry = zip.get(sheetPath);
  const xml = entry ? decode(entry) : "";
  const axes = sheetAxes(xml);
  return [
    ...(drawingPath && drawing
      ? floatingImages(zip, drawingPath, decode(drawing), axes)
      : []),
    ...(wps.size || rich ? cellImages(xml, axes, wps, rich) : []),
  ];
}

type Axes = { rows: SheetAxis; cols: SheetAxis };

/** Imagem localizada na aba, antes de ler os bytes. */
interface PlacedImage extends ImageCells {
  path: string;
  inCell?: boolean;
  /** Ponto de começo (para a ordem: de cima para baixo, da esquerda para a direita). */
  x: number;
  y: number;
}

/* ---- Grade da aba: altura das linhas e largura das colunas (EMU) ---- */

/** 1 ponto = 12 700 EMU; 1 pixel = 9 525 EMU. */
const EMU_PER_POINT = 12_700;
const EMU_PER_PIXEL = 9_525;

/** Largura de coluna em caracteres → EMU (fonte padrão do Excel, dígito de 7 px). */
function columnEmu(chars: number) {
  const px = Math.trunc(((256 * chars + Math.trunc(128 / 7)) / 256) * 7);
  return Math.max(0, px) * EMU_PER_PIXEL;
}

/** Atributos de cada `<nome ...>` (sem ler o conteúdo), em tempo linear. */
function* openTags(xml: string, name: string): Generator<string> {
  const open = `<${name}`;
  let i = 0;
  while (i < xml.length) {
    const start = xml.indexOf(open, i);
    if (start < 0) return;
    const next = xml.charCodeAt(start + open.length);
    if (
      next !== 32 &&
      next !== 9 &&
      next !== 10 &&
      next !== 13 &&
      next !== 62 &&
      next !== 47
    ) {
      i = start + open.length;
      continue;
    }
    const gt = xml.indexOf(">", start);
    if (gt < 0) return;
    yield xml.slice(start + open.length, gt);
    i = gt + 1;
  }
}

const attrNumber = (attrs: string, name: string): number | null => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

/** Eixos da aba: alturas das linhas (`<row ht>`) e larguras das colunas (`<col width>`), em EMU. */
function sheetAxes(xml: string): Axes {
  let defaultRow = 15;
  let defaultCol: number | null = null;
  let baseCol = 8;
  for (const attrs of openTags(xml, "sheetFormatPr")) {
    defaultRow = attrNumber(attrs, "defaultRowHeight") ?? defaultRow;
    defaultCol = attrNumber(attrs, "defaultColWidth");
    baseCol = attrNumber(attrs, "baseColWidth") ?? baseCol;
    break;
  }
  const rowSizes: Array<[number, number]> = [];
  // Só o começo do XML até as células acabarem: as linhas vêm em <sheetData>.
  for (const attrs of openTags(xml, "row")) {
    const r = attrNumber(attrs, "r");
    if (r === null) continue;
    const hidden = /\bhidden="(1|true)"/.test(attrs);
    const ht = attrNumber(attrs, "ht");
    if (hidden) rowSizes.push([r - 1, 0]);
    else if (ht !== null) rowSizes.push([r - 1, ht * EMU_PER_POINT]);
  }
  const colSizes: Array<[number, number]> = [];
  for (const attrs of openTags(xml, "col")) {
    const min = attrNumber(attrs, "min");
    const max = attrNumber(attrs, "max");
    const width = attrNumber(attrs, "width");
    if (min === null || max === null || min < 1) continue;
    const hidden = /\bhidden="(1|true)"/.test(attrs);
    const size = hidden ? 0 : width !== null ? columnEmu(width) : null;
    if (size === null) continue;
    const last = Math.min(max, MAX_SHEET_COLS_INDEX);
    for (let c = min; c <= last; c++) colSizes.push([c - 1, size]);
  }
  return {
    rows: new SheetAxis(
      defaultRow * EMU_PER_POINT,
      rowSizes,
      MAX_SHEET_ROWS_INDEX,
    ),
    cols: new SheetAxis(
      columnEmu(defaultCol ?? baseCol + 5 / 7),
      colSizes,
      MAX_SHEET_COLS_INDEX,
    ),
  };
}

/** Número de uma tag (`<xdr:col>3</xdr:col>`); ausente ou inválido: nulo. */
function tagNumber(xml: string, names: string[]): number | null {
  const v = firstTag(xml, names)?.[1];
  if (v === undefined) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

/** Ponto de uma âncora `<xdr:from>`/`<xdr:to>`: célula + deslocamento (EMU). */
function anchorPoint(
  xml: string | undefined,
  axes: Axes,
): { x: number; y: number; row: number; col: number } | null {
  if (xml === undefined) return null;
  const col = tagNumber(xml, ["xdr:col", "col"]);
  const row = tagNumber(xml, ["xdr:row", "row"]);
  if (col === null || row === null) return null;
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0)
    return null;
  if (col >= MAX_SHEET_COLS_INDEX || row >= MAX_SHEET_ROWS_INDEX) return null;
  return {
    row,
    col,
    x: pointOf(axes.cols, col, tagNumber(xml, ["xdr:colOff", "colOff"]) ?? 0),
    y: pointOf(axes.rows, row, tagNumber(xml, ["xdr:rowOff", "rowOff"]) ?? 0),
  };
}

/** Tamanho de `<xdr:ext cx cy>` (âncora de uma célula ou absoluta). */
function extOf(inner: string): { cx: number; cy: number } | null {
  const attrs = firstTag(inner, ["xdr:ext", "ext"])?.[0];
  if (attrs === undefined) return null;
  const cx = attrNumber(attrs, "cx");
  const cy = attrNumber(attrs, "cy");
  return cx !== null && cy !== null && cx >= 0 && cy >= 0 ? { cx, cy } : null;
}

/**
 * Imagens flutuantes (desenho da aba): cada âncora com as imagens dela (um
 * grupo de imagens tem várias, todas no retângulo do grupo). A mesma imagem
 * no mesmo lugar duas vezes (Choice e Fallback do mc:AlternateContent) vale
 * uma.
 */
function floatingImages(
  zip: Zip,
  drawingPath: string,
  xml: string,
  axes: Axes,
): PlacedImage[] {
  const media = relationships(zip, drawingPath);
  const out: PlacedImage[] = [];
  const seen = new Set<string>();
  for (const [kind, inner] of anchorsOf(xml)) {
    let rect: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (kind === "two") {
      const from = anchorPoint(
        firstTag(inner, ["xdr:from", "from"])?.[1],
        axes,
      );
      const to = anchorPoint(firstTag(inner, ["xdr:to", "to"])?.[1], axes);
      if (!from) continue;
      rect = {
        x1: from.x,
        y1: from.y,
        x2: to?.x ?? from.x,
        y2: to?.y ?? from.y,
      };
    } else if (kind === "one") {
      const from = anchorPoint(
        firstTag(inner, ["xdr:from", "from"])?.[1],
        axes,
      );
      if (!from) continue;
      const ext = extOf(inner);
      rect = {
        x1: from.x,
        y1: from.y,
        x2: from.x + (ext?.cx ?? 0),
        y2: from.y + (ext?.cy ?? 0),
      };
    } else {
      const pos = firstTag(inner, ["xdr:pos", "pos"])?.[0];
      const x = pos === undefined ? null : attrNumber(pos, "x");
      const y = pos === undefined ? null : attrNumber(pos, "y");
      if (x === null || y === null || x < 0 || y < 0) continue;
      const ext = extOf(inner);
      rect = { x1: x, y1: y, x2: x + (ext?.cx ?? 0), y2: y + (ext?.cy ?? 0) };
    }
    const cells = cellsOfRect(axes.rows, axes.cols, rect);
    for (const name of ["a:blip", "blip"]) {
      for (const [attrs] of tags(inner, name)) {
        const embed = /\br:embed="([^"]+)"/.exec(attrs)?.[1];
        const path = embed ? media.get(embed)?.path : undefined;
        if (!path) continue;
        const key = `${path}@${Math.round(rect.x1)},${Math.round(rect.y1)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...cells, path, x: rect.x1, y: rect.y1 });
      }
    }
  }
  return out;
}

/** Referência "B12" → linha e coluna do zero. */
function cellRef(attrs: string): { row: number; col: number } | null {
  const ref = /\br="([A-Z]{1,3})(\d{1,7})"/.exec(attrs);
  if (!ref) return null;
  const row = Number(ref[2]) - 1;
  const col = columnIndex(ref[1]);
  if (row < 0 || col < 0 || col >= MAX_SHEET_COLS_INDEX) return null;
  return { row, col };
}

/**
 * Fotos dentro da célula: o DISPIMG do WPS (`xl/cellimages.xml`, a célula
 * com `=DISPIMG("ID_…",1)`) e o "Colocar na célula" do Excel (a célula com
 * `vm="n"`, ligada à imagem pelos metadados e pelo richData). A imagem
 * ocupa a própria célula.
 */
function cellImages(
  xml: string,
  axes: Axes,
  wps: Map<string, string>,
  rich: ((vm: number) => string | undefined) | null,
): PlacedImage[] {
  const out: PlacedImage[] = [];
  for (const [attrs, inner] of tags(xml, "c")) {
    let path: string | undefined;
    if (rich) {
      const vm = attrNumber(attrs, "vm");
      if (vm !== null) path = rich(vm);
    }
    if (!path && wps.size && inner.includes("DISPIMG")) {
      const id = /DISPIMG\(\s*(?:&quot;|")([^"&]+)(?:&quot;|")/.exec(
        inner,
      )?.[1];
      if (id) path = wps.get(id);
    }
    if (!path) continue;
    const at = cellRef(attrs);
    if (!at) continue;
    out.push({
      row: at.row,
      col: at.col,
      toRow: at.row,
      toCol: at.col,
      centerRow: at.row,
      centerCol: at.col,
      inCell: true,
      path,
      x: axes.cols.start(at.col),
      y: axes.rows.start(at.row),
    });
  }
  return out;
}

/** WPS: nome da imagem (ID_…) → caminho da mídia, de `xl/cellimages.xml`. */
function wpsCellImages(zip: Zip): Map<string, string> {
  const out = new Map<string, string>();
  const part = "xl/cellimages.xml";
  const entry = zip.get(part);
  if (!entry) return out;
  const media = relationships(zip, part);
  for (const name of ["xdr:pic", "pic"]) {
    for (const [, inner] of tags(decode(entry), name)) {
      const cNvPr = firstTag(inner, ["xdr:cNvPr", "cNvPr"])?.[0] ?? "";
      const id = /\bname="([^"]+)"/.exec(cNvPr)?.[1];
      const blip = firstTag(inner, ["a:blip", "blip"])?.[0] ?? "";
      const embed = /\br:embed="([^"]+)"/.exec(blip)?.[1];
      const path = embed ? media.get(embed)?.path : undefined;
      if (id && path && !out.has(id)) out.set(id, path);
    }
    if (out.size) break;
  }
  return out;
}

/**
 * Excel "Colocar na célula": vm (1 em diante) → metadados do valor → valor
 * rico → identificador da imagem local → relacionamento → mídia. Sem
 * richData: nulo.
 */
function richValueImages(
  zip: Zip,
): ((vm: number) => string | undefined) | null {
  const relPart = "xl/richData/richValueRel.xml";
  const relXml = zip.get(relPart);
  const valuesXml = zip.get("xl/richData/rdrichvalue.xml");
  const metaXml = zip.get("xl/metadata.xml");
  if (!relXml || !valuesXml || !metaXml) return null;
  const relMap = relationships(zip, relPart);
  const relPaths: Array<string | undefined> = [];
  for (const [attrs] of tags(decode(relXml), "rel")) {
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    relPaths.push(rid ? relMap.get(rid)?.path : undefined);
  }
  // Estruturas: em que posição do valor está o identificador da imagem.
  const structures: number[] = [];
  const structXml = zip.get("xl/richData/rdrichvaluestructure.xml");
  if (structXml)
    for (const [, inner] of tags(decode(structXml), "s")) {
      let k = 0;
      let at = 0;
      for (const [attrs] of tags(inner, "k")) {
        if (/\bn="_rvRel:LocalImageIdentifier"/.test(attrs)) at = k;
        k++;
      }
      structures.push(at);
    }
  const values: Array<string | undefined> = [];
  for (const [attrs, inner] of tags(decode(valuesXml), "rv")) {
    const s = attrNumber(attrs, "s") ?? 0;
    const vs = [...tags(inner, "v")].map(([, v]) => v.trim());
    const idx = Number(vs[structures[s] ?? 0]);
    values.push(Number.isInteger(idx) ? relPaths[idx] : undefined);
  }
  const meta = decode(metaXml);
  // Tipo XLRICHVALUE (1 em diante) e os blocos do futureMetadata dele.
  let richType = 0;
  let n = 0;
  for (const attrs of openTags(meta, "metadataType")) {
    n++;
    if (/\bname="XLRICHVALUE"/.test(attrs)) richType = n;
  }
  const future: Array<number | undefined> = [];
  for (const [attrs, inner] of tags(meta, "futureMetadata")) {
    if (!/\bname="XLRICHVALUE"/.test(attrs)) continue;
    for (const [, bk] of tags(inner, "bk")) {
      const rvb = firstTag(bk, ["xlrd:rvb", "rvb"])?.[0];
      const i = rvb === undefined ? null : attrNumber(rvb, "i");
      future.push(i ?? undefined);
    }
  }
  const valueMeta: Array<{ t: number; v: number } | undefined> = [];
  for (const [, inner] of tags(meta, "valueMetadata")) {
    for (const [, bk] of tags(inner, "bk")) {
      const rc = firstTag(bk, ["rc"])?.[0];
      const t = rc === undefined ? null : attrNumber(rc, "t");
      const v = rc === undefined ? null : attrNumber(rc, "v");
      valueMeta.push(t !== null && v !== null ? { t, v } : undefined);
    }
  }
  return (vm) => {
    const rc = valueMeta[vm - 1];
    if (!rc || (richType && rc.t !== richType)) return undefined;
    const value = future[rc.v];
    return value === undefined ? undefined : values[value];
  };
}

/* ---- Imagens: relacionamentos de uma parte, âncoras do desenho ---- */

/** "xl/worksheets/sheet1.xml" → "xl/worksheets/_rels/sheet1.xml.rels". */
function relsPathOf(partPath: string) {
  const i = partPath.lastIndexOf("/");
  return `${partPath.slice(0, i)}/_rels/${partPath.slice(i + 1)}.rels`;
}

/** Caminho de um Target relativo à pasta da parte ("../drawings/x.xml"); absoluto começa com "/". */
function resolvePart(partPath: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = partPath.split("/").slice(0, -1);
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece !== "." && piece !== "") parts.push(piece);
  }
  return parts.join("/");
}

/** Relacionamentos de uma parte: Id → { caminho resolvido, tipo }. */
function relationships(zip: Zip, partPath: string) {
  const out = new Map<string, { path: string; type: string }>();
  const rels = zip.get(relsPathOf(partPath));
  if (!rels) return out;
  for (const [attrs] of tags(decode(rels), "Relationship")) {
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    const type = /\bType="([^"]+)"/.exec(attrs)?.[1] ?? "";
    // Alvo externo (link) não é parte do arquivo.
    if (!id || !target || /TargetMode="External"/.test(attrs)) continue;
    out.set(id, { path: resolvePart(partPath, unescapeXml(target)), type });
  }
  return out;
}

/** Partes relacionadas de um tipo (o tipo termina com o sufixo, ex.: "/drawing"). */
function partsOfType(zip: Zip, partPath: string, suffix: string) {
  return [...relationships(zip, partPath).values()]
    .filter((r) => r.type.endsWith(suffix))
    .map((r) => r.path);
}

/**
 * Âncoras do desenho (com ou sem o prefixo xdr): de duas células, de uma
 * célula com o tamanho e absolutas (posição e tamanho). Devolve o tipo e o
 * conteúdo.
 */
function* anchorsOf(xml: string): Generator<["two" | "one" | "abs", string]> {
  const kinds: Array<[string, "two" | "one" | "abs"]> = [
    ["xdr:twoCellAnchor", "two"],
    ["xdr:oneCellAnchor", "one"],
    ["xdr:absoluteAnchor", "abs"],
    ["twoCellAnchor", "two"],
    ["oneCellAnchor", "one"],
    ["absoluteAnchor", "abs"],
  ];
  for (const [name, kind] of kinds)
    for (const [, inner] of tags(xml, name)) yield [kind, inner];
}

/** Primeira ocorrência de uma das tags (nomes alternativos com e sem prefixo). */
function firstTag(xml: string, names: string[]): [string, string] | undefined {
  for (const name of names) {
    for (const tag of tags(xml, name)) return tag;
  }
  return undefined;
}

function imageMime(path: string): string | null {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return null;
}

/**
 * Células na posição exata da planilha: `cells[linha][coluna]`, contando do
 * zero (A1 = [0][0]). Linhas e colunas vazias continuam no lugar, para
 * planilhas de formulário em que o significado vem da posição (ex.: o
 * comparativo de fretes, com blocos por agente). Lê pela referência de cada
 * célula, então linhas vazias gravadas como `<row/>` não deslocam nada.
 */
export function readCells(
  bytes: Uint8Array,
  sheet: string,
  limits: CellLimits = {},
): CellSheet {
  return openWorkbook(bytes).readCells(sheet, limits);
}
