/*
 * Tarifário de frete marítimo (sem banco): lê a planilha "ESTIMATIVA DE
 * FRETE" que a Wellmix monta com as tarifas das companhias marítimas (agente
 * de cargas + armador) e devolve tudo organizado.
 *
 * Layout esperado (o da planilha modelo, achado pelos rótulos, não por
 * endereço fixo):
 * - uma aba "COMPARATIVO - XXX" por porto de destino (NVT = Navegantes,
 *   ITJ = Itajaí, IOA = Itapoá);
 * - na linha dos títulos, um bloco de 4 colunas por agente: "USD POR 40HQ
 *   (ROTA DIRETA)", "(ROTA LONGA)", "TOTAL CUSTOS BRL (ROTA DIRETA)",
 *   "(ROTA LONGA)"; o nome do agente fica na linha de cima, com o "PRAZO
 *   PGTO." ao lado;
 * - uma linha por porto de origem (o país na coluna anterior ao porto);
 * - abaixo, os parâmetros (câmbio, spread, "FRETE (CD)", "QTD CNTR") e o
 *   bloco "TAXAS" de cada agente (taxa, US$, R$), até "TOTAIS";
 * - abas FORNECEDORES (CODPARC, NOMEPARC) e PORTOS (ID, PORTO) com os códigos
 *   do Sankhya, e AD_FREINT (o que a macro gerou para o Sankhya).
 *
 * O total em R$ de cada tarifa é recalculado aqui com as taxas do próprio
 * agente: frete (US$) × containers × câmbio + frete rodoviário até o CD ×
 * containers + taxas do agente em R$. Tudo o que é pago em US$ (frete e taxas
 * em US$) entra com o PTAX e o IOF do agente: US$ × câmbio × (1 + PTAX) ×
 * (1 + IOF). A planilha não soma PTAX e IOF; a conferência compara os totais
 * dela com a conta dela (sem os dois) e avisa quando difere (ex.: fórmula
 * somando as taxas de outro agente).
 */

/** Container das tarifas (40HQ na planilha = 40HC nas Configurações). */
export const TARIFF_CONTAINER_TYPE = "40HC";
/** SEQCONTAI do Sankhya para o 40HQ (o mesmo que a macro grava). */
export const SANKHYA_SEQCONTAI = 3;
export const SANKHYA_HEADER = [
  "AD_IDEXTERNO",
  "CODPARC",
  "DTREFERENCIA",
  "IDDEST",
  "IDORIG",
  "SEQCONTAI",
  "VALOR",
  "TAXA_USD",
  "TAXA_BRL",
] as const;

/** Sigla da aba → porto de destino (nome como na aba PORTOS). */
const DESTINATION_NAMES: Record<string, string> = {
  NVT: "NAVEGANTES",
  ITJ: "ITAJAÍ",
  IOA: "ITAPOÁ",
  SSZ: "SANTOS",
  PNG: "PARANAGUÁ",
  SFS: "SÃO FRANCISCO DO SUL",
  RIG: "RIO GRANDE",
  IBB: "IMBITUBA",
};

/** IDs fixos que a macro usa para os destinos (se a aba PORTOS não tiver o nome). */
const DESTINATION_IDS: Record<string, number> = { NVT: 60, IOA: 44, ITJ: 5 };

/** Ordem dos destinos no CSV do Sankhya: a da macro, depois os demais. */
const SANKHYA_ORDER = ["NVT", "IOA", "ITJ"];

/** Taxas cobradas uma vez por embarque (as demais, por container), como na planilha. */
const PER_SHIPMENT_FEES = ["courier", "bl fee", "trs"];

const LIMITS = { sheets: 12, origins: 300, forwarders: 20, fees: 30 };

export type TariffRoute = "direct" | "long";

export interface TariffFee {
  label: string;
  /** "ORIGEM" ou "DESTINO", quando a planilha diz. */
  side: string | null;
  usd: number | null;
  brl: number | null;
  perShipment: boolean;
}

export interface TariffForwarder {
  name: string;
  /** CODPARC do Sankhya (aba FORNECEDORES). */
  code: string | null;
  paymentTermDays: number | null;
  fees: TariffFee[];
  /** Totais das taxas na planilha (linha "TOTAIS TAXAS USD/BRL"): vão para o Sankhya. */
  feesUsd: number;
  feesBrl: number;
  /** Taxas do agente em R$ por embarque (US$ convertidos + R$), como o "TOTAIS TAXAS (BRL)". */
  feesTotalBrl: number;
  /** Acréscimo sobre o câmbio (0,02 = 2%) e IOF (0,035 = 3,5%) do agente. */
  ptaxPercent: number | null;
  iofPercent: number | null;
  /*
   * Só no comparativo (várias planilhas juntas): de quem são as tarifas e de
   * que planilha vieram.
   */
  /** Companhia marítima dona das tarifas (null = planilha consolidada). */
  shippingLineId?: string | null;
  /** Nome da companhia no cadastro. */
  company?: string | null;
  tariffId?: string;
  /** Data de referência da planilha de origem (DTREFERENCIA do Sankhya). */
  referenceDate?: string;
}

export interface TariffOrigin {
  country: string | null;
  name: string;
  /** ID do porto no Sankhya (aba PORTOS). */
  portId: number | null;
}

export interface TariffRate {
  /** Índice em `origins`. */
  origin: number;
  /** Índice em `forwarders`. */
  forwarder: number;
  route: TariffRoute;
  /** Frete marítimo em US$ por container. */
  oceanUsd: number;
  /** Custo total em R$ (recalculado com as taxas do próprio agente). */
  totalBrl: number;
  /** Total que a planilha mostrava (para conferência). */
  sheetTotalBrl: number | null;
}

export interface TariffDestination {
  sheet: string;
  code: string;
  name: string;
  portId: number | null;
  /** Parâmetros da própria aba: câmbio, frete até o CD e containers. */
  fx: number;
  roadFreightBrl: number;
  containerQty: number;
  forwarders: TariffForwarder[];
  origins: TariffOrigin[];
  rates: TariffRate[];
}

export type TariffWarningCode =
  | "fees_other_agent"
  | "total_mismatch"
  | "fees_copied"
  | "ptax_iof_unused"
  | "ptax_iof_added"
  | "ptax_iof_missing"
  | "other_blocks_ignored"
  | "block_chosen"
  | "forwarder_no_code"
  | "port_no_id"
  | "port_no_id_similar"
  | "destination_unknown"
  | "road_freight_missing"
  | "params_differ"
  | "fx_missing"
  | "containers_differ"
  | "destination_fixed_id"
  | "sankhya_tab_outdated"
  | "sankhya_duplicate_ids"
  | "cell_error";

export interface TariffWarning {
  code: TariffWarningCode;
  params: Record<string, string | number>;
}

/** Câmbio do comparativo: o da planilha ou o dólar do dia do portal. */
export type TariffFxSource = "sheet" | "portal";

export interface FreightTariffData {
  version: 1;
  /** Câmbio usado (dólar + spread), em R$ por US$. */
  fx: number;
  fxBase: number | null;
  fxSpread: number | null;
  /** Frete rodoviário do porto até o CD, em R$ por container. */
  roadFreightBrl: number;
  /** Quantidade de containers da estimativa. */
  containerQty: number;
  destinations: TariffDestination[];
  warnings: TariffWarning[];
  /** Só no comparativo: de onde veio o câmbio (sem o campo: da planilha). */
  fxSource?: TariffFxSource;
  /**
   * Planilha de uma companhia com um bloco de nome diferente do cadastro
   * (indicado por ela): a próxima planilha dela usa o mesmo bloco sozinha.
   */
  chosenBlock?: string;
}

export class TariffError extends Error {
  /** Detalhe para a tela (ex.: nomes dos blocos achados na planilha). */
  readonly detail: string[];
  constructor(message: string, detail: string[] = []) {
    super(message);
    this.detail = detail;
  }
}

/** Leitura só de alguns blocos (a planilha de uma companhia com os das outras). */
export interface TariffParseOptions {
  /** Bloco (companhia) que entra; os outros ficam de fora. */
  keepBlock?: (name: string) => boolean;
}

/** Uma aba da planilha: células na posição exata (`cells[linha][coluna]`). */
export interface TariffSheet {
  name: string;
  cells: string[][];
  /** Células de texto ("linha:coluna"): número digitado como texto segue o formato brasileiro. */
  text?: Set<string>;
}

/** Texto comparável: sem acento, minúsculo, só letras/números e espaço simples. */
export function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nome limpo e curto (nomes de companhia, porto e taxa nunca passam disto). */
const cleanName = (s: string) =>
  s.slice(0, 400).replace(/\s+/g, " ").trim().slice(0, 120);

