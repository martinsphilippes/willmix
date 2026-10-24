import { describe, expect, it } from "vitest";
import { openXlsWorkbook } from "@/lib/services/xls";
import { PNG_1X1 } from "./xlsx-fixture";
import {
  biffBytes,
  biffRecord,
  cfbBytes,
  xlsBytes,
  type XlsCell,
  type XlsFixtureImage,
  type XlsFixtureSheet,
} from "./xls-fixture";

/*
 * Leitor de .xls (BIFF8 em OLE2): mesma saída do leitor de .xlsx para a
 * importação da ficha técnica — abas, células na posição exata (texto,
 * números, fórmulas, booleanos), limites, imagens ancoradas e arquivos
 * malformados que nunca travam nem lançam erro fora do contrato.
 */

const ERRORS = ["xlsx_invalid", "xlsx_too_large", "xlsx_sheet_missing", "xls_unsupported"];

const c = (row: number, col: number, cell: XlsCell) => ({ row, col, cell });

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const EMF = Uint8Array.from([1, 0, 0, 0, 0x6c, 0, 0, 0, 1, 2, 3, 4]);

function sample(): XlsFixtureSheet[] {
  return [
    {
      name: "SUPPLIER INFO",
      cells: [
        c(0, 0, { kind: "sst", value: "PHOTO" }),
        c(0, 1, { kind: "sst", value: "Ñandú 中文 ✓" }),
        c(0, 2, { kind: "label", value: "LABEL" }),
        c(0, 3, { kind: "rstring", value: "RSTRING" }),
        c(1, 0, { kind: "number", value: 12 }),
        c(1, 1, { kind: "number", value: 2.5 }),
        c(1, 2, { kind: "number", value: 0.0183 }),
        c(1, 3, { kind: "number", value: 46000 }),
        c(2, 0, { kind: "rk", value: 7 }),
        c(2, 1, { kind: "rk", value: -3 }),
        c(2, 2, { kind: "rk", value: 1.15, x100: true }),
        c(2, 3, { kind: "rk", value: -0.25, x100: true }),
        c(2, 4, { kind: "rk", value: 2.5 }),
        c(2, 5, { kind: "rk", value: 1234.5, x100: true }),
        c(3, 0, { kind: "mulrk", values: [1, 2.5, 300, -4] }),
        c(4, 0, { kind: "formula", text: "calc" }),
        c(4, 1, { kind: "formula", number: 3.5 }),
        c(4, 2, { kind: "formula", bool: true }),
        c(4, 3, { kind: "formula", text: "" }),
        c(5, 0, { kind: "bool", value: true }),
        c(5, 1, { kind: "bool", value: false }),
        c(5, 2, { kind: "error", code: 0x07 }),
        c(6, 0, { kind: "sst", value: "  padded  " }),
        c(6, 1, { kind: "sst", value: "   " }),
        c(7, 0, { kind: "sst", value: "rich", richRuns: 2 }),
        c(9, 5, { kind: "sst", value: "far" }),
      ],
    },
    {
      name: "Plan2 ✓",
      cells: [c(2, 3, { kind: "sst", value: "PHOTO" }), c(0, 0, { kind: "number", value: 1 })],
    },
  ];
}

const images = (): XlsFixtureImage[] => [
  { sheet: 0, row: 2, col: 0, bytes: PNG_1X1, kind: "png" },
  { sheet: 0, row: 5, col: 3, bytes: JPEG, kind: "jpeg", uids: 2 },
  { sheet: 0, row: 8, col: 0, bytes: EMF, kind: "emf" },
  { sheet: 1, row: 1, col: 1, bytes: PNG_1X1, kind: "png" },
];

/** Número de setores de mini FAT no cabeçalho: 0 quando o fluxo está na FAT regular. */
const miniFatSectors = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(0x40, true);

