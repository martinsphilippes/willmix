import Link from "next/link";
import type { Translate } from "@/i18n";
import type { Order } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isRoundsParent } from "@/lib/purchase-rounds";
import { todayIso } from "@/lib/workflow/request-schedule";
import { OrderRoundsCard } from "@/components/purchase-rounds";
import { Alert, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { spawnRoundsAction } from "../../../actions/purchase-rounds";

/*
 * Programação de compra no pedido (docs/PURCHASE_SCHEDULE.md): no pai, as
 * rodadas com o pedido filho de cada uma; no filho, de que rodada ele é e o
 * link para o pai. Nada nos pedidos sem programação.
 */
export async function OrderRoundsSection({
  order,
  wellmix,
  spawned,
  t,
}: {
  order: Order;
  wellmix: boolean;
  /** Retorno do botão "Gerar as rodadas do dia" (?rounds=N). */
  spawned: number | null;
  t: Translate;
}) {
  const store = getStore();
  if (order.parentOrderId) {
    const parent = await store.get("orders", order.parentOrderId);
    if (!parent) return null;
    return (
      <div className="mb-3" data-order-round-of={parent.id}>
        <Alert tone="info">
          {t("purchaseRounds.order.childOf", {
            n: order.roundIndex ?? "—",
            rounds: parent.purchaseRounds?.length ?? "—",
          })}
          {" · "}
          <Link
            href={`/app/orders/${parent.id}`}
            className="font-medium underline underline-offset-2"
          >
            {t("purchaseRounds.order.parentLink", { n: parent.number })}
          </Link>
        </Alert>
      </div>
    );
  }
  if (!isRoundsParent(order)) return null;
  const rounds = order.purchaseRounds!;
  const childIds = rounds.map((r) => r.orderId).filter((x): x is string => !!x);
  const productIds = [
    ...new Set(rounds.flatMap((r) => r.items.map((i) => i.productId))),
  ];
  const [children, products, stages] = await Promise.all([
    childIds.length
      ? store.list("orders", { filter: { id: childIds } })
      : Promise.resolve([] as Order[]),
    store.list("products", { filter: { id: productIds } }),
    store.list("stages", { filter: { orderId: order.id, key: "PREPARATION" } }),
  ]);
  const today = todayIso();
  const preparationDone = stages[0]?.status === "done";
  const due = rounds.some((r) => !r.orderId && r.expectedAt <= today);
  return (
    <Card title={t("purchaseRounds.order.parentTitle")}>
      {spawned !== null ? (
        <div className="mb-2">
          <Alert tone={spawned > 0 ? "success" : "info"}>
            {spawned > 0
              ? t("purchaseRounds.order.spawned", { n: spawned })
              : t("purchaseRounds.order.none")}
          </Alert>
        </div>
      ) : null}
      <OrderRoundsCard
        rounds={rounds}
        childOrders={new Map(children.map((c) => [c.id, c.number]))}
        products={new Map(products.map((p) => [p.id, p.name]))}
        today={today}
        preparationDone={preparationDone}
        t={t}
        action={
          wellmix && due && preparationDone && order.status !== "CANCELLED" ? (
            <form action={spawnRoundsAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton
                pendingText={t("purchaseRounds.order.spawnPending")}
                data-order-rounds-spawn
              >
                {t("purchaseRounds.order.spawn")}
              </SubmitButton>
            </form>
          ) : null
        }
      />
    </Card>
  );
}