/** Só textos curtos podem ser rótulos ("USD POR 40HQ…"): evita trabalho à toa em textos enormes. */
const isLabel = (s: string | undefined, needle: string) =>
  !!s && s.length <= 200 && foldName(s).includes(needle);

const isErrorValue = (s: string) => /^#[A-Z/0]+[!?]?$/.test(s.trim());

/** Número de uma célula ("3618", "5.0569", "1.200,50", "R$ 1.270"); vazio/erro = null. */
export function cellNumber(
  raw: string | undefined,
  isText = false,
): number | null {
  if (raw === undefined) return null;
  let s = raw.trim();
  if (!s || isErrorValue(s)) return null;
  // Texto com "R$" ou vírgula foi digitado no formato brasileiro ("R$ 1.270",
  // "1.200,50"), e também célula de texto com ponto de milhar ("3.618", como
  // o Excel em português lê); célula numérica chega no formato do Excel
  // ("1270", "5.0569").
  const brazilian =
    /^R\$/i.test(s) ||
    s.includes(",") ||
    (isText && /^-?\d{1,3}(\.\d{3})+$/.test(s));
  s = s.replace(/^(R\$|US\$|\$|USD|BRL)\s*/i, "").replace(/\s/g, "");
  if (brazilian) {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) && !/^-?\d+(,\d+)?$/.test(s))
      return null;
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (!/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Percentual de uma célula ("0.02", "2%", "2", "0,38" ou "2,5%" → 0,02 /
 * 0,0038 / 0,025). PTAX e IOF de verdade ficam abaixo de 10%: número a
 * partir de 0,2 sem "%" é ponto percentual ("0,38" = 0,38%); acima de 10%
 * fica de fora (null).
 */
export function cellPercent(
  raw: string | undefined,
  isText = false,
): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  const percent = s.endsWith("%");
  const n = cellNumber(percent ? s.slice(0, -1) : s, isText || percent);
  if (n === null || n < 0) return null;
  // "2" (ou "0,38") digitado numa célula sem formato de % quer dizer 2% (0,38%).
  const v = percent || n >= 0.2 ? n / 100 : n;
  return v <= 0.1 ? Math.round(v * 1e6) / 1e6 : null;
}

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const at = (cells: string[][], r: number, c: number) =>
  (cells[r]?.[c] ?? "").trim();

/** Sigla da aba de destino ("COMPARATIVO - NVT" → "NVT"); outras abas: null. */
export function destinationCode(sheetName: string): string | null {
  // Como a macro: maiúsculas, travessões (– —) e espaço fixo valem como hífen/espaço.
  const name = sheetName
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u00a0/g, " ")
    .toUpperCase();
  const m = /^\s*COMPARATIVO\s*-\s*([A-Z]{2,5})\s*$/.exec(name);
  return m ? m[1] : null;
}

/** Tabela simples com cabeçalho (FORNECEDORES, PORTOS, AD_FREINT). */
function headerTable(sheet: TariffSheet | undefined, required: string[]) {
  if (!sheet) return null;
  for (let r = 0; r < Math.min(sheet.cells.length, 10); r++) {
    const row = sheet.cells[r] ?? [];
    const index = new Map<string, number>();
    row.forEach((v, i) => {
      if (v) index.set(v.trim().toUpperCase(), i);
    });
    if (required.every((h) => index.has(h)))
      return {
        col: (h: string) => index.get(h) ?? -1,
        rows: sheet.cells.slice(r + 1).filter((x) => x && x.some(Boolean)),
      };
  }
  return null;
}

interface Group {
  start: number;
  usdDirect: number;
  usdLong: number;
  brlDirect: number;
  brlLong: number;
}

interface ParsedSheet {
  dest: TariffDestination;
  fx: number | null;
  fxBase: number | null;
  fxSpread: number | null;
  roadFreightBrl: number | null;
  containerQty: number | null;
  /** Colunas de cada agente mantido (mesma ordem de `dest.forwarders`). */
  groups: Group[];
  /** Taxas de cada agente como texto, para achar blocos copiados. */
  feeVectors: string[];
  /** Linha de cada porto de origem (mesma ordem de `dest.origins`). */
  originRows: number[];
  cells: string[][];
  text: Set<string>;
}

function parseDestinationSheet(
  sheet: TariffSheet,
  code: string,
  warnings: TariffWarning[],
  options: TariffParseOptions = {},
): ParsedSheet | null {
  const { cells } = sheet;
  const text = sheet.text ?? new Set<string>();
  const n = (r: number, c: number) =>
    cellNumber(at(cells, r, c), text.has(`${r}:${c}`));
  // Linha dos títulos: a que tem "USD POR 40HQ".
  const hr = cells.findIndex((row) =>
    (row ?? []).some((v) => isLabel(v, "usd por 40hq")),
  );
  if (hr < 1) return null;
  const head = cells[hr];
  const portCol = head.findIndex((v) => /^portos?$/.test(foldName(v ?? "")));
  if (portCol < 1) return null;
  const groups: Group[] = [];
  head.forEach((v, c) => {
    if (!isLabel(v, "usd por 40hq")) return;
    const f = foldName(v ?? "");
    if (!f.includes("direta")) return;
    // Rótulos das 4 colunas do bloco (na ordem da planilha, mas achados pelo texto).
    const pick = (test: (s: string) => boolean, fallback: number) => {
      for (let k = c; k < c + 4; k++)
        if (test(foldName(head[k] ?? ""))) return k;
      return fallback;
    };
    groups.push({
      start: c,
      usdDirect: c,
      usdLong: pick((s) => s.includes("usd") && s.includes("longa"), c + 1),
      brlDirect: pick((s) => s.includes("brl") && s.includes("direta"), c + 2),
      brlLong: pick((s) => s.includes("brl") && s.includes("longa"), c + 3),
    });
  });
  if (!groups.length) return null;

  // Bloco de taxas: a linha em que a coluna do 1º agente diz "TAXAS".
  let feeRow = -1;
  for (let r = hr + 1; r < cells.length; r++)
    if (foldName(at(cells, r, groups[0].start)) === "taxas") {
      feeRow = r;
      break;
    }
  const lastOrigin = feeRow > 0 ? feeRow : cells.length;

  // Portos de origem (o país vale para as linhas de baixo até mudar).
  const origins: TariffOrigin[] = [];
  const originRows: number[] = [];
  let country: string | null = null;
  for (let r = hr + 1; r < lastOrigin && origins.length < LIMITS.origins; r++) {
    const c = at(cells, r, portCol - 1);
    if (c && !isErrorValue(c) && cellNumber(c) === null) country = cleanName(c);
    const name = at(cells, r, portCol);
    if (!name || cellNumber(name) !== null || isErrorValue(name)) continue;
    origins.push({ country, name: cleanName(name), portId: null });
    originRows.push(r);
  }

  // Parâmetros (abaixo dos portos, na coluna do porto e na anterior).
  let fxBase: number | null = null;
  let fxSpread: number | null = null;
  let fx: number | null = null;
  let roadFreightBrl: number | null = null;
  let containerQty: number | null = null;
  if (feeRow > 0) {
    fxBase = n(feeRow, portCol);
    fxSpread = n(feeRow + 1, portCol - 1);
    fx = n(feeRow + 1, portCol);
    for (let r = feeRow; r < Math.min(cells.length, feeRow + 20); r++) {
      const label = foldName(at(cells, r, portCol - 1));
      if (label.startsWith("frete")) roadFreightBrl = n(r, portCol);
      if (label.startsWith("qtd cntr") || label.startsWith("qtd container"))
        containerQty = n(r, portCol);
    }
  }
  if (!(fx && fx > 0))
    fx = fxBase && fxBase > 0 ? fxBase + (fxSpread ?? 0) : null;

  // Agentes: nome na linha de cima do título e o prazo de pagamento ao lado.
  const forwarders: TariffForwarder[] = [];
  const keptGroups: Group[] = [];
  const feeVectors: string[] = [];
  for (const g of groups.slice(0, LIMITS.forwarders)) {
    const name = cleanName(at(cells, hr - 1, g.start));
    const hasRates = originRows.some(
      (r) => (n(r, g.usdDirect) ?? 0) > 0 || (n(r, g.usdLong) ?? 0) > 0,
    );
    if (!name || isErrorValue(name)) {
      if (hasRates && !options.keepBlock)
        warnings.push({
          code: "cell_error",
          params: { sheet: sheet.name, cell: `${colName(g.start)}${hr}` },
        });
      continue;
    }
    if (options.keepBlock && !options.keepBlock(name)) continue;
    let paymentTermDays: number | null = null;
    for (let k = g.start + 1; k <= g.start + 4; k++)
      if (foldName(at(cells, hr - 1, k)).startsWith("prazo")) {
        for (let j = k + 1; j <= g.start + 4; j++) {
          const days = n(hr - 1, j);
          if (days !== null) {
            paymentTermDays = Math.round(days);
            break;
          }
        }
        break;
      }
    // Taxas do agente: da linha "TAXAS" até "TOTAIS".
    const fees: TariffFee[] = [];
    let feesUsd: number | null = null;
    let feesBrl: number | null = null;
    let ptaxPercent: number | null = null;
    let iofPercent: number | null = null;
    let side: string | null = null;
    // Só a 1ª linha "TOTAIS" (a de US$/R$) vale; a "TOTAIS TAXAS (BRL)" de baixo não.
    let totalsSeen = false;
    if (feeRow > 0) {
      for (let r = feeRow + 1; r < Math.min(cells.length, feeRow + 40); r++) {
        const tag = at(cells, r, g.start);
        const label = cleanName(at(cells, r, g.start + 1));
        const fTag = foldName(tag);
        if (fTag.startsWith("totais")) {
          if (!totalsSeen) {
            totalsSeen = true;
            feesUsd = n(r, g.start + 2);
            feesBrl = n(r, g.start + 3);
            for (const c of [g.start + 2, g.start + 3])
              if (isErrorValue(at(cells, r, c)))
                warnings.push({
                  code: "cell_error",
                  params: { sheet: sheet.name, cell: `${colName(c)}${r + 1}` },
                });
          }
          continue;
        }
        const fLabel = foldName(label);
        if (fLabel === "ptax" || fLabel === "iof") {
          const c = g.start + 2;
          const v = cellPercent(at(cells, r, c), text.has(`${r}:${c}`));
          if (fLabel === "ptax") ptaxPercent = v;
          else iofPercent = v;
          continue;
        }
        if (totalsSeen) continue;
        if (fTag === "origem" || fTag === "destino") side = cleanName(tag);
        if (!label || fees.length >= LIMITS.fees) continue;
        fees.push({
          label,
          side,
          usd: n(r, g.start + 2),
          brl: n(r, g.start + 3),
          perShipment: PER_SHIPMENT_FEES.some((p) => fLabel.startsWith(p)),
        });
      }
    }
    const sumUsd = fees.reduce((s, f) => s + (f.usd ?? 0), 0);
    const sumBrl = fees.reduce((s, f) => s + (f.brl ?? 0), 0);
    forwarders.push({
      name,
      code: null,
      paymentTermDays,
      fees,
      feesUsd: round(feesUsd ?? sumUsd, 4),
      feesBrl: round(feesBrl ?? sumBrl, 4),
      feesTotalBrl: 0,
      ptaxPercent,
      iofPercent,
    });
    keptGroups.push(g);
    feeVectors.push(
      fees
        .map((f) => `${foldName(f.label)}:${f.usd ?? ""}:${f.brl ?? ""}`)
        .join("|"),
    );
  }

  return {
    dest: {
      sheet: sheet.name,
      code,
      name: DESTINATION_NAMES[code] ?? code,
      portId: null,
      fx: 0,
      roadFreightBrl: 0,
      containerQty: 1,
      forwarders,
      origins,
      rates: [],
    },
    fx,
    fxBase,
    fxSpread,
    roadFreightBrl,
    containerQty,
    groups: keptGroups,
    feeVectors,
    originRows,
    cells,
    text,
  };
}

