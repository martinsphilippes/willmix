/*
 * Superplan: viabilidade de um produto importado (docs/SUPERPLAN.md). A partir
 * do preço do fornecedor, da caixa, do container, dos fretes, do câmbio e das
 * despesas, calcula o custo por peça, o preço mínimo de venda (custo ×
 * markup do tipo de negócio), os preços sugeridos, o lucro líquido e se o
 * produto é viável (lucro igual ou acima da meta do tipo). Funções puras: a
 * tela calcula ao vivo e os testes usam as mesmas contas.
 *
 * Diferenças para a planilha SuperPlan, decididas pelo dono:
 * - impostos da importação sobre o valor real da compra (valor aduaneiro =
 *   (FOB + frete + seguro) × dólar oficial + THC + taxa do CE) e impostos da
 *   venda sobre o preço cheio;
 * - cada despesa entra uma vez só no custo (AFRMM, THC, taxa do CE e frete
 *   rodoviário entravam em dobro);
 * - o tipo de negócio preenche markup, comissão, despesas e meta;
 * - o container leva só caixas inteiras;
 * - os créditos de IPI, ICMS, PIS e COFINS da venda são os impostos pagos na
 *   importação, por peça.
 * Percentuais e valores ficam nos parâmetros (editáveis pelo administrador).
 *
 * Pesos (src/lib/weights.ts): a ficha traz o peso líquido e o peso bruto por
 * peça, cada um no seu campo. O container é limitado pelo peso BRUTO; quando
 * a ficha só traz o líquido, a conta usa um bruto estimado (líquido + folga da
 * embalagem, dos parâmetros) e o resultado diz que é estimado. O líquido
 * nunca é lido como bruto e a estimativa nunca é gravada no produto.
 */

import { estimatedGrossKg } from "@/lib/weights";

/** Tipo de negócio (empresa, categoria, país e venda), da tabela de parâmetros. */
export interface SuperplanBusinessType {
  name: string;
  /** Meta de lucro líquido, em % do preço de venda. */
  targetProfitPct: number;
  /** Comissão do parceiro, em % do preço. */
  commissionPct: number;
  /** Markup de venda: preço mínimo = custo por peça × markup. */
  markup: number;
  /** Despesas administrativas, em % do preço. */
  adminExpensesPct: number;
  /** Preço WD = preço mínimo + este %. */
  wdPct: number;
}

/** Despesa no Brasil por container (processo), em R$. */
export interface SuperplanExpense {
  key: string;
  label: string;
  amountBrl: number;
  /** THC e taxa do CE compõem o valor aduaneiro (base dos impostos). */
  customs: boolean;
}

export interface SuperplanSaleTaxes {
  /** ICMS efetivo da venda (%). */
  icmsPct: number;
  pisPct: number;
  cofinsPct: number;
  irPct: number;
  csllPct: number;
}

export interface SuperplanPriceFactors {
  /** Preço de tabela = mínimo × fator. */
  table: number;
  /** Sugestão de venda no atacado = mínimo × fator. */
  wholesale: number;
  /** Sugestão de venda na loja (consumidor final) = mínimo × fator. */
  retail: number;
}

/** Parâmetros do Superplan (Configurações; o administrador edita na tela). */
export interface SuperplanParams {
  businessTypes: SuperplanBusinessType[];
  defaultBusinessType: string;
  expenses: SuperplanExpense[];
  /** Frete marítimo padrão por container (US$). */
  freightUsd: number;
  /** Frete rodoviário padrão do porto ao depósito (R$). */
  roadFreightBrl: number;
  /** Dólar futuro = dólar oficial + este valor (R$), informado pelo financeiro. */
  futureSpreadBrl: number;
  /** O frete é pago a um câmbio este % acima do oficial. */
  freightFxPct: number;
  /** AFRMM = frete em R$ × % + valor fixo. */
  afrmmPct: number;
  afrmmFixedBrl: number;
  /**
   * Folga da embalagem no peso (%): quanto a embalagem soma ao peso líquido
   * quando a ficha não traz o peso bruto (bruto estimado = líquido × (1 + %)).
   */
  grossEstimatePct: number;
  priceFactors: SuperplanPriceFactors;
  saleTaxes: SuperplanSaleTaxes;
}

