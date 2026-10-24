import type {
  CellLimits,
  CellSheet,
  ImageLimits,
  SheetImage,
  Workbook,
} from "./xlsx";

/**
 * Leitor mínimo de XLS (Excel 97-2003: BIFF8 dentro de um contêiner
 * OLE2/CFB) sem dependências, com a mesma saída do leitor de XLSX
 * (`openWorkbook`): abas, células na posição exata e imagens ancoradas.
 * Cobre o que as planilhas de fornecedor trazem: texto (SST, LABEL,
 * RSTRING), números (NUMBER, RK, MULRK), fórmulas com o último valor
 * calculado, booleanos e erros; fotos coladas (Escher: PNG e JPEG).
 * Limitações conhecidas: datas chegam como número serial do Excel; arquivo
 * com senha (FILEPASS) e BIFF5/Excel 95 dão `xls_unsupported`.
 *
 * Arquivo vindo de fora: todo deslocamento é conferido antes de ler, os
 * laços são limitados pelo que já está na memória (cada registro avança ao
 * menos 4 bytes), cadeias de setores com ciclo são detectadas e o fluxo
 * Workbook tem teto de tamanho (`maxTotalBytes`).
 */

/** Teto padrão do fluxo Workbook (o mesmo do XLSX descompactado). */
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const invalid = () => new Error("xlsx_invalid");
const tooLarge = () => new Error("xlsx_too_large");

const utf16 = new TextDecoder("utf-16le");

/* ---- Contêiner OLE2 (CFB): cabeçalho, FAT via DIFAT, diretório, mini FAT ---- */

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** Deste valor em diante o número é um marcador (fim de cadeia, livre, FAT, DIFAT), não um setor. */
const MAX_REGULAR_SECTOR = 0xfffffffa;
const ENDOFCHAIN = 0xfffffffe;

interface CfbEntry {
  name: string;
  /** 1 = pasta, 2 = fluxo, 5 = raiz. */
  type: number;
  start: number;
  size: number;
  /** Tamanho acima de 4 GB (só na versão 4): nunca cabe no teto. */
  huge: boolean;
}

interface Cfb {
  entries: CfbEntry[];
  /** Bytes de um fluxo (mini stream quando é pequeno), com teto de tamanho. */
  read(entry: CfbEntry, maxBytes: number): Uint8Array;
}

