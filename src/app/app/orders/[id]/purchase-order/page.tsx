import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { isWellmix } from "@/lib/auth/permissions";
import {
  getOrderSignatureView,
  releaseOrderBySignature,
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
import { FileAutoInput } from "@/components/file-auto-input";
import { pendingTasksFor } from "@/lib/services/tasks";
import {
  reopenSupplierSignatureAction,
  sendOrderForSignatureAction,
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
  const { error, signed, reopened, sent } = await searchParams;
  let view = await getOrderSignatureView(user, id);
  if (!view) notFound();
  // Pedido que a Wellmix assinou sem marcar "conferido e liberado": a
  // assinatura dela libera o fornecedor (antes ele ficava sem onde assinar).
  if (view.supplierBlocked && (await releaseOrderBySignature(id)))
    view = (await getOrderSignatureView(user, id)) ?? view;
  const t = await getT();
  const { order, document: doc, hash } = view;
  const sheet = await buildOrderSheet(order, doc, view.wellmix);
  /* Fornecedor: entra no pedido por aqui. As pendências dele neste pedido
     aparecem no alto, cada uma com o atalho para a tela onde se resolve. */
  const isSupplier = user.role === "supplier";
  const myTasks =
    isSupplier && canOpen(user, "tasks")
      ? (await pendingTasksFor(user)).filter(
          (task) =>
            task.link.startsWith(`/app/orders/${order.id}`) &&
            !task.link.startsWith(`/app/orders/${order.id}/purchase-order`),
        )
      : [];
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
  // O fornecedor tem as duas opções lado a lado (portal ou arquivo); o
  // administrador, registrando por ele, anexa o arquivo no mesmo formulário.
  const supplierTurn = view.canSign === "supplier";
  // Pedido de compra (docs/PURCHASE_ORDER.md): as duas partes baixam o
  // contrato, assinam, carimbam e sobem o arquivo (sem o aceite no portal).
  const purchase = order.flow === "supplier_request";
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
          : supplierTurn
            ? t("orderSign.option.portal")
            : t("orderSign.form.title")}
      </p>
      {!onBehalf && supplierTurn ? (
        <p className="text-sm text-zinc-700">
          {t("orderSign.option.portal.hint")}
        </p>
      ) : null}
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
      {onBehalf ? (
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

  // Opção 2 do fornecedor: baixa o PDF, assina e envia o arquivo. Escolher o
  // arquivo já registra a assinatura; arquivo grande sobe direto ao
  // armazenamento (não passa pelo teto da requisição).
  const pdfHref = `/api/orders/${order.id}/purchase-order`;
  const fileForm = (
    <form
      action={signOrderDocumentAction}
      className="space-y-3 rounded-xl border border-brand-200 bg-white p-3"
      data-order-sign-file
      data-order-signed-upload
    >
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="hash" value={hash} />
      <input type="hidden" name="agree" value="on" />
      <p className="text-sm font-semibold text-zinc-900">
        {t("orderSign.option.file")}
      </p>
      <p className="text-sm text-zinc-700">{t("orderSign.option.file.hint")}</p>
      <a href={pdfHref} download className={linkClass} data-order-pdf-step>
        {t("orderSign.download")}
      </a>
      <Field label={t("orderSign.option.file.name")}>
        <Input
          name="name"
          required
          minLength={3}
          maxLength={120}
          autoComplete="name"
          defaultValue={user.name}
        />
      </Field>
      <FileAutoInput
        name="signedFile"
        label={t("orderSign.option.file.send")}
        pendingLabel={t("requirement.sending")}
        uploadingLabel={t("requirement.file.uploading")}
        tooBigLabel={t("requirement.file.tooBig")}
        serverOnlyLabel={t("requirement.file.serverOnly")}
        failedLabel={t("requirement.file.failed")}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="w-full"
      />
      <p className="text-xs text-zinc-500">{t("orderSign.option.file.note")}</p>
    </form>
  );
  const signTurn = view.canSign ? (
    <Card title={t("orderSign.turn.title")} dense className="print:hidden">
      <div
        id="assinar"
        className="scroll-mt-24 space-y-3"
        data-order-sign-turn={view.canSign}
      >
        <p className="text-sm text-zinc-700">
          {purchase
            ? t("purchaseOrder.sign.hint")
            : supplierTurn
              ? t("orderSign.turn.hint.supplier")
              : t("orderSign.turn.hint.wellmix")}
        </p>
        {purchase ? (
          fileForm
        ) : (
          <div className={supplierTurn ? "grid gap-3 md:grid-cols-2" : ""}>
            {signForm(false)}
            {supplierTurn ? fileForm : null}
          </div>
        )}
      </div>
    </Card>
  ) : null;

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
            {t(isSupplier ? "orderSign.back.supplier" : "orderSign.back")}
          </Link>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {purchase && view.document.finalArts ? (
        <Card title={t("purchaseOrder.contract.arts")} dense>
          {view.document.finalArts.length ? (
            <ul className="flex flex-wrap gap-3" data-contract-final-arts>
              {view.document.finalArts.map((a) => (
                <li key={a.documentId} className="text-sm">
                  <a
                    href={`/api/files/${a.documentId}`}
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("purchaseOrder.contract.artsPending")}
            </p>
          )}
        </Card>
      ) : null}
      {signed ? <Alert tone="success">{t("orderSign.done")}</Alert> : null}
      {sent ? <Alert tone="success">{t("orderSign.send.done")}</Alert> : null}
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
      {myTasks.length ? (
        <div
          className="space-y-1 rounded-xl border border-amber-300 bg-amber-50/60 p-3 text-sm print:hidden"
          data-order-my-tasks
        >
          <p className="font-semibold text-zinc-900">
            {t("orderSign.tasks.title")}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {myTasks.map((task, i) => (
              <li key={i}>
                <Link href={task.link} className={linkClass}>
                  {task.text
                    ? t(task.text.title, task.text.values)
                    : task.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!view.applies ? (
        <Alert tone="info">{t("orderSign.notApplicable")}</Alert>
      ) : view.awaitingSend ? (
        // Ordem nova: primeiro a arte e o selo, depois o envio para assinatura.
        <Alert tone={view.sendBlockers.length ? "warning" : "info"}>
          <div className="space-y-2" data-order-awaiting-send>
            {isWellmix(user) ? (
              <>
                <p>
                  {view.sendBlockers.length
                    ? t(`orderSign.send.missing.${view.sendBlockers[0]}`)
                    : t("orderSign.send.ready")}
                </p>
                <p className="text-xs">{t("orderSign.send.who")}</p>
                {view.canSend ? (
                  <form action={sendOrderForSignatureAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <SubmitButton>{t("orderSign.send.submit")}</SubmitButton>
                  </form>
                ) : null}
              </>
            ) : (
              <p>{t("orderSign.awaitingSend.supplier")}</p>
            )}
          </div>
        </Alert>
      ) : view.samplesPending && isWellmix(user) ? (
        // Pedido de amostras (docs/SAMPLE_ORDER.md): a Wellmix decide antes de assinar.
        <Alert tone="warning">
          <span data-sign-wait-samples>
            {t("sampleOrder.signWait")}{" "}
            <Link
              href={`/app/orders/${order.id}/samples`}
              className={linkClass}
            >
              {t("sampleOrder.open")}
            </Link>
          </span>
        </Alert>
      ) : view.waitingWellmix ? (
        <Alert tone="warning">{t("orderSign.waitingWellmix")}</Alert>
      ) : view.supplierBlocked ? (
        // A liberação automática não conseguiu: diz a cada lado o que falta.
        <Alert tone="warning">
          <span data-order-sign-blocked>
            {isWellmix(user)
              ? t("orderSign.blocked.wellmix")
              : t("orderSign.blocked.supplier")}
          </span>
        </Alert>
      ) : null}
      {signTurn}
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
            {doc.manufacturers?.length ? (
              <div className="sm:col-span-2" data-order-document-manufacturer>
                <p className="font-semibold">{t("orderSign.manufacturer")}</p>
                <p>{doc.manufacturers.join(", ")}</p>
              </div>
            ) : null}
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
