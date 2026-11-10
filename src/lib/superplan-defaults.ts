import { z } from "zod";
import type { BookingAnalysis } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";
import {
  businessTypeOf,
  type SuperplanBusinessType,
  type SuperplanInput,
  type SuperplanParams,
  type SuperplanResult,
} from "@/lib/superplan";
import { estimatedGrossKg } from "@/lib/weights";

/*
 * Superplan: a simulação padrão de um produto (docs/SUPERPLAN.md). Funções
 * puras, usadas pela tela (o que aparece ao abrir um produto, antes de
 * qualquer edição) e pelo servidor (analisar vários produtos de uma vez, no
 * Booking): as duas contas saem do MESMO lugar, por isso dão o mesmo número.
 *
 * - `defaultSuperplanForm`: os campos da tela ao abrir um produto (tipo de
 *   negócio, container e frete padrão, câmbio do dia, despesas e fatores dos
 *   parâmetros, preço de venda vazio = o preço mínimo).
 * - `superplanInputOf`: os campos da tela viram a conta (`SuperplanInput`).
 * - `defaultSuperplanInput`: os dois juntos (a conta que a tela mostra sem
 *   edição).
 * - `snapshotOf`: o retrato de uma conta, para guardar (linha do Booking).
 * - `superplanInputSchema`: confere uma conta que veio do navegador.
 *
 * A "média" do despachante é só informação na tela: não existe em nenhum
 * destes tipos e não entra em conta nenhuma.
 */

/** Dados do produto escolhido (vazios sem produto). */
export interface SuperplanPrefill {
  productId: string | null;
  productName: string | null;
  unitPrice: number | null;
  currency: "RMB" | "USD";
  /** Moeda do cadastro que o Superplan não usa (EUR, BRL): o preço fica vazio. */
  otherCurrency: string | null;
  pcsPerCarton: number | null;
  /** Peso líquido por peça (N.W), como a ficha traz. */
  netWeightPcKg: number | null;
  /** Peso bruto por peça (G.W); vazio fica vazio (o líquido nunca entra aqui). */
  grossWeightPcKg: number | null;
  cbmPerCarton: number | null;
  ncm: string | null;
  /** II e IPI da ficha mestre ou do NCM na tabela fiscal; nulos sem os dois. */
  iiPct: number | null;
  ipiPct: number | null;
}

/** Sem produto: a pessoa preenche à mão. */
export const EMPTY_SUPERPLAN_PREFILL: SuperplanPrefill = {
  productId: null,
  productName: null,
  unitPrice: null,
  currency: "RMB",
  otherCurrency: null,
  pcsPerCarton: null,
  netWeightPcKg: null,
  grossWeightPcKg: null,
  cbmPerCarton: null,
  ncm: null,
  iiPct: null,
  ipiPct: null,
};

/** O que vem do sistema: parâmetros, containers, câmbio e tributos da importação. */
export interface SuperplanContext {
  params: SuperplanParams;
  containers: Array<{ code: string; capacityCbm: number; maxWeightKg: number }>;
  defaultContainer: string | null;
  /** R$ por US$ (câmbio do dia) e RMB por US$; nulos sem câmbio. */
  official: number | null;
  rmbPerUsd: number | null;
  /** Dia da cotação do dólar, já como a tela mostra; nulo sem câmbio. */
  fxDate: string | null;
  fxStatus: "today" | "stale" | "manual" | "none";
  insurancePct: number;
  pisImportPct: number;
  cofinsImportPct: number;
  /** null = não configurado em Configurações (conta como 0%). */
  icmsImportPct: number | null;
}

/**
 * Campos numéricos da simulação: casas decimais que a tela mostra e se
 * "1.000" é mil (peças, kg e valores cheios em reais, dólares e RMB).
 */
