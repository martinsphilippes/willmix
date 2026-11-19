import "server-only";
import { createHash } from "node:crypto";
import {
  getStore,
  type CustomerSalesLoad,
  type User,
} from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/permissions";
import {
  SankhyaError,
  executeQuery,
  type SankhyaClientOptions,
  type SankhyaRow,
} from "@/lib/integrations/sankhya-client";
import { sankhyaDate } from "@/lib/integrations/sankhya-mapping";
import { audit } from "./audit";
import { canManagePortfolio, followedCustomerIds } from "./portfolio";
import { sankhyaInt } from "./sankhya-customer-history";

/*
 * Base de vendas do Sankhya (dono, 19/11/2026; docs/TRADE_COMERCIAL.md, PR 3):
 * os pedidos de cada cliente acompanhado na carteira, somados por mês,
 * produto e unidade, pela mesma view do histórico da Nova solicitação
 * (`sankhya.VW_AD_PEDCLIENTE_ITEM_WELL`, docs/PURCHASE_HISTORY.md seção 9).
 * A caixa vira peças pelo volume do produto no Sankhya (TGFVOA). Carga
 * noturna (cron) e "Atualizar agora" de quem gere a carteira; o painel lê só
 * a base gravada, nunca o Sankhya na hora.
 */

const VIEW = "sankhya.VW_AD_PEDCLIENTE_ITEM_WELL";
/** Linhas por consulta (mês × produto × unidade). */
export const SALES_PAGE = 500;
/** Teto de consultas por cliente (50 mil linhas). */
const MAX_PAGES = 100;
/** Unidades que já são peças. */
export const PIECE_UNITS = new Set([
  "UN",
  "UND",
  "UNID",
  "PC",
  "PÇ",
  "PCA",
  "PÇA",
  "PEÇA",
  "PECA",
]);

/** As vendas do cliente por mês, produto e unidade, a partir do CODPROD. */
export function monthlySalesSql(codCliente: number, fromCode: number): string {
  const cod = sankhyaInt(codCliente);
  if (!cod) throw new Error("invalid_input");
  const from = Math.max(0, Math.trunc(fromCode));
  return [
    `SELECT TOP ${SALES_PAGE} CODPROD, YEAR(DATA_PEDIDO) AS ANO, MONTH(DATA_PEDIDO) AS MES,`,
    "UNIDADE_NEGOCIADA, MAX(DESCRICAO_PRODUTO) AS DESCRICAO_PRODUTO,",
    "SUM(QTD_NEGOCIADA) AS QTD, SUM(VALOR_ITEM_APOS_DESCONTO_BRL) AS VALOR,",
    "COUNT(DISTINCT NUNOTA) AS PEDIDOS, MAX(DATA_PEDIDO) AS ULTIMA",
    `FROM ${VIEW} WHERE COD_CLIENTE = ${cod} AND CODPROD >= ${from}`,
    "GROUP BY CODPROD, YEAR(DATA_PEDIDO), MONTH(DATA_PEDIDO), UNIDADE_NEGOCIADA",
    "ORDER BY CODPROD, ANO, MES, UNIDADE_NEGOCIADA",
  ].join(" ");
}

