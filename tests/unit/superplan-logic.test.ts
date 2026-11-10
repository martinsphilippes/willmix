import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { translator } from "@/i18n";
import { pt as texts } from "@/i18n/modules/superplan-logic";
import {
  computeSuperplan,
  DEFAULT_SUPERPLAN,
  type SuperplanInput,
} from "@/lib/superplan";
import type { SuperplanContext } from "@/lib/superplan-defaults";
import { SuperplanLogic } from "@/app/app/superplan/_components/logic";

/*
 * A lógica do Superplan escrita na tela (pedido do dono): os oito passos
 * aparecem, com os percentuais em uso e sem campo vazio, nos três idiomas. E
 * as fórmulas escritas dão o mesmo número que a conta de verdade.
 */
const ctx: SuperplanContext = {
  params: DEFAULT_SUPERPLAN,
  containers: [],
  defaultContainer: null,
  official: 5.5,
  rmbPerUsd: 7.2,
  fxDate: null,
  fxStatus: "manual",
  insurancePct: 0.5,
  pisImportPct: 2.1,
  cofinsImportPct: 9.65,
  icmsImportPct: null,
};

const render = (
  locale: "pt" | "en" | "zh",
  over: Partial<SuperplanContext> = {},
) =>
  renderToStaticMarkup(
    createElement(SuperplanLogic, {
      ctx: { ...ctx, ...over },
      t: translator(locale),
    }),
  );

