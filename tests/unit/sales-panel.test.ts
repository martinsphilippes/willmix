import { describe, expect, it } from "vitest";
import {
  NO_GROUP,
  abc,
  compareYears,
  customers,
  diagnosis,
  diagnosisFocusOf,
  executive,
  filterRows,
  frequency,
  lifecycle,
  mix,
  periods,
  productTotals,
  stock,
  type ProductInfo,
  type SaleRow,
} from "@/lib/sales-panel";

/*
 * Cálculos do painel do cliente e do grupo (docs/TRADE_COMERCIAL.md, PR 4):
 * as telas 01 a 11 do painel do Projeto Campineira sobre a base de vendas
 * real (mês × cliente × produto), com as mesmas regras do HTML (ABC 80/95,
 * Top 10, alcance, recência) e o que a planilha não permitia (venda por mês,
 * ano contra ano e recompra).
 */

const row = (
  customerId: string,
  month: string,
  productCode: string,
  pieces: number | null,
  extra: Partial<SaleRow> = {},
): SaleRow => ({
  customerId,
  month,
  productCode,
  productName: `Produto ${productCode}`,
  unit: "UN",
  quantity: pieces ?? 1,
  pieces,
  valueBrl: (pieces ?? 0) * 2,
  orders: 1,
  lastOrderDate: `${month}-15`,
  ...extra,
});

const products = new Map<string, ProductInfo>([
  [
    "1",
    {
      name: "Luminária",
      sku: "WX1",
      group: "DECORACAO",
      category: "LUMINARIAS",
      productId: "p1",
    },
  ],
  [
    "2",
    {
      name: "Vaso",
      sku: "WX2",
      group: "DECORACAO",
      category: "VASOS",
      productId: "p2",
    },
  ],
  [
    "3",
    {
      name: "Panela",
      sku: "WX3",
      group: "COZINHA",
      category: "PANELAS",
      productId: "p3",
    },
  ],
]);

const rows: SaleRow[] = [
  row("c1", "2025-01", "1", 100),
  row("c1", "2025-02", "1", 50),
  row("c2", "2025-02", "1", 30),
  row("c1", "2026-01", "1", 80),
  row("c1", "2026-03", "2", 20),
  row("c2", "2026-02", "3", 10),
  row("c2", "2026-02", "4", null, { unit: "CX", quantity: 2 }),
];

describe("filtros e totais por produto", () => {
  it("ano, trimestre, grupo, busca e cliente", () => {
    expect(filterRows(rows, products, { year: "2025" })).toHaveLength(3);
    expect(
      filterRows(rows, products, { year: "2026", quarter: 1 }),
    ).toHaveLength(4);
    expect(filterRows(rows, products, { group: "COZINHA" })).toHaveLength(1);
    expect(filterRows(rows, products, { group: NO_GROUP })).toHaveLength(1);
    expect(filterRows(rows, products, { q: "wx2" })).toHaveLength(1);
    expect(
      filterRows(
        rows,
        products,
        { q: "atacado" },
        new Map([["c2", "Atacado X"]]),
      ),
    ).toHaveLength(3);
    expect(filterRows(rows, products, { customerId: "c2" })).toHaveLength(3);
  });

  it("peças, clientes, pedidos, última compra e o que não converteu", () => {
    const totals = productTotals(rows, products);
    expect(totals.map((p) => p.code)).toEqual(["1", "2", "3", "4"]);
    const p1 = totals[0];
    expect(p1).toMatchObject({
      pieces: 260,
      orders: 4,
      group: "DECORACAO",
      sku: "WX1",
      lastOrderDate: "2026-01-15",
    });
    expect([...p1.customers].sort()).toEqual(["c1", "c2"]);
    const p4 = totals.find((p) => p.code === "4")!;
    expect(p4).toMatchObject({ pieces: 0, unconverted: 1, group: NO_GROUP });
  });
});