/** Distância de edição (Levenshtein), para dicas de nome parecido. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

function colName(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Quanto cada US$ custa a mais pelo PTAX e pelo IOF do agente:
 * (1 + PTAX) × (1 + IOF). Sem os dois na planilha, 1.
 */
export function usdFactor(
  f: Pick<TariffForwarder, "ptaxPercent" | "iofPercent">,
): number {
  const pct = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 0.1 ? v : 0;
  return (1 + pct(f.ptaxPercent)) * (1 + pct(f.iofPercent));
}

/**
 * Taxas do agente em R$ por embarque: por container × containers, por
 * embarque uma vez. As em US$ entram com o PTAX e o IOF (`factor`).
 */
export function feesTotalBrl(
  fees: TariffFee[],
  fx: number,
  containerQty: number,
  factor = 1,
): number {
  let total = 0;
  for (const f of fees) {
    const mult = f.perShipment ? 1 : containerQty;
    total += ((f.usd ?? 0) * fx * factor + (f.brl ?? 0)) * mult;
  }
  return round(total, 4);
}

/** Custo total em R$ de uma tarifa (por embarque de `containerQty` containers). */
export function rateTotalBrl(input: {
  oceanUsd: number;
  fx: number;
  containerQty: number;
  roadFreightBrl: number;
  feesTotalBrl: number;
  /** PTAX e IOF do agente sobre o frete em US$ (sem eles, 1). */
  factor?: number;
}): number {
  return round(
    input.oceanUsd * input.containerQty * input.fx * (input.factor ?? 1) +
      input.containerQty * input.roadFreightBrl +
      input.feesTotalBrl,
  );
}

/** Taxas em R$ do agente pela conta da planilha (sem PTAX e IOF). */
export function sheetFeesTotalBrl(
  f: Pick<TariffForwarder, "fees">,
  dest: Pick<TariffDestination, "fx" | "containerQty">,
): number {
  return feesTotalBrl(f.fees ?? [], dest.fx, dest.containerQty);
}

/** Total em R$ de uma tarifa pela conta da planilha (sem PTAX e IOF). */
export function sheetFormulaTotal(
  rate: Pick<TariffRate, "oceanUsd" | "forwarder">,
  dest: TariffDestination,
): number {
  const f = dest.forwarders[rate.forwarder];
  return rateTotalBrl({
    oceanUsd: rate.oceanUsd,
    fx: dest.fx,
    containerQty: dest.containerQty,
    roadFreightBrl: dest.roadFreightBrl,
    feesTotalBrl: f ? sheetFeesTotalBrl(f, dest) : 0,
  });
}

/**
 * Refaz os totais em R$ de um destino com os parâmetros dele (câmbio, frete
 * até o CD, containers) e o PTAX e o IOF de cada agente. Vale para os
 * tarifários gravados antes (sem PTAX e IOF na conta) e para o comparativo,
 * que troca os parâmetros.
 */
export function recomputeTotals(dest: TariffDestination): void {
  for (const f of dest.forwarders)
    f.feesTotalBrl = feesTotalBrl(
      f.fees ?? [],
      dest.fx,
      dest.containerQty,
      usdFactor(f),
    );
  for (const r of dest.rates) {
    const f = dest.forwarders[r.forwarder];
    if (!f) continue;
    r.totalBrl = rateTotalBrl({
      oceanUsd: r.oceanUsd,
      fx: dest.fx,
      containerQty: dest.containerQty,
      roadFreightBrl: dest.roadFreightBrl,
      feesTotalBrl: f.feesTotalBrl,
      factor: usdFactor(f),
    });
  }
}

/**
 * Lê o tarifário a partir das abas da planilha. Erros que impedem o uso
 * lançam `TariffError` (código para a tela traduzir); o resto vira aviso.
 */