describe("lógica do Superplan escrita na tela", () => {
  it("oito passos, sem campo vazio, nos três idiomas", () => {
    for (const locale of ["pt", "en", "zh"] as const) {
      const html = render(locale);
      expect(html.match(/data-superplan-logic-step=/g)).toHaveLength(8);
      // Nenhum {campo} sem preencher e nenhuma chave crua na tela.
      expect(html).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(html).not.toContain("superplanLogic.");
      const t = translator(locale);
      for (const key of Object.keys(texts))
        expect(t(key as never), key).not.toBe(key);
    }
  });

  it("mostra os percentuais que estão valendo", () => {
    const html = render("pt");
    expect(html).toContain("dólar oficial + R$ 0,25");
    expect(html).toContain("3,02% acima do dólar oficial");
    expect(html).toContain("AFRMM = frete (R$) × 8% + R$ 700");
    expect(html).toContain("PIS = valor aduaneiro × 2,1%");
    expect(html).toContain("COFINS = valor aduaneiro × 9,65%");
    expect(html).toContain("Taxa do CE (origem), THC");
    expect(html).toContain("Tabela = mínimo × 1,25");
    expect(html).toContain("ICMS = base × 1,5% − crédito");
    expect(html).toContain("não configurado (não entra na conta)");
    expect(render("pt", { icmsImportPct: 18 })).toContain(
      "ICMS da importação: 18%",
    );
  });

  it("as fórmulas escritas batem com a conta de verdade", () => {
    const p = DEFAULT_SUPERPLAN;
    const input: SuperplanInput = {
      unitPrice: 4,
      currency: "RMB",
      pcsPerCarton: 12,
      netWeightPcKg: 0.225,
      grossWeightPcKg: null,
      cbmPerCarton: 0.0183,
      containerCbm: 68,
      containerMaxKg: 26500,
      iiPct: 18,
      ipiPct: 6.5,
      freightUsd: p.freightUsd,
      roadFreightBrl: p.roadFreightBrl,
      deliveryFreightBrl: 0,
      officialRate: 5.5,
      futureRate: 5.5 + p.futureSpreadBrl,
      rmbPerUsd: 7.2,
      tradingCommissionPct: 0,
      chinaChargesRmb: 0,
      expenses: p.expenses,
      markup: 1.8,
      commissionPct: 5,
      adminExpensesPct: 12,
      targetProfitPct: 22,
      wdPct: 12,
      insurancePct: ctx.insurancePct,
      pisImportPct: ctx.pisImportPct,
      cofinsImportPct: ctx.cofinsImportPct,
      icmsImportPct: 0,
      freightFxPct: p.freightFxPct,
      afrmmPct: p.afrmmPct,
      afrmmFixedBrl: p.afrmmFixedBrl,
      grossEstimatePct: p.grossEstimatePct,
      priceFactors: p.priceFactors,
      saleTaxes: p.saleTaxes,
      salePrice: null,
    };
    const r = computeSuperplan(input);
    const c = r.cost!;
    const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
    // Passo 1: caixas inteiras pelo volume (o peso não limita aqui).
    const cartons = Math.floor(68 / 0.0183);
    expect(r.container!.cartons).toBe(cartons);
    const pieces = cartons * 12;
    expect(r.container!.pieces).toBe(pieces);
    // Passo 2: FOB e compra no dólar futuro.
    const fob = (4 / 7.2) * pieces;
    close(c.fobUsd, fob);
    close(c.goodsBrl, fob * (5.5 + p.futureSpreadBrl));
    // Passo 3: frete e seguro.
    const freight = p.freightUsd * 5.5 * (1 + p.freightFxPct / 100);
    close(c.freightBrl, freight);
    close(c.insuranceBrl, fob * (ctx.insurancePct / 100) * 5.5);
    // Passo 4: valor aduaneiro e impostos da importação.
    const customsExtras = p.expenses
      .filter((e) => e.customs)
      .reduce((sum, e) => sum + e.amountBrl, 0);
    const va =
      (fob + p.freightUsd + fob * (ctx.insurancePct / 100)) * 5.5 +
      customsExtras;
    close(c.customsValueBrl, va);
    close(c.iiBrl, va * 0.18);
    close(c.ipiBrl, (va + va * 0.18) * 0.065);
    close(c.pisBrl, va * (ctx.pisImportPct / 100));
    close(c.cofinsBrl, va * (ctx.cofinsImportPct / 100));
    close(c.afrmmBrl, freight * (p.afrmmPct / 100) + p.afrmmFixedBrl);
    expect(c.icmsBrl).toBe(0);
    // Passo 5: custo do container e por peça.
    const expenses = p.expenses.reduce((sum, e) => sum + e.amountBrl, 0);
    const total =
      c.goodsBrl +
      c.freightBrl +
      c.insuranceBrl +
      c.iiBrl +
      c.ipiBrl +
      c.pisBrl +
      c.cofinsBrl +
      c.afrmmBrl +
      expenses +
      p.roadFreightBrl;
    close(c.totalBrl, total);
    close(c.perPiece, total / pieces);
    // Passo 6: preços.
    const minimum = c.perPiece * 1.8;
    close(r.prices!.minimum, minimum);
    close(r.prices!.table, minimum * p.priceFactors.table);
    close(r.prices!.wd, minimum * 1.12);
    // Passo 7: lucro na venda, no preço mínimo.
    const tx = p.saleTaxes;
    const base = minimum * (1 - 0.065);
    const ipi = base * 0.065 - c.ipiBrl / pieces;
    const icmsFull = base * (tx.icmsPct / 100);
    const net = base - icmsFull - ipi;
    const deductions =
      ipi +
      icmsFull +
      (net * (tx.pisPct / 100) - c.pisBrl / pieces) +
      (net * (tx.cofinsPct / 100) - c.cofinsBrl / pieces) +
      base * (tx.irPct / 100) +
      base * (tx.csllPct / 100) +
      minimum * 0.05 +
      minimum * 0.12;
    close(r.sale!.profit, minimum - c.perPiece - deductions);
    close(r.sale!.profitPct, (r.sale!.profit / minimum) * 100);
    // Passo 8: o sinal segue a meta.
    expect(r.verdict).toBe(
      r.sale!.profit <= 0
        ? "loss"
        : r.sale!.profitPct >= 22
          ? "viable"
          : "below",
    );
  });
});
