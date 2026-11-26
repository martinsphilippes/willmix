import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { PNG_1X1, xlsxBytes, zip, type FixtureImage } from "./xlsx-fixture";
import { xlsBytes, type XlsFixtureCell } from "./xls-fixture";

/*
 * Fotos da planilha e fotos do item do book (dono, 26/11/2026;
 * docs/BOOKING.md, "Fotos da planilha" e "Fotos do item"): a coluna
 * "PHOTOS" no plural, a foto que começa na linha de cima (vale o centro),
 * o grupo que ficou sem foto pega a que encosta nele, a coluna da foto
 * achada pelas imagens quando o cabeçalho não diz, fotos dentro da célula
 * (WPS e Excel), várias fotos por item, e na tela do book carregar, trocar
 * a principal, tirar e buscar de novo na planilha guardada.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/booking-lots");
const { parseProductSheet, assignImages } =
  await import("@/lib/services/product-sheet-import");
const { openWorkbook } = await import("@/lib/services/xlsx");
const { openXlsWorkbook } = await import("@/lib/services/xls");
const { SheetAxis, cellsOfRect } =
  await import("@/lib/services/sheet-geometry");
type User = import("@/lib/db").User;
type SheetImage = import("@/lib/services/xlsx").SheetImage;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

/**
 * PNG diferente a cada chamada: bytes a mais depois do fim da imagem (cada
 * uma com um tamanho, como fotos de verdade), para contar e comparar.
 */
let seq = 0;
const png = () => {
  const out = new Uint8Array(PNG_1X1.length + ++seq);
  out.set(PNG_1X1);
  return out;
};

const HEADER = [
  "PHOTOS",
  "SUPPLIER NAME",
  "SKU",
  "DESCRIPTION",
  "PRICE USD",
  "QTY/BOX",
  "LENGTH",
  "WIDTH",
  "HEIGHT",
];
const line = (sku: string, length = "10") => [
  "",
  "Ningbo Mirror",
  sku,
  `Mirror ${sku}`,
  "1.25",
  "60",
  length,
  "8",
  "20",
];
/** Linha 1 baixa (cabeçalho), as de dados altas como as das fotos. */
const heights = (rows: number) =>
  Object.fromEntries(
    Array.from({ length: rows }, (_, i) => [i, i === 0 ? 15 : 100]),
  );
const EMU_PT = 12_700;

describe("grade da aba", () => {
  it("começo e posição de cada linha com alturas próprias", () => {
    const rows = new SheetAxis(
      10,
      [
        [1, 30],
        [3, 0],
      ],
      100,
    );
    expect(rows.start(0)).toBe(0);
    expect(rows.start(1)).toBe(10);
    expect(rows.start(2)).toBe(40);
    expect(rows.start(4)).toBe(50);
    expect(rows.at(39)).toBe(1);
    expect(rows.at(45)).toBe(2);
    // Linha escondida (altura 0) nunca contém o ponto.
    expect(rows.at(50)).toBe(4);
    const cols = new SheetAxis(10, [], 100);
    expect(
      cellsOfRect(rows, cols, { x1: 0, y1: 8, x2: 10, y2: 38 }),
    ).toMatchObject({ row: 0, toRow: 1, centerRow: 1, col: 0, toCol: 0 });
  });
});