export function parseFreightTariff(
  sheets: TariffSheet[],
  options: TariffParseOptions = {},
): FreightTariffData {
  const warnings: TariffWarning[] = [];
  const byName = (n: string) =>
    sheets.find((s) => s.name.trim().toUpperCase() === n);
  const parsed: ParsedSheet[] = [];
  for (const sheet of sheets) {
    const code = destinationCode(sheet.name);
    if (!code) continue;
    if (parsed.length >= LIMITS.sheets) break;
    const p = parseDestinationSheet(sheet, code, warnings, options);
    if (p) parsed.push(p);
  }
  if (!parsed.length) throw new TariffError("tariff_no_sheets");

  // Parâmetros de cada aba (como as fórmulas da planilha: cada aba usa o
  // próprio câmbio, frete até o CD e containers). Aba sem algum deles usa o
  // da 1ª aba que tem.
  const validFx = (v: number | null) => (v && v > 0 && v <= 100 ? v : null);
  const first = parsed[0];
  const fx =
    validFx(first.fx) ?? parsed.map((p) => validFx(p.fx)).find(Boolean);
  if (!fx) throw new TariffError("tariff_fx_missing");
  const firstRoad = parsed.find(
    (p) => p.roadFreightBrl !== null,
  )?.roadFreightBrl;
  const firstQty = parsed.find((p) => (p.containerQty ?? 0) > 0)?.containerQty;
  for (const p of parsed) {
    const d = p.dest;
    d.fx = round(validFx(p.fx) ?? fx, 6);
    d.containerQty =
      p.containerQty && p.containerQty > 0
        ? Math.round(p.containerQty)
        : firstQty
          ? Math.round(firstQty)
          : 1;
    d.roadFreightBrl = p.roadFreightBrl ?? firstRoad ?? 0;
    // Câmbio vazio ou com erro na aba: usa o de outra aba, mas avisa.
    if (validFx(p.fx) === null)
      warnings.push({
        code: "fx_missing",
        params: { sheet: d.sheet, fx: d.fx },
      });
    if (p.roadFreightBrl === null)
      warnings.push({
        code: "road_freight_missing",
        params: { sheet: d.sheet, value: d.roadFreightBrl },
      });
    // Câmbio é o do dia: aba com câmbio diferente da 1ª merece conferência.
    if (p !== first && d.fx !== round(fx, 6))
      warnings.push({
        code: "params_differ",
        params: {
          sheet: d.sheet,
          first: first.dest.sheet,
          fx: d.fx,
          firstFx: round(fx, 6),
        },
      });
  }
  // Containers diferentes entre abas: os totais não são comparáveis direto.
  for (const p of parsed.slice(1))
    if (p.dest.containerQty !== first.dest.containerQty)
      warnings.push({
        code: "containers_differ",
        params: {
          sheet: p.dest.sheet,
          first: first.dest.sheet,
          n: p.dest.containerQty,
          firstN: first.dest.containerQty,
        },
      });
  const containerQty = first.dest.containerQty;
  const roadFreightBrl = first.dest.roadFreightBrl;

  // Códigos do Sankhya.
  const suppliers = headerTable(byName("FORNECEDORES"), [
    "CODPARC",
    "NOMEPARC",
  ]);
  const supplierCode = new Map<string, string>();
  if (suppliers)
    for (const row of suppliers.rows) {
      const name = foldName(row[suppliers.col("NOMEPARC")] ?? "");
      const code = (row[suppliers.col("CODPARC")] ?? "").trim();
      if (name && /^\d{1,12}$/.test(code)) supplierCode.set(name, code);
    }
  const ports = headerTable(byName("PORTOS"), ["ID", "PORTO"]);
  const portId = new Map<string, number>();
  const portDisplay = new Map<string, string>();
  if (ports)
    for (const row of ports.rows) {
      const raw = cleanName(row[ports.col("PORTO")] ?? "");
      const id = cellNumber(row[ports.col("ID")]);
      if (
        raw &&
        id !== null &&
        Number.isInteger(id) &&
        !portId.has(foldName(raw))
      ) {
        portId.set(foldName(raw), id);
        portDisplay.set(foldName(raw), raw);
      }
    }

  const noCode = new Set<string>();
  const noId = new Set<string>();
  for (const p of parsed) {
    const { dest } = p;
    const known = DESTINATION_NAMES[dest.code];
    if (!known)
      warnings.push({
        code: "destination_unknown",
        params: { sheet: dest.sheet, code: dest.code },
      });
    const destKey = foldName(dest.name);
    // Sem o nome na aba PORTOS, o ID fixo que a macro usa (60, 44, 5).
    dest.portId = portId.get(destKey) ?? null;
    if (dest.portId === null && DESTINATION_IDS[dest.code] !== undefined) {
      dest.portId = DESTINATION_IDS[dest.code];
      warnings.push({
        code: "destination_fixed_id",
        params: { port: dest.name, id: dest.portId },
      });
    }
    dest.name = portDisplay.get(destKey) ?? dest.name;
    for (const o of dest.origins)
      o.portId = portId.get(foldName(o.name)) ?? null;
    // Taxas em R$ como a planilha soma (sem PTAX e IOF), para a conferência.
    const sheetFees: number[] = [];
    for (const f of dest.forwarders) {
      f.code = supplierCode.get(foldName(f.name)) ?? null;
      f.feesTotalBrl = feesTotalBrl(
        f.fees,
        dest.fx,
        dest.containerQty,
        usdFactor(f),
      );
      sheetFees.push(feesTotalBrl(f.fees, dest.fx, dest.containerQty));
    }
    const sheetMethod = (oceanUsd: number, fi: number) =>
      rateTotalBrl({
        oceanUsd,
        fx: dest.fx,
        containerQty: dest.containerQty,
        roadFreightBrl: dest.roadFreightBrl,
        feesTotalBrl: sheetFees[fi],
      });

    // Tarifas: uma por porto × agente × rota preenchida.
    const mismatch = new Map<number, { other: number | null; n: number }>();
    p.originRows.forEach((r, oi) => {
      p.groups.forEach((g, fi) => {
        const f = dest.forwarders[fi];
        for (const route of ["direct", "long"] as const) {
          const usdCell = route === "direct" ? g.usdDirect : g.usdLong;
          const brlCell = route === "direct" ? g.brlDirect : g.brlLong;
          const rawUsd = at(p.cells, r, usdCell);
          if (isErrorValue(rawUsd)) {
            warnings.push({
              code: "cell_error",
              params: {
                sheet: dest.sheet,
                cell: `${colName(usdCell)}${r + 1}`,
              },
            });
            continue;
          }
          const oceanUsd = cellNumber(rawUsd, p.text.has(`${r}:${usdCell}`));
          if (oceanUsd === null || !(oceanUsd > 0)) continue;
          const totalBrl = rateTotalBrl({
            oceanUsd,
            fx: dest.fx,
            containerQty: dest.containerQty,
            roadFreightBrl: dest.roadFreightBrl,
            feesTotalBrl: f.feesTotalBrl,
            factor: usdFactor(f),
          });
          const sheetTotalBrl = cellNumber(
            at(p.cells, r, brlCell),
            p.text.has(`${r}:${brlCell}`),
          );
          dest.rates.push({
            origin: oi,
            forwarder: fi,
            route,
            oceanUsd,
            totalBrl,
            sheetTotalBrl,
          });
          // Conferência com a conta da planilha (sem PTAX e IOF).
          if (
            sheetTotalBrl !== null &&
            Math.abs(sheetTotalBrl - sheetMethod(oceanUsd, fi)) > 0.05
          ) {
            // Explica a diferença: a fórmula somou as taxas de outro agente?
            const other = dest.forwarders.findIndex(
              (_, k) =>
                k !== fi &&
                Math.abs(sheetMethod(oceanUsd, k) - sheetTotalBrl) <= 0.05,
            );
            const cur = mismatch.get(fi) ?? { other: null, n: 0 };
            mismatch.set(fi, {
              other: cur.other ?? (other >= 0 ? other : null),
              n: cur.n + 1,
            });
          }
        }
      });
    });
    for (const [fi, m] of mismatch)
      warnings.push(
        m.other !== null
          ? {
              code: "fees_other_agent",
              params: {
                sheet: dest.sheet,
                forwarder: dest.forwarders[fi].name,
                other: dest.forwarders[m.other].name,
                n: m.n,
              },
            }
          : {
              code: "total_mismatch",
              params: {
                sheet: dest.sheet,
                forwarder: dest.forwarders[fi].name,
                n: m.n,
              },
            },
      );

    if (dest.portId === null && dest.rates.length) noId.add(dest.name);
    for (const r of dest.rates) {
      const f = dest.forwarders[r.forwarder];
      if (!f.code) noCode.add(f.name);
      const o = dest.origins[r.origin];
      if (o.portId === null) noId.add(o.name);
    }
  }
  for (const name of noCode)
    warnings.push({ code: "forwarder_no_code", params: { forwarder: name } });
  for (const name of noId) {
    // Nome parecido na aba PORTOS (ex.: SHENZEN): só uma dica, nunca usado sozinho.
    const key = foldName(name);
    // Nomes curtos (NANTONG × NANJING) só com 1 letra de diferença.
    const max = key.replace(/ /g, "").length >= 8 ? 2 : 1;
    const near = [...portDisplay.entries()].find(
      ([k]) => k !== key && editDistance(k, key) <= max,
    );
    warnings.push({
      code: near ? "port_no_id_similar" : "port_no_id",
      params: near
        ? { port: name, similar: near[1], id: portId.get(near[0]) ?? "" }
        : { port: name },
    });
  }

  // Taxas iguais, coluna por coluna, às de outro agente em outra aba
  // (bloco copiado sem trocar os valores): um aviso por aba.
  for (let i = 1; i < parsed.length; i++) {
    const pairs: string[] = [];
    let otherSheet = "";
    parsed[i].dest.forwarders.forEach((f, fi) => {
      const vec = parsed[i].feeVectors[fi];
      if (!vec || !f.fees.some((x) => (x.usd ?? 0) > 0 || (x.brl ?? 0) > 0))
        return;
      for (let j = 0; j < i; j++) {
        const k = parsed[j].feeVectors.indexOf(vec);
        if (k < 0) continue;
        const other = parsed[j].dest.forwarders[k];
        if (foldName(other.name) !== foldName(f.name)) {
          pairs.push(`${f.name} = ${other.name}`);
          otherSheet ||= parsed[j].dest.sheet;
        }
        break;
      }
    });
    if (pairs.length)
      warnings.push({
        code: "fees_copied",
        params: {
          sheet: parsed[i].dest.sheet,
          otherSheet,
          pairs: pairs.join("; "),
        },
      });
  }

  // PTAX e IOF entram nos totais daqui (a planilha não soma).
  {
    const pct = (v: number | null) => round((v ?? 0) * 100, 3);
    const priced = parsed.flatMap((p) =>
      p.dest.forwarders
        .map((f, fi) => ({ p, f, fi }))
        .filter(({ p: q, fi }) => q.dest.rates.some((r) => r.forwarder === fi)),
    );
    const added = priced.filter(
      ({ f }) => (f.ptaxPercent ?? 0) > 0 || (f.iofPercent ?? 0) > 0,
    );
    if (added.length) {
      const ptax = added.map(({ f }) => pct(f.ptaxPercent));
      const iof = added.map(({ f }) => pct(f.iofPercent));
      warnings.push({
        code: "ptax_iof_added",
        params: {
          ptax: Math.min(...ptax),
          ptaxMax: Math.max(...ptax),
          iof: Math.min(...iof),
          iofMax: Math.max(...iof),
        },
      });
    }
    // Agente com tarifa e sem PTAX ou IOF: o total dele fica sem o acréscimo.
    for (const { p, f } of priced)
      if (f.ptaxPercent === null || f.iofPercent === null)
        warnings.push({
          code: "ptax_iof_missing",
          params: {
            sheet: p.dest.sheet,
            forwarder: f.name,
            missing:
              f.ptaxPercent === null && f.iofPercent === null
                ? "PTAX/IOF"
                : f.ptaxPercent === null
                  ? "PTAX"
                  : "IOF",
          },
        });
  }

  const data: FreightTariffData = {
    version: 1,
    fx: round(fx, 6),
    fxBase: first.fxBase,
    fxSpread: first.fxSpread,
    roadFreightBrl,
    containerQty,
    destinations: parsed.map((p) => p.dest),
    warnings,
  };
  if (!data.destinations.some((d) => d.rates.length))
    throw new TariffError("tariff_empty");

  // AD_IDEXTERNO leva o destino (a macro não levava e um destino apagava o
  // outro no Sankhya); a conferência ainda avisa se algum código repetir.
  {
    const seen = new Map<string, number>();
    for (const r of sankhyaRows(data, "2000-01-01"))
      seen.set(r.externalId, (seen.get(r.externalId) ?? 0) + 1);
    const repeated = [...seen.values()].filter((n) => n > 1).length;
    if (repeated)
      warnings.push({
        code: "sankhya_duplicate_ids",
        params: { n: repeated },
      });
  }

  // A aba AD_FREINT (gerada pela macro) bate com os comparativos? (Lendo só
  // alguns blocos, ela tem os das outras companhias: não dá para comparar.)
  const tab = options.keepBlock
    ? null
    : headerTable(byName("AD_FREINT"), [...SANKHYA_HEADER]);
  if (tab) {
    const key = (v: (string | number)[]) => v.join("|");
    const theirs = tab.rows.map((row) =>
      key(
        (
          [
            "CODPARC",
            "IDDEST",
            "IDORIG",
            "VALOR",
            "TAXA_USD",
            "TAXA_BRL",
          ] as const
        ).map((h) => {
          const raw = row[tab.col(h)] ?? "";
          const n = cellNumber(raw);
          return n === null ? raw.trim() : round(n, 4);
        }),
      ),
    );
    const ours = sankhyaRows(data, "2000-01-01").map((r) =>
      key([
        r.code,
        r.destId,
        r.originId,
        round(r.value, 4),
        round(r.feesUsd, 4),
        round(r.feesBrl, 4),
      ]),
    );
    const count = new Map<string, number>();
    for (const k of ours) count.set(k, (count.get(k) ?? 0) + 1);
    let diff = 0;
    for (const k of theirs) {
      const n = count.get(k) ?? 0;
      if (n > 0) count.set(k, n - 1);
      else diff++;
    }
    for (const n of count.values()) diff += n;
    if (diff > 0)
      warnings.push({ code: "sankhya_tab_outdated", params: { n: diff } });
  }
  return data;
}