const NUMBER_FIELDS = {
  unitPrice: { digits: 4, whole: false },
  pcsPerCarton: { digits: 0, whole: true },
  netWeightPcKg: { digits: 4, whole: false },
  grossWeightPcKg: { digits: 4, whole: false },
  cbmPerCarton: { digits: 4, whole: false },
  iiPct: { digits: 2, whole: false },
  ipiPct: { digits: 2, whole: false },
  containerCbm: { digits: 2, whole: false },
  containerMaxKg: { digits: 0, whole: true },
  freightUsd: { digits: 2, whole: true },
  roadFreightBrl: { digits: 2, whole: true },
  deliveryFreightBrl: { digits: 2, whole: true },
  officialRate: { digits: 4, whole: false },
  futureRate: { digits: 4, whole: false },
  rmbPerUsd: { digits: 4, whole: false },
  markup: { digits: 4, whole: false },
  commissionPct: { digits: 2, whole: false },
  adminExpensesPct: { digits: 2, whole: false },
  targetProfitPct: { digits: 2, whole: false },
  wdPct: { digits: 2, whole: false },
  tradingCommissionPct: { digits: 2, whole: false },
  chinaChargesRmb: { digits: 2, whole: true },
  salePrice: { digits: 2, whole: false },
} as const satisfies Record<string, { digits: number; whole: boolean }>;

export type SuperplanNumberField = keyof typeof NUMBER_FIELDS;

/** Os campos da tela, como texto (o que está digitado). Vazio = "". */
export type SuperplanFields = Record<SuperplanNumberField, string> & {
  currency: "RMB" | "USD";
  /** Código do container escolhido ("" sem container cadastrado). */
  container: string;
  /** Nome do tipo de negócio escolhido. */
  businessType: string;
};

/** O formulário inteiro: os campos e as despesas (na ordem dos parâmetros). */
export interface SuperplanForm {
  fields: SuperplanFields;
  expenses: string[];
}

/** Em campo de número inteiro, "1.000" é mil. */
export const isWholeSuperplanField = (key: SuperplanNumberField): boolean =>
  NUMBER_FIELDS[key].whole;

/** Número para o campo: sem separador de milhar, com a vírgula do idioma. */
export function superplanNumberText(
  value: number | null | undefined,
  decimal: string,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "";
  const rounded = Number(value.toFixed(digits));
  return String(rounded).replace(".", decimal);
}

/** Número para um campo da simulação, com as casas que a tela mostra nele. */
export const superplanFieldText = (
  key: SuperplanNumberField,
  value: number | null | undefined,
  decimal: string,
): string => superplanNumberText(value, decimal, NUMBER_FIELDS[key].digits);

/** O que está digitado vira número; vazio ou ilegível = null. */
export function readSuperplanNumber(raw: string, whole = false): number | null {
  const n = parseNumberInput(raw, { int: whole });
  return n === null || Number.isNaN(n) ? null : n;
}

/** Campos que o tipo de negócio preenche (markup, comissão, despesas, meta e WD). */
export function businessTypeFields(
  type: SuperplanBusinessType,
  decimal: string,
): Pick<
  SuperplanFields,
  | "businessType"
  | "markup"
  | "commissionPct"
  | "adminExpensesPct"
  | "targetProfitPct"
  | "wdPct"
> {
  return {
    businessType: type.name,
    markup: superplanFieldText("markup", type.markup, decimal),
    commissionPct: superplanFieldText(
      "commissionPct",
      type.commissionPct,
      decimal,
    ),
    adminExpensesPct: superplanFieldText(
      "adminExpensesPct",
      type.adminExpensesPct,
      decimal,
    ),
    targetProfitPct: superplanFieldText(
      "targetProfitPct",
      type.targetProfitPct,
      decimal,
    ),
    wdPct: superplanFieldText("wdPct", type.wdPct, decimal),
  };
}

/** Campos que o container preenche (capacidade e peso máximo). */
export function containerFields(
  box: SuperplanContext["containers"][number],
  decimal: string,
): Pick<SuperplanFields, "container" | "containerCbm" | "containerMaxKg"> {
  return {
    container: box.code,
    containerCbm: superplanFieldText("containerCbm", box.capacityCbm, decimal),
    containerMaxKg: superplanFieldText(
      "containerMaxKg",
      box.maxWeightKg,
      decimal,
    ),
  };
}

/** O que muda a simulação padrão (o resto vem do produto e do sistema). */
export interface SuperplanOverrides {
  /** Tipo de negócio (nome); desconhecido ou vazio = o padrão dos parâmetros. */
  businessType?: string;
  /** Preço de venda a testar (R$ por peça); vazio = o preço mínimo. */
  salePrice?: number | null;
}

