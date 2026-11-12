import { describe, expect, it } from "vitest";
import {
  MAX_PURCHASE_ROUNDS,
  planPurchaseRounds,
  roundLoad,
} from "@/lib/purchase-rounds";

/*
 * "Gerar programação" na Seleção (docs/PURCHASE_SCHEDULE.md): o total de
 * peças vira rodadas em caixas master inteiras, com containers cheios, e a
 * última rodada fica com o resto.
 */
const base = { masterCartonQty: 24, cbmPerCarton: 0.1, containerCbm: 68 };

const plan = (input: Parameters<typeof planPurchaseRounds>[0]) => {
  const out = planPurchaseRounds(input);
  if ("error" in out) throw new Error(out.error);
  return out.plan;
};

describe("planPurchaseRounds", () => {
  it("fills whole containers and leaves the rest in the last round", () => {
    // 680 caixas por 40HC (68 ÷ 0,1) = 16.320 peças; 40.000 peças = 1.667 caixas.
    const p = plan({ ...base, total: 40_000 });
    expect(p.cartonsPerContainer).toBe(680);
    expect(p.cartons).toBe(1667);
    expect(p.rounds.map((r) => r.cartons)).toEqual([680, 680, 307]);
    expect(p.rounds.map((r) => r.pieces)).toEqual([16_320, 16_320, 7_368]);
    expect(p.pieces).toBe(40_008);
    expect(p.extraPieces).toBe(8);
    expect(p.lastFillPct).toBe(45);
    expect(p.fillUp).toBe((680 - 307) * 24);
    expect(p.trimDown).toBe(7_368);
    expect(p.rounds[2].containers).toBeCloseTo(307 / 680, 4);
  });

  it("closes exactly when the total fills the containers", () => {
    const p = plan({ ...base, total: 16_320 * 2 });
    expect(p.rounds).toHaveLength(2);
    expect(p.fillUp).toBeNull();
    expect(p.trimDown).toBeNull();
    expect(p.lastFillPct).toBe(100);
  });

  it("takes N containers per round", () => {
    const p = plan({ ...base, total: 40_000, containersPerRound: 2 });
    expect(p.rounds.map((r) => r.cartons)).toEqual([1360, 307]);
    expect(p.rounds[0].containers).toBe(2);
  });

  it("raises containers per round to stay within the max rounds", () => {
    const p = plan({ ...base, total: 16_320 * 30 });
    expect(p.rounds.length).toBeLessThanOrEqual(MAX_PURCHASE_ROUNDS);
    expect(p.raised).toBe(true);
    expect(p.containersPerRound).toBe(3);
    expect(p.rounds).toHaveLength(10);
  });

  it("a small total is a single round", () => {
    const p = plan({ ...base, total: 100 });
    expect(p.rounds).toHaveLength(1);
    expect(p.rounds[0].pieces).toBe(120);
    expect(p.trimDown).toBeNull();
  });

  it("explains what is missing", () => {
    expect(planPurchaseRounds({ ...base, total: 0 })).toEqual({
      error: "total",
    });
    expect(
      planPurchaseRounds({ ...base, cbmPerCarton: null, total: 10 }),
    ).toEqual({ error: "carton" });
    expect(
      planPurchaseRounds({ ...base, cbmPerCarton: 70, total: 10 }),
    ).toEqual({ error: "too_big" });
  });
});

describe("roundLoad", () => {
  it("cartons, CBM and container share of an edited round", () => {
    expect(roundLoad(1000, 24, 0.1, 68)).toEqual({
      cartons: 42,
      cbm: 4.2,
      containers: Math.round((42 / 680) * 10_000) / 10_000,
    });
    expect(roundLoad(1000, null, 0.1, 68)).toBeNull();
  });
});
