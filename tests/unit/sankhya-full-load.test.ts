import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Carga completa dos cadastros do Sankhya (lotes por faixa de código, com
 * cursor) e moeda dos pedidos da amostra (USD pelo câmbio do pedido).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const { runFullLoad, getFullLoadProgress, resetFullLoad } =
  await import("@/lib/integrations/sankhya-full-load");
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

/** Sankhya falso: tabelas em memória, responde MIN/COUNT e faixas de código. */
function fakeSankhya(
  tables: Record<string, { key: string; rows: Record<string, unknown>[] }>,
) {
  const sqls: string[] = [];
  const reply = (columns: string[], rows: unknown[][]) =>
    new Response(
      JSON.stringify({
        status: "1",
        responseBody: {
          fieldsMetadata: columns.map((name) => ({ name })),
          rows,
        },
      }),
    );
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
    const name = Object.keys(tables).find((t) => sql.includes(`FROM ${t}`))!;
    const { key, rows } = tables[name];
    const filtered = rows.filter((r) => {
      if (name === "TGFPAR" && !(r.FORNECEDOR === "S" || r.CLIENTE === "S"))
        return false;
      const k = Number(r[key]);
      const gt = new RegExp(`${key} > (\\d+)`).exec(sql);
      const le = new RegExp(`${key} <= (\\d+)`).exec(sql);
      const inList = new RegExp(`${key} IN \\(([\\d, -]+)\\)`).exec(sql);
      if (gt && !(k > Number(gt[1]))) return false;
      if (le && !(k <= Number(le[1]))) return false;
      if (inList && !inList[1].split(",").map(Number).includes(k)) return false;
      return true;
    });
    if (sql.includes("NEXTCODE")) {
      const keys = filtered.map((r) => Number(r[key]));
      return reply(
        ["NEXTCODE", "REMAINING"],
        [[keys.length ? Math.min(...keys) : null, keys.length]],
      );
    }
    const columns = Object.keys(rows[0] ?? {});
    return reply(
      columns,
      filtered.map((r) => columns.map((c) => r[c] ?? null)),
    );
  }) as typeof fetch);
  return sqls;
}

