import "server-only";

import { getStore, type Quote, type Request, type User } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { notify, requesterTarget } from "./notifications";
import { getSettings } from "@/lib/settings";
import {
  priceToCustomer,
  rateFor,
  resolveMargin,
  totalCbmFor,
  type PricingInput,
  type PricingResult,
} from "@/lib/pricing";
import { getFxRates, type FxView } from "./fx";
import { getQuoteSheet } from "./quote-sheet";
import { freightByQuote } from "./freight";

/*
 * Valor ao cliente de uma cotação: ficha da cotação (ou o preço da cotação,
 * quando não há ficha) + câmbio do dia + frete + II/IPI + margem. II e IPI vêm
 * da ficha; vazios, da classificação fiscal validada do produto.
 */

export interface QuotePricing {
  quoteId: string;
  hasSheet: boolean;
  /** Entrada sem o frete do transportador (a tela soma quando informado). */
  input: PricingInput;
  result: PricingResult;
  marginSource: "customer" | "line" | "default";
  freightPerCbm: number | null;
  freightCurrency: string;
  /** Frete da companhia marítima: informado (o menor, em R$) ou aguardando. */
  shippingFreight: {
    status: "answered" | "waiting" | "none";
    carrierName: string | null;
    amount: number | null;
    currency: string | null;
    brl: number | null;
    transitDays: number | null;
  };
}

export interface PricingContext {
  fx: FxView;
  quotes: QuotePricing[];
}

async function validatedTaxes(productId: string | null) {
  if (!productId) return { ii: null, ipi: null };
  const [row] = await getStore().list("tax_classifications", {
    filter: { productId, status: "validated" },
    limit: 1,
  });
  const taxes = row?.taxes ?? null;
  const pick = (k: string) =>
    taxes && typeof taxes[k] === "number" ? taxes[k] : null;
  return { ii: pick("II"), ipi: pick("IPI") };
}

export async function quotePricing(
  request: Request,
  quotes: Quote[],
  options: { carrierBrl?: number | null; fx?: FxView } = {},
): Promise<PricingContext> {
  const store = getStore();
  const [settings, fx, product] = await Promise.all([
    getSettings(),
    options.fx ? Promise.resolve(options.fx) : getFxRates(),
    request.productId ? store.get("products", request.productId) : null,
  ]);
  const margin = resolveMargin(
    settings,
    request.customerId,
    product?.lineId ?? null,
  );
  const taxes = await validatedTaxes(request.productId);
  const freights = await freightByQuote(quotes.map((q) => q.id));
  const carrierIds = [
    ...new Set([...freights.values()].flat().map((f) => f.carrierId)),
  ];
  const carriers = carrierIds.length
    ? await store.list("parties", { filter: { id: carrierIds } })
    : [];
  const out: QuotePricing[] = [];
  for (const quote of quotes) {
    const sheet = await getQuoteSheet(quote.id);
    // Frete informado pela companhia marítima: o menor em reais.
    const rows = freights.get(quote.id) ?? [];
    const answered = rows
      .filter((f) => f.status === "answered" && f.amount)
      .map((f) => {
        const rate = rateFor(fx.rates, f.currency);
        return { f, brl: rate ? f.amount! * rate : null };
      })
      .filter((x) => x.brl !== null)
      .sort((a, b) => a.brl! - b.brl!);
    const best = answered[0];
    const shippingFreight: QuotePricing["shippingFreight"] = best
      ? {
          status: "answered",
          carrierName:
            carriers.find((c) => c.id === best.f.carrierId)?.name ?? null,
          amount: best.f.amount,
          currency: best.f.currency,
          brl: Math.round(best.brl! * 100) / 100,
          transitDays: best.f.transitDays,
        }
      : {
          status: rows.length ? "waiting" : "none",
          carrierName: null,
          amount: null,
          currency: null,
          brl: null,
          transitDays: null,
        };
    const input: PricingInput = {
      unitPrice: sheet?.price ?? quote.price,
      currency: sheet?.currency ?? quote.currency,
      quantity: request.quantity,
      totalCbm: totalCbmFor(
        request.quantity,
        sheet?.masterCartonQty ?? null,
        sheet?.cbmPerCarton ?? null,
      ),
      importTaxPercent: sheet?.importTaxPercent ?? taxes.ii,
      ipiPercent: sheet?.ipiPercent ?? taxes.ipi,
      marginPercent: margin.percent,
      fx: fx.rates,
      freight: {
        // Digitado pelo operador > informado pela companhia marítima > por CBM.
        carrierBrl: options.carrierBrl ?? shippingFreight.brl,
        perCbm: settings.freightPerCbm,
        perCbmCurrency: settings.freightCurrency,
      },
    };
    out.push({
      quoteId: quote.id,
      hasSheet: !!sheet,
      input,
      result: priceToCustomer(input),
      marginSource: margin.source,
      freightPerCbm: settings.freightPerCbm,
      freightCurrency: settings.freightCurrency,
      shippingFreight,
    });
  }
  return { fx, quotes: out };
}

