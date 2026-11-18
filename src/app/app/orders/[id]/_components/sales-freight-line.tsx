import Link from "next/link";
import type { getT } from "@/i18n/server";
import { getStore, type Order } from "@/lib/db";
import type { OrderFinance } from "@/lib/services/finance";
import { formatMoney, linkClass } from "@/components/ui";

/*
 * Frete da venda como linha própria no Financeiro do pedido de compra
 * (docs/SALES_ORDERS.md; dono, 15/11/2026): o total que entrou no custo, na
 * moeda da venda, e cada ordem de venda expedida com o frete em reais.
 */
export async function SalesFreightLine({
  order,
  finance,
  t,
}: {
  order: Order;
  finance: OrderFinance;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  if (!(finance.salesFreight && finance.salesFreight > 0)) return null;
  const store = getStore();
  const rows = (
    await store
      .list("sales_orders", {
        filter: {
          purchaseOrderId: order.id,
          status: ["shipped", "delivered"],
        },
      })
      .catch(() => [])
  ).filter((o) => !!o.carrierId && (o.freightValue ?? 0) > 0);
  const carriers = rows.length
    ? await store.list("parties", {
        filter: { id: [...new Set(rows.map((o) => o.carrierId!))] },
      })
    : [];
  return (
    <div className="mt-3 text-sm" data-sales-freight-line="">
      <p className="font-medium text-zinc-800">
        {t("finance.salesFreight.title")}:{" "}
        <span className="tabular-nums">
          {formatMoney(finance.salesFreight, finance.sellCurrency, t)}
        </span>
      </p>
      <p className="text-xs text-zinc-500">{t("finance.salesFreight.hint")}</p>
      <ul className="mt-1 space-y-0.5">
        {rows
          .sort((a, b) => a.number - b.number)
          .map((o) => (
            <li key={o.id} className="flex flex-wrap gap-2">
              <Link href={`/app/sales-orders/${o.id}`} className={linkClass}>
                {t("finance.salesFreight.order", { n: String(o.number) })}
              </Link>
              <span className="text-zinc-600">
                {carriers.find((c) => c.id === o.carrierId)?.name ?? "—"}
              </span>
              <span className="tabular-nums">
                {formatMoney(o.freightValue!, "BRL", t)}
              </span>
              <span className="text-xs text-zinc-500">
                {o.freightPaidAt
                  ? t("finance.salesFreight.paid")
                  : t("finance.salesFreight.open")}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