describe("openXlsWorkbook: abas e células", () => {
  const wb = openXlsWorkbook(xlsBytes(sample()));

  it("lista as abas na ordem do arquivo (nome em UTF-16 incluído)", () => {
    expect(wb.sheetNames()).toEqual(["SUPPLIER INFO", "Plan2 ✓"]);
  });

  it("lê texto, números, RK, MULRK, fórmulas, booleanos e erros na posição exata", () => {
    const sheet = wb.readCells("SUPPLIER INFO");
    expect(sheet.name).toBe("SUPPLIER INFO");
    expect(sheet.cells[0]).toEqual(["PHOTO", "Ñandú 中文 ✓", "LABEL", "RSTRING"]);
    expect(sheet.cells[1]).toEqual(["12", "2.5", "0.0183", "46000"]);
    expect(sheet.cells[2]).toEqual(["7", "-3", "1.15", "-0.25", "2.5", "1234.5"]);
    expect(sheet.cells[3]).toEqual(["1", "2.5", "300", "-4"]);
    expect(sheet.cells[4]).toEqual(["calc", "3.5", "true"]);
    expect(sheet.cells[5]).toEqual(["true", "false", "#DIV/0!"]);
    // Texto é aparado; só espaços vira célula vazia (não entra).
    expect(sheet.cells[6]).toEqual(["padded"]);
    expect(sheet.cells[7]).toEqual(["rich"]);
    expect(sheet.cells[8]).toEqual([]);
    expect(sheet.cells[9]).toEqual(["", "", "", "", "", "far"]);
    expect(sheet.cells).toHaveLength(10);
  });

  it("marca como texto só as células de texto (SST, LABEL, RSTRING, fórmula com texto)", () => {
    const { text } = wb.readCells("SUPPLIER INFO");
    expect([...text].sort()).toEqual(["0:0", "0:1", "0:2", "0:3", "4:0", "6:0", "7:0", "9:5"]);
  });

  it("segunda aba reaproveita a SST e tem células próprias", () => {
    const sheet = wb.readCells("Plan2 ✓");
    expect(sheet.cells[0]).toEqual(["1"]);
    expect(sheet.cells[2]).toEqual(["", "", "", "PHOTO"]);
    expect(sheet.text.has("2:3")).toBe(true);
  });

  it("aplica maxRows, maxCols e maxCellChars", () => {
    const sheet = wb.readCells("SUPPLIER INFO", { maxRows: 2, maxCols: 2, maxCellChars: 3 });
    expect(sheet.cells).toEqual([
      ["PHO", "Ñan"],
      ["12", "2.5"],
    ]);
    expect([...sheet.text].sort()).toEqual(["0:0", "0:1"]);
  });

  it("aba desconhecida: xlsx_sheet_missing", () => {
    expect(() => wb.readCells("Nada")).toThrow("xlsx_sheet_missing");
    expect(() => wb.readImages("Nada")).toThrow("xlsx_sheet_missing");
  });

  it("aceita o fluxo com o nome antigo (Book)", () => {
    const old = openXlsWorkbook(xlsBytes(sample(), [], { streamName: "Book" }));
    expect(old.readCells("SUPPLIER INFO").cells[0][0]).toBe("PHOTO");
  });
});

describe("openXlsWorkbook: SST dividida em CONTINUE", () => {
  const long = "ab".repeat(5000);
  const wide = "中文".repeat(3000);
  const sheets = (): XlsFixtureSheet[] => [
    {
      name: "A",
      cells: [
        c(0, 0, { kind: "sst", value: "antes" }),
        c(0, 1, { kind: "sst", value: long }),
        c(0, 2, { kind: "sst", value: wide }),
        c(0, 3, { kind: "sst", value: "Ñandú 中文", richRuns: 3 }),
        c(0, 4, { kind: "sst", value: "depois" }),
        c(1, 0, { kind: "formula", text: "x".repeat(50) }),
      ],
    },
  ];

  it("texto longo cruza registros (byte de opções novo em cada continuação)", () => {
    const bytes = xlsBytes(sheets());
    expect(miniFatSectors(bytes)).toBe(0);
    const sheet = openXlsWorkbook(bytes).readCells("A", { maxCellChars: 20000 });
    expect(sheet.cells[0]).toEqual(["antes", long, wide, "Ñandú 中文", "depois"]);
    expect(sheet.cells[1]).toEqual(["x".repeat(50)]);
  });

  it("registros pequenos: divisões dentro de Latin-1, UTF-16 e trechos ricos", () => {
    for (const recordLimit of [16, 23, 64, 257]) {
      const sheet = openXlsWorkbook(xlsBytes(sheets(), [], { recordLimit })).readCells("A", {
        maxCellChars: 20000,
      });
      expect(sheet.cells[0], `limite ${recordLimit}`).toEqual([
        "antes",
        long,
        wide,
        "Ñandú 中文",
        "depois",
      ]);
    }
  });
});

