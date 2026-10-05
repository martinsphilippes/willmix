import { describe, expect, it } from "vitest";
import {
  planSheet,
  suggestContainerFill,
} from "@/lib/services/purchase-sheet-calc";

/* Sugestão para fechar o container: 4,6 → +N caixas para 5 (sem passar) ou −M para 4. */

const plan = (cartons: number[], cbmPerCarton: number, capacity: number) =>
  planSheet(
    {
      lots: cartons.map((c) => ({
        departureIntervalDays: 30,
        masterCartons: c,
      })),
      masterCartonQty: 24,
      cbmPerCarton,
      productionStartAt: "2026-11-02T00:00:00.000Z",
      heightCm: null,
      widthCm: null,
      lengthCm: null,
    },
    capacity,
  );

describe("fechar o container", () => {
  it("4,6 containers: faltam caixas para fechar 5 sem passar; ou tirar para fechar em 4", () => {
    // 3128 caixas × 0,1 m³ = 312,8 m³; 40HC de 68 m³ → 4,6 containers.
    const p = plan([3128], 0.1, 68);
    expect(p.containers).toBe(4.6);
    const s = suggestContainerFill(p, 0.1, 24)!;
    expect(s.lower).toBe(4);
    expect(s.target).toBe(5);
    expect(s.lastPct).toBe(60);
    expect(s.exact).toBe(false);
    // 5 × 68 = 340; faltam 27,2 m³ = 272 caixas (6.528 peças), fecha em 5,00.
    expect(s.addCartons).toBe(272);
    expect(s.addPieces).toBe(6528);
    expect(s.addCbm).toBe(27.2);
    expect(plan([3128 + 272], 0.1, 68).containers).toBe(5);
    // Tirar 408 caixas (40,8 m³) fecha em 4.
    expect(s.removeCartons).toBe(408);
    expect(s.removePieces).toBe(9792);
    expect(plan([3128 - 408], 0.1, 68).containers).toBe(4);
  });

  it("nunca passa do alvo: caixa que não cabe inteira fica de fora", () => {
    // 65 m³ ocupados; caixa de 0,7 m³; faltam 3 m³ → 4 caixas (2,8 m³), não 5.
    const p = plan([Math.round(65 / 0.7)], 0.7, 68);
    const s = suggestContainerFill(p, 0.7, 10)!;
    const after = p.totalCbm! + s.addCartons * 0.7;
    expect(after).toBeLessThanOrEqual(68);
    expect(after + 0.7).toBeGreaterThan(68);
  });

  it("containers fechados: nada a ajustar; abaixo de 1 container não há redução", () => {
    const exact = suggestContainerFill(plan([680], 0.1, 68), 0.1, 24)!;
    expect(exact.exact).toBe(true);
    expect(exact.lower).toBe(1);
    expect(exact.addCartons).toBe(0);
    expect(exact.removeCartons).toBeNull();
    const small = suggestContainerFill(plan([50], 0.06, 68), 0.06, 24)!;
    expect(small.lower).toBe(0);
    expect(small.target).toBe(1);
    expect(small.addCartons).toBe(1083);
    expect(small.removeCartons).toBeNull();
  });

  it("sem CBM da caixa, capacidade ou caixas: sem sugestão; sem peças por caixa: sem peças", () => {
    expect(suggestContainerFill(plan([10], 0.1, 68), null, 24)).toBeNull();
    expect(suggestContainerFill(plan([10], 0.1, 0), 0.1, 24)).toBeNull();
    expect(suggestContainerFill(plan([], 0.1, 68), 0.1, 24)).toBeNull();
    const s = suggestContainerFill(plan([10], 0.1, 68), 0.1, null)!;
    expect(s.addPieces).toBeNull();
    expect(s.addCartons).toBe(670);
  });
});
