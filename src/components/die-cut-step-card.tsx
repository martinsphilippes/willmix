import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { SUPERPLAN_ITEMS, type SuperplanItem } from "@/lib/superplan-rfq";
import { dieCutStepView, type DieCutFrom } from "@/lib/services/die-cut-step";
import { uploadDielineAction } from "@/app/app/actions/packaging-brief";
import { sendDieCutStepAction } from "@/app/app/actions/die-cut-step";
import { FileAutoInput } from "./file-auto-input";
import { PhotoInput } from "./photo-input";
import { SubmitButton } from "./submit-button";
import { Alert, Badge, Card, Field, Input, formatDate, linkClass } from "./ui";

/** Ordem em que a etapa mostra os itens (como o dono pediu). */
const ORDER: SuperplanItem[] = ["dieline", "hd", "moq", "leadTime"];
const STEP_ERRORS = [
  "invalid_moq",
  "invalid_lead_time",
  "terms_required",
  "photo_required",
];

/*
 * Etapa "Die Cut" do fornecedor escolhido (na cotação escolhida e no pedido):
 * ele envia o die-cut e a foto em alta e informa ou valida o pedido mínimo e
 * o prazo de entrega. Cada item mostra a sua situação; die-cut e foto sobem
 * sozinhos ao escolher o arquivo; MOQ e prazo vêm preenchidos para confirmar
 * ou corrigir. Só aparece para o fornecedor da embalagem.
 */