/** Tabela de parâmetros da planilha (30 tipos de negócio), em %. */
const T = (
  name: string,
  targetProfitPct: number,
  commissionPct: number,
  markup: number,
  adminExpensesPct: number,
  wdPct = 12,
): SuperplanBusinessType => ({
  name,
  targetProfitPct,
  commissionPct,
  markup,
  adminExpensesPct,
  wdPct,
});

export const DEFAULT_BUSINESS_TYPES: SuperplanBusinessType[] = [
  T("WELLKIDS - BRINQUEDOS - CHINA - COMBATE", 18, 5, 1.65, 12),
  T("WELLKIDS - BRINQUEDOS - CHINA - ENCOMENDA", 18, 2, 1.45, 7),
  T("WELLKIDS - BRINQUEDOS - CHINA - MERCADO", 25, 5, 1.9, 12),
  T("WELLKIDS - FUNS - CHINA - COMBATE", 18, 5, 1.65, 12),
  T("WELLKIDS - FUNS - CHINA - ENCOMENDA", 18, 2, 1.45, 7),
  T("WELLKIDS - FUNS - CHINA - MERCADO", 25, 5, 1.9, 12),
  T("WELLKIDS - PETWELL - CHINA - COMBATE", 15, 5, 1.6, 12),
  T("WELLKIDS - PETWELL - CHINA - ENCOMENDA", 15, 2, 1.36, 7),
  T("WELLKIDS - PETWELL - CHINA - MERCADO", 22, 5, 1.8, 12),
  T("WELLMIX - CERÂMICA - CHINA - COMBATE", 15, 2, 1.36, 7),
  T("WELLMIX - CERÂMICA - CHINA - ENCOMENDA", 15, 5, 1.6, 12),
  T("WELLMIX - CERÂMICA - CHINA - MERCADO", 22, 5, 1.8, 12),
  T("WELLMIX - EASYCARE - CHINA - COMBATE", 15, 5, 1.6, 12),
  T("WELLMIX - EASYCARE - CHINA - ENCOMENDA", 15, 2, 1.36, 7),
  T("WELLMIX - EASYCARE - CHINA - MERCADO", 22, 5, 1.8, 12),
  T("WELLMIX - UD - CHINA - COMBATE", 15, 5, 1.6, 12),
  T("WELLMIX - UD - CHINA - ENCOMENDA", 15, 2, 1.36, 7),
  T("WELLMIX - UD - CHINA - MERCADO", 22, 5, 1.8, 12),
  T("WELLMIX - VIDROS - CHINA - COMBATE", 15, 5, 1.55, 12),
  T("WELLMIX - VIDROS - CHINA - ENCOMENDA", 15, 2, 1.37, 7),
  T("WELLMIX - VIDROS - CHINA - MERCADO", 22, 5, 1.75, 12),
  T("WELLMIX - VIDROS - EGITO - COMBATE", 15, 5, 1.73, 12),
  T("WELLMIX - VIDROS - EGITO - ENCOMENDA", 15, 2, 1.5, 7),
  T("WELLMIX - VIDROS - EGITO - MERCADO", 22, 5, 1.9, 12),
  T("WELLMIX - VIDROS - TURQUIA - COMBATE", 15, 5, 1.55, 12),
  T("WELLMIX - VIDROS - TURQUIA - ENCOMENDA", 15, 2, 1.37, 7),
  T("WELLMIX - VIDROS - TURQUIA - MERCADO", 22, 5, 1.75, 12),
  T("WELLMIX - WELLCLEAN - CHINA - COMBATE", 15, 5, 1.6, 12),
  T("WELLMIX - WELLCLEAN - CHINA - ENCOMENDA", 15, 2, 1.36, 7),
  T("WELLMIX - WELLCLEAN - CHINA - MERCADO", 22, 5, 1.8, 12),
];

