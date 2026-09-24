import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWillmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
} from "@/components/ui";

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWillmix(user) || user.role === "customer")) redirect("/app");
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
              {isWillmix(user) ? <Th>{t("common.customer")}</Th> : null}
              <Th>{t("common.quantity")}</Th>
              <Th>{t("common.status")}</Th>
              <Th>{t("requests.deadline")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <Td className="font-medium">{r.productName}</Td>
                {isWillmix(user) ? (
                  <Td>
                    {parties.find((p) => p.id === r.customerId)?.name ?? "—"}
                  </Td>
                ) : null}
                <Td>
                  {r.quantity} {r.unit}
                </Td>
                <Td>
                  <Badge
                    tone={
                      r.status === "ORDERED"
                        ? "success"
                        : r.status === "CANCELLED"
                          ? "neutral"
                          : "info"
                    }
                  >
                    {t(`reqStatusLabel.${r.status}`)}
                  </Badge>
                </Td>
                <Td>{formatDate(r.deadline)}</Td>
                <Td>
                  <Link
                    href={`/app/requests/${r.id}`}
                    className="font-medium underline"
                  >
                    {t("tasks.open")}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
