import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/* Tributos da importação: tabela TEC/TIPI, NCM da solicitação e custo importado. */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { setSetting } = await import("@/lib/settings");
const { priceToCustomer } = await import("@/lib/pricing");
const fiscal = await import("@/lib/fiscal");
const fs = await import("@/lib/services/fiscal");
const rn = await import("@/lib/services/request-ncm");
const r = await import("@/lib/services/requests");
const qs = await import("@/lib/services/quote-sheet");
const { quotePricing } = await import("@/lib/services/quote-pricing");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
let supplierA: User;

const fx = {
  rates: { USD: 5 },
  status: "manual" as const,
  day: null,
  quotedAt: {},
  source: null,
  lastError: null,
};

/** 600 NCMs sintéticos + os usados nos testes (vidro e smartphone). */
function tecCsv(overrides: Record<string, string> = {}) {
  const rows = ["Tarifa Externa Comum - Brasil", "", "NCM;DESCRIÇÃO;TEC (%)"];
  for (let i = 0; i < 600; i++) {
    const ncm = String(10000000 + i * 7);
    rows.push(
      `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)};Item ${i};${i % 20}`,
    );
  }
  rows.push(
    `7013.37.00;Outros objetos de vidro;${overrides["70133700"] ?? "18"}`,
  );
  rows.push("8517.13.00;Smartphones;16");
  return new TextEncoder().encode(rows.join("\n"));
}
function tipiCsv() {
  const rows = ["TIPI", "NCM;EX;DESCRIÇÃO;ALÍQUOTA (%)"];
  for (let i = 0; i < 600; i++) {
    const ncm = String(10000000 + i * 7);
    rows.push(`${ncm};;Item ${i};${i % 3 === 0 ? "NT" : "5"}`);
  }
  rows.push("7013.37.00;;-- Outros;9,75");
  rows.push(";01;Ex 01 - de cristal;20");
  rows.push("8517.13.00;;-- Smartphones;15");
  return new TextEncoder().encode(rows.join("\n"));
}

