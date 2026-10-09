import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { isWellmix } from "@/lib/auth/permissions";
import type { Certification, CertificationStatus, User } from "@/lib/db";
import {
  effectiveStatus,
  type CertEntity,
  type ComplianceCheck,
} from "@/lib/services/compliance";
import {
  Alert,
  Badge,
  Empty,
  Field,
  Input,
  Select,
  Textarea,
  cx,
  formatDate,
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  addCertificationAction,
  setCertificationStatusAction,
} from "../../actions/compliance";
import { big, userNameFor } from "./shared";

/*
 * Seção "Certificações e compliance" (produto) e "Certificações do fornecedor"
 * (parceiro): resumo do que a linha exige × o que está válido, lista com
 * situação efetiva (válida vencida aparece como vencida), documento e ações
 * da Wellmix, e formulário de registro. O fornecedor registra as suas como
 * pendentes (regra no serviço).
 */

const statusTone: Record<CertificationStatus, Tone> = {
  pending: "warning",
  valid: "success",
  expired: "danger",
  rejected: "neutral",
};

export function CertificationsSection({
  entity,
  entityId,
  certs,
  check,
  suggestedKinds,
  users,
  user,
  t,
  warningDays,
  back,
}: {
  entity: CertEntity;
  entityId: string;
  certs: Certification[];
  /** Só para produto: o que a linha exige × o que está válido. */
  check?: ComplianceCheck | null;
  /** Tipos sugeridos no formulário (os exigidos pela linha). */
  suggestedKinds?: string[];
  users: User[];
  user: User;
  t: Translate;
  warningDays?: number;
  /** Tela para onde a ação volta quando não é a ficha nem o parceiro (conta corrente do fornecedor). */
  back?: "account";
}) {
  const userName = userNameFor(users);
  const wellmix = isWellmix(user);
  const expiringIds = new Set((check?.expiring ?? []).map((c) => c.id));
  const hidden = (
    <>
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="entityId" value={entityId} />
      {back ? <input type="hidden" name="back" value={back} /> : null}
    </>
  );
  const list = (items: string[]) => (items.length ? items.join(", ") : "—");
  const listId = `cert-kinds-${entity}-${entityId}`;

  return (
    <div className="space-y-4">
      <div id="certifications" className="scroll-mt-4" />

      {check ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["catalog.cert.required", check.required, "neutral"],
                ["catalog.cert.valid", check.valid, "success"],
                ["catalog.cert.missing", check.missing, "danger"],
                [
                  "catalog.cert.expiring",
                  check.expiring.map((c) => c.kind),
                  "warning",
                ],
              ] as Array<[DictionaryKey, string[], Tone]>
            ).map(([key, items, tone]) => (
              <div
                key={key}
                className={cx(
                  "rounded-xl border px-3 py-2.5",
                  items.length && tone === "danger"
                    ? "border-red-200 bg-red-50/60"
                    : items.length && tone === "warning"
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-zinc-200/80 bg-zinc-50/70",
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t(key)}
                </div>
                <div className="mt-0.5 break-words text-sm font-semibold text-zinc-900">
                  {list(items)}
                </div>
              </div>
            ))}
          </div>
          {check.required.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {t("catalog.cert.noneRequired")}
            </p>
          ) : check.missing.length > 0 ? (
            <Alert tone="danger">
              {t("catalog.cert.missingAlert", {
                list: check.missing.join(", "),
              })}
            </Alert>
          ) : (
            <Alert tone="success">{t("catalog.cert.okAlert")}</Alert>
          )}
          {check.expiring.length > 0 ? (
            <Alert tone="warning">
              {t("catalog.cert.expiringAlert", {
                days: warningDays ?? 30,
                list: check.expiring
                  .map((c) => `${c.kind} (${formatDate(c.validUntil, t)})`)
                  .join(", "),
              })}
            </Alert>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-zinc-600">{t("catalog.cert.party.hint")}</p>
      )}

      {certs.length === 0 ? (
        <Empty>{t("catalog.cert.empty")}</Empty>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80">
          {certs.map((cert) => {
            // O instante é lido dentro do serviço (fora do render), como em isOverdue.
            const status = effectiveStatus(cert);
            return (
              <li
                key={cert.id}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900">
                      {cert.kind}
                    </span>
                    <Badge tone={statusTone[status]}>
                      {t(`catalog.cert.status.${status}` as DictionaryKey)}
                    </Badge>
                    {status === "valid" && expiringIds.has(cert.id) ? (
                      <Badge tone="warning">
                        {t("catalog.cert.expiresOn", {
                          date: formatDate(cert.validUntil, t),
                        })}
                      </Badge>
                    ) : null}
                  </div>
                  {cert.name ? (
                    <p className="text-sm text-zinc-800">{cert.name}</p>
                  ) : null}
                  <p className="text-xs text-zinc-600">
                    {[
                      cert.issuer,
                      cert.number
                        ? `${t("catalog.cert.number")} ${cert.number}`
                        : null,
                      cert.validUntil
                        ? `${t("catalog.cert.validUntil")} ${formatDate(cert.validUntil, t)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {cert.documentId ? (
                      <a
                        href={`/api/files/${cert.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        {t("catalog.cert.open")}
                      </a>
                    ) : (
                      t("catalog.cert.noDocument")
                    )}
                    {" · "}
                    {t("catalog.cert.registeredBy")}{" "}
                    {userName(cert.createdByUserId)} ·{" "}
                    {formatDate(cert.createdAt, t)}
                    {cert.validatedAt
                      ? ` · ${t("catalog.cert.validatedBy")} ${userName(cert.validatedByUserId)} · ${formatDate(cert.validatedAt, t)}`
                      : ""}
                  </p>
                  {cert.notes ? (
                    <p className="whitespace-pre-line text-xs text-zinc-500">
                      {cert.notes}
                    </p>
                  ) : null}
                </div>
                {wellmix ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {status !== "valid" ? (
                      <form action={setCertificationStatusAction}>
                        {hidden}
                        <input type="hidden" name="id" value={cert.id} />
                        <input type="hidden" name="status" value="valid" />
                        <SubmitButton
                          className="px-3 py-1.5 text-xs"
                          pendingText="…"
                        >
                          {t("catalog.cert.validate")}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {status !== "expired" ? (
                      <form action={setCertificationStatusAction}>
                        {hidden}
                        <input type="hidden" name="id" value={cert.id} />
                        <input type="hidden" name="status" value="expired" />
                        <SubmitButton
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          pendingText="…"
                        >
                          {t("catalog.cert.markExpired")}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {status !== "rejected" ? (
                      <form
                        action={setCertificationStatusAction}
                        className="flex items-center gap-1.5"
                      >
                        {hidden}
                        <input type="hidden" name="id" value={cert.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <Input
                          name="note"
                          maxLength={2000}
                          placeholder={t("common.note")}
                          aria-label={t("common.note")}
                          className="w-32 py-1.5 text-xs sm:w-40"
                        />
                        <SubmitButton
                          variant="danger"
                          className="shrink-0 px-3 py-1.5 text-xs"
                          pendingText="…"
                        >
                          {t("catalog.cert.reject")}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={addCertificationAction}
        className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
      >
        {hidden}
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("catalog.cert.add")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label={t("catalog.cert.kind")}
            hint={t("catalog.cert.kindHint")}
          >
            <Input
              name="kind"
              required
              maxLength={60}
              list={suggestedKinds?.length ? listId : undefined}
              defaultValue={check?.missing[0] ?? ""}
              className={big}
            />
          </Field>
          {suggestedKinds?.length ? (
            <datalist id={listId}>
              {suggestedKinds.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          ) : null}
          <div className="sm:col-span-2">
            <Field label={t("catalog.cert.name")}>
              <Input name="name" maxLength={160} className={big} />
            </Field>
          </div>
          <Field label={t("catalog.cert.issuer")}>
            <Input name="issuer" maxLength={160} className={big} />
          </Field>
          <Field label={t("catalog.cert.number")}>
            <Input name="number" maxLength={80} className={big} />
          </Field>
          <Field label={t("catalog.cert.validUntil")}>
            <Input name="validUntil" type="date" className={big} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={t("catalog.cert.document")}
              hint={t("catalog.cert.documentHint")}
            >
              <Input
                name="document"
                type="file"
                accept="application/pdf,image/*"
                className={big}
              />
            </Field>
          </div>
          {wellmix ? (
            <Field label={t("catalog.cert.initialStatus")}>
              <Select name="status" defaultValue="valid" className={big}>
                <option value="valid">{t("catalog.cert.status.valid")}</option>
                <option value="pending">
                  {t("catalog.cert.status.pending")}
                </option>
              </Select>
            </Field>
          ) : null}
          <div className="sm:col-span-3">
            <Field label={t("common.note")}>
              <Textarea name="notes" rows={2} className={big} />
            </Field>
          </div>
        </div>
        {!wellmix ? (
          <p className="text-xs text-zinc-500">
            {t("catalog.cert.supplierPending")}
          </p>
        ) : null}
        <SubmitButton
          variant="secondary"
          className="w-full sm:w-auto"
          pendingText="…"
        >
          + {t("catalog.cert.add")}
        </SubmitButton>
      </form>
    </div>
  );
}
