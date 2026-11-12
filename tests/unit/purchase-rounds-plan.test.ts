import { describe, expect, it } from "vitest";
import {
  CONTAINER_FULL_MARGIN_PCT,
  MAX_PURCHASE_ROUNDS,
  containersPerRound,
  planPurchaseRounds,
  roundLoad,
} from "@/lib/purchase-rounds";

/*
 * "Gerar programação" na Seleção (docs/PURCHASE_SCHEDULE.md), regra do dono
 * de 12/11/2026: tudo sai da quantidade. O total de peças e o número de
 * rodadas viram rodadas iguais em caixas master inteiras; os containers de
 * cada rodada são consequência; em cada rodada, aumentar ou diminuir fecha o
 * container, que conta como cheio com 95% ou mais.
 */
// 680 caixas por 40HC (68 ÷ 0,1) = 16.320 peças.
const base = { masterCartonQty: 24, cbmPerCarton: 0.1, containerCbm: 68 };

const plan = (input: Parameters<typeof planPurchaseRounds>[0]) => {
  const out = planPurchaseRounds(input);
  if ("error" in out) throw new Error(out.error);
  return out.plan;
};

describe("planPurchaseRounds", () => {
  it("divide o total nas rodadas informadas, em caixas master inteiras", () => {
    // 40.000 peças = 1.667 caixas (para cima) em 3 rodadas: 556 + 556 + 555.
    const p = plan({ ...base, total: 40_000, rounds: 3 });
    expect(p.cartonsPerContainer).toBe(680);
    expect(p.piecesPerContainer).toBe(16_320);
    expect(p.cartons).toBe(1667);
    expect(p.rounds.map((r) => r.cartons)).toEqual([556, 556, 555]);
    expect(p.rounds.map((r) => r.pieces)).toEqual([13_344, 13_344, 13_320]);
    expect(p.pieces).toBe(40_008);
    expect(p.extraPieces).toBe(8);
    expect(p.reduced).toBe(false);
    // Os containers são consequência da quantidade: 1.667 ÷ 680.
    expect(p.containers).toBeCloseTo(1667 / 680, 4);
    expect(p.rounds[0].containers).toBeCloseTo(556 / 680, 4);
  });

  it("o exemplo do dono: 3.000 peças em 3 rodadas (48 por caixa, 0,0235 m³)", () => {
    const p = plan({
      total: 3000,
      rounds: 3,
      masterCartonQty: 48,
      cbmPerCarton: 0.0235,
      containerCbm: 68,
    });
    expect(p.cartonsPerContainer).toBe(2893);
    // Antes saía uma rodada só (tudo cabia num container).
    expect(p.rounds.map((r) => r.pieces)).toEqual([1008, 1008, 1008]);
    expect(p.pieces).toBe(3024);
    expect(p.extraPieces).toBe(24);
  });

  it("uma rodada leva o total inteiro", () => {
    const p = plan({ ...base, total: 100, rounds: 1 });
    expect(p.rounds).toHaveLength(1);
    expect(p.rounds[0].pieces).toBe(120);
  });

  it("menos caixas que rodadas: ficam as rodadas que dá", () => {
    // 30 peças = 2 caixas; pedir 5 rodadas dá 2 (uma caixa em cada).
    const p = plan({ ...base, total: 30, rounds: 5 });
    expect(p.rounds.map((r) => r.pieces)).toEqual([24, 24]);
    expect(p.reduced).toBe(true);
  });

  it("diz o que falta", () => {
    expect(planPurchaseRounds({ ...base, total: 0, rounds: 2 })).toEqual({
      error: "total",
    });
    for (const rounds of [0, MAX_PURCHASE_ROUNDS + 1, Number.NaN])
      expect(planPurchaseRounds({ ...base, total: 10, rounds })).toEqual({
        error: "rounds",
      });
    expect(
      planPurchaseRounds({
        ...base,
        cbmPerCarton: null,
        total: 10,
        rounds: 2,
      }),
    ).toEqual({ error: "carton" });
    expect(
      planPurchaseRounds({ ...base, cbmPerCarton: 70, total: 10, rounds: 2 }),
    ).toEqual({ error: "too_big" });
  });
});

