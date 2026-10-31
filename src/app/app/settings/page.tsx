import { redirect } from "next/navigation";
import { QUOTE_SLA_MAX_DAYS, QUOTE_SLA_MIN_DAYS } from "@/lib/sla";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { getStore } from "@/lib/db";
import { getFxRates } from "@/lib/services/fx";
import { PricingSettings } from "@/components/pricing-settings";
import {
  RANKING_CRITERIA,
  normalizeWeights,
} from "@/lib/services/supplier-ranking-calc";
import { FiscalTableCard, TaxRateFields } from "@/components/fiscal-settings";
import { fiscalStatus } from "@/lib/services/fiscal";
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
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton } from "@/components/submit-button";
import { saveSettingsAction } from "../actions";
import { ensureDemoAccountsAction } from "../actions/demo";
import { demoAccountsEnabled } from "@/lib/demo";
import {
  DEMO_PARTIES,
  DEMO_PASSWORD,
  DEMO_USERS,
  existingDemoAccounts,
} from "@/lib/seed";
import { testAiAction } from "../actions/vision";
import { aiErrorText } from "@/i18n/ai-error";

/**
 * Caixa de seleção com valor "false" de reserva: o checkbox marcado vem primeiro
 * no FormData ("on"); desmarcado, só o hidden ("false") é enviado. Assim a
 * coerção automática de saveSettingsAction grava true/false sem mudar a ação.
 */
