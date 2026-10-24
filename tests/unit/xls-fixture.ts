/*
 * Arquivo .xls de verdade para testes: contêiner OLE2 (CFB versão 3, setores
 * de 512 bytes) com o fluxo Workbook em BIFF8 — abas com células de vários
 * registros (SST/LABELSST, LABEL, RSTRING, NUMBER, RK, MULRK, FORMULA com
 * STRING, BOOLERR) e, opcionalmente, imagens coladas (Escher: BSE nos
 * globais, uma forma por imagem na aba). Fluxo menor que 4096 bytes vai para
 * o mini stream, como o Excel grava; maior vai para a FAT regular.
 */

export type XlsCell =
  /** Texto compartilhado (SST + LABELSST); `richRuns` acrescenta trechos de formatação. */
  | { kind: "sst"; value: string; richRuns?: number }
  | { kind: "label"; value: string }
  | { kind: "rstring"; value: string }
  | { kind: "number"; value: number }
  /** RK: inteiro de 30 bits ou double truncado; `x100` grava value×100 com a marca "dividir por 100". */
  | { kind: "rk"; value: number; x100?: boolean }
  /** MULRK: vários RK a partir da coluna. */
  | { kind: "mulrk"; values: number[] }
  | { kind: "formula"; text: string }
  | { kind: "formula"; number: number }
  | { kind: "formula"; bool: boolean }
  | { kind: "bool"; value: boolean }
  | { kind: "error"; code: number };

export interface XlsFixtureCell {
  row: number;
  col: number;
  cell: XlsCell;
}

export interface XlsFixtureSheet {
  name: string;
  cells: XlsFixtureCell[];
}

export interface XlsFixtureImage {
  /** Índice da aba em `sheets`. */
  sheet: number;
  row: number;
  col: number;
  bytes: Uint8Array;
  kind: "png" | "jpeg" | "emf";
  /** Identificadores de 16 bytes antes dos dados (1 ou 2, conforme a instância do blip). */
  uids?: 1 | 2;
}

export interface XlsFixtureOptions {
  /** Maior registro gravado (SST e MSODRAWINGGROUP continuam em CONTINUE); padrão 8224, o máximo do BIFF8. */
  recordLimit?: number;
  /** Versão no BOF (0x0600 = BIFF8); 0x0500 simula um arquivo do Excel 95. */
  biffVersion?: number;
  /** Nome do fluxo no contêiner ("Workbook"; "Book" é o nome antigo). */
  streamName?: string;
  /** Formas a partir da segunda em CONTINUE depois do OBJ, como o Excel grava além de 8224 bytes. */
  drawingContinue?: boolean;
  /** Um TXO (caixa de texto) com seus dois CONTINUE depois do primeiro OBJ de cada aba com imagens. */
  textbox?: boolean;
  /** Bytes de enchimento nos globais (registro ignorado), para forçar o fluxo para a FAT regular. */
  padBytes?: number;
}

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;
const NOSTREAM = 0xffffffff;

/* ---- bytes ---- */

function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const u8 = (...values: number[]) => Uint8Array.from(values);

function u16(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint16(i * 2, v, true));
  return out;
}

function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v >>> 0, true));
  return out;
}

function f64(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value, true);
  return out;
}

const zeros = (n: number) => new Uint8Array(n);

/** Registro BIFF: id, tamanho e dados. */
export function biffRecord(id: number, data: Uint8Array): Uint8Array {
  return cat(u16(id, data.length), data);
}

/** Texto como o BIFF8 grava: 1 byte por caractere quando todos cabem em Latin-1, senão UTF-16LE. */
function encodeChars(value: string): { high: boolean; bytes: Uint8Array } {
  const high = [...value].some((ch) => ch.charCodeAt(0) > 0xff);
  if (!high)
    return { high, bytes: Uint8Array.from(value, (ch) => ch.charCodeAt(0)) };
  const bytes = new Uint8Array(value.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < value.length; i++)
    view.setUint16(i * 2, value.charCodeAt(i), true);
  return { high, bytes };
}

/** Cadeia Unicode simples (tamanho de 2 bytes, opções, caracteres). */
function unicodeString(value: string): Uint8Array {
  const { high, bytes } = encodeChars(value);
  return cat(u16(value.length), u8(high ? 1 : 0), bytes);
}

