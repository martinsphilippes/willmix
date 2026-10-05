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
}: {
  t: Translate;
  photos: ProductPhoto[];
  canEdit: boolean;
  /** Campo escondido que identifica a ficha: pedido ou cotação. */
  ownerField: "orderId" | "quoteId";
  ownerId: string;
  addAction: (form: FormData) => Promise<void>;
  removeAction: (form: FormData) => Promise<void>;
  hint?: string;
}) {
  return (
    <Card title={t("sheet.section.photos")} className="mt-4">
      <span id="photos" className="block scroll-mt-24" />
      <p className="mb-4 text-sm leading-relaxed text-zinc-600">
        {hint ?? t("sheet.photos.hint")}
      </p>
      {/* Uma linha por tipo de foto; verde com check quando já tem foto.
          Fotos antigas de tipos que saíram da ficha (referência, cartão) ficam
          visíveis e excluíveis, mas sem botão de adicionar. */}
      <ul className="space-y-3">
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
                          />
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
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
