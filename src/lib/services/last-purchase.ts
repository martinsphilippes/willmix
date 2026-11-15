import "server-only";
import type { Translate } from "@/i18n";
import { getStore, type Product } from "@/lib/db";
import { moneyText } from "./request-sheet";

/**
 * Preço da última compra do produto ao fornecedor (dono, 15/11/2026), para a
 * Wellmix ver na Nova solicitação ao escolher o produto. Vem do item do
 * pedido de compra mais recente (maior número de pedido, sem os cancelados):
 * o histórico do Sankhya grava o preço na moeda do pedido (VLRUNIT ÷ câmbio).
 * Sem pedido, o preço da última compra gravado no cadastro. Só para a Wellmix
 * (quem chama confere o papel): cliente não vê preço de fornecedor.
 */
export async function lastPurchaseTexts(
  t: Translate,
  products: readonly Product[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!products.length) return out;
  const store = getStore();
  const items = await store.list("order_items", {
    filter: { productId: products.map((p) => p.id) },
  });
  const orders = items.length
    ? await store.list("orders", {
        filter: { id: [...new Set(items.map((i) => i.orderId))] },
      })
    : [];
  const orderById = new Map(
    orders.filter((o) => !o.cancelledAt).map((o) => [o.id, o]),
  );
  const supplierIds = [
    ...new Set(orders.map((o) => o.supplierId).filter(Boolean)),
  ] as string[];
  const suppliers = supplierIds.length
    ? await store.list("parties", { filter: { id: supplierIds } })
    : [];
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const qty = (n: number) => n.toLocaleString(t.intl);

  for (const p of products) {
    const last = items
      .filter(
        (i) =>
          i.productId === p.id &&
          orderById.has(i.orderId) &&
          i.unitPrice != null &&
          i.unitPrice > 0,
      )
      .map((i) => ({ item: i, order: orderById.get(i.orderId)! }))
      .sort((a, b) => (b.order.number ?? 0) - (a.order.number ?? 0))[0];
    if (last) {
      const { item, order } = last;
      out.set(
        p.id,
        t("reqProduct.lastPurchase", {
          price: moneyText(t, item.unitPrice!, order.fobCurrency, true),
          unit: item.unit || "UN",
          qty: qty(item.quantity),
          order: order.sankhyaCode
            ? `${order.number} (Sankhya ${order.sankhyaCode})`
            : String(order.number),
          supplier:
            (order.supplierId && supplierName.get(order.supplierId)) || "—",
        }),
      );
    } else if (p.price != null && p.price > 0) {
      out.set(
        p.id,
        t("reqProduct.lastPurchaseCatalog", {
          price: moneyText(t, p.price, p.currency, true),
          unit: "UN",
        }),
      );
    }
  }
  return out;
}
