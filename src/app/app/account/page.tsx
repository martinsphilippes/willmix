import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  formatDate,
  formatMoney,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { confirmSupplierPaymentAction } from "../actions";

/** Conta corrente do fornecedor: pedidos, valores, pagamentos, saldo. */
export default async function AccountPage({
  searchParams,
}: PageProps<"/app/account">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { supplier } = await searchParams;
  const supplierId =
    user.role === "supplier"
      ? user.partyId
      : isWellmix(user) && typeof supplier === "string"
        ? supplier
        : null;
  if (!supplierId) redirect("/app");
  const t = await getT();
  const store = getStore();
  const [orders, payments, party] = await Promise.all([
    store.list("orders", {
      filter: { supplierId },
      orderBy: "number",
      direction: "desc",
    }),
    store.list("payments", { filter: { direction: "supplier_out" } }),
    store.get("parties", supplierId),
  ]);
  const mine = payments.filter((p) => orders.some((o) => o.id === p.orderId));
  const totalOrders = orders.reduce((s, o) => s + (o.fobTotal ?? 0), 0);
  const totalReceived = mine
    .filter((p) => p.status === "received")
    .reduce((s, p) => s + p.amount, 0);
  const totalPending = mine
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);
  const currency = orders[0]?.fobCurrency ?? "USD";

  return (
    <>
      <PageHeader
        help={{ body: "help.account.body" }}
        t={t}
        title={t("account.title")}
        subtitle={party?.name}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={t("common.total")}
          value={formatMoney(totalOrders, currency)}
        />
        <Stat
          label={t("account.received")}
          value={formatMoney(totalReceived, currency)}
        />
        <Stat
          label={t("account.balance")}
          value={formatMoney(
            totalOrders - totalReceived - totalPending,
            currency,
          )}
        />
      </div>
      <div className="mt-6">
        {mine.length === 0 && orders.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("account.order")}</Th>
                <Th>{t("common.date")}</Th>
                <Th>{t("orders.value")}</Th>
                <Th>Câmbio</Th>
                <Th>{t("common.status")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="bg-zinc-50">
                  <Td>
                    <Link
                      href={`/app/orders/${o.id}`}
                      className="font-medium underline"
                    >
                      #{o.number}
                    </Link>
                  </Td>
                  <Td>{formatDate(o.createdAt)}</Td>
                  <Td className="font-medium">
                    {formatMoney(o.fobTotal, o.fobCurrency)}
                  </Td>
                  <Td>—</Td>
                  <Td>
                    <Badge tone="info">{t(`stage.${o.status}`)}</Badge>
                  </Td>
                  <Td />
                </tr>
              ))}
              {mine.map((p) => {
                const order = orders.find((o) => o.id === p.orderId);
                return (
                  <tr key={p.id}>
                    <Td className="pl-6 text-zinc-500">#{order?.number}</Td>
                    <Td>{formatDate(p.createdAt)}</Td>
                    <Td className="text-emerald-700">
                      − {formatMoney(p.amount, p.currency)}
                    </Td>
                    <Td>{p.fxRate ?? "—"}</Td>
                    <Td>
                      <Badge
                        tone={p.status === "received" ? "success" : "warning"}
                      >
                        {p.status}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        {p.proofDocumentId ? (
                          <a
                            href={`/api/files/${p.proofDocumentId}`}
                            className="text-xs underline"
                            target="_blank"
                          >
                            {t("requests.payment.proof")}
                          </a>
                        ) : null}
                        {p.status === "confirmed" ? (
                          <form action={confirmSupplierPaymentAction}>
                            <input
                              type="hidden"
                              name="paymentId"
                              value={p.id}
                            />
                            <input
                              type="hidden"
                              name="back"
                              value="/app/account"
                            />
                            <SubmitButton variant="secondary">
                              {t("account.confirm")}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