/** RK como o Excel grava: inteiro de 30 bits quando cabe, senão os 30 bits altos do double. */
function rkEncode(value: number, x100 = false): number {
  const v = x100 ? Math.round(value * 100) : value;
  if (Number.isInteger(v) && v >= -(2 ** 29) && v < 2 ** 29)
    return ((v << 2) | 2 | (x100 ? 1 : 0)) >>> 0;
  const scratch = new DataView(new ArrayBuffer(8));
  scratch.setFloat64(0, v, true);
  return ((scratch.getUint32(4, true) & 0xfffffffc) | (x100 ? 1 : 0)) >>> 0;
}

/* ---- SST com CONTINUE ---- */

/**
 * Tabela de texto compartilhado dividida em registros de até `limit` bytes:
 * o cabeçalho de cada cadeia nunca é dividido; os caracteres continuam no
 * registro seguinte com um novo byte de opções; os trechos ricos podem
 * atravessar a fronteira sem nada.
 */
function sstRecords(
  strings: Array<{ value: string; richRuns: number }>,
  limit: number,
): Uint8Array[] {
  const records: number[][] = [];
  let cur: number[] = [];
  const flush = () => {
    records.push(cur);
    cur = [];
  };
  const push = (bytes: Uint8Array) => {
    for (const b of bytes) cur.push(b);
  };
  push(u32(strings.length, strings.length));
  for (const { value, richRuns } of strings) {
    const { high, bytes } = encodeChars(value);
    const per = high ? 2 : 1;
    const header = cat(
      u16(value.length),
      u8((high ? 1 : 0) | (richRuns > 0 ? 8 : 0)),
      richRuns > 0 ? u16(richRuns) : new Uint8Array(0),
    );
    if (cur.length + header.length + per > limit) flush();
    push(header);
    let i = 0;
    while (i < value.length) {
      const fit = Math.floor((limit - cur.length) / per);
      if (fit <= 0) {
        flush();
        cur.push(high ? 1 : 0);
        continue;
      }
      const take = Math.min(fit, value.length - i);
      push(bytes.subarray(i * per, (i + take) * per));
      i += take;
    }
    for (let r = 0; r < richRuns; r++) {
      for (const b of u16(r, 0)) {
        if (cur.length >= limit) flush();
        cur.push(b);
      }
    }
  }
  flush();
  return records.map((r) => Uint8Array.from(r));
}

/* ---- Escher ---- */

const escher = (ver: number, inst: number, type: number, data: Uint8Array) =>
  cat(u16((inst << 4) | ver, type), u32(data.length), data);

/** Identificador de 16 bytes determinístico para o blip `n`. */
const uid = (n: number) => Uint8Array.from({ length: 16 }, (_, i) => (n * 7 + i) & 0xff);

/** BSE do BStoreContainer com o blip embutido (PNG, JPEG ou EMF). */
function bse(image: XlsFixtureImage, index: number): Uint8Array {
  const uids = image.uids ?? 1;
  const ids = cat(...Array.from({ length: uids }, () => uid(index)));
  let blip: Uint8Array;
  let type: number;
  if (image.kind === "png") {
    type = 6;
    blip = escher(0, uids === 2 ? 0x6e1 : 0x6e0, 0xf01e, cat(ids, u8(0xff), image.bytes));
  } else if (image.kind === "jpeg") {
    type = 5;
    blip = escher(0, uids === 2 ? 0x46b : 0x46a, 0xf01d, cat(ids, u8(0xff), image.bytes));
  } else {
    type = 2;
    blip = escher(0, 0x3d4, 0xf01a, cat(ids, zeros(34), image.bytes));
  }
  const header = cat(
    u8(type, type),
    uid(index),
    u16(0xff),
    u32(blip.length, 1, 0),
    u8(0, 0, 0, 0),
  );
  return escher(2, type, 0xf007, cat(header, blip));
}

/** OfficeArtDggContainer dos globais: FDGG e o BStoreContainer com uma BSE por imagem. */
function drawingGroup(images: XlsFixtureImage[], shapes: number): Uint8Array {
  const fdgg = escher(
    0,
    0,
    0xf006,
    cat(u32(1024 + shapes + 1, 2, shapes, 1), u32(1, shapes + 1)),
  );
  const store = escher(
    15,
    images.length,
    0xf001,
    cat(...images.map((image, i) => bse(image, i + 1))),
  );
  return escher(15, 0, 0xf000, cat(fdgg, store));
}