describe("openXlsWorkbook: mini stream e FAT regular", () => {
  it("fluxo pequeno fica no mini stream e é lido", () => {
    const bytes = xlsBytes([{ name: "A", cells: [c(0, 0, { kind: "sst", value: "mini" })] }]);
    expect(bytes.length).toBeLessThan(4096 + 512 * 4);
    expect(miniFatSectors(bytes)).toBe(1);
    expect(openXlsWorkbook(bytes).readCells("A").cells).toEqual([["mini"]]);
  });

  it("fluxo grande fica na FAT regular e é lido", () => {
    const bytes = xlsBytes(sample(), [], { padBytes: 70000 });
    expect(miniFatSectors(bytes)).toBe(0);
    expect(bytes.length).toBeGreaterThan(70000);
    const wb = openXlsWorkbook(bytes);
    expect(wb.readCells("SUPPLIER INFO").cells[0][0]).toBe("PHOTO");
    expect(wb.readCells("Plan2 ✓").cells[2][3]).toBe("PHOTO");
  });
});

describe("openXlsWorkbook: imagens", () => {
  const wb = openXlsWorkbook(xlsBytes(sample(), images()));

  it("devolve PNG e JPEG com âncora, nome e bytes; EMF fica de fora", () => {
    const out = wb.readImages("SUPPLIER INFO");
    expect(out.map((i) => [i.row, i.col, i.name, i.mime])).toEqual([
      [2, 0, "image1.png", "image/png"],
      [5, 3, "image2.jpeg", "image/jpeg"],
    ]);
    expect(Buffer.from(out[0].bytes).equals(Buffer.from(PNG_1X1))).toBe(true);
    expect(Buffer.from(out[1].bytes).equals(Buffer.from(JPEG))).toBe(true);
    expect(wb.readImages("Plan2 ✓").map((i) => [i.row, i.col, i.name])).toEqual([
      [1, 1, "image4.png"],
    ]);
  });

  it("cols: só as âncoras nas colunas pedidas", () => {
    expect(wb.readImages("SUPPLIER INFO", { cols: [0] }).map((i) => i.name)).toEqual(["image1.png"]);
    expect(wb.readImages("SUPPLIER INFO", { cols: [3] }).map((i) => i.name)).toEqual(["image2.jpeg"]);
    expect(wb.readImages("SUPPLIER INFO", { cols: [7] })).toEqual([]);
  });

  it("maxImages, maxImageBytes e maxTotalBytes", () => {
    expect(wb.readImages("SUPPLIER INFO", { maxImages: 1 }).map((i) => i.name)).toEqual(["image1.png"]);
    expect(wb.readImages("SUPPLIER INFO", { maxImageBytes: JPEG.length }).map((i) => i.name)).toEqual([
      "image2.jpeg",
    ]);
    expect(wb.readImages("SUPPLIER INFO", { maxTotalBytes: PNG_1X1.length }).map((i) => i.name)).toEqual([
      "image1.png",
    ]);
    expect(wb.readImages("SUPPLIER INFO", { maxTotalBytes: 1 })).toEqual([]);
  });

  it("sem desenho: lista vazia", () => {
    expect(openXlsWorkbook(xlsBytes(sample())).readImages("SUPPLIER INFO")).toEqual([]);
  });

  it("formas em CONTINUE depois do OBJ (como o Excel grava além de 8224 bytes)", () => {
    const alt = openXlsWorkbook(xlsBytes(sample(), images(), { drawingContinue: true }));
    expect(alt.readImages("SUPPLIER INFO").map((i) => [i.row, i.col, i.name])).toEqual([
      [2, 0, "image1.png"],
      [5, 3, "image2.jpeg"],
    ]);
  });

  it("CONTINUE de um TXO (caixa de texto) não entra no desenho", () => {
    for (const drawingContinue of [false, true]) {
      const wb2 = openXlsWorkbook(xlsBytes(sample(), images(), { textbox: true, drawingContinue }));
      expect(
        wb2.readImages("SUPPLIER INFO").map((i) => [i.row, i.col, i.name]),
        `drawingContinue=${drawingContinue}`,
      ).toEqual([
        [2, 0, "image1.png"],
        [5, 3, "image2.jpeg"],
      ]);
    }
  });

  it("MSODRAWINGGROUP dividido em CONTINUE", () => {
    const split = openXlsWorkbook(xlsBytes(sample(), images(), { recordLimit: 40 }));
    const out = split.readImages("SUPPLIER INFO");
    expect(out.map((i) => i.name)).toEqual(["image1.png", "image2.jpeg"]);
    expect(Buffer.from(out[0].bytes).equals(Buffer.from(PNG_1X1))).toBe(true);
  });
});

