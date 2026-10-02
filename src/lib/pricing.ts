/*
 * Preço ao cliente a partir da ficha de compra do fornecedor (custo importado
 * estimado + margem). Funções puras: servem no servidor e na tela.
 *
 *   FOB (R$)        = preço da ficha × quantidade × câmbio da moeda da ficha
 *   Frete (R$)      = valor do transportador, ou CBM total × frete por CBM × câmbio
 *   Seguro (R$)     = FOB × seguro %
 *   Valor aduaneiro = FOB + frete + seguro (o "CIF")
 *   II (R$)         = valor aduaneiro × II % (TEC pelo NCM)
 *   IPI (R$)        = (valor aduaneiro + II) × IPI % (TIPI pelo NCM)
 *   PIS (R$)        = valor aduaneiro × PIS-importação %
 *   COFINS (R$)     = valor aduaneiro × COFINS-importação %
 *   ICMS (R$)       = (aduaneiro + II + IPI + PIS + COFINS) ÷ (1 − ICMS %) × ICMS %
 *   Custo importado = valor aduaneiro + II + IPI + PIS + COFINS + ICMS
 *   Valor ao cliente = custo importado × (1 + margem %)
 *
 * Câmbio = R$ por unidade da moeda (PTAX venda). Taxa Siscomex, AFRMM,
 * armazenagem e despachante não entram: ficam na margem. Seguro, PIS, COFINS e
 * ICMS ausentes (registros antigos) valem 0 sem aviso; ICMS null = não
 * configurado (aviso).
 */

export type FxRates = Partial<Record<"USD" | "RMB" | "EUR" | "BRL", number>>;

export interface FreightInput {
  /** Valor informado pelo transportador, já em reais. Tem prioridade. */
  carrierBrl?: number | null;
  /** Frete estimado por CBM (Configurações). */
  perCbm?: number | null;
  perCbmCurrency?: string | null;
}

export interface PricingInput {
  unitPrice: number | null;
  currency: string | null;
  quantity: number;
  /** CBM total da carga (caixas × CBM da caixa). */
  totalCbm: number | null;
  importTaxPercent: number | null;
  ipiPercent: number | null;
  /** Seguro internacional (% do FOB). */
  insurancePercent?: number | null;
  pisPercent?: number | null;
  cofinsPercent?: number | null;
  /** null = ICMS não configurado. */
  icmsPercent?: number | null;
  marginPercent: number;
  fx: FxRates;
  freight: FreightInput;
}

export type PricingMissing =
  "price" | "fx" | "freight" | "cbm" | "importTax" | "ipi" | "icms";

