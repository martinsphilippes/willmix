import "server-only";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { canSeeMoney } from "@/lib/auth/function-access";
import { getStore, type User } from "@/lib/db";
import {
  SankhyaError,
  executeQuery,
  type SankhyaClientOptions,
  type SankhyaRow,
} from "@/lib/integrations/sankhya-client";
import { sankhyaDate } from "@/lib/integrations/sankhya-mapping";

/*
 * Histórico do cliente direto do Sankhya (dono, 15/11/2026; anexo "API
 * consultas pedidos Wellmix", docs/PURCHASE_HISTORY.md seção 9): a view
 * `sankhya.VW_AD_PEDCLIENTE_ITEM_WELL` pelo DbExplorerSP.executeQuery, com o
 * cliente pelo parceiro comprador (COD_CLIENTE = TGFCAB.CODPARC, o código do
 * Sankhya gravado no cadastro do cliente no portal).
 *
 * - Lista: um registro por pedido (GROUP BY NUNOTA), do mais recente para o
 *   mais antigo (DATA_PEDIDO, NUNOTA), 10 por vez. "Carregar mais" lê de novo
 *   o topo com mais linhas (TOP mostrados + 11), sem cursor de data: o
 *   formato da data no DbExplorer não entra no SQL.
 * - Itens: os do pedido escolhido, sempre com COD_CLIENTE no filtro, 100 por
 *   vez (SEQUENCIA > a última lida) até vir menos de 100.
 * - Tudo é leitura e só inteiros validados entram no SQL (o cliente vem do
 *   cadastro, nunca do navegador). Só a Wellmix lê; valores só com "Ver
 *   valores e margem".
 */

export const SANKHYA_HISTORY_PAGE = 10;
/** Teto de pedidos lidos na lista (mostrados + a página + 1). */
export const SANKHYA_HISTORY_MAX = 500;
const ITEMS_PAGE = 100;
/** Teto de páginas de itens de um pedido (10 × 100 itens). */
const ITEMS_MAX_PAGES = 10;

const VIEW = "sankhya.VW_AD_PEDCLIENTE_ITEM_WELL";

