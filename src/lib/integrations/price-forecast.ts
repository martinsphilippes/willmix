import {
  SankhyaError,
  executeQuery,
  type SankhyaClientOptions,
  type SankhyaRow,
} from "./sankhya-client";

/*
 * Previsão de preço ao cliente final (Nova solicitação, dono, 15/11/2026),
 * pela SuperPlan do Sankhya (anexo 2, "SuperPlan × Função", Amplio,
 * 14/11/2026):
 *
 * - Ida: `sankhya.FN_AD_SUPERPLAN_WELL(69 parâmetros)` → custo e venda por
 *   peça (VENDA_IPI = custo × MKP, PRECO_TABELA_COM_IPI, SUGESTAO_ATACADO,
 *   SUGESTAO_LOJA, PRECO_VENDA_META, LUCRO_LIQUIDO_PERC, MENSAGEM…).
 * - Volta: `sankhya.FN_AD_SUPERPLAN_INVERSA_WELL(mesmos 69)` com o preço de
 *   venda desejado no 48º (PRECO_VENDA_ALVO) → preço máximo de compra
 *   (PRECO_MAX_COMPRA_ORIGEM, MOEDA_COMPRA, PRECO_MAX_COMPRA_USD,
 *   MENSAGEM_INVERSA).
 *
 * Mesma chamada do DbExplorer (`DbExplorerSP.executeQuery`). Parâmetro sem
 * valor vai como DEFAULT (o padrão do Sankhya). Texto só com
 * [A-Za-z0-9.]{1,10}; número só finito (a validação do anexo). O documento
 * diz que as funções de venda estavam "aguardando publicação": enquanto não
 * existirem no banco, a resposta é o erro do Sankhya (a tela mostra).
 */

/** Ordem dos 45 parâmetros de custo (anexo 2, "ORDEM"). */
export const SUPERPLAN_COST_PARAMS = [
  "NCM",
  "PESO_LIQ_PECA",
  "PESO_BRUTO_PECA",
  "PECAS_CAIXA",
  "CBM_CAIXA",
  "PRECO_ORIGEM",
  "QTD_PECAS",
  "INCOTERM",
  "MOEDA_ORIGEM",
  "COTACAO_ORIGEM",
  "DOLAR",
  "PORTO_EMBARQUE",
  "PORTO_DESEMBARQUE",
  "PRECO_INVOICE_USD",
  "EX_NCM",
  "ALIQ_II",
  "ALIQ_IPI",
  "ALIQ_PIS",
  "ALIQ_COFINS",
  "ALIQ_ICMS",
  "DOLAR_FUTURO",
  "QTD_CONTAINERS",
  "TIPO_CONTAINER",
  "FRETE_INT_USD",
  "CODAGENTE",
  "CODDESPACHANTE",
  "TIPO_RATEIO",
  "EXIGE_INMETRO",
  "CODPARC_FORN",
  "CODEMP",
  "COMISSAO_TRADE_BRL",
  "PERC_COMISSAO_FORN",
  "PLUSCHARGE_VLR",
  "PLUSCHARGE_MOEDA",
  "DESP_ORIGEM_VLR",
  "DESP_ORIGEM_MOEDA",
  "MARGEM_PERC",
  "DATA_REF",
  "ID_PRECUSTO_BASE",
  "CERT_ANUAL_BRL",
  "CERT_CONTAINERS_ANO",
  "CODPROD",
  "CBM_PECA",
  "FATOR_CUBAGEM",
  "FATOR_PESO_BRUTO",
] as const;

/** Os 24 de venda, depois dos de custo (anexo 2, "ORDEM_V"). */
export const SUPERPLAN_SALE_PARAMS = [
  "BASE_PRECO",
  "MKP",
  "PRECO_VENDA_ALVO",
  "META_LUCRO_PERC",
  "COMISSAO_VENDA_PERC",
  "VIP",
  "DESPESAS_PERC",
  "WD_PERC",
  "FATOR_TABELA",
  "FATOR_ATACADO",
  "FATOR_LOJA",
  "PECAS_CAIXA_VENDA",
  "FRETE_ENTREGA_BRL",
  "FATOR_WD_155",
  "ALIQ_ICMS_SAIDA",
  "ALIQ_PIS_DEBITO",
  "ALIQ_COFINS_DEBITO",
  "ALIQ_PIS_CREDITO",
  "ALIQ_COFINS_CREDITO",
  "ALIQ_IR",
  "ALIQ_CSLL",
  "CUSTO_BASE_INFORMADO",
  "IPI_CREDITO_PECA_INFORMADO",
  "ICMS_CREDITO_PECA_INFORMADO",
] as const;

