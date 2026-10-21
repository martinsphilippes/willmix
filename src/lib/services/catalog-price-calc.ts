import {
  priceToCustomer,
  totalCbmFor,
  type FxRates,
  type PricingMissing,
} from "@/lib/pricing";

/*
 * Preço estimado ao cliente na vitrine (sem banco): a mesma conta da proposta
 * (FOB + frete marítimo por CBM + seguro + II + IPI + PIS + COFINS + ICMS +
 * margem), feita com a ficha do produto e o câmbio do dia. Só sai preço
 * quando a conta está completa: faltando câmbio, frete, CBM ou imposto, o
 * produto fica "sob consulta" (preço estimado abaixo do real frustraria o
 * cliente na proposta). A Wellmix vê o que falta para o preço aparecer.
 */

export interface CatalogPriceInput {
  /** Preço do fornecedor (FOB) e moeda: ficha mestre ou cadastro. */
  unitPrice: number | null;
  currency: string | null;
  /** Faixas negociadas por quantidade (mesma moeda do preço). */
  tiers: { minQty: number; price: number }[] | null;
  moq: number | null;
  masterCartonQty: number | null;
  cbmPerCarton: number | null;
  importTaxPercent: number | null;
  ipiPercent: number | null;
}

export interface CatalogPriceContext {
  fx: FxRates;
  marginPercent: number;
  insurancePercent: number | null;
  pisPercent: number | null;
  cofinsPercent: number | null;
  icmsPercent: number | null;
  freightPerCbm: number | null;
  freightCurrency: string | null;
}

/** O que falta para o preço aparecer (para a Wellmix completar). */
export type CatalogPriceMissing = PricingMissing;

export type CatalogEstimate =
  | {
      ok: true;
      /** Preço por unidade ao cliente, em R$. */
      unitBrl: number;
      /** Quantidade usada na conta (o pedido mínimo, ou a pedida). */
      quantity: number;
    }
  | { ok: false; missing: CatalogPriceMissing[] };

/** Quantidade de referência do card: o pedido mínimo; sem ele, uma caixa. */
export function referenceQuantity(input: CatalogPriceInput): number {
  if (input.moq && input.moq > 0) return input.moq;
  if (input.masterCartonQty && input.masterCartonQty > 0)
    return input.masterCartonQty;
  return 1;
}

/** Preço do fornecedor para a quantidade: a maior faixa alcançada, ou o preço base. */
export function tierPrice(
  input: Pick<CatalogPriceInput, "unitPrice" | "tiers">,
  quantity: number,
): number | null {
  const reached = (input.tiers ?? [])
    .filter(
      (t) =>
        Number.isFinite(t.minQty) &&
        Number.isFinite(t.price) &&
        t.price > 0 &&
        t.minQty <= quantity,
    )
    .sort((a, b) => b.minQty - a.minQty)[0];
  return reached?.price ?? input.unitPrice;
}

/** Faltas que impedem mostrar preço (a conta sairia menor que a real). */
const BLOCKING: CatalogPriceMissing[] = [
  "price",
  "fx",
  "freight",
  "cbm",
  "importTax",
  "ipi",
  "icms",
];

export function estimateCatalogPrice(
  input: CatalogPriceInput,
  ctx: CatalogPriceContext,
  quantity = referenceQuantity(input),
): CatalogEstimate {
  const qty = Math.max(1, Math.round(quantity));
  const result = priceToCustomer({
    unitPrice: tierPrice(input, qty),
    currency: input.currency,
    quantity: qty,
    totalCbm: totalCbmFor(qty, input.masterCartonQty, input.cbmPerCarton),
    importTaxPercent: input.importTaxPercent,
    ipiPercent: input.ipiPercent,
    insurancePercent: ctx.insurancePercent,
    pisPercent: ctx.pisPercent,
    cofinsPercent: ctx.cofinsPercent,
    icmsPercent: ctx.icmsPercent,
    marginPercent: ctx.marginPercent,
    fx: ctx.fx,
    freight: {
      carrierBrl: null,
      perCbm: ctx.freightPerCbm,
      perCbmCurrency: ctx.freightCurrency,
    },
  });
  const missing = [...new Set(result.missing)].filter((m) =>
    BLOCKING.includes(m),
  );
  if (missing.length || result.sellBrl === null || !(result.sellBrl > 0))
    return {
      ok: false,
      missing: missing.length ? missing : (["price"] as CatalogPriceMissing[]),
    };
  return {
    ok: true,
    unitBrl: Math.round((result.sellBrl / qty) * 100) / 100,
    quantity: qty,
  };
}

/** Preço por faixa de quantidade (a partir de N un), para a página do produto. */
export function tierEstimates(
  input: CatalogPriceInput,
  ctx: CatalogPriceContext,
): { minQty: number; unitBrl: number }[] {
  const base = referenceQuantity(input);
  const starts = [
    base,
    ...(input.tiers ?? [])
      .map((t) => t.minQty)
      .filter((q) => Number.isFinite(q) && q > base),
  ];
  const out: { minQty: number; unitBrl: number }[] = [];
  for (const minQty of [...new Set(starts)].sort((a, b) => a - b)) {
    const e = estimateCatalogPrice(input, ctx, minQty);
    if (e.ok) out.push({ minQty, unitBrl: e.unitBrl });
  }
  // Só faz sentido mostrar a tabela quando o preço muda com a quantidade.
  return out.length > 1 ? out : [];
}
