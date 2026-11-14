import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Order, OrderItem } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { CURRENCIES } from "@/lib/currencies";
import { orderSaleView } from "@/lib/services/order-sale";
import { OrderSaleForm } from "@/components/order-sale-form";
import { Alert } from "@/components/ui";

/*
 * Venda ao cliente por pedido e por produto no detalhe do pedido (dono,
 * 14/11/2026; docs/ORDER_SALE.md): o preço de cada produto e o total (a
 * soma). A rodada da programação (pedido filho) não tem venda própria: aponta
 * para o pai, que é a compra.
 */
export async function OrderSaleContent({
  order,
  items,
  editable,
  readOnlyNote,
  saved,
  t,
}: {
  order: Order;
  items: OrderItem[];
  /** Grava (ação "Gravar a venda ao cliente", pedido não cancelado). */
  editable: boolean;
  /** Wellmix que vê os valores mas não grava: o aviso de quem altera. */
  readOnlyNote: boolean;
  /** Volta da gravação (?sale=saved). */
  saved: boolean;
  t: Translate;
}) {
  if (order.parentOrderId) {
    const parent = await getStore().get("orders", order.parentOrderId);
    const n = parent?.number ?? "—";
    return (
      <p className="text-sm text-zinc-600" data-order-sale-child>
        {t("orderSale.child", { n })}{" "}
        {parent ? (
          <Link
            href={`/app/orders/${parent.id}`}
            className="font-medium text-brand-700 underline underline-offset-2"
          >
            {t("orderSale.openParent", { n })}
          </Link>
        ) : null}
      </p>
    );
  }
  const view = orderSaleView(order, items);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      {saved ? (
        <div className="mb-3">
          <Alert tone="success">{t("orderSale.saved")}</Alert>
        </div>
      ) : null}
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orderSale.hint")}
      </p>
      {order.status === "CANCELLED" ? (
        <p className="mb-2 text-xs text-zinc-500">{t("orderSale.cancelled")}</p>
      ) : readOnlyNote ? (
        <p className="mb-2 text-xs text-zinc-500">{t("orderSale.readOnly")}</p>
      ) : null}
      <OrderSaleForm
        orderId={order.id}
        lines={view.lines.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
        }))}
        currency={view.currency}
        recordedTotal={view.recordedTotal}
        editable={editable}
        locale={t.intl}
        labels={{
          colProduct: t("orderSale.col.product"),
          colQty: t("orderSale.col.qty"),
          colUnit: t("orderSale.col.unit"),
          colSubtotal: t("orderSale.col.subtotal"),
          currency: t("orderSale.currency"),
          total: t("orderSale.total"),
          partial: t("orderSale.partial", {
            sum: "{sum}",
            n: "{n}",
            total: "{total}",
          }),
          legacy: t("orderSale.legacy", { total: "{total}" }),
          empty: t("orderSale.empty"),
          save: t("orderSale.save"),
          saving: t("orderSale.saving"),
          priceOf: t("orderSale.priceOf", { name: "{name}" }),
          currencyNames: Object.fromEntries(
            CURRENCIES.map((c) => [
              c,
              t(`currency.name.${c}` as DictionaryKey),
            ]),
          ),
        }}
      />
    </div>
  );
}
