import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Visão Produto do histórico do cliente pelo Sankhya (Nova solicitação, dono,
 * 15/11/2026; docs/PURCHASE_HISTORY.md seção 11): os produtos dos pedidos da
 * lista, pelo código no Sankhya, com o total do período e a quantidade de
 * cada data (dois pedidos no mesmo dia somam numa linha), da mais recente
 * para a mais antiga, nas unidades do Sankhya. O cliente sempre no filtro e
 * só inteiros no SQL; a mesma permissão da lista.
 */
withTempStore();
const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const sh = await import("@/lib/services/sankhya-customer-history");
const { sortProducts, PRODUCT_SORTS } =
  await import("@/lib/sankhya-product-sort");
type ProductSort = import("@/lib/sankhya-product-sort").ProductSort;
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

const LOUSA = "LOUSA MAGICA B-FLY SRT COR 16,5CM X 23CM";
const PISTOLA = "PISTOLA LANCA BOLHAS A FRICCAO PEIXE SRT COR";

/** Pedidos do cliente, do mais recente para o mais antigo (como a view). */
const ORDERS: Array<[number, string]> = [
  [1490845, "15092026 00:00:00"],
  // Outro pedido no mesmo dia.
  [1490844, "15092026 00:00:00"],
  [1480001, "01082026 00:00:00"],
  [1470001, "01072026 00:00:00"],
];
/**
 * Itens: NUNOTA, SEQUENCIA, DATA_PEDIDO, CODPROD, descrição, unidade, qtd. e
 * o valor líquido do item (após descontos). A lousa tem mais unidades e o
 * menor valor; a pistola, poucas unidades e o maior valor.
 */
type ItemRow = [
  number,
  number,
  string | null,
  number,
  string,
  string,
  number,
  number | null,
];
const BASE_ITEMS: ItemRow[] = [
  [1490845, 1, "15092026 00:00:00", 2391, LOUSA, "UN", 60, 99.6],
  [1490845, 2, "15092026 00:00:00", 2930, PISTOLA, "UN", 36, 450],
  [1490844, 1, "15092026 00:00:00", 2391, LOUSA, "UN", 24, 39.84],
  [1490844, 2, "15092026 00:00:00", 5000, "CAIXA MISTA", "CX", 2, 300],
  // Nome antigo do mesmo produto e item sem a data (vale a do pedido).
  [1480001, 1, null, 2391, "LOUSA MAGICA B-FLY", "UN", 36, 59.76],
  [1480001, 2, "01082026 00:00:00", 5000, "CAIXA MISTA", "UN", 10, 120],
  [1470001, 1, "01072026 00:00:00", 2391, LOUSA, "UN", 100, 166],
];

/** Sankhya de mentira: lista (GROUP BY) e itens (NUNOTA IN, em páginas). */
function fakeSankhya(items: ItemRow[] = BASE_ITEMS) {
  const sqls: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (String(input).endsWith("/authenticate"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 300 }),
      );
    const sql = JSON.parse(String(init.body)).requestBody.sql as string;
    sqls.push(sql);
    const top = Number(/SELECT TOP (\d+)/.exec(sql)![1]);
    let columns: string[];
    let rows: unknown[][];
    if (sql.includes("GROUP BY NUNOTA")) {
      columns = ["NUNOTA", "DATA_PEDIDO", "TOTAL_ITENS"];
      rows = ORDERS.slice(0, top).map(([n, d]) => [n, d, 2]);
    } else {
      const inList = /NUNOTA IN \(([^)]*)\)/
        .exec(sql)![1]
        .split(",")
        .map((v) => Number(v.trim()));
      const after =
        /\(NUNOTA > (\d+) OR \(NUNOTA = \d+ AND SEQUENCIA > (\d+)\)\)/.exec(
          sql,
        );
      columns = [
        "NUNOTA",
        "SEQUENCIA",
        "DATA_PEDIDO",
        "CODPROD",
        "DESCRICAO_PRODUTO",
        "UNIDADE_NEGOCIADA",
        "QTD_NEGOCIADA",
        "VALOR_ITEM_APOS_DESCONTO_BRL",
      ];
      rows = items
        .filter((r) => inList.includes(r[0]))
        .filter(
          (r) =>
            !after ||
            r[0] > Number(after[1]) ||
            (r[0] === Number(after[1]) && r[1] > Number(after[2])),
        )
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .slice(0, top);
    }
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

