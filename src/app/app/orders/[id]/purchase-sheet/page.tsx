import { notFound, redirect } from "next/navigation";
import { fallbackError } from "@/i18n/error-text";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  LinkButton,
  PageHeader,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PurchaseSheetFields } from "@/components/purchase-sheet-fields";
import { PhotoInput } from "@/components/photo-input";
import { REQUIRED_SHEET_PHOTOS } from "@/lib/services/purchase-sheet-calc";
import {
  getSheetForUser,
  SHEET_PHOTO_KINDS,
  type SheetView,
} from "@/lib/services/purchase-sheet";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  addPurchaseSheetPhotosAction,
  removePurchaseSheetPhotoAction,
  savePurchaseSheetAction,
} from "../../../actions/purchase-sheet";

/*
 * Ficha de compra (planilha COMPRAS) da Preparação. Pensada para o celular do
 * comprador/fornecedor em Yiwu: campos grandes, teclado numérico, salvar a
 * qualquer momento. Peças, CBM, containers e datas são calculados no servidor.
 */
export default async function PurchaseSheetPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/purchase-sheet">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { saved, error, photos: photosSent, photoRemoved } = await searchParams;
  const view = await getSheetForUser(user, id);
  if (!view) notFound();
  const t = await getT();
  const [item] = await getStore().list("order_items", {
    filter: { orderId: id },
    limit: 1,
  });
  const { sheet, access, plan, missing } = view;
  const missingText = missing
    .map((k) => t(`sheet.field.${k}` as DictionaryKey))
    .join(", ");
  const errorKey = `sheet.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string"
      ? t(errorKey as DictionaryKey) !== errorKey
        ? t(errorKey as DictionaryKey)
        : fallbackError(t, String(error))
      : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("sheet.title")}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t("sheet.subtitle", {
              number: String(view.order.number),
              product: item?.name ?? "—",
            })}
            {missing.length === 0 ? (
              <Badge tone="success">{t("sheet.complete")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <LinkButton href={`/app/orders/${id}`}>{t("sheet.back")}</LinkButton>
        }
      />
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-600">
        {t("sheet.intro")}
      </p>
      <div className="mb-4 space-y-3">
        {saved === "complete" ? (
          <Alert tone="success">{t("sheet.saved.complete")}</Alert>
        ) : saved === "partial" ? (
          <Alert tone="warning">
            {t("sheet.saved.partial", { fields: missingText })}
          </Alert>
        ) : missing.length ? (
          <Alert tone="info">
            {t("sheet.missing", { fields: missingText })}
          </Alert>
        ) : null}
        {photoRemoved === "1" ? (
          <Alert tone="success">{t("sheet.photos.removed")}</Alert>
        ) : null}
        {typeof photosSent === "string" ? (
          <Alert tone="success">{t("sheet.photos.sent")}</Alert>
        ) : null}
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {!view.saved && access.editSupplier ? (
          <Alert tone="neutral">{t("sheet.prefilled")}</Alert>
        ) : null}
        {!access.editSupplier && !access.editCustoms ? (
          <Alert tone="neutral">{t("sheet.readOnly")}</Alert>
        ) : null}
      </div>

      <form action={savePurchaseSheetAction} className="space-y-6">
        <input type="hidden" name="orderId" value={id} />

        <PurchaseSheetFields
          t={t}
          sheet={sheet}
          plan={plan}
          containerType={view.containerType}
          containerTypes={view.containerTypes}
          editSupplier={access.editSupplier}
          editCustoms={access.editCustoms}
        />

        {access.editSupplier || access.editCustoms ? (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <SubmitButton className="w-full py-3 text-base sm:w-auto">
              {t("sheet.save")}
            </SubmitButton>
          </div>
        ) : null}
      </form>

      <Photos view={view} t={t} orderId={id} />
    </>
  );
}

function Photos({
  view,
  t,
  orderId,
}: {
  view: SheetView;
  t: Translate;
  orderId: string;
}) {
  return (
    <Card title={t("sheet.section.photos")} className="mt-6">
      <span id="photos" className="block scroll-mt-24" />
      <p className="mb-4 text-sm leading-relaxed text-zinc-600">
        {t("sheet.photos.hint")}
      </p>
      {/* Uma linha por tipo de foto; verde com check quando já tem foto. */}
      <ul className="space-y-3">
        {SHEET_PHOTO_KINDS.map((kind) => {
          const photos = view.photos.filter((p) => p.kind === kind);
          const required = kind in REQUIRED_SHEET_PHOTOS;
          const done = photos.length > 0;
          const name = t(`catalog.photoKind.${kind}` as DictionaryKey);
          return (
            <li
              key={kind}
              className={cx(
                "flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-center sm:gap-4",
                done
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-zinc-200 bg-white",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-emerald-600 text-white"
                      : required
                        ? "border-2 border-brand-300 text-brand-600"
                        : "border-2 border-zinc-300 text-zinc-400",
                  )}
                  aria-hidden
                >
                  {done ? (
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    {name}
                    {required ? (
                      <span
                        className="ml-0.5 font-semibold text-brand-600"
                        title={t("sheet.required")}
                      >
                        <span aria-hidden>*</span>
                        <span className="sr-only">({t("sheet.required")})</span>
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={cx(
                      "text-xs",
                      done ? "font-medium text-emerald-800" : "text-zinc-500",
                    )}
                  >
                    {done
                      ? t("sheet.photos.count", { n: String(photos.length) })
                      : t("sheet.photos.none")}
                  </p>
                </div>
              </div>
              {done ? (
                <ul className="flex flex-wrap gap-3 pr-2 pt-2">
                  {photos.map((p) => (
                    <li key={p.id} className="relative">
                      <a
                        href={`/api/files/${p.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-emerald-200 bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                        <img
                          src={`/api/files/${p.documentId}`}
                          alt={name}
                          loading="lazy"
                          className="h-16 w-16 object-cover"
                        />
                      </a>
                      {view.access.addPhotos ? (
                        <form
                          action={removePurchaseSheetPhotoAction}
                          className="absolute -right-2 -top-2"
                        >
                          <input type="hidden" name="orderId" value={orderId} />
                          <input type="hidden" name="photoId" value={p.id} />
                          <ConfirmDeleteButton
                            label={t("sheet.photos.remove")}
                            confirmText={t("sheet.photos.removeConfirm")}
                          />
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {view.access.addPhotos ? (
                <form
                  action={addPurchaseSheetPhotosAction}
                  className="shrink-0"
                >
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="kind" value={kind} />
                  {/* Envia sozinho ao escolher ou tirar a foto (sem botão Enviar);
                      sem "capture", o iPad oferece câmera e biblioteca. */}
                  <PhotoInput
                    name="photos"
                    label={
                      done ? t("sheet.photos.more") : t("sheet.photos.add")
                    }
                    pendingLabel={t("sheet.photos.sending")}
                    capture={false}
                    maxDimension={1400}
                    quality={0.78}
                    autoSubmit
                    compact
                    className="w-full sm:w-auto"
                  />
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
