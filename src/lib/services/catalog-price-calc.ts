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
      /** Preço por unidade ao cliente, em R$ (arredondado para cima no centavo). */
      unitBrl: number;
      /** Valor ao cliente da quantidade inteira (a conta da proposta, sem multiplicar arredondamento). */
      totalBrl: number;
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

/**
 * Faixas que valem: só descontos acima da quantidade de referência, e só se
 * existe a faixa que cobre a referência e ela bate com o preço base. Faixa de outro preço
 * (renegociado, outro fornecedor, outra moeda) está velha e é ignorada: usá-la
 * mostraria preço menor que o da proposta, que não usa faixas.
 */
export function usableTiers(
  input: CatalogPriceInput,
): { minQty: number; price: number }[] {
  const base = referenceQuantity(input);
  const valid = (input.tiers ?? []).filter(
    (t) =>
      Number.isFinite(t.minQty) &&
      t.minQty > 0 &&
      Number.isFinite(t.price) &&
      t.price > 0,
  );
  const atBase = valid
    .filter((t) => t.minQty <= base)
    .sort((a, b) => b.minQty - a.minQty)[0];
  // Sem faixa na quantidade de referência não há como saber se as faixas são
  // do preço atual (ex.: outra moeda ou preço renegociado): ficam de fora.
  if (!atBase || atBase.price !== input.unitPrice) return [];
  return valid.filter(
    (t) => t.minQty > base && t.price < (input.unitPrice ?? 0),
  );
}

/** Preço do fornecedor para a quantidade: a maior faixa válida alcançada, ou o preço base. */
export function tierPrice(
  input: CatalogPriceInput,
  quantity: number,
): number | null {
  const reached = usableTiers(input)
    .filter((t) => t.minQty <= quantity)
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
  // Para cima no centavo: a unidade mostrada nunca fica abaixo da proposta.
  return {
    ok: true,
    unitBrl: Math.ceil(Math.round((result.sellBrl / qty) * 1e6) / 1e4) / 100,
    totalBrl: result.sellBrl,
    quantity: qty,
  };
}

/** Preço por faixa de quantidade (a partir de N un), para a página do produto. */
export function tierEstimates(
  input: CatalogPriceInput,
  ctx: CatalogPriceContext,
): { minQty: number; unitBrl: number }[] {
  const base = referenceQuantity(input);
  const starts = [base, ...usableTiers(input).map((t) => t.minQty)];
  const out: { minQty: number; unitBrl: number }[] = [];
  for (const minQty of [...new Set(starts)].sort((a, b) => a - b)) {
    const e = estimateCatalogPrice(input, ctx, minQty);
    if (e.ok) out.push({ minQty, unitBrl: e.unitBrl });
  }
  // Só faz sentido mostrar a tabela quando o preço muda com a quantidade.
  return out.length > 1 ? out : [];
}