function openCfb(bytes: Uint8Array): Cfb {
  if (bytes.length < 512) throw invalid();
  for (let i = 0; i < 8; i++) if (bytes[i] !== CFB_SIGNATURE[i]) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const major = view.getUint16(0x1a, true);
  if (major !== 3 && major !== 4) throw invalid();
  const sectorShift = view.getUint16(0x1e, true);
  if (sectorShift < 7 || sectorShift > 20) throw invalid();
  const sectorSize = 1 << sectorShift;
  const miniShift = view.getUint16(0x20, true);
  if (miniShift < 1 || miniShift > sectorShift) throw invalid();
  const miniSize = 1 << miniShift;
  const fatCount = view.getUint32(0x2c, true);
  const dirStart = view.getUint32(0x30, true);
  const miniCutoff = view.getUint32(0x38, true);
  const miniFatStart = view.getUint32(0x3c, true);
  const miniFatCount = view.getUint32(0x40, true);
  const difatStart = view.getUint32(0x44, true);
  const difatCount = view.getUint32(0x48, true);
  // Setores existentes no arquivo (o último pode estar incompleto).
  const sectorCount = Math.max(
    0,
    Math.ceil((bytes.length - sectorSize) / sectorSize),
  );
  const perSector = sectorSize / 4;

  const sector = (n: number) =>
    bytes.subarray((n + 1) * sectorSize, (n + 2) * sectorSize);
  /** Entrada `i` (u32) do setor `n`; além do fim do arquivo vale fim de cadeia. */
  const entryAt = (n: number, i: number) => {
    const off = (n + 1) * sectorSize + i * 4;
    return off + 4 <= bytes.length ? view.getUint32(off, true) : ENDOFCHAIN;
  };

  // DIFAT: os 109 primeiros setores da FAT ficam no cabeçalho; o resto em
  // setores DIFAT encadeados (cada um termina com o número do próximo).
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < fatCount; i++) {
    const s = view.getUint32(0x4c + i * 4, true);
    if (s < MAX_REGULAR_SECTOR) fatSectors.push(s);
  }
  const seenDifat = new Set<number>();
  for (
    let d = difatStart, n = 0;
    d < MAX_REGULAR_SECTOR && n < difatCount && fatSectors.length < fatCount;
    n++
  ) {
    if (d >= sectorCount || seenDifat.has(d)) throw invalid();
    seenDifat.add(d);
    for (let i = 0; i < perSector - 1 && fatSectors.length < fatCount; i++) {
      const s = entryAt(d, i);
      if (s < MAX_REGULAR_SECTOR) fatSectors.push(s);
    }
    d = entryAt(d, perSector - 1);
  }
  for (const s of fatSectors) if (s >= sectorCount) throw invalid();
  const fat = new Uint32Array(fatSectors.length * perSector);
  fatSectors.forEach((s, k) => {
    for (let i = 0; i < perSector; i++) fat[k * perSector + i] = entryAt(s, i);
  });

  /**
   * Cadeia de setores a partir de `start` numa tabela (FAT ou mini FAT), no
   * máximo `max` setores. Ciclo ou setor fora da tabela: arquivo inválido.
   */
  const chain = (
    start: number,
    max: number,
    table: Uint32Array,
    count: number,
  ): number[] => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let s = start; s < MAX_REGULAR_SECTOR && out.length < max; ) {
      if (s >= count || s >= table.length || seen.has(s)) throw invalid();
      seen.add(s);
      out.push(s);
      s = table[s];
    }
    return out;
  };
  /** Junta os setores de uma cadeia num buffer de `size` bytes (cadeia curta: inválido). */
  const assemble = (
    sectors: number[],
    size: number,
    part: (n: number) => Uint8Array,
    unit: number,
  ) => {
    if (sectors.length * unit < size) throw invalid();
    const out = new Uint8Array(size);
    sectors.forEach((s, k) => {
      const chunk = part(s);
      const off = k * unit;
      out.set(chunk.subarray(0, Math.min(chunk.length, size - off)), off);
    });
    return out;
  };

  // Diretório: entradas de 128 bytes, nome em UTF-16LE com terminador.
  const dirSectors = chain(dirStart, sectorCount, fat, sectorCount);
  const dir = assemble(
    dirSectors,
    dirSectors.length * sectorSize,
    sector,
    sectorSize,
  );
  const dirView = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  const entries: CfbEntry[] = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const type = dir[o + 66];
    const nameLen = dirView.getUint16(o + 64, true);
    if (type === 0 || nameLen < 2 || nameLen > 64) continue;
    entries.push({
      name: utf16.decode(dir.subarray(o, o + nameLen - 2)),
      type,
      start: dirView.getUint32(o + 116, true),
      size: dirView.getUint32(o + 120, true),
      // Na versão 3 os 4 bytes altos do tamanho podem ter lixo: são ignorados.
      huge: major === 4 && dirView.getUint32(o + 124, true) !== 0,
    });
  }

  // Mini FAT e mini stream (fluxos menores que o corte, 4096 bytes): só quando pedidos.
  let minis: { table: Uint32Array; data: Uint8Array } | null = null;
  const miniTables = () => {
    if (minis) return minis;
    const root = entries.find((e) => e.type === 5);
    if (!root || root.huge) throw invalid();
    const tableSectors = chain(
      miniFatStart,
      Math.min(miniFatCount, sectorCount),
      fat,
      sectorCount,
    );
    const table = new Uint32Array(tableSectors.length * perSector);
    tableSectors.forEach((s, k) => {
      for (let i = 0; i < perSector; i++) table[k * perSector + i] = entryAt(s, i);
    });
    const data = assemble(
      chain(root.start, Math.ceil(root.size / sectorSize), fat, sectorCount),
      root.size,
      sector,
      sectorSize,
    );
    minis = { table, data };
    return minis;
  };

  return {
    entries,
    read(entry, maxBytes) {
      if (entry.huge || entry.size > maxBytes) throw tooLarge();
      if (entry.size < miniCutoff && entry.type !== 5) {
        const { table, data } = miniTables();
        const sectors = chain(
          entry.start,
          Math.ceil(entry.size / miniSize),
          table,
          Math.floor(data.length / miniSize),
        );
        return assemble(
          sectors,
          entry.size,
          (n) => data.subarray(n * miniSize, (n + 1) * miniSize),
          miniSize,
        );
      }
      return assemble(
        chain(entry.start, Math.ceil(entry.size / sectorSize), fat, sectorCount),
        entry.size,
        sector,
        sectorSize,
      );
    },
  };
}

