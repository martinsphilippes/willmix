import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWillmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
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
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updatePenaltyStatusAction } from "../actions";

export default async function PenaltiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWillmix(user) || user.role === "legal")) redirect("/app");
  const t = await getT();
  const store = getStore();
  const [penalties, orders, parties] = await Promise.all([
    store.list("penalties", { orderBy: "createdAt", direction: "desc" }),
    store.list("orders"),
    store.list("parties"),
  ]);

  return (
    <>
      <PageHeader title={t("penalties.title")} />
      {penalties.length === 0 ? (
        <Empty>{t("penalties.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("account.order")}</Th>
              <Th>{t("orders.penalty.responsible")}</Th>
              <Th>{t("orders.penalty.reason")}</Th>
              <Th>{t("orders.value")}</Th>
              <Th>{t("common.date")}</Th>
              <Th>{t("common.status")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {penalties.map((p) => {
              const order = orders.find((o) => o.id === p.orderId);
              return (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/app/orders/${p.orderId}`}
                      className="underline"
                    >
                      #{order?.number}
                    </Link>
                  </Td>
                  <Td>
                    {parties.find((x) => x.id === p.responsiblePartyId)?.name ??
                      "—"}
                  </Td>
                  <Td>
                    {p.reason}
                    {p.evidenceDocumentId ? (
                      <>
                        {" "}
                        <a
                          href={`/api/files/${p.evidenceDocumentId}`}
                          className="text-xs underline"
                          target="_blank"
                        >
                          {t("orders.penalty.evidence")}
                        </a>
                      </>
                    ) : null}
                  </Td>
                  <Td>{formatMoney(p.amount, p.currency)}</Td>
                  <Td>{formatDate(p.createdAt)}</Td>
                  <Td>
                    <Badge
                      tone={
                        p.status === "open"
                          ? "danger"
                          : p.status === "disputed"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {p.status}
                    </Badge>
                  </Td>
                  <Td>
                    <form
                      action={updatePenaltyStatusAction}
                      className="flex gap-1"
                    >
                      <input type="hidden" name="penaltyId" value={p.id} />
                      {(["disputed", "paid", "cancelled"] as const)
                        .filter((s) => s !== p.status)
                        .map((s) => (
                          <SubmitButton
                            key={s}
                            name="status"
                            value={s}
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                          >
                            {s}
                          </SubmitButton>
                        ))}
                    </form>
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