describe("SQL da visão Produto", () => {
  it("o cliente e os pedidos no filtro; a página seguinte por NUNOTA e SEQUENCIA", () => {
    expect(sh.customerItemsSql(66550, [1490845, 1490844])).toBe(
      "SELECT TOP 500 NUNOTA, SEQUENCIA, DATA_PEDIDO, CODPROD, DESCRICAO_PRODUTO, UNIDADE_NEGOCIADA, QTD_NEGOCIADA, VALOR_ITEM_APOS_DESCONTO_BRL FROM sankhya.VW_AD_PEDCLIENTE_ITEM_WELL WHERE COD_CLIENTE = 66550 AND NUNOTA IN (1490845, 1490844) ORDER BY NUNOTA, SEQUENCIA",
    );
    expect(
      sh.customerItemsSql(66550, [1490845, 1490844], {
        nunota: 1490844,
        sequence: 7,
      }),
    ).toContain(
      "AND NUNOTA IN (1490845, 1490844) AND (NUNOTA > 1490844 OR (NUNOTA = 1490844 AND SEQUENCIA > 7)) ORDER BY",
    );
  });

  it("só inteiros positivos entram no SQL", () => {
    expect(() => sh.customerItemsSql(0, [1])).toThrow("invalid_input");
    expect(() => sh.customerItemsSql(66550, [])).toThrow("invalid_input");
    expect(() => sh.customerItemsSql(66550, [1.5])).toThrow("invalid_input");
    expect(() =>
      sh.customerItemsSql(66550, [1], { nunota: -1, sequence: 0 }),
    ).toThrow("invalid_input");
  });
});

/** Item para a soma (o valor é opcional nos testes que não o usam). */
const row = (
  date: string | null,
  code: number,
  name: string,
  unit: string,
  quantity: number | null,
  value: number | null = null,
) => ({ date, code, name, unit, quantity, value });

describe("soma por produto e por data", () => {
  it("dois pedidos no mesmo dia somam numa data; o total é o do período", () => {
    const rows = BASE_ITEMS.slice(0, 6).map((r) =>
      row(
        r[2]
          ? `${r[2].slice(4, 8)}-${r[2].slice(2, 4)}-${r[2].slice(0, 2)}`
          : "2026-08-01",
        r[3],
        r[4],
        r[5],
        r[6],
        r[7],
      ),
    );
    const products = sh.productHistory(rows);
    const lousa = products.find((p) => p.code === 2391)!;
    expect(lousa.name).toBe(LOUSA);
    expect(lousa.total).toEqual([{ unit: "UN", quantity: 120 }]);
    expect(lousa.days).toEqual([
      { date: "2026-09-15", quantities: [{ unit: "UN", quantity: 84 }] },
      { date: "2026-08-01", quantities: [{ unit: "UN", quantity: 36 }] },
    ]);
    // O total do cabeçalho é a soma das datas; o valor, a soma dos itens.
    expect(lousa.days.reduce((s, d) => s + d.quantities[0].quantity, 0)).toBe(
      lousa.total[0].quantity,
    );
    expect(lousa.value).toBe(199.2);
  });

  it("unidades diferentes não se somam; sem quantidade fica fora; decimais exatos", () => {
    const products = sh.productHistory([
      row("2026-09-15", 5000, "CAIXA", "CX", 2, 300),
      row("2026-08-01", 5000, "CAIXA", "UN", 10, 120),
      row("2026-08-01", 5000, "CAIXA", "UN", null, null),
      row("2026-08-01", 7, "FITA", "M", 0.1, 0.1),
      row("2026-08-01", 7, "FITA", "M", 0.2, 0.2),
    ]);
    const caixa = products.find((p) => p.code === 5000)!;
    expect(caixa.total).toEqual([
      { unit: "CX", quantity: 2 },
      { unit: "UN", quantity: 10 },
    ]);
    // O item sem quantidade fica fora também do valor.
    expect(caixa.value).toBe(420);
    const fita = products.find((p) => p.code === 7)!;
    expect(fita.total).toEqual([{ unit: "M", quantity: 0.3 }]);
    expect(fita.value).toBe(0.3);
  });

  it("valor indisponível: um item sem valor deixa o total do produto sem valor", () => {
    const products = sh.productHistory([
      row("2026-09-15", 1, "COM VALOR", "UN", 5, 50),
      row("2026-09-15", 2, "SEM VALOR", "UN", 5, 50),
      row("2026-08-01", 2, "SEM VALOR", "UN", 5, null),
      row("2026-08-01", 3, "ZERO", "UN", 1, 0),
    ]);
    expect(products.find((p) => p.code === 1)!.value).toBe(50);
    expect(products.find((p) => p.code === 2)!.value).toBeNull();
    // Valor zero é valor (ex.: bonificação), não "—".
    expect(products.find((p) => p.code === 3)!.value).toBe(0);
  });

  it("produtos do comprado mais recentemente para o mais antigo; empate pelo nome", () => {
    const products = sh.productHistory([
      row("2026-07-01", 1, "ANTIGO", "UN", 1),
      row("2026-09-15", 3, "PISTOLA", "UN", 1),
      row("2026-09-15", 2, "LOUSA", "UN", 1),
      row(null, 4, "SEM DATA", "UN", 1),
    ]);
    expect(products.map((p) => p.code)).toEqual([2, 3, 1, 4]);
  });
});

