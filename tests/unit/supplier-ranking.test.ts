import { describe, expect, it } from "vitest";
import {
  comparablePrices,
  DEFAULT_RANKING_WEIGHTS,
  normalizeWeights,
  rankQuotes,
  type RankingValues,
} from "@/lib/services/supplier-ranking-calc";

/*
 * Disputa de fornecedores: nota por critério comparada com a melhor e média
 * pelos pesos das Configurações; o vencedor e onde ele ganhou.
 */
const v = (over: Partial<RankingValues>): RankingValues => ({
  price: null,
  delivery: null,
  production: null,
  freight: null,
  moq: null,
  ...over,
});

describe("disputa de fornecedores", () => {
  it("só preço: o mais barato vence e o outro leva nota proporcional", () => {
    const r = rankQuotes(
      [
        { quoteId: "a", values: v({ price: 100 }) },
        { quoteId: "b", values: v({ price: 75 }) },
      ],
      { ...DEFAULT_RANKING_WEIGHTS },
    );
    expect(r.used).toEqual(["price"]);
    expect(r.winnerId).toBe("b");
    expect(r.rows.map((x) => [x.quoteId, x.total])).toEqual([
      ["b", 100],
      ["a", 75],
    ]);
    expect(r.rows[0].criteria[0].best).toBe(true);
  });

  it("os pesos decidem: mais caro mas muito mais rápido vence quando entrega pesa mais", () => {
    const quotes = [
      { quoteId: "barato", values: v({ price: 10, delivery: 90 }) },
      { quoteId: "rapido", values: v({ price: 12, delivery: 30 }) },
    ];
    expect(
      rankQuotes(quotes, {
        ...DEFAULT_RANKING_WEIGHTS,
        price: 80,
        delivery: 20,
      }).winnerId,
    ).toBe("barato");
    const fast = rankQuotes(quotes, {
      ...DEFAULT_RANKING_WEIGHTS,
      price: 20,
      delivery: 80,
    });
    expect(fast.winnerId).toBe("rapido");
    // Onde cada um foi o melhor.
    const winner = fast.rows[0];
    expect(winner.criteria.find((c) => c.criterion === "delivery")!.best).toBe(
      true,
    );
    expect(winner.criteria.find((c) => c.criterion === "price")!.best).toBe(
      false,
    );
  });

  it("sem dado numa cotação: zero naquele critério; sem dado em nenhuma: fora da conta", () => {
    const r = rankQuotes(
      [
        { quoteId: "a", values: v({ price: 10, freight: 1 }) },
        { quoteId: "b", values: v({ price: 10 }) },
      ],
      { ...DEFAULT_RANKING_WEIGHTS },
    );
    expect(r.used).toEqual(["price", "freight"]);
    expect(r.winnerId).toBe("a");
    expect(r.rows.find((x) => x.quoteId === "b")!.criteria[1]).toMatchObject({
      score: 0,
      hasValue: false,
    });
  });

  it("MOQ acima da quantidade perde pontos; empate é avisado", () => {
    const r = rankQuotes(
      [
        { quoteId: "a", values: v({ moq: { moq: 500, quantity: 1000 } }) },
        { quoteId: "b", values: v({ moq: { moq: 2000, quantity: 1000 } }) },
      ],
      { ...DEFAULT_RANKING_WEIGHTS },
    );
    expect(r.rows.map((x) => x.total)).toEqual([100, 50]);
    const tie = rankQuotes(
      [
        { quoteId: "a", values: v({ price: 5 }) },
        { quoteId: "b", values: v({ price: 5 }) },
      ],
      { ...DEFAULT_RANKING_WEIGHTS },
    );
    expect(tie.tie).toBe(true);
    expect(tie.rows.map((x) => x.rank)).toEqual([1, 1]);
  });

  it("dias com zero não quebram a conta (pronto no início)", () => {
    const r = rankQuotes(
      [
        { quoteId: "a", values: v({ production: 0 }) },
        { quoteId: "b", values: v({ production: 9 }) },
      ],
      { ...DEFAULT_RANKING_WEIGHTS },
    );
    expect(r.rows.map((x) => x.total)).toEqual([100, 10]);
  });

  it("pesos gravados inválidos voltam ao padrão", () => {
    expect(normalizeWeights(null)).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(normalizeWeights({ price: 70, moq: -1, delivery: "abc" })).toEqual({
      ...DEFAULT_RANKING_WEIGHTS,
      price: 70,
    });
  });

  it("preço: mesma moeda compara sem câmbio; moedas diferentes vão para R$", () => {
    const noRate = () => null;
    const same = comparablePrices(
      [
        { quoteId: "a", unitPrice: 2.6, currency: "USD" },
        { quoteId: "b", unitPrice: 2.35, currency: "USD" },
        { quoteId: "c", unitPrice: null, currency: "USD" },
      ],
      noRate,
    );
    expect(same.currency).toBe("USD");
    expect([...same.prices.values()]).toEqual([2.6, 2.35, null]);
    const mixed = [
      { quoteId: "a", unitPrice: 2, currency: "USD" },
      { quoteId: "b", unitPrice: 14, currency: "CNY" },
    ];
    // Sem a taxa de uma das moedas o preço sai da disputa (ninguém leva zero).
    const missing = comparablePrices(mixed, (c) => (c === "USD" ? 5 : null));
    expect(missing.currency).toBeNull();
    expect([...missing.prices.values()]).toEqual([null, null]);
    const both = comparablePrices(mixed, (c) => (c === "USD" ? 5 : 0.7));
    expect(both.currency).toBe("BRL");
    expect(both.prices.get("a")).toBe(10);
    expect(both.prices.get("b")).toBeCloseTo(9.8);
  });
});
