import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Histórico do cliente pelo Sankhya na Nova solicitação (dono, 15/11/2026;
 * docs/PURCHASE_HISTORY.md seção 9): a view VW_AD_PEDCLIENTE_ITEM_WELL pelo
 * DbExplorer, um registro por pedido, 10 por vez, os itens com o cliente no
 * filtro, só inteiros no SQL, valores só com "Ver valores e margem" e o
 * cliente do cadastro (nunca do navegador). Também: a programação do pedido
 * igual em todas as linhas e a previsão de preço sem a API (modo manual).
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const sh = await import("@/lib/services/sankhya-customer-history");
const { SankhyaError } = await import("@/lib/integrations/sankhya-client");
const { assertSameSchedule } = await import("@/app/app/actions/request-items");
const { buildSchedule } = await import("@/lib/workflow/request-schedule");
type User = import("@/lib/db").User;

const CUSTOMER = "cliente-joao";
let admin: User;
let operator: User;
let joao: User;

const config = {
  baseUrl: "https://api.sankhya.com.br",
  clientId: "c",
  clientSecret: "s",
  xToken: "x",
};

/** Sankhya de mentira: guarda o SQL e responde no formato do DbExplorer. */
function fakeSankhya(
  answer: (sql: string) => { columns: string[]; rows: unknown[][] },
) {
  const sqls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (String(input).endsWith("/authenticate"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 300 }),
      );
    const sql = JSON.parse(String(init.body)).requestBody.sql as string;
    sqls.push(sql);
    const { columns, rows } = answer(sql);
    return new Response(
      JSON.stringify({
        status: "1",
        responseBody: {
          fieldsMetadata: columns.map((name) => ({ name })),
          rows,
        },
      }),
    );
  }) as typeof globalThis.fetch;
  return { sqls, options: { config, fetch } };
}

const ORDER_COLUMNS = [
  "NUNOTA",
  "DATA_PEDIDO",
  "NUMNOTA",
  "CODEMP",
  "CODTIPOPER",
  "DESCRICAO_TOP",
  "PEDIDO_PENDENTE",
  "STATUS_NOTA",
  "VALOR_TOTAL_PEDIDO_BRL",
  "TOTAL_ITENS",
];
/** 23 pedidos, do mais recente (NUNOTA 1519042) para o mais antigo. */
const ORDERS = Array.from({ length: 23 }, (_, i) => [
  1519042 - i,
  `${String(14 - (i % 10)).padStart(2, "0")}112026 00:00:00`,
  9000 + i,
  3,
  135,
  "PEDIDO DE VENDA ENCOMENDA",
  i % 2 ? "N" : "S",
  "L",
  1000 + i,
  2,
]);

function ordersFake() {
  return fakeSankhya((sql) => {
    const top = Number(/SELECT TOP (\d+)/.exec(sql)![1]);
    return { columns: ORDER_COLUMNS, rows: ORDERS.slice(0, top) };
  });
}

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  operator = (
    await getStore().list("users", {
      filter: { email: "operador@wellmix.com" },
    })
  )[0];
  await getStore().update("parties", CUSTOMER, { sankhyaCode: "66550" });
});