describe("carga completa", () => {
  it("parceiros: lotes, cursor e só os fornecedores (clientes pela view)", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      CODPARC: (i + 1) * 100, // códigos espaçados: a faixa pula os buracos
      NOMEPARC: `Parceiro ${i + 1}`,
      CGC_CPF: null,
      FORNECEDOR: i % 3 === 0 ? "S" : "N",
      CLIENTE: i % 2 === 0 ? "S" : "N",
      ATIVO: "S",
    }));
    rows.push({
      CODPARC: 99999,
      NOMEPARC: "Funcionário",
      CGC_CPF: null,
      FORNECEDOR: "N",
      CLIENTE: "N",
      ATIVO: "S",
    });
    fakeSankhya({ TGFPAR: { key: "CODPARC", rows } });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("partners");

    // Orçamento curto: para no meio e guarda o cursor.
    const first = await runFullLoad(admin, "partners", 1);
    expect(first.progress.done).toBe(false);
    expect(first.progress.after).toBeGreaterThan(0);
    let progress = first.progress;
    for (let i = 0; i < 20 && !progress.done; i++)
      progress = (await runFullLoad(admin, "partners", 1)).progress;
    expect(progress.done).toBe(true);

    // A Wellmix SC da demonstração (comprador dos pedidos de compra) já nasce
    // com o código do Sankhya e não vem desta carga.
    // Fora: a Wellmix SC e o grupo econômico da demonstração.
    const demo = (id: string) =>
      id === "wellmix-sc" || id.startsWith("cliente-grupo");
    const parties = (await getStore().list("parties")).filter(
      (p) => p.sankhyaCode && !demo(p.id),
    );
    const suppliers = parties.filter((p) => p.type === "supplier");
    const customers = parties.filter((p) => p.type === "customer");
    expect(suppliers).toHaveLength(10); // i = 0, 3, …, 27
    // Os clientes vêm da VW_AD_CLIENTE_WELL (dono, 18/11/2026).
    expect(customers).toHaveLength(0);
    expect(parties.some((p) => p.name === "Funcionário")).toBe(false);

    // Rodar de novo (recomeçar) atualiza, não duplica.
    await resetFullLoad("partners");
    const again = await runFullLoad(admin, "partners", 60_000);
    expect(again.progress.done).toBe(true);
    expect(again.progress.counts.created ?? 0).toBe(0);
    expect(
      (await getStore().list("parties")).filter(
        (p) => p.sankhyaCode && !demo(p.id),
      ),
    ).toHaveLength(10);
    expect((await getFullLoadProgress("partners")).done).toBe(true);
  });

  it("clientes pela VW_AD_CLIENTE_WELL: grupo econômico, matriz e a linha da view", async () => {
    const view = (over: Record<string, unknown>) => ({
      COD_CLIENTE: 0,
      NOME_CLIENTE: "",
      RAZAO_SOCIAL: null,
      TIPO_PESSOA: "J",
      DOCUMENTO: null,
      ATIVO: "S",
      COD_GRUPO_ECONOMICO: 0,
      GRUPO_ECONOMICO: null,
      COD_MATRIZ: 0,
      COD_VENDEDOR: 101,
      CIDADE: "CAMPINAS",
      UF: "SP",
      PAIS: "BRASIL",
      COD_CLASSIFICACAO: "6",
      CLASSIFICACAO: "PLENO",
      ...over,
    });
    fakeSankhya({
      "sankhya.VW_AD_CLIENTE_WELL": {
        key: "COD_CLIENTE",
        rows: [
          view({
            COD_CLIENTE: 5431,
            NOME_CLIENTE: "CAMPINEIRA MATRIZ",
            DOCUMENTO: "12345678000190",
            COD_GRUPO_ECONOMICO: 5431,
            GRUPO_ECONOMICO: "CAMPINEIRA MATRIZ",
          }),
          view({
            COD_CLIENTE: 5432,
            NOME_CLIENTE: "CAMPINEIRA LOJA 2",
            COD_GRUPO_ECONOMICO: 5431,
            GRUPO_ECONOMICO: "CAMPINEIRA MATRIZ",
            COD_MATRIZ: 5431,
          }),
          view({ COD_CLIENTE: 7000, NOME_CLIENTE: "SOZINHO", ATIVO: "N" }),
        ],
      },
    });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("customers");
    const run = await runFullLoad(admin, "customers", 60_000);
    expect(run.progress.done).toBe(true);
    const customers = (await getStore().list("parties")).filter(
      (p) =>
        p.type === "customer" &&
        ["5431", "5432", "7000"].includes(p.sankhyaCode ?? ""),
    );
    const by = (c: string) => customers.find((p) => p.sankhyaCode === c)!;
    expect(customers).toHaveLength(3);
    expect(by("5431")).toMatchObject({
      name: "CAMPINEIRA MATRIZ",
      taxId: "12345678000190",
      economicGroupCode: "5431",
      economicGroupName: "CAMPINEIRA MATRIZ",
      matrixCode: null,
      city: "CAMPINAS - SP",
      rcaCode: "101",
    });
    expect(by("5432")).toMatchObject({
      economicGroupCode: "5431",
      matrixCode: "5431",
    });
    // Fora de grupo (0) e inativo.
    expect(by("7000")).toMatchObject({
      economicGroupCode: null,
      active: false,
    });
    expect(by("5432").sankhyaCustomer).toMatchObject({
      CLASSIFICACAO: "PLENO",
    });
    expect(by("5432").sankhyaRefs).toMatchObject({
      CODPARCGRUECONOMICO: 5431,
      CODVEND: 101,
    });
    // Rodar de novo atualiza, não duplica.
    await resetFullLoad("customers");
    const again = await runFullLoad(admin, "customers", 60_000);
    expect(again.progress.counts.created ?? 0).toBe(0);
  });

  it("produtos com grupos (linhas), EAN e SKU; condições de pagamento", async () => {
    const sqls = fakeSankhya({
      TGFPRO: {
        key: "CODPROD",
        rows: [
          {
            CODPROD: 50,
            DESCRPROD: "CANECA 300ML",
            REFFORN: "WX7588",
            REFERENCIA: "7899527157747",
            CODGRUPOPROD: 160201001,
            NCM: "69120000",
            ALTURA: 0.082,
            ATIVO: "S",
          },
          {
            CODPROD: 51,
            DESCRPROD: "PRATO",
            REFFORN: "WX1",
            REFERENCIA: null,
            CODGRUPOPROD: 160201001,
            ATIVO: "N",
          },
        ],
      },
      TGFGRU: {
        key: "CODGRUPOPROD",
        rows: [
          { CODGRUPOPROD: 160201001, DESCRGRUPOPROD: "CANECA", ATIVO: "S" },
        ],
      },
      // Desde 21/11/2026 a lista é a view (a TGFTPV não é mais lida).
      "sankhya.VW_AD_TIPONEGOCIACAO_WELL": {
        key: "CODTIPVENDA",
        rows: [
          { CODTIPVENDA: 33, DESCRTIPVENDA: "IMPORTAÇÃO", ATIVO: "S" },
          {
            CODTIPVENDA: 111,
            DESCRTIPVENDA: "30% ANT 70% 30 DAYS AFTER SHIP",
            ATIVO: "S",
          },
        ],
      },
    });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("products");
    expect((await runFullLoad(admin, "products", 60_000)).progress.done).toBe(
      true,
    );
    const [caneca] = await getStore().list("products", {
      filter: { sankhyaCode: "50" },
    });
    expect(caneca).toMatchObject({
      sku: "WX7588",
      ean: "7899527157747",
      ncm: "69120000",
      heightCm: 8.2,
      active: true,
    });
    const line = await getStore().get("product_lines", caneca.lineId);
    expect(line).toMatchObject({ name: "CANECA", sankhyaCode: "160201001" });
    const [prato] = await getStore().list("products", {
      filter: { sankhyaCode: "51" },
    });
    expect(prato.active).toBe(false);

    await resetFullLoad("paymentConditions");
    expect(
      (await runFullLoad(admin, "paymentConditions", 60_000)).progress.done,
    ).toBe(true);
    // A tabela fica igual à view (as da demonstração saem).
    const conditions = await getStore().list("payment_conditions");
    expect(conditions.map((c) => [c.code, c.name, c.source]).sort()).toEqual([
      [111, "30% ANT 70% 30 DAYS AFTER SHIP", "sankhya"],
      [33, "IMPORTAÇÃO", "sankhya"],
    ]);
    expect(conditions.find((c) => c.code === 111)).toMatchObject({
      scheduleKind: "event",
      installments: [
        { percent: 30, base: "order", days: 0 },
        { percent: 70, base: "shipment", days: 30 },
      ],
    });
    for (const sql of sqls)
      expect(() => sk.assertReadOnlySql(sql)).not.toThrow();
  });
});

