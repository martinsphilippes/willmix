import "server-only";
import type { Party, Product, ProductLine } from "@/lib/db";
import { executeQuery } from "./sankhya-client";
import { partnerValues, productValues } from "./sankhya-sync";
import { buildTestNote, type SankhyaErpSettings } from "./sankhya-settings";

/*
 * O que o Sankhya exige para incluir cada entidade que o portal cria lá
 * (Parceiro, Produto, Cabeçalho e Item da nota), comparado com o que o portal
 * envia. "Exige" = coluna NOT NULL sem valor padrão no banco do ERP, lida do
 * catálogo do banco (SQL Server: INFORMATION_SCHEMA; Oracle: ALL_TAB_COLUMNS).
 * O Sankhya ainda preenche algumas pelo dicionário dele ao incluir; o teste
 * de inclusão (parte 5 da Integração) é a prova final.
 */

export type RequiredStatus = "portal" | "fixed" | "generated" | "missing";

export interface RequiredRow {
  column: string;
  status: RequiredStatus;
}

export interface RequiredCheck {
  table: string;
  entity: string;
  /** De onde veio a lista (catálogo do banco) ou o erro. */
  source: string | null;
  error: string | null;
  rows: RequiredRow[];
}

const TABLES = [
  { table: "TGFPAR", entity: "Parceiro", generated: ["CODPARC"] },
  { table: "TGFPRO", entity: "Produto", generated: ["CODPROD"] },
  { table: "TGFCAB", entity: "CabecalhoNota", generated: ["NUNOTA"] },
  { table: "TGFITE", entity: "ItemNota", generated: ["NUNOTA", "SEQUENCIA"] },
] as const;

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
          source,
          error: null,
          rows: columns.map((column) => ({
            column,
            status: (t.generated as readonly string[]).includes(column)
              ? "generated"
              : p.portal.has(column)
                ? "portal"
                : p.fixed.has(column)
                  ? "fixed"
                  : "missing",
          })) as RequiredRow[],
        };
      } catch (error) {
        const e = error as { detail?: string; message?: string };
        return {
          table: t.table,
          entity: t.entity,
          source: null,
          error: String(e.detail ?? e.message ?? error).slice(0, 400),
          rows: [],
        };
      }
    }),
  );
}