/**
 * Tarifário lido do banco: completa os parâmetros por aba dos gravados antes
 * deles (câmbio, frete até o CD e containers), para nenhuma conta dar NaN, e
 * refaz os totais com o PTAX e o IOF (os gravados antes não somavam).
 */
export function normalizeTariffData(
  data: FreightTariffData,
): FreightTariffData {
  const ok = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  data.destinations ??= [];
  for (const d of data.destinations) {
    if (!ok(d.fx) || !(d.fx > 0)) d.fx = data.fx;
    if (!ok(d.roadFreightBrl)) d.roadFreightBrl = data.roadFreightBrl ?? 0;
    if (!ok(d.containerQty) || !(d.containerQty > 0))
      d.containerQty =
        ok(data.containerQty) && data.containerQty > 0 ? data.containerQty : 1;
    d.forwarders ??= [];
    d.origins ??= [];
    d.rates ??= [];
    recomputeTotals(d);
  }
  // Aviso antigo ("PTAX e IOF fora da conta"): agora eles entram.
  data.warnings = (data.warnings ?? []).map((w) =>
    w.code === "ptax_iof_unused"
      ? {
          code: "ptax_iof_added",
          params: {
            ptax: w.params.ptax ?? 0,
            ptaxMax: w.params.ptax ?? 0,
            iof: w.params.iof ?? 0,
            iofMax: w.params.iof ?? 0,
          },
        }
      : w,
  );
  return data;
}

/* ------------------------------------------------------------------------ */
/* Sankhya: AD_FREINT.CSV (o que a macro "ModFretesCSV" gerava)              */
/* ------------------------------------------------------------------------ */

export interface SankhyaRow {
  externalId: string;
  code: string;
  date: string;
  destId: number;
  originId: number;
  seq: number;
  value: number;
  feesUsd: number;
  feesBrl: number;
  /** Nomes para a tela (não vão para o CSV). */
  forwarder: string;
  origin: string;
  destination: string;
  destinationCode: string;
}

/** Número serial do Excel (dias desde 30/12/1899) de um dia AAAA-MM-DD. */
export function excelSerial(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000,
  );
}

/**
 * Linhas da tabela AD_FREINT: uma cotação por agente/porto/destino, com a
 * rota direta e, sem ela, a longa. AD_IDEXTERNO = CODPARC + serial da data +
 * IDDEST (3 dígitos) + IDORIG: a macro não punha o destino e a mesma rota em
 * dois destinos repetia o código (no Sankhya, um apagava o outro). Agente sem
 * CODPARC ou porto sem ID fica de fora.
 */
export function sankhyaRows(
  data: FreightTariffData,
  referenceDate: string,
): SankhyaRow[] {
  // No comparativo, cada companhia vai com a data da própria planilha.
  const dated = (day: string) => {
    const [y, m, d] = day.split("-");
    return { serial: excelSerial(day), date: `${d}/${m}/${y}` };
  };
  const base = dated(referenceDate);
  const out: SankhyaRow[] = [];
  // Ordem da macro (NVT, IOA, ITJ), depois os demais: com AD_IDEXTERNO
  // repetido entre destinos, a última linha de cada código é a mesma da macro.
  const rank = (code: string) => {
    const i = SANKHYA_ORDER.indexOf(code);
    return i < 0 ? SANKHYA_ORDER.length : i;
  };
  const destinations = data.destinations
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d.code) - rank(b.d.code) || a.i - b.i)
    .map(({ d }) => d);
  for (const dest of destinations) {
    if (dest.portId === null) continue;
    dest.origins.forEach((o, oi) => {
      if (o.portId === null) return;
      dest.forwarders.forEach((f, fi) => {
        if (!f.code) return;
        const rates = dest.rates.filter(
          (r) => r.origin === oi && r.forwarder === fi,
        );
        const pick =
          rates.find((r) => r.route === "direct") ??
          rates.find((r) => r.route === "long");
        if (!pick) return;
        const { serial, date } =
          f.referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(f.referenceDate)
            ? dated(f.referenceDate)
            : base;
        out.push({
          // Com o destino (3 dígitos): a mesma companhia e origem em dois
          // destinos não repete o código, e o Sankhya fica com todos.
          externalId: `${f.code}${serial}${String(dest.portId).padStart(3, "0")}${o.portId}`,
          code: f.code,
          date,
          destId: dest.portId!,
          originId: o.portId!,
          seq: SANKHYA_SEQCONTAI,
          value: pick.oceanUsd,
          feesUsd: f.feesUsd,
          feesBrl: f.feesBrl,
          forwarder: f.name,
          origin: o.name,
          destination: dest.name,
          destinationCode: dest.code,
        });
      });
    });
  }
  return out;
}