/** Despesas no Brasil por container, como na planilha (sem as que entravam em dobro). */
export const DEFAULT_EXPENSES: SuperplanExpense[] = [
  { key: "ce", label: "Taxa do CE (origem)", amountBrl: 1000, customs: true },
  { key: "thc", label: "THC", amountBrl: 1010, customs: true },
  { key: "siscomex", label: "Taxa Siscomex", amountBrl: 250, customs: false },
  {
    key: "storage",
    label: "Armazenagem portuária",
    amountBrl: 3000,
    customs: false,
  },
  {
    key: "broker",
    label: "Serviço do despachante",
    amountBrl: 1412,
    customs: false,
  },
  { key: "sda", label: "S.D.A.", amountBrl: 940, customs: false },
  { key: "chapa", label: "Chapa", amountBrl: 364, customs: false },
  {
    key: "packaging",
    label: "Despesas MOQ / embalagens",
    amountBrl: 600,
    customs: false,
  },
  {
    key: "li",
    label: "LI (solicitação Wellmix)",
    amountBrl: 160,
    customs: false,
  },
  {
    key: "deconsolidation",
    label: "Desconsolidação do BL",
    amountBrl: 3500,
    customs: false,
  },
];

export const DEFAULT_SUPERPLAN: SuperplanParams = {
  businessTypes: DEFAULT_BUSINESS_TYPES,
  defaultBusinessType: "WELLMIX - UD - CHINA - MERCADO",
  expenses: DEFAULT_EXPENSES,
  freightUsd: 3492,
  roadFreightBrl: 1500,
  futureSpreadBrl: 0.25,
  freightFxPct: 3.02,
  afrmmPct: 8,
  afrmmFixedBrl: 700,
  grossEstimatePct: 8,
  priceFactors: { table: 1.25, wholesale: 1.6, retail: 1.8 },
  // ICMS efetivo de 1,5% ("paga 1,5% e destaca 4%"); PIS/COFINS não
  // cumulativos; IR e CSLL como na planilha (conferir com o contador).
  saleTaxes: {
    icmsPct: 1.5,
    pisPct: 1.65,
    cofinsPct: 7.6,
    irPct: 2.6,
    csllPct: 1.08,
  },
};

const num = (value: unknown, fallback: number, min = 0, max = 1e9) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
    ? value
    : fallback;

const text = (value: unknown, max = 120) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * Parâmetros gravados, conferidos: o que faltar ou vier errado (banco antigo,
 * edição manual) fica com o padrão da planilha.
 */
