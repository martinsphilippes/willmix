import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Ligações da carga do Sankhya: cidade/UF/país, endereço e contato do
 * parceiro; fornecedor, preço e caixas do produto pela última compra e pelos
 * volumes; transportadora, Incoterm, condição de pagamento e câmbio do
 * pedido; forma de pagamento do título. Tabela que falta não derruba a carga.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const m = await import("@/lib/integrations/sankhya-mapping");
const { importSankhyaSet } = await import("@/lib/integrations/sankhya-import");
type User = import("@/lib/db").User;

let admin: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  await st.saveSankhyaCredentials(
    {
      environment: "production",
      clientId: "c",
      clientSecret: "s",
      xToken: "x",
    },
    "admin",
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Sankhya falso: cada tabela responde às linhas cujo código está no IN. */
function fakeSankhya(
  tables: Record<string, { key: string; rows: Record<string, unknown>[] }>,
) {
  const sqls: string[] = [];
  vi.stubGlobal("fetch", (async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    if (String(input).endsWith("/authenticate"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 300 }),
      );
    const sql = JSON.parse(String(init.body)).requestBody.sql as string;
    sqls.push(sql);
    const name = Object.keys(tables).find(
      (t) => sql.includes(`FROM ${t} `) || sql.endsWith(`FROM ${t}`),
    );
    if (!name)
      return new Response(
        JSON.stringify({
          status: "0",
          statusMessage: "ORA-00942: tabela não existe",
        }),
      );
    const { key, rows } = tables[name];
    const inList = new RegExp(`${key} IN \\(([\\d, -]+)\\)`).exec(sql);
    const filtered = rows.filter(
      (r) =>
        !inList || inList[1].split(",").map(Number).includes(Number(r[key])),
    );
    const columns = Object.keys(rows[0] ?? {});
    return new Response(
      JSON.stringify({
        status: "1",
        responseBody: {
          fieldsMetadata: columns.map((n) => ({ name: n })),
          rows: filtered.map((r) => columns.map((c) => r[c] ?? null)),
        },
      }),
    );
  }) as typeof fetch);
  return sqls;
}

describe("regras puras", () => {
  it("cidade, endereço, caixas e Incoterm", () => {
    expect(m.cityLabel({ NOMECID: "ITAJAI" }, { UF: "SC" })).toBe(
      "ITAJAI - SC",
    );
    expect(m.cityLabel(undefined, undefined)).toBeNull();
    expect(
      m.addressLine(
        { NUMEND: "120", COMPLEMENTO: "SALA 3", CEP: "88300000" },
        { TIPO: "R", NOMEEND: "BLUMENAU" },
        { NOMEBAI: "CENTRO" },
      ),
    ).toBe("R BLUMENAU, 120 - SALA 3 - CENTRO - CEP 88300-000");
    expect(m.addressLine({}, undefined, undefined)).toBeNull();
    expect(
      m.boxQuantities([
        { QUANTIDADE: 24, DIVIDEMULTIPLICA: "M" },
        { QUANTIDADE: 6 },
        { QUANTIDADE: 1 },
        { QUANTIDADE: 2, DIVIDEMULTIPLICA: "D" },
      ]),
    ).toEqual({ masterBoxQty: 24, innerBoxQty: 6 });
    expect(m.boxQuantities([{ QUANTIDADE: 12 }])).toEqual({
      masterBoxQty: 12,
      innerBoxQty: null,
    });
    expect(m.convert("incoterm", "F", {})).toBe("FOB");
    expect(m.convert("incoterm", "C", {})).toBe("CIF");
    expect(m.convert("incoterm", "S", {})).toBeNull();
    // Campos de outras tabelas não entram no SQL nem na conferência de colunas.
    expect(m.sampleSql("partners", [1])).not.toContain("TSICID");
    expect(m.missingColumns("partners", ["CODPARC"])).not.toContain(
      "TSIPAI.DESCRICAO",
    );
  });
});

