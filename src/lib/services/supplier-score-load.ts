import "server-only";

import { getStore, type Party } from "@/lib/db";
import { scoreSupplier, type SupplierScore } from "./supplier-score";
import { brazilDay } from "@/lib/supplier-terms";
import { isSchemaMissing } from "@/lib/db/errors";

async function optional<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p;
  } catch (error) {
    if (isSchemaMissing(error)) return [];
    throw error;
  }
}

/** Avaliação de todos os fornecedores (melhor nota primeiro; sem nota no fim). */
export async function loadSupplierScores(): Promise<
  { supplier: Party; score: SupplierScore }[]
> {
  const store = getStore();
  const today = brazilDay(new Date().toISOString()) as string;
  const [suppliers, orders, quotes, tracks, inspections, receivings, art] =
    await Promise.all([
      store.list("parties", { filter: { type: "supplier" } }),
      store.list("orders"),
      store.list("quotes"),
      optional(store.list("production_tracks")),
      optional(store.list("sku_inspections")),
      optional(store.list("receivings")),
      optional(store.list("art_issues")),
    ]);
  return suppliers
    .map((supplier) => {
      const mine = orders.filter((o) => o.supplierId === supplier.id);
      const ids = new Set(mine.map((o) => o.id));
      return {
        supplier,
        score: scoreSupplier({
          orders: mine,
          tracks: tracks.filter((t) => ids.has(t.orderId)),
          inspections: inspections.filter((i) => ids.has(i.orderId)),
          receivings: receivings.filter((r) => ids.has(r.orderId)),
          artIssues: art.filter((a) => ids.has(a.orderId)),
          quotes: quotes.filter((q) => q.supplierId === supplier.id),
          today,
        }),
      };
    })
    .sort(
      (a, b) =>
        (b.score.score ?? -1) - (a.score.score ?? -1) ||
        a.supplier.name.localeCompare(b.supplier.name),
    );
}
