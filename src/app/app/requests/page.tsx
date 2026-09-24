import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWellmix(user) || user.role === "customer")) redirect("/app");
  const t = await getT();
  const store = getStore();
  const requests = await store.list("requests", {
    filter:
      user.role === "customer" ? { customerId: user.partyId! } : undefined,
    orderBy: "createdAt",
    direction: "desc",
  });
  const parties = await store.list("parties", { filter: { type: "customer" } });

  return (
    <>
      <PageHeader
        help={{ body: "help.requests.body", steps: "help.requests.steps" }}
        t={t}
        title={t("requests.title")}
        actions={
          <LinkButton href="/app/requests/new" variant="primary">
            + {t("requests.new")}
          </LinkButton>
        }
      />
      {requests.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("common.product")}</Th>
              {isWellmix(user) ? <Th>{t("common.customer")}</Th> : null}
              <Th>{t("common.quantity")}</Th>
              <Th>{t("common.status")}</Th>
              <Th>{t("requests.deadline")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className={rowClass}>
                <Td className="min-w-40 font-medium text-zinc-900">
                  {r.productName}
                </Td>
                {isWellmix(user) ? (
                  <Td className="min-w-32">
                    {parties.find((p) => p.id === r.customerId)?.name ?? "—"}
                  </Td>
                ) : null}
                <Td className="whitespace-nowrap tabular-nums">
                  {r.quantity} {r.unit}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge
                    tone={
                      r.status === "ORDERED"
                        ? "success"
                        : r.status === "CANCELLED"
                          ? "neutral"
                          : r.status === "WAITING_DOWN_PAYMENT"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {t(`reqStatusLabel.${r.status}`)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatDate(r.deadline)}
                </Td>
                <Td className="text-right">
                  <TextLink href={`/app/requests/${r.id}`}>
                    {t("tasks.open")}
                  </TextLink>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