/* ---- Registros BIFF8 ---- */

const BOF = 0x0809;
const EOF_RECORD = 0x000a;
const CONTINUE = 0x003c;
const FILEPASS = 0x002f;
const BOUNDSHEET = 0x0085;
const SST = 0x00fc;
const MSODRAWINGGROUP = 0x00eb;
const MSODRAWING = 0x00ec;
const OBJ = 0x005d;
const TXO = 0x01b6;
const LABELSST = 0x00fd;
const LABEL = 0x0204;
const RSTRING = 0x00d6;
const NUMBER = 0x0203;
const RK = 0x027e;
const MULRK = 0x00bd;
const FORMULA = 0x0006;
const STRING = 0x0207;
const BOOLERR = 0x0205;
const BLANK = 0x0201;
const MULBLANK = 0x00be;

/**
 * Percorre os registros de um substream a partir do BOF em `start` até o
 * EOF do mesmo nível (um BOF aninhado, como o de um gráfico embutido, é
 * pulado inteiro) e devolve a posição seguinte ao EOF. Só os registros do
 * nível 1 são visitados; o laço sempre termina (cada registro avança pelo
 * menos 4 bytes) e a região lida não passa de `maxBytes`.
 */
function walk(
  stream: Uint8Array,
  start: number,
  maxBytes: number,
  visit: (id: number, data: Uint8Array) => void,
): number {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let depth = 0;
  let pos = start;
  while (pos + 4 <= stream.length) {
    const id = view.getUint16(pos, true);
    const len = view.getUint16(pos + 2, true);
    const end = Math.min(pos + 4 + len, stream.length);
    if (end - start > maxBytes) throw tooLarge();
    if (id === BOF) depth++;
    else if (id === EOF_RECORD) {
      if (--depth <= 0) return end;
    } else if (depth === 1) visit(id, stream.subarray(pos + 4, end));
    pos = end;
  }
  return pos;
}

/**
 * Cursor sobre os fragmentos de um registro (o registro e seus CONTINUE):
 * campos numéricos e dados pulados atravessam a fronteira sem mais nada,
 * mas o texto de uma cadeia que continua no fragmento seguinte começa com
 * um novo byte de opções (compactado ou UTF-16), como o Excel grava.
 * Lendo além do fim, os números valem zero e o texto acaba (nunca lança).
 */
class Cursor {
  private i = 0;
  private pos = 0;
  constructor(private readonly parts: Uint8Array[]) {}

