import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type PaymentPlan } from "@/lib/db";
import { PAYMENT_PLAN_EVENTS, planPercent } from "@/lib/customer-payment";
import { listPaymentPlans } from "@/lib/services/customer-payment";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  TextLink,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { savePaymentPlanAction } from "../../actions/customer-payment";

/** Linhas de parcela no formulário (as vazias não contam). */
const ROWS = 6;

/**
 * Configurações → Formas de pagamento do cliente (dono, 15/11/2026;
 * docs/CUSTOMER_PAYMENT.md): parcelas (% + evento + dias), alçada com quem
 * responde e juros compostos ao mês das parcelas depois da entrega. Só o
 * administrador.
 */
export default async function PaymentPlansPage({
  searchParams,
}: PageProps<"/app/settings/payment-plans">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "settings");
  if (user.role !== "admin") redirect("/app/settings");
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const error = one(sp.error);
  const saved = one(sp.saved) === "1";
  const [plans, users] = await Promise.all([
    listPaymentPlans(),
    getStore().list("users", { filter: { active: true } }),
  ]);
  const staff = users
    .filter((u) => isWellmix(u))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nameOf = (id: string | null) =>
    (id && users.find((u) => u.id === id)?.name) || "—";
  const errorKey = `customerPayment.error.${error ?? ""}` as DictionaryKey;

  const form = (plan: PaymentPlan | null) => (
    <form
      action={savePaymentPlanAction}
      className="space-y-3"
      data-payment-plan-form={plan?.id ?? "new"}
    >
      <input type="hidden" name="id" value={plan?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field label={t("paymentPlans.name")}>
          <Input
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={plan?.name ?? ""}
          />
        </Field>
        <Field label={t("paymentPlans.sortOrder")}>
          <Input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={plan?.sortOrder ?? ""}
          />
        </Field>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-700">
          {t("paymentPlans.installments")}
        </p>
        <p className="text-xs text-zinc-500">
          {t("paymentPlans.installmentsHint")}
        </p>
        <div className="mt-1 space-y-1.5">
          {Array.from({ length: ROWS }, (_, k) => {
            const row = plan?.installments[k];
            return (
              <div
                key={k}
                className="grid grid-cols-[3rem_6rem_minmax(0,1fr)_6rem] items-center gap-2"
              >
                <span className="text-xs text-zinc-500">{k + 1}</span>
                <Input
                  name={`percent.${k + 1}`}
                  inputMode="decimal"
                  placeholder="%"
                  aria-label={`${t("paymentPlans.percent")} ${k + 1}`}
                  defaultValue={row ? String(row.percent) : ""}
                />
                <Select
                  name={`event.${k + 1}`}
                  aria-label={`${t("paymentPlans.event")} ${k + 1}`}
                  defaultValue={row?.event ?? "order"}
                >
                  {PAYMENT_PLAN_EVENTS.map((e) => (
                    <option key={e} value={e}>
                      {t(`customerPayment.event.${e}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
                <Input
                  name={`days.${k + 1}`}
                  type="number"
                  min={0}
                  max={720}
                  placeholder={t("paymentPlans.days")}
                  aria-label={`${t("paymentPlans.days")} ${k + 1}`}
                  defaultValue={row ? String(row.days) : ""}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label={t("paymentPlans.interest")}
          hint={t("paymentPlans.interestHint")}
        >
          <Input
            name="monthlyInterestPercent"
            inputMode="decimal"
            defaultValue={plan?.monthlyInterestPercent ?? ""}
          />
        </Field>
        <Field label={t("paymentPlans.approver")}>
          <Select
            name="approverUserId"
            defaultValue={plan?.approverUserId ?? ""}
          >
            <option value="">—</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col justify-end gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="requiresApproval"
              defaultChecked={plan?.requiresApproval ?? false}
            />
            {t("paymentPlans.requiresApproval")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={plan?.active ?? true}
            />
            {t("paymentPlans.active")}
          </label>
        </div>
      </div>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader t={t} title={t("paymentPlans.title")} />
      <p className="mb-3 text-sm text-zinc-600">
        {t("paymentPlans.intro")}{" "}
        <TextLink href="/app/settings">{t("paymentPlans.back")}</TextLink>
      </p>
      {saved ? <Alert tone="success">{t("paymentPlans.saved")}</Alert> : null}
      {error ? (
        <Alert tone="danger">
          {t(errorKey) !== errorKey ? t(errorKey) : t("common.error")}
        </Alert>
      ) : null}
      <div className="mt-3 space-y-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <details data-payment-plan={plan.id}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-900">{plan.name}</span>
                {plan.active ? null : (
                  <Badge>{t("paymentPlans.inactive")}</Badge>
                )}
                {plan.requiresApproval ? (
                  <Badge tone="warning">
                    {t("paymentPlans.approvalBy", {
                      name: nameOf(plan.approverUserId),
                    })}
                  </Badge>
                ) : null}
                {plan.monthlyInterestPercent ? (
                  <Badge tone="info">
                    {t("paymentPlans.interestBadge", {
                      rate: plan.monthlyInterestPercent.toLocaleString(t.intl),
                    })}
                  </Badge>
                ) : null}
                <span className="text-xs text-zinc-500">
                  {planPercent(plan.installments).toLocaleString(t.intl)}%
                </span>
              </summary>
              <div className="mt-3">{form(plan)}</div>
            </details>
          </Card>
        ))}
        <Card title={t("paymentPlans.new")}>{form(null)}</Card>
      </div>
    </>
  );
}
