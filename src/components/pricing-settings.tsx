import type { Translate } from "@/i18n";
import type { Settings } from "@/lib/settings";
import type { FxView } from "@/lib/services/fx";
import { CurrencySelect } from "@/components/currency-select";
import { Badge, Field, Input } from "@/components/ui";
import { FxManualFields } from "@/components/fx-manual-field";

/*
 * Configurações do preço ao cliente (dentro do formulário de Configurações):
 * margem geral, por linha e por cliente (facultativas), frete por CBM, câmbio
 * PTAX do dia e câmbio manual de reserva. Os campos "chave.id" são montados
 * em objeto por saveSettingsAction.
 */
export function PricingSettings({
  t,
  s,
  lines,
  customers,
  fx,
}: {
  t: Translate;
  s: Settings;
  lines: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  fx: FxView;
}) {
  const fxTone =
    fx.status === "today"
      ? "success"
      : fx.status === "none"
        ? "danger"
        : "warning";
  const rateText = (c: "USD" | "RMB" | "EUR") =>
    fx.rates[c] ? `R$ ${fx.rates[c]!.toFixed(4)}` : "—";
  return (
    <>
      <h3 className="border-t border-zinc-100 pt-4 text-sm font-semibold text-zinc-900">
        {t("pricing.settings.title")}
      </h3>
      <p className="text-xs leading-relaxed text-zinc-500">
        {t("pricing.settings.hint")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t("pricing.settings.margin")}
          hint={t("pricing.settings.marginHint")}
        >
          <Input
            name="marginPercent"
            type="number"
            step="0.1"
            min="0"
            max="1000"
            required
            defaultValue={s.marginPercent}
          />
        </Field>
        <Field
          label={t("pricing.settings.freight")}
          hint={t("pricing.settings.freightHint")}
        >
          <Input
            name="freightPerCbm"
            type="number"
            step="0.01"
            min="0"
            defaultValue={s.freightPerCbm ?? ""}
          />
        </Field>
        <Field label={t("pricing.settings.freightCurrency")}>
          <CurrencySelect
            name="freightCurrency"
            value={s.freightCurrency}
            t={t}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-900">
            {t("pricing.settings.fx")}
          </p>
          <Badge tone={fxTone}>
            {t(`pricing.fx.status.${fx.status}`, { day: fx.day ?? "—" })}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          USD {rateText("USD")} · RMB {rateText("RMB")} · EUR {rateText("EUR")}
          {fx.source ? ` · ${t(`pricing.fx.source.${fx.source}`)}` : ""}
        </p>
        {fx.status !== "today" && fx.lastError ? (
          <p className="mt-1 text-xs text-red-700">
            {t("pricing.fx.lastError", { reason: fx.lastError })}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          {t("pricing.settings.fxManualHint")}
        </p>
        <input type="hidden" name="fxManualRates.__form" value="1" />
        <div className="mt-2">
          <FxManualFields
            defaults={{
              USD: s.fxManualRates.USD ?? fx.rates.USD ?? null,
              RMB: s.fxManualRates.RMB ?? fx.rates.RMB ?? null,
              EUR: s.fxManualRates.EUR ?? fx.rates.EUR ?? null,
            }}
            labels={{
              fetch: t("pricing.fx.fetchNow"),
              fetching: t("pricing.fx.fetching"),
              from: t("pricing.fx.fetchedFrom"),
              sourcePtax: t("pricing.fx.source.ptax"),
              sourceAwesome: t("pricing.fx.source.awesomeapi"),
              sourceEcb: t("pricing.fx.source.ecb"),
              error: t("pricing.fx.fetchError"),
            }}
          />
        </div>
      </div>

      <MarginTable
        title={t("pricing.settings.byLine")}
        hint={t("pricing.settings.byOptionalHint")}
        field="marginByLine"
        rows={lines}
        values={s.marginByLine}
        placeholder={`${s.marginPercent}%`}
      />
      <MarginTable
        title={t("pricing.settings.byCustomer")}
        hint={t("pricing.settings.byCustomerHint")}
        field="marginByCustomer"
        rows={customers}
        values={s.marginByCustomer}
        placeholder={t("pricing.settings.inherit")}
      />
    </>
  );
}

function MarginTable({
  title,
  hint,
  field,
  rows,
  values,
  placeholder,
}: {
  title: string;
  hint: string;
  field: "marginByLine" | "marginByCustomer";
  rows: Array<{ id: string; name: string }>;
  values: Record<string, number>;
  placeholder: string;
}) {
  return (
    <details className="rounded-xl border border-zinc-200 p-4" open>
      <summary className="cursor-pointer text-sm font-medium text-zinc-900">
        {title}
      </summary>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      <input type="hidden" name={`${field}.__form`} value="1" />
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${field}-${r.id}`}
              className="min-w-0 truncate text-sm text-zinc-700"
            >
              {r.name}
            </label>
            <span className="flex items-center gap-1">
              <Input
                id={`${field}-${r.id}`}
                name={`${field}.${r.id}`}
                type="number"
                step="0.1"
                min="0"
                max="1000"
                placeholder={placeholder}
                defaultValue={values[r.id] ?? ""}
                className="w-24!"
              />
              <span className="text-sm text-zinc-500">%</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
