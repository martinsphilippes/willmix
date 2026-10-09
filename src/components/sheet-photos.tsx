import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { ProductPhoto } from "@/lib/db";
import { Card, cx } from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { REQUIRED_SHEET_PHOTOS } from "@/lib/services/purchase-sheet-calc";
import { SHEET_PHOTO_KINDS } from "@/lib/services/purchase-sheet";

/*
 * Fotos da ficha de compra: uma linha por tipo, verde com check quando já tem
 * foto; escolher a foto já envia. Serve à ficha do pedido e à da cotação.
 */
export function SheetPhotosCard({
  t,
  photos: allPhotos,
  canEdit,
  ownerField,
  ownerId,
  addAction,
  removeAction,
  hint,
  coveredKinds = [],
  className = "mt-4",
  missing = [],
}: {
  /** Fotos obrigatórias que faltam (scalePhoto…): ficam em vermelho e o aviso leva até elas. */
  missing?: readonly string[];
  t: Translate;
  photos: ProductPhoto[];
  canEdit: boolean;
  /** Campo escondido que identifica a ficha: pedido ou cotação. */
  ownerField: "orderId" | "quoteId";
  ownerId: string;
  addAction: (form: FormData) => Promise<void>;
  removeAction: (form: FormData) => Promise<void>;
  hint?: string;
  /** Tipos cobertos pelas fotos do cadastro do produto (sem precisar reenviar). */
  coveredKinds?: string[];
  className?: string;
}) {
  return (
    <Card title={t("sheet.section.photos")} className={className} dense>
      <span id="photos" className="block scroll-mt-24" />
      <p className="mb-2 text-xs leading-relaxed text-zinc-600">
        {hint ?? t("sheet.photos.hint")}
      </p>
      {/* Uma linha por tipo de foto; verde com check quando já tem foto.
          Fotos antigas de tipos que saíram da ficha (referência, cartão) ficam
          visíveis e excluíveis, mas sem botão de adicionar. */}
      <ul className="space-y-1.5">
        {[
          ...SHEET_PHOTO_KINDS,
          ...new Set(
            allPhotos
              .map((p) => p.kind)
              .filter(
                (k) => !(SHEET_PHOTO_KINDS as readonly string[]).includes(k),
              ),
          ),
        ].map((kind) => {
          const photos = allPhotos.filter((p) => p.kind === kind);
          const required = kind in REQUIRED_SHEET_PHOTOS;
          const addable = (SHEET_PHOTO_KINDS as readonly string[]).includes(
            kind,
          );
          const covered = coveredKinds.includes(kind);
          const done = photos.length > 0 || covered;
          const name = t(`catalog.photoKind.${kind}` as DictionaryKey);
          const field = required
            ? REQUIRED_SHEET_PHOTOS[kind as keyof typeof REQUIRED_SHEET_PHOTOS]
            : null;
          const lacking = !done && !!field && missing.includes(field);
          return (
            <li
              key={kind}
              data-field-anchor={field ?? undefined}
              data-missing={lacking ? "true" : undefined}
              className={cx(
                "flex scroll-mt-24 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-2.5 py-1.5 transition",
                done
                  ? "border-emerald-300 bg-emerald-50"
                  : lacking
                    ? "border-red-400 bg-red-50"
                    : "border-zinc-200 bg-white",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
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
                      className="h-4 w-4"
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
                  <p className="text-[13px] font-semibold leading-5 text-zinc-900">
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
                  {covered && photos.length === 0 ? (
                    <span
                      className="mt-0.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800"
                      data-photo-covered={kind}
                    >
                      {t("sheet.photos.fromCatalog")}
                    </span>
                  ) : null}
                  <p
                    className={cx(
                      "text-[11px] leading-4",
                      done ? "font-medium text-emerald-800" : "text-zinc-500",
                    )}
                  >
                    {done
                      ? t("sheet.photos.count", { n: String(photos.length) })
                      : t("sheet.photos.none")}
                  </p>
                </div>
              </div>
              {canEdit && addable ? (
                <form action={addAction} className="shrink-0">
                  <input type="hidden" name={ownerField} value={ownerId} />
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
                    dense
                    direct
                    uploadingLabel={t("photo.uploading")}
                    failedLabel={t("photo.failed")}
                  />
                </form>
              ) : null}
              {done ? (
                <ul className="flex flex-wrap gap-2 pr-1">
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
                          className="h-10 w-10 object-cover"
                        />
                      </a>
                      {canEdit ? (
                        <form
                          action={removeAction}
                          className="absolute -right-2 -top-2"
                        >
                          <input
                            type="hidden"
                            name={ownerField}
                            value={ownerId}
                          />
                          <input type="hidden" name="photoId" value={p.id} />
                          <ConfirmDeleteButton
                            label={t("sheet.photos.remove")}
                            confirmText={t("sheet.photos.removeConfirm")}
                            className="h-6 w-6"
                          />
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