export interface PricingResult {
  fobBrl: number | null;
  freightBrl: number;
  freightSource: "carrier" | "cbm" | "none";
  insuranceBrl: number;
  /** Valor aduaneiro (FOB + frete + seguro). */
  cifBrl: number | null;
  importTaxBrl: number;
  ipiBrl: number;
  pisBrl: number;
  cofinsBrl: number;
  icmsBrl: number;
  landedBrl: number | null;
  marginPercent: number;
  marginBrl: number | null;
  sellBrl: number | null;
  /** Câmbio usado para a moeda da ficha (R$ por unidade). */
  fxRate: number | null;
  /** O que faltou: a conta sai, mas sem essa parcela. */
  missing: PricingMissing[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Moeda da ficha → chave do câmbio (CNY e RMB são a mesma). */
export function fxKey(currency: string | null | undefined) {
  const c = (currency ?? "").toUpperCase();
  if (c === "CNY") return "RMB" as const;
  return c === "USD" || c === "RMB" || c === "EUR" || c === "BRL" ? c : null;
}

export function rateFor(fx: FxRates, currency: string | null | undefined) {
  const key = fxKey(currency);
  if (!key) return null;
  if (key === "BRL") return 1;
  return positive(fx[key]) ? fx[key]! : null;
}

/** CBM total: caixas master (arredondadas para cima) × CBM da caixa. */
export function totalCbmFor(
  quantity: number,
  masterCartonQty: number | null,
  cbmPerCarton: number | null,
) {
  if (
    !positive(quantity) ||
    !positive(masterCartonQty) ||
    !positive(cbmPerCarton)
  )
    return null;
  return Math.ceil(quantity / masterCartonQty) * cbmPerCarton;
}

export function priceToCustomer(input: PricingInput): PricingResult {
  const missing: PricingMissing[] = [];
  const fxRate = rateFor(input.fx, input.currency);
  let fobBrl: number | null = null;
  if (!positive(input.unitPrice)) missing.push("price");
  else if (fxRate === null) missing.push("fx");
  else fobBrl = input.unitPrice * input.quantity * fxRate;

  let freightBrl = 0;
  let freightSource: PricingResult["freightSource"] = "none";
  if (positive(input.freight.carrierBrl)) {
    freightBrl = input.freight.carrierBrl;
    freightSource = "carrier";
  } else if (positive(input.freight.perCbm)) {
    const freightFx = rateFor(input.fx, input.freight.perCbmCurrency ?? "USD");
    if (!positive(input.totalCbm)) missing.push("cbm");
    else if (freightFx === null) missing.push("fx");
    else {
      freightBrl = input.totalCbm * input.freight.perCbm * freightFx;
      freightSource = "cbm";
    }
  } else missing.push("freight");

  if (input.importTaxPercent === null) missing.push("importTax");
  if (input.ipiPercent === null) missing.push("ipi");
  if (input.icmsPercent === null) missing.push("icms");

  if (fobBrl === null)
    return {
      fobBrl: null,
      freightBrl: round2(freightBrl),
      freightSource,
      insuranceBrl: 0,
      cifBrl: null,
      importTaxBrl: 0,
      ipiBrl: 0,
      pisBrl: 0,
      cofinsBrl: 0,
      icmsBrl: 0,
      landedBrl: null,
      marginPercent: input.marginPercent,
      marginBrl: null,
      sellBrl: null,
      fxRate,
      missing: [...new Set(missing)],
    };

  const pct = (n: number | null | undefined) => (n ?? 0) / 100;
  const insurance = fobBrl * pct(input.insurancePercent);
  const cif = fobBrl + freightBrl + insurance;
  const importTax = cif * pct(input.importTaxPercent);
  const ipi = (cif + importTax) * pct(input.ipiPercent);
  const pis = cif * pct(input.pisPercent);
  const cofins = cif * pct(input.cofinsPercent);
  // ICMS "por dentro": o imposto integra a própria base.
  const icmsRate = Math.min(pct(input.icmsPercent), 0.99);
  const beforeIcms = cif + importTax + ipi + pis + cofins;
  const icms = icmsRate > 0 ? (beforeIcms / (1 - icmsRate)) * icmsRate : 0;
  const landed = beforeIcms + icms;
  const margin = landed * (input.marginPercent / 100);
  return {
    fobBrl: round2(fobBrl),
    freightBrl: round2(freightBrl),
    freightSource,
    insuranceBrl: round2(insurance),
    cifBrl: round2(cif),
    importTaxBrl: round2(importTax),
    ipiBrl: round2(ipi),
    pisBrl: round2(pis),
    cofinsBrl: round2(cofins),
    icmsBrl: round2(icms),
    landedBrl: round2(landed),
    marginPercent: input.marginPercent,
    marginBrl: round2(margin),
    sellBrl: round2(landed + margin),
    fxRate,
    missing: [...new Set(missing)],
  };
}

export interface MarginSettings {
  marginPercent: number;
  marginByLine: Record<string, number>;
  marginByCustomer: Record<string, number>;
}

/** Margem: a do cliente, se houver; senão a da linha; senão a geral. */
export function resolveMargin(
  settings: MarginSettings,
  customerId: string | null,
  lineId: string | null,
): { percent: number; source: "customer" | "line" | "default" } {
  const c = customerId ? settings.marginByCustomer[customerId] : undefined;
  if (typeof c === "number" && Number.isFinite(c))
    return { percent: c, source: "customer" };
  const l = lineId ? settings.marginByLine[lineId] : undefined;
  if (typeof l === "number" && Number.isFinite(l))
    return { percent: l, source: "line" };
  return { percent: settings.marginPercent, source: "default" };
}