/** Número com vírgula decimal, sem milhar (configuração regional do Brasil). */
const csvNumber = (n: number) => String(round(n, 4)).replace(".", ",");

const csvCell = (v: string) =>
  /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** AD_FREINT.CSV: ponto e vírgula, datas DD/MM/AAAA, cabeçalho, UTF-8 sem BOM. */
export function sankhyaCsv(
  data: FreightTariffData,
  referenceDate: string,
): string {
  const lines = [SANKHYA_HEADER.join(";")];
  for (const r of sankhyaRows(data, referenceDate))
    lines.push(
      [
        r.externalId,
        r.code,
        r.date,
        String(r.destId),
        String(r.originId),
        String(r.seq),
        csvNumber(r.value),
        csvNumber(r.feesUsd),
        csvNumber(r.feesBrl),
      ]
        .map(csvCell)
        .join(";"),
    );
  // Como a macro: linhas separadas por CRLF, sem quebra depois da última.
  return lines.join("\r\n");
}

/* ------------------------------------------------------------------------ */
/* Leituras para as telas                                                    */
/* ------------------------------------------------------------------------ */

export interface TariffOption {
  destination: string;
  destinationCode: string;
  origin: string;
  forwarder: string;
  route: TariffRoute;
  oceanUsd: number;
  totalBrl: number;
  paymentTermDays: number | null;
  /** Containers da estimativa (o total é do embarque inteiro). */
  containerQty: number;
  /** Companhia marítima dona da tarifa (comparativo), quando se sabe. */
  shippingLineId: string | null;
  company: string | null;
}

/** Menor custo de cada porto de origem num destino (índice da tarifa, ou null). */
export function cheapestByOrigin(
  dest: TariffDestination,
): (TariffRate | null)[] {
  return dest.origins.map((_, oi) => {
    const rates = dest.rates.filter((r) => r.origin === oi);
    return rates.length
      ? rates.reduce((best, r) => (r.totalBrl < best.totalBrl ? r : best))
      : null;
  });
}

/**
 * Frete por m³ sugerido para um destino: mediana, entre os portos de origem,
 * do menor custo por container ÷ capacidade útil do container. É a mesma
 * conta "por m³" que o portal já usa quando a companhia não informou o frete.
 */
export function perCbmSuggestion(
  data: FreightTariffData,
  destinationCode: string,
  capacityCbm: number,
): { perCbm: number; ports: number; containerBrl: number } | null {
  const dest = data.destinations.find((d) => d.code === destinationCode);
  if (!dest || !(capacityCbm > 0)) return null;
  const totals = cheapestByOrigin(dest)
    .filter((r): r is TariffRate => r !== null)
    .map((r) => r.totalBrl / Math.max(1, dest.containerQty))
    .sort((a, b) => a - b);
  if (!totals.length || !totals.every(Number.isFinite)) return null;
  const mid = Math.floor(totals.length / 2);
  const median =
    totals.length % 2 ? totals[mid] : (totals[mid - 1] + totals[mid]) / 2;
  return {
    perCbm: round(median / capacityCbm),
    ports: totals.length,
    containerBrl: round(median),
  };
}

/** Nomes chineses dos portos (o fornecedor costuma escrever o local em chinês). */
const CHINESE_PORTS: Array<[string, string]> = [
  ["连云港", "lianyungang"],
  ["宁波", "ningbo"],
  ["上海", "shanghai"],
  ["深圳", "shenzhen"],
  ["青岛", "qingdao"],
  ["广州", "guangzhou"],
  ["厦门", "xiamen"],
  ["天津", "tianjin"],
  ["香港", "hong kong"],
  ["汕头", "shantou"],
  ["南京", "nanjing"],
  ["南通", "nantong"],
  ["重庆", "chongqing"],
  ["江门", "jiangmen"],
  ["南沙", "nansha"],
  ["蛇口", "shekou"],
  ["盐田", "yantian"],
  ["新港", "xingang"],
  ["大连", "dalian"],
];

/** Palavras que, logo depois do nome, dizem que não é a cidade: rua ou prédio. */
const NOT_CITY_WORDS = new Set([
  "road",
  "rd",
  "street",
  "st",
  "lu",
  "avenue",
  "ave",
  "av",
  "rua",
  "jie",
  "dao",
  "plaza",
  "building",
  "bldg",
  "center",
  "centre",
  "tower",
  "hotel",
  "garden",
  "gardens",
  "mansion",
  "square",
  "mall",
]);
/** Direção entre o nome e "rua" ("Nanjing Dong Lu", "Zhongshan Road East"). */
const DIRECTION_WORDS = new Set([
  "dong",
  "xi",
  "nan",
  "bei",
  "zhong",
  "east",
  "west",
  "north",
  "south",
  "middle",
  "central",
]);
/** Final colado ao nome em grafia latina ("NingboCity", "Xiamenshi"). */
const LATIN_SUFFIXES = new Set([
  "shi",
  "city",
  "port",
  "qu",
  "xian",
  "gang",
  "zhen",
  "beilun",
]);
/** Depois do nome chinês: rua (南京西路, 重庆道, 上海大街, 东一路) ou prédio (香港广场). */
const CJK_NOT_CITY =
  /^(?:[东西南北中]?[一二三四五六七八九十]?(?:路|大街|街|大道|道|巷|弄)|广场|大厦|大楼|中心(?![区城])|花园|宾馆|大酒店|酒店|商会|商城|城(?![区口市隍墙]))/;
/** Antes do nome: outro lugar que termina no 1º caractere (长江门窗, 河南通许). */
const CJK_GLUED_BEFORE: Record<string, RegExp> = {
  江门: /[浙湖龙晋湛吴镇九长珠阳内丽]$/,
  南通: /[河云海湖济]$/,
  南京: /[河云海湖济]$/,
  南沙: /[河云海湖济]$/,
};
/** Depois do nome: palavra com o último caractere (江 + 门窗, 门业, 门诊). */
const CJK_GLUED_AFTER: Record<string, RegExp> = {
  江门: /^(?:[窗业诊票店面户锁扇框]|口(?!岸))/,
};
const CJK_PORT_RE = new RegExp(
  CHINESE_PORTS.map(([zh]) => zh)
    .sort((a, b) => b.length - a.length)
    .join("|"),
  "g",
);
const CJK_PORT_NAME = new Map(CHINESE_PORTS);
/** Portos que são distritos de outra cidade-porto (广州市南沙区 → NANSHA). */
const SUB_PORTS: Record<string, string[]> = {
  guangzhou: ["nansha", "huangpu"],
  shenzhen: ["yantian", "shekou"],
  tianjin: ["xingang"],
};

interface OriginHit {
  name: string;
  at: number;
  len: number;
}

/**
 * Porto de origem do tarifário citado no texto (ex.: "Ningbo, Zhejiang",
 * "浙江宁波", "Ning Bo" → NINGBO). Nome de rua ou de prédio não conta
 * ("南京西路", "Nanjing Dong Lu", "香港广场", "Shanghai Hotel").
 * Em texto latino vale o último porto citado (a cidade vem depois da rua);
 * em chinês, o porto dito com 港 ou, sem ele, o primeiro (a cidade vem antes
 * do bairro e da rua). Distrito-porto da cidade citado no texto ganha dela
 * (广州市南沙区 e "Nansha District, Guangzhou" → NANSHA).
 */
