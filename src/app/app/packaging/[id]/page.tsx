import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionError } from "@/components/action-error";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore, type PackagingItemKey } from "@/lib/db";
import {
  getPackagingBriefView,
  type PackagingItemView,
} from "@/lib/services/packaging-brief";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  Textarea,
  cx,
  formatDate,
  isOverdue,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { FileAutoInput } from "@/components/file-auto-input";
import { BRIEF_TONE, OwnerSelect } from "@/components/packaging-brief-card";
import {
  assignPackagingBriefAction,
  clearPackagingItemAction,
  confirmPackagingDimsAction,
  saveAgencyNotesAction,
  savePackagingBriefTextAction,
  savePackagingDimsAction,
  uploadPackagingItemAction,
} from "../../actions/packaging-brief";

const num = (intl: string, n: number | null | undefined, digits = 1) =>
  n === null || n === undefined
    ? null
    : n.toLocaleString(intl, { maximumFractionDigits: digits });

/**
 * Tela do briefing de embalagem para a agência (ou o marketing da Wellmix):
 * o que é (produto, quantidade, fotos, medidas, instruções) e os entregáveis
 * (faca, arte, gráfica, foto), cada um com envio direto. Nada de preço,
 * cotações ou fornecedores concorrentes.
 */
export default async function PackagingBriefPage({
  params,
  searchParams,
}: PageProps<"/app/packaging/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const {
    error,
    saved,
    fields: invalidFields,
    at: errorToken,
  } = await searchParams;
  const view = await getPackagingBriefView(user, id);
  if (!view) notFound();
  const t = await getT();
  const {
    brief,
    request,
    product,
    items,
    missing,
    canEdit,
    wellmix,
    presale,
    order,
    orderArt,
    photos,
  } = view;
  const errorCode = typeof error === "string" ? error : "";
  const errorText = !errorCode
    ? null
    : ([
        `packBrief.error.${errorCode}`,
        `orders.error.${errorCode}`,
        `common.${errorCode}`,
      ]
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? t("common.error"));
  const dims = brief.dims;
  const dimsSource = !brief.dimsSource
    ? null
    : brief.dimsSource === "quote" && brief.dimsProvisional
      ? t("packBrief.dims.source.quoteProvisional")
      : t(`packBrief.dims.source.${brief.dimsSource}` as DictionaryKey);
  // Trocar o dono: só antes do pedido (depois, a agência é a do pedido).
  const agencies =
    wellmix && (brief.status === "open" || brief.status === "ready")
      ? await getStore().list("parties", {
          filter: { type: "agency", active: true },
          orderBy: "name",
        })
      : [];
  const savedText =
    typeof saved !== "string"
      ? null
      : ["dieline", "art", "print_ready", "packaging_sample"].includes(saved)
        ? t("packBrief.uploaded")
        : t("packBrief.saved");

  return (
    <>
      <PageHeader
        t={t}
        title={t("packBrief.detailTitle", { product: request.productName })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={BRIEF_TONE[brief.status]}>
              {t(`packBrief.status.${brief.status}` as DictionaryKey)}
            </Badge>
            {presale ? (
              <Badge tone="warning">{t("packBrief.presale")}</Badge>
            ) : null}
            {request.number ? (
              <span className="text-xs text-zinc-500">
                {t("packBrief.request", { n: request.number })}
              </span>
            ) : null}
            {brief.dueAt ? (
              <span
                className={cx(
                  "text-xs",
                  brief.status === "open" && isOverdue(brief.dueAt)
                    ? "font-semibold text-red-700"
                    : "text-zinc-500",
                )}
              >
                {t("packBrief.col.deadline")}: {formatDate(brief.dueAt, t)}
              </span>
            ) : null}
          </span>
        }
        actions={
          wellmix ? (
            <Link href={`/app/requests/${request.id}`} className={linkClass}>
              {t("packBrief.request", { n: request.number ?? "" })} →
            </Link>
          ) : null
        }
      />
      <div className="space-y-3">
        <ActionError
          t={t}
          code={errorCode}
          text={errorText}
          fields={invalidFields}
          token={errorToken}
        />
        {savedText ? <Alert tone="success">{savedText}</Alert> : null}
        {presale ? <Alert tone="info">{t("packBrief.presaleHint")}</Alert> : null}
        {brief.status === "ready" ? (
          <Alert tone="success">{t("packBrief.readyHint")}</Alert>
        ) : null}
        {order ? (
          <Alert tone="info">
            {t("packBrief.transferredHint", { n: order.number })}{" "}
            <Link href={`/app/orders/${order.id}`} className={linkClass}>
              {t("packBrief.openOrder")} →
            </Link>
            {orderArt ? (
              <span className="block text-xs" data-packaging-order-art>
                {orderArt.art?.status !== "done"
                  ? t("packBrief.orderArt.waitingArt")
                  : orderArt.approval?.status === "done"
                    ? orderArt.approval.value === "rejected"
                      ? t("packBrief.orderArt.rejected")
                      : t("packBrief.orderArt.approved")
                    : t("packBrief.orderArt.pending")}
              </span>
            ) : null}
          </Alert>
        ) : null}
        {brief.status === "cancelled" ? (
          <Alert tone="warning">{t("packBrief.cancelledHint")}</Alert>
        ) : null}
      </div>

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card title={t("packBrief.whatTitle")}>
            <DescriptionList
              items={(
                [
                  [t("common.product"), request.productName],
                  [
                    t("packBrief.quantity"),
                    `${request.quantity.toLocaleString(t.intl)} ${request.unit}`,
                  ],
                  view.customerName
                    ? [t("packBrief.customer"), view.customerName]
                    : null,
                  [
                    t("packBrief.supplier"),
                    view.supplierName ?? (
                      <span className="text-zinc-500">
                        {t("packBrief.supplierPending")}
                      </span>
                    ),
                  ],
                  wellmix
                    ? [
                        t("packBrief.owner.label"),
                        view.agencyName ?? t("packBrief.owner.wellmix"),
                      ]
                    : null,
                ] as Array<[React.ReactNode, React.ReactNode] | null>
              ).filter((x): x is [React.ReactNode, React.ReactNode] => !!x)}
            />
            {request.description ? (
              <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-700">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("packBrief.description")}
                </span>
                {request.description}
              </p>
            ) : null}
            {request.specification || product?.specification ? (
              <p className="mt-3 text-sm whitespace-pre-line text-zinc-700">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("packBrief.specification")}
                </span>
                {request.specification ?? product?.specification}
              </p>
            ) : null}
            {photos.length ? (
              <div className="mt-3 border-t border-zinc-100 pt-3">
                <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("packBrief.photos")}
                </span>
                <ul className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((p) => (
                    <li key={p.id}>
                      <a
                        href={`/api/files/${p.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${t("packBrief.photos")}: ${p.caption?.trim() || request.productName}`}
                        className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/files/${p.documentId}`}
                          alt=""
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card
            title={
              <span id="dims" className="scroll-mt-24">
                {t("packBrief.dimsTitle")}
                {dimsSource ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    ({dimsSource})
                  </span>
                ) : null}
              </span>
            }
          >
            {brief.dimsChangedAt ? (
              <div className="mb-3 space-y-2">
                <Alert tone="warning">
                  {t("packBrief.dims.changed", {
                    date: formatDate(brief.dimsChangedAt, t),
                  })}
                </Alert>
                {canEdit ? (
                  <form action={confirmPackagingDimsAction}>
                    <input type="hidden" name="briefId" value={brief.id} />
                    <SubmitButton variant="secondary" data-packaging-dims-confirm>
                      {t("packBrief.dims.confirm")}
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            ) : null}
            {dims ? (
              <DescriptionList
                items={[
                  [
                    t("packBrief.dims.carton"),
                    `${num(t.intl, dims.lengthCm)} × ${num(t.intl, dims.widthCm)} × ${num(t.intl, dims.heightCm)} cm`,
                  ],
                  [t("packBrief.dims.perCarton"), num(t.intl, dims.masterCartonQty, 0)],
                  [t("packBrief.dims.inner"), num(t.intl, dims.innerQty, 0)],
                  [t("packBrief.dims.cbm"), num(t.intl, dims.cbmPerCarton, 4)],
                  [t("packBrief.dims.package"), dims.packageType],
                  [t("packBrief.dims.material"), dims.material],
                  [t("packBrief.dims.capacity"), num(t.intl, dims.capacityMl, 0)],
                  [
                    t("packBrief.dims.pantone"),
                    dims.colorPantones?.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {dims.colorPantones.map((c) => (
                          <span
                            key={c.code}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-xs"
                          >
                            <span
                              className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10"
                              style={{ backgroundColor: c.hex }}
                              aria-hidden
                            />
                            {c.code}
                          </span>
                        ))}
                      </span>
                    ) : null,
                  ],
                ]}
              />
            ) : (
              <p className="text-sm text-zinc-600" data-packaging-no-dims>
                {t("packBrief.dims.none")}
              </p>
            )}
            {wellmix && brief.status !== "cancelled" ? (
              <form
                action={savePackagingDimsAction}
                className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-6"
              >
                <input type="hidden" name="briefId" value={brief.id} />
                <p className="col-span-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-6">
                  {t("packBrief.dims.form.title")}
                </p>
                <Field label={t("packBrief.dims.length")}>
                  <Input name="lengthCm" type="number" step="0.1" min="0" defaultValue={dims?.lengthCm ?? ""} required />
                </Field>
                <Field label={t("packBrief.dims.width")}>
                  <Input name="widthCm" type="number" step="0.1" min="0" defaultValue={dims?.widthCm ?? ""} required />
                </Field>
                <Field label={t("packBrief.dims.height")}>
                  <Input name="heightCm" type="number" step="0.1" min="0" defaultValue={dims?.heightCm ?? ""} required />
                </Field>
                <Field label={t("packBrief.dims.perCarton")}>
                  <Input name="masterCartonQty" type="number" step="1" min="0" defaultValue={dims?.masterCartonQty ?? ""} />
                </Field>
                <Field label={t("packBrief.dims.inner")}>
                  <Input name="innerQty" type="number" step="1" min="0" defaultValue={dims?.innerQty ?? ""} />
                </Field>
                <div className="flex items-end">
                  <SubmitButton variant="secondary">
                    {t("packBrief.dims.form.save")}
                  </SubmitButton>
                </div>
              </form>
            ) : null}
          </Card>

          <Card title={t("packBrief.instructions")}>
            {wellmix && brief.status !== "cancelled" ? (
              <form action={savePackagingBriefTextAction} className="space-y-2">
                <input type="hidden" name="briefId" value={brief.id} />
                <Textarea
                  name="brief"
                  rows={3}
                  maxLength={4000}
                  defaultValue={brief.brief ?? ""}
                  placeholder={t("packBrief.instructions.placeholder")}
                />
                <SubmitButton variant="secondary">
                  {t("packBrief.instructions.save")}
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm whitespace-pre-line text-zinc-700">
                {brief.brief ?? (
                  <span className="text-zinc-500">
                    {t("packBrief.instructions.none")}
                  </span>
                )}
              </p>
            )}
            {wellmix && agencies.length ? (
              <form
                action={assignPackagingBriefAction}
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3"
              >
                <input type="hidden" name="briefId" value={brief.id} />
                <div className="min-w-48 flex-1">
                  <Field label={t("packBrief.owner.label")}>
                    <OwnerSelect
                      t={t}
                      agencies={agencies}
                      value={brief.agencyId}
                      current={
                        brief.agencyId && view.agencyName
                          ? { id: brief.agencyId, name: view.agencyName }
                          : null
                      }
                      name="agencyId"
                      ariaLabel={t("packBrief.owner.label")}
                    />
                  </Field>
                </div>
                <SubmitButton variant="secondary">
                  {t("packBrief.owner.save")}
                </SubmitButton>
              </form>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={t("packBrief.itemsTitle")}>
            <ul className="@container divide-y divide-zinc-100" data-packaging-items>
              {items.map((item) => (
                <ItemRow
                  key={item.key}
                  t={t}
                  briefId={brief.id}
                  item={item}
                  justSaved={saved === item.key}
                  missing={missing.includes(item.key)}
                  canEdit={
                    canEdit &&
                    // Arte com a etapa do pedido aberta: pelo pedido (um caminho só);
                    // etapa concluída: a arte aprovada fica como está.
                    !(
                      item.key === "art" &&
                      (!!orderArt?.stageOpen || !!orderArt?.artLocked)
                    )
                  }
                  artInOrder={item.key === "art" && !!orderArt?.stageOpen}
                  artLocked={item.key === "art" && !!orderArt?.artLocked}
                  orderId={order?.id ?? null}
                />
              ))}
            </ul>
          </Card>

          <Card title={<span id="notes" className="scroll-mt-24">{t("packBrief.notes")}</span>}>
            {canEdit ? (
              <form action={saveAgencyNotesAction} className="space-y-2">
                <input type="hidden" name="briefId" value={brief.id} />
                <Textarea
                  name="agencyNotes"
                  rows={3}
                  maxLength={4000}
                  defaultValue={brief.agencyNotes ?? ""}
                  placeholder={t("packBrief.notes.placeholder")}
                />
                <SubmitButton variant="secondary">
                  {t("packBrief.notes.save")}
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm whitespace-pre-line text-zinc-700">
                {brief.agencyNotes ?? "—"}
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Uma linha de entregável: situação, arquivo vigente e envio (foto ou arquivo). */
function ItemRow({
  t,
  briefId,
  item,
  justSaved,
  missing,
  canEdit,
  artInOrder,
  artLocked,
  orderId,
}: {
  t: Translate;
  briefId: string;
  item: PackagingItemView;
  /** Acabou de ser enviado: a confirmação aparece aqui, onde a tela rola. */
  justSaved: boolean;
  missing: boolean;
  canEdit: boolean;
  artInOrder: boolean;
  /** Etapa do pedido concluída: a arte aprovada não se troca. */
  artLocked: boolean;
  orderId: string | null;
}) {
  const key: PackagingItemKey = item.key;
  const doc = item.document;
  const target = (
    <>
      <input type="hidden" name="briefId" value={briefId} />
      <input type="hidden" name="key" value={key} />
    </>
  );
  return (
    <li
      id={`item-${key}`}
      className="flex scroll-mt-24 flex-col gap-2 py-2.5 @xl:flex-row @xl:items-start @xl:justify-between"
      data-packaging-item={key}
      data-done={doc ? "1" : "0"}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-zinc-900">
          <span className={doc ? "text-emerald-700" : missing ? "text-amber-700" : "text-zinc-400"} aria-hidden>
            {doc ? "✓" : "○"}
          </span>
          {t(`packBrief.item.${key}` as DictionaryKey)}
          <span className="text-xs font-normal text-zinc-500">
            ({t(item.required ? "packBrief.item.required" : "packBrief.item.optional")})
          </span>
          {justSaved ? (
            <span
              className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
              data-packaging-saved
            >
              {t("packBrief.uploaded")}
            </span>
          ) : null}
        </p>
        {doc ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <a
              href={`/api/files/${doc.id}`}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
              data-packaging-file={key}
            >
              {doc.name}
            </a>
            <span>
              {t("packBrief.item.version", {
                version: doc.version,
                date: formatDate(doc.createdAt, t),
              })}
            </span>
            {canEdit ? (
              <form action={clearPackagingItemAction}>
                {target}
                <SubmitButton
                  variant="ghost"
                  className="h-6 px-1.5 text-xs text-red-700"
                  confirmText={t("packBrief.item.remove") + "?"}
                >
                  {t("packBrief.item.remove")}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : (
          <p className={cx("mt-0.5 text-xs", missing ? "text-amber-700" : "text-zinc-500")}>
            {t("packBrief.item.missing")}
          </p>
        )}
        {artInOrder && orderId ? (
          <p className="mt-0.5 text-xs text-zinc-600">
            {t("packBrief.transferredArtHint")}{" "}
            <Link href={`/app/orders/${orderId}`} className={linkClass}>
              {t("packBrief.openOrder")} →
            </Link>
          </p>
        ) : null}
        {artLocked ? (
          <p className="mt-0.5 text-xs text-zinc-600" data-packaging-art-locked>
            {t("packBrief.error.art_locked")}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <div
          className="flex w-full flex-col gap-1.5 @sm:flex-row @sm:flex-wrap @sm:items-start @xl:w-auto @xl:justify-end"
          data-packaging-upload={key}
        >
          <form action={uploadPackagingItemAction} className="flex flex-wrap items-center gap-1.5 w-full @sm:w-auto">
            {target}
            <PhotoInput
              name="file"
              multiple={false}
              capture={false}
              maxDimension={2400}
              quality={0.88}
              autoSubmit
              compact
              direct
              label={t("requirement.photo.add")}
              pendingLabel={t("requirement.sending")}
              uploadingLabel={t("photo.uploading")}
              failedLabel={t("photo.failed")}
              className="w-full @sm:w-auto"
            />
          </form>
          <form action={uploadPackagingItemAction} className="flex flex-wrap items-center gap-1.5 w-full @sm:w-auto">
            {target}
            <FileAutoInput
              name="file"
              label={t("requirement.file.add")}
              pendingLabel={t("requirement.sending")}
              uploadingLabel={t("requirement.file.uploading")}
              tooBigLabel={t("requirement.file.tooBig")}
              serverOnlyLabel={t("requirement.file.serverOnly")}
              failedLabel={t("requirement.file.failed")}
              className="w-full @sm:w-auto"
            />
          </form>
        </div>
      ) : null}
    </li>
  );
}
