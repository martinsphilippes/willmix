import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { listFreightFor } from "@/lib/services/freight";
import { FreightSentNotice } from "@/components/freight-sent-notice";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  formatMoney,
  linkClass,
  rowClass,
} from "@/components/ui";
import { ChatOpenButton } from "@/components/chat-open-button";

/** Pedidos de frete da companhia marítima (a Wellmix vê todos). */
export default async function FreightListPage({
  searchParams,
}: PageProps<"/app/freight">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { sent } = await searchParams;
  const wellmix = isWellmix(user);
  requireScreen(user, "freight");
  const t = await getT();
  const rows = await listFreightFor(user);
  const store = getStore();
  const orderIds = [...new Set(rows.map((r) => r.orderId))];
  const carrierIds = [...new Set(rows.map((r) => r.carrierId))];
  const [orders, carriers] = await Promise.all([
    orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : [],
    wellmix && carrierIds.length
      ? store.list("parties", { filter: { id: carrierIds } })
      : [],
  ]);
  const orderNumberOf = new Map(orders.map((o) => [o.id, o.number]));
  const labelOf = (orderId: string) =>
    orderNumberOf.has(orderId)
      ? t("freight.orderLabel", { n: orderNumberOf.get(orderId)! })
      : "—";
  const carrierOf = new Map(carriers.map((c) => [c.id, c.name]));
  // Pendentes primeiro; encerrados por último.
  const order = { invited: 0, answered: 1, cancelled: 2 } as const;
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <PageHeader
        t={t}
        title={t("freight.title")}
        subtitle={t("freight.subtitle")}
      />
      {typeof sent === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/.test(sent) ? (
        <FreightSentNotice
          user={user}
          freightId={sent}
          next={sorted.find((f) => f.status === "invited" && f.id !== sent)}
          productOf={labelOf}
          pending={sorted.filter((f) => f.status === "invited").length}
          t={t}
        />
      ) : null}
      {sorted.length === 0 ? (
        <Empty>{t("freight.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("freight.col.product")}</Th>
              {wellmix ? <Th>{t("freight.col.carrier")}</Th> : null}
              <Th>{t("freight.col.cargo")}</Th>
              <Th>{t("freight.col.requestedAt")}</Th>
              <Th>{t("freight.col.value")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => {
              return (
                <tr
                  key={f.id}
                  className={rowClass}
                  data-freight-row={f.id}
                  data-freight-status={f.status}
                >
                  <Td>
                    <Link href={`/app/freight/${f.id}`} className={linkClass}>
                      {labelOf(f.orderId)}
                    </Link>
                    <span className="mt-1 block">
                      <Badge
                        tone={
                          f.status === "answered"
                            ? "success"
                            : f.status === "cancelled"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {t(`freight.status.${f.status}`)}
                      </Badge>
                    </span>
                  </Td>
                  {wellmix ? (
                    <Td>{carrierOf.get(f.carrierId) ?? "—"}</Td>
                  ) : null}
                  <Td className="tabular-nums">
                    {t("freight.cargo.cartonsSummary", {
                      cartons: f.cartons?.toLocaleString(t.intl) ?? "?",
                      cbm:
                        f.totalCbm?.toLocaleString(t.intl, {
                          maximumFractionDigits: 3,
                        }) ?? "?",
                      kg:
                        f.grossWeightKg?.toLocaleString(t.intl, {
                          maximumFractionDigits: 1,
                        }) ?? "?",
                    })}
                  </Td>
                  <Td>{formatDate(f.createdAt, t)}</Td>
                  <Td className="tabular-nums">
                    {f.status === "answered"
                      ? formatMoney(f.amount, f.currency, t)
                      : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <ChatOpenButton
                      target={{ orderId: f.orderId }}
                      label={t("chat.open")}
                    />
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
