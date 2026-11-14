import { describe, expect, it } from "vitest";
import {
  containersPerRound,
  planPurchaseRounds,
  roundLoad,
} from "@/lib/purchase-rounds";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { parseRequestItems } from "@/app/app/actions/request-items";
import {
  MAX_SCHEDULE_ROUNDS,
  parseRequestSchedule,
} from "@/lib/workflow/request-schedule";
import { generateLots } from "@/lib/services/purchase-sheet-calc";

/*
 * Nova solicitação com o card "Gerar programação pela quantidade" (dono,
 * 14/11/2026). As duas telas usam o mesmo componente e a mesma conta
 * (`planPurchaseRounds`, `roundLoad`): com os mesmos dados de entrada, a
 * distribuição, os totais e a ocupação são iguais. Aqui, a boneca do
 * cadastro de demonstração (48 peças por caixa, caixa de 52 × 34 × 68 cm),
 * a mesma do E2E da Nova solicitação; e o servidor recusando a programação
 * gerada para outro produto.
 */

const cbm = cbmFromDimensions(52, 34, 68)!;

describe("mesma conta nas duas telas", () => {
  it("61 caixas em 2 programações: 31 + 30 caixas (o resto vai para a 1ª)", () => {
    const out = planPurchaseRounds({
      total: 61 * 48,
      rounds: 2,
      masterCartonQty: 48,
      cbmPerCarton: cbm,
      containerCbm: 76,
    });
    expect("plan" in out).toBe(true);
    if (!("plan" in out)) return;
    expect(out.plan.rounds.map((r) => r.pieces)).toEqual([1488, 1440]);
    expect(out.plan.pieces).toBe(2928);
    expect(out.plan.extraPieces).toBe(0);
    // Ocupação de cada programação: caixas e m³ da mesma conta do card.
    const load = roundLoad(1488, 48, cbm, 76)!;
    expect(load.cartons).toBe(31);
    expect(load.needed).toBe(1);
  });
});

describe("programação de outro produto", () => {
  const form = (forKey: string) => {
    const f = new FormData();
    f.set("p0.productId", "prod-boneca");
    f.set("p0.variantId", "");
    f.set("p0.productName", "Boneca");
    f.set("p0.description", "Boneca");
    f.set("p0.quantity", "2928");
    f.set("p0.unit", "un");
    f.set("p0.schedule.count", "2");
    f.set("p0.schedule.intervalDays", "45");
    f.set("p0.schedule.firstDate", "2026-12-29");
    f.set("p0.schedule.qty.1", "1488");
    f.set("p0.schedule.qty.2", "1440");
    f.set("p0.schedule.for", forKey);
    return f;
  };

  it("aceita a gerada para o produto da linha", () => {
    const [row] = parseRequestItems(form("prod-boneca:"));
    expect(row.schedule?.items.map((i) => i.quantity)).toEqual([1488, 1440]);
  });

  it("recusa a gerada para o produto anterior", () => {
    expect(() => parseRequestItems(form("prod-jarra:"))).toThrow(
      "schedule_product_changed",
    );
  });
});

/*
 * O bloco "Programação de compra" nas duas telas (dono, 14/11/2026): a mesma
 * conta para a mesma entrada, sem o teto de 6 (solicitação) nem de 12
 * (Seleção) datas. O exemplo é o da captura do dono: 300 caixas de 48 peças,
 * 0,0195 m³ por caixa, 40HC de 68 m³.
 */
describe("exemplo da captura: 300 caixas de 48 em 2 programações", () => {
  const input = {
    total: 300 * 48,
    rounds: 2,
    masterCartonQty: 48,
    cbmPerCarton: 0.0195,
    containerCbm: 68,
  };

  it("14.400 peças, 150 caixas e 7.200 peças por data", () => {
    const out = planPurchaseRounds(input);
    if (!("plan" in out)) throw new Error("sem plano");
    expect(out.plan.pieces).toBe(14_400);
    expect(out.plan.cartons).toBe(300);
    expect(out.plan.rounds.map((r) => r.cartons)).toEqual([150, 150]);
    expect(out.plan.rounds.map((r) => r.pieces)).toEqual([7200, 7200]);
    expect(out.plan.cartonsPerContainer).toBe(3487);
  });

  it("containers previstos (1 por data, 2 no total) e a ocupação (4%)", () => {
    const load = roundLoad(7200, 48, 0.0195, 68)!;
    expect(load.cartons).toBe(150);
    expect(load.cbm).toBeCloseTo(2.925, 4);
    // Previsto para a operação: 1 container; ocupado de fato: 4%.
    expect(load.needed).toBe(1);
    expect(load.lastPct).toBe(4);
    expect(load.full).toBe(false);
    expect(load.containers).toBeCloseTo(150 / 3487, 5);
    const range = containersPerRound([7200, 7200], 48, 0.0195, 68)!;
    expect(range.needed).toEqual({ min: 1, max: 1, total: 2 });
    // + Aumentar fecha o container da data: 3.487 caixas (cheio, 100%).
    const up = roundLoad(load.up!.target, 48, 0.0195, 68)!;
    expect(up.cartons).toBe(3487);
    expect(up.full).toBe(true);
    // Com 95% ou mais o container conta como cheio: 3.313 caixas = 95%.
    expect(roundLoad(3313 * 48, 48, 0.0195, 68)!.full).toBe(true);
    expect(roundLoad(3312 * 48, 48, 0.0195, 68)!.full).toBe(false);
  });
});

describe("sem o teto de 6 datas na solicitação", () => {
  const form = (count: number) => {
    const f = new FormData();
    f.set("p0.schedule.count", String(count));
    f.set("p0.schedule.intervalDays", "30");
    f.set("p0.schedule.firstDate", "2026-12-01");
    for (let i = 1; i <= count; i++) f.set(`p0.schedule.qty.${i}`, "480");
    return f;
  };

  it("o servidor aceita 7 e 12 programações, com as datas a cada 30 dias", () => {
    for (const count of [7, 12]) {
      const schedule = parseRequestSchedule(form(count), "p0.")!;
      expect(schedule.items).toHaveLength(count);
      expect(schedule.items[count - 1].expectedAt).toBe(
        new Date(Date.UTC(2026, 11, 1 + 30 * (count - 1)))
          .toISOString()
          .slice(0, 10),
      );
    }
  });

  it("só o teto técnico recusa", () => {
    expect(
      parseRequestSchedule(form(MAX_SCHEDULE_ROUNDS), "p0.")!.items,
    ).toHaveLength(MAX_SCHEDULE_ROUNDS);
    expect(() =>
      parseRequestSchedule(form(MAX_SCHEDULE_ROUNDS + 1), "p0."),
    ).toThrow("invalid_input");
  });
});

describe("a mesma distribuição na ficha de compra", () => {
  it("lotes em caixas iguais, o resto para os primeiros", () => {
    const out = generateLots({
      totalCartons: 301,
      count: 3,
      intervalDays: 30,
      firstDays: 45,
    });
    if (!("lots" in out)) throw new Error("sem lotes");
    expect(out.lots.map((l) => l.masterCartons)).toEqual([101, 100, 100]);
  });
});
