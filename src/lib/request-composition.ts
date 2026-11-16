/*
 * Encomendas, composição do pedido de cada linha (dono, 16/11/2026): os
 * produtos diferentes, na ordem em que aparecem, e a soma das quantidades,
 * calculados por pedido e não pelo produto da solicitação.
 *
 * - Linha com pedido: os itens do pedido (`order_items`), cada pedido uma vez
 *   (o pedido do histórico do Sankhya tem muitos itens; a solicitação guarda
 *   só um produto).
 * - Solicitação sem pedido (ou pedido ainda sem itens): o produto dela.
 * - Lote (produtos pedidos juntos): a soma das solicitações do lote, cada
 *   uma pelo pedido dela quando já tem.
 *
 * Produto repetido (o mesmo cadastro em duas cores ou em dois itens) conta
 * uma vez nos nomes e nas fotos, e as quantidades somam. Puro: a tela lê os
 * itens só dos pedidos das linhas da página.
 */

export interface CompositionItem {
  productId: string | null;
  name: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface CompositionRequest {
  orderId: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface CompositionProduct {
  /** O produto do cadastro, ou o nome quando não há cadastro. */
  key: string;
  productId: string | null;
  name: string;
}

export interface Composition {
  /** Produtos diferentes, na ordem em que aparecem no pedido. */
  products: CompositionProduct[];
  /** Soma das quantidades: peças juntas (un, pcs, pç…); outra unidade à parte. */
  totals: Array<{ unit: string; quantity: number }>;
}

/** Unidades que são peças ("un", "UN", "pcs", "pç", "peças"…). */
const PIECE_UNITS = new Set([
  "",
  "u",
  "un",
  "und",
  "unid",
  "unidade",
  "unidades",
  "pc",
  "pcs",
  "pç",
  "pçs",
  "pca",
  "pcas",
  "peca",
  "pecas",
  "peça",
  "peças",
  "piece",
  "pieces",
  "ea",
  "件",
  "个",
]);

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Grupo da unidade: "pieces" para as peças; a unidade normalizada nas demais. */
export function unitGroup(unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
  return PIECE_UNITS.has(u) ? "pieces" : fold(u);
}

/**
 * Composição do pedido da linha. `itemsByOrder`: os itens dos pedidos das
 * linhas (só os da página); pedido sem itens ali vale pela solicitação.
 */
export function requestComposition(
  requests: readonly CompositionRequest[],
  itemsByOrder: ReadonlyMap<string, readonly CompositionItem[]>,
): Composition {
  const sources: CompositionItem[] = [];
  const seenOrders = new Set<string>();
  for (const r of requests) {
    const items = r.orderId ? itemsByOrder.get(r.orderId) : undefined;
    if (r.orderId && items?.length) {
      // O mesmo pedido em duas solicitações do lote conta uma vez.
      if (seenOrders.has(r.orderId)) continue;
      seenOrders.add(r.orderId);
      sources.push(...items);
    } else
      sources.push({
        productId: r.productId,
        name: r.productName,
        quantity: r.quantity,
        unit: r.unit,
      });
  }
  const products = new Map<string, CompositionProduct>();
  const totals = new Map<string, { unit: string; quantity: number }>();
  for (const s of sources) {
    const name = (s.name ?? "").replace(/\s+/g, " ").trim();
    const key = s.productId ? `p:${s.productId}` : `n:${fold(name)}`;
    if ((s.productId || name) && !products.has(key))
      products.set(key, { key, productId: s.productId, name });
    const qty = Number(s.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const group = unitGroup(s.unit);
    const total = totals.get(group);
    if (total) total.quantity += qty;
    // O nome da unidade como veio no primeiro item do grupo ("un", "pcs").
    else
      totals.set(group, {
        unit: (s.unit ?? "").trim() || "un",
        quantity: qty,
      });
  }
  return { products: [...products.values()], totals: [...totals.values()] };
}

/**
 * Início do nome do produto, para a coluna Produtos: as primeiras palavras
 * até ~`max` letras, com reticências quando corta (o nome inteiro fica no
 * título da linha).
 */
export function shortProductName(name: string, max = 22): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const words = clean.split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  // Uma palavra só maior que o limite: corta nela.
  return `${(out || clean.slice(0, max)).replace(/[\s,.;:–-]+$/, "")}…`;
}
