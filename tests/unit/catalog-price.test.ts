import { describe, expect, it } from "vitest";
import { priceToCustomer, totalCbmFor } from "@/lib/pricing";
import {
  estimateCatalogPrice,
  referenceQuantity,
  tierEstimates,
  tierPrice,
  type CatalogPriceContext,
  type CatalogPriceInput,
} from "@/lib/services/catalog-price-calc";

/*
 * Preço estimado da vitrine: a mesma conta da proposta, pela ficha do
 * produto e o câmbio do dia. Só aparece quando a conta está completa (nada
 * de preço menor que o real); sem algo, fica "sob consulta" com o motivo.
 */
const input = (over: Partial<CatalogPriceInput> = {}): CatalogPriceInput => ({
  unitPrice: 10,
  currency: "USD",
  tiers: null,
  moq: 500,
  masterCartonQty: 50,
  cbmPerCarton: 0.1,
  importTaxPercent: 0,
  ipiPercent: 0,
  ...over,
});
const ctx = (over: Partial<CatalogPriceContext> = {}): CatalogPriceContext => ({
  fx: { USD: 5 },
  marginPercent: 0,
  insurancePercent: 0,
  pisPercent: 0,
  cofinsPercent: 0,
  icmsPercent: 0,
  freightPerCbm: 100,
  freightCurrency: "USD",
  ...over,
});

describe("preço estimado da vitrine", () => {
  it("conta completa: FOB + frete por CBM + margem, por unidade, no pedido mínimo", () => {
    // 500 un × US$ 10 × 5 = R$ 25.000; 10 caixas × 0,1 m³ × US$ 100 × 5 = R$ 500.
    const e = estimateCatalogPrice(input(), ctx());
    expect(e).toEqual({
      ok: true,
      unitBrl: 51,
      totalBrl: 25500,
      quantity: 500,
    });
    // Margem de 20% sobre o custo importado.
    const m = estimateCatalogPrice(input(), ctx({ marginPercent: 20 }));
    expect(m.ok && m.unitBrl).toBeCloseTo(61.2);
  });

  it("faltando algo da conta: sob consulta, com o que falta (nada de preço menor)", () => {
    const noFx = estimateCatalogPrice(input(), ctx({ fx: {} }));
    expect(noFx).toEqual({ ok: false, missing: ["fx"] });
    const noFreight = estimateCatalogPrice(
      input(),
      ctx({ freightPerCbm: null }),
    );
    expect(noFreight).toEqual({ ok: false, missing: ["freight"] });
    const noTax = estimateCatalogPrice(
      input({ importTaxPercent: null, ipiPercent: null }),
      ctx({ icmsPercent: null }),
    );
    expect(noTax.ok).toBe(false);
    expect(!noTax.ok && noTax.missing.sort()).toEqual(
      ["icms", "importTax", "ipi"].sort(),
    );
    const noCbm = estimateCatalogPrice(input({ cbmPerCarton: null }), ctx());
    expect(noCbm).toEqual({ ok: false, missing: ["cbm"] });
    expect(estimateCatalogPrice(input({ unitPrice: null }), ctx())).toEqual({
      ok: false,
      missing: ["price"],
    });
  });

  it("faixas por quantidade: preço do fornecedor cai a partir de cada faixa", () => {
    const tiers = [
      { minQty: 500, price: 10 },
      { minQty: 1000, price: 9 },
      { minQty: 2000, price: 8 },
    ];
    expect(tierPrice(input({ tiers }), 999)).toBe(10);
    expect(tierPrice(input({ tiers }), 1000)).toBe(9);
    expect(tierPrice(input({ tiers }), 5000)).toBe(8);
    expect(tierPrice(input({ tiers: null }), 5000)).toBe(10);
    const rows = tierEstimates(input({ tiers }), ctx());
    expect(rows.map((r) => r.minQty)).toEqual([500, 1000, 2000]);
    expect(rows[0].unitBrl).toBeGreaterThan(rows[1].unitBrl);
    expect(rows[1].unitBrl).toBeGreaterThan(rows[2].unitBrl);
    // Sem faixas, não há tabela (o preço não muda com a quantidade).
    expect(tierEstimates(input(), ctx())).toEqual([]);
  });

  it("quantidade de referência: pedido mínimo; sem ele, uma caixa; senão 1", () => {
    expect(referenceQuantity(input())).toBe(500);
    expect(referenceQuantity(input({ moq: null }))).toBe(50);
    expect(referenceQuantity(input({ moq: null, masterCartonQty: null }))).toBe(
      1,
    );
  });

  it("faixa velha (preço renegociado ou outro fornecedor) é ignorada: nada abaixo da proposta", () => {
    // Ficha renegociada para 10,5; faixas antigas a partir de 9,5.
    const stale = input({
      unitPrice: 10.5,
      tiers: [
        { minQty: 500, price: 9.5 },
        { minQty: 1000, price: 9 },
      ],
    });
    expect(tierPrice(stale, 500)).toBe(10.5);
    expect(tierPrice(stale, 5000)).toBe(10.5);
    expect(tierEstimates(stale, ctx())).toEqual([]);
    const fresh = estimateCatalogPrice(input({ unitPrice: 10.5 }), ctx());
    expect(estimateCatalogPrice(stale, ctx())).toEqual(fresh);
    // Faixas só de desconto (sem a da quantidade mínima), vindas de outra
    // moeda: não há como ligá-las ao preço atual, ficam de fora.
    const otherCurrency = input({
      unitPrice: 65,
      currency: "RMB",
      moq: 300,
      tiers: [
        { minQty: 500, price: 9.5 },
        { minQty: 1000, price: 8.9 },
      ],
    });
    expect(tierPrice(otherCurrency, 1000)).toBe(65);
    expect(tierEstimates(otherCurrency, ctx({ fx: { RMB: 0.75 } }))).toEqual(
      [],
    );
    // Faixa "mais cara" que o preço base também não vale.
    expect(
      tierPrice(input({ tiers: [{ minQty: 1000, price: 12 }] }), 2000),
    ).toBe(10);
  });

  it("item barato em grande volume: total igual à proposta e unidade nunca abaixo dela", () => {
    const cheap = input({
      unitPrice: 0.0224,
      moq: 100_000,
      masterCartonQty: 1000,
      cbmPerCarton: 0.05,
      importTaxPercent: 18,
      ipiPercent: 5,
    });
    const c = ctx({ marginPercent: 30, icmsPercent: 18 });
    const e = estimateCatalogPrice(cheap, c);
    const proposal = priceToCustomer({
      unitPrice: 0.0224,
      currency: "USD",
      quantity: 100_000,
      totalCbm: totalCbmFor(100_000, 1000, 0.05),
      importTaxPercent: 18,
      ipiPercent: 5,
      insurancePercent: 0,
      pisPercent: 0,
      cofinsPercent: 0,
      icmsPercent: 18,
      marginPercent: 30,
      fx: { USD: 5 },
      freight: { carrierBrl: null, perCbm: 100, perCbmCurrency: "USD" },
    });
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.totalBrl).toBe(proposal.sellBrl);
    expect(e.unitBrl * e.quantity).toBeGreaterThanOrEqual(proposal.sellBrl!);
  });
});
