import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { SUPERPLAN_ITEMS, type SuperplanItem } from "@/lib/superplan-rfq";
import { superplanQuoteView } from "@/lib/services/superplan-rfq";
import { sendSuperplanItemsAction } from "@/app/app/actions/superplan-rfq";
import { FileAutoInput } from "./file-auto-input";
import { PhotoInput } from "./photo-input";
import { SubmitButton } from "./submit-button";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  formatDate,
  formatMoney,
  linkClass,
} from "./ui";

/*
 * Cotação aberta do Superplan (docs/SUPERPLAN.md, seção 11): o fornecedor
 * ganho envia faca (die-cut), MOQ, prazo e foto em alta. Cada item tem a sua
 * situação; faca e foto sobem sozinhas ao escolher o arquivo, MOQ e prazo vêm
 * preenchidos para confirmar ou corrigir. A Wellmix vê o mesmo e pode enviar
 * no lugar dele. Fora desse fluxo, não aparece.
 */
export async function SuperplanItemsCard({
  t,
  user,
  quoteId,
  notice,
}: {
  t: Translate;
  user: User;
  quoteId: string;
  /** "saved" (falta algo) ou "done" (tudo enviado), depois de um envio. */
  notice?: string | string[];
}) {
  const view = await superplanQuoteView(user, quoteId);
  if (!view) return null;
  const label = (key: SuperplanItem) => t(`spRfq.item.${key}` as DictionaryKey);
  const missingList = view.missing.map(label).join(", ");
  const hidden = (item: "dieline" | "hd" | "terms") => (
    <>
      <input type="hidden" name="quoteId" value={view.quoteId} />
      <input type="hidden" name="item" value={item} />
    </>
  );
  const state = (key: SuperplanItem) => {
    const done = !view.missing.includes(key);
    return (
      <Badge tone={done ? "success" : "warning"}>
        {t(done ? "spRfq.state.done" : "spRfq.state.pending")}
      </Badge>
    );
  };
  const supplier = user.role === "supplier";
  return (
    <div id="superplan" className="scroll-mt-24" data-superplan-items>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("spRfq.title")}
            <Badge tone={view.missing.length ? "warning" : "success"}>
              {view.missing.length
                ? `${SUPERPLAN_ITEMS.length - view.missing.length}/${SUPERPLAN_ITEMS.length}`
                : t("spRfq.state.done")}
            </Badge>
          </span>
        }
        className="border-brand-300! ring-4 ring-brand-50"
      >
        <div className="space-y-4 text-sm">
          {notice === "done" ? (
            <Alert tone="success">{t("spRfq.done")}</Alert>
          ) : notice === "saved" && view.missing.length ? (
            <Alert tone="info">{t("spRfq.saved", { list: missingList })}</Alert>
          ) : null}
          <p className="text-zinc-700">
            {t(supplier ? "spRfq.hint.supplier" : "spRfq.hint.wellmix")}
          </p>
          {view.price !== null ? (
            <p className="text-zinc-700" data-superplan-price>
              {t("spRfq.price", {
                price: formatMoney(view.price, view.currency, t),
              })}
            </p>
          ) : null}
          {!view.open ? (
            <Alert tone="neutral">{t("spRfq.closed")}</Alert>
          ) : view.missing.length ? (
            <Alert tone="warning">
              <span data-superplan-missing={view.missing.join(" ")}>
                {t("spRfq.missing", { list: missingList })}
              </span>
            </Alert>
          ) : (
            <Alert tone="success">{t("spRfq.complete")}</Alert>
          )}

          {/* 1. Faca (die-cut) */}
          <section className="space-y-1.5" data-superplan-item="dieline">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
              1. {label("dieline")} {state("dieline")}
            </h3>
            <p className="text-xs text-zinc-600">{t("spRfq.dieline.hint")}</p>
            {view.dieline ? (
              <p className="text-xs text-zinc-600">
                <a
                  href={`/api/files/${view.dieline.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {view.dieline.name}
                </a>{" "}
                {t("packBrief.item.version", {
                  version: view.dieline.version,
                  date: formatDate(view.dieline.createdAt, t),
                })}
              </p>
            ) : null}
            {view.canSend && view.briefId ? (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                <form
                  action={sendSuperplanItemsAction}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {hidden("dieline")}
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
                  action={sendSuperplanItemsAction}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {hidden("dieline")}
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
            ) : view.canSend ? (
              <Alert tone="warning">{t("spRfq.error.no_brief")}</Alert>
            ) : null}
          </section>

          {/* 2 e 3. MOQ e prazo */}
          <section className="space-y-1.5" data-superplan-item="terms">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
              2. {label("moq")} {state("moq")} · 3. {label("leadTime")}{" "}
              {state("leadTime")}
            </h3>
            {view.canSend ? (
              <form
                action={sendSuperplanItemsAction}
                className="space-y-2"
                data-superplan-terms
              >
                {hidden("terms")}
                <p className="text-xs text-zinc-600">{t("spRfq.terms.hint")}</p>
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <Field label={t("spRfq.moq")}>
                    <Input
                      name="moq"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      defaultValue={view.moq ?? view.suggested.moq ?? ""}
                    />
                  </Field>
                  <Field label={t("spRfq.leadTime")}>
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
                  variant="secondary"
                  pendingText={t("requirement.sending")}
                >
                  {t("spRfq.terms.submit")}
                </SubmitButton>
              </form>
            ) : (
              <p className="text-zinc-700">
                {t("spRfq.moq")}: {view.moq?.toLocaleString(t.intl) ?? "—"} ·{" "}
                {t("spRfq.leadTime")}: {view.leadTimeDays ?? "—"}
              </p>
            )}
          </section>

          {/* 4. Foto em alta */}
          <section className="space-y-1.5" data-superplan-item="hd">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
              4. {label("hd")} {state("hd")}
            </h3>
            <p className="text-xs text-zinc-600">{t("spRfq.hd.hint")}</p>
            {view.hdPhotos.length ? (
              <ul className="flex flex-wrap gap-2">
                {view.hdPhotos.map(({ photo, document }) =>
                  document ? (
                    <li key={photo.id}>
                      <a
                        href={`/api/files/${document.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        {document.name}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
            {view.canSend ? (
              <form
                action={sendSuperplanItemsAction}
                className="flex flex-wrap items-center gap-1.5"
              >
                {hidden("hd")}
                <PhotoInput
                  name="hd"
                  multiple
                  capture={false}
                  maxDimension={4096}
                  quality={0.95}
                  autoSubmit
                  compact
                  direct
                  label={t("spRfq.hd.add")}
                  pendingLabel={t("requirement.sending")}
                  uploadingLabel={t("photo.uploading")}
                  failedLabel={t("photo.failed")}
                />
              </form>
            ) : null}
          </section>
        </div>
      </Card>
    </div>
  );
}