describe("carga com ligações", () => {
  it("preenche parceiro, produto, pedido e título pelas tabelas ligadas", async () => {
    const store = getStore();
    await store.create("payment_conditions", {
      code: 33,
      name: "IMPORTAÇÃO 30/70",
      active: true,
      notes: null,
      source: "sankhya",
      updatedByUserId: null,
    });
    const sqls = fakeSankhya({
      TSICID: {
        key: "CODCID",
        rows: [{ CODCID: 7, NOMECID: "NINGBO", UF: 99 }],
      },
      TSIUFS: { key: "CODUF", rows: [{ CODUF: 99, UF: "ZJ", CODPAIS: 86 }] },
      TSIPAI: { key: "CODPAIS", rows: [{ CODPAIS: 86, DESCRICAO: "CHINA" }] },
      TSIEND: {
        key: "CODEND",
        rows: [{ CODEND: 5, TIPO: "RD", NOMEEND: "JIANGBEI" }],
      },
      // TSIBAI não existe neste ERP: só o bairro fica de fora.
      TGFCTT: {
        key: "CODPARC",
        rows: [
          {
            CODPARC: 31,
            CODCONTATO: 1,
            NOMECONTATO: "Lily Wang",
            EMAIL: "lily@nb.cn",
            TELEFONE: "+86 1",
          },
        ],
      },
      TGFITE: {
        key: "CODPROD",
        rows: [
          {
            CODPROD: 60,
            CODPARC: 31,
            NUNOTA: 950,
            VLRUNIT: 10.32,
            VLRMOEDA: 5.16,
          },
        ],
      },
      TGFVOA: {
        key: "CODPROD",
        rows: [
          { CODPROD: 60, CODVOL: "CX", QUANTIDADE: 48, DIVIDEMULTIPLICA: "M" },
          { CODPROD: 60, CODVOL: "PC", QUANTIDADE: 12, DIVIDEMULTIPLICA: "M" },
        ],
      },
      TGFTIT: {
        key: "CODTIPTIT",
        rows: [{ CODTIPTIT: 4, DESCRTIPTIT: "CÂMBIO" }],
      },
    });
    sk.resetSankhyaTokenCache();

    const lines = await importSankhyaSet(admin, {
      orders: [
        {
          NUNOTA: 950,
          CODEMP: 3,
          CODTIPOPER: 1101,
          CODPARC: 31,
          DTNEG: "02/11/2026",
          VLRNOTA: 5160,
          VLRMOEDA: 5.16,
          CODTIPVENDA: 33,
          CIF_FOB: "F",
          CODPARCTRANSP: 41,
          DTPREVENT: "20/12/2026",
        },
      ],
      partners: [
        {
          CODPARC: 31,
          NOMEPARC: "NB HOME",
          RAZAOSOCIAL: "NINGBO HOME CO LTD",
          TIPPESSOA: "J",
          IDENTINSCESTAD: "ISENTO",
          CODCID: 7,
          CODEND: 5,
          NUMEND: "88",
          CODBAI: 3,
          FORNECEDOR: "S",
          CLIENTE: "N",
          ATIVO: "S",
        },
      ],
      carriers: [
        {
          CODPARC: 41,
          NOMEPARC: "TRANSPORTES SUL",
          FORNECEDOR: "S",
          ATIVO: "S",
        },
      ],
      items: [
        {
          NUNOTA: 950,
          SEQUENCIA: 1,
          CODPROD: 60,
          DESCRPROD: "TAÇA",
          QTDNEG: 500,
          CODVOL: "UN",
          VLRUNIT: 10.32,
        },
      ],
      products: [
        {
          CODPROD: 60,
          DESCRPROD: "TAÇA",
          REFFORN: "WX9001",
          MARCA: "WELLMIX",
          COMPLDESC: "Vidro 300 ml",
          ATIVO: "S",
        },
      ],
      groups: [],
      financial: [
        {
          NUFIN: 8001,
          NUNOTA: 950,
          RECDESP: -1,
          VLRDESDOB: 1548,
          CODTIPTIT: 4,
        },
      ],
      companies: [{ CODEMP: 3, NOMEFANTASIA: "WELLMIX - SC" }],
    });
    expect(lines.filter((l) => l.outcome === "skipped")).toEqual([]);
    expect(sqls.some((s) => s.includes("FROM TSIBAI"))).toBe(true);

    const parties = await store.list("parties");
    const supplier = parties.find(
      (p) => p.sankhyaCode === "31" && p.type === "supplier",
    )!;
    expect(supplier).toMatchObject({
      name: "NB HOME",
      legalName: "NINGBO HOME CO LTD",
      personType: "J",
      stateRegistration: "ISENTO",
      city: "NINGBO - ZJ",
      country: "CHINA",
      address: "RD JIANGBEI, 88",
      contactName: "Lily Wang",
      email: "lily@nb.cn",
    });
    const carrier = parties.find(
      (p) => p.sankhyaCode === "41" && p.type === "carrier",
    )!;
    expect(carrier.name).toBe("TRANSPORTES SUL");

    const [product] = await store.list("products", {
      filter: { sankhyaCode: "60" },
    });
    expect(product).toMatchObject({
      supplierId: supplier.id,
      price: 2,
      currency: "USD",
      masterBoxQty: 48,
      innerBoxQty: 12,
      notes: "Vidro 300 ml",
      brand: "WELLMIX",
    });

    const [order] = await store.list("orders", {
      filter: { sankhyaCode: "950" },
    });
    const condition = (await store.list("payment_conditions")).find(
      (c) => c.code === 33,
    )!;
    expect(order).toMatchObject({
      incoterm: "FOB",
      paymentConditionId: condition.id,
      fxRate: 5.16,
      carrierId: carrier.id,
      fobTotal: 1000,
      fobCurrency: "USD",
    });
    expect(order.notes).toContain("previsão de entrega 2026-12-20");

    const [payment] = await store.list("payments", {
      filter: { sankhyaCode: "8001" },
    });
    expect(payment).toMatchObject({ method: "CÂMBIO", fxRate: 5.16 });
  });
});
