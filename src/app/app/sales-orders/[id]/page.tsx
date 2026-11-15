import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import { canInvoice, canSell } from "@/lib/services/sales-orders";
import { listSalesReturns, returnableOf } from "@/lib/services/sales-returns";
import { canDoQuality } from "@/lib/services/receiving";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";
import { ProductPicker } from "@/components/product-picker";
import { productPickerLabels } from "@/components/party-picker-labels";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  cancelSalesOrderAction,
  confirmSalesOrderAction,
  deliverSalesOrderAction,
  registerSalesInvoiceAction,
  setSalesOrderErpNumberAction,
  shipSalesOrderAction,
  openSalesReturnAction,
  registerReturnInvoiceAction,
  checkSalesReturnAction,
  cancelSalesReturnAction,
  updateSalesOrderAction,
} from "../../actions/sales-orders";

/*
 * Ordem de venda (mapa V7 e V8; docs/SALES_ORDERS.md): itens, preço,
 * condição de pagamento, entrega agendada; confirmar reserva e manda ao
 * Sankhya (ou deixa "a lançar" para o número à mão).
 */
export default async function SalesOrderPage({
  params,
  searchParams,
}: PageProps<"/app/sales-orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!canSell(user)) notFound();
  const { id } = await params;
  const {
    error,
    created,
    saved,
    confirmed,
    erp,
    cancelled,
    invoiced,
    shipped,
    delivered,
    returned,
    returnInvoiced,
    returnChecked,
    returnCancelled,
  } = await searchParams;
  const store = getStore();
  const order = await store.get("sales_orders", id);
  if (!order) notFound();
  const t = await getT();
  const [customer, conditions, purchase, carriers] = await Promise.all([
    store.get("parties", order.customerId),
    store.list("payment_conditions").catch(() => []),
    order.purchaseOrderId
      ? store.get("orders", order.purchaseOrderId)
      : Promise.resolve(null),
    store.list("parties", { filter: { type: "carrier", active: true } }),
  ]);
  const live = order.status !== "draft" && order.status !== "cancelled";
  const out = order.status === "shipped" || order.status === "delivered";
  const carrierName = order.customerPickup
    ? t("salesOrder.ship.pickup")
    : (carriers.find((c) => c.id === order.carrierId)?.name ??
      (order.carrierId
        ? ((await store.get("parties", order.carrierId))?.name ?? "—")
        : "—"));
  const dayOf = (iso: string | null | undefined) =>
    iso ? formatDate(iso, t) : "—";
  const returns = out ? await listSalesReturns(order.id) : [];
  const returnable = returnableOf(order.lines, returns);
  const quality = out && returns.length ? await canDoQuality(user) : false;
  const fmtQty = (n: number | null | undefined) =>
    (n ?? 0).toLocaleString(t.intl, { maximumFractionDigits: 3 });
  const editable = order.status === "draft";
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `salesOrder.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const notice = created
    ? "salesOrder.done.created"
    : saved
      ? "salesOrder.done.saved"
      : confirmed
        ? "salesOrder.done.confirmed"
        : erp
          ? "salesOrder.done.erp"
          : cancelled
            ? "salesOrder.done.cancelled"
            : invoiced
              ? "salesOrder.done.invoiced"
              : shipped
                ? "salesOrder.done.shipped"
                : delivered
                  ? "salesOrder.done.delivered"
                  : returned
                    ? "salesOrder.done.returned"
                    : returnInvoiced
                      ? "salesOrder.done.returnInvoiced"
                      : returnChecked
                        ? "salesOrder.done.returnChecked"
                        : returnCancelled
                          ? "salesOrder.done.returnCancelled"
                          : null;
  const total = order.lines.reduce(
    (s, l) => s + (l.unitPrice ?? 0) * l.quantity,
    0,
  );
  return (
    <>
      <PageHeader
        t={t}
        title={t("salesOrder.title", { n: String(order.number) })}
        subtitle={customer?.name ?? ""}
        actions={
          <Link href="/app/sales-orders" className={linkClass}>
            {t("salesOrder.back")}
          </Link>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {notice ? (
        <Alert tone="success">{t(notice as DictionaryKey)}</Alert>
      ) : null}
      <Card
        title={t("salesOrder.items")}
        actions={
          <Badge
            tone={
              order.status === "confirmed" || out
                ? "success"
                : order.status === "cancelled"
                  ? "danger"
                  : "neutral"
            }
          >
            <span data-sales-order-status={order.status}>
              {t(`salesOrder.status.${order.status}` as DictionaryKey)}
            </span>
          </Badge>
        }
      >
        <form
          action={updateSalesOrderAction}
          className="space-y-3"
          data-sales-order-form
        >
          <input type="hidden" name="id" value={order.id} />
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("salesOrder.product")}</Th>
                <Th className="text-right">{t("salesOrder.quantity")}</Th>
                <Th className="text-right">
                  {t("salesOrder.unitPrice")} ({order.currency})
                </Th>
                <Th>{t("salesOrder.reservation")}</Th>
                {editable ? <Th>{t("salesOrder.remove")}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={`${l.productId}-${i}`} data-sales-order-line={i}>
                  <Td>
                    <input type="hidden" name="productId" value={l.productId} />
                    {l.name}
                  </Td>
                  <Td className="text-right">
                    {editable ? (
                      <Input
                        dense
                        name={`quantity_${i}`}
                        inputMode="decimal"
                        defaultValue={l.quantity}
                        className="w-24 text-right"
                        aria-label={t("salesOrder.quantity")}
                      />
                    ) : (
                      `${l.quantity} ${l.unit}`
                    )}
                  </Td>
                  <Td className="text-right">
                    {editable ? (
                      <Input
                        dense
                        name={`unitPrice_${i}`}
                        inputMode="decimal"
                        defaultValue={l.unitPrice ?? ""}
                        className="w-28 text-right"
                        aria-label={t("salesOrder.unitPrice")}
                      />
                    ) : (
                      (l.unitPrice ?? "—")
                    )}
                  </Td>
                  <Td className="text-xs">
                    {out
                      ? t("salesOrder.reserved.out")
                      : order.status !== "confirmed"
                        ? "—"
                        : l.reservationId
                          ? t("salesOrder.reserved.stock")
                          : t("salesOrder.reserved.arrival")}
                  </Td>
                  {editable ? (
                    <Td>
                      <input
                        type="checkbox"
                        name={`remove_${i}`}
                        aria-label={t("salesOrder.remove")}
                      />
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-sm text-zinc-700">
            {t("salesOrder.total")}: {order.currency}{" "}
            {total.toLocaleString(t.intl, { minimumFractionDigits: 2 })}
          </p>
          {editable ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("salesOrder.addProduct")}>
                  <ProductPicker
                    scope="active"
                    name="newProductId"
                    labels={productPickerLabels(t)}
                  />
                </Field>
                <Field label={t("salesOrder.quantity")}>
                  <Input name="newQuantity" inputMode="decimal" />
                </Field>
                <Field label={t("salesOrder.unitPrice")}>
                  <Input name="newUnitPrice" inputMode="decimal" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("salesOrder.paymentCondition")}>
                  <Select
                    name="paymentConditionId"
                    defaultValue={order.paymentConditionId ?? ""}
                  >
                    <option value="">—</option>
                    {conditions
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label={t("salesOrder.currency")}>
                  <Select name="currency" defaultValue={order.currency}>
                    {["BRL", "USD"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("salesOrder.purchaseOrder")}>
                  <Input
                    name="purchaseOrderNumber"
                    inputMode="numeric"
                    defaultValue={purchase ? String(purchase.number) : ""}
                    placeholder={t("salesOrder.purchaseOrderHint")}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("salesOrder.deliveryDate")}>
                  <Input
                    type="date"
                    name="deliveryDate"
                    defaultValue={order.deliveryDate ?? ""}
                  />
                </Field>
                <Field label={t("salesOrder.deliveryWindow")}>
                  <Input
                    name="deliveryWindow"
                    maxLength={60}
                    defaultValue={order.deliveryWindow ?? ""}
                    placeholder={t("salesOrder.deliveryWindowHint")}
                  />
                </Field>
                <Field label={t("salesOrder.note")}>
                  <Input
                    name="note"
                    maxLength={1000}
                    defaultValue={order.note ?? ""}
                  />
                </Field>
              </div>
              <SubmitButton variant="secondary" data-sales-order-save>
                {t("salesOrder.save")}
              </SubmitButton>
            </>
          ) : (
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-zinc-500">
                  {t("salesOrder.deliveryDate")}
                </dt>
                <dd>
                  {order.deliveryDate
                    ? formatDate(`${order.deliveryDate}T12:00:00Z`, t)
                    : "—"}
                  {order.deliveryWindow ? ` · ${order.deliveryWindow}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">
                  {t("salesOrder.paymentCondition")}
                </dt>
                <dd>
                  {conditions.find((c) => c.id === order.paymentConditionId)
                    ?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">
                  {t("salesOrder.purchaseOrder")}
                </dt>
                <dd>
                  {purchase ? (
                    <Link
                      href={`/app/orders/${purchase.id}`}
                      className={linkClass}
                    >
                      #{purchase.number}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          )}
        </form>
        {editable ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={confirmSalesOrderAction}>
              <input type="hidden" name="id" value={order.id} />
              <SubmitButton data-sales-order-confirm>
                {t("salesOrder.confirm")}
              </SubmitButton>
            </form>
            <form action={cancelSalesOrderAction}>
              <input type="hidden" name="id" value={order.id} />
              <SubmitButton variant="danger">
                {t("salesOrder.cancel")}
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </Card>
      {live ? (
        <Card title={t("salesOrder.erp")} dense>
          <div data-sales-order-erp={order.erpStatus}>
            {order.erpStatus === "synced" ? (
              <p className="text-sm text-emerald-700">
                {t("salesOrder.erp.syncedAs", { n: order.erpNumber ?? "" })}
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-zinc-600">
                  {order.erpStatus === "error"
                    ? t("salesOrder.erp.errorHint", {
                        reason: order.erpError ?? "",
                      })
                    : t("salesOrder.erp.pendingHint")}
                </p>
                <form
                  action={setSalesOrderErpNumberAction}
                  className="flex flex-wrap items-end gap-2"
                  data-sales-order-erp-form
                >
                  <input type="hidden" name="id" value={order.id} />
                  <Input
                    name="erpNumber"
                    required
                    maxLength={40}
                    placeholder={t("salesOrder.erp.number")}
                  />
                  <SubmitButton variant="secondary">
                    {t("salesOrder.erp.save")}
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
          {order.status === "confirmed" ? (
            <form action={cancelSalesOrderAction} className="mt-3">
              <input type="hidden" name="id" value={order.id} />
              <SubmitButton variant="danger">
                {t("salesOrder.cancel")}
              </SubmitButton>
            </form>
          ) : null}
        </Card>
      ) : null}
      {live ? (
        <Card title={t("salesOrder.invoice")} dense>
          <div data-sales-order-invoice={order.invoiceNumber ? "done" : "open"}>
            {order.invoiceNumber ? (
              <p className="text-sm text-emerald-700">
                {t("salesOrder.invoice.done", { n: order.invoiceNumber })}
                {order.invoiceDocumentId ? (
                  <>
                    {" · "}
                    <a
                      href={`/api/files/${order.invoiceDocumentId}`}
                      className={linkClass}
                    >
                      {t("salesOrder.invoice.open")}
                    </a>
                  </>
                ) : null}
              </p>
            ) : canInvoice(user) ? (
              <>
                <p className="mb-2 text-sm text-zinc-600">
                  {t("salesOrder.invoice.hint")}
                </p>
                <form
                  action={registerSalesInvoiceAction}
                  className="grid gap-3 sm:grid-cols-3"
                  data-sales-order-invoice-form
                >
                  <input type="hidden" name="id" value={order.id} />
                  <Field label={t("salesOrder.invoice.number")}>
                    <Input name="invoiceNumber" required maxLength={40} />
                  </Field>
                  <Field label={t("salesOrder.invoice.file")}>
                    <Input type="file" name="invoiceFile" />
                  </Field>
                  <div className="flex items-end">
                    <SubmitButton variant="secondary">
                      {t("salesOrder.invoice.save")}
                    </SubmitButton>
                  </div>
                </form>
              </>
            ) : (
              <p className="text-sm text-zinc-600">
                {t("salesOrder.invoice.waiting")}
              </p>
            )}
          </div>
        </Card>
      ) : null}
      {live ? (
        <Card title={t("salesOrder.ship")} dense>
          <div data-sales-order-ship={out ? "done" : "open"}>
            {out ? (
              <p className="text-sm text-emerald-700">
                {t("salesOrder.ship.done", {
                  date: dayOf(order.shippedAt),
                  carrier: carrierName,
                })}
                {order.freightValue != null
                  ? ` · ${t("salesOrder.ship.freight")}: ${order.freightValue.toLocaleString(t.intl, { minimumFractionDigits: 2 })}`
                  : ""}
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-zinc-600">
                  {t("salesOrder.ship.hint")}
                </p>
                <form
                  action={shipSalesOrderAction}
                  className="grid gap-3 sm:grid-cols-5"
                  data-sales-order-ship-form
                >
                  <input type="hidden" name="id" value={order.id} />
                  <Field label={t("salesOrder.ship.carrier")}>
                    <Select name="carrierId" required defaultValue="">
                      <option value="">—</option>
                      <option value="pickup">
                        {t("salesOrder.ship.pickup")}
                      </option>
                      {carriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("salesOrder.ship.date")}>
                    <Input type="date" name="shippedOn" />
                  </Field>
                  <Field label={t("salesOrder.ship.freight")}>
                    <Input name="freightValue" inputMode="decimal" />
                  </Field>
                  <Field label={t("salesOrder.ship.freightDays")}>
                    <Input
                      name="freightDays"
                      inputMode="numeric"
                      defaultValue="0"
                    />
                  </Field>
                  <div className="flex items-end">
                    <SubmitButton disabled={!order.invoiceNumber}>
                      {t("salesOrder.ship.submit")}
                    </SubmitButton>
                  </div>
                </form>
              </>
            )}
          </div>
        </Card>
      ) : null}
      {out ? (
        <Card title={t("salesOrder.deliver")} dense>
          <div data-sales-order-deliver={order.status}>
            {order.status === "delivered" ? (
              <p className="text-sm text-emerald-700">
                {t("salesOrder.deliver.done", {
                  date: dayOf(order.deliveredAt),
                  who: order.receivedBy ?? "—",
                })}
                {order.proofDocumentId ? (
                  <>
                    {" · "}
                    <a
                      href={`/api/files/${order.proofDocumentId}`}
                      className={linkClass}
                    >
                      {t("salesOrder.deliver.proof")}
                    </a>
                  </>
                ) : null}
              </p>
            ) : (
              <form
                action={deliverSalesOrderAction}
                className="grid gap-3 sm:grid-cols-4"
                data-sales-order-deliver-form
              >
                <input type="hidden" name="id" value={order.id} />
                <Field label={t("salesOrder.deliver.date")}>
                  <Input type="date" name="deliveredOn" />
                </Field>
                <Field label={t("salesOrder.deliver.receivedBy")}>
                  <Input name="receivedBy" required maxLength={120} />
                </Field>
                <Field label={t("salesOrder.deliver.proof")}>
                  <Input type="file" name="proofFile" required />
                </Field>
                <div className="flex items-end">
                  <SubmitButton>{t("salesOrder.deliver.submit")}</SubmitButton>
                </div>
              </form>
            )}
          </div>
        </Card>
      ) : null}
      {out ? (
        <Card title={t("salesReturn.title")} dense>
          <div className="space-y-4" data-sales-returns={returns.length}>
            {returns.map((r) => (
              <div
                key={r.id}
                className="rounded border border-zinc-200 p-3"
                data-sales-return={r.status}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    tone={
                      r.status === "closed"
                        ? "success"
                        : r.status === "cancelled"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t(`salesReturn.status.${r.status}` as DictionaryKey)}
                  </Badge>
                  <span>{formatDate(r.createdAt, t)}</span>
                  <span className="text-zinc-600">· {r.reason}</span>
                </div>
                <ul className="mb-2 text-sm">
                  {r.lines.map((l) => (
                    <li key={l.productId}>
                      {l.name}: {fmtQty(l.quantity)} {l.unit}
                      {r.status === "closed"
                        ? ` (${t("salesReturn.check.done", { good: fmtQty(l.goodQty), loss: fmtQty(l.lossQty) })})`
                        : ""}
                    </li>
                  ))}
                </ul>
                {r.lossNote ? (
                  <p className="mb-2 text-xs text-zinc-600">
                    {t("salesReturn.check.lossNote")}: {r.lossNote}
                  </p>
                ) : null}
                <p className="text-sm">
                  {t("salesReturn.invoice")}:{" "}
                  {r.invoiceNumber ? (
                    <>
                      {r.invoiceNumber}
                      {r.invoiceDocumentId ? (
                        <>
                          {" · "}
                          <a
                            href={`/api/files/${r.invoiceDocumentId}`}
                            className={linkClass}
                          >
                            {t("salesOrder.invoice.open")}
                          </a>
                        </>
                      ) : null}
                    </>
                  ) : r.status === "open" ? (
                    t("salesReturn.invoice.waiting")
                  ) : (
                    "—"
                  )}
                </p>
                {r.status === "open" && !r.invoiceNumber && canInvoice(user) ? (
                  <form
                    action={registerReturnInvoiceAction}
                    className="mt-2 grid gap-3 sm:grid-cols-3"
                    data-sales-return-invoice-form
                  >
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="returnId" value={r.id} />
                    <Field label={t("salesOrder.invoice.number")}>
                      <Input name="invoiceNumber" required maxLength={40} />
                    </Field>
                    <Field label={t("salesOrder.invoice.file")}>
                      <Input type="file" name="invoiceFile" />
                    </Field>
                    <div className="flex items-end">
                      <SubmitButton variant="secondary">
                        {t("salesOrder.invoice.save")}
                      </SubmitButton>
                    </div>
                  </form>
                ) : null}
                {r.status === "open" && r.invoiceNumber ? (
                  quality ? (
                    <form
                      action={checkSalesReturnAction}
                      className="mt-2 space-y-2"
                      data-sales-return-check-form
                    >
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="returnId" value={r.id} />
                      <p className="text-xs font-medium text-zinc-700">
                        {t("salesReturn.check")}
                      </p>
                      {r.lines.map((l, i) => (
                        <Field
                          key={l.productId}
                          label={`${l.name} · ${t("salesReturn.check.good")}`}
                        >
                          <input
                            type="hidden"
                            name="productId"
                            value={l.productId}
                          />
                          <Input
                            dense
                            name={`goodQty_${i}`}
                            inputMode="decimal"
                            defaultValue={l.quantity}
                            className="w-28 text-right"
                          />
                        </Field>
                      ))}
                      <Field label={t("salesReturn.check.lossNote")}>
                        <Input name="lossNote" maxLength={1000} />
                      </Field>
                      <SubmitButton>
                        {t("salesReturn.check.submit")}
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-600">
                      {t("salesReturn.check.waiting")}
                    </p>
                  )
                ) : null}
                {r.status === "open" ? (
                  <form action={cancelSalesReturnAction} className="mt-2">
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="returnId" value={r.id} />
                    <SubmitButton variant="secondary">
                      {t("salesReturn.cancel")}
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            ))}
            {[...returnable.values()].some((q) => q > 1e-6) ? (
              <form
                action={openSalesReturnAction}
                className="space-y-3"
                data-sales-return-form
              >
                <input type="hidden" name="id" value={order.id} />
                <p className="text-sm text-zinc-600">{t("salesReturn.hint")}</p>
                <Table tools={false}>
                  <thead>
                    <tr>
                      <Th>{t("salesOrder.product")}</Th>
                      <Th className="text-right">
                        {t("salesReturn.returnable")}
                      </Th>
                      <Th className="text-right">{t("salesReturn.qty")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((l, i) => (
                      <tr key={`${l.productId}-${i}`}>
                        <Td>
                          <input
                            type="hidden"
                            name="productId"
                            value={l.productId}
                          />
                          {l.name}
                        </Td>
                        <Td className="text-right">
                          {fmtQty(
                            Math.max(0, returnable.get(l.productId) ?? 0),
                          )}{" "}
                          {l.unit}
                        </Td>
                        <Td className="text-right">
                          <Input
                            dense
                            name={`returnQty_${i}`}
                            inputMode="decimal"
                            className="w-24 text-right"
                            aria-label={t("salesReturn.qty")}
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Field label={t("salesReturn.reason")}>
                  <Input name="reason" required maxLength={1000} />
                </Field>
                <SubmitButton variant="secondary">
                  {t("salesReturn.submit")}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}
