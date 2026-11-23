import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { listSalesOrders, salesAgenda } from "@/lib/services/sales-orders";
import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { canSeeMoney } from "@/lib/auth/function-access";
import {
  OrderStandardHeads,
  orderHeadText,
} from "@/components/order-standard-cells";
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
  /* Tabela padrão de pedidos (dono, 22 e 23/11/2026; docs/ORDER_TABLES.md):
     as colunas padrão primeiro e as da ordem de venda (Sankhya e Entrega)
     no fim. A ordem de venda sai do estoque: não tem solicitação ligada, e
     o que ela não tem (faturamento, VIP, entregas programadas, m³ e
     fornecedor) fica "—". */
  const seeValue = canSeeMoney(user);
  const store = getStore();
  const [customers, conditions] = await Promise.all([
    listByIds(store, "parties", [...new Set(orders.map((o) => o.customerId))]),
    listByIds(store, "payment_conditions", [
      ...new Set(
        orders.map((o) => o.paymentConditionId).filter((v): v is string => !!v),
      ),
    ]).catch(() => []),
  ]);
  const num = "whitespace-nowrap text-right tabular-nums";
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
                <Th>{orderHeadText(t, "number")}</Th>
                <OrderStandardHeads t={t} seeValue={seeValue} />
                <Th>{t("salesOrder.erp")}</Th>
                <Th>{t("salesOrder.deliveryDate")}</Th>
                <Th>
                  <span className="sr-only">{t("tasks.open")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const party = customers.find((p) => p.id === o.customerId);
                const condition = o.paymentConditionId
                  ? conditions.find((c) => c.id === o.paymentConditionId)
                  : null;
                const priced = o.lines.filter((l) => l.unitPrice !== null);
                const value = priced.reduce(
                  (sum, l) => sum + (l.unitPrice ?? 0) * l.quantity,
                  0,
                );
                return (
                  <tr
                    key={o.id}
                    className={rowClass}
                    data-sales-order-row={o.id}
                  >
                    <Td>
                      <Link
                        href={`/app/sales-orders/${o.id}`}
                        className={linkClass}
                      >
                        #{o.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatDate(o.createdAt, t)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {t("orderTable.saleType.sale")}
                    </Td>
                    <Td>—</Td>
                    <Td>{condition?.name ?? "—"}</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>{party?.economicGroupName ?? "—"}</Td>
                    <Td className={num}>{party?.sankhyaCode ?? "—"}</Td>
                    <Td>{o.customerName}</Td>
                    {/* Status: de quem é a vez (rascunho: a Wellmix confirma). */}
                    <Td className="whitespace-nowrap">
                      {o.status === "draft" ? t("turn.waiting.wellmix") : "—"}
                    </Td>
                    {/* Situação: o momento da ordem. */}
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
                    <Td>—</Td>
                    <Td className={num} data-sales-order-products={o.id}>
                      {new Set(o.lines.map((l) => l.productId)).size}
                    </Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    {seeValue ? (
                      <Td className={num}>
                        {priced.length
                          ? `${o.currency} ${value.toLocaleString(t.intl, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : "—"}
                      </Td>
                    ) : null}
                    <Td>—</Td>
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
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("salesOrder.list.empty")}</Empty>
        )}
      </Card>
    </>
  );
}