/** XLSX mínimo (ZIP sem compressão) com células de texto em linha. */
function xlsx(rows: string[][]) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map(
            (v, ci) =>
              `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;
  const files: Array<[string, string]> = [
    [
      "xl/workbook.xml",
      '<workbook><sheets><sheet name="TEC" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ],
    ["xl/worksheets/sheet1.xml", sheet],
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

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  supplierA = users.find((u) => u.email === "supplier.a@china.com")!;
  await setSetting("aiMode", "MANUAL");
});

describe("leitura da TEC e da TIPI", () => {
  it("acha o cabeçalho abaixo dos títulos, ignora Ex e lê NT", () => {
    const tec = fiscal.parseFiscalFile(tecCsv(), "tec");
    expect(tec.find((e) => e.ncm === "70133700")).toMatchObject({
      rate: 18,
      description: "Outros objetos de vidro",
    });
    const tipi = fiscal.parseFiscalFile(tipiCsv(), "tipi");
    expect(tipi.find((e) => e.ncm === "70133700")?.rate).toBe(9.75);
    expect(tipi.find((e) => e.ncm === "10000000")).toMatchObject({
      rate: 0,
      nt: true,
    });
    // A linha "Ex 01" (20%) não substitui a alíquota do NCM.
    expect(tipi.filter((e) => e.ncm === "70133700")).toHaveLength(1);
  });

  it("lê XLSX e converte porcentagem em fração (0,18 → 18%)", () => {
    const rows = [
      ["TARIFA EXTERNA COMUM"],
      ["NCM", "Descrição", "TEC %"],
      ["7013.37.00", "Outros", "0.18"],
      ["8517.13.00", "Smartphones", "0.16"],
    ];
    const entries = fiscal.parseFiscalFile(xlsx(rows), "tec");
    expect(entries).toEqual([
      { ncm: "70133700", description: "Outros", rate: 18, nt: false },
      { ncm: "85171300", description: "Smartphones", rate: 16, nt: false },
    ]);
  });
});

describe("tabela fiscal", () => {
  it("carrega TEC e TIPI separadas, conta mudanças e recusa arquivo errado", async () => {
    await expect(
      fs.importFiscalFile(
        admin,
        "tec",
        new TextEncoder().encode("NCM;TEC\n7013.37.00;18"),
        "pouco.csv",
        "upload",
      ),
    ).rejects.toThrow("fiscal_unrecognized");
    const tec = await fs.importFiscalFile(
      admin,
      "tec",
      tecCsv(),
      "tec.csv",
      "upload",
    );
    expect(tec.count).toBe(602);
    await fs.importFiscalFile(admin, "tipi", tipiCsv(), "tipi.csv", "upload");
    expect(await fs.lookupNcm("7013.37.00")).toEqual({
      ncm: "70133700",
      description: "Outros objetos de vidro",
      ii: 18,
      ipi: 9.75,
      ipiNt: false,
    });
    // Nova TEC: só a alíquota do vidro mudou; a TIPI continua.
    const again = await fs.importFiscalFile(
      admin,
      "tec",
      tecCsv({ "70133700": "20" }),
      "tec.csv",
      "upload",
    );
    expect(again.changed).toBe(1);
    expect(await fs.lookupNcm("70133700")).toMatchObject({ ii: 20, ipi: 9.75 });
    const status = await fs.fiscalStatus();
    expect(status.tec?.count).toBe(602);
    expect(status.stale).toBe(false);
    expect(
      (await fs.fiscalStatus(new Date(Date.now() + 100 * 86_400_000))).stale,
    ).toBe(true);
  });

  it("robô: baixa pelos links; falha guarda o motivo e avisa a Wellmix", async () => {
    await setSetting("fiscalTecUrl", "https://exemplo.gov.br/tec.csv");
    await setSetting("fiscalTipiUrl", "https://exemplo.gov.br/tipi.xlsx");
    const fetcher = async (url: RequestInfo | URL) =>
      String(url).includes("tec")
        ? new Response(tecCsv({ "70133700": "18" }), { status: 200 })
        : new Response("forbidden", { status: 403 });
    const r1 = await fs.syncFiscalTables(null, fetcher as typeof fetch);
    expect(r1.results.find((x) => x.kind === "tec")).toMatchObject({
      ok: true,
      changed: 1,
    });
    expect(r1.lastError).toBe("TIPI: http 403");
    expect((await fs.fiscalStatus()).tec?.source).toBe("robot");
    const notes = await getStore().list("notifications", {
      filter: { userId: admin.id },
    });
    expect(notes.some((n) => n.link === "/app/settings#fiscal")).toBe(true);
    expect((await fs.lookupNcm("70133700"))?.ii).toBe(18);
  });
});

describe("custo importado com tributos", () => {
  it("valor aduaneiro + II + IPI + PIS + COFINS + ICMS por dentro", () => {
    const r = priceToCustomer({
      unitPrice: 10,
      currency: "USD",
      quantity: 1000,
      totalCbm: null,
      importTaxPercent: 20,
      ipiPercent: 10,
      insurancePercent: 1,
      pisPercent: 2.1,
      cofinsPercent: 9.65,
      icmsPercent: 18,
      marginPercent: 0,
      fx: { USD: 5 },
      freight: { carrierBrl: 1000 },
    });
    expect(r.insuranceBrl).toBe(500);
    expect(r.cifBrl).toBe(51500);
    expect(r.importTaxBrl).toBe(10300);
    expect(r.ipiBrl).toBe(6180);
    expect(r.pisBrl).toBe(1081.5);
    expect(r.cofinsBrl).toBe(4969.75);
    // (51.500 + 10.300 + 6.180 + 1.081,50 + 4.969,75) ÷ 0,82 × 0,18
    expect(r.icmsBrl).toBe(16250.76);
    expect(r.landedBrl).toBe(90282.01);
    expect(r.missing).toEqual([]);
    // ICMS não configurado: aviso; registros antigos (sem os campos) não avisam.
    const noIcms = priceToCustomer({
      unitPrice: 1,
      currency: "BRL",
      quantity: 1,
      totalCbm: null,
      importTaxPercent: 0,
      ipiPercent: 0,
      icmsPercent: null,
      marginPercent: 0,
      fx: {},
      freight: { carrierBrl: 1 },
    });
    expect(noIcms.missing).toEqual(["icms"]);
  });
});

async function newRequest(productId: string | null, name = "Jarra de vidro") {
  return r.createRequest(joao, {
    customerId: "cliente-joao",
    productId,
    productName: name,
    description: "Jarra de vidro com tampa",
    specification: null,
    quantity: 1000,
    unit: "un",
    deadline: null,
  });
}

describe("NCM da solicitação", () => {
  it("sem cadastro: sugere pela tabela, Wellmix confirma e II/IPI entram na conta", async () => {
    await setSetting("icmsPercent", 18);
    const request = await newRequest(null);
    expect((await rn.requestNcm(request)).status).toBe("none");

    const s = await rn.suggestRequestNcm(admin, request.id);
    expect(s.aiError).toBe("ai_not_configured");
    const fresh = (await getStore().get("requests", request.id))!;
    const view = await rn.suggestionsView(fresh);
    // "vidro" → posição 7013.37 → subitem 7013.37.00 da tabela, com as alíquotas.
    expect(view[0]).toMatchObject({
      ncm: "70133700",
      source: "table",
      rates: { ii: 18, ipi: 9.75 },
    });

    // Só a Wellmix confirma; NCM fora da tabela é recusado.
    await expect(
      rn.confirmRequestNcm(joao, request.id, "7013.37.00", "table"),
    ).rejects.toThrow();
    await expect(
      rn.confirmRequestNcm(admin, request.id, "9999.99.99", "manual"),
    ).rejects.toThrow("ncm_not_in_table");
    await rn.confirmRequestNcm(admin, request.id, "7013.37.00", "table");

    await r.openRfq(admin, request.id, ["fornecedor-a"]);
    const [quote] = await getStore().list("quotes", {
      filter: { requestId: request.id },
    });
    await qs.saveQuoteSheet(supplierA, quote.id, {
      price: 10,
      currency: "USD",
      incoterm: "FOB",
    });
    await r.answerQuote(supplierA, quote.id, {
      price: 10,
      currency: "USD",
      leadTimeDays: 30,
    });
    const req = (await getStore().get("requests", request.id))!;
    const ctx = await quotePricing(req, [{ ...quote, status: "answered" }], {
      fx,
    });
    const p = ctx.quotes[0];
    expect(p.tax).toMatchObject({
      ncm: "70133700",
      ncmStatus: "confirmed",
      iiSource: "table",
      ipiSource: "table",
    });
    expect(p.input).toMatchObject({
      importTaxPercent: 18,
      ipiPercent: 9.75,
      pisPercent: 2.1,
      cofinsPercent: 9.65,
      icmsPercent: 18,
    });
    expect(p.result.icmsBrl).toBeGreaterThan(0);

    // Escolhido: NCM, II e IPI vão para a ficha (e dela para o pedido).
    await r.selectQuote(admin, quote.id, {
      sellPrice: 100000,
      sellCurrency: "BRL",
      pricing: { quoteId: quote.id, input: p.input, ncm: p.tax.ncm },
    });
    const sheet = await qs.getQuoteSheet(quote.id);
    expect(sheet).toMatchObject({
      ncm: "7013.37.00",
      importTaxPercent: 18,
      ipiPercent: 9.75,
    });
  });

  it("produto com NCM no cadastro vale direto; confirmar leva o NCM ao cadastro", async () => {
    const store = getStore();
    const [product] = await store.list("products", { limit: 1 });
    await store.update("products", product.id, { ncm: "8517.13.00" });
    const withNcm = await newRequest(product.id, "Smartphone");
    const info = await rn.requestNcm(withNcm);
    expect(info).toMatchObject({
      ncm: "85171300",
      status: "product",
      rates: { ii: 16, ipi: 15 },
    });

    await store.update("products", product.id, { ncm: null });
    const without = await newRequest(product.id, "Smartphone");
    expect((await rn.requestNcm(without)).status).toBe("none");
    await rn.confirmRequestNcm(admin, without.id, "85171300", "manual");
    expect((await store.get("products", product.id))?.ncm).toBe("8517.13.00");
  });
});