export async function DieCutStepCard({
  t,
  user,
  from,
  back,
  notice,
  error,
}: {
  t: Translate;
  user: User;
  from: DieCutFrom;
  /** Tela de volta depois do envio (a própria cotação ou o pedido). */
  back: string;
  /** "sent" (die-cut), "hd" ou "terms": o que acabou de ser enviado. */
  notice?: string | string[];
  error?: string | string[];
}) {
  if (user.role !== "supplier") return null;
  const view = await dieCutStepView(user, from);
  if (!view) return null;
  const label = (key: SuperplanItem) =>
    t(`dieCut.item.${key}` as DictionaryKey);
  const done = (key: SuperplanItem) => !view.missing.includes(key);
  const state = (key: SuperplanItem) => (
    <Badge tone={done(key) ? "success" : "warning"}>
      {t(done(key) ? "dieCut.state.done" : "dieCut.state.pending")}
    </Badge>
  );
  const heading = (key: SuperplanItem) => (
    <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
      {ORDER.indexOf(key) + 1}. {label(key)} {state(key)}
    </h3>
  );
  const returnTo = `${back}#die-cut`;
  const where = (
    <>
      {"orderId" in from ? (
        <input type="hidden" name="orderId" value={from.orderId} />
      ) : (
        <input type="hidden" name="quoteId" value={from.quoteId} />
      )}
      <input type="hidden" name="back" value={returnTo} />
    </>
  );
  const dielineTarget = (
    <>
      <input type="hidden" name="briefId" value={view.briefId} />
      <input type="hidden" name="back" value={returnTo} />
    </>
  );
  const doc = view.dieline;
  const stepError =
    typeof error === "string" && STEP_ERRORS.includes(error) ? error : null;
  return (
    <div
      id="die-cut"
      className="scroll-mt-24"
      data-supplier-dieline
      data-die-cut-step
      data-die-cut-missing={view.missing.join(" ")}
    >
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("dieCut.title")}
            <Badge tone={view.missing.length ? "warning" : "success"}>
              {view.missing.length
                ? `${SUPERPLAN_ITEMS.length - view.missing.length}/${SUPERPLAN_ITEMS.length}`
                : t("dieCut.state.done")}
            </Badge>
          </span>
        }
        className="border-brand-300! ring-4 ring-brand-50"
      >
        <div className="space-y-4 text-sm">
          {stepError ? (
            <Alert tone="danger">
              {t(`dieCut.error.${stepError}` as DictionaryKey)}
            </Alert>
          ) : notice === "sent" ? (
            <p
              className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800"
              data-dieline-saved
            >
              {t("dieCut.saved.dieline")}
            </p>
          ) : notice === "hd" ? (
            <Alert tone="success">{t("dieCut.saved.hd")}</Alert>
          ) : notice === "terms" ? (
            <Alert tone="success">{t("dieCut.saved.terms")}</Alert>
          ) : null}
          <p className="text-zinc-700">{t("dieCut.hint")}</p>
          <p className="text-xs text-zinc-600">
            {view.productName}
            {view.missing.length && view.dueAt
              ? ` · ${t("packBrief.dieline.due", { date: formatDate(view.dueAt, t) })}`
              : ""}
          </p>
          {view.missing.length ? (
            <Alert tone="warning">
              {t("dieCut.missing", {
                list: ORDER.filter((k) => !done(k))
                  .map(label)
                  .join(", "),
              })}
            </Alert>
          ) : (
            <Alert tone="success">{t("dieCut.complete")}</Alert>
          )}

          {/* 1. Die Cut */}
          <section className="space-y-1.5" data-die-cut-item="dieline">
            {heading("dieline")}
            <p className="text-xs text-zinc-600">{t("dieCut.dieline.hint")}</p>
            {doc ? (
              <p className="text-xs text-zinc-600">
                <a
                  href={`/api/files/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                  data-dieline-file
                >
                  {doc.name}
                </a>{" "}
                {t("packBrief.item.version", {
                  version: doc.version,
                  date: formatDate(doc.createdAt, t),
                })}
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
              <form
                action={uploadDielineAction}
                className="flex flex-wrap items-center gap-1.5"
              >
                {dielineTarget}
                <FileAutoInput
                  name="file"
                  label={t("requirement.file.add")}
                  pendingLabel={t("requirement.sending")}
                  uploadingLabel={t("requirement.file.uploading")}
                  tooBigLabel={t("requirement.file.tooBig")}
                  serverOnlyLabel={t("requirement.file.serverOnly")}
                  failedLabel={t("requirement.file.failed")}
                />
              </form>
              <form
                action={uploadDielineAction}
                className="flex flex-wrap items-center gap-1.5"
              >
                {dielineTarget}
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
                />
              </form>
            </div>
          </section>

          {/* 2. Foto em alta */}
          <section className="space-y-1.5" data-die-cut-item="hd">
            {heading("hd")}
            <p className="text-xs text-zinc-600">{t("dieCut.hd.hint")}</p>
            {view.hdPhotos.length ? (
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {view.hdPhotos.map(({ photo, document }) =>
                  document ? (
                    <li key={photo.id}>
                      <a
                        href={`/api/files/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                        data-die-cut-hd-file
                      >
                        {document.name}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
            <form
              action={sendDieCutStepAction}
              className="flex flex-wrap items-center gap-1.5"
            >
              {where}
              <input type="hidden" name="item" value="hd" />
              <PhotoInput
                name="hd"
                multiple
                capture={false}
                maxDimension={4096}
                quality={0.95}
                autoSubmit
                compact
                direct
                label={t("dieCut.hd.add")}
                pendingLabel={t("requirement.sending")}
                uploadingLabel={t("photo.uploading")}
                failedLabel={t("photo.failed")}
              />
            </form>
          </section>

          {/* 3 e 4. Pedido mínimo e prazo de entrega: informar ou validar */}
          <section className="space-y-1.5" data-die-cut-item="terms">
            <div className="space-y-1">
              {heading("moq")}
              {heading("leadTime")}
            </div>
            <form
              action={sendDieCutStepAction}
              className="space-y-2"
              data-die-cut-terms
            >
              {where}
              <input type="hidden" name="item" value="terms" />
              <p className="text-xs text-zinc-600">{t("dieCut.terms.hint")}</p>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <Field label={t("dieCut.moq")}>
                  <Input
                    name="moq"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    defaultValue={view.moq ?? view.suggested.moq ?? ""}
                  />
                </Field>
                <Field label={t("dieCut.leadTime")}>
                  <Input
                    name="leadTimeDays"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    defaultValue={
                      view.leadTimeDays ?? view.suggested.leadTimeDays ?? ""
                    }
                  />
                </Field>
              </div>
              <SubmitButton
                variant={
                  done("moq") && done("leadTime") ? "secondary" : "primary"
                }
                pendingText={t("requirement.sending")}
                data-die-cut-terms-submit=""
              >
                {t("dieCut.terms.submit")}
              </SubmitButton>
            </form>
          </section>
        </div>
      </Card>
    </div>
  );
}
