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

/** Linhas por consulta da visão Produto (os itens de vários pedidos). */
const PRODUCT_ROWS_PAGE = 500;
/** Teto de consultas da visão Produto (40 × 500 itens). */
const PRODUCT_ROWS_MAX_PAGES = 40;

/**
 * Visão Produto (dono, 15/11/2026): os itens dos pedidos lidos na lista, com
 * o cliente e os pedidos no filtro, só o que a soma usa. A página seguinte
 * vem por (NUNOTA, SEQUENCIA), só com inteiros no SQL.
 */
export function customerItemsSql(
  codCliente: number,
  nunotas: number[],
  after: { nunota: number; sequence: number } | null = null,
): string {
  const cod = assertInt(codCliente);
  const list = [...new Set(nunotas.map(assertInt))];
  if (!list.length) throw new Error("invalid_input");
  const where = [`COD_CLIENTE = ${cod}`, `NUNOTA IN (${list.join(", ")})`];
  if (after) {
    const nota = assertInt(after.nunota);
    const seq = Math.max(0, Math.floor(after.sequence));
    where.push(
      `(NUNOTA > ${nota} OR (NUNOTA = ${nota} AND SEQUENCIA > ${seq}))`,
    );
  }
  return [
    `SELECT TOP ${PRODUCT_ROWS_PAGE} NUNOTA, SEQUENCIA, DATA_PEDIDO, CODPROD,`,
    "DESCRICAO_PRODUTO, UNIDADE_NEGOCIADA, QTD_NEGOCIADA,",
    "VALOR_ITEM_APOS_DESCONTO_BRL",
    `FROM ${VIEW} WHERE ${where.join(" AND ")}`,
    "ORDER BY NUNOTA, SEQUENCIA",
  ].join(" ");
}

/** Quantidade numa unidade do Sankhya (UN, CX…; nula sem unidade). */
export interface SankhyaQuantity {
  unit: string | null;
  quantity: number;
}

/**
 * O produto do portal de um código do Sankhya e a família dele (Nova
 * solicitação, dono, 15/11/2026; docs/ORDER_TERMS.md seção 10): o histórico
 * filtra pela família escolhida e um clique leva o produto ao pedido. Nulos
 * quando o código não é de um produto do catálogo.
 */
export interface SankhyaCatalogLink {
  productId?: string | null;
  family?: string | null;
  /** Código Wellmix (SKU) e foto principal do produto (dono, 15/11/2026). */
  sku?: string | null;
  photoId?: string | null;
}

/** Um produto da visão Produto: o total do período e cada data. */
export interface SankhyaHistoryProduct extends SankhyaCatalogLink {
  /** CODPROD (ou o nome, se o item vier sem código). */
  key: string;
  code: number | null;
  name: string;
  /** Soma das quantidades pedidas no período, por unidade. */
  total: SankhyaQuantity[];
  /**
   * Valor total do produto no período, em R$: a soma dos valores líquidos
   * dos itens (após descontos). Nulo se algum item veio sem valor ou para
   * quem não vê valores.
   */
  value: number | null;
  /** Da data mais recente para a mais antiga; pedidos do mesmo dia somados. */
  days: Array<{ date: string | null; quantities: SankhyaQuantity[] }>;
}

/** Item lido para a soma (um por item de pedido). */
export interface SankhyaProductRow {
  date: string | null;
  code: number | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  /** VALOR_ITEM_APOS_DESCONTO_BRL (nulo sem valor ou sem permissão). */
  value: number | null;
}

/** Soma sem o resto do ponto flutuante (0,1 + 0,2). */
const add = (a: number, b: number) => Math.round((a + b) * 1e6) / 1e6;

function sumByUnit(map: Map<string | null, number>): SankhyaQuantity[] {
  return [...map.entries()]
    .map(([unit, quantity]) => ({ unit, quantity }))
    .sort((a, b) => (a.unit ?? "").localeCompare(b.unit ?? ""));
}

/** Data mais recente primeiro; sem data, por último. */
const byDateDesc = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? 1 : -1;

/**
 * Visão Produto: agrupa pelo código do produto no Sankhya; em cada produto,
 * soma a quantidade pedida de cada data (vários pedidos no mesmo dia viram
 * uma linha) e o total do período, sempre por unidade (UN e CX não se somam),
 * e o valor total (dono, 15/11/2026: os valores líquidos dos itens, após
 * descontos; "—" se algum item vier sem valor). O nome é o do pedido mais
 * recente. Produtos do comprado mais recentemente
 * para o mais antigo.
 */