/** Registros de desenho de uma aba: fragmentos do OfficeArtDgContainer (um por forma) e os OBJ. */
function sheetDrawing(
  images: Array<{ image: XlsFixtureImage; blip: number }>,
  continueAfterFirst: boolean,
  textbox: boolean,
): Uint8Array {
  if (images.length === 0) return new Uint8Array(0);
  const group = escher(
    15,
    0,
    0xf004,
    cat(escher(1, 0, 0xf009, zeros(16)), escher(2, 0, 0xf00a, u32(1024, 0x5))),
  );
  const shapes = images.map(({ image, blip }, i) =>
    escher(
      15,
      0,
      0xf004,
      cat(
        escher(2, 75, 0xf00a, u32(1025 + i, 0x0a00)),
        // pib (0x0104, com a marca de blip) e fNoFillHitTest, em ordem de id.
        escher(3, 2, 0xf00b, cat(u16(0x4104), u32(blip), u16(0x01bf), u32(0x00110000))),
        escher(
          0,
          0,
          0xf010,
          u16(2, image.col, 0, image.row, 0, image.col + 1, 0, image.row + 1, 0),
        ),
        escher(0, 0, 0xf011, new Uint8Array(0)),
      ),
    ),
  );
  const fdg = escher(0, 1, 0xf008, u32(images.length + 1, 1024 + images.length));
  const spgr = escher(15, 0, 0xf003, cat(group, ...shapes));
  const dg = escher(15, 0, 0xf002, cat(fdg, spgr));
  // Primeiro fragmento: cabeçalhos, FDG, grupo e a primeira forma; depois uma forma por fragmento.
  const firstLen = dg.length - shapes.slice(1).reduce((n, s) => n + s.length, 0);
  const fragments = [dg.subarray(0, firstLen)];
  let off = firstLen;
  for (const shape of shapes.slice(1)) {
    fragments.push(dg.subarray(off, off + shape.length));
    off += shape.length;
  }
  const obj = (id: number) =>
    cat(
      u16(0x15, 0x12, 8, id, 0x6011),
      zeros(12),
      u16(7, 2, 0xffff),
      u16(8, 2, 0),
      u16(0, 0),
    );
  // TXO de uma caixa de texto: cabeçalho de 18 bytes (cchText e cbRuns nas
  // posições 10 e 12), o texto num CONTINUE (byte de opções + Latin-1) e os
  // trechos de formatação em outro. Não fazem parte do desenho.
  const txo = cat(
    biffRecord(0x01b6, cat(u16(0x0212, 0), zeros(6), u16(4, 16, 0, 0))),
    biffRecord(0x003c, cat(u8(0), encodeChars("nota").bytes)),
    biffRecord(0x003c, zeros(16)),
  );
  return cat(
    ...fragments.map((fragment, i) =>
      cat(
        biffRecord(i > 0 && continueAfterFirst ? 0x003c : 0x00ec, fragment),
        biffRecord(0x005d, obj(i + 1)),
        i === 0 && textbox ? txo : new Uint8Array(0),
      ),
    ),
  );
}

/* ---- fluxo Workbook (BIFF8) ---- */

function cellRecords(cells: XlsFixtureCell[], sstIndex: Map<string, number>): Uint8Array {
  const out: Uint8Array[] = [];
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const { row, col, cell } of sorted) {
    const head = u16(row, col, 15);
    switch (cell.kind) {
      case "sst":
        out.push(biffRecord(0x00fd, cat(head, u32(sstIndex.get(cell.value) ?? 0))));
        break;
      case "label":
        out.push(biffRecord(0x0204, cat(head, unicodeString(cell.value))));
        break;
      case "rstring":
        out.push(
          biffRecord(0x00d6, cat(head, unicodeString(cell.value), u16(1), u16(0, 0))),
        );
        break;
      case "number":
        out.push(biffRecord(0x0203, cat(head, f64(cell.value))));
        break;
      case "rk":
        out.push(biffRecord(0x027e, cat(head, u32(rkEncode(cell.value, cell.x100)))));
        break;
      case "mulrk":
        out.push(
          biffRecord(
            0x00bd,
            cat(
              u16(row, col),
              ...cell.values.map((v) => cat(u16(15), u32(rkEncode(v)))),
              u16(col + cell.values.length - 1),
            ),
          ),
        );
        break;
      case "bool":
        out.push(biffRecord(0x0205, cat(head, u8(cell.value ? 1 : 0, 0))));
        break;
      case "error":
        out.push(biffRecord(0x0205, cat(head, u8(cell.code, 1))));
        break;
      case "formula": {
        const result =
          "text" in cell
            ? u8(0, 0, 0, 0, 0, 0, 0xff, 0xff)
            : "bool" in cell
              ? u8(1, 0, cell.bool ? 1 : 0, 0, 0, 0, 0xff, 0xff)
              : f64(cell.number);
        // grbit, chn, tamanho da fórmula e um ptgInt(1) como fórmula.
        out.push(
          biffRecord(0x0006, cat(head, result, u16(0), u32(0), u16(3), u8(0x1e), u16(1))),
        );
        if ("text" in cell) out.push(biffRecord(0x0207, unicodeString(cell.text)));
        break;
      }
    }
  }
  return cat(...out);
}