describe("SQL do anexo", () => {
  it("lista: um registro por pedido, pela data e NUNOTA, com o cliente", () => {
    expect(sh.customerOrdersSql(66550, 11)).toBe(
      "SELECT TOP 11 NUNOTA, DATA_PEDIDO, MAX(NUMNOTA) AS NUMNOTA, MAX(CODEMP) AS CODEMP, MAX(CODTIPOPER) AS CODTIPOPER, MAX(DESCRICAO_TOP) AS DESCRICAO_TOP, MAX(PEDIDO_PENDENTE) AS PEDIDO_PENDENTE, MAX(STATUS_NOTA) AS STATUS_NOTA, MAX(VALOR_TOTAL_PEDIDO_BRL) AS VALOR_TOTAL_PEDIDO_BRL, COUNT(*) AS TOTAL_ITENS FROM sankhya.VW_AD_PEDCLIENTE_ITEM_WELL WHERE COD_CLIENTE = 66550 GROUP BY NUNOTA, DATA_PEDIDO ORDER BY DATA_PEDIDO DESC, NUNOTA DESC",
    );
  });

  it("itens: o cliente e o pedido no filtro; a página seguinte pela SEQUENCIA", () => {
    const first = sh.orderItemsSql(66550, 1519042);
    expect(first).toContain(
      "FROM sankhya.VW_AD_PEDCLIENTE_ITEM_WELL WHERE COD_CLIENTE = 66550 AND NUNOTA = 1519042 ORDER BY SEQUENCIA",
    );
    expect(first).toMatch(/^SELECT TOP 100 SEQUENCIA, CODPROD,/);
    expect(sh.orderItemsSql(66550, 1519042, 179)).toContain(
      "AND NUNOTA = 1519042 AND SEQUENCIA > 179 ORDER BY SEQUENCIA",
    );
  });

  it("só inteiros positivos entram no SQL", () => {
    expect(() => sh.customerOrdersSql(0, 11)).toThrow("invalid_input");
    expect(() => sh.customerOrdersSql(1.5, 11)).toThrow("invalid_input");
    expect(() => sh.orderItemsSql(66550, -1)).toThrow("invalid_input");
    expect(sh.sankhyaInt("66550")).toBe(66550);
    expect(sh.sankhyaInt("66550 OR 1=1")).toBeNull();
    expect(sh.sankhyaInt("")).toBeNull();
    expect(sh.sankhyaInt("0")).toBeNull();
  });
});

describe("pedidos do cliente", () => {
  it("10 por vez, com Carregar mais até o fim", async () => {
    const { sqls, options } = ordersFake();
    const p1 = await sh.sankhyaCustomerOrders(admin, CUSTOMER, 0, options);
    expect(p1.state).toBe("ok");
    if (p1.state !== "ok") return;
    expect(p1.orders).toHaveLength(10);
    expect(p1.orders[0]).toMatchObject({
      nunota: 1519042,
      numnota: 9000,
      date: "2026-11-14",
      company: 3,
      top: 135,
      pending: true,
      totalBrl: 1000,
      items: 2,
    });
    expect(p1.next).toBe(10);
    expect(sqls[0]).toContain("SELECT TOP 11 ");
    expect(sqls[0]).toContain("COD_CLIENTE = 66550");
    const p2 = await sh.sankhyaCustomerOrders(admin, CUSTOMER, 10, options);
    if (p2.state !== "ok") throw new Error(p2.state);
    expect(p2.orders.map((o) => o.nunota)[0]).toBe(1519032);
    expect(p2.next).toBe(20);
    const p3 = await sh.sankhyaCustomerOrders(admin, CUSTOMER, 20, options);
    if (p3.state !== "ok") throw new Error(p3.state);
    expect(p3.orders).toHaveLength(3);
    expect(p3.next).toBeNull();
  });

  it('sem "Ver valores e margem": os pedidos sem os valores', async () => {
    const { options } = ordersFake();
    const page = await sh.sankhyaCustomerOrders(operator, CUSTOMER, 0, options);
    if (page.state !== "ok") throw new Error(page.state);
    expect(page.orders.every((o) => o.totalBrl === null)).toBe(true);
  });

  it("só a Wellmix; cliente sem código do Sankhya cai no portal", async () => {
    const { sqls, options } = ordersFake();
    expect(
      (await sh.sankhyaCustomerOrders(joao, CUSTOMER, 0, options)).state,
    ).toBe("forbidden");
    // Fornecedor no lugar do cliente: nada.
    const supplier = (
      await getStore().list("parties", { filter: { type: "supplier" } })
    )[0];
    expect(
      (await sh.sankhyaCustomerOrders(admin, supplier.id, 0, options)).state,
    ).toBe("forbidden");
    // Sem o código no cadastro: "no_code" (a tela mostra o portal).
    await getStore().update("parties", CUSTOMER, { sankhyaCode: null });
    expect(
      (await sh.sankhyaCustomerOrders(admin, CUSTOMER, 0, options)).state,
    ).toBe("no_code");
    await getStore().update("parties", CUSTOMER, { sankhyaCode: "66550" });
    expect(sqls).toHaveLength(0);
  });

  it("Sankhya sem credenciais: not_configured (a tela mostra o portal)", async () => {
    const result = await sh.sankhyaCustomerOrders(admin, CUSTOMER, 0, {
      config: null,
    });
    expect(result.state).toBe("not_configured");
  });

  it("erro do Sankhya chega com o código e a mensagem", async () => {
    const fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith("/authenticate")
        ? new Response(JSON.stringify({ access_token: "t", expires_in: 300 }))
        : new Response(
            JSON.stringify({
              status: "0",
              statusMessage: "Invalid object name 'VW_AD_PEDCLIENTE_ITEM_WELL'",
            }),
          )) as typeof globalThis.fetch;
    const result = await sh.sankhyaCustomerOrders(admin, CUSTOMER, 0, {
      config,
      fetch,
    });
    expect(result.state).toBe("error");
    if (result.state === "error")
      expect(result.message).toContain("VW_AD_PEDCLIENTE_ITEM_WELL");
    expect(new SankhyaError("sankhya_service", "x").code).toBe(
      "sankhya_service",
    );
  });
});