/**
 * Os campos da tela ao abrir um produto, antes de qualquer edição: tipo de
 * negócio, container e frete padrão, câmbio do dia (dólar futuro = oficial +
 * diferença dos parâmetros), despesas dos parâmetros e preço de venda vazio.
 */
export function defaultSuperplanForm(
  prefill: SuperplanPrefill,
  ctx: SuperplanContext,
  overrides: SuperplanOverrides = {},
  decimal = ".",
): SuperplanForm {
  const { params } = ctx;
  const text = (key: SuperplanNumberField, value: number | null | undefined) =>
    superplanFieldText(key, value, decimal);
  const type = businessTypeOf(
    params,
    overrides.businessType || params.defaultBusinessType,
  );
  const box =
    ctx.containers.find((c) => c.code === ctx.defaultContainer) ??
    ctx.containers[0] ??
    null;
  return {
    fields: {
      unitPrice: text("unitPrice", prefill.unitPrice),
      currency: prefill.currency,
      pcsPerCarton: text("pcsPerCarton", prefill.pcsPerCarton),
      netWeightPcKg: text("netWeightPcKg", prefill.netWeightPcKg),
      // Peso bruto vazio fica vazio: a estimativa nunca entra no campo.
      grossWeightPcKg: text("grossWeightPcKg", prefill.grossWeightPcKg),
      cbmPerCarton: text("cbmPerCarton", prefill.cbmPerCarton),
      iiPct: text("iiPct", prefill.iiPct),
      ipiPct: text("ipiPct", prefill.ipiPct),
      ...(box
        ? containerFields(box, decimal)
        : { container: "", containerCbm: "", containerMaxKg: "" }),
      freightUsd: text("freightUsd", params.freightUsd),
      roadFreightBrl: text("roadFreightBrl", params.roadFreightBrl),
      deliveryFreightBrl: "",
      officialRate: text("officialRate", ctx.official),
      futureRate: text(
        "futureRate",
        ctx.official === null ? null : ctx.official + params.futureSpreadBrl,
      ),
      rmbPerUsd: text("rmbPerUsd", ctx.rmbPerUsd),
      ...businessTypeFields(type, decimal),
      tradingCommissionPct: "",
      chinaChargesRmb: "",
      salePrice: text("salePrice", overrides.salePrice),
    },
    expenses: params.expenses.map((e) =>
      superplanNumberText(e.amountBrl, decimal),
    ),
  };
}

/**
 * Os campos da tela viram a conta: o que está digitado, mais o que vem do
 * sistema (tributos da importação, câmbio do frete, AFRMM, folga da embalagem
 * no peso, fatores de preço e impostos da venda).
 */
export function superplanInputOf(
  form: SuperplanForm,
  ctx: SuperplanContext,
): SuperplanInput {
  const { params } = ctx;
  const { fields } = form;
  const num = (key: SuperplanNumberField) =>
    readSuperplanNumber(fields[key], NUMBER_FIELDS[key].whole);
  return {
    unitPrice: num("unitPrice"),
    currency: fields.currency === "USD" ? "USD" : "RMB",
    pcsPerCarton: num("pcsPerCarton"),
    netWeightPcKg: num("netWeightPcKg"),
    grossWeightPcKg: num("grossWeightPcKg"),
    cbmPerCarton: num("cbmPerCarton"),
    containerCbm: num("containerCbm"),
    containerMaxKg: num("containerMaxKg"),
    iiPct: num("iiPct") ?? 0,
    ipiPct: num("ipiPct") ?? 0,
    freightUsd: num("freightUsd"),
    roadFreightBrl: num("roadFreightBrl") ?? 0,
    deliveryFreightBrl: num("deliveryFreightBrl") ?? 0,
    officialRate: num("officialRate"),
    futureRate: num("futureRate"),
    rmbPerUsd: num("rmbPerUsd"),
    tradingCommissionPct: num("tradingCommissionPct") ?? 0,
    chinaChargesRmb: num("chinaChargesRmb") ?? 0,
    expenses: params.expenses.map((e, i) => ({
      ...e,
      amountBrl: readSuperplanNumber(form.expenses[i] ?? "", true) ?? 0,
    })),
    markup: num("markup") ?? 0,
    commissionPct: num("commissionPct") ?? 0,
    adminExpensesPct: num("adminExpensesPct") ?? 0,
    targetProfitPct: num("targetProfitPct") ?? 0,
    wdPct: num("wdPct") ?? 0,
    insurancePct: ctx.insurancePct,
    pisImportPct: ctx.pisImportPct,
    cofinsImportPct: ctx.cofinsImportPct,
    icmsImportPct: ctx.icmsImportPct ?? 0,
    freightFxPct: params.freightFxPct,
    afrmmPct: params.afrmmPct,
    afrmmFixedBrl: params.afrmmFixedBrl,
    grossEstimatePct: params.grossEstimatePct,
    priceFactors: params.priceFactors,
    saleTaxes: params.saleTaxes,
    salePrice: num("salePrice"),
  };
}

