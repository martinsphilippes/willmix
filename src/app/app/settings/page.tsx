import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/permissions";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { getT } from "@/i18n/server";
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

  return (
    <>
      <PageHeader
        help={{ body: "help.settings.body" }}
        t={t}
        title={t("settings.title")}
      />
      {ok ? <Alert tone="success">{t("settings.saved")}</Alert> : null}
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <Card className="mt-4 max-w-2xl">
        <form action={saveSettingsAction} className="space-y-4">
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