describe("leitura das imagens (xlsx)", () => {
  it("a foto que começa no fim da linha de cima é da linha em que está quase toda", () => {
    const images: FixtureImage[] = [
      // Linha 2 do Excel (índice 1): começa no cabeçalho, termina na linha 2.
      {
        sheet: 0,
        col: 0,
        row: 0,
        rowOff: 10 * EMU_PT,
        to: { row: 1, col: 1, rowOff: 90 * EMU_PT },
        bytes: png(),
        ext: "png",
      },
    ];
    const wb = openWorkbook(
      xlsxBytes(
        [
          {
            name: "S",
            cells: [HEADER, line("A")],
            rowHeights: heights(2),
          },
        ],
        { images },
      ),
    );
    const [img] = wb.readImages("S");
    expect(img).toMatchObject({ row: 0, toRow: 1, centerRow: 1, col: 0 });
  });

  it("fotos dentro da célula: DISPIMG do WPS e 'Colocar na célula' do Excel", () => {
    const sheet = (cells: string) =>
      `<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>PHOTO</t></is></c></row><row r="2">${cells}</row></sheetData></worksheet>`;
    const common: Array<[string, string | Uint8Array]> = [
      [
        "xl/workbook.xml",
        `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      ],
      ["xl/media/image1.png", png()],
    ];
    const wps = openWorkbook(
      zip([
        ...common,
        [
          "xl/worksheets/sheet1.xml",
          sheet(
            `<c r="A2" t="str"><f>_xlfn.DISPIMG("ID_ABC123",1)</f><v>=DISPIMG("ID_ABC123",1)</v></c>`,
          ),
        ],
        [
          "xl/cellimages.xml",
          `<etc:cellImages xmlns:xdr="x" xmlns:a="a" xmlns:r="r" xmlns:etc="e"><etc:cellImage><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="ID_ABC123"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic></etc:cellImage></etc:cellImages>`,
        ],
        [
          "xl/_rels/cellimages.xml.rels",
          `<Relationships><Relationship Id="rId1" Type="image" Target="media/image1.png"/></Relationships>`,
        ],
      ]),
    );
    expect(wps.readImages("S")).toMatchObject([
      { row: 1, col: 0, centerRow: 1, inCell: true, mime: "image/png" },
    ]);
    const excel = openWorkbook(
      zip([
        ...common,
        [
          "xl/worksheets/sheet1.xml",
          sheet(`<c r="A2" t="e" vm="1"><v>#VALUE!</v></c>`),
        ],
        [
          "xl/metadata.xml",
          `<metadata xmlns:xlrd="x"><metadataTypes count="1"><metadataType name="XLRICHVALUE"/></metadataTypes><futureMetadata name="XLRICHVALUE" count="1"><bk><extLst><ext><xlrd:rvb i="0"/></ext></extLst></bk></futureMetadata><valueMetadata count="1"><bk><rc t="1" v="0"/></bk></valueMetadata></metadata>`,
        ],
        [
          "xl/richData/rdrichvalue.xml",
          `<rvData count="1"><rv s="0"><v>0</v><v>5</v></rv></rvData>`,
        ],
        [
          "xl/richData/rdrichvaluestructure.xml",
          `<rvStructures count="1"><s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/></s></rvStructures>`,
        ],
        [
          "xl/richData/richValueRel.xml",
          `<richValueRels xmlns:r="r"><rel r:id="rId1"/></richValueRels>`,
        ],
        [
          "xl/richData/_rels/richValueRel.xml.rels",
          `<Relationships><Relationship Id="rId1" Type="image" Target="../media/image1.png"/></Relationships>`,
        ],
      ]),
    );
    expect(excel.readImages("S")).toMatchObject([
      { row: 1, col: 0, inCell: true, mime: "image/png" },
    ]);
    expect(excel.readImages("S", { cols: [3] })).toEqual([]);
  });
});

describe("leitura das imagens (xls)", () => {
  it("o centro da foto decide a linha, também no Excel antigo", () => {
    const text = (row: number, col: number, value: string): XlsFixtureCell => ({
      row,
      col,
      cell: { kind: "sst", value },
    });
    const wb = openXlsWorkbook(
      xlsBytes(
        [{ name: "S", cells: [text(0, 0, "PHOTOS"), text(1, 1, "x")] }],
        [
          // Começa a 3/4 da linha 1 (cabeçalho) e vai até o fim da linha 2.
          {
            sheet: 0,
            row: 0,
            col: 0,
            dy: 192,
            row2: 2,
            dy2: 0,
            bytes: png(),
            kind: "png",
          },
        ],
      ),
    );
    expect(wb.readImages("S")).toMatchObject([
      { row: 0, toRow: 1, centerRow: 1, col: 0 },
    ]);
  });
});

