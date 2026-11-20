import "server-only";

import { getStore, type User } from "@/lib/db";
import { canSeeMoney } from "@/lib/auth/function-access";
import { listColumns } from "@/lib/db/lookup";
import {
  executeQuery,
  type SankhyaClientOptions,
} from "@/lib/integrations/sankhya-client";
import { sankhyaDate } from "@/lib/integrations/sankhya-mapping";
import {
  estimateDemand,
  yearTotals,
  type DemandEstimate,
  type Purchase,
  type YearTotal,
} from "@/lib/purchase-forecast";
import { pieceFactor, volumesSql } from "./customer-sales";
import {
  customerCode,
  failure,
  sankhyaInt,
  type SankhyaHistoryResult,
} from "./sankhya-customer-history";

/*
 * Aba Análise do histórico de compras (dono, 19/11/2026;
 * docs/PURCHASE_HISTORY.md seção 12): as compras de um produto pelo cliente
 * no histórico inteiro, somando as empresas do grupo econômico dele, lidas
 * na hora no Sankhya (a mesma view do histórico), em peças (TGFVOA), e a
 * estimativa de demanda (src/lib/purchase-forecast.ts).
 */

const VIEW = "sankhya.VW_AD_PEDCLIENTE_ITEM_WELL";
/** Teto de dias de compra lidos (um produto, o histórico inteiro). */
const MAX_ROWS = 3000;
/** Teto de empresas do grupo na consulta. */
const MAX_COMPANIES = 300;

/** As compras do produto pelos clientes, somadas por dia e unidade. */
export function productPurchasesSql(
  customerCodes: number[],
  productCode: number,
): string {
  const codes = [
    ...new Set(customerCodes.map((c) => sankhyaInt(c)).filter(Boolean)),
  ];
  const product = sankhyaInt(productCode);
  if (!codes.length || !product) throw new Error("invalid_input");
  return [
    `SELECT TOP ${MAX_ROWS} CAST(DATA_PEDIDO AS DATE) AS DIA, UNIDADE_NEGOCIADA,`,
    "SUM(QTD_NEGOCIADA) AS QTD, SUM(VALOR_ITEM_APOS_DESCONTO_BRL) AS VALOR",
    `FROM ${VIEW} WHERE COD_CLIENTE IN (${codes.join(", ")}) AND CODPROD = ${product}`,
    "GROUP BY CAST(DATA_PEDIDO AS DATE), UNIDADE_NEGOCIADA",
    "ORDER BY DIA",
  ].join(" ");
}

export type PurchaseAnalysis = SankhyaHistoryResult<{
  product: { id: string; name: string; code: number };
  /** Empresas somadas (1 = só o cliente; mais = o grupo econômico). */
  companies: number;
  purchases: Purchase[];
  years: YearTotal[];
  estimate: DemandEstimate | null;
  /** Quem lê vê valores ("Ver valores e margem"). */
  money: boolean;
  /** Alguma unidade sem conversão para peças (somada como veio). */
  mixedUnits: boolean;
}>;

export async function productPurchaseAnalysis(
  user: User,
  partyId: string,
  productId: string,
  options: SankhyaClientOptions = {},
): Promise<PurchaseAnalysis | { state: "no_product_code" }> {
  const who = await customerCode(user, partyId);
  if (who.state !== "ok") return who;
  const store = getStore();
  const [party, product] = await Promise.all([
    store.get("parties", partyId),
    store.get("products", productId),
  ]);
  const productCode = sankhyaInt(product?.sankhyaCode);
  if (!product || !productCode) return { state: "no_product_code" };
  // O grupo econômico do cliente (docs/ECONOMIC_GROUPS.md): todas as lojas.
  const group = party?.economicGroupCode
    ? await listColumns(store, "parties", ["sankhyaCode"], {
        filter: {
          type: "customer",
          economicGroupCode: party.economicGroupCode,
        },
        limit: MAX_COMPANIES,
      })
    : [];
  const codes = [
    ...new Set(
      [who.code, ...group.map((g) => sankhyaInt(g.sankhyaCode))].filter(
        (c): c is number => !!c,
      ),
    ),
  ];
  try {
    const [rows, volumes] = await Promise.all([
      executeQuery(productPurchasesSql(codes, productCode), options),
      executeQuery(volumesSql([productCode]), options),
    ]);
    let mixedUnits = false;
    const money = canSeeMoney(user);
    const purchases: Purchase[] = [];
    for (const row of rows.rows) {
      const date = sankhyaDate(row.DIA);
      const qty = Number(String(row.QTD ?? "").replace(",", "."));
      if (!date || !Number.isFinite(qty) || qty <= 0) continue;
      const unit =
        row.UNIDADE_NEGOCIADA == null ? null : String(row.UNIDADE_NEGOCIADA);
      const factor = pieceFactor(unit, volumes.rows);
      if (factor === null) mixedUnits = true;
      const value = Number(String(row.VALOR ?? "").replace(",", "."));
      purchases.push({
        date,
        quantity: qty * (factor ?? 1),
        // Valor só com "Ver valores e margem" (a regra do histórico).
        value: money ? (Number.isFinite(value) ? value : 0) : null,
      });
    }
    return {
      state: "ok",
      product: {
        id: product.id,
        name: product.name ?? "",
        code: productCode,
      },
      companies: codes.length,
      purchases,
      years: yearTotals(purchases),
      money,
      estimate: estimateDemand(purchases),
      mixedUnits,
    };
  } catch (e) {
    return failure(e);
  }
}
