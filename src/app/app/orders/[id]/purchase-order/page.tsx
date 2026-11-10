import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  getOrderSignatureView,
  type OrderSignature,
} from "@/lib/services/order-signature";
import { describeTerms } from "@/components/supplier-terms-text";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { signOrderDocumentAction } from "../../../actions/order-signature";

/*
 * Documento do pedido com as duas assinaturas (docs/ORDER_SIGNATURE.md). Só a
 * Wellmix e o fornecedor do pedido abrem: tem o preço de compra.
 */
export default async function PurchaseOrderPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/purchase-order">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id } = await params;
  const { error, signed } = await searchParams;
  const view = await getOrderSignatureView(user, id);
  if (!view) notFound();
  const t = await getT();
  const { order, document: doc, hash } = view;
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `orderSign.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const money = (n: number | null, digits = 2) =>
    n === null
      ? "—"
      : `${doc.currency} ${n.toLocaleString(t.intl, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })}`;
  const cell = "border border-zinc-300 px-2 py-1";
  const signatureLine = (
    side: "wellmix" | "supplier",
    signature: OrderSignature | null,
  ) => (
    <div
      className="rounded-xl border border-zinc-200 p-3"
      data-order-signature={side}
      data-signed={signature ? "yes" : "no"}
    >
      <p className="text-sm font-semibold text-zinc-900">
        {t(`orderSign.side.${side}`)}
        {": "}
        <span className="font-normal">
          {side === "wellmix" ? doc.buyerName : doc.supplierName}
        </span>
      </p>
      {signature ? (
        <>
          <p className="mt-1 text-sm text-zinc-800">
            {signature.onBehalf
              ? t("orderSign.signed.onBehalf", {
                  name: signature.name,
                  date: formatDate(signature.at, t),
                  by: signature.userName,
                })
              : t("orderSign.signed", {
                  name: signature.name,
                  date: formatDate(signature.at, t),
                })}
          </p>
          {signature.hash !== hash ? (
            <p className="mt-1 text-xs text-amber-700" data-signature-old>
              {t("orderSign.signed.old")}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">{t("orderSign.pending")}</p>
      )}
    </div>
  );
  const signForm = (onBehalf: boolean) => (
    <form
      action={signOrderDocumentAction}
      className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3 print:hidden"
      data-order-sign-form={onBehalf ? "on-behalf" : "own"}
    >
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="hash" value={hash} />
      {onBehalf ? <input type="hidden" name="onBehalf" value="1" /> : null}
      <p className="text-sm font-semibold text-zinc-900">
        {onBehalf
          ? t("orderSign.form.title.onBehalf")
          : t("orderSign.form.title")}
      </p>
      <Field
        label={
          onBehalf
            ? t("orderSign.form.name.onBehalf")
            : t("orderSign.form.name")
        }
      >
        <Input
          name="name"
          required
          minLength={3}
          maxLength={120}
          autoComplete="name"
          defaultValue={onBehalf ? "" : user.name}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input type="checkbox" name="agree" required className="mt-1" />
        <span>
          {onBehalf
            ? t("orderSign.form.agree.onBehalf")
            : t("orderSign.form.agree")}
        </span>
      </label>
      <SubmitButton>
        {onBehalf
          ? t("orderSign.form.submit.onBehalf")
          : t("orderSign.form.submit")}
      </SubmitButton>
      <p className="text-xs text-zinc-500">{t("orderSign.form.note")}</p>
    </form>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        t={t}
        title={t("orderSign.title", { n: String(order.number) })}
        subtitle={t("orderSign.subtitle")}
        actions={
          <Link
            href={`/app/orders/${order.id}`}
            className={`${linkClass} print:hidden`}
          >
            {t("orderSign.back")}
          </Link>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {signed ? <Alert tone="success">{t("orderSign.done")}</Alert> : null}
      {!view.applies ? (
        <Alert tone="info">{t("orderSign.notApplicable")}</Alert>
      ) : view.waitingWellmix ? (
        <Alert tone="warning">{t("orderSign.waitingWellmix")}</Alert>
      ) : null}
      <Card>
        <section className="space-y-4" data-order-document={hash}>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold">{t("orderSign.buyer")}</p>
              <p>{doc.buyerName}</p>
            </div>
            <div>
              <p className="font-semibold">{t("orderSign.supplier")}</p>
              <p>{doc.supplierName || "—"}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left">
                  <th className={cell}>{t("orderSign.item")}</th>
                  <th className={`${cell} text-right`}>{t("orderSign.qty")}</th>
                  <th className={`${cell} text-right`}>
                    {t("orderSign.unitPrice")}
                  </th>
                  <th className={`${cell} text-right`}>
                    {t("orderSign.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, i) => (
                  <tr key={i}>
                    <td className={cell}>
                      {item.name}
                      {item.variant ? ` · ${item.variant}` : ""}
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {item.quantity.toLocaleString(t.intl)} {item.unit}
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {money(item.unitPrice, 4)}
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {money(item.total)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className={cell} colSpan={3}>
                    {t("orderSign.total")}
                    {doc.incoterm ? ` ${doc.incoterm}` : ""}
                  </td>
                  <td
                    className={`${cell} text-right tabular-nums`}
                    data-order-total
                  >
                    {money(doc.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">{t("orderSign.leadTime")}</dt>
              <dd>
                {doc.leadTimeDays
                  ? t("orderSign.leadTime.days", { n: doc.leadTimeDays })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t("orderSign.payment")}</dt>
              <dd>
                {doc.paymentTerms.length
                  ? describeTerms(t, doc.paymentTerms)
                  : t("orderSign.payment.none")}
              </dd>
            </div>
            {doc.packagingOkVersion ? (
              <div className="sm:col-span-2">
                <dt className="font-semibold">{t("orderSign.packaging")}</dt>
                <dd>
                  {t("orderSign.packaging.ok", { n: doc.packagingOkVersion })}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="break-all text-xs text-zinc-500">
            {t("orderSign.version", { hash })}
          </p>
        </section>
      </Card>
      <Card title={t("orderSign.signatures")} dense>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {signatureLine("wellmix", view.wellmix)}
            {signatureLine("supplier", view.supplier)}
          </div>
          {view.canSign ? signForm(false) : null}
          {view.canRegisterSupplier ? (
            <details className="print:hidden">
              <summary className={linkClass}>
                {t("orderSign.form.title.onBehalf")}
              </summary>
              <div className="mt-2">{signForm(true)}</div>
            </details>
          ) : null}
          <p className="text-xs text-zinc-500 print:hidden">
            {t("orderSign.print")}: Ctrl/⌘ + P
          </p>
        </div>
      </Card>
    </div>
  );
}