/**
 * A simulação que a tela mostra ao abrir um produto, sem nenhuma edição: os
 * campos padrão (`defaultSuperplanForm`) lidos como a tela lê
 * (`superplanInputOf`). `businessType` é o tipo usado e `container`, o código
 * do container (nulo sem container cadastrado).
 */
export function defaultSuperplanInput(
  prefill: SuperplanPrefill,
  ctx: SuperplanContext,
  overrides: SuperplanOverrides = {},
): { input: SuperplanInput; businessType: string; container: string | null } {
  const form = defaultSuperplanForm(prefill, ctx, overrides);
  return {
    input: superplanInputOf(form, ctx),
    businessType: form.fields.businessType,
    container: form.fields.container || null,
  };
}

/** O retrato de uma conta, sem quem e quando (isso é de quem grava). */
export type SuperplanSnapshot = Omit<BookingAnalysis, "at" | "byUserId">;

const finite = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n);
const rounded = (n: number | null | undefined, digits: number) =>
  finite(n) ? Number(n.toFixed(digits)) : null;
/** Dinheiro em centavos; percentuais com 2 casas; câmbio com 4. */
const cents = (n: number | null | undefined) => rounded(n, 2);
const pct = (n: number | null | undefined) => rounded(n, 2);

/**
 * Preço que bate a meta, em centavos, arredondado para cima: vendendo a ele,
 * a meta é batida (o valor que a tela mostra e o botão "Testar esse preço"
 * usa). Nulo quando a meta não é alcançável ou não há conta.
 */
export function targetPriceCents(result: SuperplanResult): number | null {
  const price = result.target?.price;
  return finite(price) ? Math.ceil(price * 100 - 1e-6) / 100 : null;
}

/**
 * Retrato da simulação para guardar: o tipo de negócio, o preço analisado, o
 * custo, o preço mínimo, o lucro, a meta, o sinal, o preço para a meta, o que
 * faltou e os pressupostos (câmbio, II/IPI, container, frete, peso estimado).
 * Dinheiro em centavos e percentuais com 2 casas. Com dado faltando, o sinal
 * fica nulo e `missing` diz o quê; os pressupostos são gravados mesmo assim.
 */