describe("Ordenar (Mais un., Menos un., Maior valor, Menor valor)", () => {
  // A ordem por unidades é diferente da ordem por valor.
  const products = sh.productHistory([
    row("2026-09-15", 2391, "LOUSA", "UN", 84, 139.44),
    row("2026-08-01", 2391, "LOUSA", "UN", 36, 59.76),
    row("2026-09-15", 2930, "PISTOLA", "UN", 36, 450),
    row("2026-09-15", 5000, "CAIXA MISTA", "CX", 2, 300),
    row("2026-08-01", 5000, "CAIXA MISTA", "UN", 10, 120),
    row("2026-08-01", 6000, "SEM VALOR", "UN", 50, null),
  ]);
  const order = (sort: ProductSort) =>
    sortProducts(products, sort).map((p) => p.name);

  it("Mais un. e Menos un.: pela quantidade total pedida", () => {
    expect(order("units_desc")).toEqual([
      "LOUSA",
      "SEM VALOR",
      "PISTOLA",
      "CAIXA MISTA",
    ]);
    expect(order("units_asc")).toEqual([
      "CAIXA MISTA",
      "PISTOLA",
      "SEM VALOR",
      "LOUSA",
    ]);
  });

  it("Maior valor e Menor valor: pelo valor total; sem valor sempre no fim", () => {
    expect(order("value_desc")).toEqual([
      "PISTOLA",
      "CAIXA MISTA",
      "LOUSA",
      "SEM VALOR",
    ]);
    expect(order("value_asc")).toEqual([
      "LOUSA",
      "CAIXA MISTA",
      "PISTOLA",
      "SEM VALOR",
    ]);
  });

  it("as datas de cada produto não mudam e a lista recebida fica como estava", () => {
    const before = products.map((p) => p.key);
    const lousa = sortProducts(products, "value_asc")[0];
    expect(lousa.days.map((d) => d.date)).toEqual(["2026-09-15", "2026-08-01"]);
    expect(products.map((p) => p.key)).toEqual(before);
    expect(PRODUCT_SORTS).toEqual([
      "units_desc",
      "units_asc",
      "value_desc",
      "value_asc",
    ]);
  });
});

