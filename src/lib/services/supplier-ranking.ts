import "server-only";

import type { Quote, Request } from "@/lib/db";
import { rateFor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { leadTimeFromLots } from "./purchase-sheet-calc";
import { getQuoteSheet } from "./quote-sheet";
import type { PricingContext } from "./quote-pricing";
import {
  comparablePrices,
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
 */

const DAY = 86_400_000;

export interface SupplierRanking extends RankingResult {
  weights: RankingWeights;
  values: Map<string, RankingValues>;
  /** Moeda do preço comparado (null = sem moeda informada). */
  priceCurrency: string | null;
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
  for (const p of pricing.quotes) {
    const quote = quotes.find((q) => q.id === p.quoteId);
    if (!quote) continue;
    const sheet = await getQuoteSheet(quote.id);
    const qty = p.input.quantity;
    const perPiece = (total: number | null) =>
      total !== null && qty && qty > 0 ? total / qty : null;
    // Chegada: espera até o início da produção + produção da 1ª remessa +
    // trânsito informado pela companhia marítima (sem trânsito, até a saída).
    const lot1 = leadTimeFromLots(sheet?.lots);
    const start = sheet?.productionStartAt
      ? Date.parse(sheet.productionStartAt)
      : NaN;
    const delivery =
      lot1 !== null && Number.isFinite(start)
        ? Math.max(0, Math.round((start - today.getTime()) / DAY)) +
          lot1 +
          (p.shippingFreight.transitDays ?? 0)
        : null;
    values.set(quote.id, {
      price: price.prices.get(quote.id) ?? null,
      delivery,
      production: quote.leadTimeDays ?? lot1,
      freight:
        p.result.freightSource === "none"
          ? null
          : perPiece(p.result.freightBrl),
      moq:
        sheet?.moq && request.quantity > 0
          ? { moq: sheet.moq, quantity: request.quantity }
          : null,
    });
  }
  const result = rankQuotes(
    [...values.entries()].map(([quoteId, v]) => ({ quoteId, values: v })),
    weights,
  );
  return { ...result, weights, values, priceCurrency: price.currency };
}