export function superplanParams(value: unknown): SuperplanParams {
  const v =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof SuperplanParams, unknown>>)
      : {};
  const types = Array.isArray(v.businessTypes)
    ? v.businessTypes
        .map((raw): SuperplanBusinessType | null => {
          const r =
            raw && typeof raw === "object"
              ? (raw as Record<string, unknown>)
              : {};
          const name = text(r.name);
          if (!name) return null;
          return {
            name,
            targetProfitPct: num(r.targetProfitPct, 0, -100, 100),
            commissionPct: num(r.commissionPct, 0, 0, 100),
            markup: num(r.markup, 1, 0.01, 100),
            adminExpensesPct: num(r.adminExpensesPct, 0, 0, 100),
            wdPct: num(r.wdPct, 0, 0, 1000),
          };
        })
        .filter((t): t is SuperplanBusinessType => !!t)
    : [];
  const expenses = Array.isArray(v.expenses)
    ? v.expenses
        .map((raw, i): SuperplanExpense | null => {
          const r =
            raw && typeof raw === "object"
              ? (raw as Record<string, unknown>)
              : {};
          const label = text(r.label);
          if (!label) return null;
          return {
            key: text(r.key, 40) || `item${i + 1}`,
            label,
            amountBrl: num(r.amountBrl, 0, 0, 1e9),
            customs: r.customs === true,
          };
        })
        .filter((e): e is SuperplanExpense => !!e)
    : DEFAULT_EXPENSES;
  const businessTypes = types.length ? types : DEFAULT_BUSINESS_TYPES;
  const d = DEFAULT_SUPERPLAN;
  const pf =
    v.priceFactors && typeof v.priceFactors === "object"
      ? (v.priceFactors as Record<string, unknown>)
      : {};
  const st =
    v.saleTaxes && typeof v.saleTaxes === "object"
      ? (v.saleTaxes as Record<string, unknown>)
      : {};
  const defaultName = text(v.defaultBusinessType);
  return {
    businessTypes,
    defaultBusinessType: businessTypes.some((t) => t.name === defaultName)
      ? defaultName
      : businessTypes.some((t) => t.name === d.defaultBusinessType)
        ? d.defaultBusinessType
        : businessTypes[0].name,
    expenses,
    freightUsd: num(v.freightUsd, d.freightUsd),
    roadFreightBrl: num(v.roadFreightBrl, d.roadFreightBrl),
    futureSpreadBrl: num(v.futureSpreadBrl, d.futureSpreadBrl, 0, 100),
    freightFxPct: num(v.freightFxPct, d.freightFxPct, 0, 100),
    afrmmPct: num(v.afrmmPct, d.afrmmPct, 0, 100),
    afrmmFixedBrl: num(v.afrmmFixedBrl, d.afrmmFixedBrl),
    // Parâmetros gravados antes de a folga existir ficam com o padrão (8%).
    grossEstimatePct: num(v.grossEstimatePct, d.grossEstimatePct, 0, 100),
    priceFactors: {
      table: num(pf.table, d.priceFactors.table, 0.01, 100),
      wholesale: num(pf.wholesale, d.priceFactors.wholesale, 0.01, 100),
      retail: num(pf.retail, d.priceFactors.retail, 0.01, 100),
    },
    saleTaxes: {
      icmsPct: num(st.icmsPct, d.saleTaxes.icmsPct, 0, 100),
      pisPct: num(st.pisPct, d.saleTaxes.pisPct, 0, 100),
      cofinsPct: num(st.cofinsPct, d.saleTaxes.cofinsPct, 0, 100),
      irPct: num(st.irPct, d.saleTaxes.irPct, 0, 100),
      csllPct: num(st.csllPct, d.saleTaxes.csllPct, 0, 100),
    },
  };
}

/** Uma simulação: o que a tela tem preenchido. Vazio = null. */
export interface SuperplanInput {
  /** Preço por peça na moeda do fornecedor. */
  unitPrice: number | null;
  currency: "RMB" | "USD";
  pcsPerCarton: number | null;
  /** Peso líquido por peça (kg), como a ficha traz; nunca é lido como bruto. */
  netWeightPcKg: number | null;
  /**
   * Peso bruto por peça (kg). Vazio com o líquido informado: a conta usa o
   * bruto estimado (líquido + folga). Os dois vazios: só o volume limita.
   */
  grossWeightPcKg: number | null;
  /** Volume da caixa master (m³). */
  cbmPerCarton: number | null;
  containerCbm: number | null;
  containerMaxKg: number | null;
  iiPct: number;
  ipiPct: number;
  /** Frete marítimo por container (US$). */
  freightUsd: number | null;
  roadFreightBrl: number;
  /** Entrega no cliente por container (R$): vai no preço com entrega. */
  deliveryFreightBrl: number;
  /** R$ por US$: o oficial (impostos) e o futuro (pagamento ao fornecedor). */
  officialRate: number | null;
  futureRate: number | null;
  /** Quantos RMB vale 1 US$. */
  rmbPerUsd: number | null;
  /** Comissão da trading na China (% do valor da compra). */
  tradingCommissionPct: number;
  /** Outras despesas na China (RMB, por container). */
  chinaChargesRmb: number;
  expenses: SuperplanExpense[];
  markup: number;
  commissionPct: number;
  adminExpensesPct: number;
  targetProfitPct: number;
  wdPct: number;
  /** Tributos da importação (Configurações → Tributos). */
  insurancePct: number;
  pisImportPct: number;
  cofinsImportPct: number;
  icmsImportPct: number;
  freightFxPct: number;
  afrmmPct: number;
  afrmmFixedBrl: number;
  /** Folga da embalagem no peso (%), para o peso bruto estimado. */
  grossEstimatePct: number;
  priceFactors: SuperplanPriceFactors;
  saleTaxes: SuperplanSaleTaxes;
  /** Preço de venda a testar (R$ por peça); vazio = o preço mínimo. */
  salePrice: number | null;
}

