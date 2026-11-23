import { describe, expect, it } from "vitest";
import {
  quoteProductHistory,
  quoteProductTerms,
  quoteTermsSummary,
} from "@/lib/quote-negotiation";

/*
 * Prazo de produção e pedido mínimo por produto na cotação (dono,
 * 23/11/2026; docs/PURCHASE_DEMAND.md): cada produto tem os seus; a resposta
 * antiga, com um só para a cotação, continua valendo para todos os produtos.
 */
describe("prazo e pedido mínimo por produto", () => {
  const response = {
    prices: [
      { productId: "a", unitPrice: 2.1, leadTimeDays: 30, moq: 500 },
      { productId: "b", unitPrice: 1.5, leadTimeDays: 45, moq: 1200 },
    ],
    leadTimeDays: 45,
    moq: 1200,
  };

  it("cada produto com o seu prazo e o seu mínimo", () => {
    expect(quoteProductTerms(response, "a")).toEqual({
      leadTimeDays: 30,
      moq: 500,
    });
    expect(quoteProductTerms(response, "b")).toEqual({
      leadTimeDays: 45,
      moq: 1200,
    });
  });

  it("resposta antiga: o da cotação vale para todos os produtos", () => {
    const old = {
      prices: [
        { productId: "a", unitPrice: 2.1 },
        { productId: "b", unitPrice: 1.5 },
      ],
      leadTimeDays: 35,
      moq: 800,
    };
    expect(quoteProductTerms(old, "a")).toEqual({ leadTimeDays: 35, moq: 800 });
    expect(quoteProductTerms(old, "b")).toEqual({ leadTimeDays: 35, moq: 800 });
    expect(quoteProductTerms({ prices: null }, "a")).toEqual({
      leadTimeDays: null,
      moq: null,
    });
  });

  it("o resumo da resposta é o maior prazo e o maior mínimo", () => {
    expect(quoteTermsSummary(response.prices)).toEqual({
      leadTimeDays: 45,
      moq: 1200,
    });
    expect(quoteTermsSummary([{ productId: "a", unitPrice: 1 }])).toEqual({
      leadTimeDays: null,
      moq: null,
    });
  });

  it("o histórico do produto mostra o prazo e o mínimo dele", () => {
    const history = quoteProductHistory(
      {
        status: "answered",
        prices: response.prices,
        currency: "RMB",
        incoterm: "FOB",
        leadTimeDays: 45,
        moq: 1200,
        port: "Ningbo",
        note: null,
        answeredAt: "2026-11-23T10:00:00.000Z",
        answeredByUserId: "u1",
        negotiation: [
          {
            id: "e1",
            at: "2026-11-23T10:00:00.000Z",
            kind: "answer",
            side: "supplier",
            byUserId: "u1",
            prices: response.prices,
            currency: "RMB",
            incoterm: "FOB",
            moq: 1200,
            leadTimeDays: 45,
            port: "Ningbo",
            text: null,
          },
        ],
      } as never,
      "a",
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      leadTimeDays: 30,
      moq: 500,
      price: 2.1,
    });
  });
});
