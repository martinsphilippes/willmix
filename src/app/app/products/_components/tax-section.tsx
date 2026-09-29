import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { isWellmix } from "@/lib/auth/permissions";
import type {
  Product,
  TaxClassification,
  TaxSource,
  TaxStatus,
  User,
} from "@/lib/db";
import {
  Alert,
  Badge,
  Empty,
  Field,
  Input,
  Textarea,
  TextLink,
  formatDate,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  addTaxCandidateAction,
  rejectTaxAction,
  suggestNcmAction,
  validateTaxAction,
} from "../../actions/compliance";
import { big, userNameFor } from "./shared";

/*
 * Seção "Classificação fiscal (NCM)": NCM validado em destaque, sugestão por
 * palavra-chave (nunca definitiva), candidatas com validar/rejeitar e
 * formulário de candidata manual. Usada na ficha do produto (Wellmix) e na
 * página /app/products/[id]/tax (Wellmix e despachante).
 */

const statusTone: Record<TaxStatus, Tone> = {
  suggested: "warning",
  validated: "success",
  rejected: "neutral",
};
const sourceTone: Record<TaxSource, Tone> = {
  manual: "neutral",
  heuristic: "info",
  ai: "info",
  broker: "brand",
};
const RATE_KEYS = ["II", "IPI", "PIS", "COFINS", "ICMS"] as const;

