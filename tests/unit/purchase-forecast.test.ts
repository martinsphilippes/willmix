import { describe, expect, it } from "vitest";
import {
  byDate,
  estimateDemand,
  splitRecommendation,
  yearTotals,
  LEAD_MONTHS,
} from "@/lib/purchase-forecast";

/*
 * Análise de compras (dono, 19/11/2026; docs/PURCHASE_HISTORY.md seção 12):
 * compras por ano e mês e a estimativa de demanda, com a sugestão da próxima
 * compra 4 meses antes de a última acabar.
 */
describe("análise de compras de um produto", () => {
  it("soma por ano e mês e completa com zero os meses sem compra até hoje", () => {
    const years = yearTotals(
      [
        { date: "2025-10-10", quantity: 100, value: 1000 },
        { date: "2025-10-20", quantity: 50, value: 500 },
        { date: "2025-12-01", quantity: 200, value: 2000 },
        { date: "2026-02-01", quantity: 300, value: 3000 },
      ],
      "2026-04-15",
    );
    expect(
      years.map((y) => [y.year, y.quantity, y.value, y.purchases]),
    ).toEqual([
      ["2026", 300, 3000, 1],
      ["2025", 350, 3500, 3],
    ]);
    // De outubro/2025 a abril/2026, com os meses vazios em zero.
    expect(years[1].months.map((m) => [m.month, m.quantity])).toEqual([
      ["2025-10", 150],
      ["2025-11", 0],
      ["2025-12", 200],
    ]);
    expect(years[0].months.map((m) => [m.month, m.quantity, m.value])).toEqual([
      ["2026-01", 0, 0],
      ["2026-02", 300, 3000],
      ["2026-03", 0, 0],
      ["2026-04", 0, 0],
    ]);
    // Sem valores (quem não vê valores): nulos.
    expect(
      yearTotals([{ date: "2026-01-05", quantity: 1 }], "2026-01-31")[0].value,
    ).toBeNull();
  });

  it("usar a recomendação: reparte pela demanda das entregas, em caixas inteiras", () => {
    const estimate = {
      suggestedQuantity: 1000,
      monthly: 100,
      intervalMonths: 3,
      months: [],
    };
    // Uma entrega: tudo nela, arredondado para cima em caixas de 48.
    expect(splitRecommendation(estimate, ["2027-03-01"], 48)).toEqual([1008]);
    // Três entregas a cada 30 dias, demanda estável: partes iguais.
    const three = splitRecommendation(
      estimate,
      ["2027-03-01", "2027-03-31", "2027-04-30"],
      48,
    );
    expect(three.reduce((a, b) => a + b, 0)).toBe(1008);
    expect(three.every((q) => q % 48 === 0)).toBe(true);
    expect(Math.max(...three) - Math.min(...three)).toBeLessThanOrEqual(48);
    // Demanda maior no mês da 2ª entrega: ela leva mais.
    const peak = splitRecommendation(
      {
        ...estimate,
        months: [
          { month: "2027-03", quantity: 100 },
          { month: "2027-04", quantity: 300 },
        ],
      },
      ["2027-03-01", "2027-04-01"],
      1,
    );
    expect(peak[1]).toBeGreaterThan(peak[0]);
    expect(peak[0] + peak[1]).toBe(1000);
    // Datas do pedido ainda sem a 1ª: uma parte por entrega, iguais.
    expect(splitRecommendation(estimate, ["", ""], 1)).toEqual([500, 500]);
  });

  it("compras do mesmo dia viram uma; sem duas compras não há estimativa", () => {
    expect(
      byDate([
        { date: "2026-01-01", quantity: 10 },
        { date: "2026-01-01", quantity: 5 },
      ]),
    ).toEqual([{ date: "2026-01-01", quantity: 15 }]);
    expect(
      estimateDemand([{ date: "2026-01-01", quantity: 10 }], "2026-11-19"),
    ).toBeNull();
  });

  it("demanda estável: quantidade ÷ meses entre compras e a sugestão 4 meses antes de acabar", () => {
    const e = estimateDemand(
      [
        { date: "2025-12-01", quantity: 300 },
        { date: "2026-03-02", quantity: 300 },
        { date: "2026-06-01", quantity: 300 },
        { date: "2026-08-31", quantity: 300 },
      ],
      "2026-09-15",
    )!;
    expect(e.monthly).toBeGreaterThanOrEqual(98);
    expect(e.monthly).toBeLessThanOrEqual(102);
    expect(Math.abs(e.slope)).toBeLessThan(2);
    // A última (300 peças, ~100/mês) acaba ~3 meses depois.
    expect(e.runOut.slice(0, 7)).toBe("2026-11");
    // Sugestão 4 meses antes de acabar: já passou em 15/09/2026.
    expect(LEAD_MONTHS).toBe(4);
    expect(e.suggestedDate.slice(0, 7)).toBe("2026-07");
    expect(e.late).toBe(true);
    expect(e.suggestedQuantity).toBeGreaterThanOrEqual(290);
    expect(e.suggestedQuantity).toBeLessThanOrEqual(310);
    expect(e.months).toHaveLength(12);
    expect(e.months[0].month).toBe("2026-09");
    expect(e.years.map((y) => y.year)).toEqual(["2026", "2027"]);
  });

  it("demanda crescendo: a tendência sobe e a previsão segue a reta", () => {
    const e = estimateDemand(
      [
        { date: "2026-01-01", quantity: 100 },
        { date: "2026-02-01", quantity: 200 },
        { date: "2026-03-01", quantity: 300 },
        { date: "2026-04-01", quantity: 400 },
      ],
      "2026-04-15",
    )!;
    expect(e.slope).toBeGreaterThan(50);
    expect(e.months[5].quantity).toBeGreaterThan(e.months[0].quantity);
  });
});