export const SUPERPLAN_PARAMS = [
  ...SUPERPLAN_COST_PARAMS,
  ...SUPERPLAN_SALE_PARAMS,
] as const;
export type SuperplanParam = (typeof SUPERPLAN_PARAMS)[number];

/** Parâmetros de texto (vão entre aspas). */
const TEXT_PARAMS = new Set<SuperplanParam>([
  "NCM",
  "INCOTERM",
  "MOEDA_ORIGEM",
  "TIPO_RATEIO",
  "EXIGE_INMETRO",
  "DATA_REF",
  "BASE_PRECO",
]);

export type SuperplanInput = Partial<
  Record<SuperplanParam, string | number | null>
>;

export const SUPERPLAN_FN = "FN_AD_SUPERPLAN_WELL";
/**
 * Cotação de encomenda V2 (dono, 16/11/2026; "Chamada da API de encomenda ·
 * V2", 71 argumentos): substitui a ida da SuperPlan na previsão de preço. Os
 * 69 de antes, na mesma ordem, mais @CODVEND (70) e @ROTA_ENTREGA (71); todo
 * argumento vai como CAST(valor AS tipo) e o sem valor como CAST(NULL AS tipo).
 */
export const COTACAO_V2_FN = "FN_AD_ENC_COTACAO_V2_WELL";
export const COTACAO_V2_PARAMS = [
  ...SUPERPLAN_PARAMS,
  "CODVEND",
  "ROTA_ENTREGA",
] as const;
export type CotacaoV2Param = (typeof COTACAO_V2_PARAMS)[number];

/** Tipo SQL de cada argumento da V2 (a assinatura publicada). */
const V2_TEXT: Partial<Record<CotacaoV2Param, string>> = {
  NCM: "VARCHAR(10)",
  INCOTERM: "VARCHAR(5)",
  MOEDA_ORIGEM: "VARCHAR(5)",
  TIPO_RATEIO: "CHAR(1)",
  EXIGE_INMETRO: "CHAR(1)",
  DATA_REF: "DATE",
  BASE_PRECO: "VARCHAR(20)",
  ROTA_ENTREGA: "VARCHAR(20)",
};
const V2_INT = new Set<CotacaoV2Param>([
  "PORTO_EMBARQUE",
  "PORTO_DESEMBARQUE",
  "EX_NCM",
  "QTD_CONTAINERS",
  "TIPO_CONTAINER",
  "CODAGENTE",
  "CODDESPACHANTE",
  "CODPARC_FORN",
  "CODEMP",
  "PLUSCHARGE_MOEDA",
  "DESP_ORIGEM_MOEDA",
  "ID_PRECUSTO_BASE",
  "CODPROD",
  "CODVEND",
]);
export const v2Type = (name: CotacaoV2Param) =>
  V2_TEXT[name] ?? (V2_INT.has(name) ? "INT" : "FLOAT");

export type CotacaoV2Input = Partial<
  Record<CotacaoV2Param, string | number | null>
>;

