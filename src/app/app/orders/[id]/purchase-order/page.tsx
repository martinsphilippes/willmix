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
import { buildOrderSheet } from "@/lib/services/order-sheet";
import { OrderSheetView } from "@/components/order-sheet-view";
import { describeTerms } from "@/components/supplier-terms-text";
import {
  Alert,
  Card,
  Badge,
  Field,
  Input,
  PageHeader,
  Textarea,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  reopenSupplierSignatureAction,
  signOrderDocumentAction,
} from "../../../actions/order-signature";

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
  const { error, signed, reopened } = await searchParams;
  const view = await getOrderSignatureView(user, id);
  if (!view) notFound();
  const t = await getT();
  const { order, document: doc, hash } = view;
  const sheet = await buildOrderSheet(order, doc, view.wellmix);
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
          <p className="mt-1 text-xs text-zinc-600" data-signature-method>
            {signature.method === "file"
              ? t("orderSign.signed.file")
              : t("orderSign.signed.accept")}
            {signature.documentId ? (
              <>
                {": "}
                <a
                  href={`/api/files/${signature.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                  data-signed-file
                >
                  {t("orderSign.signed.file")}
                </a>
              </>
            ) : null}
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
  // Fornecedor (ou o administrador registrando por ele): pode anexar o PDF
  // assinado; a Wellmix assina pelo aceite.
  const supplierSide = (onBehalf: boolean) =>
    onBehalf || view.canSign === "supplier";
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
      {supplierSide(onBehalf) ? (
        <>
          <p className="text-sm text-zinc-700" data-sign-steps>
            <span className="font-medium">{t("orderSign.file.title")}: </span>
            {t("orderSign.file.steps")}
          </p>
          <Field label={t("orderSign.file.label.optional")}>
            <Input
              type="file"
              name="signedFile"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
          </Field>
        </>
      ) : null}
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
      {reopened ? (
        <Alert tone="success">{t("orderSign.reopened")}</Alert>
      ) : null}
      {view.applies ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 print:hidden"
          data-order-document-status={view.status}
        >
          <Badge
            tone={
              view.status === "in_erp"
                ? "success"
                : view.status === "signed"
                  ? "info"
                  : "warning"
            }
          >
            {t(`orderSign.status.${view.status}`, {
              n: order.erpNumber ?? "",
            })}
          </Badge>
          {/* Rota de arquivo (não é página): link comum, que baixa o PDF. */}
          <a
            href={`/api/orders/${order.id}/purchase-order`}
            download
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            data-order-pdf
          >
            {t("orderSign.download")}
          </a>
        </div>
      ) : null}
      {/* Fornecedor: baixar, assinar e enviar de volta, logo no alto (o
          formulário completo, com o aceite no portal, continua no fim). */}
      {view.canSign === "supplier" ? (
        <form
          action={signOrderDocumentAction}
          className="space-y-2 rounded-xl border border-brand-300 bg-brand-50/60 p-3 print:hidden"
          data-order-signed-upload
        >
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="hash" value={hash} />
          <input type="hidden" name="name" value={user.name} />
          <input type="hidden" name="agree" value="on" />
          <p className="text-sm font-semibold text-zinc-900">
            {t("orderSign.upload.title")}
          </p>
          <p className="text-sm text-zinc-700">{t("orderSign.upload.hint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <a
              href={`/api/orders/${order.id}/purchase-order`}
              download
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              {t("orderSign.download")}
            </a>
            <Input
              type="file"
              name="signedFile"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
              aria-label={t("orderSign.file.label")}
              className="max-w-xs"
            />
            <SubmitButton>{t("orderSign.upload.submit")}</SubmitButton>
          </div>
        </form>
      ) : null}
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
              <dt className="font-semibold">{t("orderSign.moq")}</dt>
              <dd>
                {doc.moq
                  ? t("orderSign.moq.value", {
                      n: doc.moq.toLocaleString(t.intl),
                    })
                  : "—"}
              </dd>
            </div>
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
      {/* A folha do pedido no modelo da Wellmix: é assim que sai no PDF. */}
      <Card title={t("orderSign.sheet.title")} dense>
        <p className="mb-2 text-xs text-zinc-600 print:hidden">
          {t("orderSign.sheet.hint")}
        </p>
        <OrderSheetView sheet={sheet} />
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
          {view.canReopenSupplier ? (
            <details className="print:hidden">
              <summary className={linkClass}>
                {t("orderSign.reopen.title")}
              </summary>
              <form
                action={reopenSupplierSignatureAction}
                className="mt-2 space-y-2"
                data-order-sign-reopen
              >
                <input type="hidden" name="orderId" value={order.id} />
                <Field label={t("orderSign.reopen.reason")}>
                  <Textarea name="reason" rows={2} maxLength={500} required />
                </Field>
                <SubmitButton variant="secondary">
                  {t("orderSign.reopen.submit")}
                </SubmitButton>
              </form>
            </details>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