/** Fluxo Workbook em BIFF8 (globais + um substream por aba). */
export function biffBytes(
  sheets: XlsFixtureSheet[],
  images: XlsFixtureImage[] = [],
  options: XlsFixtureOptions = {},
): Uint8Array {
  const limit = options.recordLimit ?? 8224;
  const version = options.biffVersion ?? 0x0600;
  const bof = (type: number) =>
    biffRecord(0x0809, cat(u16(version, type, 0x0dbb, 0x07cc), u32(0, 6)));
  const eof = biffRecord(0x000a, new Uint8Array(0));

  // Texto compartilhado: cada valor uma vez, na ordem em que aparece.
  const strings: Array<{ value: string; richRuns: number }> = [];
  const sstIndex = new Map<string, number>();
  for (const sheet of sheets)
    for (const { cell } of sheet.cells)
      if (cell.kind === "sst" && !sstIndex.has(cell.value)) {
        sstIndex.set(cell.value, strings.length);
        strings.push({ value: cell.value, richRuns: cell.richRuns ?? 0 });
      }

  // Substreams das abas (não dependem das posições).
  const substreams = sheets.map((sheet, i) => {
    const own = images
      .map((image, k) => ({ image, blip: k + 1 }))
      .filter(({ image }) => image.sheet === i);
    return cat(
      bof(0x0010),
      cellRecords(sheet.cells, sstIndex),
      sheetDrawing(own, options.drawingContinue ?? false, options.textbox ?? false),
      eof,
    );
  });

  // Globais: BOF, enchimento, BOUNDSHEET por aba, desenho, SST, EOF.
  const pad: Uint8Array[] = [];
  for (let left = options.padBytes ?? 0; left > 0; left -= 8000)
    pad.push(biffRecord(0x005c, zeros(Math.min(left, 8000))));
  const boundsheet = (sheet: XlsFixtureSheet, offset: number) => {
    const { high, bytes } = encodeChars(sheet.name);
    return biffRecord(
      0x0085,
      cat(u32(offset), u8(0, 0, sheet.name.length, high ? 1 : 0), bytes),
    );
  };
  const sst = sstRecords(strings, limit).map((data, i) =>
    biffRecord(i === 0 ? 0x00fc : 0x003c, data),
  );
  const group: Uint8Array[] = [];
  if (images.length > 0) {
    const data = drawingGroup(images, images.length);
    for (let off = 0; off < data.length; off += limit)
      group.push(
        biffRecord(off === 0 ? 0x00eb : 0x003c, data.subarray(off, off + limit)),
      );
  }
  const tail = cat(...group, ...sst, eof);
  const headLen =
    bof(5).length +
    pad.reduce((n, p) => n + p.length, 0) +
    sheets.reduce((n, s) => n + boundsheet(s, 0).length, 0);
  let offset = headLen + tail.length;
  const bounds = sheets.map((sheet, i) => {
    const rec = boundsheet(sheet, offset);
    offset += substreams[i].length;
    return rec;
  });
  return cat(bof(5), ...pad, ...bounds, tail, ...substreams);
}

/* ---- contêiner OLE2 (CFB) ---- */

/**
 * Contêiner CFB versão 3 com um único fluxo: setores de 512 bytes, FAT no
 * início, diretório, e o fluxo no mini stream (com mini FAT) quando tem
 * menos de 4096 bytes ou em setores regulares quando é maior.
 */
