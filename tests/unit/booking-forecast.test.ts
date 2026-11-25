import { describe, expect, it } from "vitest";
import {
  bookingForecastMissing,
  bookingForecastPending,
  bookingItemForecastQuery,
  forecastAnalysis,
} from "@/lib/booking-forecast";
import { cotacaoV2Sql, productInput } from "@/lib/integrations/price-forecast";
import type { BookingAnalysis, BookingItem } from "@/lib/db/schema";

/*
 * Previsão de preço dos itens do Book pela API de preço do Sankhya (dono,
 * 24/11/2026): a ficha do item com o NCM, nunca o CODPROD; o retrato no
 * item; sem o Sankhya, nada previsto.
 */

const item = (over: Partial<BookingItem> = {}) =>
  ({
    id: "bi-1",
    ncm: "9617.00.20",
    netWeightPcKg: 0.2,
    grossWeightPcKg: 0.25,
    masterCartonQty: 24,
    cbmPerCarton: 0.05,
    price: 12.5,
    currency: "RMB",
    incoterm: null,
    purchaseQty: 1200,
    plannedQty: null,
    ...over,
  }) as BookingItem;

const meta = { at: "2026-11-24T12:00:00.000Z", byUserId: "u-1" };

describe("consulta do item do book", () => {
  it("vai a ficha do item com o NCM, sem CODPROD e sem o FOB/EXW", () => {
    // O FOB/EXW e o valor do EXW não vão para o Sankhya (dono, 24/11/2026).
    const q = bookingItemForecastQuery(item({ incoterm: "EXW" }), {
      dataRef: "20261124",
    });
    expect(q).toMatchObject({
      sankhyaCode: null,
      customerId: null,
      quantity: 1200,
      masterBoxQty: 24,
      price: 12.5,
      currency: "RMB",
      // O book não tem pedido: a rota padrão (dono, 25/11/2026).
      route: "VIA_DEPOSITO",
    });
    expect(q).not.toHaveProperty("incoterm");
    const input = productInput(q);
    expect(input).toMatchObject({
      NCM: "96170020",
      PECAS_CAIXA: 24,
      CBM_CAIXA: 0.05,
      PRECO_ORIGEM: 12.5,
      MOEDA_ORIGEM: "RMB",
      QTD_PECAS: 1200,
    });
    expect(input.CODPROD).toBeUndefined();
    expect(input.INCOTERM).toBeUndefined();
    expect(cotacaoV2Sql(input)).toContain("CAST(NULL AS VARCHAR(5))");
    expect(cotacaoV2Sql(input)).toContain("CAST('96170020' AS VARCHAR(10))");
  });

  it("o preço negociado entra no lugar do da planilha", () => {
    const q = bookingItemForecastQuery(item(), { price: 2, currency: "USD" });
    expect(q).toMatchObject({ price: 2, currency: "USD" });
  });

  it("aponta o que falta antes de chamar o Sankhya", () => {
    expect(
      bookingForecastMissing(
        bookingItemForecastQuery(
          item({ ncm: null, price: null, cbmPerCarton: null }),
        ),
      ),
    ).toEqual(["ncm", "price", "cbm"]);
    expect(
      bookingForecastMissing(
        bookingItemForecastQuery(item({ currency: "BRL" })),
      ),
    ).toEqual(["currency"]);
    expect(bookingForecastMissing(bookingItemForecastQuery(item()))).toEqual(
      [],
    );
  });
});