export function snapshotOf(
  input: SuperplanInput,
  result: SuperplanResult,
  meta: { businessType: string; container: string | null; ncmFound: boolean },
): SuperplanSnapshot {
  const { sale, prices } = result;
  const typed = finite(input.salePrice) && input.salePrice > 0;
  // "Preço mínimo": nada digitado, ou o digitado é o próprio mínimo (a tela
  // usa a mesma folga de meio centavo para dizer "preço testado").
  const usesMinimum =
    sale && prices ? Math.abs(sale.price - prices.minimum) <= 0.0049 : !typed;
  return {
    businessType: meta.businessType,
    salePriceBrl: sale
      ? cents(sale.price)
      : typed
        ? cents(input.salePrice)
        : null,
    usesMinimum,
    costBrl: cents(result.cost?.perPiece),
    minimumBrl: cents(prices?.minimum),
    profitPct: pct(sale?.profitPct),
    targetPct: pct(input.targetProfitPct) ?? 0,
    verdict: result.verdict,
    targetPriceBrl: targetPriceCents(result),
    missing: [...result.missing],
    inputs: {
      officialRate: rounded(input.officialRate, 4),
      futureRate: rounded(input.futureRate, 4),
      rmbPerUsd: rounded(input.rmbPerUsd, 4),
      iiPct: pct(input.iiPct) ?? 0,
      ipiPct: pct(input.ipiPct) ?? 0,
      ncmFound: meta.ncmFound,
      container: meta.container,
      freightUsd: cents(input.freightUsd),
      // Pelos dados da conta (não pelo resultado): vale mesmo faltando dado.
      grossEstimated: estimatedGrossKg(
        input.netWeightPcKg,
        input.grossWeightPcKg,
        input.grossEstimatePct,
      ).estimated,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Conta que veio do navegador                                               */
/* ------------------------------------------------------------------------ */

/** Quantas despesas uma conta aceita (o mesmo teto dos parâmetros). */
export const SUPERPLAN_MAX_EXPENSES = 200;

/*
 * O esquema é montado dentro de uma função chamada uma vez (marcada como
 * pura): a calculadora, que roda no navegador e não confere nada, não precisa
 * carregar o zod por causa dele.
 */
function buildSuperplanInputSchema() {
  /** Número finito dentro da faixa (NaN e infinito são recusados pelo zod). */
  const bounded = (min: number, max: number) => z.number().min(min).max(max);
  const percent = bounded(0, 100);
  /** Valor em dinheiro por container ou por peça (R$, US$ ou RMB). */
  const money = bounded(0, 1e9);
  return z.object({
    unitPrice: bounded(0, 1e7).nullable(),
    currency: z.enum(["RMB", "USD"]),
    pcsPerCarton: bounded(0, 1e6).nullable(),
    netWeightPcKg: bounded(0, 1e5).nullable(),
    grossWeightPcKg: bounded(0, 1e5).nullable(),
    cbmPerCarton: bounded(0, 1e4).nullable(),
    containerCbm: bounded(0, 1e4).nullable(),
    containerMaxKg: bounded(0, 1e7).nullable(),
    iiPct: bounded(0, 1000),
    ipiPct: bounded(0, 1000),
    freightUsd: money.nullable(),
    roadFreightBrl: money,
    deliveryFreightBrl: money,
    officialRate: bounded(0, 1e4).nullable(),
    futureRate: bounded(0, 1e4).nullable(),
    rmbPerUsd: bounded(0, 1e4).nullable(),
    tradingCommissionPct: percent,
    chinaChargesRmb: money,
    expenses: z
      .array(
        z.object({
          key: z.string().max(40),
          label: z.string().max(120),
          amountBrl: money,
          customs: z.boolean(),
        }),
      )
      .max(SUPERPLAN_MAX_EXPENSES),
    markup: bounded(0, 100),
    commissionPct: percent,
    adminExpensesPct: percent,
    targetProfitPct: bounded(-100, 100),
    wdPct: bounded(0, 1000),
    insurancePct: percent,
    pisImportPct: percent,
    cofinsImportPct: percent,
    icmsImportPct: percent,
    freightFxPct: percent,
    afrmmPct: percent,
    afrmmFixedBrl: money,
    grossEstimatePct: percent,
    priceFactors: z.object({
      table: bounded(0, 100),
      wholesale: bounded(0, 100),
      retail: bounded(0, 100),
    }),
    saleTaxes: z.object({
      icmsPct: percent,
      pisPct: percent,
      cofinsPct: percent,
      irPct: percent,
      csllPct: percent,
    }),
    salePrice: money.nullable(),
  }) satisfies z.ZodType<SuperplanInput>;
}

/**
 * Uma conta inteira (`SuperplanInput`) vinda do navegador ("gravar esta
 * simulação"): todo número finito e dentro de uma faixa razoável, listas e
 * textos com tamanho máximo. Campo desconhecido é descartado (não chega à
 * conta). O resultado NUNCA vem do navegador: quem grava refaz a conta com
 * `computeSuperplan` a partir do que passar aqui.
 */
export const superplanInputSchema = /* @__PURE__ */ buildSuperplanInputSchema();