/** Inteiro positivo (código do Sankhya, NUNOTA, SEQUENCIA). */
export function sankhyaInt(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d{1,10}$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const assertInt = (n: number) => {
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("invalid_input");
  return n;
};

/** Os pedidos do cliente, um registro por pedido (o exemplo do anexo). */
export function customerOrdersSql(codCliente: number, top: number): string {
  const cod = assertInt(codCliente);
  const n = Math.min(assertInt(top), SANKHYA_HISTORY_MAX + 1);
  return [
    `SELECT TOP ${n} NUNOTA, DATA_PEDIDO, MAX(NUMNOTA) AS NUMNOTA,`,
    "MAX(CODEMP) AS CODEMP, MAX(CODTIPOPER) AS CODTIPOPER,",
    "MAX(DESCRICAO_TOP) AS DESCRICAO_TOP, MAX(PEDIDO_PENDENTE) AS PEDIDO_PENDENTE,",
    "MAX(STATUS_NOTA) AS STATUS_NOTA, MAX(VALOR_TOTAL_PEDIDO_BRL) AS VALOR_TOTAL_PEDIDO_BRL,",
    "COUNT(*) AS TOTAL_ITENS",
    `FROM ${VIEW} WHERE COD_CLIENTE = ${cod}`,
    "GROUP BY NUNOTA, DATA_PEDIDO ORDER BY DATA_PEDIDO DESC, NUNOTA DESC",
  ].join(" ");
}

const ITEM_COLUMNS = [
  "SEQUENCIA",
  "CODPROD",
  "DESCRICAO_PRODUTO",
  "REFERENCIA_PRODUTO",
  "REFERENCIA_FORNECEDOR",
  "NCM",
  "UNIDADE_NEGOCIADA",
  "QTD_NEGOCIADA",
  "QTD_ENTREGUE",
  "ITEM_PENDENTE",
  "PRECO_UNITARIO_BRL",
  "DESCONTO_ITEM_BRL",
  "VALOR_ITEM_APOS_DESCONTO_BRL",
  "PRECO_UNITARIO_APOS_DESCONTO_BRL",
  "IDENTIFICACAO_CONTAINER_ITEM",
] as const;

/** Itens de um pedido, validando o cliente (o exemplo do anexo, em páginas). */
export function orderItemsSql(
  codCliente: number,
  nunota: number,
  afterSequence = 0,
): string {
  const cod = assertInt(codCliente);
  const nota = assertInt(nunota);
  const after = Math.max(0, Math.floor(afterSequence));
  return [
    `SELECT TOP ${ITEMS_PAGE} ${ITEM_COLUMNS.join(", ")}`,
    `FROM ${VIEW} WHERE COD_CLIENTE = ${cod} AND NUNOTA = ${nota}`,
    after > 0 ? `AND SEQUENCIA > ${after}` : "",
    "ORDER BY SEQUENCIA",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface SankhyaHistoryOrder {
  nunota: number;
  numnota: number | null;
  /** AAAA-MM-DD (DATA_PEDIDO). */
  date: string | null;
  company: number | null;
  top: number | null;
  topName: string | null;
  /** PEDIDO_PENDENTE: true = S, false = N, nulo sem valor. */
  pending: boolean | null;
  status: string | null;
  /** VALOR_TOTAL_PEDIDO_BRL (nulo para quem não vê valores). */
  totalBrl: number | null;
  items: number;
}

export interface SankhyaHistoryItem {
  sequence: number;
  code: number | null;
  name: string;
  reference: string | null;
  supplierReference: string | null;
  ncm: string | null;
  unit: string | null;
  quantity: number | null;
  delivered: number | null;
  pending: boolean | null;
  /** Valores só para quem vê valores (nulos para os outros). */
  unitPriceBrl: number | null;
  discountBrl: number | null;
  unitNetBrl: number | null;
  totalNetBrl: number | null;
  container: string | null;
}

export type SankhyaHistoryResult<T> =
  | ({ state: "ok" } & T)
  | { state: "not_configured" }
  | { state: "no_code" }
  | { state: "forbidden" }
  | { state: "error"; code: string; message: string };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const text = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? s : null;
};
const sn = (v: unknown): boolean | null => {
  const s = text(v)?.toUpperCase();
  return s === "S" ? true : s === "N" ? false : null;
};

export function toOrder(row: SankhyaRow, money: boolean): SankhyaHistoryOrder {
  return {
    nunota: num(row.NUNOTA) ?? 0,
    numnota: num(row.NUMNOTA),
    date: sankhyaDate(row.DATA_PEDIDO),
    company: num(row.CODEMP),
    top: num(row.CODTIPOPER),
    topName: text(row.DESCRICAO_TOP),
    pending: sn(row.PEDIDO_PENDENTE),
    status: text(row.STATUS_NOTA),
    totalBrl: money ? num(row.VALOR_TOTAL_PEDIDO_BRL) : null,
    items: num(row.TOTAL_ITENS) ?? 0,
  };
}

export function toItem(row: SankhyaRow, money: boolean): SankhyaHistoryItem {
  return {
    sequence: num(row.SEQUENCIA) ?? 0,
    code: num(row.CODPROD),
    name: text(row.DESCRICAO_PRODUTO) ?? "—",
    reference: text(row.REFERENCIA_PRODUTO),
    supplierReference: text(row.REFERENCIA_FORNECEDOR),
    ncm: text(row.NCM),
    unit: text(row.UNIDADE_NEGOCIADA),
    quantity: num(row.QTD_NEGOCIADA),
    delivered: num(row.QTD_ENTREGUE),
    pending: sn(row.ITEM_PENDENTE),
    unitPriceBrl: money ? num(row.PRECO_UNITARIO_BRL) : null,
    discountBrl: money ? num(row.DESCONTO_ITEM_BRL) : null,
    unitNetBrl: money ? num(row.PRECO_UNITARIO_APOS_DESCONTO_BRL) : null,
    totalNetBrl: money ? num(row.VALOR_ITEM_APOS_DESCONTO_BRL) : null,
    container: text(row.IDENTIFICACAO_CONTAINER_ITEM),
  };
}

/**
 * Cliente do portal → código do parceiro no Sankhya. Só a Wellmix, só quem
 * abre Solicitações, só cliente cadastrado com código numérico.
 */
async function customerCode(
  user: User,
  partyId: string,
): Promise<SankhyaHistoryResult<{ code: number }>> {
  if (!isWellmix(user) || !canOpen(user, "requests"))
    return { state: "forbidden" };
  const party = await getStore().get("parties", partyId);
  if (!party || party.type !== "customer") return { state: "forbidden" };
  const code = sankhyaInt(party.sankhyaCode);
  if (!code) return { state: "no_code" };
  return { state: "ok", code };
}

function failure(
  e: unknown,
):
  | { state: "not_configured" }
  | { state: "error"; code: string; message: string } {
  if (e instanceof SankhyaError) {
    if (e.code === "sankhya_not_configured") return { state: "not_configured" };
    return { state: "error", code: e.code, message: e.detail || e.code };
  }
  return {
    state: "error",
    code: "sankhya_unknown",
    message: e instanceof Error ? e.message : String(e),
  };
}

/** Pedidos do cliente no Sankhya: a página depois dos `shown` já mostrados. */
export async function sankhyaCustomerOrders(
  user: User,
  partyId: string,
  shown = 0,
  options: SankhyaClientOptions = {},
): Promise<
  SankhyaHistoryResult<{ orders: SankhyaHistoryOrder[]; next: number | null }>
> {
  const who = await customerCode(user, partyId);
  if (who.state !== "ok") return who;
  const skip = Math.max(0, Math.min(Math.floor(shown), SANKHYA_HISTORY_MAX));
  const top = Math.min(
    skip + SANKHYA_HISTORY_PAGE + 1,
    SANKHYA_HISTORY_MAX + 1,
  );
  try {
    const table = await executeQuery(customerOrdersSql(who.code, top), options);
    const money = canSeeMoney(user);
    const rows = table.rows.map((r) => toOrder(r, money));
    const page = rows.slice(skip, skip + SANKHYA_HISTORY_PAGE);
    const more =
      rows.length > skip + SANKHYA_HISTORY_PAGE &&
      skip + SANKHYA_HISTORY_PAGE < SANKHYA_HISTORY_MAX;
    return {
      state: "ok",
      orders: page,
      next: more ? skip + SANKHYA_HISTORY_PAGE : null,
    };
  } catch (e) {
    return failure(e);
  }
}

/** Itens de um pedido do cliente no Sankhya (o cliente sempre no filtro). */
export async function sankhyaOrderItems(
  user: User,
  partyId: string,
  nunota: number,
  options: SankhyaClientOptions = {},
): Promise<SankhyaHistoryResult<{ items: SankhyaHistoryItem[] }>> {
  const who = await customerCode(user, partyId);
  if (who.state !== "ok") return who;
  const money = canSeeMoney(user);
  const items: SankhyaHistoryItem[] = [];
  try {
    let after = 0;
    for (let page = 0; page < ITEMS_MAX_PAGES; page++) {
      const table = await executeQuery(
        orderItemsSql(who.code, nunota, after),
        options,
      );
      const rows = table.rows.map((r) => toItem(r, money));
      items.push(...rows);
      const last = rows.at(-1)?.sequence ?? 0;
      // Menos de uma página, ou sequência que não avança: acabou.
      if (rows.length < ITEMS_PAGE || last <= after) break;
      after = last;
    }
    return { state: "ok", items };
  } catch (e) {
    return failure(e);
  }
}
