import { describe, expect, it } from "vitest";
import {
  generateLots,
  planSheet,
  MAX_LOTS,
} from "@/lib/services/purchase-sheet-calc";

/* Atalho "Gerar programação": total de caixas dividido em N programações com intervalo. */
describe("gerar programação", () => {
  it("divide igualmente; o resto vai para as primeiras", () => {
    expect(
      generateLots({
        totalCartons: 100,
        count: 4,
        intervalDays: 45,
        firstDays: 45,
      }),
    ).toEqual({
      lots: [
        { departureIntervalDays: 45, masterCartons: 25 },
        { departureIntervalDays: 45, masterCartons: 25 },
        { departureIntervalDays: 45, masterCartons: 25 },
        { departureIntervalDays: 45, masterCartons: 25 },
      ],
    });
    const r = generateLots({
      totalCartons: 102,
      count: 4,
      intervalDays: 30,
      firstDays: 60,
    });
    expect("lots" in r && r.lots.map((l) => l.masterCartons)).toEqual([
      26, 26, 25, 25,
    ]);
    expect("lots" in r && r.lots.map((l) => l.departureIntervalDays)).toEqual([
      60, 30, 30, 30,
    ]);
  });

  it("datas saem da mesma conta da ficha: início + 1ª saída + intervalos", () => {
    const r = generateLots({
      totalCartons: 90,
      count: 3,
      intervalDays: 30,
      firstDays: 45,
    });
    if (!("lots" in r)) throw new Error("esperava lotes");
    const plan = planSheet(
      {
        lots: r.lots,
        masterCartonQty: 24,
        cbmPerCarton: 0.1,
        productionStartAt: "2026-11-01T00:00:00.000Z",
        heightCm: null,
        widthCm: null,
        lengthCm: null,
      },
      null,
    );
    expect(
      plan.lots.slice(0, 3).map((l) => l.departureAt?.slice(0, 10)),
    ).toEqual(["2026-12-16", "2027-01-15", "2027-02-14"]);
    expect(plan.totalCartons).toBe(90);
    expect(plan.totalPieces).toBe(2160);
  });

  it("uma programação só usa a 1ª saída", () => {
    expect(
      generateLots({
        totalCartons: 40,
        count: 1,
        intervalDays: 45,
        firstDays: 20,
      }),
    ).toEqual({ lots: [{ departureIntervalDays: 20, masterCartons: 40 }] });
  });

  it("recusa total inválido ou menor que o nº de programações", () => {
    for (const totalCartons of [0, 3, 2.5, NaN, -10, 10_000_001])
      expect(
        generateLots({
          totalCartons,
          count: 4,
          intervalDays: 45,
          firstDays: 45,
        }),
      ).toEqual({ error: "total" });
  });

  it("recusa intervalo e 1ª saída fora de 1 a 365 dias", () => {
    for (const intervalDays of [0, 366, 1.5, NaN])
      expect(
        generateLots({
          totalCartons: 100,
          count: 2,
          intervalDays,
          firstDays: 45,
        }),
      ).toEqual({ error: "interval" });
    for (const firstDays of [0, 366, NaN])
      expect(
        generateLots({
          totalCartons: 100,
          count: 2,
          intervalDays: 45,
          firstDays,
        }),
      ).toEqual({ error: "first" });
  });

  it("nº de programações fica entre 1 e o máximo da ficha", () => {
    const many = generateLots({
      totalCartons: 100,
      count: 99,
      intervalDays: 30,
      firstDays: 30,
    });
    expect("lots" in many && many.lots.length).toBe(MAX_LOTS);
    const none = generateLots({
      totalCartons: 100,
      count: 0,
      intervalDays: 30,
      firstDays: 30,
    });
    expect("lots" in none && none.lots.length).toBe(1);
  });
});
