import type { ReactNode } from "react";
import type {
  SamplingFile,
  SupplierRequest,
  SupplierRequestSampling,
} from "@/lib/db/schema";
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
  samplingFor,
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
  fields,
  removeAction,
}: {
  file: SamplingFile;
  t: Translate;
  removable: boolean;
  fields: ReactNode;
  removeAction: SamplingActions["remove"];
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
          <form action={removeAction}>
            {fields}
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

/** As quatro ações da amostragem (as da solicitação ou as da cotação). */
export interface SamplingActions {
  add: (form: FormData) => Promise<void>;
  remove: (form: FormData) => Promise<void>;
  submit: (form: FormData) => Promise<void>;
  review: (form: FormData) => Promise<void>;
}

const REQUEST_ACTIONS: SamplingActions = {
  add: addSamplingFileAction,
  remove: removeSamplingFileAction,
  submit: submitSamplingAction,
  review: reviewSamplingAction,
};

/** A amostragem de uma solicitação ao fornecedor. */
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
  const s = samplingFor(r);
  if (!s) return null;
  return (
    <SamplingPanel
      sampling={s}
      wellmix={wellmix}
      canValidate={canValidate}
      // O prazo só conta depois da aprovação; antes, ele pode adiantar.
      slaDays={r.status === "approved" ? slaDays : null}
      early={r.status !== "approved"}
      actions={REQUEST_ACTIONS}
      fields={<input type="hidden" name="id" value={r.id} />}
      t={t}
    />
  );
}

/**
 * Cartão da amostragem (da solicitação ou de um produto da cotação de
 * compra): arquivos da rodada, envio, validação e rodadas anteriores.
 * `fields` são os campos ocultos que dizem de quem é a amostragem.
 */
export function SamplingPanel({
  sampling: s,
  wellmix,
  canValidate,
  slaDays,
  early = false,
  actions,
  fields,
  title,
  anchor = "amostragem",
  t,
}: {
  sampling: SupplierRequestSampling;
  wellmix: boolean;
  canValidate: boolean;
  /** Nulo: sem prazo (amostragem adiantada, antes da decisão). */
  slaDays: number | null;
  /** Antes da decisão da Wellmix: ele já pode enviar. */
  early?: boolean;
  actions: SamplingActions;
  fields: ReactNode;
  /** Nome ao lado do título (o produto, na cotação com vários). */
  title?: string;
  anchor?: string | null;
  t: Translate;
}) {
  const dueAt = slaDays === null ? null : samplingDueAt(s, slaDays);
  const late = slaDays !== null && samplingLate(s, slaDays);
  const current = samplingRoundFiles(s);
  const previous = s.files.filter((f) => f.round !== s.round);
  const canUpload = !wellmix && samplingCanUpload(s);
  const lastReject = [...s.history].reverse().find((e) => e.kind === "reject");
  const lastSubmit = [...s.history].reverse().find((e) => e.kind === "submit");
  // A rodada aprovada/enviada mostra os arquivos dela; a reprovada abre a
  // seguinte (os da reprovada ficam em "Rodadas anteriores").
  return (
    <section
      id={anchor ?? undefined}
      className="scroll-mt-24"
      data-sampling={s.status}
    >
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("sampling.title")}
            {title ? (
              <span className="font-normal text-zinc-600">· {title}</span>
            ) : null}
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
          {t(
            early
              ? wellmix
                ? "sampling.intro.earlyWellmix"
                : "sampling.intro.earlySupplier"
              : wellmix
                ? "sampling.intro.wellmix"
                : "sampling.intro.supplier",
          )}
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
                fields={fields}
                removeAction={actions.remove}
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
            <form action={actions.add}>
              {fields}
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
              action={actions.submit}
              className="space-y-2"
              data-sampling-submit-form
            >
              {fields}
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
              action={actions.review}
              className="mt-4 space-y-2"
              data-sampling-review-form
            >
              {fields}
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
                  fields={fields}
                  removeAction={actions.remove}
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

/**
 * As imagens dentro da conversa (dono, 22/11/2026), em dois grupos com nome,
 * para os dois lados conversarem sobre o que estão vendo:
 * - "Referência da Wellmix": o que a Wellmix mandou para ele fazer a
 *   amostra (as fotos do cadastro do produto ou a foto do item do book);
 * - "Amostra do fornecedor": as fotos e os vídeos que ele já subiu na
 *   rodada atual, com a situação, mesmo antes de aprovada.
 * Sem nenhuma imagem, nada aparece.
 */
export function SampleStrip({
  sampling: s,
  reference = [],
  referenceFrom = "product",
  t,
}: {
  sampling: SupplierRequestSampling | null;
  /** Documentos das fotos de referência (produto do cadastro ou item do book). */
  reference?: string[];
  referenceFrom?: "product" | "book";
  t: Translate;
}) {
  const files = s ? samplingRoundFiles(s) : [];
  if (!files.length && !reference.length) return null;
  const tile = "h-24 w-32 rounded-md border border-zinc-200 object-cover";
  return (
    <div
      className="mb-2 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2"
      data-sample-strip={s?.status ?? "none"}
    >
      {reference.length ? (
        <div data-sample-strip-reference={referenceFrom}>
          <p className="mb-1.5 text-xs font-semibold text-zinc-700">
            {t("sampling.strip.reference")}{" "}
            <span className="font-normal text-zinc-500">
              {t(`sampling.strip.from.${referenceFrom}`)}
            </span>
          </p>
          <ul className="flex gap-2 overflow-x-auto">
            {reference.map((id) => (
              <li key={id} className="shrink-0">
                <a href={`/api/files/${id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img src={`/api/files/${id}`} alt="" className={tile} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {s && files.length ? (
        <div data-sample-strip-sample>
          <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-700">
            {t("sampling.strip.title")}
            <Badge tone={SAMPLING_TONE[s.status]}>
              {t(`sampling.status.${s.status}` as DictionaryKey)}
            </Badge>
            <span className="font-normal text-zinc-500">
              {t("sampling.round", { n: s.round })}
            </span>
          </p>
          <ul className="flex gap-2 overflow-x-auto">
            {files.map((f) => {
              const src = `/api/files/${f.documentId}`;
              return (
                <li
                  key={f.documentId}
                  className="shrink-0"
                  data-sample-strip-file
                >
                  {f.kind === "video" ? (
                    <video
                      src={src}
                      controls
                      preload="metadata"
                      playsInline
                      className="h-24 w-32 rounded-md border border-zinc-200 bg-black object-contain"
                    />
                  ) : (
                    <a href={src} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                      <img
                        src={src}
                        alt={t("sampling.files.open", { name: f.fileName })}
                        className={tile}
                      />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