  /** Pula fragmentos esgotados; true se não sobrou nada em nenhum. */
  done(): boolean {
    while (this.pos >= (this.parts[this.i]?.length ?? 0)) {
      if (this.i + 1 >= this.parts.length) return true;
      this.i++;
      this.pos = 0;
    }
    return false;
  }
  u8(): number {
    return this.done() ? 0 : this.parts[this.i][this.pos++];
  }
  u16(): number {
    return this.u8() | (this.u8() << 8);
  }
  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }
  skip(n: number) {
    while (n > 0 && !this.done()) {
      const take = Math.min(n, this.parts[this.i].length - this.pos);
      this.pos += take;
      n -= take;
    }
  }
  /** `cch` caracteres, de 1 byte (Latin-1) ou 2 (UTF-16LE) conforme `high`. */
  chars(cch: number, high: boolean): string {
    let out = "";
    let left = cch;
    while (left > 0) {
      const part = this.parts[this.i];
      const avail = part ? part.length - this.pos : 0;
      if (avail <= 0 || (high && avail < 2)) {
        // Continuação em outro fragmento: começa com o byte de opções do resto.
        if (this.i + 1 >= this.parts.length) break;
        this.i++;
        this.pos = 0;
        const next = this.parts[this.i];
        if (next.length === 0) continue;
        high = (next[this.pos++] & 1) !== 0;
        continue;
      }
      const take = Math.min(left, high ? avail >> 1 : avail);
      out += high
        ? utf16.decode(part.subarray(this.pos, this.pos + take * 2))
        : latin1(part, this.pos, take);
      this.pos += high ? take * 2 : take;
      left -= take;
    }
    return out;
  }
}

/** Texto "compactado" do BIFF8: cada byte é o código do caractere (Latin-1). */
function latin1(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length; i += 4096) {
    const chunk = bytes.subarray(i, Math.min(i + 4096, start + length));
    out += String.fromCharCode(...chunk);
  }
  return out;
}

/**
 * Cadeia Unicode do BIFF8: tamanho (1 ou 2 bytes), byte de opções (bit 0:
 * UTF-16; bit 2: dados estendidos; bit 3: texto rico), contagens opcionais,
 * caracteres e, depois, os trechos ricos e estendidos (pulados).
 */
function unicodeString(c: Cursor, lengthBytes: 1 | 2 = 2): string {
  const cch = lengthBytes === 2 ? c.u16() : c.u8();
  const flags = c.u8();
  const runs = flags & 8 ? c.u16() : 0;
  const ext = flags & 4 ? c.u32() : 0;
  const text = c.chars(cch, (flags & 1) !== 0);
  c.skip(runs * 4 + ext);
  return text;
}

/** Tabela de texto compartilhado (SST + CONTINUE): cada entrada tem ao menos 3 bytes. */
function sharedStrings(parts: Uint8Array[]): string[] {
  const c = new Cursor(parts);
  c.skip(4);
  const unique = c.u32();
  const total = parts.reduce((n, p) => n + p.length, 0);
  const max = Math.min(unique, Math.floor(total / 3));
  const out: string[] = [];
  for (let i = 0; i < max && !c.done(); i++) out.push(unicodeString(c));
  return out;
}

const scratch = new DataView(new ArrayBuffer(8));

/** Número RK: inteiro de 30 bits ou os 30 bits altos de um double, com opção "dividir por 100". */
function rkNumber(rk: number): number {
  let value: number;
  if (rk & 2) value = rk >> 2;
  else {
    scratch.setUint32(0, 0, true);
    scratch.setUint32(4, (rk & 0xfffffffc) >>> 0, true);
    value = scratch.getFloat64(0, true);
  }
  return rk & 1 ? value / 100 : value;
}

/** Mesma renderização do leitor de XLSX: evita "1.0000000000000002" em valores comuns. */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.round(n * 1e10) / 1e10);
}

const ERRORS: Record<number, string> = {
  0x00: "#NULL!",
  0x07: "#DIV/0!",
  0x0f: "#VALUE!",
  0x17: "#REF!",
  0x1d: "#NAME?",
  0x24: "#NUM!",
  0x2a: "#N/A",
  0x2b: "#GETTING_DATA",
};

