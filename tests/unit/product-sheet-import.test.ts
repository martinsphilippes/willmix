import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";
import { PNG_1X1, xlsxBytes, type FixtureSheet } from "./xlsx-fixture";
import { biffBytes, biffRecord, cfbBytes, xlsBytes, type XlsFixtureSheet } from "./xls-fixture";

/*
 * Cadastro de produtos pela planilha da ficha técnica (modelo SUPPLIER INFO):
 * cabeçalho em duas linhas, três linhas por produto (cores), fotos coladas.
 * Produtos nascem com ficha mestre, fornecedor e fotos; o que falta aparece.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const svc = await import("@/lib/services/product-sheet-import");
const { vi } = await import("vitest");
const { getProductSheet } = await import("@/lib/services/product-sheet");
const { openWorkbook } = await import("@/lib/services/xlsx");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let lineId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  lineId = (await getStore().list("product_lines", { orderBy: "name" }))[0].id;
});

/** O modelo: 62 colunas (A..BJ), SIZE agrupando LENGTH/WIDTH/HEIGHT, WX… na 2ª linha. */
function template(): FixtureSheet {
  const row1 = new Array<string>(62).fill("");
  const row2 = new Array<string>(62).fill("");
  const h1: Record<string, string> = {
    A: "PHOTO", B: "DATE", C: "LOCAL", D: "SUPPLIER NAME", E: "SUPPLIER STORE NO-YIWU",
    F: "SUPPLIER PHONE NO", G: "SKU/FACTORY ITEM CODE", H: "FOB / EXW", I: "PRICE   / U$",
    J: "QTY/BOX", K: "QTY/INNER", L: "N.W PC", M: "G.W PC", N: "CBM", O: "SIZE", R: "CAPACITY ML",
    S: "PACKAGE", T: "COLOR / ASSOLTMENT", U: "MATERIAL", V: "FUNCION / BATERRY / 110 / 220", W: "MOQ",
    X: "PURCHASE SCHEDULE", AA: "DEPARTURE INTERVAL IN DAYS", AD: "PURCHASE QTY IN PCS",
    AG: "SUPPLIER BUSINESS CARD", AW: "45 DAYS ",
  };
  const h2: Record<string, string> = {
    O: "LENGTH", P: "WIDTH", Q: "HEIGHT", AM: "OBS 1 LINHA ", AN: "OBS 1 LINHA ", AO: "WX PESO CX",
    AP: "WX CX", AQ: "WX CBM", AR: "WX INNER", AT: "WX ORDER CXS 1", AW: "WX ORDER CXS 2", BF: "TT PCS",
  };
  const col = (ref: string) => {
    let n = 0;
    for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  for (const [k, v] of Object.entries(h1)) row1[col(k)] = v;
  for (const [k, v] of Object.entries(h2)) row2[col(k)] = v;
  const line = (sku: string, price: string, box: string, inner: string, nw: string, cbm: string, dims: [string, string, string], size: string, color: string, obs: string, moq = "2400") => {
    const r = new Array<string>(62).fill("");
    const set = (ref: string, v: string) => (r[col(ref)] = v);
    set("B", "2026.10.13"); set("C", "YIWU"); set("D", "MIN YAN"); set("E", "E4-9558"); set("F", "13515898686");
    set("G", sku); set("H", "EXW"); set("I", price); set("J", box); set("K", inner); set("L", nw); set("N", cbm);
    set("O", dims[0]); set("P", dims[1]); set("Q", dims[2]); set("R", size); set("S", "Shrink + OPP + sticker");
    set("T", color); set("U", "PS+PVC"); set("W", moq); set("X", "0"); set("AM", obs); set("AQ", cbm); set("AT", "50");
    return r;
  };
  return {
    name: "SUPPLIER INFO",
    cells: [
      row1,
      row2,
      line("1", "4", "12", "12", "0.225", "0.0183", ["33.5", "24.8", "1.53"], "A4 ", "White ", "STONE MARBLE "),
      line("1", "4", "12", "12", "0.225", "0.0183", ["33.5", "24.8", "1.53"], "A4 ", "Gray ", "STONE MARBLE "),
      line("1", "4", "12", "12", "0.225", "0.0183", ["33.5", "24.8", "1.53"], "A4 ", "bege ", "STONE MARBLE "),
      line("MY-059A", "3.15", "24", "", "0.186", "0.0267", ["27.2", "22.2", "1.4"], "8X10  / 20X25 ", "BEGE", "WD STRIBY VERT"),
      line("MY-059A", "3.15", "24", "", "0.186", "0.0267", ["27.2", "22.2", "1.4"], "8X10  / 20X25 ", "CARVALHO  ", "WD STRIBY VERT"),
      line("MY-059A", "3.15", "24", "", "0.186", "0.0267", ["27.2", "22.2", "1.4"], "8X10  / 20X25 ", "MARROM ", "WD STRIBY VERT"),
    ],
  };
}

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

const templateBytes = () =>
  xlsxBytes([template()], {
    images: [
      { sheet: 0, col: 0, row: 2, bytes: PNG_1X1, ext: "png" },
      { sheet: 0, col: 32, row: 2, bytes: JPEG, ext: "jpeg" },
      { sheet: 0, col: 0, row: 5, bytes: PNG_1X1, ext: "png" },
    ],
  });

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

const file = (bytes: Uint8Array<ArrayBuffer>, name = "ficha.xlsx", type = XLSX_MIME) =>
  new File([bytes], name, { type });

/**
 * O mesmo modelo gravado como Excel 97-2003 (.xls): texto na SST, números
 * como número (como o Excel grava), fotos coladas nas mesmas células. Outro
 * fornecedor para não colidir com o lote em .xlsx.
 */
function xlsTemplateBytes(supplier = "MIN YAN XLS", store = "E4-9559", options: { biffVersion?: number } = {}) {
  const sheet = template();
  const cells: XlsFixtureSheet["cells"] = [];
  sheet.cells.forEach((row, r) =>
    row.forEach((raw, c) => {
      if (raw === "") return;
      const v = raw === "MIN YAN" ? supplier : raw === "E4-9558" ? store : raw;
      cells.push({
        row: r,
        col: c,
        cell: /^\d{1,8}(\.\d+)?$/.test(v) ? { kind: "number", value: Number(v) } : { kind: "sst", value: v },
      });
    }),
  );
  return xlsBytes(
    [{ name: sheet.name, cells }],
    [
      { sheet: 0, col: 0, row: 2, bytes: PNG_1X1, kind: "png" },
      { sheet: 0, col: 32, row: 2, bytes: JPEG, kind: "jpeg" },
      { sheet: 0, col: 0, row: 5, bytes: PNG_1X1, kind: "png" },
    ],
    options,
  );
}

describe("imagens da aba", () => {
  it("devolve cada imagem com a célula da âncora e os bytes", () => {
    const images = openWorkbook(templateBytes()).readImages("SUPPLIER INFO");
    expect(images.map((i) => [i.col, i.row, i.mime, i.bytes.length])).toEqual([
      [0, 2, "image/png", PNG_1X1.length],
      [32, 2, "image/jpeg", JPEG.length],
      [0, 5, "image/png", PNG_1X1.length],
    ]);
    // Aba sem desenho: nada; limite de tamanho respeitado.
    expect(openWorkbook(xlsxBytes([{ name: "X", cells: [["a"]] }])).readImages("X")).toEqual([]);
    expect(
      openWorkbook(templateBytes()).readImages("SUPPLIER INFO", { maxImageBytes: 10 }),
    ).toEqual([]);
  });
});

describe("leitura do modelo", () => {
  it("reconhece o cabeçalho em duas linhas, a moeda do preço e agrupa as cores", () => {
    const parsed = svc.parseProductSheet(templateBytes());
    expect(parsed.headerRow).toBe(1);
    expect(parsed.currency).toBe("USD");
    expect(parsed.columns).toMatchObject({
      photo: 0, sheetDate: 1, location: 2, supplierName: 3, supplierStore: 4, supplierPhone: 5,
      factoryItemCode: 6, incoterm: 7, price: 8, masterCartonQty: 9, innerQty: 10, netWeightPcKg: 11,
      grossWeightPcKg: 12, cbmPerCarton: 13, lengthCm: 14, widthCm: 15, heightCm: 16, capacityMl: 17,
      packageType: 18, colorAssortment: 19, material: 20, powerDetail: 21, moq: 22, schedule: 23,
      interval: 26, purchaseQty: 29, businessCard: 32, description: 38,
    });
    expect(parsed.rows).toHaveLength(6);
    expect(parsed.groups).toHaveLength(2);
    const [a, b] = parsed.groups;
    expect([a.firstRow, a.lastRow, b.firstRow, b.lastRow]).toEqual([3, 5, 6, 8]);
    expect(a.colors).toEqual(["White", "Gray", "bege"]);
    expect(a.reading).toMatchObject({
      sheetDate: "2026-10-13T00:00:00.000Z", location: "YIWU", supplierName: "MIN YAN", supplierStore: "E4-9558",
      supplierPhone: "13515898686", factoryItemCode: "1", incoterm: "EXW", currency: "USD", price: 4,
      masterCartonQty: 12, innerQty: 12, netWeightPcKg: 0.225, cbmPerCarton: 0.0183,
      packageType: "Shrink + OPP + sticker", colorAssortment: "White / Gray / bege", material: "PS+PVC", moq: 2400,
    });
    // "A4" não é capacidade em ml: é o tamanho (vai para o nome); medidas são do produto.
    expect(a.reading.capacityMl).toBeUndefined();
    expect([a.sizeText, a.lengthCm, a.widthCm, a.heightCm]).toEqual(["A4", 33.5, 24.8, 1.53]);
    expect(a.description).toBe("STONE MARBLE");
    expect(a.notes).toContain("Purchase schedule: 0");
    expect(a.photo?.mime).toBe("image/png");
    expect(a.card?.mime).toBe("image/jpeg");
    expect(b.photo?.row).toBe(5);
    expect(b.card).toBeNull();
    expect(b.reading.innerQty).toBeUndefined();
    expect(svc.productNameFor(a, "Porta-retrato")).toBe("Porta-retrato STONE MARBLE A4");
    expect(svc.productNameFor(b, null)).toBe("WD STRIBY VERT 8X10 / 20X25");
  });

  it("planilha simples em português (uma linha de cabeçalho, nome e moeda em coluna)", () => {
    const bytes = xlsxBytes([
      {
        name: "Produtos",
        cells: [
          ["Nome", "Fornecedor", "Preço", "Moeda", "Qtd/Caixa", "MOQ", "Cor", "Tamanho"],
          ["Bandeja sem preço", "Ningbo C", "", "", "", "", "Natural", ""],
          ["Caneca cerâmica 350 ml", "Ningbo C", "2,35", "RMB", "48", "3000", "Branca", "12x9x10,5 cm"],
          ["Caneca cerâmica 350 ml", "Ningbo C", "2,35", "RMB", "48", "3000", "Preta", "12x9x10,5 cm"],
          ["Garrafa térmica", "Ningbo C", "1.8", "USD", "60", "5000", "Prata", ""],
        ],
      },
    ]);
    const parsed = svc.parseProductSheet(bytes, { defaultCurrency: "USD" });
    expect(parsed.currency).toBeNull();
    // A 1ª linha de dados sem preço nem quantidade é produto, não subcabeçalho.
    expect(parsed.groups.map((g) => [g.name, g.reading.currency ?? null, g.reading.price ?? null, g.colors])).toEqual([
      ["Bandeja sem preço", null, null, ["Natural"]],
      ["Caneca cerâmica 350 ml", "RMB", 2.35, ["Branca", "Preta"]],
      ["Garrafa térmica", "USD", 1.8, ["Prata"]],
    ]);
    expect([parsed.groups[1].lengthCm, parsed.groups[1].widthCm, parsed.groups[1].heightCm]).toEqual([12, 9, 10.5]);
  });

  it("moeda e incoterm do cabeçalho do preço; pesos da caixa ficam de fora", () => {
    expect(svc.currencyInHeader("PREÇO R$")).toBe("BRL");
    expect(svc.currencyInHeader("PRICE   / U$")).toBe("USD");
    expect(svc.currencyInHeader("UNIT PRICE (RMB)")).toBe("RMB");
    expect(svc.currencyInHeader("$ PRICE")).toBe("USD");
    expect(svc.currencyInHeader("PRICE")).toBeNull();
    const parsed = svc.parseProductSheet(
      xlsxBytes([
        {
          name: "Lista",
          cells: [
            ["ITEM NO", "SUPPLIER", "FOB PRICE USD", "QTY/CTN", "N.W/CTN", "G.W/CTN", "N.W PC", "MOQ", "PRODUCT SIZE (CM)", "", "", "CAPACITY", "DATE"],
            ["", "", "", "", "", "", "", "", "LENGTH", "WIDTH", "HEIGHT", "", ""],
            ["A-1", "Factory X", "2.5", "24", "12", "13", "0.4", "1000", "10", "8", "6", "1.5L", String(Math.round((Date.UTC(2026, 9, 13) - Date.UTC(1899, 11, 30)) / 86_400_000))],
          ],
        },
      ]),
    );
    expect(parsed.columns.price).toBe(2);
    expect(parsed.columns.netWeightPcKg).toBe(6);
    expect(parsed.columns.grossWeightPcKg).toBeUndefined();
    expect([parsed.columns.lengthCm, parsed.columns.widthCm, parsed.columns.heightCm]).toEqual([8, 9, 10]);
    const [g] = parsed.groups;
    expect(g.reading).toMatchObject({ price: 2.5, currency: "USD", incoterm: "FOB", masterCartonQty: 24, netWeightPcKg: 0.4, capacityMl: 1500, sheetDate: "2026-10-13T00:00:00.000Z" });
    expect([g.lengthCm, g.widthCm, g.heightCm]).toEqual([10, 8, 6]);
  });

  it("escolhe a aba com o cabeçalho da ficha (não a primeira) e avisa quando corta linhas", () => {
    const parsed = svc.parseProductSheet(
      xlsxBytes([
        { name: "Resumo", cells: [["Total", "Obs"], ["10", "x"]] },
        template(),
      ]),
    );
    expect(parsed.sheetName).toBe("SUPPLIER INFO");
    expect(parsed.groups).toHaveLength(2);
    const many = [["NAME", "SUPPLIER", "PRICE USD", "MOQ"]];
    for (let i = 0; i < svc.MAX_SHEET_ROWS + 5; i++) many.push([`P${i}`, "S", "1", "10"]);
    expect(() => svc.parseProductSheet(xlsxBytes([{ name: "X", cells: many }]))).toThrow("too_many");
  });

  it("recusa arquivo OLE que não é um .xls válido, arquivo que não é planilha e planilha sem cabeçalho", () => {
    // Assinatura do Excel antigo sem um livro dentro: vai ao leitor .xls e é recusado.
    const ole = new Uint8Array(64);
    ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(() => svc.parseProductSheet(ole)).toThrow("invalid_file");
    expect(() => svc.parseProductSheet(new TextEncoder().encode("isto não é zip"))).toThrow("invalid_file");
    expect(() =>
      svc.parseProductSheet(xlsxBytes([{ name: "X", cells: [["a", "b"], ["1", "2"]] }])),
    ).toThrow("no_header");
    expect(() =>
      svc.parseProductSheet(xlsxBytes([{ name: "X", cells: [["SUPPLIER NAME", "SKU", "PRICE", "QTY/BOX", "MOQ"]] }])),
    ).toThrow("no_rows");
  });

  it("lê o mesmo modelo em .xls (Excel 97-2003): abas, cabeçalho, números e grupos iguais ao .xlsx", () => {
    const fromXls = svc.parseProductSheet(xlsTemplateBytes("MIN YAN", "E4-9558"));
    const fromXlsx = svc.parseProductSheet(templateBytes());
    expect(fromXls.sheetName).toBe("SUPPLIER INFO");
    expect(fromXls.columns).toEqual(fromXlsx.columns);
    expect(fromXls.rows).toEqual(fromXlsx.rows);
    expect(fromXls.groups).toEqual(fromXlsx.groups);
    // Excel 95 (BIFF5) não é lido: a tela pede para salvar como .xlsx.
    expect(() => svc.parseProductSheet(xlsTemplateBytes("MIN YAN", "E4-9558", { biffVersion: 0x0500 }))).toThrow("xls_format");
    // Planilha com senha (registro FILEPASS depois do BOF): aviso próprio, não "arquivo antigo".
    const stream = biffBytes([{ name: "S", cells: [] }]);
    const locked = new Uint8Array(stream.length + 10);
    locked.set(stream.subarray(0, 20), 0);
    locked.set(biffRecord(0x002f, new Uint8Array(6)), 20);
    locked.set(stream.subarray(20), 30);
    expect(() => svc.parseProductSheet(cfbBytes("Workbook", locked))).toThrow("sheet_encrypted");
    expect(() => svc.parseProductSheet(cfbBytes("EncryptedPackage", new Uint8Array(3000)))).toThrow("sheet_encrypted");
  });
});

describe("importação", () => {
  it("cadastra produtos com ficha mestre, fornecedor e fotos, e diz o que falta", async () => {
    const store = getStore();
    const before = (await store.list("products")).length;
    const result = await svc.importProductSheet(admin, file(templateBytes()), {
      lineId,
      namePrefix: "Porta-retrato",
      defaultCurrency: "USD",
    });
    expect(result.summary).toMatchObject({ groups: 2, rows: 6, created: 2, updated: 0, errors: 0, suppliersCreated: 1, photos: 3 });
    expect(result.results.map((r) => [r.name, r.status, r.photos, r.supplierName])).toEqual([
      ["Porta-retrato STONE MARBLE A4", "created", 2, "MIN YAN"],
      ["Porta-retrato WD STRIBY VERT 8X10 / 20X25", "created", 1, "MIN YAN"],
    ]);
    expect((await store.list("products")).length).toBe(before + 2);

    // Fornecedor novo com nº da loja, telefone e cidade.
    const [minYan] = await store.list("parties", { filter: { type: "supplier", name: "MIN YAN" } });
    expect(minYan).toMatchObject({ storeNumber: "E4-9558", phone: "13515898686", city: "YIWU", active: true });

    const productId = result.results[0].productId!;
    const product = (await store.get("products", productId))!;
    expect(product).toMatchObject({
      lineId, supplierId: minYan.id, supplierSku: "1", source: "import", price: 4, currency: "USD", moq: 2400,
      masterBoxQty: 12, innerBoxQty: 12, netWeightKg: 0.225, cbm: 0.0183, material: "PS+PVC",
      lengthCm: 33.5, widthCm: 24.8, heightCm: 1.53,
    });
    expect(product.color).toContain("White");
    const sheet = (await getProductSheet(productId))!;
    expect(sheet).toMatchObject({
      supplierName: "MIN YAN", supplierStore: "E4-9558", factoryItemCode: "1", incoterm: "EXW", currency: "USD",
      price: 4, moq: 2400, masterCartonQty: 12, innerQty: 12, netWeightPcKg: 0.225, cbmPerCarton: 0.0183,
      packageType: "Shrink + OPP + sticker", colorAssortment: "White / Gray / bege", material: "PS+PVC",
    });
    // Vínculo produto × fornecedor com o código da fábrica.
    const links = await store.list("product_suppliers", { filter: { productId } });
    expect(links.map((l) => [l.supplierId, l.supplierSku])).toEqual([[minYan.id, "1"]]);
    // Fotos: a da coluna PHOTO entra como foto do fornecedor (imagem do catálogo) e o cartão; a 2ª linha só tem a foto.
    const kinds = (await store.list("product_photos", { filter: { productId } })).map((p) => p.kind).sort();
    expect(kinds).toEqual(["business_card", "supplier"]);
    expect(product.primaryPhotoDocumentId).toBeTruthy();
    // O que falta: medidas da caixa e todas as fotos da ficha, inclusive a original
    // (a da planilha não é a evidência da equipe); o que veio não falta.
    const missing = result.results[0].missing;
    expect(missing).toEqual(expect.arrayContaining(["heightCm", "widthCm", "lengthCm", "scalePhoto", "rulerPhoto", "sidePhoto", "anglePhoto", "originalPhoto"]));
    for (const k of ["price", "moq", "colorAssortment", "material", "packageType"])
      expect(missing).not.toContain(k);
    // Lote guardado com o arquivo e o resumo.
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(batch).toMatchObject({ entity: "product_sheets", status: "imported", rowCount: 6, sheetName: "SUPPLIER INFO" });
    expect(batch.fileDocumentId).toBeTruthy();
    expect(svc.batchProductIds(batch)).toEqual(result.results.map((r) => r.productId));
    expect(batch.mapping.__lineId).toBe(lineId);
  });

  it("a foto original tirada pela equipe toma o lugar da foto do fornecedor como principal", async () => {
    const store = getStore();
    const { addPhotos } = await import("@/lib/services/sourcing");
    const [product] = await store.list("products", { filter: { name: "Porta-retrato WD STRIBY VERT 8X10 / 20X25" } });
    const before = (await store.list("product_photos", { filter: { productId: product.id, isPrimary: true } }))[0];
    expect(before.kind).toBe("supplier");
    const [original] = await addPhotos(
      admin,
      { productId: product.id },
      [new File([new Uint8Array(PNG_1X1)], "original.png", { type: "image/png" })],
      "original",
    );
    expect(original.isPrimary).toBe(true);
    expect((await store.get("products", product.id))!.primaryPhotoDocumentId).toBe(original.documentId);
    expect((await store.get("product_photos", before.id))!.isPrimary).toBe(false);
    // Uma segunda original não derruba a principal já escolhida.
    const [another] = await addPhotos(
      admin,
      { productId: product.id },
      [new File([new Uint8Array(PNG_1X1)], "outra.png", { type: "image/png" })],
      "original",
    );
    expect(another.isPrimary).toBe(false);
  });

  it("importar de novo atualiza os mesmos produtos, sem duplicar produto, fornecedor nem foto", async () => {
    const store = getStore();
    const before = (await store.list("products")).length;
    const suppliersBefore = (await store.list("parties", { filter: { type: "supplier" } })).length;
    // Produto importado pela versão anterior guardou a foto da planilha como "original".
    const [first] = await store.list("products", { filter: { name: "Porta-retrato STONE MARBLE A4" } });
    const [old] = await store.list("product_photos", { filter: { productId: first.id, kind: "supplier" } });
    await store.update("product_photos", old.id, { kind: "original" });
    const result = await svc.importProductSheet(admin, file(templateBytes()), { lineId, namePrefix: "Porta-retrato" });
    expect(result.summary).toMatchObject({ created: 0, updated: 2, errors: 0, suppliersCreated: 0, photos: 0 });
    expect((await store.list("products")).length).toBe(before);
    expect((await store.list("parties", { filter: { type: "supplier" } })).length).toBe(suppliersBefore);
    const photos = await store.list("product_photos", { filter: { productId: result.results[0].productId! } });
    expect(photos).toHaveLength(2);
    expect(photos.map((p) => p.kind).sort()).toEqual(["business_card", "original"]);
  });

  it("mesmo nome de outro fornecedor vira produto novo com o fornecedor no nome; nomes repetidos ganham contador", async () => {
    const store = getStore();
    const sheet = (supplier: string, store2: string, rows: Array<[string, string, string]>) =>
      xlsxBytes([
        {
          name: "Lista",
          cells: [
            ["NAME", "SUPPLIER NAME", "SUPPLIER STORE NO", "PRICE USD", "MOQ", "SKU", "COLOR"],
            ...rows.map(([name, price, sku]) => [name, supplier, store2, price, "100", sku, ""]),
          ],
        },
      ]);
    const first = await svc.importProductSheet(admin, file(sheet("Alpha Co", "A1-100", [["Vaso decorativo", "3", "V1"], ["Vaso decorativo", "4", "V2"], ["Vaso decorativo", "5", ""]])), { lineId });
    expect(first.results.map((r) => [r.name, r.status])).toEqual([
      ["Vaso decorativo", "created"],
      ["Vaso decorativo · V2", "created"],
      ["Vaso decorativo (2)", "created"],
    ]);
    // Outro fornecedor, mesmo nome: não sequestra o produto do primeiro.
    const second = await svc.importProductSheet(admin, file(sheet("Beta Ltd", "B2-200", [["Vaso decorativo", "9", "X9"]])), { lineId });
    expect(second.results.map((r) => [r.name, r.status])).toEqual([["Vaso decorativo · Beta Ltd", "created"]]);
    const alpha = (await store.list("products", { filter: { name: "Vaso decorativo" } }))[0];
    expect(alpha.price).toBe(3);
    // O mesmo fornecedor de novo: atualiza o dele.
    const again = await svc.importProductSheet(admin, file(sheet("Alpha Co", "A1-100", [["Vaso decorativo", "3.5", "V1"]])), { lineId });
    expect(again.results.map((r) => [r.name, r.status])).toEqual([["Vaso decorativo", "updated"]]);
    expect((await store.get("products", alpha.id))!.price).toBe(3.5);
  });

  it("falha depois de criar o produto: conta como erro, mas o produto fica no resultado", async () => {
    const store = getStore();
    const original = store.create.bind(store);
    const spy = vi.spyOn(store, "create").mockImplementation(async (table, data) => {
      if (table === "purchase_sheets") throw new Error("sheet down");
      return original(table, data as never);
    });
    let result: Awaited<ReturnType<typeof svc.importProductSheet>>;
    try {
      result = await svc.importProductSheet(admin, file(xlsxBytes([{ name: "L", cells: [["NAME", "SUPPLIER NAME", "PRICE USD", "MOQ"], ["Copo falho", "Gamma", "1", "10"]] }])), { lineId });
    } finally {
      spy.mockRestore();
    }
    expect(result.summary).toMatchObject({ created: 0, updated: 0, errors: 1 });
    expect(result.results[0]).toMatchObject({ status: "error", error: "sheet down" });
    expect(result.results[0].productId).toBeTruthy();
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(svc.batchDecision(batch.decisions["0"])).toEqual({ status: "error", productId: result.results[0].productId, error: "sheet down" });
    expect(svc.batchProductIds(batch)).toEqual([result.results[0].productId]);
  });

  it("planilha já subida direto ao armazenamento (id) é lida e vira a evidência do lote", async () => {
    const store = getStore();
    const stored = await store.putFile(templateBytes(), "ficha-direta.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const result = await svc.importProductSheet(admin, { fileKey: stored.key, fileName: "ficha-direta.xlsx" }, { lineId, namePrefix: "Porta-retrato" });
    expect(result.summary.updated + result.summary.created).toBe(2);
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(batch.fileName).toBe("ficha-direta.xlsx");
    expect(batch.fileDocumentId).toBeTruthy();
    await expect(svc.importProductSheet(admin, { fileKey: "00000000-0000-4000-8000-000000000000" }, { lineId })).rejects.toThrow("file_required");
  });

  it("só a Wellmix importa; linha é obrigatória", async () => {
    await expect(svc.importProductSheet(joao, file(templateBytes()), { lineId })).rejects.toThrow("forbidden");
    await expect(svc.importProductSheet(admin, file(templateBytes()), { lineId: "nao-existe" })).rejects.toThrow("line_required");
  });
  it("planilha .xls (Excel 97-2003) cadastra produtos, ficha e fotos como a .xlsx e guarda o arquivo original", async () => {
    const store = getStore();
    const before = (await store.list("products")).length;
    const result = await svc.importProductSheet(admin, file(xlsTemplateBytes(), "ficha.xls", XLS_MIME), {
      lineId,
      namePrefix: "Porta-retrato",
      defaultCurrency: "USD",
    });
    expect(result.summary).toMatchObject({ groups: 2, rows: 6, created: 2, updated: 0, errors: 0, suppliersCreated: 1, photos: 3 });
    expect((await store.list("products")).length).toBe(before + 2);
    const product = (await store.get("products", result.results[0].productId!))!;
    expect(product).toMatchObject({
      supplierSku: "1", price: 4, currency: "USD", moq: 2400, masterBoxQty: 12, innerBoxQty: 12,
      netWeightKg: 0.225, cbm: 0.0183, lengthCm: 33.5, widthCm: 24.8, heightCm: 1.53, material: "PS+PVC",
    });
    const [supplier] = await store.list("parties", { filter: { type: "supplier", name: "MIN YAN XLS" } });
    expect(supplier).toMatchObject({ storeNumber: "E4-9559", phone: "13515898686", city: "YIWU" });
    const photos = await store.list("product_photos", { filter: { productId: product.id } });
    expect(photos.map((p) => p.kind).sort()).toEqual(["business_card", "supplier"]);
    const batch = (await store.get("import_batches", result.batchId))!;
    expect(batch).toMatchObject({ status: "imported", rowCount: 6, sheetName: "SUPPLIER INFO" });
    const evidence = (await store.get("documents", batch.fileDocumentId!))!;
    expect(evidence).toMatchObject({ name: "ficha.xls", mime: XLS_MIME });
  });
});
