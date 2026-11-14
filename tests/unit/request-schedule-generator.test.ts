import { describe, expect, it } from "vitest";
import { planPurchaseRounds, roundLoad } from "@/lib/purchase-rounds";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { parseRequestItems } from "@/app/app/actions/request-items";

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