export function productHistory(
  rows: SankhyaProductRow[],
): SankhyaHistoryProduct[] {
  const products = new Map<
    string,
    {
      code: number | null;
      name: string;
      nameDate: string | null;
      total: Map<string | null, number>;
      /** Soma dos valores; nula assim que um item vier sem valor. */
      value: number | null;
      days: Map<string | null, Map<string | null, number>>;
    }
  >();
  for (const row of rows) {
    if (row.quantity === null) continue;
    const key = row.code !== null ? String(row.code) : `nome:${row.name}`;
    let p = products.get(key);
    if (!p) {
      p = {
        code: row.code,
        name: row.name,
        nameDate: row.date,
        total: new Map(),
        value: 0,
        days: new Map(),
      };
      products.set(key, p);
    } else if (byDateDesc(row.date, p.nameDate) < 0) {
      p.name = row.name;
      p.nameDate = row.date;
    }
    const unit = row.unit;
    p.total.set(unit, add(p.total.get(unit) ?? 0, row.quantity));
    p.value =
      p.value === null || row.value === null ? null : add(p.value, row.value);
    const day = p.days.get(row.date) ?? new Map<string | null, number>();
    day.set(unit, add(day.get(unit) ?? 0, row.quantity));
    p.days.set(row.date, day);
  }
  return [...products.entries()]
    .map(([key, p]) => ({
      key,
      code: p.code,
      name: p.name,
      total: sumByUnit(p.total),
      value: p.value === null ? null : Math.round(p.value * 100) / 100,
      days: [...p.days.entries()]
        .sort(([a], [b]) => byDateDesc(a, b))
        .map(([date, units]) => ({ date, quantities: sumByUnit(units) })),
    }))
    .sort(
      (a, b) =>
        byDateDesc(a.days[0]?.date ?? null, b.days[0]?.date ?? null) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.key.localeCompare(b.key),
    );
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

export interface SankhyaHistoryItem extends SankhyaCatalogLink {
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
export async function customerCode(
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

export function failure(
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
    return { state: "ok", items: await withCatalog(items) };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Visão Produto do histórico (dono, 15/11/2026): os produtos dos `shown`
 * pedidos mais recentes do cliente (os mesmos da lista, na mesma ordem),
 * somados por código do produto e por data. O período é o desses pedidos
 * (`from` a `to`); `complete` é falso se o teto de leituras cortou itens.
 */
export async function sankhyaCustomerProducts(
  user: User,
  partyId: string,
  shown = SANKHYA_HISTORY_PAGE,
  options: SankhyaClientOptions = {},
): Promise<
  SankhyaHistoryResult<{
    products: SankhyaHistoryProduct[];
    orders: number;
    from: string | null;
    to: string | null;
    complete: boolean;
    /** Quem lê vê valores ("Ver valores e margem"). */
    money: boolean;
  }>
> {
  const who = await customerCode(user, partyId);
  if (who.state !== "ok") return who;
  // Valores só com "Ver valores e margem" (a mesma regra da lista).
  const money = canSeeMoney(user);
  const count = Math.max(
    1,
    Math.min(Math.floor(shown) || SANKHYA_HISTORY_PAGE, SANKHYA_HISTORY_MAX),
  );
  try {
    const list = await executeQuery(
      customerOrdersSql(who.code, count),
      options,
    );
    const orders = list.rows
      .map((r) => toOrder(r, false))
      .filter((o) => o.nunota > 0)
      .slice(0, count);
    const dates = orders
      .map((o) => o.date)
      .filter((d): d is string => !!d)
      .sort();
    const period = {
      orders: orders.length,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
    };
    if (!orders.length)
      return { state: "ok", products: [], complete: true, money, ...period };
    const dateOf = new Map(orders.map((o) => [o.nunota, o.date]));
    const nunotas = orders.map((o) => o.nunota);
    const rows: SankhyaProductRow[] = [];
    let after: { nunota: number; sequence: number } | null = null;
    let complete = false;
    for (let page = 0; page < PRODUCT_ROWS_MAX_PAGES; page++) {
      const table = await executeQuery(
        customerItemsSql(who.code, nunotas, after),
        options,
      );
      for (const r of table.rows) {
        const nunota = num(r.NUNOTA) ?? 0;
        rows.push({
          // A data do pedido (a mesma da lista), para o item sem a dele.
          date: sankhyaDate(r.DATA_PEDIDO) ?? dateOf.get(nunota) ?? null,
          code: num(r.CODPROD),
          name: text(r.DESCRICAO_PRODUTO) ?? "—",
          unit: text(r.UNIDADE_NEGOCIADA),
          quantity: num(r.QTD_NEGOCIADA),
          value: money ? num(r.VALOR_ITEM_APOS_DESCONTO_BRL) : null,
        });
      }
      const last = table.rows.at(-1);
      const next = last
        ? { nunota: num(last.NUNOTA) ?? 0, sequence: num(last.SEQUENCIA) ?? 0 }
        : null;
      // Menos de uma página, ou posição que não avança: acabou.
      if (
        table.rows.length < PRODUCT_ROWS_PAGE ||
        !next ||
        next.nunota <= 0 ||
        (after &&
          (next.nunota < after.nunota ||
            (next.nunota === after.nunota && next.sequence <= after.sequence)))
      ) {
        complete = true;
        break;
      }
      after = next;
    }
    return {
      state: "ok",
      products: await withCatalog(productHistory(rows)),
      complete,
      money,
      ...period,
    };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Liga cada linha (pelo CODPROD) ao produto do catálogo, à família dele, ao
 * código Wellmix (SKU) e à foto principal.
 */
async function withCatalog<T extends { code: number | null }>(
  rows: T[],
): Promise<Array<T & SankhyaCatalogLink>> {
  const { originsByCode } = await import("./product-origin");
  const { productFaces } = await import("./product-faces");
  const origins = await originsByCode(rows.map((r) => r.code));
  const faces = await productFaces(
    [...origins.values()].map((o) => o.productId),
  );
  return rows.map((r) => {
    const o = r.code === null ? null : origins.get(r.code);
    const face = o ? faces.get(o.productId) : null;
    return {
      ...r,
      productId: o?.productId ?? null,
      family: o?.family ?? null,
      sku: face?.sku ?? null,
      photoId: face?.photoId ?? null,
    };
  });
}
