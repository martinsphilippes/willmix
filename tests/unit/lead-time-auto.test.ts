import { describe, expect, it } from "vitest";
import { leadTimeFromLots } from "@/lib/services/purchase-sheet-calc";

/*
 * Prazo de produção da cotação: não é digitado; é o "Saída em (dias)" da
 * programação 1 (dias entre o início da produção e a saída da 1ª remessa).
 */
const lot = (days: number | null, cartons: number | null = 10) => ({
  departureIntervalDays: days,
  masterCartons: cartons,
});

describe("prazo de produção pela programação 1", () => {
  it("é o 'Saída em (dias)' da 1ª programação, não a soma das outras", () => {
    expect(leadTimeFromLots([lot(45), lot(30), lot(30)])).toBe(45);
  });

  it("zero vale (mercadoria pronta no início da produção)", () => {
    expect(leadTimeFromLots([lot(0)])).toBe(0);
  });

  it("sem programação 1 (ou inválida) não há prazo", () => {
    expect(leadTimeFromLots(null)).toBeNull();
    expect(leadTimeFromLots([])).toBeNull();
    expect(leadTimeFromLots([lot(null)])).toBeNull();
    expect(leadTimeFromLots([lot(-3)])).toBeNull();
    expect(leadTimeFromLots([lot(4.5)])).toBeNull();
    expect(leadTimeFromLots([lot(9999)])).toBeNull();
  });
});