describe("retrato da previsão", () => {
  const q = bookingItemForecastQuery(item());

  it("sem o Sankhya: nada previsto", () => {
    const a = forecastAnalysis({ mode: "manual" }, q, meta);
    expect(a).toMatchObject({
      source: "price_forecast",
      missing: ["manual"],
      costBrl: null,
      verdict: null,
    });
  });

  it("erro do Sankhya: a mensagem fica no retrato", () => {
    const a = forecastAnalysis(
      { mode: "api", kind: "error", message: "NCM sem alíquota" },
      q,
      meta,
    );
    expect(a).toMatchObject({
      missing: ["error"],
      message: "NCM sem alíquota",
    });
  });

  it("resposta: venda, custo, meta e o sinal", () => {
    const answer = {
      mode: "api",
      kind: "forecast",
      salePrice: 30,
      tablePrice: null,
      wholesalePrice: null,
      retailPrice: null,
      targetPrice: 34,
      cost: 18,
      profitPercent: 12,
      goalPercent: 20,
      goalReached: false,
      withFreight: 31.5,
      wdWithFreight: 33,
      status: "PRONTA",
    } as const;
    const a = forecastAnalysis(answer, q, meta);
    expect(a).toMatchObject({
      salePriceBrl: 30,
      costBrl: 18,
      targetPriceBrl: 34,
      targetPct: 20,
      profitPct: 12,
      verdict: "below",
      withFreightBrl: 31.5,
      missing: [],
      sent: { ncm: "9617.00.20", price: 12.5, quantity: 1200 },
    });
    expect(
      forecastAnalysis({ ...answer, goalReached: true }, q, meta).verdict,
    ).toBe("viable");
    expect(
      forecastAnalysis({ ...answer, profitPercent: -3 }, q, meta).verdict,
    ).toBe("loss");
  });
});

describe("o que o job diário ainda pede ao Sankhya", () => {
  const snap = (over: Partial<BookingAnalysis> = {}): BookingAnalysis => ({
    ...forecastAnalysis(
      { mode: "manual" },
      bookingItemForecastQuery(item()),
      meta,
    ),
    missing: [],
    ...over,
  });

  // O retrato de `meta` é de 24/11 12:00 UTC.
  const later = (hours: number) => Date.parse(meta.at) + hours * 3_600_000;

  it("sem retrato, retrato antigo, Sankhya fora ou sem resposta: pede", () => {
    expect(bookingForecastPending(null)).toBe(true);
    // O retrato antigo do portal (sem `source`).
    expect(bookingForecastPending({ at: meta.at, missing: [] } as never)).toBe(
      true,
    );
    expect(
      bookingForecastPending(snap({ missing: ["manual"] }), null, later(21)),
    ).toBe(true);
    expect(
      bookingForecastPending(snap({ missing: ["error"] }), null, later(21)),
    ).toBe(true);
  });

  it("o erro do Sankhya vai de novo só uma vez por dia", () => {
    const failed = snap({ missing: ["error"] });
    expect(bookingForecastPending(failed, null, later(1))).toBe(false);
    expect(bookingForecastPending(failed, null, later(19))).toBe(false);
    expect(bookingForecastPending(failed, null, later(20))).toBe(true);
  });

  it("com a previsão ou com falta de dado na ficha: não pede", () => {
    expect(bookingForecastPending(snap(), null, later(48))).toBe(false);
    expect(
      bookingForecastPending(snap({ missing: ["ncm"] }), null, later(48)),
    ).toBe(false);
  });

  it("o que já foi tentado nesta rodada não vai de novo", () => {
    const failed = snap({ missing: ["error"] });
    expect(
      bookingForecastPending(failed, "2026-11-24T11:00:00.000Z", later(21)),
    ).toBe(false);
    expect(
      bookingForecastPending(failed, "2026-11-25T09:00:00.000Z", later(21)),
    ).toBe(true);
  });
});

describe("rota da entrega na cotação V2 (dono, 25/11/2026)", () => {
  it("o pedido usa a escolha de quem chama; sem ela, VIA_DEPOSITO", async () => {
    const { forecastQuery } =
      await import("@/lib/services/request-price-forecast");
    const product = {
      id: "p-1",
      sankhyaCode: "123",
      sku: null,
      ncm: null,
      netWeightKg: null,
      grossWeightKg: null,
      masterBoxQty: null,
      cbm: null,
      boxLengthCm: null,
      boxWidthCm: null,
      boxHeightCm: null,
      price: null,
      currency: null,
    } as never;
    const base = {
      product,
      customer: null,
      quantity: 10,
      defaultFreight: null,
    };
    // Compra para estoque (ninguém chama o transportador): VIA_DEPOSITO.
    expect(forecastQuery(base).route).toBe("VIA_DEPOSITO");
    // Escolha preenchida no pedido: ela vale.
    expect(forecastQuery({ ...base, caller: "customer" }).route).toBe(
      "PORTO_CLIENTE",
    );
    expect(forecastQuery({ ...base, caller: "wellmix" }).route).toBe(
      "VIA_DEPOSITO",
    );
  });
});
