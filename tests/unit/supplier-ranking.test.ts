import { describe, expect, it } from "vitest";
import {
  comparableDelivery,
  comparableFreight,
  comparablePrices,
  daysBetween,
  DEFAULT_RANKING_WEIGHTS,
  explainWinner,
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

  it("CNY e RMB são a mesma moeda: compara direto, sem câmbio", () => {
    const r = comparablePrices(
      [
        { quoteId: "a", unitPrice: 2, currency: "RMB" },
        { quoteId: "b", unitPrice: 2.1, currency: "CNY" },
      ],
      () => null,
    );
    expect(r.currency).toBe("RMB");
    expect([...r.prices.values()]).toEqual([2, 2.1]);
  });

  it("entrega: trânsito só entra quando todas têm (quem já tem frete não é punido)", () => {
    // A: frete respondido com 35 dias de trânsito; B: aguardando a companhia.
    const partial = comparableDelivery([
      { quoteId: "a", wait: 5, lot1: 30, transit: 35 },
      { quoteId: "b", wait: 5, lot1: 45, transit: null },
    ]);
    expect(partial.includesTransit).toBe(false);
    expect([...partial.days.values()]).toEqual([35, 50]);
    const full = comparableDelivery([
      { quoteId: "a", wait: 5, lot1: 30, transit: 35 },
      { quoteId: "b", wait: -3, lot1: 45, transit: 30 },
    ]);
    expect(full.includesTransit).toBe(true);
    // Produção já começou (espera negativa) conta como zero.
    expect([...full.days.values()]).toEqual([70, 75]);
    // Sem programação: sem dado, e não impede o trânsito das demais.
    const noLot = comparableDelivery([
      { quoteId: "a", wait: 5, lot1: null, transit: null },
      { quoteId: "b", wait: 5, lot1: 10, transit: 20 },
    ]);
    expect(noLot.includesTransit).toBe(true);
    expect([...noLot.days.values()]).toEqual([null, 35]);
  });

  it("frete marítimo só entra quando todas têm o valor", () => {
    expect([
      ...comparableFreight(
        new Map([
          ["a", 0.5],
          ["b", null],
        ]),
      ).values(),
    ]).toEqual([null, null]);
    expect([
      ...comparableFreight(
        new Map([
          ["a", 0.5],
          ["b", 0.4],
        ]),
      ).values(),
    ]).toEqual([0.5, 0.4]);
  });

  it("dias civis entre dois dias (início amanhã = 1, mesmo à tarde)", () => {
    expect(daysBetween("2026-10-21", "2026-10-22")).toBe(1);
    expect(daysBetween("2026-10-21", "2026-10-21")).toBe(0);
    expect(daysBetween("2026-10-21", "2026-10-18")).toBe(-3);
    expect(daysBetween("2026-12-31", "2027-01-02")).toBe(2);
  });

  it("explicação: ganhou só onde foi melhor que todas; empate e 'só ele' à parte", () => {
    const weights = {
      ...DEFAULT_RANKING_WEIGHTS,
      price: 50,
      delivery: 20,
      freight: 10,
    };
    // A e B com o mesmo preço; C mais caro. A chega antes. Só A tem produção.
    const r = rankQuotes(
      [
        {
          quoteId: "a",
          values: v({ price: 10, delivery: 40, production: 20 }),
        },
        { quoteId: "b", values: v({ price: 10, delivery: 50 }) },
        { quoteId: "c", values: v({ price: 20, delivery: 60 }) },
      ],
      weights,
    );
    expect(r.winnerId).toBe("a");
    expect(explainWinner(r)).toEqual({
      wins: ["delivery"],
      tied: ["price"],
      losses: [],
      onlyData: ["production"],
    });
    // Perdeu onde outra foi melhor; sem dado no vencedor também é perda.
    const r2 = rankQuotes(
      [
        { quoteId: "a", values: v({ price: 10, delivery: 90 }) },
        { quoteId: "b", values: v({ price: 15, delivery: 30, freight: 1 }) },
      ],
      { ...weights, price: 80 },
    );
    expect(r2.winnerId).toBe("a");
    expect(explainWinner(r2)).toEqual({
      wins: ["price"],
      tied: [],
      losses: ["delivery", "freight"],
      onlyData: [],
    });
    // Empate na nota: sem explicação de vencedor.
    const tie = rankQuotes(
      [
        { quoteId: "a", values: v({ price: 5 }) },
        { quoteId: "b", values: v({ price: 5 }) },
      ],
      weights,
    );
    expect(explainWinner(tie)).toBeNull();
  });
});
