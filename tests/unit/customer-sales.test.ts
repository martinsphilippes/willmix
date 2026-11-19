import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Base de vendas do Sankhya (dono, 19/11/2026; docs/TRADE_COMERCIAL.md, PR 3):
 * os pedidos do cliente somados por mês, produto e unidade pela view do
 * histórico da Nova solicitação, a caixa convertida em peças pela TGFVOA,
 * gravados pelo id fixo (gravar de novo substitui e tira o que sumiu), a
 * situação da carga por cliente, os dias sem compra na carteira e o painel
 * que lê só a base gravada.
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const sales = await import("@/lib/services/customer-sales");
const panel = await import("@/lib/services/sales-panel");
const portfolio = await import("@/lib/services/portfolio");
type User = import("@/lib/db").User;

const config = {
  baseUrl: "https://api.sankhya.com.br",
  clientId: "c",
  clientSecret: "s",
  xToken: "x",
};

const SALE_COLUMNS = [
  "CODPROD",
  "ANO",
  "MES",
  "UNIDADE_NEGOCIADA",
  "DESCRICAO_PRODUTO",
  "QTD",
  "VALOR",
  "PEDIDOS",
  "ULTIMA",
];

/** Sankhya de mentira no formato do DbExplorer (guarda o SQL). */
function fakeSankhya(
  answer: (sql: string) => { columns: string[]; rows: unknown[][] } | "error",
) {
  const sqls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (String(input).endsWith("/authenticate"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 300 }),
      );
    const sql = JSON.parse(String(init.body)).requestBody.sql as string;
    sqls.push(sql);
    const a = answer(sql);
    if (a === "error")
      return new Response(
        JSON.stringify({ status: "0", statusMessage: "Tabela inválida" }),
      );
    return new Response(
      JSON.stringify({
        status: "1",
        responseBody: {
          fieldsMetadata: a.columns.map((name) => ({ name })),
          rows: a.rows,
        },
      }),
    );
  }) as typeof globalThis.fetch;
  return { sqls, options: { config, fetch } };
}

let admin: User;
let seller: User;
let buyer: User;
let groupId: string;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  seller = users.find((u) => u.email === "vendas@wellmix.com")!;
  buyer = users.find((u) => u.email === "operador@wellmix.com")!;
  await getStore().update("parties", "cliente-joao", { sankhyaCode: "7197" });
  const group = await portfolio.createCustomerGroup(admin, {
    name: "Grupo Campineira",
    notes: null,
    ownerUserId: seller.id,
  });
  groupId = group.id;
  await portfolio.setCustomerGroup(admin, "cliente-joao", groupId);
});

describe("SQL e conversão", () => {
  it("vendas por mês, produto e unidade, só inteiros no SQL", () => {
    const sql = sales.monthlySalesSql(7197, 0);
    expect(sql).toContain("FROM sankhya.VW_AD_PEDCLIENTE_ITEM_WELL");
    expect(sql).toContain("WHERE COD_CLIENTE = 7197 AND CODPROD >= 0");
    expect(sql).toContain(
      "GROUP BY CODPROD, YEAR(DATA_PEDIDO), MONTH(DATA_PEDIDO), UNIDADE_NEGOCIADA",
    );
    expect(sql).toContain("SELECT TOP 500 ");
    expect(() => sales.monthlySalesSql(0, 0)).toThrow("invalid_input");
    expect(sales.volumesSql([10, 10, 20])).toBe(
      "SELECT CODPROD, CODVOL, QUANTIDADE, DIVIDEMULTIPLICA FROM TGFVOA WHERE CODPROD IN (10, 20)",
    );
  });

  it("peças: UN vale 1; caixa pelo volume (multiplica ou divide); sem volume, nulo", () => {
    expect(sales.pieceFactor("UN", [])).toBe(1);
    expect(sales.pieceFactor(null, [])).toBe(1);
    expect(
      sales.pieceFactor("CX", [
        { CODVOL: "CX", QUANTIDADE: "12", DIVIDEMULTIPLICA: "M" },
      ]),
    ).toBe(12);
    expect(
      sales.pieceFactor("DZ", [
        { CODVOL: "DZ", QUANTIDADE: "4", DIVIDEMULTIPLICA: "D" },
      ]),
    ).toBe(0.25);
    expect(sales.pieceFactor("CX", [])).toBeNull();
  });

  it("linha do Sankhya: mês AAAA-MM e a data do último pedido", () => {
    expect(
      sales.toMonthlySale({
        CODPROD: "25260",
        ANO: "2026",
        MES: "3",
        UNIDADE_NEGOCIADA: "CX",
        DESCRICAO_PRODUTO: "JARRA",
        QTD: "5",
        VALOR: "120,5",
        PEDIDOS: "2",
        ULTIMA: "28/03/2026 00:00:00",
      }),
    ).toEqual({
      productCode: "25260",
      month: "2026-03",
      unit: "CX",
      productName: "JARRA",
      quantity: 5,
      valueBrl: 120.5,
      orders: 2,
      lastOrderDate: "2026-03-28",
    });
    expect(
      sales.toMonthlySale({ CODPROD: "x", ANO: "2026", MES: "3" }),
    ).toBeNull();
  });
});

