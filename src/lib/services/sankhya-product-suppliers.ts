import "server-only";
import { executeQuery } from "@/lib/integrations/sankhya-client";
import { PRODUCT_VIEW } from "@/lib/integrations/sankhya-views";

/*
 * Fornecedor de cada produto no Sankhya (TGFPRO.CODPARCFORN), lido pela API
 * (dono, 15/11/2026; docs/ORDER_TERMS.md seção 3.2): a carga trouxe só
 * CODPROD, CODVOL e o grupo da maioria dos produtos, e sem o fornecedor o
 * produto fica sem país de origem (e não é vendido). Até a carga gravar o
 * fornecedor no banco, o país sai daqui: CODPROD → CODPARCFORN, em páginas
 * pelo código do produto, guardado por 30 minutos por instância. Sem o
 * Sankhya (ou com erro), um mapa vazio: esses produtos seguem sem país.
 */

const TTL_MS = 30 * 60 * 1000;
const RETRY_MS = 2 * 60 * 1000;
const PAGE = 2000;
/** Teto de páginas por leitura (40 mil produtos). */
const MAX_PAGES = 20;

let cached: { at: number; map: Map<string, string> } | null = null;
let pending: Promise<Map<string, string>> | null = null;

/** Para testes: esquece o mapa. */
export function resetSankhyaProductSuppliers() {
  cached = null;
  pending = null;
}

export const productSuppliersSql = (after: number) =>
  `SELECT TOP ${PAGE} CODPROD, CODPARCFORN FROM TGFPRO WHERE CODPARCFORN > 0 AND CODPROD > ${Math.max(0, Math.floor(after))} ORDER BY CODPROD`;

/**
 * O mesmo pela VW_AD_PRODUTO_WELL (fornecedor principal; 20/11/2026), com os
 * nomes da TGFPRO. A TGFPRO se a view falhar.
 */
export const productSuppliersViewSql = (after: number) =>
  `SELECT TOP ${PAGE} V.COD_PRODUTO AS CODPROD, V.COD_FORNECEDOR_PRINCIPAL AS CODPARCFORN FROM ${PRODUCT_VIEW} V WHERE V.COD_FORNECEDOR_PRINCIPAL > 0 AND V.COD_PRODUTO > ${Math.max(0, Math.floor(after))} ORDER BY V.COD_PRODUTO`;

async function page(after: number, view: boolean) {
  return executeQuery(
    view ? productSuppliersViewSql(after) : productSuppliersSql(after),
  );
}

async function load(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let after = 0;
  let view = true;
  for (let page_ = 0; page_ < MAX_PAGES; page_++) {
    let rows;
    try {
      ({ rows } = await page(after, view));
    } catch (error) {
      if (!view || page_ > 0) throw error;
      view = false;
      ({ rows } = await page(after, view));
    }
    for (const row of rows) {
      const prod = Number(row.CODPROD);
      const forn = Number(row.CODPARCFORN);
      if (Number.isSafeInteger(prod) && Number.isSafeInteger(forn) && forn > 0)
        map.set(String(prod), String(forn));
      if (Number.isSafeInteger(prod) && prod > after) after = prod;
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

/** CODPROD → CODPARCFORN do Sankhya (vazio sem o Sankhya ou com erro). */
export async function sankhyaProductSuppliers(): Promise<Map<string, string>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map;
  pending ??= load()
    .catch((error) => {
      const code = (error as { code?: string }).code;
      if (code !== "sankhya_not_configured")
        console.error("[origin] fornecedores dos produtos no Sankhya", error);
      return new Map<string, string>();
    })
    .finally(() => {
      pending = null;
    });
  const map = await pending;
  // Vazio (Sankhya fora do ar ou sem configuração): tenta de novo em 2 minutos.
  cached = { at: map.size ? Date.now() : Date.now() - TTL_MS + RETRY_MS, map };
  return map;
}
