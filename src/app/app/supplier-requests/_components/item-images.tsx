import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { SupplierRequestSampling } from "@/lib/db/schema";
import {
  samplingCanReview,
  samplingDueAt,
  samplingLate,
  samplingRoundFiles,
} from "@/lib/supplier-request-sampling";
import { Badge, Card, Field, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { dateTime } from "./negotiation";
import { CopyImageButton } from "@/components/copy-image-button";
import { SAMPLING_TONE } from "./status";

/*
 * Imagens na tela do item da cotação (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Imagens na tela do item"): na coluna da
 * direita, sempre à vista enquanto se negocia, em grupos com nome:
 * - "Referência da Wellmix": o que a Wellmix mandou ao fornecedor (as fotos
 *   do cadastro do produto ou a foto do item do book);
 * - "Amostra de <fornecedor>": o que cada fornecedor já subiu na rodada
 *   atual, com a situação, mesmo antes de aprovada.
 * Cada foto abre grande num clique e tem o botão de copiar, para colar no
 * chat e citar um ponto. Fora do chat, que fica só com as mensagens.
 *
 * É o único lugar da amostragem na tela da Wellmix (dono, 22/11/2026: nada
 * de dois blocos falando da mesma coisa): a situação, o prazo, o motivo da
 * reprovação, as rodadas anteriores e o aprovar ou reprovar ficam no grupo
 * do fornecedor, sem cartão de Amostragem à parte nem coluna no quadro.
 */

export interface ItemSample {
  key: string;
  supplierName: string;
  /** Nula: sem amostragem (dispensada ou recusou a cotação). */
  sampling: SupplierRequestSampling | null;
  /** Fornecedor conhecido do produto: a amostragem é dispensada. */
  skipped?: boolean;
  /** Prazo da amostra (dias) quando ele já conta; nulo: sem prazo. */
  slaDays?: number | null;
  /** Âncora do grupo (os avisos da amostragem levam a `#amostragem`). */
  anchor?: string;
  /**
   * Validar a amostra enviada: a ação e os campos ocultos que dizem de quem
   * ela é. Nulo: quem vê não valida (sem a ação "Validar a amostragem").
   */
  review?: {
    action: (form: FormData) => Promise<void>;
    fields: ReactNode;
  } | null;
}

function Thumb({
  src,
  video = false,
  alt,
  mark,
  t,
}: {
  src: string;
  video?: boolean;
  alt: string;
  /** Arquivo da rodada atual da amostra (a marca do cartão antigo). */
  mark?: string;
  t: Translate;
}) {
  return (
    <li
      className="relative"
      data-item-image={video ? "video" : "photo"}
      data-sampling-file={mark}
    >
      {video ? (
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          className="h-20 w-full rounded-md border border-zinc-200 bg-black object-contain"
        />
      ) : (
        <>
          <a href={src} target="_blank" rel="noreferrer" title={alt}>
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={src}
              alt={alt}
              className="h-20 w-full rounded-md border border-zinc-200 object-cover"
            />
          </a>
          <CopyImageButton
            src={src}
            label={t("itemImages.copy")}
            doneLabel={t("itemImages.copied")}
          />
        </>
      )}
    </li>
  );
}

const Group = ({
  title,
  mark,
  anchor,
  status,
  children,
}: {
  title: ReactNode;
  mark: string;
  anchor?: string;
  /** Situação da amostragem do grupo (as mesmas marcas do cartão antigo). */
  status?: string;
  children: ReactNode;
}) => (
  <section
    id={anchor}
    className="scroll-mt-24"
    data-item-images-group={mark}
    data-sampling={status}
  >
    <h3 className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-700">
      {title}
    </h3>
    {children}
  </section>
);

const grid = "grid grid-cols-3 gap-1.5";

export function ItemImagesCard({
  reference,
  referenceFrom,
  samples,
  t,
}: {
  /** Documentos das fotos que a Wellmix mandou ao fornecedor. */
  reference: string[];
  referenceFrom: "product" | "book";
  samples: ItemSample[];
  t: Translate;
}) {
  const sampled = samples.filter((x) => x.sampling || x.skipped);
  if (!reference.length && !sampled.length) return null;
  return (
    <Card title={t("itemImages.title")} dense>
      <div className="space-y-3" data-item-images>
        <p className="text-[11px] text-zinc-500">{t("itemImages.hint")}</p>
        <Group
          mark="reference"
          title={
            <>
              {t("itemImages.reference")}
              <span className="font-normal text-zinc-500">
                {t(`itemImages.from.${referenceFrom}`)}
              </span>
            </>
          }
        >
          {reference.length ? (
            <ul className={grid}>
              {reference.map((id) => (
                <Thumb
                  key={id}
                  src={`/api/files/${id}`}
                  alt={t("itemImages.reference")}
                  t={t}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">
              {t("itemImages.noReference")}
            </p>
          )}
        </Group>
        {sampled.map((x) => {
          const sm = x.sampling;
          const files = sm ? samplingRoundFiles(sm) : [];
          const previous = sm
            ? sm.files.filter((f) => f.round !== sm.round)
            : [];
          const days = x.slaDays ?? null;
          const dueAt = sm && days !== null ? samplingDueAt(sm, days) : null;
          const late = !!sm && days !== null && samplingLate(sm, days);
          const lastReject = sm
            ? [...sm.history].reverse().find((e) => e.kind === "reject")
            : null;
          const lastSubmit = sm
            ? [...sm.history].reverse().find((e) => e.kind === "submit")
            : null;
          return (
            <Group
              key={x.key}
              mark={x.key}
              anchor={x.anchor}
              status={sm?.status}
              title={
                <>
                  {t("itemImages.sampleOf", { name: x.supplierName })}
                  {sm ? (
                    <Badge tone={SAMPLING_TONE[sm.status]}>
                      <span data-sampling-status>
                        {t(`sampling.status.${sm.status}` as DictionaryKey)}
                      </span>
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{t("quoteSampling.skipped")}</Badge>
                  )}
                  {sm && sm.round > 1 ? (
                    <span className="font-normal text-zinc-500">
                      {t("sampling.round", { n: sm.round })}
                    </span>
                  ) : null}
                </>
              }
            >
              {dueAt ? (
                <p
                  className={cx(
                    "mb-1 text-[11px]",
                    late ? "font-semibold text-red-700" : "text-zinc-500",
                  )}
                  data-sampling-due={late ? "late" : "ok"}
                >
                  {late ? `${t("sampling.late")} · ` : ""}
                  {t("sampling.due", { date: dateTime(dueAt, t) })}
                </p>
              ) : null}
              {sm?.status === "rejected" && lastReject?.text ? (
                <p
                  className="mb-1.5 rounded-md border border-red-200 bg-red-50 p-1.5 text-xs text-red-800"
                  data-sampling-reject-reason
                >
                  {lastReject.text}
                </p>
              ) : null}
              {files.length ? (
                <ul className={grid}>
                  {files.map((f) => (
                    <Thumb
                      key={f.documentId}
                      src={`/api/files/${f.documentId}`}
                      video={f.kind === "video"}
                      alt={f.fileName}
                      mark={f.documentId}
                      t={t}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">
                  {t(
                    x.skipped
                      ? "quoteSampling.skippedHint"
                      : "itemImages.noSample",
                  )}
                </p>
              )}
              {lastSubmit?.text && sm?.status !== "rejected" ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-700">
                  {lastSubmit.text}
                </p>
              ) : null}
              {sm?.status === "approved" && !x.skipped ? (
                <p className="mt-1 text-[11px] text-emerald-700">
                  {t("sampling.approvedAt", {
                    date: dateTime(sm.reviewedAt, t),
                  })}
                </p>
              ) : null}
              {sm && samplingCanReview(sm) ? (
                x.review ? (
                  <form
                    action={x.review.action}
                    className="mt-2 space-y-1.5"
                    data-sampling-review-form
                  >
                    {x.review.fields}
                    <Field label={t("sampling.review.note")}>
                      <Textarea
                        name="note"
                        rows={1}
                        maxLength={2000}
                        className="max-h-32 min-h-9 resize-y"
                      />
                    </Field>
                    <div className="flex flex-wrap gap-1.5">
                      <SubmitButton
                        className="px-2.5 py-1 text-xs"
                        name="decision"
                        value="approve"
                        data-sampling-review="approve"
                      >
                        {t("sampling.review.approve")}
                      </SubmitButton>
                      <SubmitButton
                        className="px-2.5 py-1 text-xs"
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
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {t("sampling.review.noPermission")}
                  </p>
                )
              ) : null}
              {previous.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("sampling.files.previous")} ·{" "}
                    {t("sampling.files.count", { n: previous.length })}
                  </summary>
                  <ul className={cx(grid, "mt-1.5")}>
                    {previous.map((f) => (
                      <Thumb
                        key={f.documentId}
                        src={`/api/files/${f.documentId}`}
                        video={f.kind === "video"}
                        alt={f.fileName}
                        t={t}
                      />
                    ))}
                  </ul>
                </details>
              ) : null}
            </Group>
          );
        })}
      </div>
    </Card>
  );
}