export function matchOrigin(
  data: FreightTariffData,
  text: string | null,
): string | null {
  if (!text) return null;
  // Uma passada só no texto original: um nome não atrapalha a leitura do outro.
  const raw = text
    .slice(0, 300)
    .replace(CJK_PORT_RE, (zh, offset: number, whole: string) => {
      const before = whole.slice(Math.max(0, offset - 2), offset);
      const after = whole.slice(offset + zh.length, offset + zh.length + 4);
      if (
        CJK_GLUED_BEFORE[zh]?.test(before) ||
        CJK_GLUED_AFTER[zh]?.test(after)
      )
        return zh;
      const en = CJK_PORT_NAME.get(zh) ?? "";
      // "cjkx" marca o nome que veio do chinês (a regra de ordem é outra);
      // "cjkport", o nome seguido de 港 (porto dito com todas as letras).
      if (CJK_NOT_CITY.test(after)) return ` ${en} road `;
      return ` cjkx ${en} ${after.startsWith("港") ? "cjkport " : ""}`;
    });
  const hay = ` ${foldName(raw)} `;
  if (!hay.trim()) return null;
  const latin: OriginHit[] = [];
  const cjk: OriginHit[] = [];
  for (const d of data.destinations)
    for (const o of d.origins) {
      const key = foldName(o.name);
      if (!key) continue;
      let from = 0;
      for (;;) {
        const at = hay.indexOf(` ${key} `, from);
        if (at < 0) break;
        from = at + 1;
        const after = hay.slice(at + key.length + 2).split(" ");
        const notCity =
          NOT_CITY_WORDS.has(after[0]) ||
          (DIRECTION_WORDS.has(after[0]) && NOT_CITY_WORDS.has(after[1]));
        if (notCity) continue;
        const hit = { name: o.name, at, len: key.length };
        (hay.slice(Math.max(0, at - 5), at) === " cjkx" ? cjk : latin).push(
          hit,
        );
      }
    }
  if (latin.length || cjk.length) {
    // Cidade: em texto latino, a última; em chinês, o porto dito com 港 (o
    // último) ou a primeira cidade.
    const ported = cjk.filter((h) =>
      hay.startsWith(" cjkport ", h.at + h.len + 1),
    );
    const city = latin.length
      ? latin.reduce((a, b) =>
          b.at > a.at || (b.at === a.at && b.len > a.len) ? b : a,
        )
      : ported.length
        ? ported.reduce((a, b) => (b.at > a.at ? b : a))
        : cjk.reduce((a, b) =>
            b.at < a.at || (b.at === a.at && b.len > a.len) ? b : a,
          );
    // Distrito-porto da cidade citado em qualquer lugar e escrita
    // ("Nansha District, Guangzhou", "Guangzhou 广州市南沙区").
    const subs = SUB_PORTS[foldName(city.name)] ?? [];
    const sub = [...latin, ...cjk]
      .filter((h) => subs.includes(foldName(h.name)))
      .sort((a, b) => b.at - a.at)[0];
    return (sub ?? city).name;
  }
  // Com espaço a mais ou a menos ("Ning Bo", "HongKong", "NingboCity"): só
  // palavras inteiras ("Nanshan" não é "Nansha").
  const tokens = hay.trim().split(" ");
  let loose: { name: string; len: number } | null = null;
  for (const d of data.destinations)
    for (const o of d.origins) {
      const key = foldName(o.name);
      // Nome que aparece inteiro já foi julgado acima (era rua ou prédio).
      if (hay.includes(` ${key} `)) continue;
      const k = key.replace(/ /g, "");
      if (k.length < 5 || (loose && k.length <= loose.len)) continue;
      found: for (let i = 0; i < tokens.length; i++) {
        let joined = "";
        for (let n = i; n < Math.min(tokens.length, i + 3); n++) {
          joined += tokens[n];
          if (
            joined === k ||
            (joined.startsWith(k) && LATIN_SUFFIXES.has(joined.slice(k.length)))
          ) {
            loose = { name: o.name, len: k.length };
            break found;
          }
          if (joined.length >= k.length + 6) break;
        }
      }
    }
  return loose?.name ?? null;
}

/** Portos de origem com tarifa (para escolher à mão quando o local não bate). */
export function originsWithRates(data: FreightTariffData): string[] {
  const out = new Map<string, string>();
  for (const d of data.destinations)
    for (const r of d.rates) {
      const name = d.origins[r.origin].name;
      out.set(foldName(name), name);
    }
  return [...out.values()].sort((a, b) => a.localeCompare(b));
}

/** Opções de frete de uma origem para todos os destinos, da mais barata para a mais cara. */
export function optionsForOrigin(
  data: FreightTariffData,
  origin: string,
): TariffOption[] {
  const key = foldName(origin);
  const out: TariffOption[] = [];
  for (const d of data.destinations)
    d.origins.forEach((o, oi) => {
      if (foldName(o.name) !== key) return;
      for (const r of d.rates.filter((x) => x.origin === oi)) {
        const f = d.forwarders[r.forwarder];
        out.push({
          destination: d.name,
          destinationCode: d.code,
          origin: o.name,
          forwarder: f.name,
          route: r.route,
          oceanUsd: r.oceanUsd,
          totalBrl: r.totalBrl,
          paymentTermDays: f.paymentTermDays,
          containerQty: d.containerQty,
          shippingLineId: f.shippingLineId ?? null,
          company: f.company ?? null,
        });
      }
    });
  // Mais barato por container (abas podem ter quantidades diferentes).
  return out.sort(
    (a, b) =>
      a.totalBrl / Math.max(1, a.containerQty) -
      b.totalBrl / Math.max(1, b.containerQty),
  );
}

/** Quantas tarifas e agentes o tarifário tem. */
export function tariffCounts(data: FreightTariffData) {
  const names = new Set<string>();
  let rates = 0;
  for (const d of data.destinations) {
    rates += d.rates.length;
    for (const r of d.rates) {
      const f = d.forwarders[r.forwarder];
      names.add(`${f.shippingLineId ?? ""}|${foldName(f.name)}`);
    }
  }
  return {
    rates,
    forwarders: names.size,
    destinations: data.destinations.length,
  };
}

/* ------------------------------------------------------------------------ */
/* Comparativo: as planilhas de todas as companhias juntas                   */
/* ------------------------------------------------------------------------ */

/**
 * O bloco da planilha é da companhia do cadastro? Mesmo nome, o bloco começa
 * com ele ("ROYAL CARGO - MSC" é da "Royal Cargo"), ou o nome do cadastro
 * começa com o do agente no bloco (antes do armador): "SCAN GLOBAL -MSC" é
 * da "Scan Global Logística"; "NEXT SHIPPING", da "Next Shipping Agência
 * Marítima". Nome curto demais (menos de 3 letras) não vale; o armador
 * depois do traço não conta ("SCAN GLOBAL -MSC" não é da "MSC").
 */
export function blockOfCompany(block: string, company: string | null): boolean {
  const c = companyKey(company);
  if (c.length < 3) return false;
  const k = foldName(block);
  if (k === c || k.startsWith(`${c} `)) return true;
  // Separador com espaço de um dos lados: "SINO-TRANS" é um nome só.
  const agent = companyKey(block.split(BLOCK_CARRIER)[0] ?? "");
  return agent.length >= 3 && (agent === c || c.startsWith(`${agent} `));
}

/** Traço (ou "+", "/", "|") entre o agente e o armador no nome do bloco. */
const BLOCK_CARRIER = /\s+[-\u2013\u2014+/|]\s*|\s*[-\u2013\u2014+/|]\s+/;

/** Final de razão social que não faz parte do nome ("Beta Cargo Ltda" → "beta cargo"). */
const LEGAL_SUFFIX =
  /(?:\s+(?:ltda|limitada|s\s?a|sa|eireli|me|epp|inc|llc|ltd|co|corp|gmbh|do brasil|brasil))+$/;

/** Nome da companhia do cadastro, sem a razão social, para comparar com o bloco. */
function companyKey(company: string | null): string {
  return foldName(company ?? "")
    .replace(LEGAL_SUFFIX, "")
    .trim();
}

/** Nomes dos blocos (companhias) com tarifa na planilha, sem repetir. */
export function blocksWithRates(data: FreightTariffData): string[] {
  const out = new Map<string, string>();
  for (const d of data.destinations)
    for (const r of d.rates) {
      const name = d.forwarders[r.forwarder]?.name;
      if (name) out.set(foldName(name), name);
    }
  return [...out.values()];
}

/** Uma planilha vigente: de uma companhia (enviada por ela ou pela Wellmix) ou a consolidada. */
export interface TariffSource {
  id: string;
  referenceDate: string;
  createdAt: string;
  /** Companhia dona das tarifas; null = planilha consolidada (várias companhias). */
  shippingLineId: string | null;
  /** Nome da companhia no cadastro (null na consolidada). */
  company: string | null;
  /** Importada pela Wellmix (dá os parâmetros do comparativo). */
  byWellmix: boolean;
  data: FreightTariffData;
}

/**
 * Junta as planilhas vigentes num tarifário só (o comparativo da Wellmix):
 * - a planilha de cada companhia entra inteira (só a mais nova de cada uma);
 * - da consolidada, só as companhias que ainda não mandaram a própria (mesmo
 *   nome de bloco, ou o bloco começa com o nome da companhia no cadastro);
 * - um câmbio, um frete até o CD e uma quantidade de containers por destino
 *   para todos (senão os totais não se comparam): o câmbio é o dólar do dia
 *   do portal (`fx`), se houver; o resto vem da planilha mais nova importada
 *   pela Wellmix (sem ela, da mais nova).
 * Códigos do Sankhya que faltam numa planilha (CODPARC, ID do porto) vêm de
 * outra que tenha o mesmo nome. Sem planilha com tarifa: null.
 */