function Checkbox({
  name,
  label,
  checked,
  hint,
}: {
  name: string;
  label: string;
  checked: boolean;
  hint: string;
}) {
  return (
    <label className="flex min-w-0 items-start gap-2.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 shadow-sm">
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
      />
      <input type="hidden" name={name} value="false" />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5 text-zinc-800">
          {label}
        </span>
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
  requireScreen(user, "settings");
  const {
    ok,
    error,
    aiTest,
    aiModel,
    aiCode,
    fiscal,
    fiscalSync,
    demo,
    demoFailed,
  } = await searchParams;
  const t = await getT();
  const [s, lineRows, customerRows, fx, fiscalInfo, agencies] =
    await Promise.all([
      getSettings(),
      getStore().list("product_lines", { orderBy: "name" }),
      getStore().list("parties", {
        filter: { type: "customer" },
        orderBy: "name",
      }),
      getFxRates(),
      fiscalStatus(),
      // Agência padrão dos briefings de embalagem (faca e arte na RFQ).
      getStore().list("parties", {
        filter: { type: "agency", active: true },
        orderBy: "name",
      }),
    ]);
  // "?fiscal=tec-10412-3": planilha carregada (tabela, NCMs, alíquotas alteradas).
  const fiscalMatch =
    typeof fiscal === "string" ? /^(tec|tipi)-(\d+)-(\d+)$/.exec(fiscal) : null;
  const fiscalNotice = fiscalMatch
    ? t("fiscal.table.uploaded", {
        kind: fiscalMatch[1].toUpperCase(),
        count: Number(fiscalMatch[2]).toLocaleString(t.intl),
        changed: fiscalMatch[3],
      })
    : fiscalSync === "ok"
      ? t("fiscal.table.synced.ok")
      : fiscalSync === "partial"
        ? t("fiscal.table.synced.partial")
        : null;
  const lines = lineRows.map((l) => ({ id: l.id, name: l.name }));
  const customers = customerRows.map((c) => ({ id: c.id, name: c.name }));
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
  /* Contas de demonstração: quais existem no banco e o que a última criação deu. */
  const showDemo = demoAccountsEnabled();
  const demoExisting = showDemo ? await existingDemoAccounts() : new Set();
  const demoMissing = showDemo
    ? DEMO_USERS.filter((u) => !demoExisting.has(u.email))
    : [];
  const demoCreated = typeof demo === "string" ? Number(demo) : null;
  // Só e-mails de demonstração conhecidos e motivos com texto traduzido: a
  // URL não vira um canal de texto livre na tela do admin.
  const demoEmails = new Set([
    ...DEMO_USERS.map((u) => u.email),
    ...DEMO_PARTIES.map((p) => p.email),
  ]);
  const demoFailures =
    typeof demoFailed === "string" && demoFailed
      ? demoFailed.split(",").flatMap((item) => {
          const [email, reason, ...rest] = item.split(":");
          if (
            !demoEmails.has(email) ||
            !/^[a-z][a-z0-9_]{1,59}$/.test(reason ?? "")
          )
            return [];
          const key = `settings.demo.reason.${reason}` as DictionaryKey;
          if (t(key) === key) return [];
          // Detalhe técnico (onde e qual erro), só códigos: parties.type:document_invalid_structure.
          const detail = rest.join(":");
          const technical =
            /^[a-z_]{1,30}(\.[A-Za-z0-9_]{1,60})?(:[a-z_]{1,60})?$/.test(detail)
              ? ` ${t("settings.demo.detail", { detail })}`
              : "";
          return [`${email}: ${t(key)}${technical}`];
        })
      : [];

  /* Seções do formulário em duas colunas (iPad/desktop): cada coluna é um @container e os campos curtos formam grades densas. */
  const section = "space-y-3 border-t border-zinc-100 pt-3";
  const h3 = "text-sm font-semibold text-zinc-900";
  const hintP = "text-xs leading-relaxed text-zinc-500";

  return (
    <>
      <PageHeader
        help={{ body: "help.settings.body" }}
        t={t}
        title={t("settings.title")}
        actions={
          // Só admin chega aqui: apagar as vendas de teste e recomeçar.
          <LinkButton href="/app/settings/reset" variant="danger">
            {t("reset.link")}
          </LinkButton>
        }
      />
      {ok ? <Alert tone="success">{t("settings.saved")}</Alert> : null}
      {error ? <Alert tone="danger">{errorText}</Alert> : null}
      <Card className="mt-3">
        <form action={saveSettingsAction} className="space-y-4">
          <div className="grid items-start gap-x-6 gap-y-3 lg:grid-cols-2">
            {/* Coluna 1: fluxo e prazos, SLA, inspeção, containers, conformidade, pagamentos. */}
            <div className="@container min-w-0 space-y-3">
              <div className="space-y-3">
                <h3 className={h3}>{t("settings.section.general")}</h3>
                <div className="grid items-end gap-3 @sm:grid-cols-2 @xl:grid-cols-4">
                  <Field label={t("settings.label.customerCanCreateRequest")}>
                    <Select
                      name="customerCanCreateRequest"
                      defaultValue={String(s.customerCanCreateRequest)}
                    >
                      <option value="true">{t("common.yes")}</option>
                      <option value="false">{t("common.no")}</option>
                    </Select>
                  </Field>
                  <Field label={t("settings.label.agencyValidationEnabled")}>
                    <Select
                      name="agencyValidationEnabled"
                      defaultValue={String(s.agencyValidationEnabled)}
                    >
                      <option value="true">{t("common.yes")}</option>
                      <option value="false">{t("common.no")}</option>
                    </Select>
                  </Field>
                  {/* Embalagem (faca e arte) aberta junto com a RFQ para a agência. */}
                  <Field label={t("settings.label.packagingBriefAt")}>
                    <Select
                      name="packagingBriefAt"
                      defaultValue={s.packagingBriefAt}
                      data-setting="packagingBriefAt"
                    >
                      <option value="rfq">
                        {t("settings.option.packagingBriefAt.rfq")}
                      </option>
                      <option value="selection">
                        {t("settings.option.packagingBriefAt.selection")}
                      </option>
                      <option value="order">
                        {t("settings.option.packagingBriefAt.order")}
                      </option>
                    </Select>
                  </Field>
                  <Field label={t("settings.label.packagingDefaultAgencyId")}>
                    <Select
                      name="packagingDefaultAgencyId"
                      defaultValue={s.packagingDefaultAgencyId}
                    >
                      <option value="">
                        {t("settings.option.packagingAgencyAuto")}
                      </option>
                      {agencies.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("settings.label.packagingBriefRequired")}>
                    <input
                      type="hidden"
                      name="packagingBriefRequired.__form"
                      value="1"
                    />
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      {(
                        [
                          "dieline",
                          "art",
                          "print_ready",
                          "packaging_sample",
                        ] as const
                      ).map((key) => (
                        <label key={key} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            name="packagingBriefRequired"
                            value={key}
                            defaultChecked={s.packagingBriefRequired.includes(
                              key,
                            )}
                            className="h-4 w-4 accent-brand-600"
                          />
                          {t(`packBrief.item.${key}`)}
                        </label>
                      ))}
                    </span>
                  </Field>
                  <Field label={t("settings.label.packagingBriefDueDays")}>
                    <Input
                      name="packagingBriefDueDays"
                      type="number"
                      step="1"
                      min="1"
                      max="365"
                      defaultValue={s.packagingBriefDueDays}
                    />
                  </Field>
                  <Field label={t("settings.label.agencyShowsCustomer")}>
                    <Select
                      name="agencyShowsCustomer"
                      defaultValue={String(s.agencyShowsCustomer)}
                    >
                      <option value="true">{t("common.yes")}</option>
                      <option value="false">{t("common.no")}</option>
                    </Select>
                  </Field>
                  <Field label={t("settings.label.deliveryConfirmationMode")}>
                    <Select
                      name="deliveryConfirmationMode"
                      defaultValue={s.deliveryConfirmationMode}
                    >
                      <option value="BOTH">{t("settings.option.BOTH")}</option>
                      <option value="CUSTOMER">
                        {t("settings.option.CUSTOMER")}
                      </option>
                      <option value="WELLMIX">
                        {t("settings.option.WELLMIX")}
                      </option>
                    </Select>
                  </Field>
                  <Field label={t("settings.label.weightTolerancePercent")}>
                    <Input
                      name="weightTolerancePercent"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={s.weightTolerancePercent}
                    />
                  </Field>
                  <Field label={t("settings.label.downPaymentPercent")}>
                    <Input
                      name="downPaymentPercent"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      defaultValue={s.downPaymentPercent}
                    />
                  </Field>
                  <Field label={t("settings.label.quotationExpirationDays")}>
                    <Input
                      name="quotationExpirationDays"
                      type="number"
                      min="1"
                      defaultValue={s.quotationExpirationDays}
                    />
                  </Field>
                  <Field label={t("settings.label.reminderDaysBeforeDue")}>
                    <Input
                      name="reminderDaysBeforeDue"
                      type="number"
                      min="0"
                      defaultValue={s.reminderDaysBeforeDue}
                    />
                  </Field>
                  <Field label={t("settings.label.sankhyaMode")}>
                    <Select name="sankhyaMode" defaultValue={s.sankhyaMode}>
                      <option value="MOCK">{t("settings.option.MOCK")}</option>
                      <option value="MANUAL">
                        {t("settings.option.MANUAL")}
                      </option>
                    </Select>
                  </Field>
                </div>
                <Field label={t("settings.label.stageDueDays")}>
                  <Textarea
                    name="stageDueDays"
                    rows={6}
                    className="font-mono text-xs"
                    defaultValue={JSON.stringify(s.stageDueDays, null, 2)}
                  />
                </Field>
              </div>

              {/* Aprovação do pré-custo: níveis antes de a escolha do fornecedor valer. */}
              <div className={section}>
                <h3 className={h3}>{t("settings.approvals.title")}</h3>
                <p className={hintP}>{t("settings.approvals.hint")}</p>
                <div className="grid gap-3 @sm:grid-cols-2 @xl:grid-cols-4">
                  <Field label={t("settings.approvals.enabled")}>
                    <Select
                      name="approvalsEnabled"
                      defaultValue={String(s.approvalsEnabled)}
                    >
                      <option value="true">{t("common.yes")}</option>
                      <option value="false">{t("common.no")}</option>
                    </Select>
                  </Field>
                  <Field label={t("settings.approvals.threshold")}>
                    <Input
                      name="approvalExecutiveThresholdBrl"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      defaultValue={s.approvalExecutiveThresholdBrl}
                    />
                  </Field>
                </div>
              </div>

              {/* SLA de resposta da cotação: prazo de toda nova solicitação. */}
              <div className={section}>
                <h3 className={h3}>{t("sla.settings.title")}</h3>
                <p className={hintP}>{t("sla.settings.hint")}</p>
                <div className="grid gap-3 @sm:grid-cols-2 @xl:grid-cols-4">
                  <Field label={t("sla.settings.days")}>
                    <Input
                      name="quoteSlaBusinessDays"
                      type="number"
                      min={QUOTE_SLA_MIN_DAYS}
                      max={QUOTE_SLA_MAX_DAYS}
                      step="1"
                      required
                      defaultValue={s.quoteSlaBusinessDays}
                    />
                  </Field>
                </div>
              </div>

              <div className={section}>
                <h3 className={h3}>{t("settings.section.inspection")}</h3>
                <div className="grid gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
                  <Field
                    label={t("settings.label.dimensionTolerancePercent")}
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
                    label={t("settings.label.cbmTolerancePercent")}
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
                    label={t("settings.label.quantityTolerancePercent")}
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
                </div>
                <div className="grid gap-2 @xl:grid-cols-2">
                  <Checkbox
                    name="inspectionExtendedChecks"
                    label={t("settings.label.inspectionExtendedChecks")}
                    checked={s.inspectionExtendedChecks}
                    hint={t("settings.hint.inspectionExtendedChecks")}
                  />
                  <Checkbox
                    name="reviewOnZeroPrice"
                    label={t("settings.label.reviewOnZeroPrice")}
                    checked={s.reviewOnZeroPrice}
                    hint={t("settings.hint.reviewOnZeroPrice")}
                  />
                </div>
              </div>

              <div className={section}>
                <h3 className={h3}>{t("settings.section.containers")}</h3>
                <div className="grid items-start gap-3 @sm:grid-cols-2">
                  <Field
                    label={t("settings.label.containerMaxOccupancyPercent")}
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
                  <Checkbox
                    name="containerAllowMultiCustomer"
                    label={t("settings.label.containerAllowMultiCustomer")}
                    checked={s.containerAllowMultiCustomer}
                    hint={t("settings.hint.containerAllowMultiCustomer")}
                  />
                </div>
                <Field
                  label={t("settings.containerTypes.label")}
                  hint={t("settings.hint.containerTypes")}
                >
                  <Textarea
                    name="containerTypes"
                    rows={4}
                    className="font-mono text-xs"
                    defaultValue={formatContainerTypes(s.containerTypes)}
                  />
                </Field>
              </div>

              <div className={section}>
                <h3 className={h3}>{t("settings.section.compliance")}</h3>
                <div className="grid gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
                  <Field
                    label={t("settings.label.certificationExpiryWarningDays")}
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
                </div>
                <div className="grid gap-2 @xl:grid-cols-2">
                  <Checkbox
                    name="complianceGateEnabled"
                    label={t("settings.label.complianceGateEnabled")}
                    checked={s.complianceGateEnabled}
                    hint={t("settings.hint.complianceGateEnabled")}
                  />
                  <Checkbox
                    name="afterSalesEnabled"
                    label={t("settings.label.afterSalesEnabled")}
                    checked={s.afterSalesEnabled}
                    hint={t("settings.hint.afterSalesEnabled")}
                  />
                </div>
              </div>

              {/* Pagamento ao fornecedor: destino do pedido ao financeiro. */}
              <div className={section}>
                <h3 className={h3}>{t("supplierPay.settings.title")}</h3>
                <p className={hintP}>{t("supplierPay.settings.hint")}</p>
                <div className="grid gap-3 @sm:grid-cols-2">
                  <Field label={t("supplierPay.settings.email")}>
                    <Input
                      name="financeEmail"
                      type="email"
                      maxLength={160}
                      defaultValue={s.financeEmail}
                    />
                  </Field>
                  <Field
                    label={t("supplierPay.settings.whatsapp")}
                    hint={t("supplierPay.settings.whatsappHint")}
                  >
                    <Input
                      name="financeWhatsapp"
                      type="tel"
                      maxLength={24}
                      defaultValue={s.financeWhatsapp}
                    />
                  </Field>
                </div>
              </div>

              {/* Pix do sinal: a chave do recebedor que aparece para o cliente pagar. */}
              <div className={section}>
                <h3 className={h3}>{t("payments.settings.title")}</h3>
                <p className={hintP}>{t("payments.settings.hint")}</p>
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
            </div>

            {/* Coluna 2: IA e importadora, preço ao cliente e tributos. */}
            <div className="@container min-w-0 space-y-3">
              {/* Visão de Produto: IA (modo e modelo), marketing studio / kit, gate de RADAR e importadora. */}
              <div className={`${section} lg:border-t-0 lg:pt-0`}>
                <h3 className={h3}>{t("operations.settings.section")}</h3>
                <div className="grid gap-3 @sm:grid-cols-2">
                  <Field
                    label={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {t("settings.label.aiMode")}
                        <Badge tone={aiEffectiveTone}>
                          {t("operations.settings.effective")}:{" "}
                          {t(aiEffectiveKey)}
                        </Badge>
                      </span>
                    }
                    hint={t("operations.settings.hint.aiMode")}
                  >
                    <Select name="aiMode" defaultValue={s.aiMode}>
                      <option value="AUTO">{t("settings.option.AUTO")}</option>
                      <option value="MOCK">{t("settings.option.MOCK")}</option>
                      <option value="MANUAL">
                        {t("settings.option.MANUAL")}
                      </option>
                    </Select>
                  </Field>
                  <Field
                    label={t("settings.label.aiModel")}
                    hint={t("operations.settings.hint.aiModel")}
                  >
                    <Input
                      name="aiModel"
                      maxLength={80}
                      defaultValue={s.aiModel}
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field
                    label={t("settings.label.marketingKitDefaultPrice")}
                    hint={t(
                      "operations.settings.hint.marketingKitDefaultPrice",
                    )}
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
                    label={t("settings.label.marketingKitCurrency")}
                    hint={t("operations.settings.hint.marketingKitCurrency")}
                  >
                    <CurrencySelect
                      name="marketingKitCurrency"
                      value={s.marketingKitCurrency}
                      t={t}
                    />
                  </Field>
                  <div className="min-w-0 @sm:col-span-2">
                    <Field
                      label={t("settings.label.importerName")}
                      hint={t("operations.settings.hint.importerName")}
                    >
                      <Input
                        name="importerName"
                        maxLength={120}
                        defaultValue={s.importerName}
                      />
                    </Field>
                  </div>
                </div>
                <div className="grid gap-2 @xl:grid-cols-2 @3xl:grid-cols-3">
                  <Checkbox
                    name="marketingEnabled"
                    label={t("settings.label.marketingEnabled")}
                    checked={s.marketingEnabled}
                    hint={t("operations.settings.hint.marketingEnabled")}
                  />
                  <Checkbox
                    name="radarGateEnabled"
                    label={t("settings.label.radarGateEnabled")}
                    checked={s.radarGateEnabled}
                    hint={t("operations.settings.hint.radarGateEnabled")}
                  />
                  <Checkbox
                    name="lookupPaused"
                    label={t("settings.label.lookupPaused")}
                    checked={s.lookupPaused}
                    hint={t("operations.settings.hint.lookupPaused")}
                  />
                </div>
              </div>
              {/* Preço ao cliente: margem (geral/linha/cliente), frete e câmbio. */}
              <PricingSettings
                t={t}
                s={s}
                lines={lines}
                customers={customers}
                fx={fx}
              />
              {/* Tributos: PIS, COFINS, ICMS, seguro e links da tabela fiscal. */}
              <TaxRateFields t={t} s={s} />
              {/* Disputa de fornecedores: peso de cada critério na nota. */}
              <div
                id="ranking"
                className="scroll-mt-24 space-y-2 rounded-xl border border-zinc-200 p-3"
              >
                <h3 className="text-sm font-semibold text-zinc-900">
                  {t("ranking.settings.title")}
                </h3>
                <p className="text-xs text-zinc-600">
                  {t("ranking.settings.hint")}
                </p>
                <input
                  type="hidden"
                  name="supplierRankingWeights.__form"
                  value="1"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {RANKING_CRITERIA.map((c) => (
                    <label
                      key={c}
                      className="flex items-center justify-between gap-3 text-sm text-zinc-700"
                    >
                      <span>{t(`ranking.settings.${c}`)}</span>
                      <input
                        name={`supplierRankingWeights.${c}`}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        defaultValue={
                          normalizeWeights(s.supplierRankingWeights)[c]
                        }
                        className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-right tabular-nums"
                        data-ranking-weight={c}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
            {t("settings.fixedModes", {
              payment: DEFAULT_SETTINGS.paymentMode,
              whatsapp: DEFAULT_SETTINGS.whatsappMode,
              email: DEFAULT_SETTINGS.emailMode,
            })}
          </p>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </form>
      </Card>
      {/* Contas de demonstração: só com elas ligadas; cria as que faltam. */}
      {showDemo ? (
        <Card className="mt-4" title={t("settings.demo.title")}>
          <div id="demo" className="scroll-mt-4" />
          <p className="mb-3 text-sm text-zinc-600">
            {t("settings.demo.intro", { password: DEMO_PASSWORD })}
          </p>
          {demoCreated !== null && Number.isFinite(demoCreated) ? (
            demoCreated > 0 ? (
              <div className="mb-3">
                <Alert tone="success">
                  {t("settings.demo.done", { n: String(demoCreated) })}
                </Alert>
              </div>
            ) : // Com falhas, a lista delas já diz o que houve.
            demoFailures.length === 0 ? (
              <div className="mb-3">
                <Alert tone="info">{t("settings.demo.none")}</Alert>
              </div>
            ) : null
          ) : null}
          {demoFailures.length ? (
            <div className="mb-3">
              <Alert tone="danger">
                {t("settings.demo.failed", { list: demoFailures.join("; ") })}
              </Alert>
            </div>
          ) : null}
          <ul
            className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3"
            data-demo-accounts
          >
            {DEMO_USERS.map((u) => {
              const exists = demoExisting.has(u.email);
              return (
                <li
                  key={u.email}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5"
                  data-demo-account={u.email}
                  data-demo-exists={exists ? "1" : "0"}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900">
                      {t(`role.${u.role}`)} · {u.name}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {u.email}
                    </span>
                  </span>
                  <Badge tone={exists ? "success" : "warning"}>
                    {t(
                      exists ? "settings.demo.exists" : "settings.demo.missing",
                    )}
                  </Badge>
                </li>
              );
            })}
          </ul>
          <form action={ensureDemoAccountsAction} className="mt-3">
            {demoMissing.length ? (
              <SubmitButton data-demo-create>
                {t("settings.demo.create")}
              </SubmitButton>
            ) : (
              <p className="text-sm text-emerald-700">
                {t("settings.demo.allCreated")}
              </p>
            )}
          </form>
        </Card>
      ) : null}
      {/* Tabela fiscal e teste da IA lado a lado. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <FiscalTableCard t={t} status={fiscalInfo} notice={fiscalNotice} />

        {/* Teste real da IA com a configuração salva (mostra provedor/modelo ou o motivo da falha). */}
        <Card title={t("operations.ai.test")}>
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
      </div>
    </>
  );
}