export type SuperplanMissing =
  | "price"
  | "carton"
  | "cbm"
  | "container"
  | "freight"
  | "fx"
  | "rmb"
  | "markup";

export type SuperplanVerdict = "viable" | "below" | "loss";

/** Impostos e despesas da venda, por peça (R$). */
export interface SuperplanSale {
  price: number;
  ipi: number;
  icms: number;
  pis: number;
  cofins: number;
  ir: number;
  csll: number;
  commission: number;
  adminExpenses: number;
  /** Soma dos impostos e despesas da venda. */
  deductions: number;
  profit: number;
  /** Lucro líquido em % do preço. */
  profitPct: number;
  profitPerContainer: number;
  revenuePerContainer: number;
}

export interface SuperplanResult {
  missing: SuperplanMissing[];
  container: {
    cartons: number;
    pieces: number;
    limitedBy: "volume" | "weight";
    /** Sem peso por peça (nem bruto nem líquido): só o volume conta. */
    weightUnknown: boolean;
    /** O peso usado é o bruto estimado (líquido + folga), não o da ficha. */
    weightEstimated: boolean;
    usedCbm: number;
    usedKg: number | null;
  } | null;
  cost: {
    fobUsd: number;
    /** Compra paga ao fornecedor (dólar futuro). */
    goodsBrl: number;
    freightBrl: number;
    insuranceBrl: number;
    /** Base dos impostos da importação. */
    customsValueBrl: number;
    iiBrl: number;
    ipiBrl: number;
    pisBrl: number;
    cofinsBrl: number;
    afrmmBrl: number;
    icmsBrl: number;
    expensesBrl: number;
    roadFreightBrl: number;
    chinaBrl: number;
    totalBrl: number;
    perPiece: number;
  } | null;
  prices: {
    minimum: number;
    table: number;
    wholesale: number;
    retail: number;
    wd: number;
    /** Mínimo + entrega no cliente por peça. */
    delivered: number;
  } | null;
  sale: SuperplanSale | null;
  /** Preço e markup para bater a meta; null quando impossível (impostos e despesas acima da margem). */
  target: { pct: number; price: number | null; markup: number | null } | null;
  verdict: SuperplanVerdict | null;
}

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const safe = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n : 0;

const EMPTY: Omit<SuperplanResult, "missing"> = {
  container: null,
  cost: null,
  prices: null,
  sale: null,
  target: null,
  verdict: null,
};

