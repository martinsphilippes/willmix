import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Tarifário de frete: a planilha "ESTIMATIVA DE FRETE" das companhias
 * marítimas (abas COMPARATIVO por destino, FORNECEDORES, PORTOS, AD_FREINT)
 * entra inteira; o total em R$ é refeito com as taxas da própria companhia;
 * a conferência aponta fórmulas e taxas que não batem; o CSV do Sankhya sai
 * igual ao da macro. Só a Wellmix importa e vê (tem as tarifas de todas as
 * companhias). Valores inventados, no mesmo layout da planilha modelo.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { getSettings } = await import("@/lib/settings");
const { readCells, readGrid } = await import("@/lib/services/xlsx");
const calc = await import("@/lib/services/freight-tariff-calc");
const service = await import("@/lib/services/freight-tariff");
const { canAccessDocument } = await import("@/lib/services/documents");
type User = import("@/lib/db").User;
type Sheet = import("@/lib/services/freight-tariff-calc").TariffSheet;

/** Grade a partir de células "A1" → valor (o resto vazio). */
function grid(cells: Record<string, string | number>): string[][] {
  const out: string[][] = [];
  for (const [ref, value] of Object.entries(cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    const r = Number(m[2]) - 1;
    while (out.length <= r) out.push([]);
    while (out[r].length < col - 1) out[r].push("");
    out[r][col - 1] = String(value);
  }
  return out;
}

const HEAD = {
  C4: "PORTOS",
  B4: "LEGENDAS:",
  D4: "USD POR 40HQ (ROTA DIRETA)",
  E4: "USD POR 40HQ (ROTA LONGA)",
  F4: "TOTAL CUSTOS BRL (ROTA DIRETA)",
  G4: "TOTAL CUSTOS BRL (ROTA LONGA)",
  H4: "USD POR 40HQ (ROTA DIRETA)",
  I4: "USD POR 40HQ (ROTA LONGA)",
  J4: "TOTAL CUSTOS BRL (ROTA DIRETA)",
  K4: "TOTAL CUSTOS BRL (ROTA LONGA)",
  L4: "USD POR 40HQ (ROTA DIRETA)",
  M4: "USD POR 40HQ (ROTA LONGA)",
  N4: "TOTAL CUSTOS BRL (ROTA DIRETA)",
  O4: "TOTAL CUSTOS BRL (ROTA LONGA)",
};

/** Parâmetros e taxas: bloco 1 = 40 + 20,5 US$ por embarque, 600 R$ por embarque e 800 R$ por container. */
const PARAMS_AND_FEES = {
  B10: "#VALUE!",
  C10: 5,
  D10: "TAXAS",
  F10: "USD",
  G10: "BRL",
  H10: "TAXAS",
  J10: "USD",
  K10: "BRL",
  L10: "TAXAS",
  N10: "USD",
  O10: "BRL",
  B11: 0.1,
  C11: 5.1,
  D11: "ORIGEM",
  E11: "COURIER FEE/FREE",
  F11: 40,
  H11: "ORIGEM",
  I11: "COURIER FEE/FREE",
  L11: "ORIGEM",
  M11: "COURIER FEE/FREE",
  B12: "FRETE (CD)",
  C12: 1000,
  D12: "DESTINO",
  E12: "BL FEE/FREE",
  G12: 600,
  H12: "DESTINO",
  I12: "BL FEE/FREE",
  L12: "DESTINO",
  M12: "BL FEE/FREE",
  B13: "QTD CNTR:",
  C13: 1,
  E13: "THD/THC",
  G13: 800,
  I13: "THD/THC",
  K13: 900,
  M13: "THD/THC",
  E14: "TRS",
  F14: 20.5,
  I14: "TRS",
  J14: 10,
  M14: "TRS",
  D15: "TOTAIS  TAXAS USD/BRL:",
  F15: 60.5,
  G15: 1400,
  H15: "TOTAIS  TAXAS USD/BRL:",
  J15: 10,
  K15: 900,
  L15: "TOTAIS  TAXAS USD/BRL:",
  N15: 0,
  O15: 0,
  D16: "%",
  E16: "PTAX",
  F16: 0.02,
  E17: "",
  I16: "PTAX",
  F17: 0.035,
};
// Linha do IOF (rótulo na coluna do nome da taxa).
Object.assign(PARAMS_AND_FEES, { E17: "IOF" });

/** Navegantes: o total da BETA na planilha soma as taxas da ALFA (erro de fórmula). */
function nvt(): Sheet {
  return {
    name: "COMPARATIVO - NVT",
    cells: grid({
      D2: "ESTIMATIVA DE FRETES - ROTAS NAVEGANTES",
      B3: "AG. CARGAS + ARMADOR:",
      D3: "ALFA LINES",
      F3: "PRAZO PGTO.:",
      G3: 120,
      H3: "BETA CARGO ",
      J3: "PRAZO PGTO.:",
      K3: 90,
      L3: "GAMA",
      ...HEAD,
      B5: "CHINA",
      C5: "NINGBO",
      D5: 3000,
      F5: 18008.55,
      H5: 4000,
      J5: 23108.55, // = 4000 × 5,1 + 1000 + taxas da ALFA (1708,55)
      C6: "SHENZHEN",
      E6: 3500,
      G6: 20558.55,
      C7: "QINGDAO",
      L7: 2000,
      N7: 11200,
      B8: "INDIA",
      C8: "MUNDRA",
      H8: 5000,
      J8: 27451,
      ...PARAMS_AND_FEES,
    }),
  };
}

/** Itajaí: companhias trocadas de lugar, taxas copiadas da NVT coluna por coluna. */
function itj(): Sheet {
  return {
    name: "COMPARATIVO - ITJ",
    cells: grid({
      D3: "BETA CARGO",
      F3: "PRAZO PGTO.:",
      G3: 90,
      H3: "ALFA LINES",
      J3: "PRAZO PGTO.:",
      K3: 120,
      ...HEAD,
      B5: "CHINA",
      C5: "NINGBO",
      D5: 3900,
      ...PARAMS_AND_FEES,
    }),
  };
}

const fornecedores = (): Sheet => ({
  name: "FORNECEDORES",
  cells: grid({
    A1: "CODPARC",
    B1: "NOMEPARC",
    A2: 111,
    B2: "ALFA LINES",
    A3: 222,
    B3: "BETA CARGO",
    B4: "GAMA",
  }),
});

const portos = (): Sheet => ({
  name: "PORTOS",
  cells: grid({
    A1: "ID",
    B1: "PORTO",
    A2: 60,
    B2: "NAVEGANTES",
    A3: 5,
    B3: "ITAJAÍ",
    A4: 45,
    B4: "NINGBO",
    A5: 47,
    B5: "SHENZEN",
    A6: 99,
    B6: "MUNDRA",
  }),
});

/** AD_FREINT como a macro gera (bate com os comparativos). */
const adFreint = (value = 3000): Sheet => ({
  name: "AD_FREINT",
  cells: grid({
    A1: "AD_IDEXTERNO",
    B1: "CODPARC",
    C1: "DTREFERENCIA",
    D1: "IDDEST",
    E1: "IDORIG",
    F1: "SEQCONTAI",
    G1: "VALOR",
    H1: "TAXA_USD",
    I1: "TAXA_BRL",
    A2: "1114630945",
    B2: 111,
    C2: 46309,
    D2: 60,
    E2: 45,
    F2: 3,
    G2: value,
    H2: 60.5,
    I2: 1400,
    A3: "2224630945",
    B3: 222,
    C3: 46309,
    D3: 60,
    E3: 45,
    F3: 3,
    G3: 4000,
    H3: 10,
    I3: 900,
    A4: "2224630999",
    B4: 222,
    C4: 46309,
    D4: 60,
    E4: 99,
    F4: 3,
    G4: 5000,
    H4: 10,
    I4: 900,
    A5: "2224630945",
    B5: 222,
    C5: 46309,
    D5: 5,
    E5: 45,
    F5: 3,
    G5: 3900,
    H5: 60.5,
    I5: 1400,
  }),
});

const workbook = (): Sheet[] => [
  nvt(),
  itj(),
  adFreint(),
  fornecedores(),
  portos(),
];

/* ---- Arquivo .xlsx de verdade (ZIP sem compressão), várias abas ---- */

function colName(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xlsxFile(sheets: Sheet[], extra: Array<[string, string]> = []) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sheetXml = (cells: string[][]) =>
    // Linha 1 vazia gravada como <row/> (como o Excel faz): não pode deslocar nada.
    `<?xml version="1.0"?><worksheet><sheetData><row r="1" spans="1:3" ht="2" customHeight="1"/>${cells
      .map((row, ri) =>
        ri === 0
          ? ""
          : `<row r="${ri + 1}">${row
              .map((v, ci) => {
                if (v === "") return "";
                const ref = `${colName(ci)}${ri + 1}`;
                return /^-?\d+(\.\d+)?$/.test(v)
                  ? `<c r="${ref}"><v>${v}</v></c>`
                  : v.startsWith("#")
                    ? `<c r="${ref}" t="e"><v>${esc(v)}</v></c>`
                    : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
              })
              .join("")}</row>`,
      )
      .join("")}</sheetData></worksheet>`;
  const files: Array<[string, string]> = [
    [
      "xl/workbook.xml",
      `<workbook><sheets>${sheets
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
    ...sheets.map(
      (s, i) =>
        [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.cells)] as [
          string,
          string,
        ],
    ),
    ...extra,
  ];
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
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

const file = (
  bytes: Uint8Array<ArrayBuffer>,
  name = "261013_ESTIMATIVA_DE_FRETE.xlsm",
) =>
  // O navegador manda o tipo do .xlsm com "E" maiúsculo.
  new File([bytes], name, {
    type: "application/vnd.ms-excel.sheet.macroEnabled.12",
  });

describe("leitura da planilha de frete", () => {
  const data = calc.parseFreightTariff(workbook());
  const navegantes = data.destinations[0];
  const itajai = data.destinations[1];

  it("parâmetros: câmbio com spread, frete até o CD e containers", () => {
    expect(data.fx).toBe(5.1);
    expect(data.fxBase).toBe(5);
    expect(data.fxSpread).toBe(0.1);
    expect(data.roadFreightBrl).toBe(1000);
    expect(data.containerQty).toBe(1);
    expect(data.destinations.map((d) => [d.code, d.name, d.portId])).toEqual([
      ["NVT", "NAVEGANTES", 60],
      ["ITJ", "ITAJAÍ", 5],
    ]);
  });

  it("companhias com código do Sankhya, prazo de pagamento e taxas", () => {
    expect(
      navegantes.forwarders.map((f) => [f.name, f.code, f.paymentTermDays]),
    ).toEqual([
      ["ALFA LINES", "111", 120],
      ["BETA CARGO", "222", 90],
      ["GAMA", null, null],
    ]);
    const alfa = navegantes.forwarders[0];
    expect(alfa.fees.map((f) => f.label)).toEqual([
      "COURIER FEE/FREE",
      "BL FEE/FREE",
      "THD/THC",
      "TRS",
    ]);
    expect(alfa.feesUsd).toBe(60.5);
    expect(alfa.feesBrl).toBe(1400);
    // (40 + 20,5) × 5,1 + 600 + 800.
    expect(alfa.feesTotalBrl).toBe(1708.55);
    expect(alfa.ptaxPercent).toBe(0.02);
    expect(alfa.iofPercent).toBe(0.035);
    expect(navegantes.forwarders[1].feesTotalBrl).toBe(951);
  });

  it("total de cada rota refeito com as taxas da própria companhia", () => {
    const rate = (origin: string, forwarder: string) =>
      navegantes.rates.find(
        (r) =>
          navegantes.origins[r.origin].name === origin &&
          navegantes.forwarders[r.forwarder].name === forwarder,
      )!;
    expect(rate("NINGBO", "ALFA LINES")).toMatchObject({
      route: "direct",
      oceanUsd: 3000,
      totalBrl: 18008.55,
    });
    // A planilha somou as taxas da ALFA; o portal usa as da BETA.
    expect(rate("NINGBO", "BETA CARGO")).toMatchObject({
      totalBrl: 22351,
      sheetTotalBrl: 23108.55,
    });
    expect(rate("SHENZHEN", "ALFA LINES")).toMatchObject({
      route: "long",
      totalBrl: 20558.55,
    });
    expect(navegantes.origins.map((o) => [o.country, o.name])).toEqual([
      ["CHINA", "NINGBO"],
      ["CHINA", "SHENZHEN"],
      ["CHINA", "QINGDAO"],
      ["INDIA", "MUNDRA"],
    ]);
  });

  it("conferência: fórmula com taxas de outra companhia, taxas copiadas, nomes sem código", () => {
    const codes = data.warnings.map((w) => w.code);
    expect(data.warnings).toContainEqual({
      code: "fees_other_agent",
      params: {
        sheet: "COMPARATIVO - NVT",
        forwarder: "BETA CARGO",
        other: "ALFA LINES",
        n: 1,
      },
    });
    // SHENZHEN não tem ID; na aba PORTOS está "SHENZEN" (dica, nunca usado sozinho).
    expect(data.warnings).toContainEqual({
      code: "port_no_id_similar",
      params: { port: "SHENZHEN", similar: "SHENZEN", id: 47 },
    });
    expect(navegantes.origins[1].portId).toBeNull();
    expect(data.warnings).toContainEqual({
      code: "port_no_id",
      params: { port: "QINGDAO" },
    });
    expect(data.warnings).toContainEqual({
      code: "forwarder_no_code",
      params: { forwarder: "GAMA" },
    });
    expect(data.warnings).toContainEqual({
      code: "fees_copied",
      params: {
        sheet: "COMPARATIVO - ITJ",
        otherSheet: "COMPARATIVO - NVT",
        pairs: "BETA CARGO = ALFA LINES; ALFA LINES = BETA CARGO",
      },
    });
    expect(data.warnings).toContainEqual({
      code: "ptax_iof_unused",
      params: { ptax: 2, iof: 3.5 },
    });
    // Mesmo AD_IDEXTERNO em Navegantes e Itajaí (o código não leva o destino).
    expect(data.warnings).toContainEqual({
      code: "sankhya_duplicate_ids",
      params: { n: 1 },
    });
    // A aba AD_FREINT bate com os comparativos: sem aviso.
    expect(codes).not.toContain("sankhya_tab_outdated");
    expect(itajai.forwarders[0]).toMatchObject({
      name: "BETA CARGO",
      feesTotalBrl: 1708.55,
    });
  });

  it("AD_FREINT desatualizada em relação aos comparativos: aviso", () => {
    const old = calc.parseFreightTariff([
      nvt(),
      itj(),
      adFreint(2950),
      fornecedores(),
      portos(),
    ]);
    expect(old.warnings).toContainEqual({
      code: "sankhya_tab_outdated",
      params: { n: 2 },
    });
  });

  it("planilha fora do modelo: erro claro", () => {
    expect(() => calc.parseFreightTariff([fornecedores()])).toThrow(
      "tariff_no_sheets",
    );
    const noFx = nvt();
    noFx.cells[9][2] = "";
    noFx.cells[10][2] = "";
    expect(() => calc.parseFreightTariff([noFx])).toThrow("tariff_fx_missing");
    const empty = nvt();
    for (const row of empty.cells.slice(4, 8))
      for (let c = 3; c < row.length; c++) row[c] = "";
    expect(() => calc.parseFreightTariff([empty])).toThrow("tariff_empty");
  });

  it("números em vários formatos; erro de fórmula vira vazio", () => {
    expect(calc.cellNumber("3618")).toBe(3618);
    expect(calc.cellNumber("1.200,50")).toBe(1200.5);
    expect(calc.cellNumber("R$ 1.270")).toBe(1270);
    expect(calc.cellNumber("#REF!")).toBeNull();
    expect(calc.cellNumber("")).toBeNull();
    expect(calc.cellNumber("NINGBO")).toBeNull();
    // Célula numérica do Excel: ponto decimal, sem milhar.
    expect(calc.cellNumber("5.0569")).toBe(5.0569);
    expect(calc.cellNumber("1,5")).toBe(1.5);
  });
});

describe("CSV do Sankhya (AD_FREINT)", () => {
  const data = calc.parseFreightTariff(workbook());

  it("igual ao da macro: rota direta (sem ela, a longa), IDs e vírgula decimal", () => {
    expect(calc.excelSerial("2026-10-14")).toBe(46309);
    const csv = calc.sankhyaCsv(data, "2026-10-14");
    expect(csv.charCodeAt(0)).toBe("A".charCodeAt(0)); // sem BOM
    expect(csv.split("\r\n")).toEqual([
      "AD_IDEXTERNO;CODPARC;DTREFERENCIA;IDDEST;IDORIG;SEQCONTAI;VALOR;TAXA_USD;TAXA_BRL",
      "1114630945;111;14/10/2026;60;45;3;3000;60,5;1400",
      "2224630945;222;14/10/2026;60;45;3;4000;10;900",
      // MUNDRA (99); SHENZHEN e QINGDAO sem ID e GAMA sem código ficam de fora.
      "2224630999;222;14/10/2026;60;99;3;5000;10;900",
      "2224630945;222;14/10/2026;5;45;3;3900;60,5;1400",
    ]);
    // Como a macro: sem quebra de linha depois da última.
    expect(csv.endsWith("\r\n")).toBe(false);
  });
});

describe("frete por m³ e opções do pedido", () => {
  const data = calc.parseFreightTariff(workbook());

  it("mediana do menor custo por porto ÷ capacidade do container", () => {
    // Menores: QINGDAO 11.200, NINGBO 18.008,55, SHENZHEN 20.558,55, MUNDRA 27.451.
    expect(calc.perCbmSuggestion(data, "NVT", 68)).toEqual({
      perCbm: 283.58,
      ports: 4,
      containerBrl: 19283.55,
    });
    expect(calc.perCbmSuggestion(data, "XXX", 68)).toBeNull();
  });

  it("porto de origem achado no local do fornecedor", () => {
    expect(calc.matchOrigin(data, "Ningbo, Zhejiang")).toBe("NINGBO");
    expect(calc.matchOrigin(data, "Shenzhen city")).toBe("SHENZHEN");
    expect(calc.matchOrigin(data, "Yiwu")).toBeNull();
    expect(calc.matchOrigin(data, null)).toBeNull();
    const options = calc.optionsForOrigin(data, "NINGBO");
    expect(
      options.map((o) => [o.forwarder, o.destinationCode, o.totalBrl]),
    ).toEqual([
      ["ALFA LINES", "NVT", 18008.55],
      ["BETA CARGO", "NVT", 22351],
      ["BETA CARGO", "ITJ", 3900 * 5.1 + 1000 + 1708.55],
    ]);
  });
});

describe("leitor de planilha: posição exata", () => {
  it("linha vazia gravada como <row/> não desloca as outras", () => {
    const bytes = xlsxFile([nvt()]);
    const { cells } = readCells(bytes, "COMPARATIVO - NVT");
    expect(cells[2][3]).toBe("ALFA LINES");
    expect(cells[3][2]).toBe("PORTOS");
    expect(cells[4][2]).toBe("NINGBO");
    expect(cells[4][3]).toBe("3000");
    expect(cells[9][1]).toBe("#VALUE!");
    expect(() => readCells(bytes, "OUTRA")).toThrow("xlsx_sheet_missing");
    // O leitor antigo continua igual (linhas vazias fora).
    expect(readGrid(bytes, "COMPARATIVO - NVT").grid[0][3]).toBe(
      "ESTIMATIVA DE FRETES - ROTAS NAVEGANTES",
    );
  });
});

describe("importar e usar o tarifário", () => {
  let admin: User;
  let operator: User;
  let customer: User;
  let shippingLine: User;

  beforeAll(async () => {
    const { users } = await seedDemo();
    admin = users.find((u) => u.email === "admin@wellmix.com")!;
    operator = users.find((u) => u.email === "operador@wellmix.com")!;
    customer = users.find((u) => u.email === "joao@lojista.com")!;
    shippingLine = users.find((u) => u.email === "armador@maritima.com")!;
  });

  it("Wellmix importa; o novo vira o vigente e o anterior vai para o histórico", async () => {
    const bytes = xlsxFile(workbook(), [
      // Macro da planilha: ignorada (nunca executada).
      ["xl/vbaProject.bin", 'Attribute VB_Name = "ModFretesCSV_V4"'],
    ]);
    const first = await service.importFreightTariff(
      operator,
      file(bytes),
      "2026-10-14",
    );
    expect(first).toMatchObject({
      status: "active",
      referenceDate: "2026-10-14",
      rateCount: 6,
      forwarderCount: 3,
      fx: 5.1,
      roadFreightBrl: 1000,
    });
    // Planilha original guardada como documento interno.
    const doc = await getStore().get("documents", first.fileDocumentId!);
    expect(doc?.visibility).toBe("internal");
    expect(await canAccessDocument(customer, doc!)).toBe(false);
    expect(await canAccessDocument(shippingLine, doc!)).toBe(false);

    const second = await service.importFreightTariff(admin, file(bytes), null);
    expect((await service.currentFreightTariff(admin))?.id).toBe(second.id);
    expect((await getStore().get("freight_tariffs", first.id))?.status).toBe(
      "replaced",
    );
    expect(second.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const history = await service.listFreightTariffs(admin);
    expect(history.map((h) => h.id)).toEqual([second.id, first.id]);
    const audits = await getStore().list("audit_log", {
      filter: { entity: "freight_tariff" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it("companhia marítima, cliente e fornecedor não importam nem veem (tarifas de todas as companhias)", async () => {
    const bytes = xlsxFile(workbook());
    const orderRef = { id: "qualquer", shippingLineId: null };
    for (const u of [shippingLine, customer]) {
      await expect(
        service.importFreightTariff(u, file(bytes), null),
      ).rejects.toThrow("forbidden");
      await expect(service.currentFreightTariff(u)).rejects.toThrow(
        "forbidden",
      );
      await expect(service.listFreightTariffs(u)).rejects.toThrow("forbidden");
      await expect(service.orderTariffView(u, orderRef)).rejects.toThrow(
        "forbidden",
      );
    }
  });

  it("arquivo errado: .xls antigo, não planilha, grande demais", async () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]);
    await expect(
      service.importFreightTariff(admin, file(xls, "frete.xls"), null),
    ).rejects.toThrow("tariff_xls");
    await expect(
      service.importFreightTariff(
        admin,
        file(new TextEncoder().encode("oi"), "frete.xlsx"),
        null,
      ),
    ).rejects.toThrow("tariff_invalid");
    const big = new Uint8Array(service.MAX_TARIFF_BYTES + 1);
    big[0] = 0x50;
    big[1] = 0x4b;
    await expect(
      service.importFreightTariff(admin, file(big), null),
    ).rejects.toThrow("tariff_too_large");
    await expect(
      service.importFreightTariff(admin, file(xlsxFile([portos()])), null),
    ).rejects.toThrow("tariff_no_sheets");
  });

  it("frete por m³ do tarifário nas Configurações: só o admin", async () => {
    const tariff = (await service.currentFreightTariff(admin))!;
    await expect(
      service.applyTariffPerCbm(operator, tariff.id, "NVT"),
    ).rejects.toThrow("forbidden");
    const capacity = await service.tariffContainerCapacity();
    expect(capacity).toBe(68);
    const value = await service.applyTariffPerCbm(admin, tariff.id, "NVT");
    expect(value).toBe(283.58);
    const settings = await getSettings();
    expect(settings.freightPerCbm).toBe(283.58);
    expect(settings.freightCurrency).toBe("BRL");
    await expect(
      service.applyTariffPerCbm(admin, tariff.id, "XYZ"),
    ).rejects.toThrow("tariff_no_suggestion");
  });

  it("pedido: rota pelo local do fornecedor na ficha; companhia do pedido marcada", async () => {
    const store = getStore();
    const order = (id: string, shippingLineId: string | null = null) => ({
      id,
      shippingLineId,
    });
    expect(
      await service.orderTariffView(admin, order("pedido-sem-ficha")),
    ).toMatchObject({ location: null, origin: null, options: [] });
    await store.create("purchase_sheets", {
      orderId: "pedido-ningbo",
      location: "Ningbo, Zhejiang",
    } as never);
    const beta = await store.create("parties", {
      type: "shipping_line",
      name: "Beta Cargo",
      active: true,
    } as never);
    const view = await service.orderTariffView(
      admin,
      order("pedido-ningbo", beta.id),
    );
    expect(view?.origin).toBe("NINGBO");
    expect(
      view?.options.map((o) => [o.forwarder, o.destinationCode, o.assigned]),
    ).toEqual([
      ["ALFA LINES", "NVT", false],
      ["BETA CARGO", "NVT", true],
      ["BETA CARGO", "ITJ", true],
    ]);
    await store.create("purchase_sheets", {
      orderId: "pedido-yiwu",
      location: "Yiwu",
    } as never);
    const yiwu = await service.orderTariffView(admin, order("pedido-yiwu"));
    expect(yiwu).toMatchObject({
      location: "Yiwu",
      matchedOrigin: null,
      origin: null,
      options: [],
    });
    // Fornecedor em Yiwu embarca por Ningbo: a Wellmix escolhe o porto.
    expect(yiwu?.origins).toEqual(["MUNDRA", "NINGBO", "QINGDAO", "SHENZHEN"]);
    const picked = await service.orderTariffView(
      admin,
      order("pedido-yiwu"),
      "ningbo",
    );
    expect(picked?.origin).toBe("NINGBO");
    expect(picked?.options[0].totalBrl).toBe(18008.55);
    // Porto que não está no tarifário: ignorado.
    expect(
      (await service.orderTariffView(admin, order("pedido-yiwu"), "XPTO"))
        ?.origin,
    ).toBeNull();
  });
});

describe("cartão Embarque: botão de importar e frete da rota", () => {
  it("sem tarifário, sem local, sem porto e com opções", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { FreightTariffBox } =
      await import("@/components/freight-tariff-box");
    const { translator } = await import("@/i18n");
    const t = translator("pt");
    const render = (view: Parameters<typeof FreightTariffBox>[0]["view"]) =>
      renderToStaticMarkup(
        createElement(FreightTariffBox, {
          t,
          orderId: "o1",
          stageId: "s1",
          view,
        }),
      );
    const none = render(null);
    expect(none).toContain("Importar planilha da companhia marítima");
    expect(none).toContain(
      'href="/app/freight/tariff?from=%2Fapp%2Forders%2Fo1"',
    );
    expect(none).toContain("Nenhum tarifário importado ainda");
    expect(render("failed")).toContain("não pôde ser lido agora");
    const base = {
      tariffId: "t1",
      referenceDate: "2026-10-14",
      location: null,
      matchedOrigin: null,
      origin: null,
      origins: ["NINGBO", "SHENZHEN"],
      selectedOrigin: null,
      options: [],
    };
    const noLocation = render(base);
    expect(noLocation).toContain("não tem o local do fornecedor");
    // Escolher o porto à mão: formulário GET no próprio pedido.
    expect(noLocation).toContain('action="/app/orders/o1#stage-s1"');
    expect(noLocation).toContain('name="tariffOrigin"');
    expect(render({ ...base, location: "Yiwu" })).toContain(
      "(&quot;Yiwu&quot;) não é um porto do tarifário",
    );
    const data = calc.parseFreightTariff(workbook());
    const html = render({
      ...base,
      location: "Ningbo",
      origin: "NINGBO",
      options: calc
        .optionsForOrigin(data, "NINGBO")
        .map((o) => ({ ...o, assigned: o.forwarder === "BETA CARGO" })),
    });
    expect(html).toContain("Tarifário de 14/10/2026 · origem NINGBO");
    expect(html).toContain("ALFA LINES → NAVEGANTES");
    expect(html).toMatch(/R\$\s18\.008,55/);
    expect(html).toContain("companhia do pedido");
    expect(html).toContain("prazo 120 dias");
    // A companhia do pedido aparece mesmo fora das 4 mais baratas.
    const many = Array.from({ length: 6 }, (_, i) => ({
      destination: "NAVEGANTES",
      destinationCode: "NVT",
      origin: "NINGBO",
      forwarder: `CIA ${i + 1}`,
      route: "direct" as const,
      oceanUsd: 1000 + i,
      totalBrl: 10000 + i,
      paymentTermDays: null,
      containerQty: 2,
      assigned: i === 5,
    }));
    const longList = render({ ...base, origin: "NINGBO", options: many });
    expect(longList).toContain("CIA 4 → NAVEGANTES");
    expect(longList).not.toContain("CIA 5 → NAVEGANTES");
    expect(longList).toContain("CIA 6 → NAVEGANTES");
    expect(longList).toContain("2 × 40HQ");
    // Os campos do embarque continuam: o tarifário não traz data, navio nem BL.
    expect(html).toContain("continuam abaixo");
  });
});

describe("revisão: parâmetros por aba, linhas de total, destinos e locais", () => {
  it("cada aba usa o próprio frete até o CD (e câmbio), como as fórmulas", () => {
    const other = itj();
    other.cells[11][2] = "1500"; // ITJ!C12 (FRETE (CD))
    const data = calc.parseFreightTariff([
      nvt(),
      other,
      fornecedores(),
      portos(),
    ]);
    const [nav, ita] = data.destinations;
    expect(nav.roadFreightBrl).toBe(1000);
    expect(ita.roadFreightBrl).toBe(1500);
    // 3900 × 5,1 + 1500 + taxas copiadas (1708,55).
    expect(ita.rates[0].totalBrl).toBe(23098.55);
    expect(data.warnings.map((w) => w.code)).not.toContain("params_differ");
    // Câmbio diferente entre abas: aviso para conferir.
    const fx = itj();
    fx.cells[10][2] = "5.3";
    const withFx = calc.parseFreightTariff([nvt(), fx, portos()]);
    expect(withFx.destinations[1].fx).toBe(5.3);
    expect(withFx.warnings).toContainEqual({
      code: "params_differ",
      params: {
        sheet: "COMPARATIVO - ITJ",
        first: "COMPARATIVO - NVT",
        fx: 5.3,
        firstFx: 5.1,
      },
    });
  });

  it("linha de totais com erro: não lê a linha de baixo; usa a soma e avisa", () => {
    const sheet = nvt();
    sheet.cells[14][5] = "#REF!"; // F15
    sheet.cells[14][6] = "";
    // Linha "TOTAIS TAXAS (BRL)" abaixo, como na planilha modelo.
    sheet.cells.push([]);
    sheet.cells[18] = ["", "", "", "TOTAIS TAXAS (BRL)", "", "2949.79"];
    const data = calc.parseFreightTariff([sheet, portos(), fornecedores()]);
    const alfa = data.destinations[0].forwarders[0];
    expect(alfa.feesUsd).toBe(60.5);
    expect(alfa.feesBrl).toBe(1400);
    expect(data.warnings).toContainEqual({
      code: "cell_error",
      params: { sheet: "COMPARATIVO - NVT", cell: "F15" },
    });
  });

  it("destino fora da aba PORTOS usa o ID fixo da macro; destino desconhecido avisa", () => {
    const semDestinos = portos();
    semDestinos.cells = semDestinos.cells.filter(
      (r) => r[1] !== "NAVEGANTES" && r[1] !== "ITAJAÍ",
    );
    const data = calc.parseFreightTariff([nvt(), itj(), semDestinos]);
    expect(data.destinations.map((d) => d.portId)).toEqual([60, 5]);
    expect(data.warnings).toContainEqual({
      code: "destination_fixed_id",
      params: { port: "NAVEGANTES", id: 60 },
    });
    const ssa = { ...itj(), name: "COMPARATIVO - SSA" };
    const other = calc.parseFreightTariff([nvt(), ssa, portos()]);
    expect(other.warnings).toContainEqual({
      code: "port_no_id",
      params: { port: "SSA" },
    });
  });

  it("nome da aba com travessão ou minúsculas, como a macro aceita", () => {
    expect(calc.destinationCode("Comparativo – nvt")).toBe("NVT");
    expect(calc.destinationCode("COMPARATIVO — IOA")).toBe("IOA");
    expect(calc.destinationCode("COMPARATIVO - NVT X IOA")).toBeNull();
  });

  it("CSV na ordem da macro: NVT, IOA, ITJ", () => {
    const ioa = { ...itj(), name: "COMPARATIVO - IOA" };
    const ports = portos();
    ports.cells.push(["44", "ITAPOÁ"]);
    const data = calc.parseFreightTariff([
      nvt(),
      itj(),
      ioa,
      ports,
      fornecedores(),
    ]);
    const dests = calc.sankhyaRows(data, "2026-10-14").map((r) => r.destId);
    expect([...new Set(dests)]).toEqual([60, 44, 5]);
  });

  it("dica de nome parecido só quando é mesmo parecido (NANTONG ≠ NANJING)", () => {
    const sheet = nvt();
    sheet.cells[5][2] = "NANTONG"; // no lugar de SHENZHEN
    const ports = portos();
    ports.cells.push(["66", "NANJING"]);
    const data = calc.parseFreightTariff([sheet, ports]);
    expect(data.warnings).toContainEqual({
      code: "port_no_id",
      params: { port: "NANTONG" },
    });
  });

  it("local em chinês, com espaço a mais ou nome de rua", () => {
    const data = calc.parseFreightTariff(workbook());
    expect(calc.matchOrigin(data, "浙江宁波北仑")).toBe("NINGBO");
    expect(calc.matchOrigin(data, "深圳")).toBe("SHENZHEN");
    expect(calc.matchOrigin(data, "Ning Bo")).toBe("NINGBO");
    expect(calc.matchOrigin(data, "Qingdao Road 18, Ningbo")).toBe("NINGBO");
    expect(calc.matchOrigin(data, "No. 18 Qingdao Rd, Yiwu")).toBeNull();
    expect(calc.matchOrigin(data, "宁波路 18号, 义乌")).toBeNull();
  });

  it('número digitado como texto com ponto de milhar ("3.618")', () => {
    expect(calc.cellNumber("3.618", true)).toBe(3618);
    expect(calc.cellNumber("3.618")).toBe(3.618);
    expect(calc.cellNumber("5.0569", true)).toBe(5.0569);
  });
});

describe("revisão: arquivo malicioso ou protegido", () => {
  it("planilha que descompacta demais é recusada", async () => {
    const { deflateRawSync } = await import("node:zlib");
    const big = new Uint8Array(60 * 1024 * 1024);
    // Parte que vira 60 MB descompactada (teto da planilha de frete: 50 MB).
    const deflated = deflateRawSync(big);
    expect(deflated.length).toBeLessThan(200_000);
    const { openWorkbook } = await import("@/lib/services/xlsx");
    const zip = zipWithDeflated([
      [
        "xl/workbook.xml",
        '<workbook><sheets><sheet name="COMPARATIVO - NVT" sheetId="1" r:id="rId1"/></sheets></workbook>',
        false,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        false,
      ],
      ["xl/worksheets/sheet1.xml", deflated, true],
    ]);
    const wb = openWorkbook(zip, { maxTotalBytes: 50 * 1024 * 1024 });
    expect(() => wb.readCells("COMPARATIVO - NVT")).toThrow("xlsx_too_large");
    expect(() => service.readTariffWorkbook(zip, "frete.xlsx")).toThrow(
      "tariff_too_large",
    );
  });

  it("XML com milhares de tags sem fechar é lido rápido (sem travar o servidor)", () => {
    const xml = `<?xml version="1.0"?><worksheet><sheetData><row r="1">${'<c r="A1">'.repeat(40000)}</row></sheetData></worksheet>`;
    const zip = zipWithDeflated([
      [
        "xl/workbook.xml",
        '<workbook><sheets><sheet name="X" sheetId="1" r:id="rId1"/></sheets></workbook>',
        false,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        false,
      ],
      ["xl/worksheets/sheet1.xml", xml, false],
    ]);
    const started = performance.now();
    expect(readCells(zip, "X").cells).toEqual([]);
    expect(readGrid(zip, "X").grid).toEqual([]);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it(".xlsx protegido por senha tem mensagem própria", () => {
    const ole = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    expect(() => service.readTariffWorkbook(ole, "frete.xlsm")).toThrow(
      "tariff_encrypted",
    );
    expect(() => service.readTariffWorkbook(ole, "frete.xls")).toThrow(
      "tariff_xls",
    );
  });
});

/** ZIP com partes guardadas (texto) ou já comprimidas (deflate). */
function zipWithDeflated(
  files: Array<[string, string | Uint8Array, boolean]>,
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content, deflated] of files) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content;
    const method = deflated ? 8 : 0;
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
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

describe("revisão 2: leitura em tempo linear, textos enormes, legado e endereços", () => {
  const zipOf = (parts: Array<[string, string]>) =>
    zipWithDeflated(parts.map(([n, c]) => [n, c, false]));
  const rels =
    '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
  const wb =
    '<workbook><sheets><sheet name="COMPARATIVO - NVT" sheetId="1" r:id="rId1"/></sheets></workbook>';

  it("milhares de <sheet / <Relationship / <v> sem fechar não travam", () => {
    const started = performance.now();
    const many = zipOf([
      ["xl/workbook.xml", `<workbook><sheets>${"<sheet ".repeat(20000)}`],
      [
        "xl/_rels/workbook.xml.rels",
        `<Relationships>${"<Relationship ".repeat(20000)}`,
      ],
      ["xl/worksheets/sheet1.xml", "<worksheet/>"],
    ]);
    expect(() => readGrid(many)).toThrow();
    const cell = zipOf([
      ["xl/workbook.xml", wb],
      ["xl/_rels/workbook.xml.rels", rels],
      [
        "xl/worksheets/sheet1.xml",
        `<worksheet><sheetData><row r="1"><c r="A1">${"<v>".repeat(40000)}</c></row></sheetData></worksheet>`,
      ],
    ]);
    expect(readCells(cell, "COMPARATIVO - NVT").cells).toEqual([]);
    expect(performance.now() - started).toBeLessThan(800);
  });

  it("texto enorme repetido em muitas células é cortado e lido rápido", () => {
    const huge = "a".repeat(1_000_000);
    const cells = Array.from(
      { length: 400 },
      (_, i) => `<c r="${"D"}${i + 5}" t="s"><v>0</v></c>`,
    ).join("");
    const zip = zipOf([
      ["xl/workbook.xml", wb],
      ["xl/_rels/workbook.xml.rels", rels],
      ["xl/sharedStrings.xml", `<sst><si><t>${huge}</t></si></sst>`],
      [
        "xl/worksheets/sheet1.xml",
        `<worksheet><sheetData><row r="5">${cells}</row></sheetData></worksheet>`,
      ],
    ]);
    const started = performance.now();
    const sheet = readCells(zip, "COMPARATIVO - NVT");
    expect(sheet.cells[4][3].length).toBe(1000);
    expect(() => calc.parseFreightTariff([sheet])).toThrow("tariff_no_sheets");
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it("importação comum: coluna além do limite é ignorada (sem estourar a memória)", () => {
    const zip = zipOf([
      ["xl/workbook.xml", wb],
      ["xl/_rels/workbook.xml.rels", rels],
      [
        "xl/worksheets/sheet1.xml",
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>SKU</t></is></c><c r="ZZZZ1" t="inlineStr"><is><t>x</t></is></c><c r="ZZ1" t="inlineStr"><is><t>y</t></is></c></row></sheetData></worksheet>',
      ],
    ]);
    const { grid } = readGrid(zip);
    expect(grid[0]).toEqual(["SKU"]);
  });

  it("tarifário gravado sem os parâmetros por aba: nada de NaN", () => {
    const data = calc.parseFreightTariff(workbook());
    const legacy = JSON.parse(JSON.stringify(data));
    for (const d of legacy.destinations) {
      delete d.fx;
      delete d.roadFreightBrl;
      delete d.containerQty;
    }
    calc.normalizeTariffData(legacy);
    expect(calc.perCbmSuggestion(legacy, "NVT", 68)?.perCbm).toBe(283.58);
    expect(calc.optionsForOrigin(legacy, "NINGBO")[0].containerQty).toBe(1);
  });

  it("câmbio com erro numa aba e containers diferentes: avisos", () => {
    const fx = itj();
    fx.cells[9][2] = "#REF!";
    fx.cells[10][2] = "#REF!";
    fx.cells[12][2] = "2";
    const data = calc.parseFreightTariff([nvt(), fx, portos()]);
    expect(data.warnings).toContainEqual({
      code: "fx_missing",
      params: { sheet: "COMPARATIVO - ITJ", fx: 5.1 },
    });
    expect(data.warnings).toContainEqual({
      code: "containers_differ",
      params: {
        sheet: "COMPARATIVO - ITJ",
        first: "COMPARATIVO - NVT",
        n: 2,
        firstN: 1,
      },
    });
    // Comparação por container: 2 × 40HQ não parece "mais caro" só pela quantidade.
    const options = calc.optionsForOrigin(data, "NINGBO");
    const perContainer = options.map((o) => o.totalBrl / o.containerQty);
    expect([...perContainer].sort((a, b) => a - b)).toEqual(perContainer);
  });

  it("endereço chinês: cidade antes da rua; rua com direção não conta", () => {
    const data = calc.parseFreightTariff([
      {
        ...nvt(),
        cells: (() => {
          const c = nvt().cells;
          c[5][2] = "SHANGHAI";
          c[6][2] = "NANJING";
          return c;
        })(),
      },
    ]);
    expect(calc.matchOrigin(data, "上海市静安区南京西路1266号")).toBe(
      "SHANGHAI",
    );
    expect(
      calc.matchOrigin(data, "Shanghai Shi Huangpu Qu Nanjing Dong Lu 100"),
    ).toBe("SHANGHAI");
    expect(calc.matchOrigin(data, "南京市玄武区")).toBe("NANJING");
    expect(calc.matchOrigin(data, "Nanshan District, Shenzhen")).toBeNull();
  });

  it("porto achado sem tarifa: a lista não escolhe outro sozinha", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { FreightTariffBox } =
      await import("@/components/freight-tariff-box");
    const { translator } = await import("@/i18n");
    const html = renderToStaticMarkup(
      createElement(FreightTariffBox, {
        t: translator("pt"),
        orderId: "o1",
        stageId: "s1",
        keepParams: { remeasure: "1" },
        view: {
          tariffId: "t1",
          referenceDate: "2026-10-14",
          location: "Mumbai, India",
          matchedOrigin: "MUMBAI",
          origin: "MUMBAI",
          origins: ["ALEXANDRIA", "NINGBO"],
          selectedOrigin: null,
          options: [],
        },
      }),
    );
    expect(html).toContain("Sem tarifas para MUMBAI");
    expect(html).toContain('<option value="" selected="">—</option>');
    expect(html).toContain('name="remeasure" value="1"');
  });
});

describe("revisão 3: porto do distrito, nomes colados, aspas e container", () => {
  const ports = (names: string[]) => {
    const c = nvt().cells;
    names.forEach((n, i) => {
      c[4 + i] = [...(c[4 + i] ?? [])];
      c[4 + i][2] = n;
      c[4 + i][3] = String(3000 + i);
    });
    return calc.parseFreightTariff([{ name: "COMPARATIVO - NVT", cells: c }]);
  };

  it("vale o último porto que não é rua (distrito do porto, endereço bilíngue)", () => {
    const data = ports(["GUANGZHOU", "NANSHA", "SHENZHEN", "YANTIAN"]);
    expect(calc.matchOrigin(data, "广州市南沙区")).toBe("NANSHA");
    expect(calc.matchOrigin(data, "深圳盐田港")).toBe("YANTIAN");
    expect(calc.matchOrigin(data, "Guangzhou 广州, port Nansha")).toBe(
      "NANSHA",
    );
    expect(calc.matchOrigin(data, "广州市海珠区新港西路135号")).toBe(
      "GUANGZHOU",
    );
  });

  it("nome colado a outro lugar não é o porto (黑龙江门, 河南通许)", () => {
    const data = ports(["JIANGMEN", "NANTONG", "XIAMEN", "NINGBO"]);
    expect(calc.matchOrigin(data, "黑龙江门业有限公司")).toBeNull();
    expect(calc.matchOrigin(data, "福建晋江门业, 厦门港")).toBe("XIAMEN");
    expect(calc.matchOrigin(data, "河南通许 宁波港")).toBe("NINGBO");
    expect(calc.matchOrigin(data, "江门市蓬江区")).toBe("JIANGMEN");
  });

  it("grafia latina com final colado (NingboCity, Xiamenshi)", () => {
    const data = ports(["NINGBO", "XIAMEN", "NANSHA"]);
    expect(calc.matchOrigin(data, "NINGBOCITY")).toBe("NINGBO");
    expect(calc.matchOrigin(data, "Xiamenshi")).toBe("XIAMEN");
    expect(calc.matchOrigin(data, "Nanshan District")).toBeNull();
  });

  it("aba com '>' no nome (XML válido) não esconde as outras", () => {
    const zip = zipWithDeflated([
      [
        "xl/workbook.xml",
        '<workbook><sheets><sheet name="A>B" sheetId="1" r:id="rId1"/><sheet name="C" sheetId="2" r:id="rId2"/></sheets></workbook>',
        false,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
        false,
      ],
      ["xl/worksheets/sheet1.xml", "<worksheet/>", false],
      [
        "xl/worksheets/sheet2.xml",
        `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve">It's ok</t></is></c></row></sheetData></worksheet>`,
        false,
      ],
    ]);
    expect(readGrid(zip, "C").grid).toEqual([["It's ok"]]);
  });

  it("planilha grande e normal continua rápida (importações e tabela fiscal)", () => {
    const rows = Array.from(
      { length: 20000 },
      (_, r) =>
        `<row r="${r + 1}">${Array.from(
          { length: 6 },
          (_, c) =>
            `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>v${r}-${c}</t></is></c>`,
        ).join("")}</row>`,
    ).join("");
    const zip = zipWithDeflated([
      [
        "xl/workbook.xml",
        '<workbook><sheets><sheet name="TIPI" sheetId="1" r:id="rId1"/></sheets></workbook>',
        false,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        false,
      ],
      [
        "xl/worksheets/sheet1.xml",
        `<worksheet><sheetData>${rows}</sheetData></worksheet>`,
        false,
      ],
    ]);
    const started = performance.now();
    const { grid } = readGrid(zip, "TIPI", 30000);
    expect(grid.length).toBe(20000);
    expect(grid[19999][5]).toBe("v19999-5");
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("cartão Embarque: com mais de um container, mostra o valor por container", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { FreightTariffBox } =
      await import("@/components/freight-tariff-box");
    const { translator } = await import("@/i18n");
    const html = renderToStaticMarkup(
      createElement(FreightTariffBox, {
        t: translator("pt"),
        orderId: "o1",
        stageId: "s1",
        view: {
          tariffId: "t1",
          referenceDate: "2026-10-14",
          location: "Ningbo",
          matchedOrigin: "NINGBO",
          origin: "NINGBO",
          origins: ["NINGBO"],
          selectedOrigin: "NINGBO",
          options: [
            {
              destination: "ITAJAÍ",
              destinationCode: "ITJ",
              origin: "NINGBO",
              forwarder: "CIA",
              route: "direct",
              oceanUsd: 2000,
              totalBrl: 40000,
              paymentTermDays: 90,
              containerQty: 2,
              assigned: false,
            },
          ],
        },
      }),
    );
    expect(html).toMatch(/R\$\s20\.000,00 por container/);
  });
});
