import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { aiErrorText } from "@/i18n/ai-error";
import type { SheetReadingScope } from "@/lib/db";
import type { SheetReadingView } from "@/lib/services/sheet-reading";
import type { ReadingField } from "@/lib/services/sheet-reading-calc";
import {
  readSheetBoardAction,
  resolveReadingDivergenceAction,
} from "@/app/app/actions/sheet-reading";
import { Alert, Card, cx, formatDate } from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";

/**
 * Ficha pela foto do quadro: quem edita a ficha envia a foto do quadro
 * preenchido à mão; a IA preenche os campos vazios e o que diverge da ficha
 * fica listado até a Wellmix decidir qual vale. A foto fica guardada.
 */
export function SheetBoardReader({
  t,
  scope,
  sheetKey,
  view,
  canRead,
  canResolve,
  error,
  board,
  className,
}: {
  t: Translate;
  scope: SheetReadingScope;
  sheetKey: string;
  view: SheetReadingView | null;
  /** Quem edita a ficha (fornecedor da cotação ou Wellmix). */
  canRead: boolean;
  /** Só a Wellmix decide as divergências. */
  canResolve: boolean;
  error?: string | string[];
  /** Volta da leitura: "preenchidos-divergentes" ou "resolved". */
  board?: string | string[];
  className?: string;
}) {
  if (!canRead && !view) return null;
  const label = (f: ReadingField) => t(`sheet.field.${f}` as DictionaryKey);
  const show = (f: ReadingField, v: string | number) =>
    f === "sheetDate"
      ? formatDate(String(v), t.intl)
      : typeof v === "number"
        ? v.toLocaleString(t.intl, { maximumFractionDigits: 4 })
        : v;
  const code = typeof error === "string" ? error : "";
  const errorText =
    code === "photo_required"
      ? t("board.error.photo_required")
      : code.startsWith("ai_")
        ? (aiErrorText(t, code) ??
          (t(`vision.error.${code}` as DictionaryKey) !== `vision.error.${code}`
            ? t(`vision.error.${code}` as DictionaryKey)
            : t("board.error.failed", { code })))
        : null;
  const done = typeof board === "string" ? board.match(/^(\d+)-(\d+)$/) : null;
  const divergences = view?.divergences ?? [];

  return (
    <Card
      title={t("board.title")}
      dense
      className={cx("scroll-mt-24", className)}
    >
      <div id="board" className="space-y-3" data-sheet-board={scope}>
        {canRead ? (
          <p className="text-xs text-zinc-600">{t("board.intro")}</p>
        ) : null}
        {done ? (
          <Alert tone="success">
            <span data-board-done="">
              {t("board.done", { filled: done[1], divergent: done[2] })}
            </span>
          </Alert>
        ) : board === "resolved" ? (
          <Alert tone="success">
            <span data-board-resolved="">{t("board.resolved")}</span>
          </Alert>
        ) : null}
        {errorText ? (
          <Alert tone="danger">
            <span data-board-error={code}>{errorText}</span>
          </Alert>
        ) : null}
        {canRead ? (
          <form
            action={readSheetBoardAction}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="sheetKey" value={sheetKey} />
            {/* Lê assim que a foto é escolhida ou tirada (um toque só);
                foto maior que as da ficha, para a letra à mão ficar legível. */}
            <PhotoInput
              name="photo"
              label={t("board.send")}
              pendingLabel={t("board.sending")}
              multiple={false}
              capture={false}
              maxDimension={2200}
              quality={0.85}
              autoSubmit
              compact
              direct
              uploadingLabel={t("photo.uploading")}
              failedLabel={t("photo.failed")}
            />
          </form>
        ) : null}
        {view ? (
          <div className="space-y-1 text-xs text-zinc-600">
            <p>
              {t("board.last", {
                date: formatDate(view.reading.createdAt, t.intl),
              })}{" "}
              ·{" "}
              <a
                href={`/api/files/${view.reading.documentId}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-700 underline-offset-2 hover:underline"
                data-board-photo=""
              >
                {t("board.viewPhoto")}
              </a>
            </p>
            {view.reading.source === "mock" ? (
              <p className="font-medium text-amber-700">{t("board.mock")}</p>
            ) : null}
            {view.readFields.length ? (
              <p>
                {t("board.read", {
                  fields: view.readFields.map(label).join(", "),
                })}
              </p>
            ) : null}
            {view.reading.notes ? (
              <p>{t("board.notes", { notes: view.reading.notes })}</p>
            ) : null}
          </div>
        ) : null}
        {divergences.length ? (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 p-2.5"
            data-board-divergences={divergences.length}
          >
            <p className="text-sm font-semibold text-amber-900">
              {t("board.divergent.title")}
            </p>
            {!canResolve ? (
              <p className="text-xs text-amber-800">
                {t("board.divergent.supplierHint")}
              </p>
            ) : null}
            <ul className="mt-2 space-y-2">
              {divergences.map((d) => (
                <li
                  key={d.field}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"
                  data-board-divergence={d.field}
                >
                  <span className="min-w-36 font-medium text-zinc-900">
                    {label(d.field)}
                  </span>
                  <span className="tabular-nums text-zinc-800">
                    {t("board.divergent.photo")}:{" "}
                    <strong data-board-photo-value="">
                      {show(d.field, d.photo)}
                    </strong>
                  </span>
                  <span className="tabular-nums text-zinc-800">
                    {t("board.divergent.sheet")}:{" "}
                    <strong data-board-sheet-value="">
                      {show(d.field, d.sheet)}
                    </strong>
                  </span>
                  {canResolve && view ? (
                    <span className="flex flex-wrap gap-2">
                      {(["photo", "sheet"] as const).map((choice) => (
                        <form
                          key={choice}
                          action={resolveReadingDivergenceAction}
                        >
                          <input type="hidden" name="scope" value={scope} />
                          <input
                            type="hidden"
                            name="sheetKey"
                            value={sheetKey}
                          />
                          <input
                            type="hidden"
                            name="readingId"
                            value={view.reading.id}
                          />
                          <input type="hidden" name="field" value={d.field} />
                          <input type="hidden" name="choice" value={choice} />
                          <SubmitButton
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                          >
                            {choice === "photo"
                              ? t("board.usePhoto")
                              : t("board.useSheet")}
                          </SubmitButton>
                        </form>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : view ? (
          <p className="text-xs font-medium text-emerald-700" data-board-ok="">
            {t("board.none")}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
