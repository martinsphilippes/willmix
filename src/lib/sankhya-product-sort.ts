/*
 * Ordenação da visão Produto do histórico do cliente (dono, 15/11/2026;
 * docs/PURCHASE_HISTORY.md seção 11): pelo total de unidades pedidas ou pelo
 * valor total do produto no período. Produto sem valor fica no fim das duas
 * ordens por valor. Empates: mais unidades, depois o nome. As datas de cada
 * produto não mudam (da mais recente para a mais antiga).
 */

export const PRODUCT_SORTS = [
  "units_desc",
  "units_asc",
  "value_desc",
  "value_asc",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** As ordens por valor (só para quem vê valores). */
export const VALUE_SORTS: readonly ProductSort[] = ["value_desc", "value_asc"];

interface Sortable {
  key: string;
  name: string;
  total: Array<{ quantity: number }>;
  value: number | null;
}

/** Unidades pedidas no período (UN e CX somadas, só para ordenar). */
export const totalUnits = (p: Pick<Sortable, "total">) =>
  p.total.reduce((sum, q) => sum + q.quantity, 0);

const byName = (a: Sortable, b: Sortable) =>
  a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key);

/** Os produtos na ordem escolhida (cópia; a lista recebida não muda). */
export function sortProducts<T extends Sortable>(
  products: T[],
  sort: ProductSort,
): T[] {
  const units = (a: T, b: T) => totalUnits(b) - totalUnits(a);
  const byValue = (desc: boolean) => (a: T, b: T) => {
    if (a.value === null || b.value === null)
      return a.value === b.value ? 0 : a.value === null ? 1 : -1;
    return desc ? b.value - a.value : a.value - b.value;
  };
  const order: Record<ProductSort, (a: T, b: T) => number> = {
    units_desc: (a, b) => units(a, b) || byName(a, b),
    units_asc: (a, b) => -units(a, b) || byName(a, b),
    value_desc: (a, b) => byValue(true)(a, b) || units(a, b) || byName(a, b),
    value_asc: (a, b) => byValue(false)(a, b) || units(a, b) || byName(a, b),
  };
  return [...products].sort(order[sort]);
}