describe("views do Sankhya (20/11/2026)", () => {
  it("fornecedores pela VW_AD_FORNECEDOR_WELL: endereço pronto, linha da view e os códigos antigos ficam", async () => {
    const store = getStore();
    // Fornecedor que já veio da TGFPAR (com rua e bairro nos códigos).
    await store.create("parties", {
      ...(await import("@/lib/db")).PARTY_EXTRA_DEFAULTS,
      type: "supplier",
      name: "NINGBO OLD",
      country: null,
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
      sankhyaCode: "800",
      sankhyaRefs: { CODPARC: 800, CODEND: 77, CODBAI: 9 },
    });
    const sqls = fakeSankhya({
      "sankhya.VW_AD_FORNECEDOR_WELL": {
        key: "COD_FORNECEDOR",
        rows: [
          {
            COD_FORNECEDOR: 800,
            NOME_FORNECEDOR: "NINGBO HOMEWARE",
            RAZAO_SOCIAL: "NINGBO HOMEWARE CO LTD",
            TIPO_PESSOA: "J",
            DOCUMENTO: null,
            ATIVO: "S",
            E_FORNECEDOR: "S",
            COD_TIPO_FORNECEDOR: "FABRICA",
            TIPO_FORNECEDOR: "Fábrica",
            ENDERECO: "RUA ZHONGSHAN",
            NUMERO: "12",
            COMPLEMENTO: null,
            BAIRRO: "BEILUN",
            COD_CIDADE: 4500,
            CIDADE: "NINGBO",
            UF: "EX",
            PAIS: "CHINA",
            CEP: "00000000",
            EMAIL: "sales@ningbo.cn",
          },
          {
            COD_FORNECEDOR: 801,
            NOME_FORNECEDOR: "YIWU TRADING",
            ATIVO: "S",
            E_FORNECEDOR: "S",
            CIDADE: "YIWU",
            PAIS: "CHINA",
          },
        ],
      },
    });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("partners");
    const run = await runFullLoad(admin, "partners", 60_000);
    expect(run.progress).toMatchObject({ done: true, source: "view" });
    expect(sqls.some((q) => q.includes("E_FORNECEDOR = 'S'"))).toBe(true);
    const [ningbo] = await store.list("parties", {
      filter: { sankhyaCode: "800", type: "supplier" },
    });
    expect(ningbo).toMatchObject({
      name: "NINGBO HOMEWARE",
      legalName: "NINGBO HOMEWARE CO LTD",
      country: "CHINA",
      city: "NINGBO - EX",
      address: "RUA ZHONGSHAN, 12 - BEILUN - CEP 00000-000",
      email: "sales@ningbo.cn",
    });
    expect(ningbo.sankhyaRefs).toMatchObject({
      CODPARC: 800,
      CODCID: 4500,
      CODEND: 77,
      CODBAI: 9,
    });
    expect(ningbo.sankhyaSupplier).toMatchObject({
      COD_TIPO_FORNECEDOR: "FABRICA",
    });
    const [yiwu] = await store.list("parties", {
      filter: { sankhyaCode: "801", type: "supplier" },
    });
    expect(yiwu).toMatchObject({ name: "YIWU TRADING", country: "CHINA" });
  });

  it("produtos pela VW_AD_PRODUTO_WELL e o vínculo produto × fornecedor com os portos", async () => {
    const store = getStore();
    const product = (over: Record<string, unknown>) => ({
      COD_PRODUTO: 60,
      DESCRICAO: "TIGELA 500ML",
      COMPLEMENTO: null,
      REFERENCIA: "7899000000011",
      REFERENCIA_FORNECEDOR: "WX9001",
      MARCA: "WELLMIX",
      COD_GRUPO: 160201002,
      NCM: "69120000",
      UNIDADE: "UN",
      PESO_BRUTO: 0.4,
      ALTURA: 0.1,
      ATIVO: "S",
      COD_PAIS_ORIGEM: 160,
      COD_PORTO_PREFERENCIAL: 3,
      COD_FORNECEDOR_PRINCIPAL: 800,
      ...over,
    });
    const tables = {
      "sankhya.VW_AD_PRODUTO_WELL": {
        key: "COD_PRODUTO",
        rows: [product({})],
      },
      TGFGRU: {
        key: "CODGRUPOPROD",
        rows: [
          { CODGRUPOPROD: 160201002, DESCRGRUPOPROD: "TIGELA", ATIVO: "S" },
        ],
      },
      "sankhya.VW_AD_PRODUTO_FORNECEDOR_WELL": {
        key: "COD_PRODUTO",
        rows: [
          {
            COD_PRODUTO: 60,
            COD_FORNECEDOR: 800,
            COD_PORTO: 3,
            PORTO: "NINGBO",
            COD_PAIS: 160,
            PAIS_PORTO: "CHINA",
            FORNECEDOR_PREFERENCIAL: "S",
            ORIGEM: "COMPRA",
            QTD_PROCESSOS: 4,
            DATA_ULTIMA_COMPRA: "10/09/2026",
            ULTIMO_PRECO_ORIGEM: 1.25,
            COD_MOEDA: 2,
            MOEDA: "USD",
            VALIDADO: "S",
          },
          {
            COD_PRODUTO: 60,
            COD_FORNECEDOR: 801,
            COD_PORTO: 4,
            PORTO: "SHANGHAI",
            PAIS_PORTO: "CHINA",
            FORNECEDOR_PREFERENCIAL: "N",
            VALIDADO: "N",
          },
          { COD_PRODUTO: 61, COD_FORNECEDOR: 800 },
        ],
      },
    };
    fakeSankhya(tables);
    sk.resetSankhyaTokenCache();
    await resetFullLoad("products");
    const run = await runFullLoad(admin, "products", 60_000);
    expect(run.progress).toMatchObject({ done: true, source: "view" });
    let [tigela] = await store.list("products", {
      filter: { sankhyaCode: "60" },
    });
    const ningbo = (
      await store.list("parties", {
        filter: { sankhyaCode: "800", type: "supplier" },
      })
    )[0];
    expect(tigela).toMatchObject({
      name: "TIGELA 500ML",
      sku: "WX9001",
      ean: "7899000000011",
      heightCm: 10,
      // Fornecedor principal do cadastro do produto (dono, 20/11/2026).
      supplierId: ningbo.id,
    });
    expect(tigela.sankhyaRefs).toMatchObject({
      CODPROD: 60,
      CODGRUPOPROD: 160201002,
      CODPARCFORN: 800,
      CODPAIS: 160,
      AD_IDPORTO: 3,
    });
    // O que a view não tem (estoque mínimo, códigos antigos) não se perde.
    tigela = await store.update("products", tigela.id, {
      minStock: 12,
      sankhyaRefs: { ...tigela.sankhyaRefs, CODLOCALPADRAO: 101 },
    });
    await resetFullLoad("products");
    await runFullLoad(admin, "products", 60_000);
    [tigela] = await store.list("products", { filter: { sankhyaCode: "60" } });
    expect(tigela.minStock).toBe(12);
    expect(tigela.sankhyaRefs).toMatchObject({ CODLOCALPADRAO: 101 });

    await resetFullLoad("productSuppliers");
    const links = await runFullLoad(admin, "productSuppliers", 60_000);
    expect(links.progress.done).toBe(true);
    expect(links.lines.find((l) => l.code === "61")?.outcome).toBe("skipped");
    const rows = await store.list("product_suppliers", {
      filter: { productId: tigela.id },
    });
    expect(rows).toHaveLength(2);
    const main = rows.find((r) => r.supplierId === ningbo.id)!;
    expect(main).toMatchObject({
      source: "sankhya",
      price: 1.25,
      currency: "USD",
      sankhyaPreferential: true,
      sankhyaValidated: true,
      sankhyaListed: true,
      sankhyaLastPurchaseAt: "2026-09-10T12:00:00.000Z",
    });
    expect(main.sankhyaPorts).toEqual([
      expect.objectContaining({ port: "NINGBO", country: "CHINA" }),
    ]);

    // O par que sai da view fica, marcado; o preço da cotação não muda.
    await store.update("product_suppliers", main.id, { price: 1.1 });
    tables["sankhya.VW_AD_PRODUTO_FORNECEDOR_WELL"].rows = tables[
      "sankhya.VW_AD_PRODUTO_FORNECEDOR_WELL"
    ].rows.slice(0, 1);
    fakeSankhya(tables);
    await resetFullLoad("productSuppliers");
    await runFullLoad(admin, "productSuppliers", 60_000);
    const after = await store.list("product_suppliers", {
      filter: { productId: tigela.id },
    });
    expect(after).toHaveLength(2);
    expect(after.find((r) => r.supplierId === ningbo.id)?.price).toBe(1.1);
    expect(after.find((r) => r.supplierId !== ningbo.id)?.sankhyaListed).toBe(
      false,
    );
  });

  it("vendedores pela VW_AD_VENDEDOR_WELL: lista de RCAs e o login ligado pelo e-mail", async () => {
    const store = getStore();
    const vendas = (await store.list("users")).find(
      (u) => u.email === "vendas@wellmix.com",
    )!;
    await store.update("users", vendas.id, { sellerCode: null });
    fakeSankhya({
      "sankhya.VW_AD_VENDEDOR_WELL": {
        key: "COD_VENDEDOR",
        rows: [
          {
            COD_VENDEDOR: 201,
            NOME_VENDEDOR: "MARIANA",
            ATIVO: "S",
            COD_PARCEIRO: 9201,
            TIPO_DESCR: "Vendedor",
            TIPO_WELLMIX: "VENDEDOR EXTERNO",
            EMAIL: " Vendas@Wellmix.com ",
            EQUIPE: "SUL",
            REGIAO: "SC",
          },
          {
            COD_VENDEDOR: 202,
            NOME_VENDEDOR: "SEM LOGIN",
            ATIVO: "S",
            EMAIL: "outro@x.com",
          },
        ],
      },
    });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("sellers");
    const run = await runFullLoad(admin, "sellers", 60_000);
    expect(run.progress).toMatchObject({
      done: true,
      source: "view",
      counts: { updated: 2, linked: 1 },
    });
    const { loadRcaList } = await import("@/lib/services/rca");
    const list = await loadRcaList();
    expect(list.sellers.find((s) => s.code === "201")).toMatchObject({
      name: "MARIANA",
      partnerCode: "9201",
      wellmixType: "VENDEDOR EXTERNO",
      team: "SUL",
      email: "vendas@wellmix.com",
    });
    expect((await store.get("users", vendas.id))?.sellerCode).toBe("201");
    // Já ligado: não troca.
    await store.update("users", vendas.id, { sellerCode: "999" });
    await runFullLoad(admin, "sellers", 60_000);
    expect((await store.get("users", vendas.id))?.sellerCode).toBe("999");
  });
});

