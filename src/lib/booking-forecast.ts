import type { BookingAnalysis, BookingItem } from "@/lib/db/schema";
import type {
  PriceForecastAnswer,
  PriceForecastQuery,
} from "@/lib/integrations/price-forecast";

/*
 * Previsão de preço dos itens do Book (dono, 24/11/2026; docs/BOOKING.md,
 * "Previsão de preço do item"): a mesma API de preço da Nova solicitação de
 * encomenda e de reposição (cotação V2 do Sankhya,
 * src/lib/integrations/price-forecast.ts), no lugar da conta antiga do
 * portal. Vai a ficha do item como a planilha trouxe (NCM, pesos, peças por
 * caixa, CBM, preço, moeda, Incoterm e a quantidade) e nunca o CODPROD: o
 * Sankhya calcula pelo NCM. O retrato fica no item (`booking_items.analysis`)
 * e só a Wellmix o vê. Regra pura: sem banco nem Intl.
 */

const positive = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

/** A consulta da previsão para um item do book (sem cliente nem CODPROD). */
export function bookingItemForecastQuery(
  item: Pick<
    BookingItem,
    | "id"
    | "ncm"
    | "netWeightPcKg"
    | "grossWeightPcKg"
    | "masterCartonQty"
    | "cbmPerCarton"
    | "price"
    | "currency"
    | "incoterm"
    | "purchaseQty"
    | "plannedQty"
  >,
  options: {
    /** Preço e moeda negociados no lugar dos da planilha. */
    price?: number | null;
    currency?: string | null;
    /** Incoterm do book quando o item não tem o dele. */
    incoterm?: string | null;
    /** Data de referência (AAAAMMDD). */
    dataRef?: string | null;
  } = {},
): PriceForecastQuery {
  const quantity = positive(item.purchaseQty) ?? positive(item.plannedQty);
  return {
    productId: item.id,
    sankhyaCode: null,
    sku: null,
    quantity,
    customerId: null,
    customerSankhyaCode: null,
    ncm: item.ncm ?? null,
    netWeightKg: positive(item.netWeightPcKg),
    grossWeightKg: positive(item.grossWeightPcKg),
    masterBoxQty: positive(item.masterCartonQty),
    cbmPerCarton: positive(item.cbmPerCarton),
    price: options.price !== undefined ? options.price : item.price,
    currency:
      options.currency !== undefined && options.currency !== null
        ? options.currency
        : item.currency,
    incoterm: item.incoterm ?? options.incoterm ?? null,
    dataRef: options.dataRef ?? null,
  };
}

/** O que faltou na ficha do item para a previsão (antes de chamar o Sankhya). */
export function bookingForecastMissing(q: PriceForecastQuery): string[] {
  const missing: string[] = [];
  if (!/^\d{8}$/.test(String(q.ncm ?? "").replace(/\D/g, "")))
    missing.push("ncm");
  if (positive(q.price) === null) missing.push("price");
  const c = String(q.currency ?? "").toUpperCase();
  if (positive(q.price) !== null && !["RMB", "CNY", "USD", "EUR"].includes(c))
    missing.push("currency");
  if (positive(q.masterBoxQty) === null) missing.push("carton");
  if (positive(q.cbmPerCarton) === null) missing.push("cbm");
  return missing;
}

/**
 * A resposta da previsão vira o retrato do item. Sem o Sankhya configurado:
 * `missing: ["manual"]`; erro do Sankhya: `missing: ["error"]` com a
 * mensagem. Nada é estimado no lugar (nunca um preço inventado).
 */
export function forecastAnalysis(
  answer: PriceForecastAnswer,
  q: PriceForecastQuery,
  meta: { at: string; byUserId: string },
): BookingAnalysis {
  const base: BookingAnalysis = {
    at: meta.at,
    byUserId: meta.byUserId,
    source: "price_forecast",
    businessType: "",
    salePriceBrl: null,
    usesMinimum: false,
    costBrl: null,
    minimumBrl: null,
    profitPct: null,
    targetPct: 0,
    verdict: null,
    targetPriceBrl: null,
    missing: [],
    inputs: null,
    sent: {
      ncm: q.ncm ?? null,
      price: positive(q.price),
      currency: q.currency ?? null,
      incoterm: q.incoterm ?? null,
      pcsPerCarton: positive(q.masterBoxQty),
      cbmPerCarton: positive(q.cbmPerCarton),
      quantity: positive(q.quantity),
    },
  };
  if (answer.mode === "manual") return { ...base, missing: ["manual"] };
  if (answer.kind === "error")
    return { ...base, missing: ["error"], message: answer.message };
  if (answer.kind !== "forecast") return { ...base, missing: ["error"] };
  const profit = answer.profitPercent ?? null;
  const verdict: BookingAnalysis["verdict"] =
    answer.goalReached === true
      ? "viable"
      : profit === null
        ? null
        : profit > 0
          ? "below"
          : "loss";
  return {
    ...base,
    salePriceBrl: answer.salePrice,
    costBrl: answer.cost,
    minimumBrl: answer.salePrice,
    profitPct: profit,
    targetPct: answer.goalPercent ?? 0,
    verdict,
    targetPriceBrl: answer.targetPrice,
    withFreightBrl: answer.withFreight ?? null,
    wdWithFreightBrl: answer.wdWithFreight ?? null,
    status: answer.status ?? null,
  };
}