const errorText = (code: number) => ERRORS[code] ?? "#N/A";

interface SheetEntry {
  name: string;
  /** Posição do BOF da aba no fluxo Workbook. */
  offset: number;
}

interface Globals {
  sheets: SheetEntry[];
  /** SST e seus CONTINUE (o primeiro fragmento inclui o cabeçalho de 8 bytes). */
  sst: Uint8Array[];
  /** MSODRAWINGGROUP (todos) e seus CONTINUE, na ordem: o OfficeArtDggContainer. */
  drawingGroup: Uint8Array[];
}

/** Substream de globais: BOF (versão BIFF8), abas, texto compartilhado e imagens. */
function readGlobals(stream: Uint8Array): Globals {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const id = stream.length >= 8 ? view.getUint16(0, true) : -1;
  if (id !== BOF) {
    // BOF do BIFF2, 3 e 4 têm outros números de registro.
    if (id === 0x0009 || id === 0x0209 || id === 0x0409)
      throw new Error("xls_unsupported");
    throw invalid();
  }
  const version = view.getUint16(4, true);
  if (version < 0x0600) throw new Error("xls_unsupported");
  if (version !== 0x0600) throw invalid();
  const sheets: SheetEntry[] = [];
  const offsets = new Set<number>();
  const sst: Uint8Array[] = [];
  const drawingGroup: Uint8Array[] = [];
  let last = -1;
  walk(stream, 0, Infinity, (rid, data) => {
    if (rid === CONTINUE) {
      if (last === SST) sst.push(data);
      else if (last === MSODRAWINGGROUP) drawingGroup.push(data);
      return;
    }
    last = rid;
    if (rid === FILEPASS) throw new Error("xls_unsupported");
    if (rid === SST) sst.push(data);
    else if (rid === MSODRAWINGGROUP) drawingGroup.push(data);
    else if (rid === BOUNDSHEET && data.length >= 8) {
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const offset = dv.getUint32(0, true);
      const type = data[5];
      // Só planilhas (0x00; gráficos e módulos ficam de fora) com BOF no lugar indicado.
      if (type !== 0 || offsets.has(offset)) return;
      if (offset + 4 > stream.length || view.getUint16(offset, true) !== BOF)
        return;
      const name = new Cursor([data.subarray(8)]).chars(
        data[6],
        (data[7] & 1) !== 0,
      );
      offsets.add(offset);
      sheets.push({ name, offset });
    }
  });
  return { sheets, sst, drawingGroup };
}

/* ---- Desenhos (Escher): índice de imagens nos globais, formas por aba ---- */

interface EscherRecord {
  inst: number;
  type: number;
  /** Dados do registro: [start, end). */
  start: number;
  end: number;
}

/** Registros Escher consecutivos em [start, end): cabeçalho de 8 bytes (versão/instância, tipo, tamanho). */
function escherRecords(
  buf: Uint8Array,
  start: number,
  end: number,
): EscherRecord[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: EscherRecord[] = [];
  for (let pos = start; pos + 8 <= end; ) {
    const vi = view.getUint16(pos, true);
    const len = view.getUint32(pos + 4, true);
    const dataEnd = Math.min(end, pos + 8 + len);
    out.push({
      inst: vi >> 4,
      type: view.getUint16(pos + 2, true),
      start: pos + 8,
      end: dataEnd,
    });
    pos = dataEnd;
  }
  return out;
}

interface Blip {
  mime: string;
  ext: string;
  start: number;
  end: number;
}