/** Um argumento da V2: CAST(valor AS tipo); erro = Error("invalid_input"). */
function v2Arg(name: CotacaoV2Param, value: unknown): string {
  const type = v2Type(name);
  if (value === undefined || value === null || value === "")
    return `CAST(NULL AS ${type})`;
  if (V2_TEXT[name]) {
    const text = String(value);
    if (!/^[A-Za-z0-9._]{1,20}$/.test(text)) throw new Error("invalid_input");
    return `CAST('${text}' AS ${type})`;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("invalid_input");
  if (type === "INT" && !Number.isInteger(n)) throw new Error("invalid_input");
  return `CAST(${n} AS ${type})`;
}

/** SELECT da cotação V2, com as 71 posições na ordem. */
export function cotacaoV2Sql(input: CotacaoV2Input): string {
  const args = COTACAO_V2_PARAMS.map((k) => v2Arg(k, input[k]));
  return `SELECT * FROM sankhya.${COTACAO_V2_FN}(${args.join(", ")})`;
}
export const SUPERPLAN_INVERSE_FN = "FN_AD_SUPERPLAN_INVERSA_WELL";

/** Um argumento do SQL (a validação do anexo); erro = Error("invalid_input"). */
function sqlArg(name: SuperplanParam, value: unknown): string {
  if (value === undefined || value === null || value === "") return "DEFAULT";
  if (TEXT_PARAMS.has(name)) {
    const text = String(value);
    if (!/^[A-Za-z0-9.]{1,10}$/.test(text)) throw new Error("invalid_input");
    return `'${text}'`;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("invalid_input");
  return String(n);
}

/** SELECT da função (ida ou volta), com os 69 parâmetros na ordem. */
export function superplanSql(
  fn: typeof SUPERPLAN_FN | typeof SUPERPLAN_INVERSE_FN,
  input: SuperplanInput,
): string {
  const args = SUPERPLAN_PARAMS.map((k) => sqlArg(k, input[k]));
  return `SELECT * FROM sankhya.${fn}(${args.join(", ")})`;
}

export interface PriceForecastQuery {
  /** Produto do catálogo do portal e o código dele no Sankhya (CODPROD). */
  productId: string;
  sankhyaCode: string | null;
  sku: string | null;
  /** Quantidade em peças da linha (nula sem quantidade). */
  quantity: number | null;
  /** Cliente do portal e o código dele no Sankhya, quando escolhido. */
  customerId: string | null;
  customerSankhyaCode: string | null;
  /**
   * Ficha do produto no portal: vai para a função quando o produto não tem
   * código do Sankhya (produto novo) ou quando o Sankhya pede o preço.
   */
  ncm?: string | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  masterBoxQty?: number | null;
  cbmPerCarton?: number | null;
  price?: number | null;
  currency?: string | null;
  /**
   * Condições comerciais da cotação V2 (dono, 16/11/2026): VIP do nível do
   * formato Wellmix, rota da entrega (quem chama o transportador), frete de
   * entrega total em R$ (Configurações; nulo = pendente), vendedor (RCA do
   * cliente, CODVEND) e a data de referência (AAAAMMDD).
   */
  vip?: number | null;
  route?: string | null;
  deliveryFreightBrl?: number | null;
  sellerCode?: number | null;
  dataRef?: string | null;
}

/** Preços de venda por peça (ida), em R$. */
export interface PriceForecastSale {
  /** VENDA_IPI: o preço de venda (custo × MKP, ou o desejado). */
  salePrice: number | null;
  /** PRECO_TABELA_COM_IPI. */
  tablePrice: number | null;
  /** SUGESTAO_ATACADO e SUGESTAO_LOJA (o cliente final). */
  wholesalePrice: number | null;
  retailPrice: number | null;
  /** PRECO_VENDA_META: o preço que dá a meta de lucro. */
  targetPrice: number | null;
  /** Custo por peça e lucro (só para quem vê valores e margem). */
  cost: number | null;
  profitPercent: number | null;
  goalPercent: number | null;
  /**
   * Cotação V2 (16/11/2026): situação (PRONTA, FRETE_PENDENTE, PENDENTE),
   * preço do produto pelo markup, frete por peça, referências WD e com
   * frete, e se a meta de margem foi atingida (só com valores e margem).
   */
  status?: string | null;
  productPrice?: number | null;
  freightUnit?: number | null;
  withFreight?: number | null;
  wdBase?: number | null;
  wdPercent?: number | null;
  wdPrice?: number | null;
  wdWithFreight?: number | null;
  goalReached?: boolean | null;
  /** O que foi enviado de condição comercial (VIP, rota e frete). */
  sent?: {
    vip: number | null;
    route: string | null;
    deliveryFreightBrl: number | null;
  };
}

/**
 * Memória de cálculo da SuperPlan (auditoria, dono, 15/11/2026): o que foi
 * enviado à função (só os parâmetros com valor; os outros vão como DEFAULT,
 * o padrão do Sankhya) e todas as colunas que ela devolveu, na ordem. Só
 * para quem vê valores e margem (tem custo).
 */
export interface SuperplanAudit {
  fn: string;
  inputs: Array<[string, string | number]>;
  outputs: Array<[string, string | number | null]>;
}

type Audited = { audit?: SuperplanAudit };

export type PriceForecastAnswer =
  | ({ mode: "api"; kind: "forecast" } & PriceForecastSale & Audited)
  | ({
      mode: "api";
      kind: "solve";
      /** Preço máximo de compra (moeda de origem) e em US$. */
      maxPurchasePrice: number | null;
      maxPurchaseCurrency: string | null;
      maxPurchaseUsd: number | null;
    } & Audited)
  | ({ mode: "api"; kind: "error"; message: string } & Audited)
  | { mode: "manual" };

export interface PriceForecastAdapter {
  readonly mode: "api" | "manual";
  /** O preço previsto ao cliente final. */
  forecast(query: PriceForecastQuery): Promise<PriceForecastAnswer>;
  /** O preço máximo de compra que leva ao preço de venda desejado. */
  solve(
    query: PriceForecastQuery & { targetFinalPriceBrl: number },
  ): Promise<PriceForecastAnswer>;
}

/** Sem a API: nada é calculado (nunca um preço estimado apresentado como real). */
export class ManualPriceForecastAdapter implements PriceForecastAdapter {
  readonly mode = "manual" as const;
  async forecast(): Promise<PriceForecastAnswer> {
    return { mode: "manual" };
  }
  async solve(): Promise<PriceForecastAnswer> {
    return { mode: "manual" };
  }
}

const positive = (n: number | null | undefined) =>
  n !== null && n !== undefined && Number.isFinite(n) && n > 0 ? n : null;

/** Moeda do portal → a da função (RMB, USD, EUR). */
function originCurrency(code: string | null | undefined): string | null {
  const c = String(code ?? "")
    .trim()
    .toUpperCase();
  if (c === "CNY") return "RMB";
  return ["RMB", "USD", "EUR"].includes(c) ? c : null;
}

/**
 * Entrada da função para o produto: com o código do Sankhya, o CODPROD (a
 * função lê o cadastro e o último pedido de importação); sem ele, a ficha do
 * portal (NCM, pesos, caixa, cubagem, preço e moeda). `withPrice` acrescenta
 * o preço do portal (o Sankhya pede quando o produto nunca foi importado).
 */
export function productInput(
  q: PriceForecastQuery,
  withPrice = false,
): SuperplanInput {
  const code = /^\d{1,10}$/.test(String(q.sankhyaCode ?? "").trim())
    ? Number(q.sankhyaCode)
    : null;
  const pieces = positive(q.quantity);
  const price: SuperplanInput = {
    PRECO_ORIGEM: positive(q.price),
    MOEDA_ORIGEM: originCurrency(q.currency),
  };
  if (code)
    return {
      CODPROD: code,
      QTD_PECAS: pieces ? Math.round(pieces) : null,
      ...(withPrice ? price : {}),
    };
  const ncm = String(q.ncm ?? "").replace(/\D/g, "");
  return {
    NCM: ncm.length === 8 ? ncm : null,
    PESO_LIQ_PECA: positive(q.netWeightKg),
    PESO_BRUTO_PECA: positive(q.grossWeightKg),
    PECAS_CAIXA: positive(q.masterBoxQty),
    CBM_CAIXA: positive(q.cbmPerCarton),
    QTD_PECAS: pieces ? Math.round(pieces) : null,
    ...price,
  };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const text = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? s : null;
};

/** Linha da ida → preços (`money` = vê custo e margem). */
export function saleOf(row: SankhyaRow, money: boolean): PriceForecastSale {
  return {
    salePrice: num(row.VENDA_IPI),
    tablePrice: num(row.PRECO_TABELA_COM_IPI),
    wholesalePrice: num(row.SUGESTAO_ATACADO),
    retailPrice: num(row.SUGESTAO_LOJA),
    targetPrice: num(row.PRECO_VENDA_META),
    cost: money ? num(row.CUSTO_BASE_VENDA) : null,
    profitPercent: money ? num(row.LUCRO_LIQUIDO_PERC) : null,
    goalPercent: money ? num(row.META_LUCRO_PERC) : null,
    status: text(row.STATUS_COTACAO),
    productPrice: num(row.PRECO_PRODUTO_META),
    freightUnit: num(row.FRETE_UNITARIO),
    withFreight: num(row.PRECO_COM_FRETE_REFERENCIA),
    wdBase: num(row.BASE_WD_VALOR),
    wdPercent: num(row.WD_PERC_REFERENCIA),
    wdPrice: num(row.PRECO_WD_REFERENCIA),
    wdWithFreight: num(row.PRECO_WD_COM_FRETE_REFERENCIA),
    goalReached: money ? flag(row.META_ATINGIDA) : null,
  };
}

/** S/N (ou 1/0) do Sankhya → sim/não; outro valor = nulo. */
function flag(v: unknown): boolean | null {
  const s = text(v)?.toUpperCase();
  if (s === "S" || s === "1" || s === "SIM" || s === "TRUE") return true;
  if (s === "N" || s === "0" || s === "NAO" || s === "NÃO" || s === "FALSE")
    return false;
  return null;
}

/** Mensagem de erro da linha (OK = N, MENSAGEM_VENDA ou MENSAGEM_INVERSA ≠ ok). */
export function rowProblem(
  row: SankhyaRow | undefined,
  key: "MENSAGEM_VENDA" | "MENSAGEM_INVERSA" | null,
): string | null {
  if (!row) return "sem resposta da função";
  if (text(row.OK)?.toUpperCase() === "N")
    return text(row.MENSAGEM) ?? "sem custo";
  if (!key) return null;
  const m = text(row[key]);
  return m && m.toLowerCase() !== "ok" ? m : null;
}

/** A SuperPlan do Sankhya (anexo 2). */
export class SankhyaPriceForecastAdapter implements PriceForecastAdapter {
  readonly mode = "api" as const;
  constructor(
    /** Quem pergunta vê custo e margem (canSeeMoney). */
    private readonly money: boolean,
    private readonly options: SankhyaClientOptions = {},
  ) {}

  /** Roda a função; sem preço no Sankhya, tenta de novo com o do portal. */
  private async run(
    fn:
      typeof SUPERPLAN_FN | typeof SUPERPLAN_INVERSE_FN | typeof COTACAO_V2_FN,
    q: PriceForecastQuery,
    extra: CotacaoV2Input,
  ): Promise<
    | { row: SankhyaRow | undefined; audit: SuperplanAudit | undefined }
    | "manual"
    | { error: string }
  > {
    try {
      const sql = (input: CotacaoV2Input) =>
        fn === COTACAO_V2_FN
          ? cotacaoV2Sql(input)
          : superplanSql(fn, input as SuperplanInput);
      let input: CotacaoV2Input = { ...productInput(q), ...extra };
      let row = (await executeQuery(sql(input), this.options)).rows[0];
      const needsPrice =
        text(row?.OK)?.toUpperCase() === "N" &&
        /PRECO_ORIGEM/i.test(String(row?.MENSAGEM ?? "")) &&
        positive(q.price) !== null &&
        !!q.sankhyaCode;
      if (needsPrice) {
        input = { ...productInput(q, true), ...extra };
        row = (await executeQuery(sql(input), this.options)).rows[0];
      }
      return { row, audit: this.money ? auditOf(fn, input, row) : undefined };
    } catch (e) {
      if (e instanceof SankhyaError && e.code === "sankhya_not_configured")
        return "manual";
      if (e instanceof Error && e.message === "invalid_input")
        return { error: "entrada inválida para a SuperPlan" };
      return {
        error: e instanceof SankhyaError ? e.detail || e.code : String(e),
      };
    }
  }

  async forecast(q: PriceForecastQuery): Promise<PriceForecastAnswer> {
    // Cotação de encomenda V2 (dono, 16/11/2026) no lugar da SuperPlan.
    const ran = await this.run(COTACAO_V2_FN, q, commercialInput(q, true));
    if (ran === "manual") return { mode: "manual" };
    if ("error" in ran)
      return { mode: "api", kind: "error", message: String(ran.error) };
    const { row, audit } = ran;
    const problem = rowProblem(row, "MENSAGEM_VENDA");
    if (problem) return { mode: "api", kind: "error", message: problem, audit };
    return {
      mode: "api",
      kind: "forecast",
      ...saleOf(row!, this.money),
      sent: {
        vip: q.vip ?? null,
        route: q.route ?? null,
        deliveryFreightBrl: q.deliveryFreightBrl ?? null,
      },
      audit,
    };
  }

  async solve(
    q: PriceForecastQuery & { targetFinalPriceBrl: number },
  ): Promise<PriceForecastAnswer> {
    // A volta continua na SuperPlan inversa (69): leva o VIP e o frete de
    // entrega, que ela também tem; a rota e o vendedor são só da V2.
    const ran = await this.run(SUPERPLAN_INVERSE_FN, q, {
      ...commercialInput(q, false),
      PRECO_VENDA_ALVO: q.targetFinalPriceBrl,
    });
    if (ran === "manual") return { mode: "manual" };
    if ("error" in ran)
      return { mode: "api", kind: "error", message: String(ran.error) };
    const { row, audit } = ran;
    const problem = rowProblem(row, "MENSAGEM_INVERSA");
    if (problem) return { mode: "api", kind: "error", message: problem, audit };
    return {
      mode: "api",
      kind: "solve",
      maxPurchasePrice: num(row!.PRECO_MAX_COMPRA_ORIGEM),
      maxPurchaseCurrency: text(row!.MOEDA_COMPRA),
      maxPurchaseUsd: num(row!.PRECO_MAX_COMPRA_USD),
      audit,
    };
  }
}

/**
 * Condições comerciais da cotação (dono, 16/11/2026): VIP, frete de entrega
 * e a data; na V2, também a rota e o vendedor.
 */
export function commercialInput(
  q: PriceForecastQuery,
  v2: boolean,
): CotacaoV2Input {
  const vip = q.vip !== null && q.vip !== undefined && q.vip > 0 ? q.vip : null;
  const freight =
    q.deliveryFreightBrl !== null &&
    q.deliveryFreightBrl !== undefined &&
    Number.isFinite(q.deliveryFreightBrl) &&
    q.deliveryFreightBrl >= 0
      ? q.deliveryFreightBrl
      : null;
  return {
    VIP: vip,
    FRETE_ENTREGA_BRL: freight,
    DATA_REF: q.dataRef && /^\d{8}$/.test(q.dataRef) ? q.dataRef : null,
    ...(v2
      ? {
          ROTA_ENTREGA: q.route ?? null,
          CODVEND:
            q.sellerCode && Number.isInteger(q.sellerCode) && q.sellerCode > 0
              ? q.sellerCode
              : null,
        }
      : {}),
  };
}

/** Entrada enviada (só com valor, na ordem da função) e a linha devolvida. */
export function auditOf(
  fn: string,
  input: CotacaoV2Input,
  row: SankhyaRow | undefined,
): SuperplanAudit {
  return {
    fn,
    inputs: COTACAO_V2_PARAMS.flatMap((k) => {
      const v = input[k];
      return v === undefined || v === null || v === "" ? [] : [[k, v]];
    }) as Array<[string, string | number]>,
    outputs: Object.entries(row ?? {}),
  };
}

/**
 * A SuperPlan do Sankhya; sem o Sankhya configurado, cada chamada responde
 * `{ mode: "manual" }` (nenhum preço inventado).
 */
export function getPriceForecastAdapter(
  money = false,
  options: SankhyaClientOptions = {},
): PriceForecastAdapter {
  return new SankhyaPriceForecastAdapter(money, options);
}