export function mergeTariffs(
  sources: TariffSource[],
  options: { fx?: number | null } = {},
): FreightTariffData | null {
  const newest = (a: TariffSource, b: TariffSource) =>
    b.createdAt.localeCompare(a.createdAt);
  const own = new Map<string, TariffSource>();
  for (const s of [...sources].sort(newest))
    if (s.shippingLineId && !own.has(s.shippingLineId))
      own.set(s.shippingLineId, s);
  const consolidated = [...sources].sort(newest).find((s) => !s.shippingLineId);
  const companies = [...own.values()];

  // Blocos da consolidada que a própria companhia já substituiu.
  // Só blocos com o nome da própria companhia substituem os da consolidada:
  // a planilha de uma companhia nunca tira (nem imita) o preço de outra.
  const ownBlocks = new Set<string>();
  for (const s of companies)
    for (const d of s.data.destinations)
      for (const r of d.rates) {
        const name = d.forwarders[r.forwarder].name;
        if (blockOfCompany(name, s.company)) ownBlocks.add(foldName(name));
      }
  const replaced = (name: string) =>
    ownBlocks.has(foldName(name)) ||
    companies.some((s) => blockOfCompany(name, s.company));

  // Ordem: a consolidada (ordem das abas do modelo), depois as companhias.
  const ordered = [
    ...(consolidated ? [consolidated] : []),
    ...companies.sort(
      (a, b) =>
        (a.company ?? "").localeCompare(b.company ?? "") ||
        a.id.localeCompare(b.id),
    ),
  ];
  if (!ordered.length) return null;

  // Códigos do Sankhya (pelo nome) só das planilhas importadas pela Wellmix:
  // a abas FORNECEDORES/PORTOS de uma companhia não valem para o CSV.
  const forwarderCode = new Map<string, string>();
  const portIdByName = new Map<string, number>();
  for (const s of ordered.filter((x) => x.byWellmix))
    for (const d of s.data.destinations) {
      for (const f of d.forwarders)
        if (f.code && !forwarderCode.has(foldName(f.name)))
          forwarderCode.set(foldName(f.name), f.code);
      for (const o of d.origins)
        if (o.portId !== null && !portIdByName.has(foldName(o.name)))
          portIdByName.set(foldName(o.name), o.portId);
      if (d.portId !== null && !portIdByName.has(`dest:${d.code}`))
        portIdByName.set(`dest:${d.code}`, d.portId);
    }

  // Parâmetros de cada destino: da planilha mais nova da Wellmix que o tem.
  const byParams = [...ordered].sort(
    (a, b) => Number(b.byWellmix) - Number(a.byWellmix) || newest(a, b),
  );
  const validFx = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
  const portalFx = validFx(options.fx);
  // Spread da planilha mais nova da Wellmix (o da companhia não vale).
  const spreadOf = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1 ? v : 0;
  const spread = spreadOf(byParams.find((x) => x.byWellmix)?.data.fxSpread);

  const merged = new Map<string, TariffDestination>();
  const originIndex = new Map<string, Map<string, number>>();
  for (const s of ordered) {
    for (const d of s.data.destinations) {
      let dest = merged.get(d.code);
      if (!dest) {
        const params =
          byParams
            .map((x) => x.data.destinations.find((y) => y.code === d.code))
            .find(Boolean) ?? d;
        dest = {
          sheet: d.sheet,
          code: d.code,
          name: d.name,
          portId:
            (s.byWellmix ? d.portId : null) ??
            portIdByName.get(`dest:${d.code}`) ??
            DESTINATION_IDS[d.code] ??
            null,
          // Dólar do dia + o spread da planilha da Wellmix (sem o dólar, o câmbio dela).
          fx: portalFx !== null ? portalFx + spread : params.fx,
          roadFreightBrl: params.roadFreightBrl,
          containerQty: params.containerQty,
          forwarders: [],
          origins: [],
          rates: [],
        };
        merged.set(d.code, dest);
        originIndex.set(d.code, new Map());
      }
      const origins = originIndex.get(d.code)!;
      const target = dest;
      // Companhias desta planilha que entram (com tarifa e não substituídas).
      const kept = d.forwarders
        .map((f, fi) => ({ f, fi }))
        .filter(
          ({ f, fi }) =>
            d.rates.some((r) => r.forwarder === fi) &&
            !(!s.shippingLineId && replaced(f.name)),
        );
      if (!kept.length) continue;
      const keptIndex = new Map<number, number>();
      for (const { f, fi } of kept) {
        keptIndex.set(fi, target.forwarders.length);
        // Código: o da própria planilha só se a Wellmix importou; pelo nome,
        // só para bloco que é da companhia (nunca o código de outra).
        const mine =
          s.byWellmix || !s.shippingLineId || blockOfCompany(f.name, s.company);
        target.forwarders.push({
          ...f,
          fees: f.fees.map((x) => ({ ...x })),
          code:
            (s.byWellmix ? f.code : null) ??
            (mine ? forwarderCode.get(foldName(f.name)) : undefined) ??
            null,
          shippingLineId: s.shippingLineId,
          company: s.company,
          tariffId: s.id,
          referenceDate: s.referenceDate,
        });
      }
      // Portos na ordem da planilha (o CSV do Sankhya sai na mesma ordem da macro).
      const originMap = new Map<number, number>();
      d.origins.forEach((o, oi) => {
        if (!d.rates.some((r) => r.origin === oi && keptIndex.has(r.forwarder)))
          return;
        const key = foldName(o.name);
        let at = origins.get(key);
        if (at === undefined) {
          at = target.origins.length;
          origins.set(key, at);
          target.origins.push({
            country: o.country,
            name: o.name,
            portId:
              (s.byWellmix ? o.portId : null) ?? portIdByName.get(key) ?? null,
          });
        } else {
          const known = target.origins[at];
          known.country ??= o.country;
          if (known.portId === null)
            known.portId =
              (s.byWellmix ? o.portId : null) ?? portIdByName.get(key) ?? null;
        }
        originMap.set(oi, at);
      });
      for (const r of d.rates) {
        const fi = keptIndex.get(r.forwarder);
        const oi = originMap.get(r.origin);
        if (fi === undefined || oi === undefined) continue;
        target.rates.push({ ...r, origin: oi, forwarder: fi });
      }
    }
  }
  const destinations = [...merged.values()].filter((d) => d.rates.length);
  if (!destinations.length) return null;
  for (const d of destinations) recomputeTotals(d);

  // Conferência do comparativo: o que fica fora do CSV do Sankhya.
  const warnings: TariffWarning[] = [];
  const noCode = new Set<string>();
  const noId = new Set<string>();
  for (const d of destinations) {
    if (d.portId === null) noId.add(d.name);
    for (const r of d.rates) {
      const f = d.forwarders[r.forwarder];
      if (!f.code) noCode.add(f.name);
      if (d.origins[r.origin].portId === null)
        noId.add(d.origins[r.origin].name);
    }
  }
  // O que a conferência da própria planilha já aponta não se repete aqui.
  const already = new Set<string>();
  for (const s of ordered)
    for (const w of s.data.warnings ?? []) {
      if (w.code === "forwarder_no_code")
        already.add(`f:${String(w.params.forwarder)}`);
      if (w.code === "port_no_id" || w.code === "port_no_id_similar")
        already.add(`p:${String(w.params.port)}`);
    }
  for (const name of noCode)
    if (!already.has(`f:${name}`))
      warnings.push({ code: "forwarder_no_code", params: { forwarder: name } });
  for (const name of noId)
    if (!already.has(`p:${name}`))
      warnings.push({ code: "port_no_id", params: { port: name } });
  const first = destinations[0];
  const data: FreightTariffData = {
    version: 1,
    fx: first.fx,
    fxBase: null,
    fxSpread: null,
    roadFreightBrl: first.roadFreightBrl,
    containerQty: first.containerQty,
    destinations,
    warnings,
    fxSource: portalFx ? "portal" : "sheet",
  };
  const seen = new Map<string, number>();
  for (const r of sankhyaRows(data, "2000-01-01"))
    seen.set(r.externalId, (seen.get(r.externalId) ?? 0) + 1);
  const repeated = [...seen.values()].filter((n) => n > 1).length;
  if (repeated)
    warnings.push({ code: "sankhya_duplicate_ids", params: { n: repeated } });
  return data;
}