/** Imagem embutida num registro blip: PNG (0xF01E) e JPEG (0xF01D, 0xF02A); EMF, WMF, DIB, TIFF ficam de fora. */
function blipOf(rec: EscherRecord): Blip | null {
  // Instância ímpar: dois identificadores de 16 bytes antes do byte de marca.
  const start = rec.start + (rec.inst & 1 ? 32 : 16) + 1;
  if (start > rec.end) return null;
  if (rec.type === 0xf01e)
    return { mime: "image/png", ext: "png", start, end: rec.end };
  if (rec.type === 0xf01d || rec.type === 0xf02a)
    return { mime: "image/jpeg", ext: "jpeg", start, end: rec.end };
  return null;
}

/**
 * Índice de imagens do OfficeArtDggContainer (globais): posição 1 é a
 * primeira entrada do BStoreContainer (BSE com o blip embutido ou o próprio
 * blip). Só guarda posições; os bytes são copiados quando a imagem é pedida.
 */
function blipStore(group: Uint8Array): Array<Blip | null> {
  const blips: Array<Blip | null> = [null];
  for (const dgg of escherRecords(group, 0, group.length)) {
    if (dgg.type !== 0xf000) continue;
    for (const store of escherRecords(group, dgg.start, dgg.end)) {
      if (store.type !== 0xf001) continue;
      for (const fb of escherRecords(group, store.start, store.end)) {
        if (fb.type !== 0xf007) {
          blips.push(blipOf(fb));
          continue;
        }
        // BSE: 36 bytes de cabeçalho (o nome tem o tamanho no byte 33), depois o blip.
        const nameLen = fb.end - fb.start >= 36 ? group[fb.start + 33] : 0;
        const at = fb.start + 36 + nameLen;
        const rec = at + 8 <= fb.end ? escherRecords(group, at, fb.end)[0] : null;
        blips.push(rec ? blipOf(rec) : null);
      }
    }
  }
  return blips;
}

interface Shape {
  pib: number;
  row: number;
  col: number;
}

/**
 * Formas com imagem do OfficeArtDgContainer de uma aba: cada SpContainer
 * com a propriedade pib (0x0104) e âncora (ClientAnchor própria ou, dentro
 * de um grupo, a do grupo). Formas apagadas ficam de fora.
 */
function shapesOf(dg: Uint8Array): Shape[] {
  const view = new DataView(dg.buffer, dg.byteOffset, dg.byteLength);
  const out: Shape[] = [];
  const container = (
    start: number,
    end: number,
    depth: number,
    inherited: { row: number; col: number } | null,
  ) => {
    if (depth > 16) return;
    let groupAnchor = inherited;
    for (const rec of escherRecords(dg, start, end)) {
      if (rec.type === 0xf002 || rec.type === 0xf003) {
        container(rec.start, rec.end, depth + 1, groupAnchor);
        continue;
      }
      if (rec.type !== 0xf004) continue;
      let pib = 0;
      let anchor: { row: number; col: number } | null = null;
      let group = false;
      let deleted = false;
      for (const child of escherRecords(dg, rec.start, rec.end)) {
        if (child.type === 0xf009) group = true;
        else if (child.type === 0xf00a && child.end - child.start >= 8)
          deleted = (view.getUint32(child.start + 4, true) & 0x8) !== 0;
        else if (child.type === 0xf00b) {
          // Propriedades: id de 2 bytes (bits 0-13) e valor de 4; os dados
          // das propriedades complexas vêm depois da parte fixa.
          for (let k = 0; k < child.inst; k++) {
            const at = child.start + k * 6;
            if (at + 6 > child.end) break;
            if ((view.getUint16(at, true) & 0x3fff) === 0x0104)
              pib = view.getUint32(at + 2, true);
          }
        } else if (child.type === 0xf010 && child.end - child.start >= 18)
          anchor = {
            col: view.getUint16(child.start + 2, true),
            row: view.getUint16(child.start + 6, true),
          };
      }
      if (group) {
        groupAnchor = anchor ?? groupAnchor;
        continue;
      }
      const at = anchor ?? groupAnchor;
      if (pib > 0 && at && !deleted) out.push({ pib, row: at.row, col: at.col });
    }
  };
  container(0, dg.length, 0, null);
  return out;
}