describe("itens do pedido", () => {
  const ITEM_COLUMNS = [
    "SEQUENCIA",
    "CODPROD",
    "DESCRICAO_PRODUTO",
    "REFERENCIA_PRODUTO",
    "REFERENCIA_FORNECEDOR",
    "NCM",
    "UNIDADE_NEGOCIADA",
    "QTD_NEGOCIADA",
    "QTD_ENTREGUE",
    "ITEM_PENDENTE",
    "PRECO_UNITARIO_BRL",
    "DESCONTO_ITEM_BRL",
    "VALOR_ITEM_APOS_DESCONTO_BRL",
    "PRECO_UNITARIO_APOS_DESCONTO_BRL",
    "IDENTIFICACAO_CONTAINER_ITEM",
  ];
  /** 150 itens: duas páginas (100 + 50). */
  const ITEMS = Array.from({ length: 150 }, (_, i) => [
    i + 1,
    23756 + i,
    `Produto ${i + 1}`,
    `WX${i + 1}`,
    null,
    "39241000",
    "CX",
    10,
    i % 2 ? 10 : 0,
    i % 2 ? "N" : "S",
    12.5,
    5,
    120,
    12,
    null,
  ]);
  const itemsFake = () =>
    fakeSankhya((sql) => {
      const after = Number(/SEQUENCIA > (\d+)/.exec(sql)?.[1] ?? 0);
      return {
        columns: ITEM_COLUMNS,
        rows: ITEMS.filter((r) => (r[0] as number) > after).slice(0, 100),
      };
    });

  it("lê todas as páginas, com o preço após desconto", async () => {
    const { sqls, options } = itemsFake();
    const result = await sh.sankhyaOrderItems(
      admin,
      CUSTOMER,
      1519042,
      options,
    );
    if (result.state !== "ok") throw new Error(result.state);
    expect(result.items).toHaveLength(150);
    expect(sqls).toHaveLength(2);
    expect(sqls[1]).toContain("SEQUENCIA > 100");
    expect(sqls.every((s) => s.includes("COD_CLIENTE = 66550"))).toBe(true);
    expect(result.items[0]).toMatchObject({
      sequence: 1,
      code: 23756,
      name: "Produto 1",
      reference: "WX1",
      unit: "CX",
      quantity: 10,
      delivered: 0,
      pending: true,
      unitPriceBrl: 12.5,
      discountBrl: 5,
      unitNetBrl: 12,
      totalNetBrl: 120,
      supplierReference: null,
    });
  });

  it("sem valores para quem não vê valores", async () => {
    const { options } = itemsFake();
    const result = await sh.sankhyaOrderItems(
      operator,
      CUSTOMER,
      1519042,
      options,
    );
    if (result.state !== "ok") throw new Error(result.state);
    expect(
      result.items.every(
        (i) =>
          i.unitPriceBrl === null &&
          i.discountBrl === null &&
          i.unitNetBrl === null &&
          i.totalNetBrl === null,
      ),
    ).toBe(true);
  });
});

