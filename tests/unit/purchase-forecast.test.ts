import { describe, expect, it } from "vitest";
import {
  byDate,
  estimateDemand,
  yearTotals,
  LEAD_MONTHS,
} from "@/lib/purchase-forecast";

/*
 * Análise de compras (dono, 19/11/2026; docs/PURCHASE_HISTORY.md seção 12):
 * compras por ano e mês e a estimativa de demanda, com a sugestão da próxima
 * compra 4 meses antes de a última acabar.
 */
describe("análise de compras de um produto", () => {
  it("soma por ano e mês, do ano mais recente ao mais antigo", () => {
    const years = yearTotals([
      { date: "2025-01-10", quantity: 100 },
      { date: "2025-01-20", quantity: 50 },
      { date: "2025-06-01", quantity: 200 },
      { date: "2026-02-01", quantity: 300 },
    ]);
    expect(years.map((y) => [y.year, y.quantity, y.purchases])).toEqual([
      ["2026", 300, 1],
      ["2025", 350, 3],
    ]);
    expect(years[1].months).toEqual([
      { month: "2025-01", quantity: 150, purchases: 2 },
      { month: "2025-06", quantity: 200, purchases: 1 },
    ]);
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
