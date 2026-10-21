import "server-only";

import type { Quote, Request } from "@/lib/db";
import { rateFor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { brazilDay } from "@/lib/supplier-terms";
import { isPiecesUnit, leadTimeFromLots } from "./purchase-sheet-calc";
import { getQuoteSheet } from "./quote-sheet";
import type { PricingContext } from "./quote-pricing";
import {
  comparableDelivery,
  comparableFreight,
  comparablePrices,
  daysBetween,
  normalizeWeights,
  rankQuotes,
  type RankingResult,
  type RankingValues,
  type RankingWeights,
} from "./supplier-ranking-calc";

/*
 * Disputa das cotações respondidas: monta, para cada uma, os valores
 * comparados (preço por peça, frete marítimo por peça em R$, dias até chegar,
 * prazo de produção, MOQ × quantidade) e aplica os pesos das Configurações.
 * Dado que falta por algo fora do fornecedor (câmbio, frete ou trânsito da
 * companhia marítima) não pune ninguém: o critério compara em base comum.
 */

export interface SupplierRanking extends RankingResult {
  weights: RankingWeights;
  values: Map<string, RankingValues>;
  /** Moeda do preço comparado (null = sem moeda informada). */
  priceCurrency: string | null;
  /** Entrega até a chegada (com trânsito marítimo) ou só até a saída. */
  deliveryIncludesTransit: boolean;
}

export async function supplierRanking(
  request: Request,
  quotes: Quote[],
  pricing: PricingContext,
  today = new Date(),
): Promise<SupplierRanking> {
  const settings = await getSettings();
  const weights = normalizeWeights(settings.supplierRankingWeights);
  const values = new Map<string, RankingValues>();
  const price = comparablePrices(
    pricing.quotes.map((p) => ({
      quoteId: p.quoteId,
      unitPrice: p.input.unitPrice,
      currency: p.input.currency,
    })),
    (currency) => rateFor(pricing.fx.rates, currency),
  );
  const todayDay = brazilDay(today)!;
  const timing: Parameters<typeof comparableDelivery>[0] = [];
  const freights = new Map<string, number | null>();
  for (const p of pricing.quotes) {
    const quote = quotes.find((q) => q.id === p.quoteId);
    if (!quote) continue;
    const sheet = await getQuoteSheet(quote.id);
    const qty = p.input.quantity;
    const lot1 = leadTimeFromLots(sheet?.lots);
    // Início da produção é um dia (gravado à meia-noite UTC): conta em dias
    // civis, não em horas, para "amanhã" não virar 0 no meio da tarde.
    const startDay = sheet?.productionStartAt?.slice(0, 10) ?? null;
    timing.push({
      quoteId: quote.id,
      wait:
        startDay && /^\d{4}-\d{2}-\d{2}$/.test(startDay)
          ? daysBetween(todayDay, startDay)
          : null,
      lot1,
      transit: p.shippingFreight.transitDays ?? null,
    });
    freights.set(
      quote.id,
      p.result.freightSource !== "none" &&
        p.result.freightBrl !== null &&
        qty > 0
        ? p.result.freightBrl / qty
        : null,
    );
    values.set(quote.id, {
      price: price.prices.get(quote.id) ?? null,
      delivery: null,
      production: quote.leadTimeDays ?? lot1,
      freight: null,
      // MOQ é em peças: só compara quando a solicitação também é em peças.
      moq:
        sheet?.moq && request.quantity > 0 && isPiecesUnit(request.unit)
          ? { moq: sheet.moq, quantity: request.quantity }
          : null,
    });
  }
  const delivery = comparableDelivery(timing);
  const freight = comparableFreight(freights);
  for (const [id, v] of values) {
    v.delivery = delivery.days.get(id) ?? null;
    v.freight = freight.get(id) ?? null;
  }
  const result = rankQuotes(
    [...values.entries()].map(([quoteId, v]) => ({ quoteId, values: v })),
    weights,
  );
  return {
    ...result,
    weights,
    values,
    priceCurrency: price.currency,
    deliveryIncludesTransit: delivery.includesTransit,
  };
}
