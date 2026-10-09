import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getFreightView } from "@/lib/services/freight";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  Textarea,
  formatDate,
  formatMoney,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton } from "@/components/submit-button";
import { answerFreightAction } from "../../actions/freight";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { MoneyInput } from "@/components/money-input";

const num = (intl: string, n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? null
    : n.toLocaleString(intl, { maximumFractionDigits: digits });

/**
 * Pedido de frete para a companhia marítima: só a carga (sem preço, nome do
 * fornecedor ou cliente) e o formulário do valor do frete.
 */
export default async function FreightPage({
  params,
  searchParams,
}: PageProps<"/app/freight/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const view = await getFreightView(user, id);
  if (!view) notFound();
  const t = await getT();
  const { freight, request, sheet, canAnswer } = view;
  const errorCode = typeof error === "string" ? error : "";
  const errorText = !errorCode
    ? null
    : ([`freight.error.${errorCode}`, `common.${errorCode}`]
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? t("common.error"));
  const size =
    sheet?.heightCm && sheet.widthCm && sheet.lengthCm
      ? `${num(t.intl, sheet.heightCm, 1)} × ${num(t.intl, sheet.widthCm, 1)} × ${num(t.intl, sheet.lengthCm, 1)} cm`
      : null;
  const tone =
    freight.status === "answered"
      ? "success"
      : freight.status === "cancelled"
        ? "neutral"
        : "warning";

  return (
    <>
      <PageHeader
        t={t}
        title={t("freight.detailTitle", { product: request.productName })}
        subtitle={
          <Badge tone={tone}>{t(`freight.status.${freight.status}`)}</Badge>
        }
      />
      <div className="space-y-3">
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {saved ? <Alert tone="success">{t("freight.saved")}</Alert> : null}
        {!canAnswer ? <Alert tone="info">{t("freight.closed")}</Alert> : null}
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("freight.cargoTitle")}>
          <DescriptionList
            items={[
              [
                t("freight.cargo.quantity"),
                `${request.quantity.toLocaleString(t.intl)} ${request.unit}`,
              ],
              [t("freight.cargo.cartons"), num(t.intl, freight.cartons, 0)],
              [
                t("freight.cargo.cbm"),
                freight.totalCbm !== null
                  ? `${num(t.intl, freight.totalCbm, 3)} m³`
                  : null,
              ],
              [
                t("freight.cargo.gross"),
                freight.grossWeightKg !== null
                  ? `${num(t.intl, freight.grossWeightKg)} kg`
                  : null,
              ],
              [
                t("freight.cargo.perCarton"),
                num(t.intl, sheet?.masterCartonQty, 0),
              ],
              [
                t("freight.cargo.cbmPerCarton"),
                num(t.intl, sheet?.cbmPerCarton, 4),
              ],
              [t("freight.cargo.cartonSize"), size],
              [t("freight.cargo.incoterm"), sheet?.incoterm ?? null],
              [t("freight.cargo.location"), sheet?.location ?? null],
              [t("freight.cargo.package"), sheet?.packageType ?? null],
              [t("freight.cargo.container"), sheet?.containerType ?? null],
              [
                t("freight.cargo.productionStart"),
                sheet?.productionStartAt
                  ? formatDate(sheet.productionStartAt, t)
                  : null,
              ],
              [t("freight.cargo.ncm"), sheet?.ncm ?? null],
              [t("freight.col.deadline"), formatDate(request.deadline, t)],
            ]}
          />
          {request.description ? (
            <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-700">
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("freight.cargo.description")}
              </span>
              {request.description}
            </p>
          ) : null}
        </Card>

        <Card title={t("freight.formTitle")}>
          {freight.status === "answered" ? (
            <p className="mb-3 text-sm text-zinc-700">
              <strong className="text-brand-800">
                {formatMoney(freight.amount, freight.currency, t)}
              </strong>
              {freight.transitDays
                ? ` · ${t("history.days", { days: freight.transitDays })}`
                : ""}
              <span className="block text-xs text-zinc-500">
                {t("freight.answeredAt", {
                  date: formatDate(freight.answeredAt, t),
                })}
              </span>
            </p>
          ) : null}
          {canAnswer ? (
            <form
              action={answerFreightAction}
              className="grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="freightId" value={freight.id} />
              <p className="text-xs leading-relaxed text-zinc-500 sm:col-span-2">
                {t("freight.form.hint")}
              </p>
              <Field label={t("freight.form.amount")}>
                <MoneyInput
                  locale={t.intl}
                  name="amount"
                  watchField="currency"
                  required
                  defaultAmount={freight.amount ?? null}
                />
              </Field>
              <Field label={t("freight.form.currency")}>
                <CurrencySelect
                  name="currency"
                  value={freight.currency ?? "USD"}
                  t={t}
                />
              </Field>
              <Field label={t("freight.form.transitDays")}>
                <Input
                  name="transitDays"
                  type="number"
                  step="1"
                  min="0"
                  max="365"
                  defaultValue={freight.transitDays ?? ""}
                />
              </Field>
              <Field label={t("freight.form.validUntil")}>
                <Input
                  name="validUntil"
                  type="date"
                  defaultValue={freight.validUntil?.slice(0, 10) ?? ""}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("freight.form.notes")}>
                  <Textarea
                    name="notes"
                    rows={3}
                    maxLength={1000}
                    defaultValue={freight.notes ?? ""}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <SubmitButton>
                  {freight.status === "answered"
                    ? t("freight.form.update")
                    : t("freight.form.save")}
                </SubmitButton>
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </>
  );
}