/**
 * Fragmentos do desenho de uma aba (OfficeArtDgContainer), na ordem: os
 * registros MSODRAWING e os CONTINUE que o Excel usa depois dos 8224
 * primeiros bytes, intercalados com os OBJ de cada forma. Os CONTINUE de um
 * TXO (texto e formatação de uma caixa de texto) não fazem parte.
 */
function sheetDrawing(stream: Uint8Array, offset: number): Uint8Array {
  const parts: Uint8Array[] = [];
  let last = -1;
  let txoChars = 0;
  let txoRuns = 0;
  walk(stream, offset, Infinity, (id, data) => {
    if (id === CONTINUE) {
      if (last === MSODRAWING || last === OBJ) parts.push(data);
      else if (last === TXO) {
        if (txoChars > 0) {
          const high = (data[0] ?? 0) & 1;
          txoChars -= Math.min(
            txoChars,
            high ? (data.length - 1) >> 1 : data.length - 1,
          );
        } else if (txoRuns > 0) txoRuns -= Math.min(txoRuns, data.length);
        else parts.push(data);
      }
      return;
    }
    last = id;
    if (id === MSODRAWING) parts.push(data);
    else if (id === TXO && data.length >= 14) {
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      txoChars = dv.getUint16(10, true);
      txoRuns = dv.getUint16(12, true);
    }
  });
  return concat(parts);
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/* ---- Planilha aberta: abas, células e imagens com a forma do leitor de XLSX ---- */

export function openXlsWorkbook(
  bytes: Uint8Array,
  options: { maxTotalBytes?: number } = {},
): Workbook {
  const cfb = openCfb(bytes);
  const entry =
    cfb.entries.find((e) => e.type === 2 && e.name === "Workbook") ??
    cfb.entries.find((e) => e.type === 2 && e.name === "Book");
  if (!entry) throw invalid();
  const stream = cfb.read(entry, options.maxTotalBytes ?? MAX_TOTAL_BYTES);
  const globals = readGlobals(stream);
  const { sheets } = globals;
  let strings: string[] | null = null;
  let group: Uint8Array | null = null;
  let blips: Array<Blip | null> | null = null;
  const sstBytes = globals.sst.reduce((n, p) => n + p.length, 0);

  return {
    sheetNames: () => sheets.map((s) => s.name),
    readCells(sheet: string, limits: CellLimits = {}): CellSheet {
      const maxRows = limits.maxRows ?? 500;
      const maxCols = limits.maxCols ?? 60;
      const maxXml = limits.maxXmlBytes ?? Infinity;
      const maxChars = limits.maxCellChars ?? 1000;
      const target = sheets.find((s) => s.name === sheet);
      if (!target) throw new Error("xlsx_sheet_missing");
      if (strings === null) {
        if (sstBytes > maxXml) throw tooLarge();
        strings = sharedStrings(globals.sst);
      }
      const sst = strings;
      const cells: string[][] = [];
      const text = new Set<string>();
      const set = (row: number, col: number, full: string, isText: boolean) => {
        if (row >= maxRows || col >= maxCols) return;
        const trimmed = full.trim();
        if (trimmed === "") return;
        const value =
          trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
        while (cells.length <= row) cells.push([]);
        const line = cells[row];
        while (line.length < col) line.push("");
        line[col] = value;
        if (isText) text.add(`${row}:${col}`);
      };
      // Fórmula com resultado texto: o valor vem no STRING seguinte (e seus CONTINUE).
      let pending: { row: number; col: number } | null = null;
      let stringParts: Uint8Array[] | null = null;
      let last = -1;
      const flush = () => {
        if (!stringParts) return;
        if (pending)
          set(
            pending.row,
            pending.col,
            unicodeString(new Cursor(stringParts)),
            true,
          );
        pending = null;
        stringParts = null;
      };
      walk(stream, target.offset, maxXml, (id, data) => {
        if (id === CONTINUE) {
          if (last === STRING && stringParts) stringParts.push(data);
          return;
        }
        last = id;
        flush();
        const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
        if (id === STRING) {
          if (pending) stringParts = [data];
          return;
        }
        if (data.length < 6) return;
        const row = dv.getUint16(0, true);
        const col = dv.getUint16(2, true);
        switch (id) {
          case LABELSST:
            if (data.length >= 10)
              set(row, col, sst[dv.getUint32(6, true)] ?? "", true);
            break;
          case LABEL:
          case RSTRING:
            set(row, col, unicodeString(new Cursor([data.subarray(6)])), true);
            break;
          case NUMBER:
            if (data.length >= 14)
              set(row, col, formatNumber(dv.getFloat64(6, true)), false);
            break;
          case RK:
            if (data.length >= 10)
              set(row, col, formatNumber(rkNumber(dv.getUint32(6, true))), false);
            break;
          case MULRK:
            // Linha, primeira coluna, pares (xf, RK) e a última coluna no fim.
            for (let k = 0; 4 + k * 6 + 6 <= data.length - 2; k++)
              set(
                row,
                col + k,
                formatNumber(rkNumber(dv.getUint32(4 + k * 6 + 2, true))),
                false,
              );
            break;
          case BOOLERR:
            if (data.length >= 8)
              set(
                row,
                col,
                data[7] ? errorText(data[6]) : data[6] ? "true" : "false",
                false,
              );
            break;
          case FORMULA:
            pending = null;
            if (data.length < 14) break;
            if (data[12] === 0xff && data[13] === 0xff) {
              // Resultado que não é número: 0 texto (no STRING), 1 booleano, 2 erro, 3 texto vazio.
              if (data[6] === 0) pending = { row, col };
              else if (data[6] === 1) set(row, col, data[8] ? "true" : "false", false);
              else if (data[6] === 2) set(row, col, errorText(data[8]), false);
            } else set(row, col, formatNumber(dv.getFloat64(6, true)), false);
            break;
          case BLANK:
          case MULBLANK:
            break;
          default:
            return;
        }
        if (id !== FORMULA) pending = null;
      });
      flush();
      return { name: target.name, cells, text };
    },
    readImages(sheet: string, limits: ImageLimits = {}): SheetImage[] {
      const maxImages = limits.maxImages ?? 200;
      const maxBytes = limits.maxImageBytes ?? 8 * 1024 * 1024;
      const maxTotal = limits.maxTotalBytes ?? Infinity;
      const cols = limits.cols ? new Set(limits.cols) : null;
      let total = 0;
      const target = sheets.find((s) => s.name === sheet);
      if (!target) throw new Error("xlsx_sheet_missing");
      const drawing = sheetDrawing(stream, target.offset);
      if (drawing.length === 0 || globals.drawingGroup.length === 0) return [];
      group ??= concat(globals.drawingGroup);
      blips ??= blipStore(group);
      const out: SheetImage[] = [];
      const cache = new Map<number, Uint8Array>();
      for (const shape of shapesOf(drawing)) {
        if (out.length >= maxImages) break;
        if (cols && !cols.has(shape.col)) continue;
        const blip = blips[shape.pib];
        if (!blip) continue;
        let bytes = cache.get(shape.pib);
        if (bytes === undefined) {
          bytes = group.slice(blip.start, blip.end);
          cache.set(shape.pib, bytes);
        }
        if (bytes.length === 0 || bytes.length > maxBytes) continue;
        if (total + bytes.length > maxTotal) break;
        total += bytes.length;
        out.push({
          row: shape.row,
          col: shape.col,
          name: `image${shape.pib}.${blip.ext}`,
          mime: blip.mime,
          bytes,
        });
      }
      return out;
    },
  };
}