export function TaxSection({
  product,
  rows,
  users,
  user,
  t,
  back,
}: {
  product: Product;
  rows: TaxClassification[];
  users: User[];
  user: User;
  t: Translate;
  /** De onde a ação volta: ficha do produto ("sheet") ou página do despachante ("tax"). */
  back: "sheet" | "tax";
}) {
  const userName = userNameFor(users);
  const canAct = isWellmix(user) || user.role === "broker";
  const validated = rows.find((r) => r.status === "validated") ?? null;
  const hidden = (
    <>
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  const rates = (taxes: Record<string, number> | null) =>
    taxes
      ? RATE_KEYS.filter((k) => taxes[k] !== undefined)
          .map((k) => `${k} ${taxes[k]}%`)
          .join(" · ")
      : "";

  return (
    <div className="space-y-4">
      <div id="tax" className="scroll-mt-4" />

      {/* NCM validado em destaque (ou "não classificado") */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3">
        {product.ncm ? (
          <>
            <Badge tone="success">
              {t("catalog.tax.validated")}:{" "}
              <span className="font-mono text-sm">{product.ncm}</span>
            </Badge>
            {validated ? (
              <span className="text-xs text-zinc-600">
                {validated.description ? `${validated.description} · ` : ""}
                {t("catalog.tax.validatedBy")}{" "}
                {userName(validated.validatedByUserId)} ·{" "}
                {formatDate(validated.validatedAt)}
              </span>
            ) : null}
          </>
        ) : (
          <Badge tone="warning">{t("catalog.tax.none")}</Badge>
        )}
        {back === "sheet" && isWellmix(user) ? (
          <TextLink
            href={`/app/products/${product.id}/tax`}
            className="ml-auto text-xs"
          >
            {t("catalog.tax.openPage")}
          </TextLink>
        ) : null}
      </div>

      {/* Sugestão heurística: nunca definitiva */}
      <Alert tone="info">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("catalog.tax.suggestHint")}</span>
          {canAct ? (
            <form action={suggestNcmAction}>
              {hidden}
              <SubmitButton
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                pendingText="…"
              >
                {t("catalog.tax.suggest")}
              </SubmitButton>
            </form>
          ) : null}
        </span>
      </Alert>

      {/* Candidatas */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("catalog.tax.candidates")}
        </h3>
        {rows.length === 0 ? (
          <Empty>{t("catalog.tax.candidates.empty")}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-semibold text-zinc-900">
                      {row.ncm}
                    </span>
                    <Badge tone={statusTone[row.status]}>
                      {t(`catalog.tax.status.${row.status}` as DictionaryKey)}
                    </Badge>
                    <Badge tone={sourceTone[row.source]}>
                      {t(`catalog.tax.source.${row.source}` as DictionaryKey)}
                    </Badge>
                  </div>
                  {row.description ? (
                    <p className="text-sm text-zinc-800">{row.description}</p>
                  ) : null}
                  {row.taxes && rates(row.taxes) ? (
                    <p className="text-xs text-zinc-600">
                      {t("catalog.tax.taxes")}: {rates(row.taxes)}
                    </p>
                  ) : null}
                  {row.adminTreatment ? (
                    <p className="text-xs text-zinc-600">
                      {t("catalog.tax.adminTreatment")}: {row.adminTreatment}
                    </p>
                  ) : null}
                  {row.sourceRef ? (
                    <p className="text-xs text-zinc-500">
                      {t("catalog.tax.sourceRef")}: {row.sourceRef}
                    </p>
                  ) : null}
                  {row.notes ? (
                    <p className="whitespace-pre-line text-xs text-zinc-500">
                      {row.notes}
                    </p>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    {t("catalog.tax.suggestedBy")}{" "}
                    {userName(row.suggestedByUserId)} ·{" "}
                    {formatDate(row.createdAt)}
                    {row.validatedAt
                      ? ` · ${t(
                          row.status === "rejected"
                            ? "catalog.tax.rejectedBy"
                            : "catalog.tax.validatedBy",
                        )} ${userName(row.validatedByUserId)} · ${formatDate(row.validatedAt)}`
                      : ""}
                  </p>
                </div>
                {canAct ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {row.status !== "validated" ? (
                      <form action={validateTaxAction}>
                        {hidden}
                        <input type="hidden" name="id" value={row.id} />
                        <SubmitButton
                          className="px-3 py-1.5 text-xs"
                          pendingText="…"
                        >
                          {t("catalog.tax.validate")}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {row.status !== "rejected" ? (
                      <form
                        action={rejectTaxAction}
                        className="flex items-center gap-1.5"
                      >
                        {hidden}
                        <input type="hidden" name="id" value={row.id} />
                        <Input
                          name="note"
                          maxLength={2000}
                          placeholder={t("catalog.tax.rejectNote")}
                          aria-label={t("catalog.tax.rejectNote")}
                          className="w-36 py-1.5 text-xs sm:w-44"
                        />
                        <SubmitButton
                          variant="danger"
                          className="shrink-0 px-3 py-1.5 text-xs"
                          pendingText="…"
                        >
                          {t("catalog.tax.reject")}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-zinc-500">{t("catalog.tax.onlyOne")}</p>
      </div>

      {/* Candidata manual / do despachante */}
      {canAct ? (
        <form
          action={addTaxCandidateAction}
          className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
        >
          {hidden}
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("catalog.tax.add")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("catalog.tax.ncm")} hint={t("catalog.tax.ncmHint")}>
              <Input
                name="ncm"
                required
                minLength={4}
                maxLength={10}
                inputMode="decimal"
                placeholder="7615.10"
                className={`${big} font-mono`}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("catalog.tax.description")}>
                <Input name="description" maxLength={2000} className={big} />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <p className="mb-1 text-sm font-medium text-zinc-800">
                {t("catalog.tax.rates")}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {RATE_KEYS.map((k) => (
                  <Field key={k} label={k}>
                    <Input
                      name={k}
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      inputMode="decimal"
                      className={big}
                    />
                  </Field>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Field
                label={t("catalog.tax.adminTreatment")}
                hint={t("catalog.tax.adminTreatmentHint")}
              >
                <Input name="adminTreatment" maxLength={2000} className={big} />
              </Field>
            </div>
            <Field
              label={t("catalog.tax.sourceRef")}
              hint={t("catalog.tax.sourceRefHint")}
            >
              <Input name="sourceRef" maxLength={255} className={big} />
            </Field>
            <div className="sm:col-span-3">
              <Field label={t("common.note")}>
                <Textarea name="notes" rows={2} className={big} />
              </Field>
            </div>
          </div>
          <SubmitButton
            variant="secondary"
            className="w-full sm:w-auto"
            pendingText="…"
          >
            + {t("catalog.tax.add")}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