describe("fotos da planilha nas linhas", () => {
  const img = (row: number, extra: Partial<SheetImage> = {}): SheetImage => ({
    row,
    col: 0,
    toRow: row,
    toCol: 0,
    centerRow: row,
    centerCol: 0,
    name: "x.png",
    mime: "image/png",
    bytes: PNG_1X1,
    ...extra,
  });
  const g = (index: number, row: number) => ({
    index,
    firstRow: row,
    lastRow: row,
  });

  it("cada foto no grupo do centro; o grupo sem foto pega a segunda do vizinho que encosta nele", () => {
    const groups = [g(0, 3), g(1, 4), g(2, 5)];
    const out = assignImages(
      groups,
      [
        img(2),
        // Duas com o centro na linha 4 do Excel (índice 3): a de baixo
        // encosta na linha 5, que ficou sem foto.
        img(3),
        img(3, { toRow: 4 }),
      ],
      0,
      undefined,
    );
    expect(out.get(0)?.length).toBe(1);
    expect(out.get(1)?.map((i) => i.toRow)).toEqual([3]);
    expect(out.get(2)?.map((i) => i.toRow)).toEqual([4]);
  });

  it("a foto solta (centro fora dos grupos) vai para o grupo sem foto em que encosta", () => {
    const out = assignImages(
      [g(0, 3)],
      [img(1, { toRow: 2, centerRow: 1 })],
      0,
      undefined,
    );
    expect(out.get(0)?.length).toBe(1);
    // A outra coluna de imagem (o cartão) não dá foto ao item.
    expect(
      assignImages([g(0, 3)], [img(2, { centerCol: 1, toCol: 1 })], 0, 1).size,
    ).toBe(0);
  });

  it("'PHOTOS' é a coluna da foto, e várias fotos na linha ficam no item", () => {
    const parsed = parseProductSheet(
      xlsxBytes([{ name: "S", cells: [HEADER, line("A"), line("B")] }], {
        images: [
          { sheet: 0, col: 0, row: 1, bytes: png(), ext: "png" },
          {
            sheet: 0,
            col: 0,
            row: 1,
            rowOff: 4000,
            bytes: png(),
            ext: "png",
          },
          { sheet: 0, col: 0, row: 2, bytes: png(), ext: "png" },
        ],
      }),
    );
    expect(parsed.columns.photo).toBe(0);
    expect(parsed.extraHeaders).not.toContain("PHOTOS");
    expect(parsed.groups.map((x) => x.photos?.length)).toEqual([2, 1]);
    expect(parsed.groups[0].photo).toBe(parsed.groups[0].photos?.[0]);
  });

  it("imagem de outra coluna na linha é foto adicional; sem ela, só a da coluna da foto", () => {
    // Coluna 10 (J) sem título, como a coluna B da planilha do book nº 7.
    const parsed = parseProductSheet(
      xlsxBytes([{ name: "S", cells: [HEADER, line("A"), line("B")] }], {
        images: [
          // O logo acima do cabeçalho não é de nenhum item.
          { sheet: 0, col: 9, row: 0, bytes: png(), ext: "png" },
          { sheet: 0, col: 9, row: 1, bytes: png(), ext: "png" },
          { sheet: 0, col: 0, row: 1, bytes: png(), ext: "png" },
          { sheet: 0, col: 0, row: 2, bytes: png(), ext: "png" },
        ],
      }),
    );
    expect(parsed.groups.map((x) => x.photos?.map((i) => i.col))).toEqual([
      [0, 9],
      [0],
    ]);
    // Só a outra coluna na linha: ela vira a principal.
    const only = parseProductSheet(
      xlsxBytes([{ name: "S", cells: [HEADER, line("A")] }], {
        images: [{ sheet: 0, col: 9, row: 1, bytes: png(), ext: "png" }],
      }),
    );
    expect(only.groups[0].photo?.col).toBe(9);
  });

  it("sem cabeçalho de foto, a coluna com mais imagens é a da foto", () => {
    const parsed = parseProductSheet(
      xlsxBytes(
        [
          {
            name: "S",
            cells: [["IMG", ...HEADER.slice(1)], line("A"), line("B")],
          },
        ],
        {
          images: [
            { sheet: 0, col: 0, row: 1, bytes: png(), ext: "png" },
            { sheet: 0, col: 0, row: 2, bytes: png(), ext: "png" },
          ],
        },
      ),
    );
    expect(parsed.columns.photo).toBeUndefined();
    expect(parsed.warnings).toContain("photo_column_guessed:1");
    expect(parsed.groups.every((x) => x.photo)).toBe(true);
  });

  it("medidas: dígitos de largura total, a medida inteira na coluna e dois números soltos", () => {
    const parsed = parseProductSheet(
      xlsxBytes([
        {
          name: "S",
          cells: [
            HEADER,
            line("A", "１７．８"),
            [
              "",
              "Ningbo Mirror",
              "B",
              "Mirror B",
              "1.25",
              "60",
              "17.8x13.8x17.8",
              "",
              "",
            ],
            line("C", "60x40"),
          ],
        },
      ]),
    );
    expect(
      parsed.groups.map((x) => [x.lengthCm, x.widthCm, x.heightCm]),
    ).toEqual([
      [17.8, 8, 20],
      [17.8, 13.8, 17.8],
      [null, 8, 20],
    ]);
  });
});

