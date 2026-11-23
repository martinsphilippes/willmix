import { describe, expect, it } from "vitest";
import { sumPackingTotals } from "@/lib/strategy-packing";

/*
 * Peças, caixas master e CBM na tabela da Estratégia (dono, 23/11/2026): a
 * linha soma os produtos da solicitação; sem a leitura de um deles, "—".
 */
describe("soma da embalagem da solicitação", () => {
  it("soma peças, caixas master e cubagem dos produtos", () => {
    expect(
      sumPackingTotals([
        { pieces: 1000, masterBoxes: 21, cbm: 2.5242 },
        { pieces: 300, masterBoxes: 50, cbm: 6.01 },
      ]),
    ).toEqual({ pieces: 1300, masterBoxes: 71, cbm: 8.5342 });
  });

  it("um produto sem o número deixa só aquele total sem valor", () => {
    expect(
      sumPackingTotals([
        { pieces: 1000, masterBoxes: 21, cbm: 2.5 },
        { pieces: 300, masterBoxes: null, cbm: 1 },
      ]),
    ).toEqual({ pieces: 1300, masterBoxes: null, cbm: 3.5 });
    expect(
      sumPackingTotals([{ pieces: 1000, masterBoxes: 21, cbm: 2.5 }, null]),
    ).toEqual({ pieces: null, masterBoxes: null, cbm: null });
  });

  it("sem produtos ou sem peças, sem total", () => {
    expect(sumPackingTotals([])).toEqual({
      pieces: null,
      masterBoxes: null,
      cbm: null,
    });
    expect(
      sumPackingTotals([{ pieces: 0, masterBoxes: null, cbm: null }]).pieces,
    ).toBeNull();
  });
});