describe("visão Produto pelo Sankhya", () => {
  it("os produtos dos pedidos da lista, com o período, as datas e os totais", async () => {
    const { sqls, options } = fakeSankhya();
    const result = await sh.sankhyaCustomerProducts(
      admin,
      CUSTOMER,
      3,
      options,
    );
    if (result.state !== "ok") throw new Error(result.state);
    expect(result).toMatchObject({
      orders: 3,
      from: "2026-08-01",
      to: "2026-09-15",
      complete: true,
      money: true,
    });
    // A lista é a mesma da visão Pedido (os 3 mais recentes) e os itens vêm
    // só desses pedidos, com o cliente no filtro.
    expect(sqls[0]).toContain("SELECT TOP 3 ");
    expect(sqls[0]).toContain("COD_CLIENTE = 66550");
    expect(sqls[1]).toContain(
      "WHERE COD_CLIENTE = 66550 AND NUNOTA IN (1490845, 1490844, 1480001)",
    );
    const lousa = result.products.find((p) => p.code === 2391)!;
    expect(lousa.name).toBe(LOUSA);
    expect(lousa.total).toEqual([{ unit: "UN", quantity: 120 }]);
    expect(lousa.days).toEqual([
      // 60 + 24: dois pedidos no mesmo dia.
      { date: "2026-09-15", quantities: [{ unit: "UN", quantity: 84 }] },
      // Item sem data: a do pedido.
      { date: "2026-08-01", quantities: [{ unit: "UN", quantity: 36 }] },
    ]);
    expect(result.products.find((p) => p.code === 2930)!.total).toEqual([
      { unit: "UN", quantity: 36 },
    ]);
    expect(result.products.find((p) => p.code === 5000)!.total).toEqual([
      { unit: "CX", quantity: 2 },
      { unit: "UN", quantity: 10 },
    ]);
    // Valor total do período: os valores líquidos dos itens (após descontos).
    expect(sqls[1]).toContain("VALOR_ITEM_APOS_DESCONTO_BRL");
    expect(lousa.value).toBe(199.2);
    expect(result.products.find((p) => p.code === 2930)!.value).toBe(450);
    expect(result.products.find((p) => p.code === 5000)!.value).toBe(420);
    // Mais um pedido na lista: o período e o total crescem juntos.
    const four = await sh.sankhyaCustomerProducts(admin, CUSTOMER, 4, options);
    if (four.state !== "ok") throw new Error(four.state);
    expect(four.from).toBe("2026-07-01");
    expect(four.products.find((p) => p.code === 2391)!.total).toEqual([
      { unit: "UN", quantity: 220 },
    ]);
    expect(four.products.find((p) => p.code === 2391)!.value).toBe(365.2);
  });

  it("muitos itens: lê em páginas até o fim, sem repetir nem pular", async () => {
    const many: ItemRow[] = Array.from({ length: 1203 }, (_, i) => [
      1490845,
      i + 1,
      "15092026 00:00:00",
      2391,
      LOUSA,
      "UN",
      1,
      1.5,
    ]);
    const { sqls, options } = fakeSankhya(many);
    const result = await sh.sankhyaCustomerProducts(
      admin,
      CUSTOMER,
      1,
      options,
    );
    if (result.state !== "ok") throw new Error(result.state);
    expect(result.complete).toBe(true);
    expect(result.products[0].total).toEqual([{ unit: "UN", quantity: 1203 }]);
    expect(result.products[0].value).toBe(1804.5);
    // Lista + 3 páginas de itens (500 + 500 + 203).
    expect(sqls).toHaveLength(4);
    expect(sqls[2]).toContain(
      "(NUNOTA > 1490845 OR (NUNOTA = 1490845 AND SEQUENCIA > 500))",
    );
  });

  it("cliente sem pedidos: período vazio, sem ler itens", async () => {
    const { sqls, options } = fakeSankhya();
    const original = ORDERS.splice(0, ORDERS.length);
    try {
      const result = await sh.sankhyaCustomerProducts(
        admin,
        CUSTOMER,
        10,
        options,
      );
      expect(result).toEqual({
        state: "ok",
        products: [],
        orders: 0,
        from: null,
        to: null,
        complete: true,
        money: true,
      });
      expect(sqls).toHaveLength(1);
    } finally {
      ORDERS.push(...original);
    }
  });

  it("a mesma permissão da lista: só a Wellmix e o cliente com código", async () => {
    const { sqls, options } = fakeSankhya();
    expect(
      (await sh.sankhyaCustomerProducts(joao, CUSTOMER, 10, options)).state,
    ).toBe("forbidden");
    // Sem "Ver valores e margem": vê as unidades, sem os valores.
    const op = await sh.sankhyaCustomerProducts(operator, CUSTOMER, 3, options);
    if (op.state !== "ok") throw new Error(op.state);
    expect(op.money).toBe(false);
    expect(op.products.every((p) => p.value === null)).toBe(true);
    expect(op.products.find((p) => p.code === 2391)!.total).toEqual([
      { unit: "UN", quantity: 120 },
    ]);
    await getStore().update("parties", CUSTOMER, { sankhyaCode: null });
    expect(
      (await sh.sankhyaCustomerProducts(admin, CUSTOMER, 10, options)).state,
    ).toBe("no_code");
    await getStore().update("parties", CUSTOMER, { sankhyaCode: "66550" });
    expect(
      (await sh.sankhyaCustomerProducts(admin, CUSTOMER, 10, { config: null }))
        .state,
    ).toBe("not_configured");
    // Só a leitura do operador chegou ao Sankhya.
    expect(sqls.length).toBe(2);
  });
});
