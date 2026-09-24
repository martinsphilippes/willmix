import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canSeeSupplier,
  canViewOrder,
  isWillmix,
} from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  PageHeader,
  Progress,
  Table,
  Td,
  Th,
  formatDate,
  isOverdue,
} from "@/components/ui";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const store = getStore();
  const [orders, parties, stages, items] = await Promise.all([
    store.list("orders", { orderBy: "number", direction: "desc" }),
    store.list("parties"),
    store.list("stages", { filter: { status: ["active", "blocked"] } }),
    store.list("order_items"),
  ]);
  const visible = orders.filter((o) => canViewOrder(user, o));
  const name = (id: string | null) =>
    parties.find((p) => p.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader
        help={{ body: "help.orders.body" }}
        t={t}
        title={t("orders.title")}
      />
      {visible.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>{t("common.product")}</Th>
              {user.role !== "customer" && isWillmix(user) ? (
                <Th>{t("common.customer")}</Th>
              ) : null}
              {canSeeSupplier(user) && user.role !== "supplier" ? (
                <Th>{t("common.supplier")}</Th>
              ) : null}
              <Th>{t("orders.stage")}</Th>
              <Th>{t("common.progress")}</Th>
              <Th>{t("common.due")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const stage = stages.find((s) => s.orderId === o.id);
              const overdue = isOverdue(stage?.dueAt);
              return (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <Td>
                    <Link
                      href={`/app/orders/${o.id}`}
                      className="font-medium underline"
                    >
                      #{o.number}
                    </Link>
                  </Td>
                  <Td>{items.find((i) => i.orderId === o.id)?.name ?? "—"}</Td>
                  {user.role !== "customer" && isWillmix(user) ? (
                    <Td>{name(o.customerId)}</Td>
                  ) : null}
                  {canSeeSupplier(user) && user.role !== "supplier" ? (
                    <Td>{name(o.supplierId)}</Td>
                  ) : null}
                  <Td>
                    <Badge
                      tone={
                        o.status === "CLOSED"
                          ? "success"
                          : stage?.status === "blocked"
                            ? "danger"
                            : "info"
                      }
                    >
                      {t(`stage.${o.status}`)}
                    </Badge>
                  </Td>
                  <Td className="w-32">
                    <Progress
                      percent={
                        o.status === "CLOSED" ? 100 : (stage?.percent ?? 0)
                      }
                    />
                  </Td>
                  <Td className={overdue ? "text-red-600" : ""}>
                    {formatDate(stage?.dueAt)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
