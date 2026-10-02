import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { listFreightFor } from "@/lib/services/freight";
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

/** Pedidos de frete da companhia marítima (a Wellmix vê todos). */
export default async function FreightListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const wellmix = isWellmix(user);
  if (!wellmix && user.role !== "shipping_line") redirect("/app");
  const t = await getT();
  const rows = await listFreightFor(user);
  const store = getStore();
  const requestIds = [...new Set(rows.map((r) => r.requestId))];
  const carrierIds = [...new Set(rows.map((r) => r.carrierId))];
  const [requests, carriers] = await Promise.all([
    requestIds.length
      ? store.list("requests", { filter: { id: requestIds } })
      : [],
    wellmix && carrierIds.length
      ? store.list("parties", { filter: { id: carrierIds } })
      : [],
  ]);
  const requestOf = new Map(requests.map((r) => [r.id, r]));
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
      {sorted.length === 0 ? (
        <Empty>{t("freight.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("freight.col.product")}</Th>
              {wellmix ? <Th>{t("freight.col.carrier")}</Th> : null}
              <Th>{t("freight.col.cargo")}</Th>
              <Th>{t("freight.col.deadline")}</Th>
              <Th>{t("freight.col.value")}</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => {
              const request = requestOf.get(f.requestId);
              return (
                <tr key={f.id} className={rowClass}>
                  <Td>
                    <Link href={`/app/freight/${f.id}`} className={linkClass}>
                      {request?.productName ?? "—"}
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
                      cartons: f.cartons?.toLocaleString("pt-BR") ?? "?",
                      cbm:
                        f.totalCbm?.toLocaleString("pt-BR", {
                          maximumFractionDigits: 3,
                        }) ?? "?",
                      kg:
                        f.grossWeightKg?.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        }) ?? "?",
                    })}
                  </Td>
                  <Td>{formatDate(request?.deadline)}</Td>
                  <Td className="tabular-nums">
                    {f.status === "answered"
                      ? formatMoney(f.amount, f.currency)
                      : "—"}
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