describe("moeda dos pedidos da amostra", () => {
  it("com câmbio no pedido: USD = VLRNOTA ÷ VLRMOEDA; vínculo pelo NUNOTA e número pelo NUMNOTA", async () => {
    const erp = {
      ...st.DEFAULT_SANKHYA_ERP,
      erpNumberField: "NUMNOTA" as const,
    };
    const lines = await importSankhyaSet(
      admin,
      {
        orders: [
          {
            NUNOTA: 7001,
            NUMNOTA: 4321,
            CODEMP: 3,
            CODTIPOPER: 1101,
            CODPARC: 100,
            DTNEG: "10/11/2026",
            VLRNOTA: 5160,
            VLRMOEDA: 5.16,
          },
        ],
        partners: [
          {
            CODPARC: 100,
            NOMEPARC: "Parceiro 1",
            FORNECEDOR: "S",
            CLIENTE: "S",
          },
        ],
        items: [
          {
            NUNOTA: 7001,
            SEQUENCIA: 1,
            CODPROD: 50,
            DESCRPROD: "CANECA 300ML",
            QTDNEG: 1000,
            CODVOL: "UN",
            VLRUNIT: 5.16,
          },
        ],
        products: [
          {
            CODPROD: 50,
            DESCRPROD: "CANECA 300ML",
            REFFORN: "WX7588",
            CODGRUPOPROD: 160201001,
          },
        ],
        groups: [],
        financial: [],
        companies: [{ CODEMP: 3, NOMEFANTASIA: "WELLMIX - SC" }],
      },
      erp,
    );
    const order = await getStore().get(
      "orders",
      lines.find((l) => l.entity === "orders")!.id!,
    );
    expect(order).toMatchObject({
      fobTotal: 1000,
      fobCurrency: "USD",
      erpNumber: "4321",
      sankhyaCode: "7001",
    });
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order!.id },
    });
    expect(item.unitPrice).toBe(1);
    // O fornecedor da nota reaproveita o cadastro da carga completa (mesmo código).
    expect(lines.find((l) => l.entity === "partners")?.outcome).toBe(
      "existing",
    );
  });
});

describe("carga antiga do histórico de pedidos", () => {
  it("fica desligada (21/11/2026): não lê o Sankhya nem grava pedidos", async () => {
    const before = (await getStore().list("orders")).length;
    const sqls = fakeSankhya({});
    await st.writeSetting("sankhya.legacyOrders", null);
    await resetFullLoad("orders");
    const run = await runFullLoad(admin, "orders", 60_000);
    expect(run.progress.done).toBe(true);
    expect(run.progress.missing[0]).toMatch(/desligada/);
    expect(sqls).toHaveLength(0);
    expect((await getStore().list("orders")).length).toBe(before);
  });
});