/** O que fica gravado na auditoria da seleção (e serve para atualizar a proposta). */
export interface PricingRecord {
  quoteId: string;
  input: PricingInput;
  result: PricingResult;
  marginSource: QuotePricing["marginSource"];
  fxStatus: FxView["status"];
  fxDay: string | null;
  /** Valor ao cliente efetivamente proposto (pode ter sido ajustado à mão). */
  sellPrice: number;
  sellCurrency: string;
}

export async function latestPricingRecord(
  requestId: string,
): Promise<PricingRecord | null> {
  const rows = await getStore().list("audit_log", {
    filter: {
      entity: "request",
      entityId: requestId,
      action: ["quote.select", "proposal.refresh"],
    },
    orderBy: "createdAt",
    direction: "desc",
    limit: 1,
  });
  const after = rows[0]?.after as { pricing?: PricingRecord } | null;
  return after?.pricing ?? null;
}

/** Variação do câmbio da moeda da ficha entre a proposta e hoje (%). */
export function fxVariance(record: PricingRecord, fx: FxView) {
  const before = record.result.fxRate;
  const now = rateFor(fx.rates, record.input.currency);
  if (!before || !now || record.fxDay === fx.day) return null;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.01) return null;
  return { before, now, pct, currency: record.input.currency ?? "" };
}

export class ProposalError extends Error {}

/**
 * Atualiza o valor ao cliente com o câmbio de hoje (mesma margem, frete e
 * impostos; um ajuste manual feito na seleção é mantido na mesma proporção).
 * Só antes de o cliente enviar o comprovante do sinal.
 */
export async function refreshProposal(user: User, requestId: string) {
  assertWellmix(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new ProposalError("not_found");
  if (request.status !== "WAITING_DOWN_PAYMENT")
    throw new ProposalError("invalid_status");
  if (request.sellCurrency !== "BRL") throw new ProposalError("not_brl");
  const [payment] = await store.list("payments", {
    filter: { requestId, direction: "customer_in", status: "pending" },
    limit: 1,
  });
  if (payment?.proofDocumentId) throw new ProposalError("proof_already_sent");
  const record = await latestPricingRecord(requestId);
  const quote = record ? await store.get("quotes", record.quoteId) : null;
  if (!record || !quote || !record.result.sellBrl)
    throw new ProposalError("no_pricing");
  const ctx = await quotePricing(request, [quote], {
    carrierBrl: record.input.freight.carrierBrl ?? null,
  });
  const fresh = ctx.quotes[0];
  if (!fresh.result.sellBrl) throw new ProposalError("no_pricing");
  const factor = record.sellPrice / record.result.sellBrl;
  const sellPrice = Math.round(fresh.result.sellBrl * factor * 100) / 100;
  const downRatio =
    request.sellPrice && request.downPaymentAmount !== null
      ? request.downPaymentAmount / request.sellPrice
      : 0;
  const downPaymentAmount = Math.round(sellPrice * downRatio * 100) / 100;
  await store.update("requests", requestId, { sellPrice, downPaymentAmount });
  if (payment)
    await store.update("payments", payment.id, { amount: downPaymentAmount });
  const pricing: PricingRecord = {
    quoteId: quote.id,
    input: fresh.input,
    result: fresh.result,
    marginSource: fresh.marginSource,
    fxStatus: ctx.fx.status,
    fxDay: ctx.fx.day,
    sellPrice,
    sellCurrency: "BRL",
  };
  await audit(
    user,
    "proposal.refresh",
    "request",
    requestId,
    `Proposta atualizada com o câmbio de ${ctx.fx.day ?? "hoje"}: BRL ${request.sellPrice} → ${sellPrice}`,
    {
      sellPrice: request.sellPrice,
      downPaymentAmount: request.downPaymentAmount,
    },
    { sellPrice, downPaymentAmount, pricing },
  );
  await notify(requesterTarget(request.requestedForUserId), {
    subject: `Proposta atualizada: ${request.productName}`,
    body: `Novo valor BRL ${sellPrice.toFixed(2)} (câmbio do dia). Sinal: BRL ${downPaymentAmount.toFixed(2)}.`,
    link: `/app/requests/${requestId}`,
  });
  return { sellPrice, downPaymentAmount };
}