describe("leitura em páginas", () => {
  it("página cheia: o último produto começa a página seguinte (nada duplicado ou perdido)", async () => {
    const first = Array.from({ length: 500 }, (_, i) => [
      String(100 + Math.floor(i / 10)),
      "2026",
      String((i % 10) + 1),
      "UN",
      "P",
      "1",
      "1",
      "1",
      "01/01/2026",
    ]);
    const fake = fakeSankhya((sql) => {
      if (sql.includes("CODPROD >= 0"))
        return { columns: SALE_COLUMNS, rows: first };
      if (sql.includes("CODPROD >= 149"))
        return {
          columns: SALE_COLUMNS,
          rows: Array.from({ length: 12 }, (_, i) => [
            "149",
            "2026",
            String(i + 1),
            "UN",
            "P",
            "1",
            "1",
            "1",
            "01/01/2026",
          ]),
        };
      return { columns: SALE_COLUMNS, rows: [] };
    });
    const out = await sales.readCustomerSales(7197, fake.options);
    expect(fake.sqls.filter((s) => s.includes("VW_AD"))).toHaveLength(2);
    expect(out.complete).toBe(true);
    // 49 produtos × 10 meses da primeira página + os 12 meses do 149.
    expect(out.sales).toHaveLength(490 + 12);
    expect(out.sales.filter((s) => s.productCode === "149")).toHaveLength(12);
  });
});

