import Link from "next/link";
import type { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Order, User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { lotsOfOrder } from "@/lib/services/divergence-lots";
import { Badge, Card, formatDate, linkClass } from "@/components/ui";

/*
 * Lotes com divergência do pedido (mapa E21; docs/RECEIVING.md): um por
 * divergência da contagem, com o link para os quatro passos. A Wellmix, a
 * Trading e o Agente de carga do pedido veem.
 */
export async function OrderDivergenceLots({
  user,
  order,
  t,
}: {
  user: User;
  order: Order;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const visible =
    isWellmix(user) ||
    (user.role === "supplier" && user.partyId === order.supplierId) ||
    (user.role === "logistics" && user.partyId === order.logisticsId);
  if (!visible) return null;
  const lots = await lotsOfOrder(order.id);
  if (!lots.length) return null;
  return (
    <Card title={t("lot.orderCard")} dense>
      <ul
        className="divide-y divide-zinc-100 text-sm"
        id="divergence-lots"
        data-order-lots={lots.length}
      >
        {lots
          .sort((a, b) => b.number - a.number)
          .map((lot) => (
            <li
              key={lot.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span>
                <Link
                  href={`/app/orders/${order.id}/lots/${lot.id}`}
                  className={linkClass}
                >
                  {t("lot.title", { n: String(lot.number) })}
                </Link>{" "}
                <span className="text-xs text-zinc-500">
                  {formatDate(lot.createdAt, t)} ·{" "}
                  {lot.items.map((i) => i.name).join(", ")}
                </span>
              </span>
              <Badge tone={lot.status === "closed" ? "success" : "warning"}>
                {t(`lot.status.${lot.status}` as DictionaryKey)}
              </Badge>
            </li>
          ))}
      </ul>
    </Card>
  );
}
