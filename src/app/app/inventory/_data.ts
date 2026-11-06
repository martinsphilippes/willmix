import "server-only";

import { getStore } from "@/lib/db";
import type { Product } from "@/lib/db";
import {
  INVENTORY_SITUATIONS,
  inInventorySituation,
  loadInventory,
  type InventoryRow,
  type InventorySituation,
} from "@/lib/services/inventory";
import { matchesProduct } from "@/lib/services/product-list";

/** Linha da tela/CSV: o estoque do produto com o cadastro dele. */
export interface InventoryLine extends InventoryRow {
  product: Product | null;
}

/** Lê a situação e a busca da URL (valores soltos viram "todos" / vazio). */
export function readInventoryFilter(sp: {
  situ?: string | string[] | null;
  q?: string | string[] | null;
}) {
  const one = (v: string | string[] | null | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 120) ?? "";
  const situ = one(sp.situ);
  return {
    situation: (INVENTORY_SITUATIONS as readonly string[]).includes(situ)
      ? (situ as InventorySituation)
      : ("all" as InventorySituation),
    q: one(sp.q),
  };
}

/** Estoque com cadastro, contagem por situação e linhas filtradas. */
export async function inventoryData(filter: {
  situation: InventorySituation;
  q: string;
}) {
  const rows = await loadInventory();
  const store = getStore();
  const products = rows.length
    ? await store.list("products", {
        filter: { id: rows.map((r) => r.productId) },
      })
    : [];
  const suppliers = await store.list("parties", {
    filter: { type: "supplier" },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "") : "";
  const lines: InventoryLine[] = rows
    .map((r) => {
      const product = byId.get(r.productId) ?? null;
      return { ...r, product };
    })
    .sort((a, b) =>
      (a.product?.name ?? "").localeCompare(b.product?.name ?? ""),
    );
  const searched = lines.filter(
    (l) =>
      !filter.q ||
      (l.product &&
        (matchesProduct(
          l.product,
          supplierName(l.product.supplierId),
          filter.q,
        ) ||
          (l.product.color ?? "")
            .toLowerCase()
            .includes(filter.q.toLowerCase()))),
  );
  const counts = Object.fromEntries(
    INVENTORY_SITUATIONS.map((s) => [
      s,
      searched.filter((l) => inInventorySituation(l, s)).length,
    ]),
  ) as Record<InventorySituation, number>;
  const shown = searched.filter((l) =>
    inInventorySituation(l, filter.situation),
  );
  return { lines: shown, counts, hasAny: lines.length > 0 };
}

/** Quantidade da situação escolhida (em "todos", o total). */
export function qtyFor(l: InventoryRow, s: InventorySituation): number {
  return s === "all" ? l.total : l[s];
}

/** Custo da quantidade da situação (preço de compra × quantidade). */
export function lineValue(
  l: InventoryLine,
  s: InventorySituation,
): number | null {
  const price = l.product?.price;
  if (price === null || price === undefined) return null;
  return Math.round(price * qtyFor(l, s) * 100) / 100;
}

/** Soma por moeda (custo de cada linha na moeda do produto). */
export function valueByCurrency(
  lines: InventoryLine[],
  s: InventorySituation,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) {
    const v = lineValue(l, s);
    if (v === null) continue;
    const c = l.product?.currency ?? "USD";
    out.set(c, Math.round(((out.get(c) ?? 0) + v) * 100) / 100);
  }
  return out;
}
