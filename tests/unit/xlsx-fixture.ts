/*
 * Arquivo .xlsx de verdade para testes (ZIP sem compressão): abas com células
 * na posição exata (texto e número) e, opcionalmente, imagens ancoradas em
 * células (desenho + mídia), como o Excel grava fotos coladas na planilha.
 */

export interface FixtureSheet {
  name: string;
  /** cells[linha][coluna], do zero (A1 = [0][0]); "" é célula vazia. */
  cells: string[][];
}

export interface FixtureImage {
  /** Índice da aba em `sheets`. */
  sheet: number;
  col: number;
  row: number;
  bytes: Uint8Array;
  ext: "png" | "jpeg" | "gif";
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function colName(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetXml(cells: string[][], withDrawing: boolean) {
  const rows = cells
    .map((row, ri) => {
      const cs = row
        .map((v, ci) => {
          if (v === "") return "";
          const ref = `${colName(ci)}${ri + 1}`;
          return /^-?\d+(\.\d+)?$/.test(v)
            ? `<c r="${ref}"><v>${v}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
        })
        .join("");
      return cs ? `<row r="${ri + 1}">${cs}</row>` : "";
    })
    .join("");
  return `<?xml version="1.0"?><worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rows}</sheetData>${
    withDrawing ? '<drawing r:id="rIdDr"/>' : ""
  }</worksheet>`;
}

/** Um PNG 1×1 válido (bytes fixos), para imagens de teste. */
export const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
);

export function xlsxBytes(
  sheets: FixtureSheet[],
  options: {
    images?: FixtureImage[];
    extra?: Array<[string, string | Uint8Array]>;
  } = {},
): Uint8Array<ArrayBuffer> {
  const images = options.images ?? [];
  const files: Array<[string, string | Uint8Array]> = [
    [
      "xl/workbook.xml",
      `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map(
          (s, i) =>
            `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<Relationships>${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ],
  ];
  let mediaCount = 0;
  sheets.forEach((s, i) => {
    const mine = images.filter((img) => img.sheet === i);
    files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.cells, mine.length > 0)]);
    if (!mine.length) return;
    files.push([
      `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
      `<Relationships><Relationship Id="rIdDr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${i + 1}.xml"/></Relationships>`,
    ]);
    const anchors: string[] = [];
    const rels: string[] = [];
    mine.forEach((img, k) => {
      mediaCount++;
      const rid = `rIdImg${k + 1}`;
      const media = `image${mediaCount}.${img.ext}`;
      anchors.push(
        `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${img.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${img.col + 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${img.row + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${k + 2}" name="Picture ${k + 1}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr/></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`,
      );
      rels.push(
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media}"/>`,
      );
      files.push([`xl/media/${media}`, img.bytes]);
    });
    files.push([
      `xl/drawings/drawing${i + 1}.xml`,
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join("")}</xdr:wsDr>`,
    ]);
    files.push([
      `xl/drawings/_rels/drawing${i + 1}.xml.rels`,
      `<Relationships>${rels.join("")}</Relationships>`,
    ]);
  });
  files.push(...(options.extra ?? []));
  return zip(files);
}

/** ZIP "stored" (sem compressão), como o leitor do portal aceita. */
export function zip(
  files: Array<[string, string | Uint8Array]>,
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content;
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    chunks.push(local, data);
    central.push(cd);
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
