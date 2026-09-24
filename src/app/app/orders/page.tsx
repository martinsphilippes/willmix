import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canSeeSupplier,
  canViewOrder,
  isWellmix,
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
  TextLink,
  Th,
  cx,
  formatDate,
  isOverdue,
  rowClass,
  stageTone,
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
              {user.role !== "customer" && isWellmix(user) ? (
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
              const percent =
                o.status === "CLOSED" ? 100 : (stage?.percent ?? 0);
              return (
                <tr key={o.id} className={rowClass}>
                  <Td className="whitespace-nowrap">
                    <TextLink href={`/app/orders/${o.id}`}>
                      #{o.number}
                    </TextLink>
                  </Td>
                  <Td className="min-w-40 font-medium text-zinc-900">
                    {items.find((i) => i.orderId === o.id)?.name ?? "—"}
                  </Td>
                  {user.role !== "customer" && isWellmix(user) ? (
                    <Td className="min-w-32">{name(o.customerId)}</Td>
                  ) : null}
                  {canSeeSupplier(user) && user.role !== "supplier" ? (
                    <Td className="min-w-32">{name(o.supplierId)}</Td>
                  ) : null}
                  <Td className="whitespace-nowrap">
                    <Badge
                      tone={stageTone(
                        o.status === "CLOSED"
                          ? "done"
                          : stage?.status === "blocked"
                            ? "blocked"
                            : "active",
                      )}
                    >
                      {t(`stage.${o.status}`)}
                      {stage?.status === "blocked"
                        ? ` · ${t("stageStatus.blocked")}`
                        : ""}
                    </Badge>
                  </Td>
                  <Td className="w-40">
                    <div className="flex h-5 items-center gap-2">
                      <Progress percent={percent} />
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-600">
                        {percent}%
                      </span>
                    </div>
                  </Td>
                  <Td
                    className={cx(
                      "whitespace-nowrap tabular-nums",
                      overdue && "font-semibold text-red-700",
                    )}
                  >
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
