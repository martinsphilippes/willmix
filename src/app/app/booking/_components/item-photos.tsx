import type { Translate } from "@/i18n";
import { Badge } from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { QuickDialog } from "@/components/quick-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  addBookingItemPhotosAction,
  removeBookingItemPhotoAction,
  setBookingItemMainPhotoAction,
} from "../../actions/booking-lots";

/*
 * Fotos do item do book (dono, 26/11/2026; docs/BOOKING.md, "Fotos do
 * item"): na célula Foto, a principal e o cartão como sempre e, abaixo, o
 * "+" para carregar mais fotos e o botão com o número de fotos, que abre a
 * galeria do item (abrir, tornar principal, tirar do item). A principal é a
 * que aparece na tabela e segue para a seleção.
 */

const thumb = "h-10 w-10 rounded border border-zinc-200 object-cover";

export function BookingItemPhotosCell({
  t,
  lotId,
  itemId,
  label,
  photos,
  cardDocumentId,
  canEdit,
  max,
}: {
  t: Translate;
  lotId: string;
  itemId: string;
  /** Como o item é chamado no título da galeria (nº do item ou da linha). */
  label: string;
  /** As fotos do item, a principal primeiro. */
  photos: string[];
  cardDocumentId: string | null;
  /** Book não cancelado: dá para carregar, trocar a principal e tirar. */
  canEdit: boolean;
  max: number;
}) {
  const [main] = photos;
  const shown = [main, cardDocumentId].filter((d): d is string => !!d);
  const hidden = (fields: Record<string, string>) =>
    Object.entries(fields).map(([name, value]) => (
      <input key={name} type="hidden" name={name} value={value} />
    ));
  const addForm = (inDialog: boolean) =>
    canEdit && photos.length < max ? (
      <form
        action={addBookingItemPhotosAction}
        data-booking-item-photo-add={inDialog ? "dialog" : "cell"}
      >
        {hidden({ lotId, itemId })}
        <PhotoInput
          name="photo"
          compact
          plus={!inDialog}
          dense={inDialog}
          autoSubmit
          direct
          multiple
          capture={false}
          label={t("bookingLots.photos.add")}
          pendingLabel={t("bookingLots.photos.pending")}
          uploadingLabel={t("bookingLots.photos.uploading")}
          failedLabel={t("bookingLots.photos.failed")}
        />
      </form>
    ) : null;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex gap-1">
        {shown.map((doc) => (
          <a
            key={doc}
            href={`/api/files/${doc}`}
            target="_blank"
            rel="noreferrer"
            title={
              doc === cardDocumentId
                ? t("bookingLots.item.card")
                : t("bookingLots.item.col.photo")
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={`/api/files/${doc}?thumb=1`}
              alt=""
              className={thumb}
              loading="lazy"
            />
          </a>
        ))}
        {!shown.length ? <span className="text-zinc-400">—</span> : null}
      </span>
      {canEdit || photos.length > 1 ? (
        <span className="flex items-center gap-1">
          {addForm(false)}
          {photos.length ? (
            <QuickDialog
              label={
                <span data-booking-item-photo-count={photos.length}>
                  📷 {photos.length}
                </span>
              }
              hint={t("bookingLots.photos.manage", { n: photos.length })}
              title={t("bookingLots.photos.title", { item: label })}
              closeLabel={t("bookingLots.photos.close")}
              size="lg"
              className="h-9 px-2"
              data-booking-item-photos={itemId}
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((doc, i) => (
                  <li
                    key={doc}
                    className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-2"
                    data-booking-item-photo-doc={doc}
                  >
                    <a
                      href={`/api/files/${doc}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t("bookingLots.photos.open")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                      <img
                        src={`/api/files/${doc}`}
                        alt=""
                        className="aspect-square w-full rounded border border-zinc-100 object-contain"
                        loading="lazy"
                      />
                    </a>
                    {i === 0 ? (
                      <Badge tone="info">{t("bookingLots.photos.main")}</Badge>
                    ) : canEdit ? (
                      <form action={setBookingItemMainPhotoAction}>
                        {hidden({ lotId, itemId, documentId: doc })}
                        <SubmitButton
                          variant="secondary"
                          className="w-full px-2 py-0.5 text-xs"
                          pendingText={t("bookingLots.photos.pending")}
                        >
                          {t("bookingLots.photos.makeMain")}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {canEdit ? (
                      <form action={removeBookingItemPhotoAction}>
                        {hidden({ lotId, itemId, documentId: doc })}
                        <SubmitButton
                          variant="danger"
                          className="w-full px-2 py-0.5 text-xs"
                          pendingText={t("bookingLots.photos.pending")}
                          title={t("bookingLots.photos.removeHint")}
                        >
                          {t("bookingLots.photos.remove")}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  {addForm(true)}
                  <span>{t("bookingLots.photos.limit", { max })}</span>
                </div>
              ) : null}
            </QuickDialog>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
