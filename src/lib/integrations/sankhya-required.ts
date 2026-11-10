import "server-only";
import type { Party, Product, ProductLine } from "@/lib/db";
import { executeQuery } from "./sankhya-client";
import { partnerValues, productValues } from "./sankhya-sync";
import { buildTestNote, type SankhyaErpSettings } from "./sankhya-settings";

/*
 * O que o Sankhya exige para incluir cada entidade da integração, comparado
 * com o que o portal envia (as que o portal inclui: Parceiro, Produto,
 * Cabeçalho e Item da nota = pedido/cotação) ou com o que o portal tem (as
 * que o portal só lê: grupos, condições de pagamento, locais, estoque e
 * financeiro). "Exige" = coluna NOT NULL sem valor padrão no banco do ERP, lida do
 * catálogo do banco (SQL Server: INFORMATION_SCHEMA; Oracle: ALL_TAB_COLUMNS).
 * O Sankhya ainda preenche algumas pelo dicionário dele ao incluir; o teste
 * de inclusão (parte 5 da Integração) é a prova final.
 */

export type RequiredStatus =
  "portal" | "fixed" | "generated" | "auto" | "missing";

export interface RequiredRow {
  column: string;
  status: RequiredStatus;
}

export interface RequiredCheck {
  table: string;
  entity: string;
  /** create = o portal inclui no Sankhya; read = só lê (decisão da Wellmix). */
  mode: "create" | "read";
  /** De onde veio a lista (catálogo do banco) ou o erro. */
  source: string | null;
  error: string | null;
  rows: RequiredRow[];
}

const TABLES: Array<{
  table: string;
  entity: string;
  mode: "create" | "read";
  generated: string[];
}> = [
  {
    table: "TGFPAR",
    entity: "Parceiro",
    mode: "create",
    generated: ["CODPARC"],
  },
  {
    table: "TGFPRO",
    entity: "Produto",
    mode: "create",
    generated: ["CODPROD"],
  },
  {
    table: "TGFCAB",
    entity: "CabecalhoNota",
    mode: "create",
    generated: ["NUNOTA"],
  },
  {
    table: "TGFITE",
    entity: "ItemNota",
    mode: "create",
    generated: ["NUNOTA", "SEQUENCIA"],
  },
  { table: "TGFGRU", entity: "GrupoProduto", mode: "read", generated: [] },
  { table: "TGFTPV", entity: "TipoNegociacao", mode: "read", generated: [] },
  { table: "TGFLOC", entity: "LocalEstoque", mode: "read", generated: [] },
  { table: "TGFEST", entity: "Estoque", mode: "read", generated: [] },
  { table: "TGFFIN", entity: "Financeiro", mode: "read", generated: ["NUFIN"] },
];

/**
 * Preenchidas pelo próprio Sankhya ao incluir (datas de controle e a versão
 * da TOP). O pedido de teste (parte 5) é a prova.
 */
const AUTO = new Set(["DTALTER", "DTCAD", "DHTIPOPER", "DHALTER"]);