export function cfbBytes(streamName: string, stream: Uint8Array): Uint8Array<ArrayBuffer> {
  const SS = 512;
  const MS = 64;
  const mini = stream.length < 4096;
  const miniStream = mini
    ? cat(stream, zeros((MS - (stream.length % MS)) % MS))
    : new Uint8Array(0);
  const miniCount = miniStream.length / MS;
  const miniStreamSectors = Math.ceil(miniStream.length / SS);
  const miniFatSectors = mini ? 1 : 0;
  const streamSectors = mini ? 0 : Math.ceil(stream.length / SS);
  // Setores de FAT suficientes para cobrir todos (inclusive eles mesmos).
  let fatSectors = 1;
  for (;;) {
    const total = fatSectors + 1 + miniFatSectors + miniStreamSectors + streamSectors;
    const need = Math.ceil(total / (SS / 4));
    if (need <= fatSectors) break;
    fatSectors = need;
  }
  const dirSector = fatSectors;
  const miniFatSector = dirSector + 1;
  const miniStreamStart = miniFatSector + miniFatSectors;
  const streamStart = miniStreamStart + miniStreamSectors;
  const total = streamStart + streamSectors;
  const out = new Uint8Array(SS * (1 + total));
  const view = new DataView(out.buffer);

  // Cabeçalho.
  out.set(u8(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), 0);
  view.setUint16(0x18, 0x3e, true);
  view.setUint16(0x1a, 3, true);
  view.setUint16(0x1c, 0xfffe, true);
  view.setUint16(0x1e, 9, true);
  view.setUint16(0x20, 6, true);
  view.setUint32(0x2c, fatSectors, true);
  view.setUint32(0x30, dirSector, true);
  view.setUint32(0x38, 4096, true);
  view.setUint32(0x3c, mini ? miniFatSector : ENDOFCHAIN, true);
  view.setUint32(0x40, miniFatSectors, true);
  view.setUint32(0x44, ENDOFCHAIN, true);
  view.setUint32(0x48, 0, true);
  for (let i = 0; i < 109; i++)
    view.setUint32(0x4c + i * 4, i < fatSectors ? i : FREESECT, true);

  // FAT.
  const fat = (s: number, v: number) =>
    view.setUint32(SS * (1 + Math.floor(s / (SS / 4))) + (s % (SS / 4)) * 4, v, true);
  const chain = (start: number, n: number) => {
    for (let i = 0; i < n; i++) fat(start + i, i === n - 1 ? ENDOFCHAIN : start + i + 1);
  };
  for (let s = 0; s < fatSectors * (SS / 4); s++) fat(s, FREESECT);
  for (let s = 0; s < fatSectors; s++) fat(s, FATSECT);
  fat(dirSector, ENDOFCHAIN);
  if (mini) {
    fat(miniFatSector, ENDOFCHAIN);
    chain(miniStreamStart, miniStreamSectors);
  } else chain(streamStart, streamSectors);

  // Diretório: raiz (dona do mini stream) e o fluxo.
  const entry = (
    index: number,
    name: string,
    type: number,
    start: number,
    size: number,
    child: number,
  ) => {
    const o = SS * (1 + dirSector) + index * 128;
    for (let i = 0; i < name.length; i++)
      view.setUint16(o + i * 2, name.charCodeAt(i), true);
    view.setUint16(o + 64, (name.length + 1) * 2, true);
    out[o + 66] = type;
    out[o + 67] = 1;
    view.setUint32(o + 68, NOSTREAM, true);
    view.setUint32(o + 72, NOSTREAM, true);
    view.setUint32(o + 76, child, true);
    view.setUint32(o + 116, start, true);
    view.setUint32(o + 120, size, true);
  };
  entry(
    0,
    "Root Entry",
    5,
    mini ? miniStreamStart : ENDOFCHAIN,
    mini ? miniStream.length : 0,
    1,
  );
  entry(1, streamName, 2, mini ? 0 : streamStart, stream.length, NOSTREAM);

  if (mini) {
    const off = SS * (1 + miniFatSector);
    for (let i = 0; i < SS / 4; i++)
      view.setUint32(
        off + i * 4,
        i < miniCount ? (i === miniCount - 1 ? ENDOFCHAIN : i + 1) : FREESECT,
        true,
      );
    out.set(miniStream, SS * (1 + miniStreamStart));
  } else out.set(stream, SS * (1 + streamStart));
  return out;
}

/** Arquivo .xls completo a partir da descrição. */
export function xlsBytes(
  sheets: XlsFixtureSheet[],
  images: XlsFixtureImage[] = [],
  options: XlsFixtureOptions = {},
): Uint8Array<ArrayBuffer> {
  return cfbBytes(options.streamName ?? "Workbook", biffBytes(sheets, images, options));
}