/** Volumes (caixas) dos produtos, para converter em peças. */
export function volumesSql(codes: number[]): string {
  const list = [...new Set(codes.map((c) => sankhyaInt(c)).filter(Boolean))];
  if (!list.length) throw new Error("invalid_input");
  return `SELECT CODPROD, CODVOL, QUANTIDADE, DIVIDEMULTIPLICA FROM TGFVOA WHERE CODPROD IN (${list.join(", ")})`;
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
const unitKey = (u: string | null) => (u ?? "").trim().toUpperCase();

/** Fator da unidade em peças pelo volume do Sankhya (nulo sem volume). */
export function pieceFactor(
  unit: string | null,
  volumes: readonly SankhyaRow[],
): number | null {
  const u = unitKey(unit);
  if (!u || PIECE_UNITS.has(u)) return 1;
  const v = volumes.find((r) => unitKey(text(r.CODVOL)) === u);
  const q = v ? num(v.QUANTIDADE) : null;
  if (!q || q <= 0) return null;
  return String(v?.DIVIDEMULTIPLICA ?? "M").toUpperCase() === "D" ? 1 / q : q;
}

/** Uma linha lida do Sankhya. */
export interface MonthlySale {
  productCode: string;
  month: string;
  unit: string | null;
  productName: string | null;
  quantity: number;
  valueBrl: number | null;
  orders: number;
  lastOrderDate: string | null;
}

export function toMonthlySale(row: SankhyaRow): MonthlySale | null {
  const code = sankhyaInt(row.CODPROD);
  const year = num(row.ANO);
  const month = num(row.MES);
  if (!code || !year || !month || month < 1 || month > 12) return null;
  return {
    productCode: String(code),
    month: `${year}-${String(month).padStart(2, "0")}`,
    unit: text(row.UNIDADE_NEGOCIADA),
    productName: text(row.DESCRICAO_PRODUTO),
    quantity: num(row.QTD) ?? 0,
    valueBrl: num(row.VALOR),
    orders: num(row.PEDIDOS) ?? 0,
    lastOrderDate: sankhyaDate(row.ULTIMA),
  };
}

/** Id fixo da linha (cliente, mês, produto e unidade): gravar de novo substitui. */
export function saleRowId(
  customerId: string,
  s: Pick<MonthlySale, "month" | "productCode" | "unit">,
): string {
  const hash = createHash("sha1")
    .update(`${customerId}|${s.month}|${s.productCode}|${unitKey(s.unit)}`)
    .digest("hex")
    .slice(0, 32);
  return `cs${hash}`;
}

/**
 * Lê todas as linhas do cliente, em páginas pelo CODPROD. Página cheia: as
 * linhas do último produto podem ter ficado pela metade, então a próxima
 * página começa nele de novo (as dele saem desta).
 */
export async function readCustomerSales(
  code: number,
  options: SankhyaClientOptions = {},
): Promise<{ sales: MonthlySale[]; complete: boolean }> {
  const sales: MonthlySale[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const table = await executeQuery(monthlySalesSql(code, from), options);
    const rows = table.rows.map(toMonthlySale).filter(Boolean) as MonthlySale[];
    if (table.rows.length < SALES_PAGE) {
      sales.push(...rows);
      return { sales, complete: true };
    }
    const last = rows.at(-1)?.productCode;
    const lastNum = Number(last);
    const head = rows.filter((r) => r.productCode !== last);
    if (!head.length) {
      // Um produto só com 500 linhas (mais de 40 anos de meses): fica assim.
      sales.push(...rows);
      from = lastNum + 1;
      continue;
    }
    sales.push(...head);
    from = lastNum;
  }
  return { sales, complete: false };
}

/** Converte em peças (caixas pelo volume do Sankhya). */
export async function withPieces(
  sales: MonthlySale[],
  options: SankhyaClientOptions = {},
): Promise<Array<MonthlySale & { pieces: number | null }>> {
  const needs = [
    ...new Set(
      sales
        .filter((s) => !PIECE_UNITS.has(unitKey(s.unit)) && unitKey(s.unit))
        .map((s) => Number(s.productCode)),
    ),
  ];
  const volumes = new Map<string, SankhyaRow[]>();
  for (let i = 0; i < needs.length; i += 200) {
    const table = await executeQuery(
      volumesSql(needs.slice(i, i + 200)),
      options,
    );
    for (const r of table.rows) {
      const code = String(sankhyaInt(r.CODPROD) ?? "");
      if (!code) continue;
      volumes.set(code, [...(volumes.get(code) ?? []), r]);
    }
  }
  return sales.map((s) => {
    const factor = pieceFactor(s.unit, volumes.get(s.productCode) ?? []);
    return {
      ...s,
      pieces:
        factor === null ? null : Math.round(s.quantity * factor * 1e6) / 1e6,
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Gravação                                                                  */
/* ------------------------------------------------------------------------ */

export type SalesRefresh =
  | {
      state: "ok";
      rows: number;
      complete: boolean;
      lastOrderDate: string | null;
    }
  | { state: "no_code" }
  | { state: "not_configured" }
  | { state: "error"; message: string };

async function saveLoad(
  customerId: string,
  patch: Partial<
    Omit<CustomerSalesLoad, "id" | "createdAt" | "updatedAt" | "customerId">
  >,
) {
  const store = getStore();
  const current = await store
    .get("customer_sales_loads", customerId)
    .catch(() => null);
  if (current) await store.update("customer_sales_loads", customerId, patch);
  else
    await store.create("customer_sales_loads", {
      id: customerId,
      customerId,
      loadedAt: null,
      lastOrderDate: null,
      rows: 0,
      complete: null,
      error: null,
      triedAt: null,
      ...patch,
    } as never);
}

/**
 * Lê de novo as vendas do cliente no Sankhya e grava a base dele: as linhas
 * pelo id fixo (cliente, mês, produto e unidade) e tira as que sumiram.
 */
export async function refreshCustomerSales(
  customerId: string,
  now = new Date(),
  options: SankhyaClientOptions = {},
): Promise<SalesRefresh> {
  const store = getStore();
  const party = await store.get("parties", customerId).catch(() => null);
  if (!party || party.type !== "customer") return { state: "no_code" };
  const code = sankhyaInt(party.sankhyaCode);
  if (!code) {
    await saveLoad(customerId, {
      triedAt: now.toISOString(),
      error: "no_code",
    });
    return { state: "no_code" };
  }
  try {
    const { sales, complete } = await readCustomerSales(code, options);
    const priced = await withPieces(sales, options);
    const loadedAt = now.toISOString();
    const rows = priced.map((s) => ({
      id: saleRowId(customerId, s),
      customerId,
      month: s.month,
      productCode: s.productCode,
      productName: s.productName,
      unit: s.unit,
      quantity: s.quantity,
      pieces: s.pieces,
      valueBrl: s.valueBrl,
      orders: s.orders,
      lastOrderDate: s.lastOrderDate,
      loadedAt,
    }));
    if (store.upsertMany)
      for (let i = 0; i < rows.length; i += 500)
        await store.upsertMany(
          "customer_sales_monthly",
          rows.slice(i, i + 500),
        );
    else
      for (const row of rows) {
        const { id, ...data } = row;
        const has = await store.get("customer_sales_monthly", id);
        if (has) await store.update("customer_sales_monthly", id, data);
        else await store.create("customer_sales_monthly", row as never);
      }
    const keep = new Set(rows.map((r) => r.id));
    const old = await store.list("customer_sales_monthly", {
      filter: { customerId },
    });
    for (const r of old)
      if (!keep.has(r.id)) await store.remove("customer_sales_monthly", r.id);
    const lastOrderDate =
      rows.reduce<string | null>(
        (max, r) =>
          r.lastOrderDate && (!max || r.lastOrderDate > max)
            ? r.lastOrderDate
            : max,
        null,
      ) ?? null;
    await saveLoad(customerId, {
      loadedAt,
      triedAt: loadedAt,
      lastOrderDate,
      rows: rows.length,
      complete,
      error: null,
    });
    return { state: "ok", rows: rows.length, complete, lastOrderDate };
  } catch (e) {
    if (e instanceof SankhyaError && e.code === "sankhya_not_configured")
      return { state: "not_configured" };
    const message = (
      e instanceof SankhyaError
        ? e.detail || e.code
        : e instanceof Error
          ? e.message
          : String(e)
    ).slice(0, 480);
    // Falha: a base anterior fica; só o erro e a hora da tentativa mudam.
    await saveLoad(customerId, {
      triedAt: now.toISOString(),
      error: message,
    }).catch(() => undefined);
    return { state: "error", message };
  }
}

/** Atualiza as vendas de alguns clientes (quem gere a carteira). */
export async function refreshSalesFor(
  user: User,
  customerIds: string[],
  now = new Date(),
  options: SankhyaClientOptions = {},
): Promise<Array<{ customerId: string; result: SalesRefresh }>> {
  if (!canManagePortfolio(user)) throw new ForbiddenError();
  const out: Array<{ customerId: string; result: SalesRefresh }> = [];
  for (const id of [...new Set(customerIds)].slice(0, 30)) {
    const result = await refreshCustomerSales(id, now, options);
    out.push({ customerId: id, result });
    if (result.state === "not_configured") break;
  }
  await audit(
    user,
    "sales.refresh",
    "party",
    customerIds[0] ?? "-",
    `Vendas do Sankhya atualizadas: ${out.filter((o) => o.result.state === "ok").length} de ${out.length} cliente(s)`,
  );
  return out;
}

/**
 * Carga noturna: os clientes acompanhados, do que foi lido há mais tempo
 * (ou nunca) para o mais recente, até o tempo acabar.
 */
export async function refreshFollowedSales(
  budgetMs: number,
  now: () => number = () => Date.now(),
  options: SankhyaClientOptions = {},
): Promise<{ done: number; failed: number; remaining: number; state: string }> {
  const started = now();
  const ids = await followedCustomerIds();
  const loads = await getStore()
    .list("customer_sales_loads", { filter: { customerId: ids } })
    .catch(() => [] as CustomerSalesLoad[]);
  const tried = new Map(loads.map((l) => [l.customerId, l.triedAt ?? ""]));
  const today = new Date(now()).toISOString().slice(0, 10);
  const queue = ids
    .filter((id) => (tried.get(id) ?? "").slice(0, 10) !== today)
    .sort((a, b) => (tried.get(a) ?? "").localeCompare(tried.get(b) ?? ""));
  let done = 0;
  let failed = 0;
  for (const id of queue) {
    if (now() - started > budgetMs) break;
    const result = await refreshCustomerSales(id, new Date(now()), options);
    if (result.state === "not_configured")
      return {
        done,
        failed,
        remaining: queue.length - done - failed,
        state: "not_configured",
      };
    if (result.state === "ok") done++;
    else failed++;
  }
  return {
    done,
    failed,
    remaining: queue.length - done - failed,
    state: queue.length - done - failed > 0 ? "running" : "done",
  };
}
