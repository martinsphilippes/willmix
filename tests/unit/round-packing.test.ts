import { describe, expect, it } from "vitest";
import {
  roundPackingOf,
  type RequestPacking,
} from "@/lib/services/request-packing";

/*
 * Caixas master, cubagem e containers de cada programação na tabela das
 * empresas do grupo econômico (dono, 22/11/2026; docs/ECONOMIC_GROUPS.md):
 * as caixas e o m³ da ficha, os containers pela regra de sempre
 * (`packingRounds`) e "—" (nulo) quando falta o dado, nunca zero.
 */

/** A embalagem da boneca: 48 peças e 0,1202 m³ por caixa. */
function doll(perRound: number[] | null, roundPieces: number[] | null) {
  const boxes = perRound ? perRound.reduce((a, b) => a + b, 0) : 100;
  return {
    countable: true,
    perBox: { value: 48, source: { kind: "product" } },
    roundPieces,
    boxes: { value: boxes, perRound, exact: true, source: { kind: "calc" } },
    cbmPerBox: {
      value: 0.1202,
      source: { kind: "calc" },
      from: "product",
      calculated: true,
    },
    cbmTotal: Math.round(boxes * 0.1202 * 10_000) / 10_000,
  } as unknown as RequestPacking;
}

const row = {
  id: "r1",
  productName: "Boneca",
  quantity: 4800,
  schedule: null,
};

describe("caixas, cubagem e containers por programação", () => {
  it("as caixas e o m³ de cada programação e os containers no 40HC", () => {
    const out = roundPackingOf(row, doll([60, 40], [2880, 1920]), 68);
    expect(out).toEqual({
      boxes: [60, 40],
      cbm: [7.212, 4.808],
      containers: [1, 1],
      totals: { boxes: 100, cbm: 12.02, containers: 2 },
    });
  });

  it("programação que passa de um container conta mais de um", () => {
    // 700 caixas × 0,1202 m³ = 84,14 m³: dois containers de 68 m³.
    const out = roundPackingOf(row, doll([700, 100], [33600, 4800]), 68);
    expect(out.containers).toEqual([2, 1]);
    expect(out.totals.containers).toBe(3);
  });

  it("sem programação: uma coluna só, a da quantidade", () => {
    const out = roundPackingOf(row, doll(null, [4800]), 68);
    expect(out.boxes).toEqual([100]);
    expect(out.cbm).toEqual([12.02]);
    expect(out.containers).toEqual([1]);
  });

  it("falta o dado: nulo, nunca zero", () => {
    // Sem m³ da caixa: sem cubagem e sem containers.
    const noCbm = {
      ...doll([60, 40], [2880, 1920]),
      cbmPerBox: null,
      cbmTotal: null,
    } as RequestPacking;
    expect(roundPackingOf(row, noCbm, 68)).toEqual({
      boxes: [60, 40],
      cbm: null,
      containers: null,
      totals: { boxes: 100, cbm: null, containers: null },
    });
    // Sem container de referência: as caixas e o m³, sem containers.
    expect(
      roundPackingOf(row, doll([60, 40], [2880, 1920]), null).containers,
    ).toBeNull();
    // Outra unidade (kg, m) ou sem embalagem: tudo "—".
    const nothing = {
      boxes: null,
      cbm: null,
      containers: null,
      totals: { boxes: null, cbm: null, containers: null },
    };
    expect(
      roundPackingOf(
        row,
        { ...doll([60, 40], null), countable: false } as RequestPacking,
        68,
      ),
    ).toEqual(nothing);
    expect(roundPackingOf(row, undefined, 68)).toEqual(nothing);
  });
});
