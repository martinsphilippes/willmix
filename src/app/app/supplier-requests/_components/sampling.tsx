import type { SamplingFile, SupplierRequest } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  SAMPLING_ACCEPT,
  SAMPLING_MAX_FILES,
  samplingCanReview,
  samplingCanSubmit,
  samplingCanUpload,
  samplingDueAt,
  samplingLate,
  samplingOf,
  samplingRoundFiles,
} from "@/lib/supplier-request-sampling";
import { Badge, Card, Field, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FileAutoInput } from "@/components/file-auto-input";
import {
  addSamplingFileAction,
  removeSamplingFileAction,
  reviewSamplingAction,
  submitSamplingAction,
} from "../../actions/supplier-requests";
import { dateTime } from "./negotiation";
import { SAMPLING_TONE } from "./status";

/*
 * Amostragem (docs/SUPPLIER_SAMPLING.md): depois da aprovação, o responsável
 * pelo booking sobe fotos e vídeos de uma amostra e envia; a Wellmix aprova
 * ou reprova com o motivo (reprovada, ele manda outra rodada).
 */

function FileTile({
  file,
  t,
  removable,
  requestId,
}: {
  file: SamplingFile;
  t: Translate;
  removable: boolean;
  requestId: string;
}) {
  const src = `/api/files/${file.documentId}`;
  return (
    <li
      className="flex w-40 flex-col gap-1"
      data-sampling-file={file.documentId}
      data-sampling-kind={file.kind}
    >
      {file.kind === "video" ? (
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          className="h-28 w-40 rounded-lg border border-zinc-200 bg-black object-contain"
        />
      ) : (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
          <img
            src={src}
            alt={t("sampling.files.open", { name: file.fileName })}
            className="h-28 w-40 rounded-lg border border-zinc-200 object-cover"
          />
        </a>
      )}
      <span className="flex items-center justify-between gap-1 text-xs text-zinc-600">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="truncate underline"
          title={file.fileName}
        >
          {t(
            file.kind === "video"
              ? "sampling.files.video"
              : "sampling.files.photo",
          )}
          {" · "}
          {file.fileName}
        </a>
        {removable ? (
          <form action={removeSamplingFileAction}>
            <input type="hidden" name="id" value={requestId} />
            <input type="hidden" name="documentId" value={file.documentId} />
            <button
              type="submit"
              className="rounded px-1 text-red-700 hover:bg-red-50"
              aria-label={t("sampling.files.remove", { name: file.fileName })}
              title={t("sampling.files.remove", { name: file.fileName })}
              data-sampling-remove={file.documentId}
            >
              ✕
            </button>
          </form>
        ) : null}
      </span>
    </li>
  );
}

