import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { listSalesOrders, salesAgenda } from "@/lib/services/sales-orders";
import {
  Badge,
  Card,
  Empty,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { openSalesOrderAction } from "../actions/sales-orders";

/*
 * Ordens de venda (mapa V7 e V8; docs/SALES_ORDERS.md): a lista, a agenda
 * das entregas confirmadas e "Nova ordem de venda". Wellmix com a tela
 * Produtos.
 */
export default async function SalesOrdersPage({
  searchParams,
}: PageProps<"/app/sales-orders">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  const { error } = await searchParams;
  const t = await getT();
  const orders = await listSalesOrders(user);
  const agenda = salesAgenda(orders);
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `salesOrder.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  return (
    <>
      <PageHeader
        t={t}
        title={t("salesOrder.list.title")}
        subtitle={t("salesOrder.list.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      <Card title={t("salesOrder.new.title")} dense>
        <form
          action={openSalesOrderAction}
          className="flex flex-wrap items-end gap-2"
          data-sales-order-new
        >
          <PartyPicker
            name="customerId"
            type="customer"
            required
            activeOnly
            labels={partyPickerLabels(t)}
            ariaLabel={t("salesOrder.customer")}
          />
          <SubmitButton>{t("salesOrder.new.submit")}</SubmitButton>
        </form>
      </Card>
      <Card title={t("salesOrder.agenda.title")}>
        {agenda.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("salesOrder.deliveryDate")}</Th>
                <Th>{t("salesOrder.deliveryWindow")}</Th>
                <Th>{t("salesOrder.number")}</Th>
                <Th>{t("salesOrder.customer")}</Th>
              </tr>
            </thead>
            <tbody>
              {agenda.map((o) => (
                <tr key={o.id} className={rowClass} data-sales-agenda={o.id}>
                  <Td className="whitespace-nowrap">
                    {formatDate(`${o.deliveryDate}T12:00:00Z`, t)}
                  </Td>
                  <Td>{o.deliveryWindow ?? "—"}</Td>
                  <Td>
                    <Link
                      href={`/app/sales-orders/${o.id}`}
                      className={linkClass}
                    >
                      #{o.number}
                    </Link>
                  </Td>
                  <Td>{o.customerName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("salesOrder.agenda.empty")}</Empty>
        )}
      </Card>
      <Card title={t("salesOrder.list.all")}>
        {orders.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("salesOrder.number")}</Th>
                <Th>{t("salesOrder.customer")}</Th>
                <Th>{t("salesOrder.products")}</Th>
                <Th>{t("salesOrder.status")}</Th>
                <Th>{t("salesOrder.erp")}</Th>
                <Th>{t("salesOrder.deliveryDate")}</Th>
                <Th>
                  <span className="sr-only">{t("tasks.open")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={rowClass} data-sales-order-row={o.id}>
                  <Td>
                    <Link
                      href={`/app/sales-orders/${o.id}`}
                      className={linkClass}
                    >
                      #{o.number}
                    </Link>
                  </Td>
                  <Td>{o.customerName}</Td>
                  <Td className="tabular-nums" data-sales-order-products={o.id}>
                    {new Set(o.lines.map((l) => l.productId)).size}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        o.status === "confirmed"
                          ? "success"
                          : o.status === "cancelled"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {t(`salesOrder.status.${o.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                  <Td>
                    {o.status === "confirmed"
                      ? (o.erpNumber ??
                        t(`salesOrder.erp.${o.erpStatus}` as DictionaryKey))
                      : "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {o.deliveryDate
                      ? formatDate(`${o.deliveryDate}T12:00:00Z`, t)
                      : "—"}
                  </Td>
                  <Td>
                    <OpenLink
                      href={`/app/sales-orders/${o.id}`}
                      label={t("tasks.open")}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("salesOrder.list.empty")}</Empty>
        )}
      </Card>
    </>
  );
}