describe("gravação, carteira e painel", () => {
  const twoMonths = (unitRows: unknown[][]) =>
    fakeSankhya((sql) =>
      sql.includes("TGFVOA")
        ? {
            columns: ["CODPROD", "CODVOL", "QUANTIDADE", "DIVIDEMULTIPLICA"],
            rows: [["20", "CX", "24", "M"]],
          }
        : sql.includes("VW_AD")
          ? { columns: SALE_COLUMNS, rows: unitRows }
          : { columns: [], rows: [] },
    );
  const baseRows = [
    ["10", "2026", "9", "UN", "LUMINARIA", "100", "500", "2", "20/09/2026"],
    ["20", "2026", "10", "CX", "VASO", "2", "300", "1", "05/10/2026"],
    ["10", "2025", "10", "UN", "LUMINARIA", "40", "200", "1", "10/10/2025"],
  ];

  it("grava a base, converte a caixa e marca a carga do cliente", async () => {
    const fake = twoMonths(baseRows);
    const now = new Date("2026-11-19T12:00:00Z");
    const result = await sales.refreshCustomerSales(
      "cliente-joao",
      now,
      fake.options,
    );
    expect(result).toMatchObject({
      state: "ok",
      rows: 3,
      complete: true,
      lastOrderDate: "2026-10-05",
    });
    const rows = await getStore().list("customer_sales_monthly", {
      filter: { customerId: "cliente-joao" },
    });
    expect(rows).toHaveLength(3);
    const box = rows.find((r) => r.productCode === "20")!;
    expect(box).toMatchObject({ unit: "CX", quantity: 2, pieces: 48 });
    const load = await getStore().get("customer_sales_loads", "cliente-joao");
    expect(load).toMatchObject({ rows: 3, complete: true, error: null });

    // Dias sem compra na carteira.
    const view = await portfolio.loadPortfolio(admin, {}, now);
    expect(
      view.rows.find((r) => r.customerId === "cliente-joao"),
    ).toMatchObject({
      lastPurchaseDate: "2026-10-05",
      daysWithoutPurchase: 45,
    });
  });

  it("de novo: substitui e tira o que sumiu; erro guarda a base anterior", async () => {
    const now = new Date("2026-11-20T12:00:00Z");
    await sales.refreshCustomerSales(
      "cliente-joao",
      now,
      twoMonths(baseRows.slice(0, 2)).options,
    );
    const rows = await getStore().list("customer_sales_monthly", {
      filter: { customerId: "cliente-joao" },
    });
    expect(rows).toHaveLength(2);
    const failing = fakeSankhya(() => "error");
    const result = await sales.refreshCustomerSales(
      "cliente-joao",
      now,
      failing.options,
    );
    expect(result.state).toBe("error");
    const load = await getStore().get("customer_sales_loads", "cliente-joao");
    expect(load?.error).toContain("Tabela inválida");
    expect(load?.rows).toBe(2);
    expect(
      await getStore().list("customer_sales_monthly", {
        filter: { customerId: "cliente-joao" },
      }),
    ).toHaveLength(2);
  });

  it("cliente sem código do Sankhya: avisa e não lê nada", async () => {
    const other = await getStore().create("parties", {
      type: "customer",
      name: "Sem código",
      country: "BR",
      email: null,
      phone: null,
      taxId: null,
      notes: null,
      active: true,
    } as never);
    const fake = twoMonths(baseRows);
    expect(
      (await sales.refreshCustomerSales(other.id, new Date(), fake.options))
        .state,
    ).toBe("no_code");
    expect(fake.sqls).toHaveLength(0);
  });

  it("Atualizar agora: só quem gere a carteira", async () => {
    await expect(
      sales.refreshSalesFor(
        seller,
        ["cliente-joao"],
        new Date(),
        twoMonths(baseRows).options,
      ),
    ).rejects.toThrow("forbidden");
    const out = await sales.refreshSalesFor(
      admin,
      ["cliente-joao"],
      new Date("2026-11-21T12:00:00Z"),
      twoMonths(baseRows).options,
    );
    expect(out[0].result.state).toBe("ok");
  });

  it("carga noturna: os acompanhados, pulando quem já foi lido hoje", async () => {
    const fake = twoMonths(baseRows);
    const today = Date.parse("2026-11-21T20:00:00Z");
    const result = await sales.refreshFollowedSales(
      60_000,
      () => today,
      fake.options,
    );
    expect(result).toMatchObject({ done: 0, state: "done" });
    const tomorrow = Date.parse("2026-11-22T05:00:00Z");
    const next = await sales.refreshFollowedSales(
      60_000,
      () => tomorrow,
      fake.options,
    );
    expect(next).toMatchObject({ done: 1, failed: 0, state: "done" });
  });

  it("painel: o grupo lê a base gravada; quem não vê o grupo não abre; valores só para quem vê", async () => {
    const data = (await panel.loadPanelData(admin, {
      kind: "group",
      id: groupId,
    }))!;
    expect(data.name).toBe("Grupo Campineira");
    expect(data.customers.map((c) => c.id)).toEqual(["cliente-joao"]);
    expect(data.rows).toHaveLength(3);
    expect(data.years).toEqual(["2026", "2025"]);
    expect(data.money).toBe(true);
    expect(data.rows.some((r) => r.valueBrl !== null)).toBe(true);
    // O responsável do grupo abre, sem valores.
    const asSeller = (await panel.loadPanelData(seller, {
      kind: "group",
      id: groupId,
    }))!;
    expect(asSeller.rows.every((r) => r.valueBrl === null)).toBe(true);
    expect(asSeller.canManage).toBe(false);
    // O comprador não abre a carteira.
    await expect(
      panel.loadPanelData(buyer, { kind: "group", id: groupId }),
    ).rejects.toThrow("forbidden");
    expect(panel.parseScope("g:abc")).toEqual({ kind: "group", id: "abc" });
    expect(panel.parseScope("x:abc")).toBeNull();
  });

  it("produto do catálogo: grupo (família) e categoria (linha)", async () => {
    const store = getStore();
    const [line] = await store.list("product_lines", { limit: 1 });
    await store.update("product_lines", line.id, { familyCode: "99999001" });
    await store.create("product_families", {
      code: "99999001",
      name: "DECORACAO TESTE",
      nameKey: "fm:DECORACAO TESTE",
      active: true,
      syncedAt: null,
    } as never);
    const [product] = await store.list("products", {
      filter: { lineId: line.id },
      limit: 1,
    });
    await store.update("products", product.id, { sankhyaCode: "10" });
    const infos = await panel.productInfos(["10", "999"]);
    expect(infos.get("10")).toMatchObject({
      group: "DECORACAO TESTE",
      category: line.name,
      productId: product.id,
    });
    expect(infos.has("999")).toBe(false);
  });
});
