import type { ProductPhoto } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { SHEET_PHOTO_KINDS } from "@/lib/services/purchase-sheet";
import { REQUIRED_SHEET_PHOTOS } from "@/lib/services/purchase-sheet-calc";
import { addProductPhotosAction } from "../../actions/catalog";
import { PhotoInput } from "@/components/photo-input";
import { cx } from "@/components/ui";

/**
 * Fotos que a ficha mestre exige (balança, régua, lateral, ângulo e
 * original): uma linha por tipo, verde quando já tem, vermelha quando falta,
 * com envio direto do tipo certo. Com as 5, a ficha mestre fica completa e os
 * pedidos e cotações do produto não precisam delas de novo.
 */
export function SheetPhotoChecklist({
  t,
  productId,
  photos,
  canEdit,
}: {
  t: Translate;
  productId: string;
  photos: Pick<ProductPhoto, "kind">[];
  canEdit: boolean;
}) {
  const rows = SHEET_PHOTO_KINDS.map((kind) => ({
    kind,
    field: REQUIRED_SHEET_PHOTOS[kind],
    count: photos.filter((p) => p.kind === kind).length,
  }));
  const done = rows.filter((r) => r.count > 0).length;
  return (
    <div
      id="sheet-photos"
      className="mb-4 scroll-mt-24 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
      data-sheet-photo-checklist={`${done}/${rows.length}`}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("productPhotos.sheet.title")}
        </h3>
        <span
          className={cx(
            "text-xs font-semibold",
            done === rows.length ? "text-emerald-700" : "text-red-700",
          )}
        >
          {t("productPhotos.sheet.status", { done, total: rows.length })}
        </span>
      </div>
      <p className="mb-2 text-xs leading-relaxed text-zinc-600">
        {t("productPhotos.sheet.hint")}
      </p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const ok = row.count > 0;
          return (
            <li
              key={row.kind}
              data-field-anchor={row.field}
              data-missing={ok ? undefined : "true"}
              data-sheet-photo={row.kind}
              className={cx(
                "flex scroll-mt-24 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border px-2.5 py-1.5",
                ok
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-red-300 bg-red-50",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={cx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    ok
                      ? "bg-emerald-600 text-white"
                      : "border-2 border-red-400 bg-white text-red-600",
                  )}
                >
                  {ok ? "✓" : "!"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">
                    {t(`catalog.photoKind.${row.kind}` as DictionaryKey)}
                  </p>
                  <p
                    className={cx(
                      "text-[11px] leading-4",
                      ok
                        ? "font-medium text-emerald-800"
                        : "font-semibold text-red-700",
                    )}
                  >
                    {ok
                      ? t("sheet.photos.count", { n: String(row.count) })
                      : t("productPhotos.sheet.missing")}
                  </p>
                </div>
              </div>
              {canEdit ? (
                <form action={addProductPhotosAction} className="shrink-0">
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="kind" value={row.kind} />
                  {/* Envia sozinho ao escolher ou tirar a foto (sem botão Enviar). */}
                  <PhotoInput
                    name="photos"
                    label={ok ? t("sheet.photos.more") : t("sheet.photos.add")}
                    pendingLabel={t("sheet.photos.sending")}
                    capture={false}
                    maxDimension={1400}
                    quality={0.78}
                    autoSubmit
                    compact
                    dense
                  />
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
