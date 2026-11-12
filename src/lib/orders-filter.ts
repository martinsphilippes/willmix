/*
 * Filtros e ordem da tela Pedidos (/app/orders). Função pura usada no servidor
 * (que filtra, ordena e pagina antes de mandar a página) e no navegador (que
 * mostra o resultado na hora, enquanto o servidor responde).
 *
 * Com a carga do Sankhya a tela passou de 8 mil pedidos e 100 mil itens:
 * mandar tudo ao navegador estourava o tempo da Vercel.
 */

export type OrdersRowState = "active" | "blocked" | "done" | "cancelled";

export type OrdersFilterKey =
  "n" | "p" | "c" | "s" | "ph" | "st" | "pr" | "d" | "u";
export type OrdersFilters = Record<OrdersFilterKey, string>;
export type OrdersSortKey =
  | "number"
  | "product"
  | "customer"
  | "supplier"
  | "phase"
  | "state"
  | "progress"
  | "due"
  | "updated";
export type OrdersSort = { key: OrdersSortKey; desc: boolean } | null;

export const ORDERS_FILTER_KEYS: OrdersFilterKey[] = [
  "n",
  "p",
  "c",
  "s",
  "ph",
  "st",
  "pr",
  "d",
  "u",
];
export const ORDERS_SORT_KEYS: readonly OrdersSortKey[] = [
  "number",
  "product",
  "customer",
  "supplier",
  "phase",
  "state",
  "progress",
  "due",
  "updated",
];
export const ORDERS_STATE_RANK: Record<OrdersRowState, number> = {
  blocked: 0,
  active: 1,
  done: 2,
  cancelled: 3,
};

/** Linhas por página da tela Pedidos (o servidor manda uma página por vez). */
export const ORDERS_PAGE_SIZE = 50;

/** O que o filtro e a ordem leem de cada linha. */
export interface OrdersFilterRow {
  number: string;
  product: string;
  customer: string;
  supplier: string;
  phaseKey: string;
  phaseRank: number;
  state: OrdersRowState;
  progress: number | null;
  step: string | null;
  due: string;
  updated: string;
  items: Array<{
    name: string;
    variant: string | null;
    state: OrdersRowState;
    step: string | null;
  }>;
}

/** Sem acento e sem caixa: "Preparação" acha "preparacao". */
export const foldText = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Ordem do endereço ("-due") ou nula (link editado ou antigo não quebra). */
export function parseOrdersSort(raw: string | undefined): OrdersSort {
  const value = raw ?? "";
  const key = value.replace(/^-/, "");
  return (ORDERS_SORT_KEYS as readonly string[]).includes(key)
    ? { key: key as OrdersSortKey, desc: value.startsWith("-") }
    : null;
}

export function filterOrderRows<T extends OrdersFilterRow>(
  rows: readonly T[],
  filters: Partial<OrdersFilters>,
  sort: OrdersSort,
  options: { today: string; showCustomer: boolean; showSupplier: boolean },
): T[] {
  const { today, showCustomer, showSupplier } = options;
  const f = (k: OrdersFilterKey) => filters[k] ?? "";
  const has = (value: string, q: string) =>
    !q || foldText(value).includes(foldText(q));
  const week = addDays(today, 7);
  const weekAgo = addDays(today, -7);
  const monthAgo = addDays(today, -30);
  const pr = f("pr");
  const list = rows.filter((r) => {
    if (!has(r.number, f("n"))) return false;
    // Produto: acha também pelos outros itens do pedido/lote.
    if (
      !has(r.product, f("p")) &&
      !r.items.some((i) => has(`${i.name} ${i.variant ?? ""}`, f("p")))
    )
      return false;
    if (showCustomer && !has(r.customer, f("c"))) return false;
    if (showSupplier && !has(r.supplier, f("s"))) return false;
    if (f("ph") && r.phaseKey !== f("ph")) return false;
    if (f("st") && r.state !== f("st")) return false;
    if (pr === "cancelled" && r.state !== "cancelled") return false;
    // Links antigos (?pr=none|partial|full) continuam valendo pelo percentual.
    if (pr === "none" && r.progress !== 0) return false;
    if (
      pr === "partial" &&
      !(r.progress !== null && r.progress > 0 && r.progress < 100)
    )
      return false;
    if (pr === "full" && r.progress !== 100) return false;
    // Passo da viagem: a linha ou algum produto do grupo nesse passo (como
    // no quadrado da Control Tower, cancelado não conta).
    if (
      pr &&
      !["cancelled", "none", "partial", "full"].includes(pr) &&
      !(r.state !== "cancelled" && r.step === pr) &&
      !r.items.some((i) => i.state !== "cancelled" && i.step === pr)
    )
      return false;
    if (f("d") === "overdue" && !(r.due && r.due < today)) return false;
    if (f("d") === "week" && !(r.due && r.due >= today && r.due <= week))
      return false;
    if (f("d") === "none" && r.due) return false;
    if (f("u") === "today" && r.updated !== today) return false;
    if (f("u") === "week" && r.updated < weekAgo) return false;
    if (f("u") === "month" && r.updated < monthAgo) return false;
    return true;
  });
  if (!sort) return list;
  const value = (r: T): string | number => {
    switch (sort.key) {
      case "number":
        return Number(r.number.replace(/\D/g, "")) || 0;
      case "phase":
        return r.phaseRank;
      case "state":
        return ORDERS_STATE_RANK[r.state];
      case "progress":
        return r.state === "cancelled" ? -1 : (r.progress ?? -1);
      case "due":
        return r.due || "9999";
      case "updated":
        return r.updated;
      case "product":
      case "customer":
      case "supplier":
        return foldText(r[sort.key]);
    }
  };
  // Valores calculados uma vez por linha (não a cada comparação).
  const keyed = list.map((r) => ({ r, v: value(r) }));
  keyed.sort((a, b) => {
    const cmp =
      typeof a.v === "number" && typeof b.v === "number"
        ? a.v - b.v
        : String(a.v).localeCompare(String(b.v));
    return sort.desc ? -cmp : cmp;
  });
  return keyed.map((k) => k.r);
}

/** Página pedida (1, 2, ...) dentro do total; fora dele, a última que existe. */
export function ordersPage(raw: string | undefined, matched: number) {
  const pages = Math.max(1, Math.ceil(matched / ORDERS_PAGE_SIZE));
  const asked = Math.floor(Number(raw));
  const page =
    Number.isFinite(asked) && asked >= 1 ? Math.min(asked, pages) : 1;
  return { page, pages, start: (page - 1) * ORDERS_PAGE_SIZE };
}