/** O que a tela mostra para a simulação. Falta dado: diz o quê (`missing`). */
export function computeSuperplan(input: SuperplanInput): SuperplanResult {
  const missing: SuperplanMissing[] = [];
  if (!positive(input.unitPrice)) missing.push("price");
  if (!positive(input.pcsPerCarton)) missing.push("carton");
  if (!positive(input.cbmPerCarton)) missing.push("cbm");
  if (!positive(input.containerCbm)) missing.push("container");
  if (!positive(input.freightUsd) && input.freightUsd !== 0)
    missing.push("freight");
  if (!positive(input.officialRate) || !positive(input.futureRate))
    missing.push("fx");
  // RMB por dólar: preço em RMB ou outras despesas na China (em RMB).
  if (input.currency === "RMB" || safe(input.chinaChargesRmb) > 0)
    if (!positive(input.rmbPerUsd)) missing.push("rmb");
  if (!positive(input.markup)) missing.push("markup");
  if (missing.length) return { missing, ...EMPTY };

  const pcs = input.pcsPerCarton!;
  const cbm = input.cbmPerCarton!;
  const official = input.officialRate!;
  const future = input.futureRate!;
  const rmb = positive(input.rmbPerUsd) ? input.rmbPerUsd : null;

  // 1) Quantas caixas cabem: volume do container ou peso máximo, o que
  //    acabar primeiro; só caixas inteiras.
  const byVolume = input.containerCbm! / cbm;
  // Peso bruto por peça: o informado ou, só com o líquido, o estimado.
  const weight = estimatedGrossKg(
    input.netWeightPcKg,
    input.grossWeightPcKg,
    input.grossEstimatePct,
  );
  const kgPerCarton = weight.kg === null ? null : weight.kg * pcs;
  const byWeight =
    kgPerCarton && positive(input.containerMaxKg)
      ? input.containerMaxKg / kgPerCarton
      : Infinity;
  const cartons = Math.floor(Math.min(byVolume, byWeight) + 1e-9);
  const pieces = cartons * pcs;
  const container = {
    cartons,
    pieces,
    limitedBy: (byWeight < byVolume ? "weight" : "volume") as
      "volume" | "weight",
    weightUnknown: kgPerCarton === null,
    weightEstimated: weight.estimated,
    usedCbm: cartons * cbm,
    usedKg: kgPerCarton === null ? null : cartons * kgPerCarton,
  };
  if (pieces <= 0) return { missing: ["cbm"], ...EMPTY, container };

  // 2) Compra e frete. A compra é paga ao fornecedor no dólar futuro; o
  //    frete, a um câmbio um pouco acima do oficial.
  const unitUsd =
    input.currency === "USD" ? input.unitPrice! : input.unitPrice! / rmb!;
  const fobUsd = unitUsd * pieces;
  const goodsBrl = fobUsd * future;
  const freightUsd = safe(input.freightUsd);
  const freightBrl = freightUsd * official * (1 + input.freightFxPct / 100);
  const insuranceUsd = fobUsd * (input.insurancePct / 100);
  const insuranceBrl = insuranceUsd * official;

  // 3) Impostos da importação sobre o valor real (valor aduaneiro).
  const customsExtrasBrl = input.expenses
    .filter((e) => e.customs)
    .reduce((sum, e) => sum + safe(e.amountBrl), 0);
  const customsValueBrl =
    (fobUsd + freightUsd + insuranceUsd) * official + customsExtrasBrl;
  const iiBrl = customsValueBrl * (input.iiPct / 100);
  const ipiBrl = (customsValueBrl + iiBrl) * (input.ipiPct / 100);
  const pisBrl = customsValueBrl * (input.pisImportPct / 100);
  const cofinsBrl = customsValueBrl * (input.cofinsImportPct / 100);
  const afrmmBrl = freightBrl * (input.afrmmPct / 100) + input.afrmmFixedBrl;
  const icmsRate = input.icmsImportPct / 100;
  const icmsBrl =
    icmsRate > 0 && icmsRate < 1
      ? ((customsValueBrl + iiBrl + ipiBrl + pisBrl + cofinsBrl + afrmmBrl) /
          (1 - icmsRate)) *
        icmsRate
      : 0;

  // 4) Despesas no Brasil (cada uma uma vez só), frete até o depósito e
  //    despesas na China (comissão da trading e outras, no dólar futuro).
  const expensesBrl = input.expenses.reduce(
    (sum, e) => sum + safe(e.amountBrl),
    0,
  );
  const roadFreightBrl = safe(input.roadFreightBrl);
  const chinaUsd =
    fobUsd * (safe(input.tradingCommissionPct) / 100) +
    (rmb ? safe(input.chinaChargesRmb) / rmb : 0);
  const chinaBrl = chinaUsd * future;

  const totalBrl =
    goodsBrl +
    freightBrl +
    insuranceBrl +
    iiBrl +
    ipiBrl +
    pisBrl +
    cofinsBrl +
    afrmmBrl +
    icmsBrl +
    expensesBrl +
    roadFreightBrl +
    chinaBrl;
  const perPiece = totalBrl / pieces;

  // 5) Preços: mínimo = custo × markup; os outros saem do mínimo.
  const minimum = perPiece * input.markup;
  const prices = {
    minimum,
    table: minimum * input.priceFactors.table,
    wholesale: minimum * input.priceFactors.wholesale,
    retail: minimum * input.priceFactors.retail,
    wd: minimum * (1 + input.wdPct / 100),
    delivered: minimum + safe(input.deliveryFreightBrl) / pieces,
  };

  // 6) Venda: impostos sobre o preço cheio, com os impostos da importação
  //    como crédito, e as despesas do tipo de negócio.
  const credit = {
    ipi: ipiBrl / pieces,
    icms: icmsBrl / pieces,
    pis: pisBrl / pieces,
    cofins: cofinsBrl / pieces,
  };
  const saleAt = (price: number): SuperplanSale => {
    const tx = input.saleTaxes;
    // Valor da venda sem a parte do IPI (o preço inclui o IPI, como na planilha).
    const base = price * (1 - input.ipiPct / 100);
    const ipi = base * (input.ipiPct / 100) - credit.ipi;
    const icmsDebit = base * (tx.icmsPct / 100);
    const icms = icmsDebit - credit.icms;
    const net = base - icmsDebit - ipi;
    const pis = net * (tx.pisPct / 100) - credit.pis;
    const cofins = net * (tx.cofinsPct / 100) - credit.cofins;
    const ir = base * (tx.irPct / 100);
    const csll = base * (tx.csllPct / 100);
    const commission = price * (input.commissionPct / 100);
    const adminExpenses = price * (input.adminExpensesPct / 100);
    const deductions =
      ipi + icms + pis + cofins + ir + csll + commission + adminExpenses;
    const profit = price - perPiece - deductions;
    return {
      price,
      ipi,
      icms,
      pis,
      cofins,
      ir,
      csll,
      commission,
      adminExpenses,
      deductions,
      profit,
      profitPct: price > 0 ? (profit / price) * 100 : 0,
      profitPerContainer: profit * pieces,
      revenuePerContainer: price * pieces,
    };
  };
  const salePrice = positive(input.salePrice) ? input.salePrice : minimum;
  const sale = saleAt(salePrice);

  // 7) Preço para bater a meta: o lucro é uma reta no preço
  //    (lucro = a × preço + b); meta % = lucro ÷ preço.
  const b = saleAt(0).profit;
  const a = saleAt(1).profit - b;
  const goal = input.targetProfitPct / 100;
  const neededPrice = a - goal > 1e-9 ? -b / (a - goal) : null;
  const target = {
    pct: input.targetProfitPct,
    price: neededPrice !== null && neededPrice > 0 ? neededPrice : null,
    markup:
      neededPrice !== null && neededPrice > 0 ? neededPrice / perPiece : null,
  };

  const verdict: SuperplanVerdict =
    sale.profit <= 0
      ? "loss"
      : sale.profitPct + 1e-9 >= input.targetProfitPct
        ? "viable"
        : "below";

  return {
    missing: [],
    container,
    cost: {
      fobUsd,
      goodsBrl,
      freightBrl,
      insuranceBrl,
      customsValueBrl,
      iiBrl,
      ipiBrl,
      pisBrl,
      cofinsBrl,
      afrmmBrl,
      icmsBrl,
      expensesBrl,
      roadFreightBrl,
      chinaBrl,
      totalBrl,
      perPiece,
    },
    prices,
    sale,
    target,
    verdict,
  };
}

/** Valores do tipo de negócio para preencher a simulação. */
export function businessTypeOf(
  params: SuperplanParams,
  name: string | null | undefined,
): SuperplanBusinessType {
  return (
    params.businessTypes.find((t) => t.name === name) ??
    params.businessTypes.find((t) => t.name === params.defaultBusinessType) ??
    params.businessTypes[0]
  );
}