describe("roundLoad", () => {
  it("rodada pequena: só dá para aumentar até fechar o container", () => {
    // O cartão do dono: 1.008 peças = 21 caixas de 2.893 que cabem no 40HC.
    const load = roundLoad(1008, 48, 0.0235, 68)!;
    // Menos de 1% do container: a ocupação vem como 0 (a tela mostra "<1%").
    expect(load).toMatchObject({
      cartons: 21,
      cbm: 0.4935,
      needed: 1,
      lastPct: 0,
      full: false,
      down: null,
    });
    expect(load.containers).toBeCloseTo(21 / 2893, 4);
    expect(load.up).toEqual({
      containers: 1,
      target: 2893 * 48,
      pieces: 2893 * 48 - 1008,
    });
  });

  it("entre dois containers: aumentar fecha o de cima, diminuir o de baixo", () => {
    // 884 caixas = 1 container cheio + 204 caixas (30%) no segundo.
    const load = roundLoad(884 * 24, ...rest())!;
    expect(load).toMatchObject({ needed: 2, lastPct: 30, full: false });
    expect(load.containers).toBe(1.3);
    expect(load.up).toEqual({
      containers: 2,
      target: 32_640,
      pieces: 32_640 - 884 * 24,
    });
    expect(load.down).toEqual({
      containers: 1,
      target: 16_320,
      pieces: 884 * 24 - 16_320,
    });
  });

  it("margem de 5%: com 95% ou mais o container conta como cheio", () => {
    expect(CONTAINER_FULL_MARGIN_PCT).toBe(5);
    // 646 de 680 caixas = 95%: cheio, e ainda dá para completar os 5%.
    const at95 = roundLoad(646 * 24, ...rest())!;
    expect(at95).toMatchObject({ needed: 1, lastPct: 95, full: true });
    expect(at95.up).toEqual({
      containers: 1,
      target: 16_320,
      pieces: 34 * 24,
    });
    expect(at95.down).toBeNull();
    // Uma caixa a menos (94,8%): ainda não é cheio.
    expect(roundLoad(645 * 24, ...rest())).toMatchObject({
      lastPct: 94,
      full: false,
    });
    // Nunca acima da capacidade: 2% além de um container não é "cheio".
    const over = roundLoad(694 * 24, ...rest())!;
    expect(over).toMatchObject({ needed: 2, lastPct: 2, full: false });
    expect(over.down).toMatchObject({ containers: 1, pieces: 14 * 24 });
  });

  it("container fechado exato: aumentar vai ao próximo, diminuir ao anterior", () => {
    const one = roundLoad(16_320, ...rest())!;
    expect(one).toMatchObject({ needed: 1, lastPct: 100, full: true });
    expect(one.up).toEqual({ containers: 2, target: 32_640, pieces: 16_320 });
    // Não zera a rodada.
    expect(one.down).toBeNull();
    const two = roundLoad(32_640, ...rest())!;
    expect(two.up).toMatchObject({ containers: 3, pieces: 16_320 });
    expect(two.down).toEqual({ containers: 1, target: 16_320, pieces: 16_320 });
  });

  it("peças digitadas fora da caixa inteira: o ajuste fecha em caixas inteiras", () => {
    // 1.000 peças = 42 caixas (para cima); fechar o container soma até 16.320.
    const load = roundLoad(1000, ...rest())!;
    expect(load.cartons).toBe(42);
    expect(load.cbm).toBe(4.2);
    expect(load.up).toEqual({ containers: 1, target: 16_320, pieces: 15_320 });
  });

  it("sem container (ou caixa maior que ele): só caixas e CBM", () => {
    expect(roundLoad(1000, 24, 0.1, null)).toEqual({
      cartons: 42,
      cbm: 4.2,
      containers: null,
      needed: null,
      lastPct: null,
      full: false,
      up: null,
      down: null,
    });
    expect(roundLoad(1000, 24, 70, 68)).toMatchObject({
      containers: null,
      up: null,
    });
    expect(roundLoad(1000, null, 0.1, 68)).toBeNull();
    expect(roundLoad(0, 24, 0.1, 68)).toBeNull();
  });
});

describe("containersPerRound", () => {
  it("o menor e o maior entre as rodadas (o campo informativo)", () => {
    const range = containersPerRound([13_344, 13_344, 13_320], ...rest())!;
    expect(range.max).toBeCloseTo(556 / 680, 4);
    expect(range.min).toBeCloseTo(555 / 680, 4);
    // O campo mostra quantos containers cada rodada precisa (inteiro): 1 em
    // cada uma, 3 no total.
    expect(range.needed).toEqual({ min: 1, max: 1, total: 3 });
    // Depois de "Aumentar" na 1ª rodada, ela passa a 1 container cheio.
    expect(containersPerRound([16_320, 13_344], ...rest())).toMatchObject({
      max: 1,
      needed: { min: 1, max: 1, total: 2 },
    });
    // Uma rodada que passa de um container precisa de dois: "1 a 2".
    expect(containersPerRound([16_320, 884 * 24], ...rest())!.needed).toEqual({
      min: 1,
      max: 2,
      total: 3,
    });
    expect(containersPerRound([], ...rest())).toBeNull();
    expect(containersPerRound([1000], null, 0.1, 68)).toBeNull();
    expect(containersPerRound([1000], 24, 0.1, null)).toBeNull();
  });
});

/** Caixa master, CBM e container da base (na ordem dos parâmetros). */
function rest(): [number, number, number] {
  return [base.masterCartonQty, base.cbmPerCarton, base.containerCbm];
}