/** Colunas NOT NULL sem padrão: tenta SQL Server e depois Oracle. */
async function requiredColumns(
  table: string,
): Promise<{ columns: string[]; source: string }> {
  const attempts = [
    {
      source: "INFORMATION_SCHEMA.COLUMNS (SQL Server)",
      sql: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND IS_NULLABLE = 'NO' AND COLUMN_DEFAULT IS NULL`,
    },
    {
      source: "ALL_TAB_COLUMNS (Oracle)",
      sql: `SELECT DISTINCT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = '${table}' AND NULLABLE = 'N' AND (DEFAULT_LENGTH IS NULL OR DEFAULT_LENGTH = 0)`,
    },
  ];
  let last: unknown = null;
  for (const a of attempts) {
    try {
      const result = await executeQuery(a.sql);
      const columns = [
        ...new Set(
          result.rows
            .map((r) => String(r.COLUMN_NAME ?? "").toUpperCase())
            .filter(Boolean),
        ),
      ].sort();
      if (columns.length) return { columns, source: a.source };
    } catch (error) {
      last = error;
    }
  }
  throw last ?? new Error("catálogo do banco vazio ou sem permissão");
}

/** Chaves que o portal envia ao incluir (com um cadastro completo de exemplo). */
export function providedKeys(erp: SankhyaErpSettings) {
  const party = {
    name: "X",
    legalName: "X",
    taxId: "00000000000191",
    email: "x@x",
    phone: "1",
    active: true,
    type: "supplier",
    personType: "J",
    stateRegistration: "1",
    sankhyaRefs: {
      CODCID: 1,
      CODEND: 1,
      CODBAI: 1,
      NUMEND: "1",
      COMPLEMENTO: "1",
      CEP: "1",
    },
  } as unknown as Party;
  const product = {
    name: "X",
    sku: "X",
    ean: "1",
    ncm: "1",
    brand: "X",
    grossWeightKg: 1,
    netWeightKg: 1,
    heightCm: 1,
    widthCm: 1,
    lengthCm: 1,
    active: true,
  } as unknown as Product;
  const line = { sankhyaCode: "1" } as unknown as ProductLine;
  const note = buildTestNote(erp, {
    kind: "order",
    codParc: 1,
    codProd: 1,
    quantity: 1,
    unitPrice: 1,
    tipMov: "O",
    date: "01/01/2026",
  });
  const keys = (o: Record<string, unknown>) =>
    Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k.toUpperCase());
  const fixedPartner = new Set(keys(erp.partnerDefaults ?? {}));
  const fixedProduct = new Set(keys(erp.productDefaults ?? {}));
  return {
    TGFPAR: {
      portal: new Set(keys(partnerValues(party, erp, "create"))),
      fixed: fixedPartner,
    },
    TGFPRO: {
      portal: new Set(keys(productValues(product, line, erp, "create"))),
      fixed: fixedProduct,
    },
    // Cabeçalho: os códigos da Integração são valores fixos.
    TGFCAB: {
      portal: new Set([
        "CODPARC",
        "CODTIPOPER",
        "TIPMOV",
        "DTNEG",
        "OBSERVACAO",
        "VLRMOEDA",
        "CIF_FOB",
      ]),
      fixed: new Set(keys(note.header)),
    },
    TGFITE: {
      portal: new Set(keys(note.items[0] ?? {})),
      fixed: new Set<string>(),
    },
    // Só leitura: o que o portal tem (para um dia incluir, se a Wellmix pedir).
    TGFGRU: {
      portal: new Set(["CODGRUPOPROD", "DESCRGRUPOPROD", "ATIVO"]),
      fixed: new Set<string>(),
    },
    TGFTPV: {
      portal: new Set(["CODTIPVENDA", "DESCRTIPVENDA", "ATIVO"]),
      fixed: new Set<string>(),
    },
    TGFLOC: {
      portal: new Set(["CODLOCAL", "DESCRLOCAL", "ATIVO"]),
      fixed: new Set<string>(),
    },
    TGFEST: {
      portal: new Set(["CODEMP", "CODPROD", "CODLOCAL", "ESTOQUE"]),
      fixed: new Set<string>(),
    },
    TGFFIN: {
      portal: new Set([
        "NUNOTA",
        "CODEMP",
        "CODPARC",
        "RECDESP",
        "VLRDESDOB",
        "DTVENC",
        "CODTIPTIT",
        "CODNAT",
      ]),
      fixed: new Set<string>(),
    },
  } as Record<string, { portal: Set<string>; fixed: Set<string> }>;
}

export async function checkRequired(
  erp: SankhyaErpSettings,
): Promise<RequiredCheck[]> {
  const provided = providedKeys(erp);
  return Promise.all(
    TABLES.map(async (t) => {
      try {
        const { columns, source } = await requiredColumns(t.table);
        const p = provided[t.table];
        return {
          table: t.table,
          entity: t.entity,
          mode: t.mode,
          source,
          error: null,
          rows: columns.map((column) => ({
            column,
            status: t.generated.includes(column)
              ? "generated"
              : p.portal.has(column)
                ? "portal"
                : p.fixed.has(column)
                  ? "fixed"
                  : AUTO.has(column)
                    ? "auto"
                    : "missing",
          })) as RequiredRow[],
        };
      } catch (error) {
        const e = error as { detail?: string; message?: string };
        return {
          table: t.table,
          entity: t.entity,
          mode: t.mode,
          source: null,
          error: String(e.detail ?? e.message ?? error).slice(0, 400),
          rows: [],
        };
      }
    }),
  );
}