describe("telas 01 a 10", () => {
  const totals = productTotals(rows, products);

  it("01 · visão executiva", () => {
    const e = executive(totals);
    expect(e).toMatchObject({ pieces: 290, skus: 4, customers: 2, orders: 7 });
    expect(e.top10Share).toBe(1);
    expect(e.groups[0]).toEqual({ label: "DECORACAO", value: 280 });
    expect(e.unconverted).toBe(1);
  });

  it("03 · curva ABC pelas peças (A até 80%, B até 95%)", () => {
    const list = Array.from({ length: 10 }, (_, i) => ({
      ...totals[0],
      code: String(i),
      pieces: [50, 20, 10, 6, 5, 3, 2, 2, 1, 1][i],
    }));
    const a = abc(list);
    expect(a.rows.map((r) => r.cls).join("")).toBe("AAABBBBCCC");
    expect(a.classes.A).toEqual({ skus: 3, pieces: 80 });
    expect(a.rows.at(-1)!.cumulative).toBeCloseTo(1);
  });

  it("04 · alcance e recompra (2+ pedidos)", () => {
    const f = frequency(rows, totals);
    expect(f).toMatchObject({
      customers: 2,
      pairs: 5,
      multiCustomerSkus: 1,
      repurchased: 1,
    });
    expect(f.avgSkusPerCustomer).toBe(2.5);
    expect(f.topReach[0].code).toBe("1");
  });

  it("05 · por mês, trimestre e ano", () => {
    const p = periods(rows);
    expect(p.months.map((m) => [m.key, m.pieces])).toEqual([
      ["2025-01", 100],
      ["2025-02", 80],
      ["2026-01", 80],
      ["2026-02", 10],
      ["2026-03", 20],
    ]);
    expect(p.quarters.map((q) => q.key)).toEqual(["2025 · T1", "2026 · T1"]);
  });

  it("06 · ano contra ano só nos mesmos meses", () => {
    const c = compareYears(rows, "2025", "2026");
    expect(c.sameMonths).toBe(3);
    expect(c.totalA).toBe(180);
    expect(c.totalB).toBe(110);
    expect(c.change).toBeCloseTo((110 - 180) / 180);
    expect(c.rows[0]).toEqual({ month: "01", a: 100, b: 80 });
  });

  it("07 · mix por grupo e por categoria", () => {
    const m = mix(totals);
    expect(m.groups[0]).toEqual({ label: "DECORACAO", value: 280 });
    expect(m.categories.map((c) => c.label)).toContain("PANELAS");
  });

  it("08 · estoque livre (físico menos reservas), em trânsito e em produção", () => {
    const s = stock(
      totals,
      new Map([
        ["p1", { brazil: 100, reserved: 30, transit: 0, production: 0 }],
        ["p2", { brazil: 5, reserved: 5, transit: 50, production: 0 }],
      ]),
    );
    expect(s.rows.find((r) => r.code === "1")!.free).toBe(70);
    expect(s).toMatchObject({ withStock: 1, coming: 1 });
    expect(s.soldWithoutStock).toBe(2);
    expect(s.rows.find((r) => r.code === "4")!.inCatalog).toBe(false);
  });

  it("09 · ciclo de vida pela última compra", () => {
    const l = lifecycle(totals, "2026-11-19");
    expect(l.counts).toEqual({ d90: 0, d180: 0, d365: 4, older: 0 });
    const l2 = lifecycle(totals, "2027-06-01");
    expect(l2.counts.older).toBe(4);
    expect(l2.rows[0].days).toBeGreaterThan(l2.rows.at(-1)!.days - 1);
  });

  it("10 · clientes: peças, SKUs, pedidos e dias sem compra", () => {
    const list = customers(rows, "2026-11-19");
    expect(list[0]).toMatchObject({
      customerId: "c1",
      pieces: 250,
      skus: 2,
      orders: 4,
      lastOrderDate: "2026-03-15",
    });
    expect(list[0].daysWithoutPurchase).toBe(249);
  });
});

describe("11 · diagnóstico", () => {
  it("o primeiro foco que se aplica: Top 10, sem compra, alcance, baixo volume", () => {
    const ctx = {
      top10: new Set(["1"]),
      mean: 50,
      today: "2026-11-19",
      groupScope: true,
    };
    const base = {
      pieces: 100,
      customers: new Set(["a", "b"]),
      lastOrderDate: "2026-11-01",
    };
    expect(diagnosisFocusOf({ ...base, code: "1" }, ctx)).toBe("leaders");
    expect(
      diagnosisFocusOf(
        { ...base, code: "9", lastOrderDate: "2026-01-01" },
        ctx,
      ),
    ).toBe("recency");
    expect(
      diagnosisFocusOf({ ...base, code: "9", customers: new Set(["a"]) }, ctx),
    ).toBe("reach");
    expect(
      diagnosisFocusOf(
        { ...base, code: "9", customers: new Set(["a"]) },
        { ...ctx, groupScope: false },
      ),
    ).toBe("growth");
    expect(diagnosisFocusOf({ ...base, code: "9", pieces: 10 }, ctx)).toBe(
      "low",
    );
  });

  it("filtra pelo foco escolhido", () => {
    const totals = productTotals(rows, products);
    const all = diagnosis(totals, "all", "2026-11-19", true);
    expect(all).toHaveLength(4);
    expect(diagnosis(totals, "leaders", "2026-11-19", true)).toHaveLength(4);
    expect(diagnosis(totals, "recency", "2026-11-19", true)).toHaveLength(0);
  });
});
