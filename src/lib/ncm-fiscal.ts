/*
 * Campos fiscais pelo NCM (dono, 27/11/2026; docs/PRODUCT_REGISTRATION.md,
 * seção "Campos fiscais pelo NCM"): ao incluir um produto no Sankhya, os
 * campos fiscais da TGFPRO que dependem do NCM vão com o valor que a maioria
 * dos produtos do Sankhya com o mesmo NCM tem, coluna por coluna (empate: o
 * do produto mais recente). Sem produto ativo com o NCM, valem os inativos;
 * sem nenhum, nada vai (ficam os valores fixos das Configurações).
 *
 * Puro: a consulta (SQL) e a escolha dos valores. A leitura no Sankhya fica
 * em src/lib/services/product-registration.ts.
 */

/**
 * As colunas da TGFPRO que dependem do NCM: IPI (situação tributária na
 * entrada e na saída, se tem IPI, a alíquota e o enquadramento legal),
 * ICMS (grupo, substituição tributária e CEST), PIS/COFINS (grupo e natureza
 * da receita) e a carga tributária média por NCM (IBPT). Ficam de fora as que
 * dependem do item e não do NCM: origem, "Usado como" e a exceção da TIPI.
 */
export const NCM_FISCAL_COLUMNS = [
  "CSTIPIENT",
  "CSTIPISAI",
  "TEMIPICOMPRA",
  "TEMIPIVENDA",
  "CODIPI",
  "CODENQIPIENT",
  "CODENQIPISAI",
  "GRUPOICMS",
  "GRUPOICMS2",
  "CLASSUBTRIB",
  "CODESPECST",
  "GRUPOPIS",
  "GRUPOCOFINS",
  "NATEFDCONTM410M810",
  "PERCCMTNAC",
  "PERCCMTIMP",
  "PERCCMTEST",
  "PERCCMTMUN",
  "PERCCMTFED",
] as const;

/** Quantos produtos do NCM são lidos (os mais recentes). */
export const NCM_FISCAL_SAMPLE = 300;

/** O NCM com os 8 dígitos (ou nulo, se não tiver 8). */
export function ncmDigits(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/** O NCM com os pontos (7009.92.00), como alguns cadastros antigos guardam. */
const dotted = (ncm: string) =>
  `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}`;

/**
 * A consulta dos produtos do NCM: as colunas pedidas, o ATIVO e o CODPROD,
 * dos mais recentes para os mais antigos. Só aceita o NCM com 8 dígitos e
 * colunas da lista (nada digitado entra no SQL).
 */
export function ncmFiscalQuery(
  ncm: string,
  columns: readonly string[] = NCM_FISCAL_COLUMNS,
): string {
  const digits = ncmDigits(ncm);
  if (!digits) throw new Error(`NCM inválido: ${ncm}`);
  const allowed = new Set<string>(NCM_FISCAL_COLUMNS);
  const cols = columns.filter((c) => allowed.has(c));
  if (!cols.length) throw new Error("nenhuma coluna fiscal");
  return [
    `SELECT TOP ${NCM_FISCAL_SAMPLE} CODPROD, ATIVO, ${cols.join(", ")}`,
    `FROM TGFPRO WHERE NCM IN ('${digits}', '${dotted(digits)}')`,
    "ORDER BY CODPROD DESC",
  ].join(" ");
}

export interface NcmFiscal {
  ncm: string;
  /** Produtos do Sankhya considerados. */
  products: number;
  /** Nenhum ativo com o NCM: valeram os inativos. */
  inactiveOnly: boolean;
  /** Coluna → valor escolhido (só as que algum produto tem preenchida). */
  values: Record<string, string>;
  /** Coluna → em quantos dos produtos o valor escolhido aparece. */
  counts: Record<string, number>;
}

/** Valor do Sankhya em texto (número com ponto, sem notação científica). */
function valueText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number")
    return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : null;
  const text = String(v).trim();
  return text ? text : null;
}

const codeOf = (row: Record<string, unknown>) => {
  const n = Number(row.CODPROD);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Os valores fiscais do NCM a partir das linhas da TGFPRO: por coluna, o
 * valor mais frequente entre os produtos (empate: o do produto mais recente,
 * maior CODPROD). Os ativos primeiro; sem ativo, todos.
 */
export function ncmFiscalFrom(
  ncm: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: readonly string[] = NCM_FISCAL_COLUMNS,
): NcmFiscal {
  const upper = rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toUpperCase(), v])),
  );
  const active = upper.filter((r) => valueText(r.ATIVO) === "S");
  const pool = (active.length ? active : upper)
    .slice()
    .sort((a, b) => codeOf(b) - codeOf(a));
  const values: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const column of columns) {
    // Contagem e a posição do primeiro (o mais recente) de cada valor.
    const seen = new Map<string, { count: number; first: number }>();
    pool.forEach((row, i) => {
      const v = valueText(row[column]);
      if (v === null) return;
      const hit = seen.get(v);
      if (hit) hit.count += 1;
      else seen.set(v, { count: 1, first: i });
    });
    let best: [string, { count: number; first: number }] | null = null;
    for (const entry of seen) {
      if (
        !best ||
        entry[1].count > best[1].count ||
        (entry[1].count === best[1].count && entry[1].first < best[1].first)
      )
        best = entry;
    }
    if (best) {
      values[column] = best[0];
      counts[column] = best[1].count;
    }
  }
  return {
    ncm: ncmDigits(ncm) ?? ncm,
    products: pool.length,
    inactiveOnly: pool.length > 0 && active.length === 0,
    values,
    counts,
  };
}

/** Resumo para o detalhe do envio: "fiscal do NCM 70099200 (12 produtos)". */
export function ncmFiscalNote(fiscal: NcmFiscal | null, ncm: string | null) {
  if (!ncm) return "sem NCM: campos fiscais só pelos valores fixos";
  if (!fiscal || !fiscal.products)
    return `nenhum produto com o NCM ${ncm} no Sankhya: campos fiscais só pelos valores fixos`;
  return `fiscal do NCM ${fiscal.ncm} (${fiscal.products} produto(s)${fiscal.inactiveOnly ? ", só inativos" : ""}): ${Object.entries(
    fiscal.values,
  )
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}`;
}

/** O SKU da Wellmix no REFFORN: "WX" + CODPROD (dono, 27/11/2026). */
export const wellmixSku = (codprod: string | number) =>
  `WX${String(codprod).trim()}`;
