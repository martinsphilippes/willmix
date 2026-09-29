import { inflateRawSync } from "node:zlib";

/**
 * Leitor mínimo de XLSX sem dependências: abre o ZIP, lê a planilha escolhida
 * (ou a primeira) e devolve linhas como texto. Cobre o que as exportações do
 * sistema chinês trazem: texto (shared strings, inline) e números.
 * Limitações conhecidas: datas chegam como número serial do Excel; fórmulas
 * trazem o último valor calculado; células mescladas valem só na 1ª célula.
 */

export interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function readZip(bytes: Uint8Array): Map<string, ZipEntry> {
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
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
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
    // Cabeçalho local: tamanhos de nome e extra podem diferir do diretório central.
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compressedSize);
    const data =
      method === 8
        ? new Uint8Array(inflateRawSync(Buffer.from(raw)))
        : method === 0
          ? raw
          : null;
    if (data) entries.set(name, { name, data });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
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

/** Texto de um <si> ou <is>: concatena todos os <t> (texto rico vira texto simples). */
function textRuns(xml: string) {
  return unescapeXml(
    Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
      .map((m) => m[1])
      .join(""),
  );
}

function sharedStrings(entries: Map<string, ZipEntry>): string[] {
  const entry = entries.get("xl/sharedStrings.xml");
  if (!entry) return [];
  const xml = decode(entry.data);
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) =>
    textRuns(m[1]),
  );
}

/** Lista as planilhas do arquivo na ordem do workbook. */
export function listSheets(bytes: Uint8Array): string[] {
  const entries = readZip(bytes);
  return workbookSheets(entries).map((s) => s.name);
}

function workbookSheets(entries: Map<string, ZipEntry>) {
  const wb = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!wb) throw new Error("xlsx_invalid");
  const relMap = new Map<string, string>();
  if (rels) {
    for (const m of decode(rels.data).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const attrs = m[1];
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
  for (const m of decode(wb.data).matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const name = unescapeXml(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const path =
      relMap.get(rid) ?? `xl/worksheets/sheet${sheets.length + 1}.xml`;
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

/**
 * Lê uma planilha. A primeira linha não vazia é o cabeçalho; cabeçalhos vazios
 * ganham a letra da coluna. Linhas totalmente vazias são ignoradas.
 */
export function readSheet(
  bytes: Uint8Array,
  sheet?: string | number,
  maxRows = 2000,
): SheetData {
  const entries = readZip(bytes);
  const sheets = workbookSheets(entries);
  if (sheets.length === 0) throw new Error("xlsx_no_sheets");
  const chosen =
    typeof sheet === "number"
      ? sheets[sheet]
      : typeof sheet === "string"
        ? sheets.find((s) => s.name === sheet)
        : sheets[0];
  const target = chosen ?? sheets[0];
  const entry = entries.get(target.path);
  if (!entry) throw new Error("xlsx_sheet_missing");
  const strings = sharedStrings(entries);
  const xml = decode(entry.data);

  const grid: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of rowMatch[1].matchAll(
      /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const attrs = cell[1];
      const inner = cell[2] ?? "";
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : cells.length;
      let value = "";
      if (type === "s") {
        const idx = Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "-1");
        value = strings[idx] ?? "";
      } else if (type === "inlineStr") {
        value = textRuns(inner);
      } else if (type === "b") {
        value = /<v>1<\/v>/.test(inner) ? "true" : "false";
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        value =
          v === undefined
            ? ""
            : type === "str" || type === "e"
              ? unescapeXml(v)
              : formatNumber(v);
      }
      while (cells.length < col) cells.push("");
      cells[col] = value.trim();
    }
    if (cells.some((c) => c !== "")) grid.push(cells);
    if (grid.length > maxRows + 1) break;
  }
  if (grid.length === 0) return { name: target.name, headers: [], rows: [] };

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
  return { name: target.name, headers, rows };
}
