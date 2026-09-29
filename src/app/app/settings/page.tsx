import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/permissions";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { formatContainerTypes } from "@/lib/services/containers";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveSettingsAction } from "../actions";

/**
 * Caixa de seleção com valor "false" de reserva: o checkbox marcado vem primeiro
 * no FormData ("on"); desmarcado, só o hidden ("false") é enviado. Assim a
 * coerção automática de saveSettingsAction grava true/false sem mudar a ação.
 */
function Checkbox({
  name,
  checked,
  hint,
}: {
  name: string;
  checked: boolean;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 shadow-sm">
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
      />
      <input type="hidden" name={name} value="false" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800">{name}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </label>
  );
}

/** Decisões em aberto parametrizadas (docs/OPEN_DECISIONS.md). Só admin. */
export default async function SettingsPage({
  searchParams,
}: PageProps<"/app/settings">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertRole(user, ["admin"]);
  const { ok, error } = await searchParams;
  const t = await getT();
  const s = await getSettings();
  const errorKey =
    `settings.error.${typeof error === "string" ? error : ""}` as DictionaryKey;
  const errorText =
    typeof error === "string" && error && t(errorKey) !== errorKey
      ? t(errorKey)
      : t("common.error");

  return (
    <>
      <PageHeader
        help={{ body: "help.settings.body" }}
        t={t}
        title={t("settings.title")}
      />
      {ok ? <Alert tone="success">{t("settings.saved")}</Alert> : null}
      {error ? <Alert tone="danger">{errorText}</Alert> : null}
      <Card className="mt-4 max-w-2xl">
        <form action={saveSettingsAction} className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("settings.section.general")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="customerCanCreateRequest">
              <Select
                name="customerCanCreateRequest"
                defaultValue={String(s.customerCanCreateRequest)}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </Select>
            </Field>
            <Field label="agencyValidationEnabled">
              <Select
                name="agencyValidationEnabled"
                defaultValue={String(s.agencyValidationEnabled)}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </Select>
            </Field>
            <Field label="deliveryConfirmationMode">
              <Select
                name="deliveryConfirmationMode"
                defaultValue={s.deliveryConfirmationMode}
              >
                <option value="BOTH">BOTH</option>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="WELLMIX">WELLMIX</option>
              </Select>
            </Field>
            <Field label="weightTolerancePercent (%)">
              <Input
                name="weightTolerancePercent"
                type="number"
                step="0.1"
                min="0"
                defaultValue={s.weightTolerancePercent}
              />
            </Field>
            <Field label="downPaymentPercent (%)">
              <Input
                name="downPaymentPercent"
                type="number"
                step="1"
                min="0"
                max="100"
                defaultValue={s.downPaymentPercent}
              />
            </Field>
            <Field label="quotationExpirationDays">
              <Input
                name="quotationExpirationDays"
                type="number"
                min="1"
                defaultValue={s.quotationExpirationDays}
              />
            </Field>
            <Field label="reminderDaysBeforeDue">
              <Input
                name="reminderDaysBeforeDue"
                type="number"
                min="0"
                defaultValue={s.reminderDaysBeforeDue}
              />
            </Field>
            <Field label="sankhyaMode">
              <Select name="sankhyaMode" defaultValue={s.sankhyaMode}>
                <option value="MOCK">MOCK</option>
                <option value="MANUAL">MANUAL</option>
              </Select>
            </Field>
          </div>
          <Field label="stageDueDays (JSON)">
            <Textarea
              name="stageDueDays"
              rows={6}
              className="font-mono text-xs"
              defaultValue={JSON.stringify(s.stageDueDays, null, 2)}
            />
          </Field>

          <h3 className="border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-900">
            {t("settings.section.inspection")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="dimensionTolerancePercent (%)"
              hint={t("settings.hint.dimensionTolerancePercent")}
            >
              <Input
                name="dimensionTolerancePercent"
                type="number"
                step="0.1"
                min="0"
                defaultValue={s.dimensionTolerancePercent}
              />
            </Field>
            <Field
              label="cbmTolerancePercent (%)"
              hint={t("settings.hint.cbmTolerancePercent")}
            >
              <Input
                name="cbmTolerancePercent"
                type="number"
                step="0.1"
                min="0"
                defaultValue={s.cbmTolerancePercent}
              />
            </Field>
            <Field
              label="quantityTolerancePercent (%)"
              hint={t("settings.hint.quantityTolerancePercent")}
            >
              <Input
                name="quantityTolerancePercent"
                type="number"
                step="0.1"
                min="0"
                defaultValue={s.quantityTolerancePercent}
              />
            </Field>
            <div className="grid gap-3 sm:col-span-2">
              <Checkbox
                name="inspectionExtendedChecks"
                checked={s.inspectionExtendedChecks}
                hint={t("settings.hint.inspectionExtendedChecks")}
              />
              <Checkbox
                name="reviewOnZeroPrice"
                checked={s.reviewOnZeroPrice}
                hint={t("settings.hint.reviewOnZeroPrice")}
              />
            </div>
          </div>

          <h3 className="border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-900">
            {t("settings.section.containers")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="containerMaxOccupancyPercent (%)"
              hint={t("settings.hint.containerMaxOccupancyPercent")}
            >
              <Input
                name="containerMaxOccupancyPercent"
                type="number"
                step="1"
                min="1"
                max="100"
                defaultValue={s.containerMaxOccupancyPercent}
              />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                name="containerAllowMultiCustomer"
                checked={s.containerAllowMultiCustomer}
                hint={t("settings.hint.containerAllowMultiCustomer")}
              />
            </div>
          </div>
          <h3 className="border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-900">
            {t("settings.section.compliance")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="certificationExpiryWarningDays"
              hint={t("settings.hint.certificationExpiryWarningDays")}
            >
              <Input
                name="certificationExpiryWarningDays"
                type="number"
                step="1"
                min="0"
                defaultValue={s.certificationExpiryWarningDays}
              />
            </Field>
            <div className="grid gap-3 sm:col-span-2">
              <Checkbox
                name="complianceGateEnabled"
                checked={s.complianceGateEnabled}
                hint={t("settings.hint.complianceGateEnabled")}
              />
              <Checkbox
                name="afterSalesEnabled"
                checked={s.afterSalesEnabled}
                hint={t("settings.hint.afterSalesEnabled")}
              />
            </div>
          </div>
          <Field
            label={`containerTypes (${t("settings.containerTypes.label")})`}
            hint={t("settings.hint.containerTypes")}
          >
            <Textarea
              name="containerTypes"
              rows={4}
              className="font-mono text-xs"
              defaultValue={formatContainerTypes(s.containerTypes)}
            />
          </Field>
          <p className="rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
            paymentMode={DEFAULT_SETTINGS.paymentMode} · whatsappMode=
            {DEFAULT_SETTINGS.whatsappMode} · emailMode=
            {DEFAULT_SETTINGS.emailMode} (fixos até haver integração)
          </p>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </form>
      </Card>
    </>
  );
}
