import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import {
  COMMISSION_BASES,
  COMMISSION_EVENTS,
  COMPONENT_KINDS,
  type CommissionComponent,
} from "@/lib/commission";
import { partnerTypeName } from "@/lib/partner-types";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";
import {
  agreementConflicts,
  agreementDef,
  getAgreement,
} from "@/lib/services/commissions";
import {
  agreementStepAction,
  saveAgreementAction,
} from "../../../actions/commissions";
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
import { SubmitButton } from "@/components/submit-button";

/*
 * Um acordo comercial (docs/COMMISSIONS.md): beneficiário e abrangência,
 * condições de cálculo, vigência e pagamento, simulação e revisão. Só o
 * rascunho é editável; o ativo muda por uma nova versão.
 */

const STATUS_TONE = {
  draft: "neutral",
  active: "success",
  suspended: "warning",
  ended: "neutral",
} as const;

const blank = (): CommissionComponent => ({
  id: "",
  name: "",
  kind: "percent",
  base: "items",
  rate: null,
  amount: null,
  lineIds: [],
  tiers: null,
  tierMode: "progressive",
  accumulate: false,
  successEvent: null,
  floor: null,
  cap: null,
});

export default async function AgreementPage({
  params,
  searchParams,
}: PageProps<"/app/commissions/agreements/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "finance");
  if (!isAdmin(user)) redirect("/app/commissions");
  const t = await getT();
  const { id } = await params;
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const isNew = id === "new";
  const row = isNew ? null : await getAgreement(user, id);
  if (!isNew && !row) notFound();
  const def = row ? agreementDef(row) : null;
  const editable = !row || row.status === "draft";
  const store = getStore();
  const [lines, catalog, conflicts] = await Promise.all([
    store.list("product_lines", { orderBy: "name" }),
    getPartnerTypeCatalog(),
    row && row.status !== "active" ? agreementConflicts(row) : [],
  ]);
  const scopeIds = [
    ...(def?.scope.customerIds ?? []),
    ...(def?.scope.supplierIds ?? []),
    ...(def?.beneficiaryPartyId ? [def.beneficiaryPartyId] : []),
  ];
  const parties = scopeIds.length
    ? await store.list("parties", { filter: { id: scopeIds } })
    : [];
  const nameOf = (pid: string) =>
    parties.find((p) => p.id === pid)?.name ?? pid;
  const typeOptions = [
    { value: "customer", label: t("party.customer") },
    { value: "supplier", label: t("party.supplier") },
    ...catalog
      .filter((e) => e.active || e.value === def?.beneficiaryType)
      .map((e) => ({ value: e.value, label: partnerTypeName(e, t.locale) })),
  ];
  const components = [
    ...(def?.components ?? []),
    ...(editable ? [blank(), blank(), blank()] : []),
  ];
  const raw = (n: number | null) =>
    n === null
      ? ""
      : String(n).replace(".", t.intl.startsWith("pt") ? "," : ".");
  const tiersText = (c: CommissionComponent) =>
    (c.tiers ?? []).map((x) => `${x.upTo ?? ""}:${x.rate}`).join("; ");
  const error = one("error");
  const errorKey = `commission.error.${error}`;
  const saved = one("saved");
  const savedKey = `commission.saved.${saved}`;
  const events = [...COMMISSION_EVENTS];

  return (
    <>
      <PageHeader
        t={t}
        title={
          row
            ? `${t("commission.col.name")} nº ${row.number} · v${row.version}`
            : t("commission.new")
        }
        subtitle={
          row ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[row.status]}>
                {t(`commission.status.${row.status}`)}
              </Badge>
              <span>{row.name}</span>
            </span>
          ) : null
        }
        actions={
          <LinkButton href="/app/commissions">
            {t("commission.tab.agreements")}
          </LinkButton>
        }
      />
      <div className="mb-3 space-y-2">
        {error ? (
          <Alert tone="danger">
            {errorKey in dictionaries.pt
              ? t(errorKey as DictionaryKey)
              : t("common.error")}
          </Alert>
        ) : null}
        {saved ? (
          <div data-commission-saved>
            <Alert tone="success">
              {savedKey in dictionaries.pt
                ? t(savedKey as DictionaryKey)
                : t("commission.saved")}
            </Alert>
          </div>
        ) : null}
        {conflicts.length ? (
          <div data-commission-conflict>
            <Alert tone="warning">
              {t("commission.conflict.title")}{" "}
              {conflicts.map((c) => c.name).join(", ")}
            </Alert>
          </div>
        ) : null}
        {editable ? null : (
          <Alert tone="info">{t("commission.form.readonly")}</Alert>
        )}
      </div>

      <form
        action={saveAgreementAction}
        className="space-y-4"
        data-agreement-form
      >
        {row ? <input type="hidden" name="id" value={row.id} /> : null}
        <input type="hidden" name="rows" value={components.length} />
        <fieldset disabled={!editable} className="space-y-4">
          <Card title={t("commission.form.section.who")}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("commission.form.name")}>
                <Input
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={row?.name ?? ""}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("commission.form.category")}
                  hint={t("commission.form.categoryHint")}
                >
                  <Input
                    name="category"
                    maxLength={60}
                    defaultValue={row?.category ?? "comissao"}
                  />
                </Field>
                <Field
                  label={t("commission.form.priority")}
                  hint={t("commission.form.priorityHint")}
                >
                  <Input
                    name="priority"
                    inputMode="numeric"
                    defaultValue={String(row?.priority ?? 0)}
                  />
                </Field>
              </div>
              <Field label={t("commission.form.beneficiaryType")}>
                <Select
                  name="beneficiaryType"
                  defaultValue={def?.beneficiaryType ?? ""}
                >
                  <option value="">
                    {t("commission.form.beneficiaryTypeNone")}
                  </option>
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("commission.form.beneficiary")}
                hint={t("commission.form.beneficiaryHint")}
              >
                <Input
                  name="beneficiary"
                  defaultValue={
                    def?.beneficiaryPartyId
                      ? nameOf(def.beneficiaryPartyId)
                      : ""
                  }
                />
              </Field>
              <Field label={t("commission.form.customers")}>
                <Textarea
                  name="customers"
                  rows={2}
                  defaultValue={(def?.scope.customerIds ?? [])
                    .map(nameOf)
                    .join("\n")}
                />
              </Field>
              <Field label={t("commission.form.suppliers")}>
                <Textarea
                  name="suppliers"
                  rows={2}
                  defaultValue={(def?.scope.supplierIds ?? [])
                    .map(nameOf)
                    .join("\n")}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {t("commission.form.scopeHint")}
            </p>
          </Card>

          <Card title={t("commission.form.section.rules")}>
            <div className="space-y-3">
              {components.map((c, i) => (
                <div
                  key={i}
                  className="@container rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3"
                  data-commission-rule={i}
                >
                  <input type="hidden" name={`c${i}.id`} value={c.id} />
                  {c.name ? null : (
                    <p className="mb-2 text-xs font-medium text-zinc-500">
                      {t("commission.rule.new")}
                    </p>
                  )}
                  <div className="grid gap-3 @md:grid-cols-4">
                    <div className="@md:col-span-2">
                      <Field label={t("commission.rule.name")}>
                        <Input
                          name={`c${i}.name`}
                          maxLength={120}
                          defaultValue={c.name}
                        />
                      </Field>
                    </div>
                    <Field label={t("commission.rule.kind")}>
                      <Select name={`c${i}.kind`} defaultValue={c.kind}>
                        {COMPONENT_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {t(`commission.rule.kind.${k}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("commission.rule.base")}>
                      <Select name={`c${i}.base`} defaultValue={c.base}>
                        {COMMISSION_BASES.map((b) => (
                          <option key={b} value={b}>
                            {t(`commission.rule.base.${b}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("commission.rule.rate")}>
                      <Input
                        name={`c${i}.rate`}
                        inputMode="decimal"
                        defaultValue={raw(c.rate)}
                      />
                    </Field>
                    <Field label={t("commission.rule.amount")}>
                      <Input
                        name={`c${i}.amount`}
                        inputMode="decimal"
                        defaultValue={raw(c.amount)}
                      />
                    </Field>
                    <Field label={t("commission.rule.line")}>
                      <Select
                        name={`c${i}.line`}
                        defaultValue={c.lineIds[0] ?? ""}
                      >
                        <option value="">
                          {t("commission.form.linesAll")}
                        </option>
                        {lines.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("commission.rule.success")}>
                      <Select
                        name={`c${i}.successEvent`}
                        defaultValue={c.successEvent ?? ""}
                      >
                        <option value="">
                          {t("commission.rule.successNone")}
                        </option>
                        {events.map((e) => (
                          <option key={e} value={e}>
                            {t(`commission.event.${e}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <details
                    className="mt-2 text-sm"
                    open={!!c.tiers || c.floor !== null || c.cap !== null}
                  >
                    <summary className="w-fit cursor-pointer text-xs font-medium text-brand-700">
                      {t("commission.rule.tiers")} ·{" "}
                      {t("commission.rule.floor")} · {t("commission.rule.cap")}
                    </summary>
                    <div className="mt-2 grid gap-3 @md:grid-cols-4">
                      <div className="@md:col-span-2">
                        <Field
                          label={t("commission.rule.tiers")}
                          hint={t("commission.rule.tiersHint")}
                        >
                          <Input
                            name={`c${i}.tiers`}
                            defaultValue={tiersText(c)}
                          />
                        </Field>
                      </div>
                      <Field label={t("commission.rule.tierMode")}>
                        <Select
                          name={`c${i}.tierMode`}
                          defaultValue={c.tierMode}
                        >
                          <option value="progressive">
                            {t("commission.rule.tierMode.progressive")}
                          </option>
                          <option value="whole">
                            {t("commission.rule.tierMode.whole")}
                          </option>
                        </Select>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t("commission.rule.floor")}>
                          <Input
                            name={`c${i}.floor`}
                            inputMode="decimal"
                            defaultValue={raw(c.floor)}
                          />
                        </Field>
                        <Field label={t("commission.rule.cap")}>
                          <Input
                            name={`c${i}.cap`}
                            inputMode="decimal"
                            defaultValue={raw(c.cap)}
                          />
                        </Field>
                      </div>
                    </div>
                  </details>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name={`c${i}.accumulate`}
                        value="on"
                        defaultChecked={c.accumulate}
                        className="h-4 w-4 accent-brand-600"
                      />
                      {t("commission.rule.accumulate")}
                    </label>
                    {c.name && editable ? (
                      <label className="flex cursor-pointer items-center gap-2 text-zinc-600">
                        <input
                          type="checkbox"
                          name={`c${i}.remove`}
                          value="on"
                          className="h-4 w-4 accent-brand-600"
                        />
                        {t("commission.rule.remove")}
                      </label>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {t("commission.rule.hint")}
            </p>
          </Card>

          <Card title={t("commission.form.section.when")}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t("commission.form.validFrom")}>
                <Input
                  name="validFrom"
                  type="date"
                  defaultValue={row?.validFrom ?? ""}
                />
              </Field>
              <Field label={t("commission.form.validTo")}>
                <Input
                  name="validTo"
                  type="date"
                  defaultValue={row?.validTo ?? ""}
                />
              </Field>
              <Field label={t("commission.form.currency")}>
                <Select name="currency" defaultValue={row?.currency ?? "BRL"}>
                  {["BRL", "USD", "CNY"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("commission.form.dueDays")}>
                <Input
                  name="dueDays"
                  inputMode="numeric"
                  defaultValue={String(row?.dueDays ?? 30)}
                />
              </Field>
              <Field label={t("commission.form.generateOn")}>
                <Select
                  name="generateOn"
                  defaultValue={row?.generateOn ?? "order_created"}
                >
                  {events.map((e) => (
                    <option key={e} value={e}>
                      {t(`commission.event.${e}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("commission.form.releaseOn")}>
                <Select
                  name="releaseOn"
                  defaultValue={row?.releaseOn ?? "delivered"}
                >
                  <option value="received">
                    {t("commission.event.received")}
                  </option>
                  {events.map((e) => (
                    <option key={e} value={e}>
                      {t(`commission.event.${e}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("commission.form.releaseMode")}>
                <Select
                  name="releaseMode"
                  defaultValue={row?.releaseMode ?? "proportional"}
                >
                  <option value="proportional">
                    {t("commission.form.releaseMode.proportional")}
                  </option>
                  <option value="full">
                    {t("commission.form.releaseMode.full")}
                  </option>
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label={t("commission.form.notes")}>
                <Textarea
                  name="notes"
                  rows={2}
                  defaultValue={row?.notes ?? ""}
                />
              </Field>
            </div>
          </Card>
        </fieldset>
        {editable ? (
          <SubmitButton data-agreement-save>
            {t("commission.form.save")}
          </SubmitButton>
        ) : null}
      </form>

      {row ? (
        <div className="mt-4">
          <Card title={t("commission.form.section.review")}>
            <div className="flex flex-wrap items-end gap-3">
              <Link
                href={`/app/commissions?tab=simulator&draft=${row.id}`}
                className="text-sm font-medium text-brand-700 underline"
                data-agreement-simulate
              >
                {t("commission.sim.inAgreement")}
              </Link>
              {(["draft", "suspended"] as string[]).includes(row.status) ? (
                <form action={agreementStepAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="step" value="activate" />
                  <SubmitButton
                    confirmText={t("commission.step.activateConfirm")}
                    disabled={conflicts.length > 0}
                    data-agreement-activate
                  >
                    {t("commission.step.activate")}
                  </SubmitButton>
                </form>
              ) : null}
              {(["duplicate", "version"] as const).map((step) => (
                <form key={step} action={agreementStepAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="step" value={step} />
                  <SubmitButton variant="secondary" data-agreement-step={step}>
                    {t(`commission.step.${step}`)}
                  </SubmitButton>
                </form>
              ))}
            </div>
            {row.status === "active" || row.status === "suspended" ? (
              <form
                action={agreementStepAction}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={row.id} />
                <div className="min-w-0 flex-1 basis-64">
                  <Field label={t("commission.step.reason")}>
                    <Input name="reason" required minLength={3} />
                  </Field>
                </div>
                {row.status === "active" ? (
                  <SubmitButton name="step" value="suspend" variant="secondary">
                    {t("commission.step.suspend")}
                  </SubmitButton>
                ) : null}
                <SubmitButton name="step" value="end" variant="secondary">
                  {t("commission.step.end")}
                </SubmitButton>
              </form>
            ) : null}
          </Card>
        </div>
      ) : null}
    </>
  );
}