describe("openXlsWorkbook: limites de tamanho", () => {
  it("fluxo Workbook acima de maxTotalBytes: xlsx_too_large", () => {
    expect(() => openXlsWorkbook(xlsBytes(sample()), { maxTotalBytes: 100 })).toThrow("xlsx_too_large");
  });

  it("região da aba acima de maxXmlBytes: xlsx_too_large", () => {
    const wb = openXlsWorkbook(xlsBytes(sample()));
    expect(() => wb.readCells("SUPPLIER INFO", { maxXmlBytes: 10 })).toThrow("xlsx_too_large");
    expect(wb.readCells("SUPPLIER INFO", { maxXmlBytes: 100000 }).cells[0][0]).toBe("PHOTO");
  });
});

describe("openXlsWorkbook: arquivos malformados", () => {
  /** Gerador determinístico (xorshift) para bytes "aleatórios" reprodutíveis. */
  const prng = (seed: number) => () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };

  const open = (bytes: Uint8Array) => {
    const wb = openXlsWorkbook(bytes);
    for (const name of wb.sheetNames()) {
      wb.readCells(name);
      wb.readImages(name);
    }
  };

  /** Erro do contrato ou sucesso; nunca outro erro (nem TypeError de leitura fora do buffer). */
  const expectContract = (bytes: Uint8Array, label: string) => {
    try {
      open(bytes);
    } catch (error) {
      expect(ERRORS, `${label}: ${String(error)}`).toContain((error as Error).message);
    }
  };

  it("bytes aleatórios e arquivos vazios: xlsx_invalid", () => {
    const rnd = prng(7);
    const random = Uint8Array.from({ length: 3000 }, () => Math.floor(rnd() * 256));
    expect(() => openXlsWorkbook(random)).toThrow("xlsx_invalid");
    expect(() => openXlsWorkbook(new Uint8Array(0))).toThrow("xlsx_invalid");
    expect(() => openXlsWorkbook(new Uint8Array(4096))).toThrow("xlsx_invalid");
    // Assinatura certa, resto aleatório.
    random.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
    expectContract(random, "assinatura + lixo");
  });

  it("sem fluxo Workbook: xlsx_invalid", () => {
    expect(() => openXlsWorkbook(cfbBytes("Outro", biffBytes(sample())))).toThrow("xlsx_invalid");
  });

  it("arquivo truncado em vários pontos nunca lança outro erro", () => {
    const full = xlsBytes(sample(), images(), { padBytes: 9000 });
    const cuts = [1, 100, 511, 512, 600, 1024, 1536, 2048, 4096, Math.floor(full.length / 2), full.length - 300, full.length - 1];
    for (const cut of cuts) expectContract(full.subarray(0, cut), `corte em ${cut}`);
  });

  it("cadeia de setores com ciclo: xlsx_invalid", () => {
    const bytes = xlsBytes(sample(), [], { padBytes: 9000 });
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const dirSector = view.getUint32(0x30, true);
    const start = view.getUint32(512 * (1 + dirSector) + 128 + 116, true);
    // Primeiro setor do fluxo aponta para si mesmo.
    const cyclic = bytes.slice();
    new DataView(cyclic.buffer).setUint32(512 + start * 4, start, true);
    expect(() => openXlsWorkbook(cyclic)).toThrow("xlsx_invalid");
    // Diretório em ciclo.
    const dirCycle = bytes.slice();
    new DataView(dirCycle.buffer).setUint32(512 + dirSector * 4, dirSector, true);
    expect(() => openXlsWorkbook(dirCycle)).toThrow("xlsx_invalid");
    // Setor além do arquivo.
    const beyond = bytes.slice();
    new DataView(beyond.buffer).setUint32(512 + start * 4, 100000, true);
    expect(() => openXlsWorkbook(beyond)).toThrow("xlsx_invalid");
  });

  it("cabeçalho com contagem de FAT absurda não dita a alocação (teto pelo tamanho do arquivo)", () => {
    const bytes = xlsBytes(sample(), [], { padBytes: 9000 });
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const firstFat = view.getUint32(0x4c, true);
    const hostile = bytes.slice();
    const hv = new DataView(hostile.buffer);
    // 4 bilhões de setores de FAT, todos "no cabeçalho" apontando para o mesmo setor.
    hv.setUint32(0x2c, 0xfffffff0, true);
    for (let i = 0; i < 109; i++) hv.setUint32(0x4c + i * 4, firstFat, true);
    const Original = globalThis.Uint32Array;
    let largest = 0;
    globalThis.Uint32Array = new Proxy(Original, {
      construct(target, args: unknown[]) {
        if (typeof args[0] === "number") largest = Math.max(largest, args[0]);
        return new (target as unknown as new (...a: unknown[]) => Uint32Array)(...args);
      },
    }) as unknown as Uint32ArrayConstructor;
    try {
      const wb = openXlsWorkbook(hostile);
      expect(wb.sheetNames()).toEqual(openXlsWorkbook(bytes).sheetNames());
      expect(wb.readCells("SUPPLIER INFO").cells).toEqual(openXlsWorkbook(bytes).readCells("SUPPLIER INFO").cells);
    } finally {
      globalThis.Uint32Array = Original;
    }
    // Tabela da FAT proporcional ao arquivo (~30 setores), não aos 4 bilhões do cabeçalho.
    expect(largest).toBeLessThan(4096);
    // Mesma contagem com DIFAT encadeado apontando para setores do arquivo: continua no contrato.
    const chained = hostile.slice();
    const cv = new DataView(chained.buffer);
    cv.setUint32(0x44, view.getUint32(0x30, true), true);
    cv.setUint32(0x48, 0xfffffff0, true);
    expectContract(chained, "DIFAT hostil");
  });

  it("BIFF5 (Excel 95) e BIFF2: xls_unsupported", () => {
    expect(() => openXlsWorkbook(xlsBytes(sample(), [], { biffVersion: 0x0500 }))).toThrow("xls_unsupported");
    const biff2 = cfbBytes("Workbook", biffRecord(0x0009, new Uint8Array(4)));
    expect(() => openXlsWorkbook(biff2)).toThrow("xls_unsupported");
    const empty = cfbBytes("Workbook", biffRecord(0x0001, new Uint8Array(4)));
    expect(() => openXlsWorkbook(empty)).toThrow("xlsx_invalid");
  });

  it("planilha com senha (FILEPASS): xls_unsupported", () => {
    const stream = biffBytes(sample());
    const bof = stream.subarray(0, 20);
    const rest = stream.subarray(20);
    const locked = new Uint8Array(bof.length + 10 + rest.length);
    locked.set(bof, 0);
    locked.set(biffRecord(0x002f, new Uint8Array(6)), bof.length);
    locked.set(rest, bof.length + 10);
    expect(() => openXlsWorkbook(cfbBytes("Workbook", locked))).toThrow("xls_unsupported");
  });

  it("bytes trocados ao acaso (fuzz determinístico) ficam no contrato", () => {
    const base = xlsBytes(sample(), images(), { recordLimit: 64 });
    const rnd = prng(12345);
    for (let round = 0; round < 400; round++) {
      const bytes = base.slice();
      const flips = 1 + Math.floor(rnd() * 24);
      for (let k = 0; k < flips; k++)
        bytes[Math.floor(rnd() * bytes.length)] = Math.floor(rnd() * 256);
      expectContract(bytes, `rodada ${round}`);
    }
  });
});