describe("programação do pedido (as datas são do pedido)", () => {
  const row = (schedule: ReturnType<typeof buildSchedule> | null) =>
    ({ schedule }) as Parameters<typeof assertSameSchedule>[0][number];
  const plan = (first: string, interval: number, quantities: number[]) =>
    buildSchedule({ firstDate: first, intervalDays: interval, quantities });

  it("mesmas datas em todos os produtos, quantidades diferentes: vale", () => {
    expect(() =>
      assertSameSchedule([
        row(plan("2027-01-10", 45, [100, 200])),
        row(plan("2027-01-10", 45, [5, 5])),
      ]),
    ).not.toThrow();
    expect(() => assertSameSchedule([row(null), row(null)])).not.toThrow();
  });

  it("número, 1ª data ou intervalo diferentes, ou um sem programação: recusa", () => {
    const a = row(plan("2027-01-10", 45, [100, 200]));
    for (const b of [
      row(plan("2027-01-10", 45, [1, 1, 1])),
      row(plan("2027-01-11", 45, [1, 1])),
      row(plan("2027-01-10", 30, [1, 1])),
      row(null),
    ])
      expect(() => assertSameSchedule([a, b])).toThrow("schedule_mismatch");
  });
});

describe("previsão de preço ao cliente final (SuperPlan, anexo 2)", () => {
  const pf = () => import("@/lib/integrations/price-forecast");
  const query = {
    productId: "prod-boneca",
    sankhyaCode: "21952",
    sku: null,
    quantity: 6192,
    customerId: CUSTOMER,
    customerSankhyaCode: "66550",
    ncm: "7323.99.00",
    netWeightKg: 0.985,
    grossWeightKg: 2.2144,
    masterBoxQty: 9,
    cbmPerCarton: 0.099456,
    price: 23.5,
    currency: "CNY",
  };
  const args = (sql: string) => /\((.*)\)$/.exec(sql)![1].split(", ");

  it("69 parâmetros na ordem do anexo; DEFAULT no que não vai; alvo no 48º", async () => {
    const { superplanSql, SUPERPLAN_PARAMS } = await pf();
    expect(SUPERPLAN_PARAMS).toHaveLength(69);
    const ida = superplanSql("FN_AD_SUPERPLAN_WELL", {
      CODPROD: 21952,
      QTD_PECAS: 6192,
    });
    expect(ida).toMatch(/^SELECT \* FROM sankhya\.FN_AD_SUPERPLAN_WELL\(/);
    const a = args(ida);
    expect(a).toHaveLength(69);
    expect(a[41]).toBe("21952"); // 42 CODPROD
    expect(a[6]).toBe("6192"); // 7 QTD_PECAS
    expect(a.filter((x) => x === "DEFAULT")).toHaveLength(67);
    const volta = superplanSql("FN_AD_SUPERPLAN_INVERSA_WELL", {
      CODPROD: 21952,
      PRECO_VENDA_ALVO: 9.2615,
    });
    expect(args(volta)[47]).toBe("9.2615");
    expect(() =>
      superplanSql("FN_AD_SUPERPLAN_WELL", { NCM: "7323'; DROP" }),
    ).toThrow("invalid_input");
    expect(() =>
      superplanSql("FN_AD_SUPERPLAN_WELL", { PRECO_ORIGEM: "abc" }),
    ).toThrow("invalid_input");
  });

  it("com código do Sankhya, só CODPROD e peças; sem ele, a ficha do portal", async () => {
    const { productInput } = await pf();
    expect(productInput(query)).toEqual({ CODPROD: 21952, QTD_PECAS: 6192 });
    expect(productInput(query, true)).toMatchObject({
      PRECO_ORIGEM: 23.5,
      MOEDA_ORIGEM: "RMB",
    });
    expect(productInput({ ...query, sankhyaCode: null })).toEqual({
      NCM: "73239900",
      PESO_LIQ_PECA: 0.985,
      PESO_BRUTO_PECA: 2.2144,
      PECAS_CAIXA: 9,
      CBM_CAIXA: 0.099456,
      QTD_PECAS: 6192,
      PRECO_ORIGEM: 23.5,
      MOEDA_ORIGEM: "RMB",
    });
  });

  const sale = {
    columns: [
      "OK",
      "MENSAGEM",
      "CUSTO_BASE_VENDA",
      "VENDA_IPI",
      "PRECO_TABELA_COM_IPI",
      "SUGESTAO_ATACADO",
      "SUGESTAO_LOJA",
      "PRECO_VENDA_META",
      "LUCRO_LIQUIDO_PERC",
      "META_LUCRO_PERC",
      "MENSAGEM_VENDA",
    ],
    rows: [["S", null, 5.1, 9.18, 11.475, 14.688, 16.524, 8.9, 24.1, 22, "ok"]],
  };

  it("ida: os preços de venda; custo e lucro só para quem vê valores", async () => {
    const { getPriceForecastAdapter } = await pf();
    const { sqls, options } = fakeSankhya(() => sale);
    const full = await getPriceForecastAdapter(true, options).forecast(query);
    expect(full).toMatchObject({
      mode: "api",
      kind: "forecast",
      salePrice: 9.18,
      retailPrice: 16.524,
      wholesalePrice: 14.688,
      tablePrice: 11.475,
      targetPrice: 8.9,
      cost: 5.1,
      profitPercent: 24.1,
      goalPercent: 22,
    });
    expect(sqls[0]).toContain("FN_AD_SUPERPLAN_WELL(");
    const plain = await getPriceForecastAdapter(false, options).forecast(query);
    expect(plain).toMatchObject({ cost: null, profitPercent: null });
  });

  it("volta: o preço máximo de compra para o preço de venda desejado", async () => {
    const { getPriceForecastAdapter } = await pf();
    const { sqls, options } = fakeSankhya(() => ({
      columns: [
        "PRECO_MAX_COMPRA_ORIGEM",
        "MOEDA_COMPRA",
        "PRECO_MAX_COMPRA_USD",
        "MENSAGEM_INVERSA",
      ],
      rows: [[4.6, "RMB", 0.64, "ok"]],
    }));
    const answer = await getPriceForecastAdapter(true, options).solve({
      ...query,
      targetFinalPriceBrl: 9.2615,
    });
    expect(answer).toEqual({
      mode: "api",
      kind: "solve",
      maxPurchasePrice: 4.6,
      maxPurchaseCurrency: "RMB",
      maxPurchaseUsd: 0.64,
    });
    expect(sqls[0]).toContain("FN_AD_SUPERPLAN_INVERSA_WELL(");
    expect(args(sqls[0])[47]).toBe("9.2615");
  });

  it("produto nunca importado: pede o preço e a conta roda de novo com o do portal", async () => {
    const { getPriceForecastAdapter } = await pf();
    const { sqls, options } = fakeSankhya((sql) =>
      args(sql)[5] === "DEFAULT"
        ? {
            columns: ["OK", "MENSAGEM"],
            rows: [["N", "PRECO_ORIGEM obrigatorio (com CODPROD...)"]],
          }
        : sale,
    );
    const answer = await getPriceForecastAdapter(true, options).forecast(query);
    expect(answer).toMatchObject({ kind: "forecast", salePrice: 9.18 });
    expect(sqls).toHaveLength(2);
    expect(args(sqls[1])[5]).toBe("23.5");
    expect(args(sqls[1])[8]).toBe("'RMB'");
  });

  it("mensagem da função e erro do Sankhya chegam à tela; sem Sankhya, manual", async () => {
    const { getPriceForecastAdapter } = await pf();
    const meta = fakeSankhya(() => ({
      columns: ["OK", "MENSAGEM_VENDA"],
      rows: [["S", "meta inatingivel com estas despesas de venda"]],
    }));
    expect(
      await getPriceForecastAdapter(true, meta.options).forecast(query),
    ).toEqual({
      mode: "api",
      kind: "error",
      message: "meta inatingivel com estas despesas de venda",
    });
    expect(
      await getPriceForecastAdapter(true, { config: null }).forecast(query),
    ).toEqual({ mode: "manual" });
  });
});