describe("fotos do item do book", () => {
  const sheetFile = (images: FixtureImage[]) =>
    new File(
      [
        xlsxBytes(
          [{ name: "BOOK", cells: [HEADER, line("M-1"), line("M-2")] }],
          { images },
        ),
      ],
      "mirror.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
  const photoFile = () => new File([png()], "foto.png", { type: "image/png" });

  it("a importação guarda todas as fotos da linha: a principal e as adicionais", async () => {
    const lot = await svc.createBookingLotFromSheet(
      admin,
      sheetFile([
        { sheet: 0, col: 0, row: 1, bytes: png(), ext: "png" },
        { sheet: 0, col: 0, row: 1, rowOff: 4000, bytes: png(), ext: "png" },
      ]),
    );
    const items = (
      await getStore().list("booking_items", { filter: { lotId: lot.id } })
    ).sort((a, b) => a.position - b.position);
    expect(items[0].photoDocumentId).toBeTruthy();
    expect(items[0].extraPhotoDocumentIds).toHaveLength(1);
    expect(svc.bookingItemPhotos(items[0])).toHaveLength(2);
    expect(items[1].photoDocumentId).toBeNull();
  });

  it("carregar, tornar principal e tirar; também no book fechado, nunca no cancelado", async () => {
    const lot = await svc.createBookingLotFromSheet(admin, sheetFile([]));
    const store = getStore();
    const [item] = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).sort((a, b) => a.position - b.position);
    // Fechado (a foto não entra na previsão): aceita.
    await store.update("booking_lots", lot.id, { status: "closed" });
    let saved = await svc.addBookingItemPhotos(admin, lot.id, item.id, {
      files: [photoFile(), photoFile()],
      uploadedIds: [],
    });
    const [first, second] = svc.bookingItemPhotos(saved);
    expect(saved.photoDocumentId).toBe(first);
    expect(saved.extraPhotoDocumentIds).toEqual([second]);
    saved = await svc.setBookingItemMainPhoto(admin, lot.id, item.id, second);
    expect(svc.bookingItemPhotos(saved)).toEqual([second, first]);
    saved = await svc.removeBookingItemPhoto(admin, lot.id, item.id, second);
    expect(saved.photoDocumentId).toBe(first);
    expect(saved.extraPhotoDocumentIds).toEqual([]);
    // O arquivo continua guardado.
    expect(await store.get("documents", second)).toBeTruthy();
    await expect(
      svc.addBookingItemPhotos(admin, lot.id, item.id, {
        files: [new File(["x"], "a.pdf", { type: "application/pdf" })],
        uploadedIds: [],
      }),
    ).rejects.toThrow("mime");
    await expect(
      svc.addBookingItemPhotos(admin, lot.id, item.id, {
        files: Array.from({ length: svc.BOOKING_ITEM_PHOTOS_MAX }, photoFile),
        uploadedIds: [],
      }),
    ).rejects.toThrow("booking_item_photos_max");
    await store.update("booking_lots", lot.id, { status: "cancelled" });
    await expect(
      svc.addBookingItemPhotos(admin, lot.id, item.id, {
        files: [photoFile()],
        uploadedIds: [],
      }),
    ).rejects.toThrow("booking_lot_locked");
  });

  it("buscar as fotos na planilha acrescenta só o que o item ainda não tem", async () => {
    const lot = await svc.createBookingLotFromSheet(
      admin,
      sheetFile([
        { sheet: 0, col: 0, row: 1, bytes: png(), ext: "png" },
        // Outra coluna na linha 2 do Excel: foto adicional do primeiro item.
        { sheet: 0, col: 9, row: 1, bytes: png(), ext: "png" },
        { sheet: 0, col: 0, row: 2, bytes: png(), ext: "png" },
      ]),
    );
    const store = getStore();
    const items = (
      await store.list("booking_items", { filter: { lotId: lot.id } })
    ).sort((a, b) => a.position - b.position);
    expect(svc.bookingItemPhotos(items[0])).toHaveLength(2);
    // Como na importação antiga: o primeiro sem a adicional, o segundo sem foto.
    await store.update("booking_items", items[0].id, {
      extraPhotoDocumentIds: [],
    });
    await store.update("booking_items", items[1].id, {
      photoDocumentId: null,
      description: "editado à mão",
    });
    const kept = items[0].photoDocumentId;
    const result = await svc.reloadBookingLotPhotos(admin, lot.id);
    expect(result).toMatchObject({
      missing: 1,
      filled: 2,
      photos: 2,
      failedSheets: 0,
    });
    const first = await store.get("booking_items", items[0].id);
    const second = await store.get("booking_items", items[1].id);
    // A principal fica; a adicional volta; o segundo ganha a dele.
    expect(first?.photoDocumentId).toBe(kept);
    expect(first?.extraPhotoDocumentIds).toHaveLength(1);
    expect(second?.photoDocumentId).toBeTruthy();
    // Nada além das fotos muda.
    expect(second?.description).toBe("editado à mão");
    // De novo: a mesma imagem não entra duas vezes.
    expect(await svc.reloadBookingLotPhotos(admin, lot.id)).toMatchObject({
      missing: 0,
      filled: 0,
      photos: 0,
    });
  });
});