export function SamplingCard({
  request: r,
  wellmix,
  canValidate,
  slaDays,
  t,
}: {
  request: SupplierRequest;
  wellmix: boolean;
  /** A Wellmix com a ação "Validar a amostragem". */
  canValidate: boolean;
  /** SLA da amostragem (dias), de Configurações → SLA. */
  slaDays: number;
  t: Translate;
}) {
  const s = samplingOf(r);
  if (!s) return null;
  const dueAt = samplingDueAt(s, slaDays);
  const late = samplingLate(s, slaDays);
  const current = samplingRoundFiles(s);
  const previous = s.files.filter((f) => f.round !== s.round);
  const canUpload = !wellmix && samplingCanUpload(s);
  const lastReject = [...s.history].reverse().find((e) => e.kind === "reject");
  const lastSubmit = [...s.history].reverse().find((e) => e.kind === "submit");
  // A rodada aprovada/enviada mostra os arquivos dela; a reprovada abre a
  // seguinte (os da reprovada ficam em "Rodadas anteriores").
  return (
    <section id="amostragem" className="scroll-mt-24" data-sampling={s.status}>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("sampling.title")}
            <Badge tone={SAMPLING_TONE[s.status]}>
              <span data-sampling-status>
                {t(`sampling.status.${s.status}` as DictionaryKey)}
              </span>
            </Badge>
            <span className="text-xs font-normal text-zinc-500">
              {t("sampling.round", { n: s.round })}
            </span>
            {dueAt ? (
              <span
                className={cx(
                  "text-xs",
                  late
                    ? "font-semibold text-red-700"
                    : "font-normal text-zinc-500",
                )}
                data-sampling-due={late ? "late" : "ok"}
              >
                {late ? `${t("sampling.late")} · ` : ""}
                {t("sampling.due", { date: dateTime(dueAt, t) })}
              </span>
            ) : null}
          </span>
        }
      >
        <p className="mb-3 text-sm text-zinc-600">
          {t(wellmix ? "sampling.intro.wellmix" : "sampling.intro.supplier")}
        </p>

        {s.status === "rejected" && lastReject?.text ? (
          <p
            className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800"
            data-sampling-reject-reason
          >
            {lastReject.text}
          </p>
        ) : null}

        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("sampling.files.title", { n: s.round })}
        </h3>
        {current.length ? (
          <ul className="mt-2 flex flex-wrap gap-3">
            {current.map((f) => (
              <FileTile
                key={f.documentId}
                file={f}
                t={t}
                removable={canUpload}
                requestId={r.id}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">
            {t("sampling.files.none")}
          </p>
        )}
        {lastSubmit?.text && s.status !== "rejected" ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
            {lastSubmit.text}
          </p>
        ) : null}

        {canUpload ? (
          <div className="mt-4 space-y-3" data-sampling-upload>
            <form action={addSamplingFileAction}>
              <input type="hidden" name="id" value={r.id} />
              <FileAutoInput
                name="file"
                accept={SAMPLING_ACCEPT}
                label={t("sampling.upload.label")}
                pendingLabel={t("sampling.upload.pending")}
                uploadingLabel={t("sampling.upload.uploading")}
                tooBigLabel={t("sampling.upload.tooBig")}
                serverOnlyLabel={t("sampling.upload.serverOnly")}
                failedLabel={t("sampling.upload.failed")}
              />
            </form>
            <p className="text-xs text-zinc-500">
              {t("sampling.upload.hint", { max: SAMPLING_MAX_FILES })}
            </p>
            <form
              action={submitSamplingAction}
              className="space-y-2"
              data-sampling-submit-form
            >
              <input type="hidden" name="id" value={r.id} />
              <Field label={t("sampling.submit.note")}>
                <Textarea name="note" rows={2} maxLength={2000} />
              </Field>
              {samplingCanSubmit(s) ? (
                <SubmitButton
                  pendingText={t("sampling.submit.pending")}
                  data-sampling-submit
                >
                  {t("sampling.submit.button")}
                </SubmitButton>
              ) : (
                <p className="text-xs text-amber-800">
                  {t("sampling.submit.needFile")}
                </p>
              )}
            </form>
          </div>
        ) : null}

        {!wellmix && s.status === "submitted" ? (
          <p className="mt-3 text-sm text-zinc-600" data-sampling-waiting>
            {t("sampling.waiting.supplier", {
              date: dateTime(s.submittedAt, t),
            })}
          </p>
        ) : null}
        {wellmix && samplingCanUpload(s) ? (
          <p className="mt-3 text-sm text-zinc-600" data-sampling-waiting>
            {t("sampling.waiting.wellmix")}
          </p>
        ) : null}
        {s.status === "approved" ? (
          <p className="mt-3 text-sm text-emerald-700">
            {t("sampling.approvedAt", { date: dateTime(s.reviewedAt, t) })}
          </p>
        ) : null}

        {wellmix && samplingCanReview(s) ? (
          canValidate ? (
            <form
              action={reviewSamplingAction}
              className="mt-4 space-y-2"
              data-sampling-review-form
            >
              <input type="hidden" name="id" value={r.id} />
              <Field label={t("sampling.review.note")}>
                <Textarea name="note" rows={2} maxLength={2000} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton
                  name="decision"
                  value="approve"
                  data-sampling-review="approve"
                >
                  {t("sampling.review.approve")}
                </SubmitButton>
                <SubmitButton
                  name="decision"
                  value="reject"
                  variant="danger"
                  data-sampling-review="reject"
                >
                  {t("sampling.review.reject")}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              {t("sampling.review.noPermission")}
            </p>
          )
        ) : null}

        {previous.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("sampling.files.previous")} ·{" "}
              {t("sampling.files.count", { n: previous.length })}
            </summary>
            <ul className="mt-2 flex flex-wrap gap-3">
              {previous.map((f) => (
                <FileTile
                  key={f.documentId}
                  file={f}
                  t={t}
                  removable={false}
                  requestId={r.id}
                />
              ))}
            </ul>
          </details>
        ) : null}

        {/* O histórico (envios, validações e comentários) fica só no
            "Histórico de interações" da tela, sem repetir aqui. */}
      </Card>
    </section>
  );
}
