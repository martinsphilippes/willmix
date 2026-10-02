import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/permissions";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { formatContainerTypes } from "@/lib/services/containers";
import { aiStatus } from "@/lib/integrations/ai";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton } from "@/components/submit-button";
import { saveSettingsAction } from "../actions";
import { testAiAction } from "../actions/vision";
import { aiErrorText } from "@/i18n/ai-error";

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
  const { ok, error, aiTest, aiModel, aiCode } = await searchParams;
  const t = await getT();
  const s = await getSettings();
  const errorKey =
    `settings.error.${typeof error === "string" ? error : ""}` as DictionaryKey;
  /* Visão de Produto: códigos novos (invalid_ai_mode, invalid_currency) em operations.error.*; o padrão settings.error.* continua primeiro. */
  const operationsErrorKey =
    `operations.error.${typeof error === "string" ? error : ""}` as DictionaryKey;
  const errorText =
    typeof error === "string" && error && t(errorKey) !== errorKey
      ? t(errorKey)
      : typeof error === "string" &&
          error &&
          t(operationsErrorKey) !== operationsErrorKey
        ? t(operationsErrorKey)
        : t("common.error");
  /* Modo efetivo da IA (api/mock/manual): diz se a chave está no ambiente sem nunca exibi-la. */
  const ai = aiStatus(s);
  const aiEffective = ai.mode;
  const aiEffectiveKey = (
    ai.provider
      ? `operations.settings.effective.${ai.provider}`
      : `operations.settings.effective.${aiEffective}`
  ) as DictionaryKey;
  const aiTestText =
    typeof aiTest === "string" && aiTest
      ? t(`operations.ai.test.${aiTest}` as DictionaryKey, {
          model: typeof aiModel === "string" ? aiModel : "",
          code:
            aiErrorText(t, typeof aiCode === "string" ? aiCode : "") ??
            (typeof aiCode === "string" ? aiCode : ""),
        })
      : null;
  const aiEffectiveTone =
    aiEffective === "api"
      ? "success"
      : aiEffective === "mock"
        ? "warning"
        : "neutral";

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
          {/* Visão de Produto: IA (modo e modelo), marketing studio / kit, gate de RADAR e importadora. */}
          <h3 className="border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-900">
            {t("operations.settings.section")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={
                <span className="inline-flex flex-wrap items-center gap-2">
                  aiMode
                  <Badge tone={aiEffectiveTone}>
                    {t("operations.settings.effective")}: {t(aiEffectiveKey)}
                  </Badge>
                </span>
              }
              hint={t("operations.settings.hint.aiMode")}
            >
              <Select name="aiMode" defaultValue={s.aiMode}>
                <option value="AUTO">AUTO</option>
                <option value="MOCK">MOCK</option>
                <option value="MANUAL">MANUAL</option>
              </Select>
            </Field>
            <Field label="aiModel" hint={t("operations.settings.hint.aiModel")}>
              <Input
                name="aiModel"
                maxLength={80}
                defaultValue={s.aiModel}
                className="font-mono text-xs"
              />
            </Field>
            <Field
              label="marketingKitDefaultPrice"
              hint={t("operations.settings.hint.marketingKitDefaultPrice")}
            >
              <Input
                name="marketingKitDefaultPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={s.marketingKitDefaultPrice}
              />
            </Field>
            <Field
              label="marketingKitCurrency"
              hint={t("operations.settings.hint.marketingKitCurrency")}
            >
              <CurrencySelect
                name="marketingKitCurrency"
                value={s.marketingKitCurrency}
                t={t}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="importerName"
                hint={t("operations.settings.hint.importerName")}
              >
                <Input
                  name="importerName"
                  maxLength={120}
                  defaultValue={s.importerName}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:col-span-2">
              <Checkbox
                name="marketingEnabled"
                checked={s.marketingEnabled}
                hint={t("operations.settings.hint.marketingEnabled")}
              />
              <Checkbox
                name="radarGateEnabled"
                checked={s.radarGateEnabled}
                hint={t("operations.settings.hint.radarGateEnabled")}
              />
              <Checkbox
                name="lookupPaused"
                checked={s.lookupPaused}
                hint={t("operations.settings.hint.lookupPaused")}
              />
            </div>
          </div>
          {/* Pix do sinal: a chave do recebedor que aparece para o cliente pagar. */}
          <h3 className="border-t border-zinc-100 pt-4 text-sm font-semibold text-zinc-900">
            {t("payments.settings.title")}
          </h3>
          <p className="text-xs leading-relaxed text-zinc-500">
            {t("payments.settings.hint")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label={t("payments.settings.key")}
                hint={t("payments.settings.keyHint")}
              >
                <Input
                  name="pixKey"
                  maxLength={77}
                  defaultValue={s.pixKey}
                  autoComplete="off"
                  className="font-mono text-sm"
                />
              </Field>
            </div>
            <Field
              label={t("payments.settings.receiverName")}
              hint={t("payments.settings.receiverNameHint")}
            >
              <Input
                name="pixReceiverName"
                maxLength={25}
                defaultValue={s.pixReceiverName}
              />
            </Field>
            <Field
              label={t("payments.settings.receiverCity")}
              hint={t("payments.settings.receiverCityHint")}
            >
              <Input
                name="pixReceiverCity"
                maxLength={15}
                defaultValue={s.pixReceiverCity}
              />
            </Field>
          </div>
          <p className="rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
            paymentMode={DEFAULT_SETTINGS.paymentMode} · whatsappMode=
            {DEFAULT_SETTINGS.whatsappMode} · emailMode=
            {DEFAULT_SETTINGS.emailMode} (fixos até haver integração)
          </p>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </form>
      </Card>

      {/* Teste real da IA com a configuração salva (mostra provedor/modelo ou o motivo da falha). */}
      <Card title={t("operations.ai.test")} className="mt-6">
        <div id="ai-test" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">
          {t("operations.ai.testHint")}
        </p>
        {aiTestText ? (
          <Alert tone={aiTest === "ok" ? "success" : "warning"}>
            {aiTestText}
          </Alert>
        ) : null}
        <form action={testAiAction} className="mt-3">
          <SubmitButton variant="secondary" pendingText="…">
            {t("operations.ai.test")}
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
